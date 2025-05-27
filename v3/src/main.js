const TerminalInterface = require('./terminal-interface');

async function main() {
  const terminal = new TerminalInterface();
  
  try {
    await terminal.run();
  } catch (error) {
    console.error('❌ Application error:', error.message);
    process.exit(1);
  } finally {
    terminal.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

main();