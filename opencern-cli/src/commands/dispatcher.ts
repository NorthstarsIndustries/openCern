// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { parseCommand, resolveFilePath } from './arg-parser.js';
import { config } from '../utils/config.js';
import { join } from 'path';

// ─── Types ──────────────────────────────────────────────────────
export type RouteType = 'home' | 'session' | 'docker' | 'quantum' | 'datasets' | 'logs' | 'setup';

export interface DispatchResult {
  output: string;
  navigateTo?: RouteType;
}

type Handler = (args: string[], flags: Record<string, string | boolean>) => Promise<DispatchResult>;

// ─── Helpers ────────────────────────────────────────────────────

function resolvePath(arg?: string): string {
  if (!arg) return '';
  const resolved = resolveFilePath(arg);
  if (resolved.startsWith('/')) return resolved;
  return join(config.get('dataDir'), 'data', resolved);
}

function text(lines: string | string[]): DispatchResult {
  return { output: Array.isArray(lines) ? lines.join('\n') : lines };
}

function nav(route: RouteType, lines?: string | string[]): DispatchResult {
  return { output: Array.isArray(lines) ? lines.join('\n') : lines || '', navigateTo: route };
}

// ─── Handlers ───────────────────────────────────────────────────

const handlers: Record<string, Handler> = {
  // ── Auth & Config ─────────────────────────────────────────
  '/login': async () => {
    return nav('session', 'Starting login flow... Use the dialog to complete authentication.');
  },
  '/logout': async () => {
    const { logout } = await import('./auth.js');
    await logout();
    return text('Logged out successfully.');
  },
  '/whoami': async () => {
    const { whoami } = await import('./session.js');
    return text(whoami());
  },
  '/config': async (args, flags) => {
    const { showConfig, resetConfig } = await import('./config.js');
    if (flags.reset) { resetConfig(); return text('Config reset to defaults.'); }
    return text(showConfig());
  },
  '/keys': async (args) => {
    const { getKeyStatus, setApiKey, removeApiKey } = await import('./config.js');
    if (args[0] === 'set' && args[1] && args[2]) {
      const r = setApiKey(args[1], args[2]);
      return text(r.message);
    }
    if (args[0] === 'remove' && args[1]) {
      const r = removeApiKey(args[1]);
      return text(r.message);
    }
    return text(getKeyStatus());
  },
  '/profile': async (args) => {
    const { formatProfile, setProfileField } = await import('./profile.js');
    if (args[0] === 'set' && args[1] && args[2]) {
      const r = setProfileField(args[1], args.slice(2).join(' '));
      return text(r.message);
    }
    return text(formatProfile());
  },
  '/set': async (args) => {
    const { quickSet } = await import('./session.js');
    if (args[0] && args[1]) return text(quickSet(args[0], args.slice(1).join(' ')));
    return text('Usage: /set <key> <value>');
  },
  '/get': async (args) => {
    const { quickGet } = await import('./session.js');
    if (args[0]) return text(quickGet(args[0]));
    return text('Usage: /get <key>');
  },
  '/sessions': async () => {
    const { listSessions } = await import('./session.js');
    return text(listSessions());
  },
  '/save': async (args) => {
    const { saveSession } = await import('./session.js');
    return text(saveSession(args[0] || 'default', []));
  },
  '/load': async (args) => {
    const { loadSession } = await import('./session.js');
    const loaded = loadSession(args[0] || 'default');
    if (!loaded) return text('Session not found.');
    return text(loaded.lines);
  },
  '/recall': async () => {
    const { getRecall } = await import('./session.js');
    return text(getRecall());
  },
  '/alias': async (args) => {
    const { setAlias, listAliases } = await import('./session.js');
    if (args[0] && args[1]) return text(setAlias(args[0], args.slice(1).join(' ')));
    return text(listAliases());
  },
  '/script': async (args) => {
    const { loadScript } = await import('./session.js');
    if (!args[0]) return text('Usage: /script <file>');
    const lines = loadScript(args[0]);
    return text(lines || ['Script not found.']);
  },
  '/macro': async (args) => {
    return text(`Macro ${args[0] || 'help'}: feature coming soon.`);
  },

  // ── Data Operations ───────────────────────────────────────
  '/datasets': async () => {
    const { listLocalDatasets, formatDatasetList } = await import('./datasets.js');
    return nav('datasets', formatDatasetList(listLocalDatasets()));
  },
  '/download': async (args) => {
    const { searchDatasets } = await import('./download.js');
    if (args.length > 0) {
      const datasets = await searchDatasets(args.join(' '));
      if (datasets.length === 0) return text('No datasets found for that query.');
      const lines = ['', '  Search Results', '  ────────────────────────────────────────'];
      for (const ds of datasets.slice(0, 20)) {
        lines.push(`  ${ds.title} (${ds.experiment}, ${ds.year}, ${ds.energy})`);
      }
      lines.push('', `  ${datasets.length} result(s). Use the download view to select files.`);
      return text(lines);
    }
    return text('Usage: /download <query> — e.g., /download higgs diphoton');
  },
  '/search': async (args) => {
    const { searchDatasets } = await import('./download.js');
    const datasets = await searchDatasets(args.join(' '));
    if (datasets.length === 0) return text('No datasets found.');
    const lines = ['', '  Search Results', '  ────────────────────────────────────────'];
    for (const ds of datasets.slice(0, 20)) {
      lines.push(`  ${ds.title} (${ds.experiment}, ${ds.year})`);
    }
    lines.push(`  ${datasets.length} result(s)`);
    return text(lines);
  },
  '/stats': async (args) => {
    const { getDatasetStats } = await import('./datasets.js');
    return text(getDatasetStats(resolvePath(args[0])));
  },
  '/histogram': async (args, flags) => {
    const { renderHistogram } = await import('./datasets.js');
    const field = (flags.field as string) || args[1] || 'pt';
    return text(renderHistogram(resolvePath(args[0]), field));
  },
  '/scatter': async (args, flags) => {
    const { renderScatterPlot } = await import('./datasets.js');
    const x = (flags.x as string) || args[1] || 'pt';
    const y = (flags.y as string) || args[2] || 'eta';
    return text(renderScatterPlot(resolvePath(args[0]), x, y));
  },
  '/correlate': async (args) => {
    const { correlateFields } = await import('./datasets.js');
    return text(correlateFields(resolvePath(args[0])));
  },
  '/filter': async (args, flags) => {
    const { filterEvents } = await import('./datasets.js');
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (typeof v === 'string') filters[k] = v;
    }
    return text(filterEvents(resolvePath(args[0]), filters));
  },
  '/head': async (args, flags) => {
    const { headEvents } = await import('./datasets.js');
    const n = parseInt(flags.n as string) || 10;
    return text(headEvents(resolvePath(args[0]), n));
  },
  '/tail': async (args, flags) => {
    const { tailEvents } = await import('./datasets.js');
    const n = parseInt(flags.n as string) || 10;
    return text(tailEvents(resolvePath(args[0]), n));
  },
  '/sample': async (args, flags) => {
    const { sampleEvents } = await import('./datasets.js');
    const n = parseInt(flags.n as string) || 1000;
    return text(sampleEvents(resolvePath(args[0]), n));
  },
  '/merge': async (args) => {
    const { mergeDatasets } = await import('./datasets.js');
    if (args.length < 2) return text('Usage: /merge <file1> <file2>');
    return text(mergeDatasets(resolvePath(args[0]), resolvePath(args[1])));
  },
  '/export': async (args, flags) => {
    const { exportDataset } = await import('./datasets.js');
    const fmt = (flags.format as string) || 'csv';
    return text(exportDataset(resolvePath(args[0]), fmt));
  },
  '/import': async (args) => {
    return text(`Import: ${args[0] || '(no file specified)'} — feature coming soon.`);
  },
  '/select': async (args, flags) => {
    return text(`Select events ${flags.events || 'all'} from ${args[0] || '(no file)'}`);
  },
  '/describe': async (args) => {
    const { describeDataset } = await import('./datasets.js');
    return text(describeDataset(resolvePath(args[0])));
  },

  // ── File Operations ───────────────────────────────────────
  '/open': async (args) => {
    const { openFile } = await import('./open.js');
    if (!args[0]) return text('Usage: /open <file>');
    const f = await openFile(resolvePath(args[0]));
    const lines = [
      '', `  File: ${f.filename}`,
      `  Type: ${f.fileType}`,
      `  Size: ${f.size} bytes`,
      '  ────────────────────────────────────────',
      f.content.slice(0, 2000),
      f.content.length > 2000 ? `  ... (${f.content.length} chars total)` : '',
    ];
    return text(lines);
  },
  '/tree': async () => {
    const { renderTree } = await import('./files.js');
    return text(renderTree());
  },
  '/cat': async (args, flags) => {
    const { catFile } = await import('./files.js');
    const maxLines = parseInt(flags.n as string) || undefined;
    return text(catFile(resolvePath(args[0]), maxLines));
  },
  '/grep': async (args) => {
    const { grepFile } = await import('./files.js');
    if (args.length < 2) return text('Usage: /grep <pattern> <file>');
    return text(grepFile(args[0], resolvePath(args[1])));
  },
  '/find': async (args) => {
    const { findFiles } = await import('./files.js');
    return text(findFiles(args[0] || '*'));
  },
  '/diff': async (args) => {
    const { diffFiles } = await import('./files.js');
    if (args.length < 2) return text('Usage: /diff <file1> <file2>');
    return text(diffFiles(resolvePath(args[0]), resolvePath(args[1])));
  },
  '/watch': async (args) => {
    return text(`Watching ${args[0] || '(no file)'} for changes... (Ctrl+C to stop)`);
  },
  '/clean': async (_args, flags) => {
    const { cleanFiles } = await import('./files.js');
    return text(cleanFiles(!!flags['dry-run']));
  },
  '/cache': async (args) => {
    const { cacheInfo } = await import('./files.js');
    return text(cacheInfo(args[0] === 'clear'));
  },
  '/disk': async () => {
    const { diskUsage } = await import('./files.js');
    return text(diskUsage());
  },

  // ── Analysis ──────────────────────────────────────────────
  '/process': async (args) => {
    const { processFile } = await import('./process.js');
    if (!args[0]) return text('Usage: /process <file>');
    const id = await processFile(resolvePath(args[0]));
    return nav('session', `Processing started (id: ${id}). Check /status for progress.`);
  },
  '/quantum': async (args) => {
    return nav('quantum', 'Navigating to quantum analysis...');
  },
  '/viz': async (args) => {
    const { openViz } = await import('./viz.js');
    if (!args[0]) return text('Usage: /viz <file>');
    const result = openViz(resolvePath(args[0]));
    return text(result.message);
  },
  '/sim': async (args) => {
    const { launchSim, getSimStatus } = await import('./sim.js');
    if (!args[0]) return text(getSimStatus());
    const result = launchSim(resolvePath(args[0]));
    return text(result.message);
  },
  '/plot': async (args, flags) => {
    return text(`Plotting ${args[0] || '(no file)'} type=${flags.type || 'hist'} field=${flags.field || 'pt'}`);
  },
  '/fit': async (args, flags) => {
    // Delegate to fitting module
    try {
      const { fitDistribution } = await import('./fitting.js');
      const model = (flags.model as string) || args[1] || 'gaussian';
      const field = (flags.field as string) || 'mass';
      return text(fitDistribution(resolvePath(args[0]), field, model));
    } catch {
      return text('Fitting module not available.');
    }
  },
  '/classify': async (args) => {
    return text(`ML classification on ${args[0] || '(no file)'} — delegates to Python sklearn.`);
  },
  '/anomaly': async (args) => {
    return text(`Anomaly detection on ${args[0] || '(no file)'} — delegates to Python sklearn.`);
  },
  '/compare': async (args) => {
    if (args.length < 2) return text('Usage: /compare <file1> <file2>');
    return text(`Comparing ${args[0]} vs ${args[1]}...`);
  },

  // ── AI & Models ───────────────────────────────────────────
  '/ask': async (args) => {
    // Delegate to AI — will be handled by runAgenticQuery in app.tsx
    return { output: '', navigateTo: 'session' as RouteType };
  },
  '/opask': async (args) => {
    return { output: '', navigateTo: 'session' as RouteType };
  },
  '/model': async (args) => {
    if (!args[0]) {
      return text(`Current model: ${config.get('defaultModel')}`);
    }
    const shortcuts: Record<string, string> = {
      sonnet: 'claude-sonnet-4-6',
      opus: 'claude-opus-4-6',
      haiku: 'claude-haiku-4-5-20251001',
    };
    const modelId = shortcuts[args[0].toLowerCase()] || args[0];
    config.set('defaultModel', modelId);
    return text(`Model switched to: ${modelId}`);
  },
  '/models': async () => {
    const { anthropicService } = await import('../services/anthropic.js');
    try {
      const models = await anthropicService.listModels();
      const lines = ['', '  Available Models', '  ────────────────────────────────────────'];
      for (const m of models) {
        const active = m.id === config.get('defaultModel') ? ' (active)' : '';
        lines.push(`  ${m.displayName.padEnd(30)} ${m.id}${active}`);
      }
      lines.push('', '  Switch with: /model <name|id>');
      return text(lines);
    } catch {
      return text('Could not list models. Check your API key with /keys.');
    }
  },
  '/usage': async () => {
    const { anthropicService } = await import('../services/anthropic.js');
    return text(anthropicService.getUsageFormatted());
  },

  // ── Container ─────────────────────────────────────────────
  '/docker': async () => nav('docker'),
  '/status': async () => {
    const { getSystemStatus, formatStatus } = await import('./status.js');
    const status = await getSystemStatus();
    return text(formatStatus(status));
  },
  '/logs': async (args, flags) => {
    const { getLogs } = await import('./containers.js');
    const tail = parseInt(flags.tail as string) || undefined;
    return text(getLogs(args[0], tail));
  },
  '/restart': async (args) => {
    const { restartService } = await import('./containers.js');
    return text(await restartService(args[0]));
  },
  '/stop': async () => {
    const { stopAll } = await import('./containers.js');
    return text(await stopAll());
  },
  '/pull': async () => {
    const { pullImages } = await import('./containers.js');
    const lines: string[] = ['Pulling images...'];
    await pullImages((img: string) => lines.push(`  Pulled: ${img}`));
    return text(lines);
  },
  '/top': async () => {
    const { containerTop } = await import('./containers.js');
    return text(containerTop());
  },
  '/network': async () => {
    const { networkInfo } = await import('./containers.js');
    return text(networkInfo());
  },
  '/health': async () => {
    const { quickHealth } = await import('./containers.js');
    return text(await quickHealth());
  },

  // ── System ────────────────────────────────────────────────
  '/doctor': async () => {
    const { runDoctorChecks, formatDoctorResults } = await import('./doctor.js');
    const checks = await runDoctorChecks();
    return text(formatDoctorResults(checks));
  },
  '/update': async () => {
    const { checkForUpdates } = await import('./update.js');
    const info = await checkForUpdates();
    const lines = [
      '', '  Update Status',
      '  ────────────────────────────────────────',
      `  Current: ${info.currentVersion}`,
      `  Latest:  ${info.latestVersion}`,
      `  Update:  ${info.hasUpdate ? 'Available!' : 'Up to date'}`,
    ];
    return text(lines);
  },
  '/env': async () => {
    const { envInfo } = await import('./system.js');
    return text(envInfo());
  },
  '/version': async () => {
    const { versionInfo } = await import('./system.js');
    return text(await versionInfo());
  },
  '/about': async () => {
    const { aboutInfo } = await import('./system.js');
    return text(aboutInfo());
  },
  '/history': async () => {
    const { history } = await import('../utils/history.js');
    const entries = history.getAll();
    if (entries.length === 0) return text('No command history.');
    const lines = ['', '  Command History', '  ────────────────────────────────────────'];
    for (const e of entries.slice(-30)) {
      lines.push(`  ${e.command}`);
    }
    return text(lines);
  },
  '/clear': async () => {
    return { output: '__CLEAR__', navigateTo: 'session' as RouteType };
  },

  // ── Setup ─────────────────────────────────────────────────
  '/setup': async () => nav('setup', 'Starting setup wizard...'),
  '/firststart': async () => nav('setup', 'Starting first-time setup...'),

  // ── Physics (will be populated by physics.ts) ─────────────
  // These are registered dynamically via registerPhysicsHandlers()
};

