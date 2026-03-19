// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import axios from 'axios';
import { docker } from '../services/docker.js';
import { createRequire } from 'module';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  dockerUpdate: boolean;
}

const CACHE_DIR = join(homedir(), '.opencern');
const CACHE_FILE = join(CACHE_DIR, 'update-cache.json');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface UpdateCache {
  lastCheck: number;
  cliUpdate: boolean;
  dockerUpdate: boolean;
  latestVersion: string;
}

function readCache(): UpdateCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as UpdateCache;
    if (Date.now() - data.lastCheck > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeCache(cache: UpdateCache): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch { /* ignore */ }
}

const DOCKER_IMAGES = [
  'ghcr.io/ceoatnorthstar/api:latest',
  'ghcr.io/ceoatnorthstar/xrootd:latest',
  'ghcr.io/ceoatnorthstar/streamer:latest',
];

async function checkDockerDigests(): Promise<boolean> {
  if (!docker.isDockerRunning()) return false;
  try {
    for (const image of DOCKER_IMAGES) {
      const localDigest = execSync(`docker inspect --format='{{index .RepoDigests 0}}' ${image} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      // Pull manifest to check remote digest
      const result = execSync(`docker manifest inspect ${image} 2>/dev/null | head -5`, { encoding: 'utf-8', timeout: 10000 }).trim();
      if (!localDigest || (result && !localDigest.includes(result.slice(0, 20)))) {
        return true; // Potential update available
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function checkForUpdates(useCache = true): Promise<UpdateInfo> {
  // Check cache first
  if (useCache) {
    const cached = readCache();
    if (cached) {
      let currentVersion = '0.0.0';
      try {
        const require = createRequire(import.meta.url);
        currentVersion = (require('../../package.json') as { version: string }).version;
      } catch { /* ignore */ }
      return {
        currentVersion,
        latestVersion: cached.latestVersion,
        hasUpdate: cached.cliUpdate,
        dockerUpdate: cached.dockerUpdate,
      };
    }
  }

  let currentVersion = '0.0.0';
  let latestVersion = '0.0.0';

  try {
    const require = createRequire(import.meta.url);
    currentVersion = (require('../../package.json') as { version: string }).version;
  } catch { /* ignore */ }

  try {
    const res = await axios.get('https://registry.npmjs.org/@opencern/cli/latest', { timeout: 5000 });
    latestVersion = (res.data as { version: string }).version || currentVersion;
  } catch { /* offline */ }

  const cliUpdate = latestVersion !== currentVersion && latestVersion !== '0.0.0';
  const dockerUpdate = await checkDockerDigests();

  writeCache({
    lastCheck: Date.now(),
    cliUpdate,
    dockerUpdate,
    latestVersion,
  });

  return {
    currentVersion,
    latestVersion,
    hasUpdate: cliUpdate,
    dockerUpdate,
  };
}

export async function updateDockerImages(onProgress: (image: string) => void): Promise<void> {
  if (!docker.isDockerRunning()) {
    throw new Error('Docker is not running. Start Docker first.');
  }

  for (const image of DOCKER_IMAGES) {
    onProgress(image);
    execSync(`docker pull ${image}`, { stdio: 'inherit' });
  }
}

export function getUpdateBanner(): string | null {
  const cached = readCache();
  if (!cached) return null;
  const parts: string[] = [];
  if (cached.cliUpdate) parts.push(`CLI v${cached.latestVersion}`);
  if (cached.dockerUpdate) parts.push('Docker images');
  if (parts.length === 0) return null;
  return `⬆ Update available: ${parts.join(' & ')}. Run /update to install.`;
}
