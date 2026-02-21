const { runSimulation } = require('./src/sim');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    games: 1000,
    players: ['heavy', 'medium'],
    mode: 'duel',
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--games') {
      options.games = parseInt(args[++i], 10);
    } else if (arg === '--players') {
      const count = parseInt(args[++i], 10);
      if (count === 2) options.mode = 'duel';
      else options.mode = 'deathmatch';

      // Adjust players array if --classes isn't provided yet
      if (options.players.length !== count) {
        const defaultClasses = ['heavy', 'medium', 'light', 'heavy'];
        options.players = defaultClasses.slice(0, count);
      }
    } else if (arg === '--classes') {
      options.players = args[++i].split(',');
      if (options.players.length === 2) options.mode = 'duel';
      else options.mode = 'deathmatch';
    } else if (arg === '--verbose') {
      options.verbose = true;
    }
  }

  return options;
}

function main() {
  const options = parseArgs();
  console.log(`Running ${options.games} games in ${options.mode} mode with classes: ${options.players.join(', ')}...`);

  const startTime = Date.now();
  const stats = runSimulation(options);
  const duration = Date.now() - startTime;

  console.log('\n--- Simulation Results ---');
  console.log(`Games Played: ${stats.gamesPlayed}`);
  console.log(`Degenerate Games (Max Turns / Empty Deck): ${stats.degenerateGames}`);
  console.log(`Draws: ${stats.draws}`);
  console.log(`Time: ${duration}ms`);
  console.log(`Avg Turns/Game: ${stats.averageTurns.toFixed(2)}`);
  console.log(`Avg Cards Played/Game: ${stats.averageCardsPlayed.toFixed(2)}`);

  console.log('\n--- Win Rates by Class ---');
  for (const [cls, wins] of Object.entries(stats.winsByClass)) {
    const rate = ((wins / stats.gamesPlayed) * 100).toFixed(2);
    console.log(`${cls.padEnd(10)}: ${wins} wins (${rate}%)`);
  }

  console.log('\n--- Win Rates by Position ---');
  for (const [pos, wins] of Object.entries(stats.winsByPosition)) {
    const rate = ((wins / stats.gamesPlayed) * 100).toFixed(2);
    console.log(`Player ${pos}: ${wins} wins (${rate}%)`);
  }

  console.log('\n--- Total Kills by Class ---');
  for (const [cls, kills] of Object.entries(stats.killsByClass)) {
    console.log(`${cls.padEnd(10)}: ${kills} kills`);
  }
}

main();
