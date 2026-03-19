// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

export type CommandCategory = 'data' | 'analysis' | 'ai' | 'container' | 'session' | 'system' | 'file';

export interface CommandDef {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: CommandCategory;
  requiresApi?: boolean;
  requiresAuth?: boolean;
  requiresDocker?: boolean;
  shortcut?: string;
  args?: ArgSpec[];
}

export interface ArgSpec {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'file';
  description?: string;
}

const commands: CommandDef[] = [
  // ── Data ─────────────────────────────────────────────────
  { name: '/download', description: 'Download CERN Open Data datasets', usage: '/download [query]', category: 'data', requiresApi: true, requiresDocker: true },
  { name: '/datasets', description: 'List all local datasets', usage: '/datasets', category: 'data' },
  { name: '/search', description: 'Search CERN Open Data Portal', usage: '/search <query>', category: 'data', requiresApi: true },
  { name: '/filter', description: 'Filter events by criteria', usage: '/filter <file> --pt>40 --type=muon', category: 'data' },
  { name: '/select', description: 'Select specific event range', usage: '/select <file> --events=0-100', category: 'data' },
  { name: '/stats', description: 'Dataset statistics', usage: '/stats <file>', category: 'data' },
  { name: '/histogram', description: 'ASCII histogram of field values', usage: '/histogram <file> --field=pt', category: 'data' },
  { name: '/scatter', description: 'ASCII scatter plot', usage: '/scatter <file> --x=pt --y=eta', category: 'data' },
  { name: '/correlate', description: 'Correlation matrix of numeric fields', usage: '/correlate <file>', category: 'data' },
  { name: '/export', description: 'Export data to CSV/JSON', usage: '/export <file> --format=csv', category: 'data' },
  { name: '/import', description: 'Import external data files', usage: '/import <path>', category: 'data' },
  { name: '/merge', description: 'Merge two datasets', usage: '/merge <file1> <file2>', category: 'data' },
  { name: '/sample', description: 'Random sample from dataset', usage: '/sample <file> --n=1000', category: 'data' },
  { name: '/describe', description: 'Detailed dataset description', usage: '/describe <file>', category: 'data' },
  { name: '/head', description: 'Show first N events', usage: '/head <file> --n=10', category: 'data' },
  { name: '/tail', description: 'Show last N events', usage: '/tail <file> --n=10', category: 'data' },

  // ── File/System ──────────────────────────────────────────
  { name: '/open', description: 'Inspect a data file', usage: '/open <file>', category: 'file' },
  { name: '/tree', description: 'File tree of datasets directory', usage: '/tree', category: 'file' },
  { name: '/cat', description: 'Display file contents', usage: '/cat <file>', category: 'file' },
  { name: '/grep', description: 'Search within datasets', usage: '/grep <pattern> <file>', category: 'file' },
  { name: '/find', description: 'Find files matching pattern', usage: '/find <pattern>', category: 'file' },
  { name: '/diff', description: 'Compare two files', usage: '/diff <file1> <file2>', category: 'file' },
  { name: '/watch', description: 'Watch file for changes', usage: '/watch <file>', category: 'file' },
  { name: '/clean', description: 'Clean old/temporary files', usage: '/clean', category: 'file' },
  { name: '/cache', description: 'Show/clear local cache', usage: '/cache [clear]', category: 'file' },
  { name: '/disk', description: 'Disk usage by dataset', usage: '/disk', category: 'file' },

  // ── Analysis ─────────────────────────────────────────────
  { name: '/process', description: 'Process ROOT files', usage: '/process <file>', category: 'analysis', requiresApi: true, requiresDocker: true },
  { name: '/quantum', description: 'Quantum event classification', usage: '/quantum classify <file>', category: 'analysis', requiresDocker: true },
  { name: '/plot', description: 'Generate plots via Python', usage: '/plot <file> --type=hist --field=pt', category: 'analysis' },
  { name: '/fit', description: 'Fit distributions', usage: '/fit <file> --field=mass --model=gaussian', category: 'analysis' },
  { name: '/classify', description: 'ML classification', usage: '/classify <file>', category: 'analysis' },
  { name: '/anomaly', description: 'Anomaly detection in events', usage: '/anomaly <file>', category: 'analysis' },
  { name: '/compare', description: 'Compare two datasets', usage: '/compare <file1> <file2>', category: 'analysis' },
  { name: '/viz', description: 'Launch visualization', usage: '/viz <file>', category: 'analysis' },
  { name: '/sim', description: 'Launch OpenGL collision viewer', usage: '/sim <file>', category: 'analysis' },

  // ── AI & Models ──────────────────────────────────────────
  { name: '/ask', description: 'AI analysis with tool execution', usage: '/ask [question]', category: 'ai' },
  { name: '/opask', description: 'Open file + AI analysis', usage: '/opask <file>', category: 'ai' },
  { name: '/models', description: 'List available Claude models', usage: '/models', category: 'ai' },
  { name: '/model', description: 'Switch active model', usage: '/model [id]', category: 'ai' },
  { name: '/usage', description: 'Show token usage stats', usage: '/usage', category: 'ai' },

  // ── Container ────────────────────────────────────────────
  { name: '/status', description: 'System and container health', usage: '/status', category: 'container' },
  { name: '/logs', description: 'View container logs', usage: '/logs [service]', category: 'container', requiresDocker: true },
  { name: '/restart', description: 'Restart a container', usage: '/restart [service]', category: 'container', requiresDocker: true },
  { name: '/stop', description: 'Stop all containers', usage: '/stop', category: 'container', requiresDocker: true },
  { name: '/pull', description: 'Pull latest container images', usage: '/pull', category: 'container', requiresDocker: true },
  { name: '/top', description: 'Container resource usage', usage: '/top', category: 'container', requiresDocker: true },
  { name: '/network', description: 'Network status and ports', usage: '/network', category: 'container', requiresDocker: true },
  { name: '/health', description: 'Quick health check all services', usage: '/health', category: 'container' },

  // ── Session/User ─────────────────────────────────────────
  { name: '/profile', description: 'View/manage user profile', usage: '/profile [set <key> <val>]', category: 'session' },
  { name: '/whoami', description: 'Show current user info', usage: '/whoami', category: 'session' },
  { name: '/sessions', description: 'List past sessions', usage: '/sessions', category: 'session' },
  { name: '/save', description: 'Save current session', usage: '/save <name>', category: 'session' },
  { name: '/load', description: 'Load saved session', usage: '/load <name>', category: 'session' },
  { name: '/recall', description: 'Show recent analysis results', usage: '/recall', category: 'session' },
  { name: '/script', description: 'Execute a script of commands', usage: '/script <file>', category: 'session' },
  { name: '/alias', description: 'Create command aliases', usage: '/alias <name> <command>', category: 'session' },
  { name: '/macro', description: 'Record and replay macros', usage: '/macro record|stop|play', category: 'session' },
  { name: '/set', description: 'Quick config set', usage: '/set <key> <value>', category: 'session' },
  { name: '/get', description: 'Quick config get', usage: '/get <key>', category: 'session' },

  // ── System ───────────────────────────────────────────────
  { name: '/config', description: 'Configure settings', usage: '/config [--show|--reset]', category: 'system' },
  { name: '/keys', description: 'Manage API keys', usage: '/keys [set|remove] [provider]', category: 'system' },
  { name: '/login', description: 'Sign in to OpenCERN', usage: '/login', category: 'system' },
  { name: '/logout', description: 'Sign out', usage: '/logout', category: 'system' },
  { name: '/doctor', description: 'Diagnose system issues', usage: '/doctor', category: 'system' },
  { name: '/update', description: 'Update CLI and Docker images', usage: '/update', category: 'system' },
  { name: '/env', description: 'Show environment info', usage: '/env', category: 'system' },
  { name: '/version', description: 'Detailed version info', usage: '/version', category: 'system' },
  { name: '/about', description: 'About OpenCERN', usage: '/about', category: 'system' },
  { name: '/history', description: 'Show command history', usage: '/history', category: 'system' },
  { name: '/clear', aliases: ['clear'], description: 'Clear the screen', usage: '/clear', category: 'system', shortcut: 'Ctrl+L' },
  { name: '/help', aliases: ['help'], description: 'Show help', usage: '/help', category: 'system' },
  { name: '/exit', aliases: ['exit', 'quit'], description: 'Exit', usage: '/exit', category: 'system', shortcut: 'Ctrl+D' },
];

