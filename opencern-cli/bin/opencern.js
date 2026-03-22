#!/usr/bin/env bun
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import pkg from '../package.json' with { type: 'json' };

// Parse initial flags
const args = process.argv.slice(2);
const showVersion = args.includes('--version') || args.includes('-v');
const showHelp = args.includes('--help') || args.includes('-h');
const debugMode = args.includes('--debug');

if (showVersion) {
  console.log(`opencern v${pkg.version}`);
  process.exit(0);
}

if (showHelp) {
  console.log(`
opencern — AI-powered particle physics analysis

Usage:
  opencern [flags]

Flags:
  --version, -v    Show version number
  --help, -h       Show this help message
  --debug          Enable verbose debug output

Interactive Commands (type inside the TUI):
  /download        Download CERN Open Data datasets
  /process         Process ROOT files with C++ engine
  /ask             Ask AI about your data
  /quantum         Run quantum computing classification
  /docker          View Docker service status
  /datasets        Browse local datasets
  /themes          Switch TUI theme (40+ themes)
  /status          Show system status
  /config          Configure API keys and settings
  /help            Show in-app help
  /exit            Exit the CLI
`);
  process.exit(0);
}

if (debugMode) {
  process.env.OPENCERN_DEBUG = '1';
}

// Launch the TUI app
try {
  const { startApp } = await import('../dist/app.js');
  await startApp();
} catch (err) {
  if (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'MODULE_NOT_FOUND') {
    console.error('\x1b[31mError: CLI not built. Run: bun run build\x1b[0m');
    process.exit(1);
  }
  console.error('\x1b[31mFatal error:\x1b[0m', err.message);
  if (debugMode) console.error(err.stack);
  process.exit(1);
}
