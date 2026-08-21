#!/usr/bin/env node
const platformArg = process.argv[2];

if (platformArg === 'setup') {
  require('./setup.js');
} else if (
  !platformArg ||
  platformArg.startsWith('-') ||
  ['android', 'ios', 'all'].includes(platformArg)
) {
  require('./bundle.js');
} else {
  console.log('Usage:');
  console.log('  npx ota-bundle                   # Build bundles for both Android and iOS');
  console.log('  npx ota-bundle android           # Build bundle for Android');
  console.log('  npx ota-bundle ios               # Build bundle for iOS');
  console.log('  npx ota-bundle setup             # Configure native Android & iOS files');
  console.log('');
  console.log('Optional overrides:');
  console.log('  npx ota-bundle --ota-version <number>');
  console.log('  npx ota-bundle android --android-ota-version <number>');
  console.log('  npx ota-bundle ios --ios-ota-version <number>');
  process.exit(1);
}
