// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { existsSync, mkdirSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { join, resolve, isAbsolute } from 'path';
import { cpus, homedir, platform } from 'os';

const SIM_DIR = join(homedir(), '.opencern', 'bin');
const SIM_BINARY = join(SIM_DIR, 'opencern-sim');
const SIM_SOURCE = join(process.cwd(), 'sim');

// Also check the local build directory as a fallback
const SIM_LOCAL_BINARY = join(SIM_SOURCE, 'build', 'opencern-sim');

export interface SimResult {
  success: boolean;
  message: string;
}

export function isSimBuilt(): boolean {
  return existsSync(SIM_BINARY) || existsSync(SIM_LOCAL_BINARY);
}

function getSimBinary(): string {
  if (existsSync(SIM_BINARY)) return SIM_BINARY;
  if (existsSync(SIM_LOCAL_BINARY)) return SIM_LOCAL_BINARY;
  return SIM_BINARY;
}

export function isSimSourcePresent(): boolean {
  return existsSync(join(SIM_SOURCE, 'CMakeLists.txt'));
}

export function checkBuildDeps(): { cmake: boolean; compiler: boolean; glfw: boolean } {
  const cmake = commandExists('cmake');
  const compiler = commandExists('c++') || commandExists('g++') || commandExists('clang++');
  let glfw = false;

  try {
    if (platform() === 'darwin') {
      // Check Homebrew
      execSync('brew list glfw 2>/dev/null', { stdio: 'ignore' });
      glfw = true;
    } else {
      // Check pkg-config
      execSync('pkg-config --exists glfw3 2>/dev/null', { stdio: 'ignore' });
      glfw = true;
    }
  } catch {
    glfw = false;
  }

  return { cmake, compiler, glfw };
}

export function buildSim(onOutput: (line: string) => void): SimResult {
  if (!isSimSourcePresent()) {
    return { success: false, message: 'Sim source not found. Expected at: ' + SIM_SOURCE };
  }

  const deps = checkBuildDeps();
  if (!deps.cmake) {
    return { success: false, message: 'CMake not found. Install: brew install cmake (macOS) or apt install cmake (Linux)' };
  }
  if (!deps.compiler) {
    return { success: false, message: 'C++ compiler not found. Install Xcode CLI tools (macOS) or build-essential (Linux)' };
  }
  if (!deps.glfw) {
    return { success: false, message: 'GLFW not found. Install: brew install glfw (macOS) or apt install libglfw3-dev (Linux)' };
  }

  const buildDir = join(SIM_SOURCE, 'build');
  if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });
  if (!existsSync(SIM_DIR)) mkdirSync(SIM_DIR, { recursive: true });

  try {
    onOutput('Running cmake...');
    execSync(`cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=${SIM_DIR} ..`, {
      cwd: buildDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    });

    onOutput('Compiling...');
    const cpuCount = cpus().length;
    execSync(`cmake --build . --parallel ${cpuCount}`, {
      cwd: buildDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });

    // Copy binary
    const builtBinary = join(buildDir, 'opencern-sim');
    if (existsSync(builtBinary)) {
      execSync(`cp "${builtBinary}" "${SIM_BINARY}"`, { stdio: 'ignore' });
      execSync(`chmod +x "${SIM_BINARY}"`, { stdio: 'ignore' });
    }

    return { success: true, message: `Build complete. Binary at: ${SIM_BINARY}` };
  } catch (err) {
    return { success: false, message: `Build failed: ${(err as Error).message}` };
  }
}

export function launchSim(filePath: string, event?: number): SimResult {
  if (!isSimBuilt()) {
    return { success: false, message: 'Sim not built. Run /sim --build first.' };
  }

  // Expand ~ to home directory, then resolve relative paths against cwd
  const expanded = filePath.startsWith('~/') ? join(homedir(), filePath.slice(2)) : filePath;
  const resolved = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);

  if (!existsSync(resolved)) {
    return { success: false, message: `File not found: ${resolved}` };
  }

  const binary = getSimBinary();
  const args = [resolved];
  if (event !== undefined) {
    args.push(`--event=${event}`);
  }

  try {
    const child = spawn(binary, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return { success: true, message: `Launched collision viewer for ${filePath.split('/').pop()}` };
  } catch (err) {
    return { success: false, message: `Could not launch viewer: ${(err as Error).message}` };
  }
}

export function getSimStatus(): string[] {
  const built = isSimBuilt();
  const sourcePresent = isSimSourcePresent();
  const deps = checkBuildDeps();

  const lines: string[] = [
    '',
    '  Collision Viewer Status',
    '  ────────────────────────────────────────',
    `  ${built ? '[+]' : '[-]'} Binary          ${built ? getSimBinary() : 'not built'}`,
    `  ${sourcePresent ? '[+]' : '[-]'} Source          ${sourcePresent ? SIM_SOURCE : 'not found'}`,
    '',
    '  Build Dependencies',
    '  ────────────────────────────────────────',
    `  ${deps.cmake ? '[+]' : '[-]'} CMake`,
    `  ${deps.compiler ? '[+]' : '[-]'} C++ Compiler`,
    `  ${deps.glfw ? '[+]' : '[-]'} GLFW`,
    '',
  ];

  if (!built && sourcePresent) {
    lines.push('  Build with: /sim --build');
    lines.push('');
  }

  return lines;
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
