const { MUNITION_DAMAGE, REMEDY_TO_HAZARD } = require("./deck");

function getMunitionDamage(name) {
  return MUNITION_DAMAGE[name] || 0;
}

// Heuristic function to evaluate how useful a card is to the player right now.
// Lower value means it's a better candidate for discarding.
function getCardValue(card, player) {
  switch (card.category) {
    case "safety":
      // Useless if we already have it equipped
      if (player.tableau.safeties.some((s) => s.name === card.name)) return 0;
      return 90;
    case "remedy":
      const hazardName = REMEDY_TO_HAZARD[card.name];
      // Critical if we or an ally (simplified to just us for now) have the hazard
      if (player.tableau.hazards.some((h) => h.name === hazardName)) return 100;
      return 20; // Very situational otherwise
    case "hazard":
      return 75;
    case "defense":
      if (card.name === "smoke_launchers") return 65;
      if (card.name === "ablative_armor") return 55;
      return 50;
    case "munition":
      if (card.name === "sabot") return 80;
      if (card.name === "heat") return 60;
      if (card.name === "he") return 50;
      return 40;
    case "offense":
      if (card.name === "fire") return 70;
      if (card.name === "coaxial_mg") return 40;
      return 50;
    default:
      return 50;
  }
}

function getAIDecision(player, type, context) {
  if (type === "action") {
    const { validActions, state } = context;

    // 1. Fire / Quick Fire
    const attacks = validActions.filter(
      (a) => a.type === "fire" || a.type === "quickfire",
    );
    if (attacks.length > 0) {
      // Prefer targets with lower HP to secure kills
      let minHP = Infinity;
      for (const a of attacks) {
        const hp = state.players[a.targetId].currentHP;
        if (hp < minHP) minHP = hp;
      }
      const bestAttacks = attacks.filter(
        (a) => state.players[a.targetId].currentHP === minHP,
      );
      return bestAttacks[Math.floor(Math.random() * bestAttacks.length)];
    }

    // 2. Repair
    const repairs = validActions.filter((a) => a.type === "repair");
    if (repairs.length > 0) {
      return repairs[Math.floor(Math.random() * repairs.length)];
    }

    // 3. Load
    const loads = validActions.filter((a) => a.type === "load");
    if (loads.length > 0) {
      // Sort available munitions by damage (highest first)
      loads.sort(
        (a, b) =>
          getMunitionDamage(b.card.name) - getMunitionDamage(a.card.name),
      );
      const bestLoad = loads[0];

      // Only load if the breech is empty, or if the new munition is strictly better
      const currentBreechDamage = player.tableau.breech
        ? getMunitionDamage(player.tableau.breech.name)
        : -1;
      if (getMunitionDamage(bestLoad.card.name) > currentBreechDamage) {
        return bestLoad;
      }
    }

    // 4. Equip
    const equips = validActions.filter((a) => a.type === "equip");
    if (equips.length > 0) {
      return equips[Math.floor(Math.random() * equips.length)];
    }

    // 5. Sabotage
    const sabotages = validActions.filter((a) => a.type === "sabotage");
    if (sabotages.length > 0) {
      return sabotages[Math.floor(Math.random() * sabotages.length)];
    }

    // 6. Discard (Fallback)
    const discards = validActions.filter((a) => a.type === "discard");
    // Discard the card with the lowest heuristic value
    discards.sort(
      (a, b) => getCardValue(a.card, player) - getCardValue(b.card, player),
    );
    return discards[0];
  }

  if (type === "smoke") {
    // Simple AI: Always use smoke launchers if attacked
    return true;
  }

  if (type === "ghost_discard" || type === "discard_excess") {
    // Find the index of the lowest value card in hand
    let worstIdx = 0;
    let worstVal = Infinity;
    for (let i = 0; i < player.hand.length; i++) {
      const val = getCardValue(player.hand[i], player);
      if (val < worstVal) {
        worstVal = val;
        worstIdx = i;
      }
    }
    return worstIdx;
  }

  if (type === "medium_passive") {
    if (player.hand.length < 1) return null;

    // Score all cards in hand
    const scored = player.hand.map((card, index) => ({
      index,
      val: getCardValue(card, player),
    }));
    scored.sort((a, b) => a.val - b.val);

    // Use the passive if we have plenty of cards, or if our worst card is pretty bad
    if (player.hand.length >= 4 || scored[0].val <= 40) {
      return [scored[0].index];
    }
    return null;
  }

  return null;
}

module.exports = { getAIDecision, getCardValue };
