const CARD_DEFS = [
  // Offense (45)
  { name: 'fire',             category: 'offense',  count: 15 },
  { name: 'coaxial_mg',      category: 'offense',  count: 10 },
  { name: 'he',              category: 'munition', count: 12 },
  { name: 'heat',            category: 'munition', count: 6 },
  { name: 'sabot',           category: 'munition', count: 2 },
  // Hazards (18)
  { name: 'tracked',         category: 'hazard',   count: 6 },
  { name: 'jammed_breech',   category: 'hazard',   count: 6 },
  { name: 'comms_jammed',    category: 'hazard',   count: 6 },
  // Remedies (18)
  { name: 'field_repair',    category: 'remedy',   count: 6 },
  { name: 'clear_breech',    category: 'remedy',   count: 6 },
  { name: 'reestablish_comms', category: 'remedy', count: 6 },
  // Defenses (19)
  { name: 'smoke_launchers', category: 'defense',  count: 10 },
  { name: 'ablative_armor',  category: 'defense',  count: 6 },
  { name: 'reinforced_treads',  category: 'safety', count: 1 },
  { name: 'advanced_targeting',  category: 'safety', count: 1 },
  { name: 'encrypted_comms',    category: 'safety', count: 1 },
];

const HAZARD_TO_SAFETY = {
  tracked: 'reinforced_treads',
  jammed_breech: 'advanced_targeting',
  comms_jammed: 'encrypted_comms',
};

const HAZARD_TO_REMEDY = {
  tracked: 'field_repair',
  jammed_breech: 'clear_breech',
  comms_jammed: 'reestablish_comms',
};

const REMEDY_TO_HAZARD = {};
for (const [hazard, remedy] of Object.entries(HAZARD_TO_REMEDY)) {
  REMEDY_TO_HAZARD[remedy] = hazard;
}

const MUNITION_DAMAGE = {
  he: 25,
  heat: 50,
  sabot: 75,
  coaxial_mg: 10,
};

function createDeck() {
  const deck = [];
  for (const def of CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      deck.push({ name: def.name, category: def.category });
    }
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function draw(state) {
  if (state.deck.length === 0) {
    if (state.discard.length === 0) {
      state.gameOver = true;
      state.winner = null; // draw — no cards left
      return null;
    }
    state.deck = shuffle(state.discard.splice(0));
  }
  return state.deck.pop();
}

module.exports = {
  CARD_DEFS, HAZARD_TO_SAFETY, HAZARD_TO_REMEDY, REMEDY_TO_HAZARD,
  MUNITION_DAMAGE, createDeck, shuffle, draw,
};
