/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */

import { cernApi } from '../services/cern-api.js';
import type { ProcessStatus, LocalFile } from '../services/cern-api.js';

export type { ProcessStatus };

export async function listRootFiles(): Promise<LocalFile[]> {
  const files = await cernApi.listFiles();
  return files.filter(f => f.type === 'root');
}

export async function processFile(filePath: string): Promise<string> {
  const result = await cernApi.processFile(filePath);
  return result.id;
}

export async function processFolder(folderPath: string): Promise<string> {
  const result = await cernApi.processFolder(folderPath);
  return result.id;
}

export async function pollProcess(
  id: string,
  onProgress: (status: ProcessStatus) => void
): Promise<ProcessStatus> {
  while (true) {
    const status = await cernApi.processStatus(id);
    onProgress(status);
    if (status.status === 'processed' || status.status === 'error') {
      return status;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

export function formatEventSummary(results?: ProcessStatus['results']): string[] {
  if (!results) return [];
  const lines: string[] = [
    `  Events found:  ${results.eventCount.toLocaleString()}`,
    `  Experiment:    ${results.experiment}`,
    `  Peak HT:       ${results.peakHT.toFixed(1)} GeV`,
    `  Output file:   ${results.outputFile}`,
  ];
  if (results.particles && Object.keys(results.particles).length > 0) {
    lines.push('  Particles:');
    for (const [p, count] of Object.entries(results.particles)) {
      lines.push(`    ${p.padEnd(12)} ${count}`);
    }
  }
  return lines;
}
