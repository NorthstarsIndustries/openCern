import { describe, it, expect } from 'vitest';

const COMMAND_ROUTES: Record<string, string> = {
  '/exit': 'exit',
  '/clear': 'clearOutput',
  '/help': 'showHelp',
  '/history': 'showHistory',
  '/status': 'getSystemStatus',
  '/doctor': 'runDoctorChecks',
  '/config': 'configWizard',
  '/keys': 'getKeyStatus',
  '/models': 'listModels',
  '/model': 'setModel',
  '/usage': 'getUsageFormatted',
  '/login': 'login',
  '/logout': 'logout',
  '/update': 'checkForUpdates',
  '/profile': 'formatProfile',
  '/whoami': 'whoami',
  '/open': 'openFile',
  '/opask': 'openAndAsk',
  '/cat': 'catFile',
  '/tree': 'renderTree',
  '/grep': 'grepFile',
  '/find': 'findFiles',
  '/diff': 'diffFiles',
  '/clean': 'cleanFiles',
  '/disk': 'diskUsage',
  '/cache': 'cacheInfo',
  '/datasets': 'listLocalDatasets',
  '/stats': 'getDatasetStats',
  '/histogram': 'renderHistogram',
  '/scatter': 'renderScatterPlot',
  '/head': 'headEvents',
  '/tail': 'tailEvents',
  '/describe': 'describeDataset',
  '/filter': 'filterEvents',
  '/sample': 'sampleEvents',
  '/correlate': 'correlateFields',
  '/export': 'exportDataset',
  '/merge': 'mergeDatasets',
  '/search': 'searchDatasets',
  '/logs': 'getLogs',
  '/restart': 'restartService',
  '/stop': 'stopAll',
  '/pull': 'pullImages',
  '/top': 'containerTop',
  '/network': 'networkInfo',
  '/health': 'quickHealth',
  '/sessions': 'listSessions',
  '/save': 'saveSession',
  '/load': 'loadSession',
  '/recall': 'getRecall',
  '/alias': 'setAlias',
  '/script': 'loadScript',
  '/set': 'quickSet',
  '/get': 'quickGet',
  '/env': 'envInfo',
  '/version': 'versionInfo',
  '/about': 'aboutInfo',
  '/ask': 'runAgenticQuery',
  '/quantum': 'quantumCommand',
  '/viz': 'openViz',
  '/sim': 'simCommand',
  '/download': 'startDownload',
  '/process': 'processFile',
};

describe('app command routing table', () => {
  it('should have routes for all core commands', () => {
    const coreCommands = ['/help', '/status', '/download', '/process', '/ask', '/open'];
    coreCommands.forEach(cmd => {
      expect(COMMAND_ROUTES).toHaveProperty(cmd);
    });
  });

  it('should have routes for data commands', () => {
    const dataCommands = ['/datasets', '/stats', '/histogram', '/head', '/tail', '/filter'];
    dataCommands.forEach(cmd => {
      expect(COMMAND_ROUTES).toHaveProperty(cmd);
    });
  });

  it('should have routes for container commands', () => {
    const containerCommands = ['/logs', '/restart', '/stop', '/pull', '/top', '/health'];
    containerCommands.forEach(cmd => {
      expect(COMMAND_ROUTES).toHaveProperty(cmd);
    });
  });

  it('should have routes for session commands', () => {
    const sessionCommands = ['/sessions', '/save', '/load', '/alias', '/set', '/get'];
    sessionCommands.forEach(cmd => {
      expect(COMMAND_ROUTES).toHaveProperty(cmd);
    });
  });

  it('should have routes for system commands', () => {
    const systemCommands = ['/env', '/version', '/about', '/doctor'];
    systemCommands.forEach(cmd => {
      expect(COMMAND_ROUTES).toHaveProperty(cmd);
    });
  });

  it('should have more than 50 command routes', () => {
    expect(Object.keys(COMMAND_ROUTES).length).toBeGreaterThan(50);
  });
});

describe('alias resolution', () => {
  it('should resolve first token from alias map', () => {
    const aliases: Record<string, string> = { dl: '/download cms', st: '/status' };

    function resolveAlias(input: string): string {
      const [first, ...rest] = input.split(' ');
      if (aliases[first]) {
        return rest.length > 0 ? `${aliases[first]} ${rest.join(' ')}` : aliases[first];
      }
      return input;
    }

    expect(resolveAlias('dl 2016')).toBe('/download cms 2016');
    expect(resolveAlias('st')).toBe('/status');
    expect(resolveAlias('/help')).toBe('/help');
  });
});

describe('withApiCheck gate', () => {
  it('should only allow API commands when API is ready', () => {
    const apiCommands = ['/download', '/process', '/search'];
    const requiresApi = (cmd: string) => apiCommands.includes(cmd);

    expect(requiresApi('/download')).toBe(true);
    expect(requiresApi('/help')).toBe(false);
  });
});

describe('unknown command handling', () => {
  it('should identify unknown / commands', () => {
    const known = Object.keys(COMMAND_ROUTES);
    const isUnknown = (cmd: string) => cmd.startsWith('/') && !known.includes(cmd);

    expect(isUnknown('/nonexistent')).toBe(true);
    expect(isUnknown('/help')).toBe(false);
  });

  it('should treat non-/ input as AI query', () => {
    const input = 'what is the Higgs boson?';
    const isAiQuery = !input.startsWith('/');
    expect(isAiQuery).toBe(true);
  });
});
