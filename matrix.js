const { runSimulation } = require("./src/sim");

const CLASSES = ["heavy", "medium", "light"];
const GAMES_PER_MATCHUP = 1000;

// Generate all unique combinations of classes with replacement
function getCombinations(arr, k) {
  if (k === 1) return arr.map((e) => [e]);
  const combos = [];
  for (let i = 0; i < arr.length; i++) {
    const head = arr[i];
    const tailCombos = getCombinations(arr.slice(i), k - 1);
    for (const tail of tailCombos) {
      combos.push([head, ...tail]);
    }
  }
  return combos;
}

function runMatrix(playerCount) {
  console.log(
    `\n==============================================================`,
  );
  console.log(
    ` Running ${playerCount}-Player Matrix (${GAMES_PER_MATCHUP} games per matchup)`,
  );
  console.log(
    `==============================================================\n`,
  );

  const combos = getCombinations(CLASSES, playerCount);
  const mode = playerCount === 2 ? "duel" : "deathmatch";

  const overallStats = {
    heavy: { wins: 0, entries: 0 },
    medium: { wins: 0, entries: 0 },
    light: { wins: 0, entries: 0 },
  };

  for (const combo of combos) {
    const options = {
      games: GAMES_PER_MATCHUP,
      players: combo,
      mode: mode,
      verbose: false,
    };

    const stats = runSimulation(options);

    // Count how many of each class are in this matchup
    const classCounts = {};
    for (const c of combo) {
      classCounts[c] = (classCounts[c] || 0) + 1;
      overallStats[c].entries += GAMES_PER_MATCHUP;
    }

    // Format output for this specific matchup
    const matchupStr = combo.join(" vs ");
    const winRates = [];

    for (const cls of Object.keys(classCounts)) {
      const wins = stats.winsByClass[cls] || 0;
      overallStats[cls].wins += wins;

      // Win rate for the class in this specific matchup
      const rate = (
        (wins / (GAMES_PER_MATCHUP * classCounts[cls])) *
        100
      ).toFixed(1);
      winRates.push(`${cls}: ${rate}%`);
    }

    console.log(`[ ${matchupStr.padEnd(35)} ] => ${winRates.join(" | ")}`);
  }

  const expectedWinRate = (100 / playerCount).toFixed(1);
  console.log(
    `\n--- Overall ${playerCount}-Player Win Rates (Target: ~${expectedWinRate}%) ---`,
  );

  for (const cls of CLASSES) {
    const data = overallStats[cls];
    if (data.entries > 0) {
      const rate = ((data.wins / data.entries) * 100).toFixed(1);
      const diff = (parseFloat(rate) - parseFloat(expectedWinRate)).toFixed(1);
      const diffStr = diff > 0 ? `+${diff}%` : `${diff}%`;

      console.log(
        `${cls.padEnd(10)}: ${rate.padStart(5)}%  (Delta: ${diffStr.padStart(6)})  [${data.wins} wins / ${data.entries} entries]`,
      );
    }
  }
}

function main() {
  console.log("Starting Balance Matrix Test...");
  const startTime = Date.now();

  runMatrix(2);
  runMatrix(3);
  runMatrix(4);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `\n==============================================================`,
  );
  console.log(`Matrix testing completed in ${duration}s.`);
  console.log(`==============================================================`);
}

main();