export const registry = {
  getAll(): CommandDef[] {
    return commands;
  },

  getByCategory(category: CommandCategory): CommandDef[] {
    return commands.filter(c => c.category === category);
  },

  getCategories(): CommandCategory[] {
    return ['data', 'analysis', 'ai', 'container', 'session', 'file', 'system'];
  },

  getCategoryLabel(category: CommandCategory): string {
    const labels: Record<CommandCategory, string> = {
      data: 'Data',
      analysis: 'Analysis',
      ai: 'AI & Models',
      container: 'Containers',
      session: 'Session',
      file: 'Files',
      system: 'System',
    };
    return labels[category];
  },

  find(name: string): CommandDef | undefined {
    const normalized = name.startsWith('/') ? name : `/${name}`;
    return commands.find(
      c => c.name === normalized || c.aliases?.includes(name),
    );
  },

  search(query: string): CommandDef[] {
    const q = query.toLowerCase();
    return commands.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.aliases?.some(a => a.toLowerCase().includes(q)),
    );
  },

  getCompletions(partial: string): CommandDef[] {
    const q = partial.toLowerCase();
    return commands.filter(c => c.name.startsWith(q));
  },

  requiresApi(name: string): boolean {
    return this.find(name)?.requiresApi === true;
  },

  requiresDocker(name: string): boolean {
    return this.find(name)?.requiresDocker === true;
  },
};

export default registry;
