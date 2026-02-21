const { createGameState } = require("./state");
const { createDeck, shuffle } = require("./deck");
const { playGame } = require("./game");
const { getAIDecision } = require("./ai");

function runSimulation(options) {
  const {
    games = 1000,
    players = ["heavy", "medium"],
    mode = "duel",
    verbose = false,
    maxTurns = 1000, // Prevent infinite loops
  } = options;

  const stats = {
    gamesPlayed: 0,
    winsByClass: {},
    winsByPosition: {},
    draws: 0,
    totalTurns: 0,
    totalCardsPlayed: 0,
    killsByClass: {},
    degenerateGames: 0,
  };

  for (const p of players) {
    stats.winsByClass[p] = 0;
    stats.killsByClass[p] = 0;
  }
  for (let i = 0; i < players.length; i++) {
    stats.winsByPosition[i] = 0;
  }

  for (let i = 0; i < games; i++) {
    const playerConfigs = players.map((c) => ({ class: c }));
    const state = createGameState(playerConfigs, mode);

    // Initialize deck
    state.deck = shuffle(createDeck());

    // Play game with a turn limit to catch infinite loops
    let turnCount = 0;
    const originalPlayTurn = require("./game").playTurn;

    try {
      // Initial draw
      for (const player of state.players) {
        if (player.hand.length === 0) {
          for (let j = 0; j < player.handSize; j++) {
            const card = state.deck.pop();
            if (card) player.hand.push(card);
          }
        }
      }

      while (!state.gameOver && turnCount < maxTurns) {
        originalPlayTurn(state, getAIDecision);
        turnCount++;
      }

      if (turnCount >= maxTurns) {
        state.gameOver = true;
        state.winner = null;
        stats.degenerateGames++;
        if (verbose) console.warn(`Game ${i} hit max turns (${maxTurns})`);
      }
    } catch (e) {
      console.error(`Game ${i} crashed:`, e);
      stats.degenerateGames++;
      continue;
    }

    stats.gamesPlayed++;

    // Count turns from log
    const turns = state.log.filter(
      (e) => e.type === "event" && e.event === "start_turn",
    ).length;
    stats.totalTurns += turns;

    // Count cards played
    const actions = state.log.filter(
      (e) => e.type === "action" && e.action !== "discard",
    );
    const interrupts = state.log.filter((e) => e.type === "interrupt");
    stats.totalCardsPlayed += actions.length + interrupts.length;

    // Count kills
    for (const p of state.players) {
      stats.killsByClass[p.class] += p.killMarks;
    }

    if (state.winner !== null) {
      const winner = state.players[state.winner];
      stats.winsByClass[winner.class]++;
      stats.winsByPosition[winner.id]++;
    } else {
      stats.draws++;
      if (state.deck.length === 0 && state.discard.length === 0) {
        stats.degenerateGames++;
        if (verbose)
          console.warn(`Game ${i} ended with empty deck and discard`);
      }
    }

    if (verbose) {
      console.log(`\n--- Game ${i} Log ---`);
      for (const entry of state.log) {
        console.log(JSON.stringify(entry));
      }
      const winnerStr =
        state.winner !== null ? state.players[state.winner].class : "Draw";
      console.log(`Game ${i} finished in ${turns} turns. Winner: ${winnerStr}`);
    }
  }

  return {
    ...stats,
    averageTurns:
      stats.gamesPlayed > 0 ? stats.totalTurns / stats.gamesPlayed : 0,
    averageCardsPlayed:
      stats.gamesPlayed > 0 ? stats.totalCardsPlayed / stats.gamesPlayed : 0,
  };
}

module.exports = { runSimulation };
