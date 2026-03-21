import { describe, it, expect } from 'vitest';

const commands = [
  { name: '/download', description: 'Download CERN Open Data datasets', usage: '/download [query]', category: 'data' },
  { name: '/datasets', description: 'List all local datasets', usage: '/datasets', category: 'data' },
  { name: '/search', description: 'Search CERN Open Data Portal', usage: '/search <query>', category: 'data' },
  { name: '/process', description: 'Process ROOT files', usage: '/process <file>', category: 'analysis' },
  { name: '/quantum', description: 'Quantum event classification', usage: '/quantum classify <file>', category: 'analysis' },
  { name: '/ask', description: 'AI analysis with tool execution', usage: '/ask [question]', category: 'ai' },
  { name: '/opask', description: 'Open file + AI analysis', usage: '/opask <file>', category: 'ai' },
  { name: '/status', description: 'System and container health', usage: '/status', category: 'container' },
  { name: '/config', description: 'Configure settings', usage: '/config [--show|--reset]', category: 'system' },
  { name: '/help', description: 'Show help', usage: '/help', category: 'system', aliases: ['help'] },
  { name: '/exit', description: 'Exit', usage: '/exit', category: 'system', aliases: ['exit', 'quit'], shortcut: 'Ctrl+D' },
];

const categoryLabels: Record<string, string> = {
  data: 'Data',
  analysis: 'Analysis',
  ai: 'AI & Models',
  container: 'Containers',
  session: 'Session',
  file: 'Files',
  system: 'System',
};

function buildHelpText(): string[] {
  const lines: string[] = [
    '',
    '     ___                    ____ _____ ____  _   _',
    '    / _ \\ _ __   ___ _ __  / ___| ____|  _ \\| \\ | |',
    '   | | | | \'_ \\ / _ \\ \'_ \\| |   |  _| | |_) |  \\| |',
    '   | |_| | |_) |  __/ | | | |___| |___|  _ <| |\\  |',
    '    \\___/| .__/ \\___|_| |_|\\____|_____|_| \\_\\_| \\_|',
    '         |_|',
    '',
    '  AI-powered particle physics analysis',
    '  ────────────────────────────────────────────────────',
  ];

  const categories = ['data', 'analysis', 'ai', 'container', 'session', 'file', 'system'];

  for (const category of categories) {
    const cmds = commands.filter(c => c.category === category);
    if (cmds.length === 0) continue;
    lines.push('');
    lines.push(`  ${categoryLabels[category]}`);
    for (const cmd of cmds) {
      const usage = cmd.usage || cmd.name;
      lines.push(`    ${usage.padEnd(32)} ${cmd.description}`);
    }
  }

  return lines;
}

describe('CLI Help Output Snapshot', () => {
  it('matches expected help output structure', () => {
    const help = buildHelpText();
    expect(help.join('\n')).toMatchSnapshot();
  });

  it('contains the OpenCERN ASCII banner', () => {
    const help = buildHelpText();
    const banner = help.join('\n');
    expect(banner).toContain('CERN');
    expect(banner).toContain('___');
  });

  it('contains all expected categories', () => {
    const help = buildHelpText().join('\n');
    expect(help).toContain('Data');
    expect(help).toContain('Analysis');
    expect(help).toContain('AI & Models');
    expect(help).toContain('System');
  });

  it('lists core commands', () => {
    const help = buildHelpText().join('\n');
    expect(help).toContain('/download');
    expect(help).toContain('/process');
    expect(help).toContain('/quantum');
    expect(help).toContain('/ask');
    expect(help).toContain('/status');
    expect(help).toContain('/help');
  });
});
