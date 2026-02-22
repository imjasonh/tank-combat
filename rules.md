The following specification details the entities, the exact game loop, the event stack (for interrupts), and edge cases.

### 1. Game State & Entities

**The Global State:**

* **Deck:** A shared array of 100 cards. Draws from the top. When empty, immediately shuffle the Discard pile to form a new Deck.
* **Discard Pile:** A shared array of face-up cards.
* **Turn Index:** Tracks the current active player.
* **Game Mode:**
  * **Duel:** 2 players. Win condition: Opponent reaches 0 HP.
  * **Deathmatch:** 3+ players. Win condition: First player to reach 3 Kill Marks.

**The Player Entity (Tank State):**

* **Class:** `Heavy`, `Medium`, or `Light`.
* **MaxHP:** 100 (all classes).
* **CurrentHP:** Integer.
* **Kill Marks:** Integer (starts at 0).
* **Hand:** Up to the hand size limit (Heavy: 5, Medium: 6, Light: 10).
* **Tableau (Board State):**
  * `Breech`: Holds 0 or 1 Munition card (HE, HEAT, or Sabot).
  * `Hazards`: Array of active Impediment cards.
  * `Safeties`: Array of active Permanent Safety cards.
  * `AblativeArmor`: Integer count of active Ablative Armor cards.
