#!/usr/bin/env node
const { setupGitignore, getProjectRoot } = require('./setup.js');

try {
  const root = getProjectRoot();
  if (root) setupGitignore(root);
} catch (_) {}

let args = process.argv.slice(2);

// Handle "build" or "bundle" subcommands (e.g. npx ota build android)
if (args[0] === 'build' || args[0] === 'bundle') {
  args = args.slice(1);
  process.argv.splice(2, 1);
}

const commandArg = args[0];

if (commandArg === 'setup') {
  const { runSetup } = require('./setup.js');
  runSetup();
} else if (commandArg === 'unlink' || commandArg === 'remove') {
  const { runUnlink } = require('./setup.js');
  runUnlink();
} else if (
  !commandArg ||
  commandArg.startsWith('-') ||
  ['android', 'ios', 'all'].includes(commandArg)
) {
  require('./bundle.js');
} else {
  console.log('Usage:');
  console.log('  npx ota build                   # Build bundles for both Android & iOS');
  console.log('  npx ota build android           # Build bundle for Android');
  console.log('  npx ota build ios               # Build bundle for iOS');
  console.log('  npx ota setup                   # Auto-configure native files');
  console.log('  npx ota unlink                  # Auto-remove native files');
  console.log('');
  console.log('Optional overrides:');
  console.log('  npx ota build --ota-version <number>');
  console.log('  npx ota build android --ota-version <number>');
  console.log('  npx ota build ios --ota-version <number>');
  process.exit(1);
}
