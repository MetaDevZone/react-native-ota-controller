#!/usr/bin/env node
const { runSetup } = require('./setup.js');

try {
  runSetup();
} catch (error) {
  // Silent fallback so postinstall never breaks package installation
}
