const {
  HAZARD_TO_SAFETY,
  HAZARD_TO_REMEDY,
  REMEDY_TO_HAZARD,
} = require("./deck");
const { resolveDamage } = require("./damage");
const { trySmokeInterrupt, tryCoupFourre } = require("./interrupts");
const { logAction } = require("./log");

// Returns a list of valid action descriptors for the player
function getValidActions(state, player) {
  const actions = [];
  const hasTracked = player.tableau.hazards.some((h) => h.name === "tracked");
  const hasJammedBreech = player.tableau.hazards.some(
    (h) => h.name === "jammed_breech",
  );
  const opponents = state.players.filter(
    (p) => p.id !== player.id && p.alive && !p.hasSpawnShield,
  );

  // Load: need a munition in hand, no jammed breech
  if (!hasJammedBreech) {
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      if (card.category === "munition") {
        actions.push({ type: "load", cardIndex: i, card });
      }
    }
  }

  // Fire: need a fire card, breech loaded, no tracked, have a target
  if (!hasTracked && player.tableau.breech && opponents.length > 0) {
    for (let i = 0; i < player.hand.length; i++) {
      if (player.hand[i].name === "fire") {
        for (const opp of opponents) {
          // Light Ghost (Adrenaline): opponent must discard 1 card to fire at them
          if (opp.class === "light" && opp.isAdrenaline) {
            // Attacker needs at least 2 cards (the fire card + 1 to discard)
            const fireCards = player.hand.filter((c) => c.name === "fire");
            if (
              player.hand.length - fireCards.length < 1 &&
              fireCards.length <= 1
            )
              continue;
          }
          actions.push({ type: "fire", cardIndex: i, targetId: opp.id });
        }
        break; // All fire cards are identical
      }
    }
  }

  // Quick Fire: need coaxial_mg, no tracked, have a target
  if (!hasTracked && opponents.length > 0) {
    for (let i = 0; i < player.hand.length; i++) {
      if (player.hand[i].name === "coaxial_mg") {
        for (const opp of opponents) {
          // Light Ghost (Adrenaline): opponent must discard 1 card to fire at them
          if (opp.class === "light" && opp.isAdrenaline) {
            // Attacker needs at least 2 cards (the mg card + 1 to discard)
            const mgCards = player.hand.filter((c) => c.name === "coaxial_mg");
            if (player.hand.length - mgCards.length < 1 && mgCards.length <= 1)
              continue;
          }
          actions.push({ type: "quickfire", cardIndex: i, targetId: opp.id });
        }
        break; // All coaxial_mg cards are identical
      }
    }
  }

  // Sabotage: need a hazard card, have a valid target
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    if (card.category === "hazard") {
      for (const opp of opponents) {
        // Check if target already has this hazard
        if (opp.tableau.hazards.some((h) => h.name === card.name)) continue;
        // Check if target has matching safety (would trigger coup fourré, still valid action)
        actions.push({
          type: "sabotage",
          cardIndex: i,
          targetId: opp.id,
          card,
        });
      }
    }
  }

  // Repair: need a remedy, self or ally has matching hazard
  const allies = state.players.filter((p) => p.alive);
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    if (card.category === "remedy") {
      const hazardName = REMEDY_TO_HAZARD[card.name];
      for (const ally of allies) {
        if (ally.tableau.hazards.some((h) => h.name === hazardName)) {
          actions.push({
            type: "repair",
            cardIndex: i,
            targetId: ally.id,
            card,
          });
        }
      }
    }
  }

  // Equip: ablative armor or safety
  for (let i = 0; i < player.hand.length; i++) {
    const card = player.hand[i];
    if (card.name === "ablative_armor") {
      actions.push({ type: "equip", cardIndex: i, card });
    } else if (card.category === "safety") {
      // Don't equip if already have it
      if (!player.tableau.safeties.some((s) => s.name === card.name)) {
        actions.push({ type: "equip", cardIndex: i, card });
      }
    }
  }

  // Discard: always available (pick any card)
  for (let i = 0; i < player.hand.length; i++) {
    actions.push({ type: "discard", cardIndex: i, card: player.hand[i] });
  }

  return actions;
}

