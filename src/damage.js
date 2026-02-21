const { MUNITION_DAMAGE } = require("./deck");
const { logDamage, logEvent } = require("./log");
const { draw } = require("./deck");

function resolveDamage(state, attacker, target, munitionName) {
  // Step 1: Base damage
  let damage = MUNITION_DAMAGE[munitionName];
  const steps = [`base=${damage}`];

  const attackerHeavyAdrenaline =
    attacker.class === "heavy" && attacker.isAdrenaline;

  // Step 3: HEAT check (runs even for Heavy Adrenaline)
  if (munitionName === "heat" && target.tableau.ablativeArmor > 0) {
    target.tableau.ablativeArmor--;
    steps.push("heat_destroyed_armor");
    // Skip step 4
  }
  // Step 4: Ablative Armor (skipped by Heavy Adrenaline or HEAT)
  else if (
    !attackerHeavyAdrenaline &&
    munitionName !== "heat" &&
    target.tableau.ablativeArmor > 0
  ) {
    const reduction = Math.ceil(damage / 2);
    damage -= reduction;
    target.tableau.ablativeArmor--;
    steps.push(`ablative_reduced=${reduction}`);
  }

  // Step 6: Floor at 0
  damage = Math.max(0, damage);

  // Apply damage
  target.currentHP -= damage;
  logDamage(state, target.id, damage, { munition: munitionName, steps });

  // Post-damage checks
  checkAdrenaline(state, target);
  return checkDeath(state, attacker, target);
}

function checkAdrenaline(state, player) {
  if (
    !player.isAdrenaline &&
    player.currentHP > 0 &&
    player.currentHP <= player.adrenalineThreshold
  ) {
    player.isAdrenaline = true;
    // Clear all hazards
    const cleared = player.tableau.hazards.splice(0);
    for (const h of cleared) {
      state.discard.push(h);
    }
    logEvent(state, "adrenaline", {
      player: player.id,
      cleared: cleared.map((c) => c.name),
    });
  }
}

function checkDeath(state, attacker, target) {
  if (target.currentHP > 0) return false;

  attacker.killMarks++;
  logEvent(state, "kill", {
    attacker: attacker.id,
    target: target.id,
    killMarks: attacker.killMarks,
  });

  if (state.mode === "duel") {
    state.gameOver = true;
    state.winner = attacker.id;
    return true;
  }

  // Deathmatch: check for win
  if (attacker.killMarks >= 3) {
    state.gameOver = true;
    state.winner = attacker.id;
    return true;
  }

  // Respawn
  respawn(state, target);
  return false;
}

function respawn(state, player) {
  // Discard hand
  for (const card of player.hand.splice(0)) {
    state.discard.push(card);
  }
  // Clear tableau
  if (player.tableau.breech) {
    state.discard.push(player.tableau.breech);
    player.tableau.breech = null;
  }
  for (const card of player.tableau.hazards.splice(0)) {
    state.discard.push(card);
  }
  for (const card of player.tableau.safeties.splice(0)) {
    state.discard.push(card);
  }
  // Ablative armor cards go to discard (create placeholder cards)
  for (let i = 0; i < player.tableau.ablativeArmor; i++) {
    state.discard.push({ name: "ablative_armor", category: "defense" });
  }
  player.tableau.ablativeArmor = 0;

  // Reset state
  player.currentHP = player.maxHP;
  player.isAdrenaline = false;
  player.hasSpawnShield = true;

  // Draw fresh hand
  for (let i = 0; i < player.handSize; i++) {
    const card = draw(state);
    if (!card) break;
    player.hand.push(card);
  }

  logEvent(state, "respawn", { player: player.id });
}

module.exports = { resolveDamage, checkAdrenaline, checkDeath, respawn };
