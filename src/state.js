const CLASSES = {
  heavy: { maxHP: 100, adrenalineThreshold: 25, handSize: 6 },
  medium: { maxHP: 85, adrenalineThreshold: 21, handSize: 6 },
  light: { maxHP: 80, adrenalineThreshold: 20, handSize: 10 },
};

function createPlayer(id, tankClass) {
  const cls = CLASSES[tankClass];
  if (!cls) throw new Error(`Unknown class: ${tankClass}`);
  return {
    id,
    class: tankClass,
    maxHP: cls.maxHP,
    currentHP: cls.maxHP,
    adrenalineThreshold: cls.adrenalineThreshold,
    handSize: cls.handSize,
    killMarks: 0,
    hand: [],
    tableau: {
      breech: null,
      hazards: [],
      safeties: [],
      ablativeArmor: 0,
    },
    isAdrenaline: false,
    hasSpawnShield: false,
    alive: true,
  };
}

function createGameState(playerConfigs, mode = "duel") {
  if (mode === "duel" && playerConfigs.length !== 2) {
    throw new Error("Duel mode requires exactly 2 players");
  }
  if (mode === "deathmatch" && playerConfigs.length < 3) {
    throw new Error("Deathmatch mode requires 3+ players");
  }

  const players = playerConfigs.map((cfg, i) => createPlayer(i, cfg.class));

  return {
    deck: [],
    discard: [],
    players,
    turnIndex: Math.floor(Math.random() * players.length),
    mode,
    gameOver: false,
    winner: null,
    log: [],
  };
}

module.exports = { CLASSES, createPlayer, createGameState };