// Execute a chosen action. Returns { bonusTurnPlayer: number|null }
function executeAction(state, player, action, getAIDecision) {
  let bonusTurnPlayer = null;

  switch (action.type) {
    case "load": {
      const card = player.hand.splice(action.cardIndex, 1)[0];
      if (player.tableau.breech) {
        state.discard.push(player.tableau.breech);
      }
      player.tableau.breech = card;
      logAction(state, player.id, "load", { munition: card.name });
      break;
    }

    case "fire": {
      const target = state.players[action.targetId];
      const fireCard = player.hand.splice(action.cardIndex, 1)[0];

      // Light Ghost: attacker must discard 1 card first
      if (target.class === "light" && target.isAdrenaline) {
        const ghostDiscard = getAIDecision(player, "ghost_discard", { target });
        if (
          ghostDiscard !== null &&
          ghostDiscard !== undefined &&
          player.hand.length > 0
        ) {
          const discarded = player.hand.splice(ghostDiscard, 1)[0];
          if (discarded) state.discard.push(discarded);
        }
      }

      const munition = player.tableau.breech;
      player.tableau.breech = null;

      // Check for smoke interrupt
      const smoked = trySmokeInterrupt(state, player, target, getAIDecision);
      if (smoked) {
        state.discard.push(fireCard);
        state.discard.push(munition);
        logAction(state, player.id, "fire", {
          munition: munition.name,
          target: target.id,
          smoked: true,
        });
      } else {
        state.discard.push(fireCard);
        state.discard.push(munition);
        logAction(state, player.id, "fire", {
          munition: munition.name,
          target: target.id,
        });
        resolveDamage(state, player, target, munition.name);
      }
      break;
    }

    case "quickfire": {
      const target = state.players[action.targetId];
      const mgCard = player.hand.splice(action.cardIndex, 1)[0];

      // Light Ghost: attacker must discard 1 card first
      if (target.class === "light" && target.isAdrenaline) {
        const ghostDiscard = getAIDecision(player, "ghost_discard", { target });
        if (
          ghostDiscard !== null &&
          ghostDiscard !== undefined &&
          player.hand.length > 0
        ) {
          const discarded = player.hand.splice(ghostDiscard, 1)[0];
          if (discarded) state.discard.push(discarded);
        }
      }

      const smoked = trySmokeInterrupt(state, player, target, getAIDecision);
      if (smoked) {
        state.discard.push(mgCard);
        logAction(state, player.id, "quickfire", {
          target: target.id,
          smoked: true,
        });
      } else {
        state.discard.push(mgCard);
        logAction(state, player.id, "quickfire", { target: target.id });
        resolveDamage(state, player, target, "coaxial_mg");
      }
      break;
    }

    case "sabotage": {
      const target = state.players[action.targetId];
      const hazard = player.hand.splice(action.cardIndex, 1)[0];

      // Check for Coup Fourré
      const result = tryCoupFourre(state, player, target, hazard.name);
      if (result.negated) {
        state.discard.push(hazard);
        bonusTurnPlayer = result.bonusTurnPlayer;
      } else {
        target.tableau.hazards.push(hazard);
        logAction(state, player.id, "sabotage", {
          hazard: hazard.name,
          target: target.id,
        });
      }
      break;
    }

    case "repair": {
      const target = state.players[action.targetId];
      const remedy = player.hand.splice(action.cardIndex, 1)[0];
      const hazardName = REMEDY_TO_HAZARD[remedy.name];
      const hazardIdx = target.tableau.hazards.findIndex(
        (h) => h.name === hazardName,
      );
      if (hazardIdx !== -1) {
        const removed = target.tableau.hazards.splice(hazardIdx, 1)[0];
        state.discard.push(removed);
      }
      state.discard.push(remedy);
      logAction(state, player.id, "repair", {
        remedy: remedy.name,
        target: target.id,
      });
      break;
    }

    case "equip": {
      const card = player.hand.splice(action.cardIndex, 1)[0];
      if (card.name === "ablative_armor") {
        player.tableau.ablativeArmor++;
      } else {
        player.tableau.safeties.push(card);
      }
      logAction(state, player.id, "equip", { card: card.name });
      break;
    }

    case "discard": {
      const card = player.hand.splice(action.cardIndex, 1)[0];
      state.discard.push(card);
      logAction(state, player.id, "discard", { card: card.name });
      break;
    }
  }

  return { bonusTurnPlayer };
}

module.exports = { getValidActions, executeAction };
