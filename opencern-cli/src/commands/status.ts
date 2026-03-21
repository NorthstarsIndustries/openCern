// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { docker } from '../services/docker.js';
import { cernApi } from '../services/cern-api.js';
import { config } from '../utils/config.js';
import { isAuthenticated } from '../utils/auth.js';
import { statSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface SystemStatus {
  docker: { running: boolean };
  containers: Record<string, { running: boolean; status: string }>;
  api: { healthy: boolean; responseTime?: number; version?: string };
  quantum: { healthy: boolean };
  auth: { authenticated: boolean };
  disk: { datasetDir: string; size: number; fileCount: number };
}

function getDiskUsage(dir: string): { size: number; fileCount: number } {
  if (!existsSync(dir)) return { size: 0, fileCount: 0 };
  try {
    let size = 0;
    let fileCount = 0;
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (item.isFile()) {
        size += statSync(join(dir, item.name)).size;
        fileCount++;
      }
    }
    return { size, fileCount };
  } catch {
    return { size: 0, fileCount: 0 };
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const dockerRunning = await docker.isDockerRunning();
  const containers = dockerRunning ? docker.getStatus() : {};

  let apiHealthy = false;
  let responseTime: number | undefined;
  let apiVersion: string | undefined;

  if (dockerRunning) {
    const start = Date.now();
    try {
      const health = await cernApi.health();
      apiHealthy = true;
      responseTime = Date.now() - start;
      apiVersion = health.version;
    } catch { /* api not ready */ }
  }

  const quantumHealthy = dockerRunning ? await docker.isQuantumReady() : false;
  const authenticated = isAuthenticated();
  const dataDir = config.get('dataDir');
  const disk = getDiskUsage(dataDir);

  return {
    docker: { running: Boolean(dockerRunning) },
    containers,
    api: { healthy: apiHealthy, responseTime, version: apiVersion },
    quantum: { healthy: quantumHealthy },
    auth: { authenticated },
    disk: { datasetDir: dataDir, ...disk },
  };
}

export function formatStatus(status: SystemStatus): string[] {
  const ok = '[+]';
  const fail = '[-]';
  const na = '[~]';

  const lines: string[] = [
    '',
    '  System Status',
    '  ─────────────────────────────────────',
    `  Docker         ${status.docker.running ? ok + ' Running' : fail + ' Not running'}`,
    `  API            ${status.api.healthy ? ok + ' Healthy' + (status.api.responseTime ? ` (${status.api.responseTime}ms)` : '') + (status.api.version ? ` v${status.api.version}` : '') : fail + ' Unreachable'}`,
    `  Quantum        ${status.quantum.healthy ? ok + ' Running' : na + ' Not started'}`,
    `  Auth           ${status.auth.authenticated ? ok + ' Signed in' : na + ' Not signed in'}`,
  ];

  if (Object.keys(status.containers).length > 0) {
    lines.push('', '  Containers', '  ─────────────────────────────────────');
    for (const [name, info] of Object.entries(status.containers)) {
      const icon = info.running ? ok : fail;
      const short = name.replace('opencern-', '');
      lines.push(`  ${short.padEnd(18)} ${icon} ${info.status}`);
    }
  }

  const sizeMB = (status.disk.size / 1_000_000).toFixed(1);
  lines.push(
    '',
    '  Datasets',
    '  ─────────────────────────────────────',
    `  Directory      ${status.disk.datasetDir}`,
    `  Files          ${status.disk.fileCount}`,
    `  Total size     ${sizeMB} MB`,
    '',
  );

  return lines;
}
