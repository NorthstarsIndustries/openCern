// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { execSync } from 'child_process';
import { docker } from '../services/docker.js';
import { config } from '../utils/config.js';
// ── Logs ─────────────────────────────────────────────────
export function getLogs(service, tail = 50) {
    if (!docker.isDockerRunning()) {
        return ['  [-] Docker is not running'];
    }
    const target = service || 'api';
    const containerName = target.startsWith('opencern-') ? target : `opencern-${target}`;
    try {
        const output = execSync(`docker logs --tail=${tail} ${containerName} 2>&1`, { encoding: 'utf-8', timeout: 10000 });
        const logLines = output.split('\n').filter(Boolean);
        if (logLines.length === 0)
            return [`  No logs for ${containerName}`];
        return [
            '',
            `  Logs: ${containerName} (last ${tail} lines)`,
            '  ────────────────────────────────────────',
            ...logLines.map(l => `  ${l}`),
            '',
        ];
    }
    catch (err) {
        return [`  [-] Could not get logs for ${containerName}: ${err.message}`];
    }
}
// ── Restart ──────────────────────────────────────────────
export async function restartService(service) {
    if (!docker.isDockerRunning()) {
        return ['  [-] Docker is not running'];
    }
    const target = service || 'api';
    const containerName = target.startsWith('opencern-') ? target : `opencern-${target}`;
    try {
        execSync(`docker restart ${containerName}`, { stdio: 'ignore', timeout: 30000 });
        return [`  [+] Restarted ${containerName}`];
    }
    catch (err) {
        return [`  [-] Could not restart ${containerName}: ${err.message}`];
    }
}
// ── Stop ─────────────────────────────────────────────────
export async function stopAll() {
    if (!docker.isDockerRunning()) {
        return ['  [-] Docker is not running'];
    }
    try {
        await docker.stopContainers();
        return ['  [+] All containers stopped'];
    }
    catch (err) {
        return [`  [-] Could not stop containers: ${err.message}`];
    }
}
// ── Pull ─────────────────────────────────────────────────
export async function pullImages(onProgress) {
    if (!docker.isDockerRunning()) {
        return ['  [-] Docker is not running'];
    }
    try {
        await docker.pullImages();
        return ['  [+] All images pulled to latest'];
    }
    catch (err) {
        return [`  [-] Pull failed: ${err.message}`];
    }
}
// ── Top ──────────────────────────────────────────────────
export function containerTop() {
    if (!docker.isDockerRunning()) {
        return ['  [-] Docker is not running'];
    }
    try {
        const output = execSync('docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}" 2>/dev/null | grep opencern', { encoding: 'utf-8', timeout: 10000 });
        if (!output.trim())
            return ['  No running OpenCERN containers'];
        const lines = [
            '',
            '  Container Resource Usage',
            '  ────────────────────────────────────────────────────────────',
            `  ${'Name'.padEnd(22)} ${'CPU'.padEnd(10)} ${'Memory'.padEnd(22)} ${'Net I/O'.padEnd(18)} PIDs`,
            '  ' + '─'.repeat(76),
        ];
        for (const row of output.trim().split('\n')) {
            lines.push(`  ${row}`);
        }
        lines.push('');
        return lines;
    }
    catch {
        return ['  [-] Could not get container stats'];
    }
}
// ── Network ──────────────────────────────────────────────
export function networkInfo() {
    if (!docker.isDockerRunning()) {
        return ['  [-] Docker is not running'];
    }
    const status = docker.getStatus();
    const lines = [
        '',
        '  Network & Port Mappings',
        '  ────────────────────────────────────────',
    ];
    const portMap = {
        'opencern-api': '8080:8080  (REST API)',
        'opencern-xrootd': '8081:8081  (XRootD proxy)',
        'opencern-streamer': '9001:9001, 9002:9002  (Event stream)',
        'opencern-quantum': '8082:8082  (Quantum service)',
    };
    for (const [name, info] of Object.entries(status)) {
        const icon = info.running ? '[+]' : '[-]';
        const short = name.replace('opencern-', '');
        const ports = portMap[name] || 'N/A';
        lines.push(`  ${icon} ${short.padEnd(14)} ${info.status.padEnd(12)} ${ports}`);
    }
    lines.push('');
    lines.push(`  API Base URL: ${config.get('apiBaseUrl')}`);
    lines.push('');
    return lines;
}
// ── Health ───────────────────────────────────────────────
export async function quickHealth() {
    const dockerRunning = docker.isDockerRunning();
    const lines = [
        '',
        '  Quick Health Check',
        '  ────────────────────────────────────────',
    ];
    if (!dockerRunning) {
        lines.push('  [-] Docker          not running');
        lines.push('');
        return lines;
    }
    lines.push('  [+] Docker          running');
    const apiReady = await docker.isApiReady();
    lines.push(`  ${apiReady ? '[+]' : '[-]'} API             ${apiReady ? 'healthy' : 'unreachable'}`);
    const qReady = await docker.isQuantumReady();
    lines.push(`  ${qReady ? '[+]' : '[~]'} Quantum         ${qReady ? 'healthy' : 'not started'}`);
    lines.push('');
    return lines;
}
//# sourceMappingURL=containers.js.map