* **Status Flags:**
  * `IsAdrenaline`: Boolean (True if CurrentHP <= 25).
  * `HasSpawnShield`: Boolean (Grants immunity until the player's next turn starts).

### 2. Tank Classes & Modifiers

All classes have 100 HP and an Adrenaline threshold of 25 HP.

| Class | Hand Size | Passive Trait | Adrenaline Trait (Replaces Passive) |
| --- | --- | --- | --- |
| **Heavy** | 5 | Reduce all incoming damage by 5. | **Bunker Buster:** Attacks ignore Ablative Armor and Smoke Launchers. |
| **Medium** | 6 | Once per turn, may discard 1 card to draw 1 card (free action). | **Autoloader:** May perform both a "Load" and a "Fire" action in the same turn. |
| **Light** | 10 | Larger hand provides more options each turn. | **Ghost:** Opponents must discard 1 card from their hand before declaring an attack on you. |

### 3. Card Definitions (The 100-Card Deck)

**Offense (45 Cards):**

* **Fire!** (15x): Required to execute a "Fire" action from the Breech.
* **Coaxial MG** (10x): Deals 10 DMG. Played directly from the hand (bypasses Breech).
* **HE Munition** (12x): Deals 25 DMG. Must be Loaded into the Breech.
* **HEAT Munition** (6x): Deals 50 DMG. Must be Loaded. Destroys 1 Ablative Armor on target without damage reduction.
* **Sabot Munition** (2x): Deals 75 DMG. Must be Loaded.

**Hazards (18 Cards) & Remedies (18 Cards):**

* **Tracked** (6x): Target cannot play `Fire!` or `Coaxial MG`. / **Field Repair** (6x): Removes `Tracked`.
* **Jammed Breech** (6x): Target cannot perform a `Load` action. / **Clear Breech** (6x): Removes `Jammed Breech`.
* **Comms Jammed** (6x): Target cannot play `Smoke Launchers` to protect opponents. / **Re-establish Comms** (6x): Removes `Comms Jammed`.

**Defenses (19 Cards):**

* **Smoke Launchers** (10x): Played out-of-turn to completely negate an incoming attack.
* **Ablative Armor** (6x): Played onto Tableau. When attacked, reduces incoming damage by 10, then discards itself.
* **Reinforced Treads** (1x): Permanent Safety. Prevents `Tracked`.
* **Advanced Targeting** (1x): Permanent Safety. Prevents `Jammed Breech`.
* **Encrypted Comms** (1x): Permanent Safety. Prevents `Comms Jammed`.

### 4. The Event Loop (Turn Phases)

**1. Start of Turn Phase:**

* If `HasSpawnShield` is True, set it to False.
* Player draws cards from the Deck until their hand reaches its size limit (Heavy: 5, Medium: 6, Light: 10).

**2. Action Phase (Strictly 1 Action per turn):**
The player selects exactly one action to place on the resolution stack:

* **Load:** Move a Munition from Hand to `Breech`. (Fails if `Jammed Breech` is active or Breech is full).
* **Fire:** Discard a `Fire!` card from Hand. Select a target. Resolve loaded Munition against target. Discard Munition. (Fails if `Tracked` is active or Breech is empty).
* **Quick Fire:** Discard `Coaxial MG` from Hand. Select target. Resolve 10 DMG. (Fails if `Tracked` is active).
* **Sabotage:** Target an opponent. Move Hazard from Hand to their `Hazards` array. (Fails if target has matching Permanent Safety).
* **Repair:** Discard Remedy from Hand. Remove matching Hazard from self or ally.
* **Equip:** Move `Ablative Armor` or Permanent Safety from Hand to `Safeties` array.
* **Discard:** Discard 1 card from Hand. (Mandatory if no other actions are taken/possible).

**3. End of Turn Phase:**

* Hand size check: If Hand > limit, discard down to limit.
* Pass turn index to the next alive player.

### 5. Resolution Stack & Interrupts

When an action is declared, it enters the stack. Opponents have a window to play out-of-turn interrupt cards before the action resolves.

**Interrupt: Smoke Launchers**

* **Trigger:** A `Fire` or `Quick Fire` action is declared targeting a player.
* **Effect:** Any player (unless afflicted by `Comms Jammed` targeting someone else) may discard `Smoke Launchers` from their Hand. The attack is negated. Both the attacker's `Fire!` card and the Munition (or the `Coaxial MG`) go to the Discard Pile. Damage = 0.

**Interrupt: Tactical Override (The Coup Fourre)**

* **Trigger:** An opponent targets Player B with a Hazard. Player B has the exact matching Permanent Safety in their Hand.
* **Effect:**
  1. Player B reveals the Permanent Safety.
  2. The opponent's Hazard is discarded (negated).
  3. Player B instantly equips the Permanent Safety to their Tableau.
  4. The attacker must discard 1 card at random.
  5. Player B draws 1 card.
  6. **Turn Order Shift:** Player B immediately takes a full bonus turn. After this bonus turn, the global Turn Index resumes starting with the player to Player B's left.

### 6. Damage Calculation & State Checks

When an attack successfully bypasses Smoke Launchers, calculate damage in this strict order:

1. **Base Damage:** Determine base from the Munition (10, 25, 50, or 75).
2. **Attacker Modifiers:** If Attacker is Heavy in Adrenaline mode, ignore steps 3 and 4 entirely.
3. **HEAT Check:** If Munition is HEAT, instantly destroy 1 `Ablative Armor` on target. Skip step 4.
4. **Ablative Armor Check:** If target has `Ablative Armor` equipped, reduce damage by 10. Discard 1 `Ablative Armor`.
5. **Heavy Passive:** If Target is Heavy (not in Adrenaline), subtract 5 from the incoming damage.
6. **Floor:** Damage cannot go below 0.
7. **Apply Damage:** Target `CurrentHP` -= Final Damage.

**Post-Damage State Check:**

* **Adrenaline Check:** If `CurrentHP` <= 25 and not already in Adrenaline, set `IsAdrenaline = True`. Immediately clear all cards in the `Hazards` array.
* **Death Check:** If `CurrentHP` <= 0:
  1. Attacker's `KillMarks` += 1.
  2. If `KillMarks` == 3, Attacker wins. Game ends.
  3. **Respawn:** Target discards their Hand and entirely clears their Tableau (Breech, Hazards, Safeties, Ablative Armor).
  4. Target `CurrentHP` resets to 100. Target draws a fresh hand up to their hand size limit. Target sets `HasSpawnShield = True`.