// ─── Registration ───────────────────────────────────────────────

export function registerHandler(command: string, handler: Handler): void {
  handlers[command] = handler;
}

export function registerHandlers(entries: Record<string, Handler>): void {
  for (const [cmd, handler] of Object.entries(entries)) {
    handlers[cmd] = handler;
  }
}

// ─── Dispatch ───────────────────────────────────────────────────

export async function dispatch(
  input: string,
): Promise<DispatchResult> {
  const { command, args, flags } = parseCommand(input);

  // Check for alias resolution
  try {
    const { resolveAlias } = await import('./session.js');
    const resolved = resolveAlias(input);
    if (resolved !== input) {
      const parsed = parseCommand(resolved);
      const handler = handlers[parsed.command];
      if (handler) return handler(parsed.args, parsed.flags);
    }
  } catch { /* no alias module */ }

  const handler = handlers[command];
  if (handler) {
    try {
      return await handler(args, flags);
    } catch (err) {
      return { output: `Error running ${command}: ${(err as Error).message}` };
    }
  }

  return { output: `Unknown command: ${command}. Type /help for available commands.` };
}

// Special commands that need TUI-level handling (dialogs, navigation, AI queries)
export const TUI_HANDLED_COMMANDS = new Set([
  '/help', '/exit', '/quit', '/theme', '/themes', '/ask', '/opask',
]);

export function isTuiHandled(command: string): boolean {
  return TUI_HANDLED_COMMANDS.has(command);
}

// ─── Register physics handlers ──────────────────────────────────
import { registerPhysicsHandlers } from './physics.js';
registerPhysicsHandlers(
  (cmd, handler) => { handlers[cmd] = handler; },
  resolvePath,
);
