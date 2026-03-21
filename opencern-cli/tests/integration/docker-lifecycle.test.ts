import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DOCKER_AVAILABLE = (() => {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!DOCKER_AVAILABLE)('Docker lifecycle integration', () => {
  beforeAll(() => {
    mkdirSync(join(homedir(), '.opencern'), { recursive: true });
  });

  const COMPOSE_SERVICES = ['api', 'xrootd', 'streamer'];
  const IMAGES = [
    'ghcr.io/ceoatnorthstar/api:latest',
    'ghcr.io/ceoatnorthstar/xrootd:latest',
    'ghcr.io/ceoatnorthstar/streamer:latest',
  ];

  it('should verify Docker daemon is accessible', () => {
    const output = execSync('docker info --format "{{.ServerVersion}}"', { encoding: 'utf-8' });
    expect(output.trim().length).toBeGreaterThan(0);
  });

  it('should verify Docker Compose is available', () => {
    const output = execSync('docker compose version', { encoding: 'utf-8' });
    expect(output).toContain('Docker Compose');
  });

  it('should list images required for OpenCERN', () => {
    for (const image of IMAGES) {
      const name = image.split('/').pop()?.split(':')[0];
      expect(name).toBeDefined();
    }
  });

  it('should generate valid compose YAML', async () => {
    const { docker } = await import('../../src/services/docker.js');
    docker.ensureComposeFile(false);

    const compose = docker.getComposeFile();
    expect(compose).toContain('services:');
    expect(compose).toContain('api');
    expect(compose).toContain('streamer');
    expect(compose).toContain('xrootd');
  });

  it('should generate compose YAML with quantum when requested', async () => {
    const { docker } = await import('../../src/services/docker.js');
    docker.ensureComposeFile(true);

    const compose = docker.getComposeFile();
    expect(compose).toContain('quantum');
    expect(compose).toContain('8082');
  });

  it('should report health status correctly', async () => {
    const { docker } = await import('../../src/services/docker.js');
    const running = await docker.isDockerRunning();
    expect(typeof running).toBe('boolean');
  });

  it('should return container status map', async () => {
    const { docker } = await import('../../src/services/docker.js');
    const status = docker.getStatus();
    expect(typeof status).toBe('object');
  });
});
