import { describe, it, expect } from 'vitest';

const DOCKER_COMPOSE_TEMPLATE = `services:
  api:
    image: ghcr.io/ceoatnorthstar/api:latest
    container_name: opencern-api
    ports:
      - "8080:8080"
    volumes:
      - ~/opencern-datasets:/data
    restart: unless-stopped

  xrootd:
    image: ghcr.io/ceoatnorthstar/xrootd:latest
    container_name: opencern-xrootd
    ports:
      - "8081:8081"
    restart: unless-stopped

  streamer:
    image: ghcr.io/ceoatnorthstar/streamer:latest
    container_name: opencern-streamer
    ports:
      - "9001:9001"
      - "9002:9002"
    restart: unless-stopped
`;

const QUANTUM_SERVICE = `
  quantum:
    image: ghcr.io/ceoatnorthstar/quantum:latest
    container_name: opencern-quantum
    ports:
      - "8082:8082"
    restart: unless-stopped
`;

function generateCompose(includeQuantum = false): string {
  return DOCKER_COMPOSE_TEMPLATE + (includeQuantum ? QUANTUM_SERVICE : '');
}

describe('Docker Compose Generation Snapshot', () => {
  it('base compose matches snapshot', () => {
    expect(generateCompose(false)).toMatchSnapshot();
  });

  it('compose with quantum matches snapshot', () => {
    expect(generateCompose(true)).toMatchSnapshot();
  });

  it('base compose includes core services', () => {
    const compose = generateCompose(false);
    expect(compose).toContain('opencern-api');
    expect(compose).toContain('opencern-xrootd');
    expect(compose).toContain('opencern-streamer');
    expect(compose).not.toContain('opencern-quantum');
  });

  it('quantum compose includes all four services', () => {
    const compose = generateCompose(true);
    expect(compose).toContain('opencern-api');
    expect(compose).toContain('opencern-xrootd');
    expect(compose).toContain('opencern-streamer');
    expect(compose).toContain('opencern-quantum');
  });

  it('exposes correct ports', () => {
    const compose = generateCompose(true);
    expect(compose).toContain('8080:8080');
    expect(compose).toContain('8081:8081');
    expect(compose).toContain('9001:9001');
    expect(compose).toContain('9002:9002');
    expect(compose).toContain('8082:8082');
  });

  it('mounts data volume for API', () => {
    const compose = generateCompose(false);
    expect(compose).toContain('~/opencern-datasets:/data');
  });

  it('all services use ghcr.io registry', () => {
    const compose = generateCompose(true);
    const imageLines = compose.split('\n').filter(l => l.includes('image:'));
    for (const line of imageLines) {
      expect(line).toContain('ghcr.io/ceoatnorthstar/');
    }
  });

  it('all services set restart policy', () => {
    const compose = generateCompose(true);
    const restartLines = compose.split('\n').filter(l => l.includes('restart:'));
    for (const line of restartLines) {
      expect(line).toContain('unless-stopped');
    }
  });
});
