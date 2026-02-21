const { HAZARD_TO_SAFETY } = require('./deck');
const { draw } = require('./deck');
const { logInterrupt, logEvent } = require('./log');

// Returns true if the attack was negated by smoke
function trySmokeInterrupt(state, attacker, target, getAIDecision) {
  // Heavy Adrenaline (Bunker Buster) bypasses Smoke Launchers
  if (attacker.class === 'heavy' && attacker.isAdrenaline) {
    return false;
  }

  // Each player (in turn order starting from target) gets a chance to smoke
  const playerOrder = getInterruptOrder(state, target);

  for (const player of playerOrder) {
    if (!player.alive) continue;

    const smokeIndex = player.hand.findIndex(c => c.name === 'smoke_launchers');
    if (smokeIndex === -1) continue;

    // Comms Jammed: can only smoke for yourself
    const hasCommsJammed = player.tableau.hazards.some(h => h.name === 'comms_jammed');
    if (hasCommsJammed && player.id !== target.id) continue;

    // Ask AI if they want to play smoke
    if (getAIDecision(player, 'smoke', { attacker, target })) {
      const smoke = player.hand.splice(smokeIndex, 1)[0];
      state.discard.push(smoke);
      logInterrupt(state, player.id, 'smoke_launchers', {
        protects: target.id,
        against: attacker.id,
      });
      return true;
    }
  }

  return false;
}

// Returns { negated: boolean, bonusTurnPlayer: number|null }
function tryCoupFourre(state, attacker, target, hazardName) {
  const safetyName = HAZARD_TO_SAFETY[hazardName];
  if (!safetyName) return { negated: false, bonusTurnPlayer: null };

  const safetyIndex = target.hand.findIndex(c => c.name === safetyName);
  if (safetyIndex === -1) return { negated: false, bonusTurnPlayer: null };

  // Coup Fourré! Always triggered (AI always plays it).
  const safety = target.hand.splice(safetyIndex, 1)[0];

  // Equip the safety
  target.tableau.safeties.push(safety);

  // Attacker discards 1 random card (if they have any)
  if (attacker.hand.length > 0) {
    const idx = Math.floor(Math.random() * attacker.hand.length);
    const discarded = attacker.hand.splice(idx, 1)[0];
    state.discard.push(discarded);
  }

  // Target draws 1 card
  const drawn = draw(state);
  if (drawn) target.hand.push(drawn);

  logInterrupt(state, target.id, 'coup_fourre', {
    safety: safetyName,
    against: attacker.id,
    hazard: hazardName,
  });

  return { negated: true, bonusTurnPlayer: target.id };
}

// Get interrupt order: target first, then others in turn order
function getInterruptOrder(state, target) {
  const order = [target];
  const n = state.players.length;
  let idx = (target.id + 1) % n;
  while (idx !== target.id) {
    order.push(state.players[idx]);
    idx = (idx + 1) % n;
  }
  return order;
}

module.exports = { trySmokeInterrupt, tryCoupFourre };
