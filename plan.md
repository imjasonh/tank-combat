# Tank Combat Simulator — Implementation Plan

## Phase 1: Pure Simulator (AI vs AI)

### 1.1 Core Data Model (`src/state.js`)

Define the game state as a plain object tree:

- **GameState**: `{ deck[], discard[], players[], turnIndex, mode, gameOver, winner }`
- **Player**: `{ id, class, maxHP, currentHP, killMarks, hand[], tableau, statusFlags }`
- **Tableau**: `{ breech: null|Card, hazards[], safeties[], ablativeArmor: int }`
- **StatusFlags**: `{ isAdrenaline, hasSpawnShield }`
- **Card**: `{ type, name }` — type is one of: `fire`, `coaxial_mg`, `he`, `heat`, `sabot`, `tracked`, `jammed_breech`, `comms_jammed`, `field_repair`, `clear_breech`, `reestablish_comms`, `smoke_launchers`, `ablative_armor`, `reinforced_treads`, `advanced_targeting`, `encrypted_comms`

### 1.2 Deck Construction (`src/deck.js`)

Build the 100-card deck per the spec. Provide `createDeck()`, `shuffle(deck)`, and `draw(state)` (handles reshuffle when deck is empty, handles game-over when both are empty).

### 1.3 Game Loop (`src/game.js`)

Implement the three-phase turn structure:

1. **Start of Turn** — clear spawn shield, draw 1 card
2. **Action Phase** — active player picks exactly 1 action (plus free actions like Medium's passive)
3. **End of Turn** — hand size check, advance turn index

The loop runs until a win condition is met (Duel: opponent at 0 HP; Deathmatch: 3 kill marks).

### 1.4 Actions (`src/actions.js`)

Each action is a function that validates preconditions and mutates state:

- **Load** — discard breech contents if any, move munition from hand to breech. Blocked by `jammed_breech`.
- **Fire** — discard `fire` card from hand, resolve breech munition against target. Blocked by `tracked` or empty breech. Triggers interrupt window.
- **Quick Fire** — discard `coaxial_mg` from hand, deal 10 DMG to target. Blocked by `tracked`. Triggers interrupt window.
- **Sabotage** — play hazard from hand onto target. Blocked by matching permanent safety (or triggers Coup Fourré).
- **Repair** — play remedy from hand, remove matching hazard from self or ally.
- **Equip** — play `ablative_armor` or permanent safety from hand to own tableau.
- **Discard** — discard 1 card. Mandatory fallback.

Free actions (not consuming the action phase):
- **Medium passive** — discard 2 cards, draw 1. Once per turn. Available when not in adrenaline.
- **Load when breech is full** — discards current breech contents first.

### 1.5 Interrupt / Resolution Stack (`src/interrupts.js`)

When Fire or Quick Fire is declared, open an interrupt window:

- **Smoke Launchers** — any player may negate the attack (unless they have `comms_jammed` and the target is someone else). The target can always smoke for themselves.
- **Bunker Buster** (Heavy Adrenaline) — attacks bypass Smoke Launchers entirely, no interrupt window for smoke.

When Sabotage is declared:

- **Coup Fourré** — if target holds the matching permanent safety, they may reveal it to negate the hazard, equip the safety, force attacker to discard 1 random card (if they have any), draw 1 card, and take a bonus turn. Turn order resumes to the left of the Coup Fourré player afterward.

### 1.6 Damage Resolution (`src/damage.js`)

Strict order:

1. Base damage from munition (10/25/50/75)
2. If attacker is Heavy Adrenaline: skip step 4 (ablative reduction) but still process step 3
3. HEAT check: if munition is HEAT, destroy 1 ablative armor on target, skip step 4
4. Ablative Armor check: if target has ablative armor, reduce damage by 50% (rounded up), discard 1
5. If target is Heavy (non-adrenaline): subtract 5 from damage
6. Floor damage at 0, apply to target's currentHP

Post-damage checks:

- **Adrenaline**: if HP <= threshold and not already adrenaline, set flag, clear all hazards
- **Death**: if HP <= 0:
  - Attacker gets +1 kill mark
  - Duel: game over
  - Deathmatch: check 3 kill marks for win, otherwise respawn (reset HP, clear tableau, draw fresh hand, set spawn shield)

### 1.7 AI Strategy (`src/ai.js`)

Start with a simple priority-based AI:

1. If breech is loaded and have `fire` card and a good target exists → Fire
2. If have a munition and breech is empty → Load (prefer higher damage munitions)
3. If have a hazard and opponent is vulnerable → Sabotage
4. If have a remedy and self has a hazard → Repair
5. If have ablative armor or safety → Equip
6. Otherwise → Discard (lowest value card)

Interrupt decisions:
- Play Smoke Launchers if incoming damage > threshold (e.g., > 10, or always)
- Always play Coup Fourré when possible

Medium passive: use it whenever holding 3+ cards that aren't immediately useful.

### 1.8 Event Log (`src/log.js`)

Every state mutation emits a structured event: `{ turn, phase, actor, action, target, result }`. This serves as both a debug tool and the foundation for the future UI's game log.

### 1.9 Simulation Runner (`src/sim.js`)

Run N games with configurable parameters:
- Number of players, tank classes
- Output stats: win rates by class, average game length, cards played, kill distribution
- Detect degenerate states (infinite loops, empty deck+discard)

### 1.10 Entry Point & CLI (`index.js`)

`node index.js` runs a batch of simulations and prints summary stats. Options:
- `--games N` — number of games to simulate
- `--players 2|3|4` — player count
- `--classes heavy,medium,light` — class assignments
- `--verbose` — print turn-by-turn log

---

## Phase 2: Balance Iteration

Once the simulator runs, we'll gather data and iterate:

- Win rate parity across classes in Duel and Deathmatch
- Average game length (too short = too swingy, too long = stalled)
- Card utilization (are some cards dead weight?)
- Adrenaline trigger frequency and impact
- Coup Fourré frequency and game impact

Knobs to tune: card counts, damage values, HP values, adrenaline thresholds, hand sizes.

---

## Phase 3: Web-Based Game

Build a browser UI on top of the same core engine:

- Separate engine (Phase 1 code) from presentation
- Render game state: player hands, tableaus, deck/discard counts, HP bars
- Click-driven action selection with validation
- Animated interrupt windows (smoke, coup fourré)
- Support human vs AI and human vs human (local hot-seat first, networked later)

Tech stack TBD — likely vanilla JS + HTML/CSS to start, upgrade if needed.

---

## File Structure

```
tank-combat/
  rules.md
  plan.md
  index.js
  package.json
  src/
    state.js      — game state creation, player creation
    deck.js       — deck construction, shuffle, draw
    game.js       — game loop, turn phases
    actions.js    — action validation and execution
    interrupts.js — smoke launchers, coup fourré
    damage.js     — damage resolution pipeline
    ai.js         — AI decision-making
    log.js        — event logging
    sim.js        — batch simulation runner
```

## Clarified Rules (deviations from rules.md)

- **Load with full breech**: allowed. Existing munition is discarded first.
- **Heavy Adrenaline (Bunker Buster) damage resolution**: skips ablative armor *damage reduction* (step 4) but HEAT still destroys ablative armor (step 3). Also bypasses Smoke Launchers entirely.
- **Light Ghost (Adrenaline)**: only affects Fire actions, not Quick Fire. If opponent has no cards to discard, they cannot Fire at the Ghost.
- **Coup Fourré discard penalty**: skipped if attacker has no cards in hand.
- **Deck + Discard both empty**: game ends (we'll monitor frequency in simulations).
- **Medium passive**: free action, does not consume the action phase.
