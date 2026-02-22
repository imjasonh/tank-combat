const { draw } = require("./deck");
const { getValidActions, executeAction } = require("./actions");
const { logEvent } = require("./log");

function playTurn(state, getAIDecision) {
  if (state.gameOver) return;

  const player = state.players[state.turnIndex];
  logEvent(state, "start_turn", { player: player.id });

  // 1. Start of Turn
  player.hasSpawnShield = false;
  // Draw up to hand size
  while (player.hand.length < player.handSize) {
    const drawnCard = draw(state);
    if (drawnCard) {
      player.hand.push(drawnCard);
    } else {
      break;
    }
  }

  if (state.gameOver) return; // Deck and discard empty

  // Free Actions: Medium Passive
  if (
    player.class === "medium" &&
    !player.isAdrenaline &&
    player.hand.length >= 1
  ) {
    const discardIndices = getAIDecision(player, "medium_passive", { state });
    if (Array.isArray(discardIndices) && discardIndices.length >= 1) {
      const card1 = player.hand.splice(discardIndices[0], 1)[0];

      if (card1) {
        state.discard.push(card1);
        const newCard = draw(state);
        if (newCard) player.hand.push(newCard);
        logEvent(state, "medium_passive", {
          player: player.id,
          discarded: [card1.name],
        });
      }
    }
  }

  if (state.gameOver) return;

  // 2. Action Phase
  const validActions = getValidActions(state, player);
  let action = null;

  if (validActions.length > 0) {
    action = getAIDecision(player, "action", { validActions, state });
    // Fallback if AI returns an invalid action
    if (!action || !validActions.includes(action)) {
      action = validActions[0]; // Default to the first valid action (usually a discard)
    }
  }

  let bonusTurnPlayer = null;
  let actionTaken = null;
  if (action) {
    const result = executeAction(state, player, action, getAIDecision);
    bonusTurnPlayer = result.bonusTurnPlayer;
    actionTaken = action.type;
  } else {
    logEvent(state, "skip_action", { player: player.id });
  }

  if (state.gameOver) return;

  // Medium Autoloader: if first action was load or fire, can do the other
  if (
    player.class === "medium" &&
    player.isAdrenaline &&
    bonusTurnPlayer === null
  ) {
    if (actionTaken === "load" || actionTaken === "fire") {
      const secondValidActions = getValidActions(state, player).filter(
        (a) =>
          (actionTaken === "load" && a.type === "fire") ||
          (actionTaken === "fire" && a.type === "load"),
      );

      if (secondValidActions.length > 0) {
        const secondAction = getAIDecision(player, "action", {
          validActions: secondValidActions,
          state,
        });

        if (secondAction && secondValidActions.includes(secondAction)) {
          const result2 = executeAction(
            state,
            player,
            secondAction,
            getAIDecision,
          );
          if (result2.bonusTurnPlayer !== null) {
            bonusTurnPlayer = result2.bonusTurnPlayer;
          }
        }
      }
    }
  }

  if (state.gameOver) return;

  // 3. End of Turn
  // Hand size check
  while (player.hand.length > player.handSize) {
    let discardIdx = getAIDecision(player, "discard_excess", { state });
    if (
      typeof discardIdx !== "number" ||
      discardIdx < 0 ||
      discardIdx >= player.hand.length
    ) {
      discardIdx = 0;
    }
    const card = player.hand.splice(discardIdx, 1)[0];
    state.discard.push(card);
    logEvent(state, "discard_excess", { player: player.id, card: card.name });
  }

  // Advance turn index
  if (bonusTurnPlayer !== null && bonusTurnPlayer !== undefined) {
    // Coup Fourré grants an immediate bonus turn.
    // Setting turnIndex to the bonus player means they take the next turn.
    // After their bonus turn, the index naturally advances to their left.
    state.turnIndex = bonusTurnPlayer;
    logEvent(state, "bonus_turn", { player: bonusTurnPlayer });
  } else {
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
  }
}

function playGame(state, getAIDecision) {
  // Initial draw for all players if their hands are empty
  for (const player of state.players) {
    if (player.hand.length === 0) {
      for (let i = 0; i < player.handSize; i++) {
        const card = draw(state);
        if (card) player.hand.push(card);
      }
    }
  }

  // Main game loop
  while (!state.gameOver) {
    playTurn(state, getAIDecision);
  }

  return state;
}

module.exports = { playTurn, playGame };
