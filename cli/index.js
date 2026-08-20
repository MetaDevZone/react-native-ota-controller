#!/usr/bin/env node
const platformArg = process.argv[2];

if (['android', 'ios', 'all'].includes(platformArg)) {
  require('./bundle.js');
} else {
  console.log('Usage:');
  console.log('  npx ota-bundle android --android-ota-version <number>');
  console.log('  npx ota-bundle ios     --ios-ota-version <number>');
  console.log('  npx ota-bundle all     --android-ota-version <number> --ios-ota-version <number>');
  console.log('');
  console.log('Examples:');
  console.log('  npx ota-bundle android --android-ota-version 5');
  console.log('  npx ota-bundle ios     --ios-ota-version 5');
  console.log('  npx ota-bundle all     --android-ota-version 5 --ios-ota-version 5');
  process.exit(1);
}
