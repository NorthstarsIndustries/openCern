// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { execSync } from 'child_process';
import { platform, release, arch, cpus, totalmem, freemem, homedir } from 'os';
import { createRequire } from 'module';
import { docker } from '../services/docker.js';
import { config } from '../utils/config.js';
import { hasKey } from '../utils/keystore.js';
import { isAuthenticated } from '../utils/auth.js';
// ── Env ──────────────────────────────────────────────────
export function envInfo() {
    const lines = [
        '',
        '  Environment',
        '  ────────────────────────────────────────',
        `  Platform       ${platform()} ${arch()}`,
        `  OS             ${release()}`,
        `  Node.js        ${process.versions.node}`,
        `  V8             ${process.versions.v8}`,
        `  npm            ${safeExec('npm --version')}`,
    ];
    const dockerVersion = safeExec('docker --version');
    if (dockerVersion)
        lines.push(`  Docker         ${dockerVersion.replace('Docker version ', '').trim()}`);
    const pythonVersion = safeExec('python3 --version') || safeExec('python --version');
    if (pythonVersion)
        lines.push(`  Python         ${pythonVersion.replace('Python ', '').trim()}`);
    const cmakeVersion = safeExec('cmake --version');
    if (cmakeVersion) {
        const ver = cmakeVersion.split('\n')[0].replace('cmake version ', '').trim();
        lines.push(`  CMake          ${ver}`);
    }
    lines.push('');
    lines.push('  Resources');
    lines.push('  ────────────────────────────────────────');
    lines.push(`  CPUs           ${cpus().length} x ${cpus()[0]?.model || 'unknown'}`);
    lines.push(`  Total Memory   ${(totalmem() / 1e9).toFixed(1)} GB`);
    lines.push(`  Free Memory    ${(freemem() / 1e9).toFixed(1)} GB`);
    lines.push(`  Home           ${homedir()}`);
    lines.push(`  Data Dir       ${config.get('dataDir')}`);
    lines.push('');
    lines.push('  Configuration');
    lines.push('  ────────────────────────────────────────');
    lines.push(`  API Base URL   ${config.get('apiBaseUrl')}`);
    lines.push(`  Model          ${config.get('defaultModel')}`);
    lines.push(`  Quantum        ${config.get('quantumBackend')}`);
    lines.push(`  Anthropic Key  ${hasKey('anthropic') ? 'configured' : 'not set'}`);
    lines.push(`  IBM Quantum    ${hasKey('ibm-quantum') ? 'configured' : 'not set'}`);
    lines.push(`  Auth           ${isAuthenticated() ? 'signed in' : 'not signed in'}`);
    lines.push('');
    return lines;
}
// ── Version ──────────────────────────────────────────────
export function versionInfo() {
    let cliVersion = 'unknown';
    try {
        const require = createRequire(import.meta.url);
        cliVersion = require('../../package.json').version;
    }
    catch { /* ignore */ }
    const lines = [
        '',
        `  opencern v${cliVersion}`,
        '  ────────────────────────────────────────',
        `  CLI          v${cliVersion}`,
        `  Node.js      ${process.versions.node}`,
        `  Platform     ${platform()} ${arch()}`,
    ];
    const dockerVer = safeExec('docker --version');
    if (dockerVer)
        lines.push(`  Docker       ${dockerVer.replace('Docker version ', '').split(',')[0]}`);
    if (docker.isDockerRunning()) {
        const status = docker.getStatus();
        const running = Object.values(status).filter(s => s.running).length;
        const total = Object.keys(status).length;
        lines.push(`  Containers   ${running}/${total} running`);
    }
    lines.push('');
    return lines;
}
// ── About ────────────────────────────────────────────────
export function aboutInfo() {
    let cliVersion = '1.0.0-beta.1';
    try {
        const require = createRequire(import.meta.url);
        cliVersion = require('../../package.json').version;
    }
    catch { /* ignore */ }
    return [
        '',
        '     ___                    ____ _____ ____  _   _',
        '    / _ \\ _ __   ___ _ __  / ___| ____|  _ \\| \\ | |',
        '   | | | | \'_ \\ / _ \\ \'_ \\| |   |  _| | |_) |  \\| |',
        '   | |_| | |_) |  __/ | | | |___| |___|  _ <| |\\  |',
        '    \\___/| .__/ \\___|_| |_|\\____|_____|_| \\_\\_| \\_|',
        '         |_|',
        '',
        `  v${cliVersion}`,
        '',
        '  AI-powered particle physics analysis with quantum computing.',
        '  Open source tools for exploring CERN Open Data.',
        '',
        '  Built by NorthStars Industries',
        '',
        '  Stack:',
        '    CLI        TypeScript, React/Ink',
        '    Backend    Docker, FastAPI, ROOT C++',
        '    AI         Claude (Anthropic)',
        '    Quantum    Qiskit VQC, IBM Quantum',
        '    Viz        OpenGL, Three.js/Electron',
        '',
        '  Links:',
        '    docs       https://docs.opencern.io',
        '    repo       https://github.com/opencern/opencern',
        '    npm        https://npmjs.com/package/@opencern/cli',
        '    data       https://opendata.cern.ch',
        '',
    ];
}
function safeExec(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=system.js.map