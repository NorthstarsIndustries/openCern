import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { render, Box, Text, useApp, useInput, useStdout, Static } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { Prompt } from './components/Prompt.js';
import { AIStream } from './components/AIStream.js';
import { ProgressBar } from './components/ProgressBar.js';
import { FilePreview } from './components/FilePreview.js';
import { QuantumPanel } from './components/QuantumPanel.js';
import { KeyboardShortcuts } from './components/KeyboardShortcuts.js';
import { Toast, useToast } from './components/Toast.js';
import { InlineSpinner } from './components/Spinner.js';
import { config } from './utils/config.js';
import { add as addHistory, getAll as getAllHistory } from './utils/history.js';
import { isAuthenticated } from './utils/auth.js';
import { docker } from './services/docker.js';
import { anthropicService } from './services/anthropic.js';
import { getHelpText } from './commands/help.js';
import { getSystemStatus, formatStatus } from './commands/status.js';
import { runDoctorChecks, formatDoctorResults } from './commands/doctor.js';
import { login, logout } from './commands/auth.js';
import { showConfig, getConfigItems, resetConfig, getKeyStatus, setApiKey, removeApiKey } from './commands/config.js';
import { checkForUpdates, updateDockerImages } from './commands/update.js';
import { openFile } from './commands/open.js';
import { openAndAsk } from './commands/opask.js';
import { extractEvents, runClassification, ensureQuantumRunning } from './commands/quantum.js';
import { openViz, renderASCII } from './commands/viz.js';
import { quantumService } from './services/quantum.js';
import { formatProfile, setProfileField, exportProfile } from './commands/profile.js';
import { listLocalDatasets, formatDatasetList, getDatasetStats, renderHistogram, renderScatterPlot, headEvents, tailEvents, describeDataset, filterEvents, sampleEvents, exportDataset, mergeDatasets, correlateFields, } from './commands/datasets.js';
import { renderTree, catFile, grepFile, findFiles, diffFiles, cleanFiles, diskUsage, cacheInfo, } from './commands/files.js';
import { getLogs, restartService, stopAll, containerTop, networkInfo, quickHealth, } from './commands/containers.js';
import { whoami, listSessions, saveSession, loadSession, getRecall, setAlias, resolveAlias, listAliases, loadScript, quickGet, quickSet, } from './commands/session.js';
import { envInfo, versionInfo, aboutInfo } from './commands/system.js';
import { buildSim, launchSim, getSimStatus } from './commands/sim.js';
let outputLineIdCounter = 0;
// ── API health gate ──────────────────────────────────────
async function ensureApiReady() {
    if (!docker.isDockerRunning()) {
        return { ready: false, message: 'Docker is not running. Start Docker Desktop first.' };
    }
    const apiReady = await docker.isApiReady();
    if (!apiReady) {
        return { ready: false, message: 'API container is not running. Run /status or wait for auto-start.' };
    }
    return { ready: true };
}
// ── Main App ─────────────────────────────────────────────
function App() {
    const { exit } = useApp();
    const abortRef = useRef(null);
    const approvalResolveRef = useRef(null);
    const [state, setState] = useState({
        view: 'home',
        output: [],
        isLoading: false,
        loadingMsg: '',
        promptDisabled: false,
        aiTokens: '',
        aiStreaming: false,
        pendingTool: null,
        toolResults: [],
        quantumRunning: false,
        configIndex: 0,
        configValue: '',
        showShortcuts: false,
        showCommandPalette: false,
        sessionStart: Date.now(),
    });
    const { messages: toastMessages, addToast, dismissToast } = useToast();
    // Fullscreen responsive sizing
    const { stdout } = useStdout();
    const [size, setSize] = useState({
        columns: stdout.columns || 80,
        rows: stdout.rows || 24,
    });
    useEffect(() => {
        const onResize = () => setSize({ columns: stdout.columns, rows: stdout.rows });
        stdout.on('resize', onResize);
        return () => { stdout.off('resize', onResize); };
    }, [stdout]);
    function addOutput(lines, color, bold) {
        const arr = Array.isArray(lines) ? lines : [lines];
        const newLines = arr.map(text => ({ id: ++outputLineIdCounter, text, color, bold }));
        setState(s => ({
            ...s,
            output: [...s.output, ...newLines],
        }));
    }
    function clearOutput() {
        // Push blank lines to scroll previous Static content out of view
        const rows = size.rows || 24;
        const blanks = Array.from({ length: rows }, () => ({
            id: ++outputLineIdCounter,
            text: '',
        }));
        setState(s => ({ ...s, output: [...s.output, ...blanks] }));
    }
    function setLoading(loading, msg = '') {
        setState(s => ({ ...s, isLoading: loading, loadingMsg: msg, promptDisabled: loading }));
    }
    // Approve/deny handler for agentic tool calls
    const handleApprove = useCallback(() => {
        if (approvalResolveRef.current) {
            approvalResolveRef.current(true);
            approvalResolveRef.current = null;
            setState(s => ({ ...s, pendingTool: null }));
        }
    }, []);
    const handleDeny = useCallback(() => {
        if (approvalResolveRef.current) {
            approvalResolveRef.current(false);
            approvalResolveRef.current = null;
            setState(s => ({ ...s, pendingTool: null }));
        }
    }, []);
    // Global keyboard shortcuts
    useInput((input, key) => {
        // Ctrl+D = exit
        if (key.ctrl && input === 'd') {
            exit();
            return;
        }
        // Ctrl+L = clear
        if (key.ctrl && input === 'l') {
            clearOutput();
            return;
        }
        // Ctrl+K = command palette
        if (key.ctrl && input === 'k') {
            setState(s => ({ ...s, showCommandPalette: !s.showCommandPalette }));
            return;
        }
        // ? = keyboard shortcuts (only when not typing)
        if (input === '?' && !state.promptDisabled && !state.aiStreaming && state.view === 'home') {
            setState(s => ({ ...s, showShortcuts: !s.showShortcuts }));
            return;
        }
        // Escape = cancel/dismiss
        if (key.escape) {
            if (state.showShortcuts) {
                setState(s => ({ ...s, showShortcuts: false }));
                return;
            }
            if (state.showCommandPalette) {
                setState(s => ({ ...s, showCommandPalette: false }));
                return;
            }
            if (state.pendingTool) {
                handleDeny();
                return;
            }
            if (state.aiStreaming) {
                abortRef.current?.abort();
                setState(s => ({ ...s, aiStreaming: false }));
                return;
            }
            if (state.view !== 'home') {
                setState(s => ({ ...s, view: 'home', fileContent: undefined, aiTokens: '' }));
            }
            return;
        }
        // Enter = approve tool (when pending)
        if (key.return && state.pendingTool) {
            handleApprove();
            return;
        }
    });
    // Startup sequence
    useEffect(() => {
        const firstRun = config.isFirstRun();
        config.load();
        const banner = [
            '     ___                    ____ _____ ____  _   _',
            '    / _ \\ _ __   ___ _ __  / ___| ____|  _ \\| \\ | |',
            '   | | | | \'_ \\ / _ \\ \'_ \\| |   |  _| | |_) |  \\| |',
            '   | |_| | |_) |  __/ | | | |___| |___|  _ <| |\\  |',
            '    \\___/| .__/ \\___|_| |_|\\____|_____|_| \\_\\_| \\_|',
            '         |_|',
        ];
        if (firstRun) {
            addOutput([
                '',
                ...banner,
                '',
                '  Welcome to OpenCERN CLI',
                '  AI-powered particle physics analysis and quantum computing',
                '',
                '  Run /config to configure your API keys.',
                '  Run /help to see all available commands.',
                '  Press ? for keyboard shortcuts.',
                '',
            ], undefined, true);
        }
        else {
            addOutput([
                '',
                ...banner,
                '',
                '  OpenCERN Engine Ready',
                '  Type / for commands or ask a physics question',
                '',
            ], undefined, true);
        }
        // Check Docker in background
        if (config.get('autoStartDocker')) {
            (async () => {
                const running = docker.isDockerRunning();
                if (running) {
                    const present = docker.areImagesPresent();
                    if (!present) {
                        addOutput('  missing required engine images. pulling from GHCR...', 'cyan');
                        try {
                            await docker.pullImages();
                            addOutput('  [+] engine downloaded successfully', 'green');
                        }
                        catch (err) {
                            addOutput(`  [-] failed to pull engine: ${err.message}`, 'red');
                            return;
                        }
                    }
                    else {
                        docker.checkForUpdates().then(hasUpdate => {
                            if (hasUpdate) {
                                addOutput('', 'gray');
                                addOutput('  [*] An update is available for the OpenCERN engine!', 'cyan', true);
                                addOutput('      Run "/update" to download the latest version.', 'cyan');
                            }
                        }).catch(() => { });
                    }
                    const ready = await docker.isApiReady();
                    if (!ready) {
                        addOutput('  starting containers...', 'gray');
                        try {
                            await docker.startContainers();
                            addOutput('  [+] containers started', 'green');
                        }
                        catch (err) {
                            addOutput(`  [-] could not start containers: ${err.message}`, 'yellow');
                        }
                    }
                }
                else {
                    addOutput('  [~] Docker Desktop is not running. Core features will be disabled.', 'yellow');
                }
            })();
        }
        if (!isAuthenticated()) {
            addOutput('  run /login to sign in and unlock all features', 'yellow');
        }
    }, []);
    // ─── Agentic AI handler ──────────────────────────────────
    async function runAgenticQuery(question) {
        setState(s => ({
            ...s,
            view: 'ask',
            aiTokens: '',
            aiStreaming: true,
            promptDisabled: true,
            pendingTool: null,
            toolResults: [],
        }));
        abortRef.current = new AbortController();
        const start = Date.now();
        try {
            await anthropicService.agenticStream(question, (event) => {
                switch (event.type) {
                    case 'text':
                        setState(s => ({ ...s, aiTokens: s.aiTokens + (event.text || '') }));
                        break;
                    case 'tool_call':
                        if (event.toolCall) {
                            setState(s => ({ ...s, pendingTool: event.toolCall }));
                        }
                        break;
                    case 'tool_result':
                        if (event.toolResult) {
                            setState(s => ({
                                ...s,
                                toolResults: [...s.toolResults, event.toolResult],
                            }));
                        }
                        break;
                    case 'done':
                        setState(s => ({
                            ...s,
                            aiStreaming: false,
                            aiTokenCount: event.totalTokens,
                            aiLatency: Date.now() - start,
                            promptDisabled: false,
                        }));
                        break;
                    case 'error':
                        addOutput(`  [-] ${event.error}`, 'red');
                        setState(s => ({ ...s, aiStreaming: false, promptDisabled: false }));
                        break;
                }
            }, async (toolCall) => {
                return new Promise((resolve) => {
                    approvalResolveRef.current = resolve;
                    setState(s => ({ ...s, pendingTool: toolCall }));
                });
            }, abortRef.current.signal);
        }
        catch (err) {
            setState(s => ({ ...s, aiStreaming: false, promptDisabled: false }));
            if (err.message.includes('API key')) {
                addOutput([
                    '  Anthropic API key not configured.',
                    '  Run /config or /keys set anthropic <key>',
                ], 'yellow');
            }
            else {
                addOutput(`  [-] ${err.message}`, 'red');
            }
        }
    }
    // ─── API-gated command helper ────────────────────────────
    async function withApiCheck(fn) {
        const { ready, message } = await ensureApiReady();
        if (!ready) {
            addOutput(`  [-] ${message}`, 'yellow');
            return;
        }
        await fn();
    }
    // Helper for parsing --key=value flags
    function parseFlags(args) {
        const flags = {};
        for (const arg of args) {
            const match = arg.match(/^--(\w[\w-]*)(?:=(.+)|([<>]\d+\.?\d*))$/);
            if (match) {
                flags[match[1]] = match[2] || match[3] || 'true';
            }
        }
        return flags;
    }
    // ─── Command Router ──────────────────────────────────────
    async function handleInput(raw) {
        // Resolve aliases first
        const resolved = resolveAlias(raw);
        const input = resolved.trim();
        if (!input)
            return;
        addHistory(input);
        const parts = input.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        const argStr = args.join(' ');
        const flags = parseFlags(args);
        switch (cmd) {
            case '/exit':
            case 'exit':
            case 'quit':
                exit();
                return;
            case '/clear':
            case 'clear':
                clearOutput();
                return;
            case '/help':
            case 'help':
                setState(s => ({ ...s, view: 'help' }));
                addOutput(getHelpText());
                return;
            case '/history': {
                const hist = getAllHistory().slice(0, 20);
                addOutput(['', '  Recent commands:']);
                hist.forEach((entry, i) => addOutput(`  ${String(i + 1).padStart(3)}. ${entry.command}`, 'gray'));
                addOutput('');
                return;
            }
            // ─── System ────────────────────────────────────────────
            case '/status': {
                setState(s => ({ ...s, view: 'status' }));
                setLoading(true, 'checking system status...');
                try {
                    const status = await getSystemStatus();
                    setLoading(false);
                    addOutput(formatStatus(status));
                }
                catch (err) {
                    setLoading(false);
                    addOutput(`  [-] ${err.message}`, 'red');
                }
                return;
            }
            case '/doctor': {
                setState(s => ({ ...s, view: 'doctor' }));
                setLoading(true, 'running diagnostics...');
                try {
                    const checks = await runDoctorChecks();
                    setLoading(false);
                    addOutput(formatDoctorResults(checks));
                }
                catch (err) {
                    setLoading(false);
                    addOutput(`  [-] ${err.message}`, 'red');
                }
                return;
            }
            case '/config': {
                if (args.includes('--show')) {
                    addOutput(showConfig());
                    return;
                }
                if (args.includes('--reset')) {
                    resetConfig();
                    addOutput('  [+] configuration reset to defaults', 'green');
                    return;
                }
                const items = getConfigItems();
                setState(s => ({ ...s, view: 'config-wizard', configItems: items, configIndex: 0, configValue: '' }));
                addOutput(['', '  Configuration', '  ────────────────────────────────────────']);
                addOutput(`  ${items[0].label}: ${items[0].description}`, 'cyan');
                addOutput(`  current: ${items[0].current || 'not set'}`, 'gray');
                addOutput(`  enter new value (or press Enter to keep current):`, 'gray');
                addOutput('');
                return;
            }
            case '/keys': {
                if (args.length === 0) {
                    addOutput(getKeyStatus());
                    return;
                }
                const subCmd = args[0];
                if (subCmd === 'set' && args.length >= 3) {
                    const result = setApiKey(args[1], args.slice(2).join(' '));
                    addOutput(`  ${result.success ? '[+]' : '[-]'} ${result.message}`, result.success ? 'green' : 'red');
                    return;
                }
                if (subCmd === 'remove' && args.length >= 2) {
                    const result = removeApiKey(args[1]);
                    addOutput(`  ${result.success ? '[+]' : '[-]'} ${result.message}`, result.success ? 'green' : 'red');
                    return;
                }
                addOutput([
                    '  Usage:',
                    '    /keys                      show all keys',
                    '    /keys set <provider> <key>  store a key',
                    '    /keys remove <provider>     remove a key',
                    '',
                    '  Providers: anthropic, ibm-quantum',
                ], 'gray');
                return;
            }
            case '/models': {
                setLoading(true, 'fetching models from Anthropic...');
                try {
                    const models = await anthropicService.listModels();
                    setLoading(false);
                    const current = config.get('defaultModel');
                    addOutput(['', '  Available Models', '  ────────────────────────────────────────']);
                    for (const m of models) {
                        const active = m.id === current ? ' (active)' : '';
                        addOutput(`  ${m.id}${active}`, m.id === current ? 'cyan' : 'gray');
                    }
                    addOutput(['', '  Switch model: /model <id>', '']);
                }
                catch (err) {
                    setLoading(false);
                    addOutput(`  [-] ${err.message}`, 'red');
                }
                return;
            }
            case '/model': {
                if (!argStr) {
                    addOutput(`  current model: ${config.get('defaultModel')}`, 'cyan');
                    addOutput('  switch with: /model <model-id>');
                    return;
                }
                config.set('defaultModel', argStr);
                addOutput(`  [+] model set to ${argStr}`, 'green');
                return;
            }
            case '/usage': {
                addOutput(anthropicService.getUsageFormatted());
                return;
            }
            // ─── Auth ──────────────────────────────────────────────
            case '/login': {
                setState(s => ({ ...s, view: 'login' }));
                setLoading(true, 'initializing login...');
                try {
                    const result = await login((code, url) => {
                        setLoading(false);
                        addOutput([
                            '',
                            '  opening browser for authentication...',
                            `  if it doesn't open, visit: ${url}`,
                            '',
                            `  your code: ${code}`,
                            '',
                        ]);
                        setState(s => ({ ...s, isLoading: true, loadingMsg: 'waiting for authorization...' }));
                    }, () => {
                        setState(s => ({ ...s, isLoading: true, loadingMsg: 'waiting for authorization...' }));
                    });
                    setLoading(false);
                    if (result.success) {
                        addOutput([
                            `  [+] signed in${result.username ? ` as ${result.username}` : ''}`,
                            '  [+] token stored in system keychain',
                            '',
                        ], 'green');
                    }
                    else {
                        addOutput(`  [-] login failed: ${result.error}`, 'red');
                    }
                }
                catch (err) {
                    setLoading(false);
                    addOutput(`  [-] login error: ${err.message}`, 'red');
                }
                setState(s => ({ ...s, view: 'home' }));
                return;
            }
            case '/logout': {
                try {
                    await logout();
                    addOutput('  [+] signed out', 'green');
                }
                catch (err) {
                    addOutput(`  [-] logout error: ${err.message}`, 'red');
                }
                return;
            }
            case '/update': {
                setLoading(true, 'checking for updates...');
                try {
                    const info = await checkForUpdates();
                    setLoading(false);
                    if (info.hasUpdate) {
                        addOutput([
                            `  update available: v${info.currentVersion} -> v${info.latestVersion}`,
                            '  run: npm install -g @opencern/cli',
                            '',
                            '  pulling latest Docker images...',
                        ], 'cyan');
                        setLoading(true, 'pulling Docker images...');
                        await updateDockerImages(img => {
                            setState(s => ({ ...s, loadingMsg: `pulling ${img}...` }));
                        });
                        setLoading(false);
                        addOutput('  [+] Docker images updated', 'green');
                    }
                    else {
                        addOutput(`  [+] already up to date (v${info.currentVersion})`, 'green');
                    }
                }
                catch (err) {
                    setLoading(false);
                    addOutput(`  [-] update error: ${err.message}`, 'red');
                }
                return;
            }
            // ─── Profile ───────────────────────────────────────────
            case '/profile': {
                if (args[0] === 'set' && args.length >= 3) {
                    const result = setProfileField(args[1], args.slice(2).join(' '));
                    addOutput(`  ${result.success ? '[+]' : '[-]'} ${result.message}`, result.success ? 'green' : 'red');
                    return;
                }
                if (args[0] === 'export') {
                    addOutput(['', exportProfile(), '']);
                    return;
                }
                addOutput(formatProfile());
                return;
            }
            case '/whoami': {
                addOutput(whoami());
                return;
            }
            // ─── File Operations ───────────────────────────────────
            case '/open': {
                const fileArg = argStr.replace('--json', '').replace('--root', '').trim();
                if (!fileArg) {
                    addOutput('  usage: /open <file.json|file.root>', 'yellow');
                    return;
                }
                setLoading(true, `opening ${fileArg}...`);
                try {
                    const fileContent = await openFile(fileArg);
                    setLoading(false);
                    setState(s => ({ ...s, view: 'open', fileContent }));
                }
                catch (err) {
                    setLoading(false);
                    addOutput(`  [-] ${err.message}`, 'red');
                }
                return;
            }
            case '/opask': {
                const fileArg = argStr.trim();
                if (!fileArg) {
                    addOutput('  usage: /opask <file.json>', 'yellow');
                    return;
                }
                setState(s => ({ ...s, view: 'opask', aiTokens: '', aiStreaming: true }));
                abortRef.current = new AbortController();
                try {
                    const { file, totalTokens } = await openAndAsk(fileArg, token => setState(s => ({ ...s, aiTokens: s.aiTokens + token })), abortRef.current.signal);
                    setState(s => ({
                        ...s,
                        fileContent: file,
                        aiStreaming: false,
                        aiTokenCount: totalTokens,
                        promptDisabled: false,
                    }));
                }
                catch (err) {
                    setState(s => ({ ...s, aiStreaming: false, promptDisabled: false }));
                    addOutput(`  [-] ${err.message}`, 'red');
                }
                return;
            }
            case '/cat': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                if (!fileArg) {
                    addOutput('  usage: /cat <file>', 'yellow');
                    return;
                }
                addOutput(catFile(fileArg));
                return;
            }
            case '/tree': {
                addOutput(renderTree(argStr || undefined));
                return;
            }
            case '/grep': {
                if (args.length < 2) {
                    addOutput('  usage: /grep <pattern> <file>', 'yellow');
                    return;
                }
                addOutput(grepFile(args[0], args[1]));
                return;
            }
            case '/find': {
                if (!argStr) {
                    addOutput('  usage: /find <pattern>', 'yellow');
                    return;
                }
                addOutput(findFiles(argStr));
                return;
            }
            case '/diff': {
                if (args.length < 2) {
                    addOutput('  usage: /diff <file1> <file2>', 'yellow');
                    return;
                }
                addOutput(diffFiles(args[0], args[1]));
                return;
            }
            case '/clean': {
                const confirm = args.includes('--confirm');
                addOutput(cleanFiles(!confirm));
                return;
            }
            case '/disk': {
                addOutput(diskUsage());
                return;
            }
            case '/cache': {
                const clear = args[0] === 'clear';
                addOutput(cacheInfo(clear));
                return;
            }
            // ─── Data Commands ─────────────────────────────────────
            case '/datasets': {
                const datasets = listLocalDatasets();
                addOutput(formatDatasetList(datasets));
                return;
            }
            case '/stats': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                if (!fileArg) {
                    addOutput('  usage: /stats <file>', 'yellow');
                    return;
                }
                addOutput(getDatasetStats(fileArg));
                return;
            }
            case '/histogram': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const field = flags['field'] || 'pt';
                if (!fileArg) {
                    addOutput('  usage: /histogram <file> --field=pt', 'yellow');
                    return;
                }
                addOutput(renderHistogram(fileArg, field));
                return;
            }
            case '/scatter': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const xField = flags['x'] || 'pt';
                const yField = flags['y'] || 'eta';
                if (!fileArg) {
                    addOutput('  usage: /scatter <file> --x=pt --y=eta', 'yellow');
                    return;
                }
                addOutput(renderScatterPlot(fileArg, xField, yField));
                return;
            }
            case '/head': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const n = flags['n'] ? parseInt(flags['n']) : 10;
                if (!fileArg) {
                    addOutput('  usage: /head <file> --n=10', 'yellow');
                    return;
                }
                addOutput(headEvents(fileArg, n));
                return;
            }
            case '/tail': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const n = flags['n'] ? parseInt(flags['n']) : 10;
                if (!fileArg) {
                    addOutput('  usage: /tail <file> --n=10', 'yellow');
                    return;
                }
                addOutput(tailEvents(fileArg, n));
                return;
            }
            case '/describe': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                if (!fileArg) {
                    addOutput('  usage: /describe <file>', 'yellow');
                    return;
                }
                addOutput(describeDataset(fileArg));
                return;
            }
            case '/filter': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                if (!fileArg) {
                    addOutput('  usage: /filter <file> --pt>40 --type=muon', 'yellow');
                    return;
                }
                // Build filter map from flags like --pt>40 --type=muon
                const filterMap = {};
                for (const arg of args.slice(1)) {
                    const m = arg.match(/^--(\w+)(.+)$/);
                    if (m)
                        filterMap[m[1]] = m[2].startsWith('=') ? m[2] : m[2];
                }
                addOutput(filterEvents(fileArg, filterMap));
                return;
            }
            case '/sample': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const n = flags['n'] ? parseInt(flags['n']) : 1000;
                if (!fileArg) {
                    addOutput('  usage: /sample <file> --n=1000', 'yellow');
                    return;
                }
                addOutput(sampleEvents(fileArg, n));
                return;
            }
            case '/correlate': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                if (!fileArg) {
                    addOutput('  usage: /correlate <file>', 'yellow');
                    return;
                }
                addOutput(correlateFields(fileArg));
                return;
            }
            case '/export': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const format = flags['format'] || 'csv';
                if (!fileArg) {
                    addOutput('  usage: /export <file> --format=csv', 'yellow');
                    return;
                }
                addOutput(exportDataset(fileArg, format));
                return;
            }
            case '/merge': {
                if (args.length < 2) {
                    addOutput('  usage: /merge <file1> <file2>', 'yellow');
                    return;
                }
                addOutput(mergeDatasets(args[0], args[1]));
                return;
            }
            case '/search': {
                const query = argStr.trim();
                if (!query) {
                    addOutput('  usage: /search <query>', 'yellow');
                    return;
                }
                await withApiCheck(async () => {
                    setLoading(true, `searching "${query}"...`);
                    try {
                        const { searchDatasets } = await import('./commands/download.js');
                        const datasets = await searchDatasets(query);
                        setLoading(false);
                        if (datasets.length === 0) {
                            addOutput(`  No results for "${query}"`);
                        }
                        else {
                            addOutput([
                                '',
                                `  Search results for "${query}": ${datasets.length} dataset(s)`,
                                '  ────────────────────────────────────────',
                                ...datasets.slice(0, 15).map(d => `  ${d.id.padEnd(12)} | ${(d.size / 1e9).toFixed(1).padStart(5)} GB | ${d.title}`),
                                ...(datasets.length > 15 ? [`  ... and ${datasets.length - 15} more`] : []),
                                '',
                            ]);
                        }
                    }
                    catch (err) {
                        setLoading(false);
                        addOutput(`  [-] ${err.message}`, 'red');
                    }
                });
                return;
            }
            // ─── Container Commands ────────────────────────────────
            case '/logs': {
                const service = args[0];
                addOutput(getLogs(service));
                return;
            }
            case '/restart': {
                const service = args[0];
                const result = await restartService(service);
                addOutput(result);
                return;
            }
            case '/stop': {
                const result = await stopAll();
                addOutput(result);
                return;
            }
            case '/pull': {
                setLoading(true, 'pulling latest images...');
                try {
                    await docker.pullImages();
                    setLoading(false);
                    addOutput('  [+] All images pulled to latest', 'green');
                }
                catch (err) {
                    setLoading(false);
                    addOutput(`  [-] ${err.message}`, 'red');
                }
                return;
            }
            case '/top': {
                addOutput(containerTop());
                return;
            }
            case '/network': {
                addOutput(networkInfo());
                return;
            }
            case '/health': {
                setLoading(true, 'checking health...');
                const result = await quickHealth();
                setLoading(false);
                addOutput(result);
                return;
            }
            // ─── Session Commands ──────────────────────────────────
            case '/sessions': {
                addOutput(listSessions());
                return;
            }
            case '/save': {
                const name = args[0];
                if (!name) {
                    addOutput('  usage: /save <name>', 'yellow');
                    return;
                }
                addOutput(saveSession(name, state.output));
                return;
            }
            case '/load': {
                const name = args[0];
                if (!name) {
                    addOutput('  usage: /load <name>', 'yellow');
                    return;
                }
                const session = loadSession(name);
                if (!session) {
                    addOutput(`  [-] Session "${name}" not found`);
                }
                else {
                    addOutput(session.lines);
                    session.output.forEach(line => addOutput(line, 'gray'));
                }
                return;
            }
            case '/recall': {
                addOutput(getRecall());
                return;
            }
            case '/alias': {
                if (args.length === 0) {
                    addOutput(listAliases());
                    return;
                }
                if (args.length >= 2) {
                    addOutput(setAlias(args[0], args.slice(1).join(' ')));
                    return;
                }
                addOutput('  usage: /alias <name> <command>', 'yellow');
                return;
            }
            case '/script': {
                const file = args[0];
                if (!file) {
                    addOutput('  usage: /script <file>', 'yellow');
                    return;
                }
                const commands = loadScript(file);
                if (!commands) {
                    addOutput(`  [-] Could not load script: ${file}`, 'red');
                    return;
                }
                addOutput(`  Running ${commands.length} commands from ${file}...`, 'gray');
                for (const command of commands) {
                    addOutput(`  > ${command}`, 'gray');
                    await handleInput(command);
                }
                addOutput('  [+] Script complete', 'green');
                return;
            }
            case '/set': {
                if (args.length < 2) {
                    addOutput('  usage: /set <key> <value>', 'yellow');
                    return;
                }
                addOutput(quickSet(args[0], args.slice(1).join(' ')));
                return;
            }
            case '/get': {
                if (!args[0]) {
                    addOutput('  usage: /get <key>', 'yellow');
                    return;
                }
                addOutput(quickGet(args[0]));
                return;
            }
            // ─── System Info ───────────────────────────────────────
            case '/env': {
                addOutput(envInfo());
                return;
            }
            case '/version': {
                addOutput(versionInfo());
                return;
            }
            case '/about': {
                addOutput(aboutInfo());
                return;
            }
            // ─── AI ────────────────────────────────────────────────
            case '/ask': {
                const question = argStr || 'What can you tell me about this dataset?';
                const fileIdx = args.indexOf('--file');
                const filePath = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
                const cleanQuestion = question.replace('--file', '').replace(filePath || '', '').trim();
                await runAgenticQuery(cleanQuestion || question);
                return;
            }
            // ─── Quantum ──────────────────────────────────────────
            case '/quantum': {
                const subCmd = args[0];
                const fileArg = args.find(a => !a.startsWith('-')) || args[1];
                if (subCmd === 'status') {
                    setLoading(true, 'checking quantum backend...');
                    const qStatus = await quantumService.getStatus();
                    setLoading(false);
                    addOutput([
                        '',
                        `  quantum backend: ${qStatus.backend}`,
                        `  status: ${qStatus.healthy ? 'healthy' : 'offline'}`,
                        '',
                    ], qStatus.healthy ? 'green' : 'yellow');
                    return;
                }
                const targetFile = fileArg || '';
                if (!targetFile) {
                    addOutput('  usage: /quantum classify <file.json>', 'yellow');
                    return;
                }
                setState(s => ({ ...s, view: 'quantum', quantumRunning: true, quantumJob: undefined }));
                setLoading(true, 'checking quantum container...');
                const qReady = await ensureQuantumRunning();
                if (!qReady) {
                    setLoading(false);
                    setState(s => ({ ...s, quantumRunning: false }));
                    addOutput('  [-] quantum container not available. ensure Docker is running.', 'red');
                    return;
                }
                try {
                    const events = extractEvents(targetFile);
                    addOutput(`  extracted ${events.length} events from ${targetFile}`, 'gray');
                    const circuit = await quantumService.getCircuitDiagram(4, 6);
                    setState(s => ({ ...s, quantumCircuit: circuit, quantumBackend: config.get('quantumBackend') }));
                    setLoading(false);
                    const finalJob = await runClassification(events, job => {
                        setState(s => ({ ...s, quantumJob: job }));
                    });
                    setState(s => ({ ...s, quantumRunning: false, quantumJob: finalJob }));
                    if (finalJob.results) {
                        addOutput([
                            '',
                            `  quantum classification complete`,
                            `  signal events: ${finalJob.results.signalCount} (${(finalJob.results.signalProbability * 100).toFixed(1)}%)`,
                            `  background: ${finalJob.results.backgroundCount}`,
                            `  fidelity: ${finalJob.results.fidelity.toFixed(3)}`,
                            '',
                        ], 'green');
                    }
                }
                catch (err) {
                    setLoading(false);
                    setState(s => ({ ...s, quantumRunning: false }));
                    addOutput(`  [-] ${err.message}`, 'red');
                }
                return;
            }
            // ─── Viz ───────────────────────────────────────────────
            case '/viz': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const forceBrowser = args.includes('--browser');
                if (!fileArg) {
                    addOutput('  usage: /viz <file.json>', 'yellow');
                    return;
                }
                const result = openViz(fileArg, forceBrowser);
                addOutput(`  ${result.message}`, result.method === 'ascii' ? 'yellow' : 'green');
                if (result.method === 'ascii') {
                    addOutput(renderASCII(fileArg));
                }
                return;
            }
            // ─── Sim ───────────────────────────────────────────────
            case '/sim': {
                if (args.includes('--build')) {
                    setLoading(true, 'building collision viewer...');
                    const result = buildSim((line) => {
                        setState(s => ({ ...s, loadingMsg: line }));
                    });
                    setLoading(false);
                    addOutput(`  ${result.success ? '[+]' : '[-]'} ${result.message}`, result.success ? 'green' : 'red');
                    return;
                }
                if (args.includes('--status') || !argStr.trim()) {
                    addOutput(getSimStatus());
                    return;
                }
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                const eventNum = flags['event'] ? parseInt(flags['event']) : undefined;
                const result = launchSim(fileArg, eventNum);
                addOutput(`  ${result.success ? '[+]' : '[-]'} ${result.message}`, result.success ? 'green' : 'red');
                return;
            }
            // ─── Download (with API check) ────────────────────────
            case '/download': {
                const query = argStr.trim();
                if (!query) {
                    await withApiCheck(async () => {
                        setLoading(true, 'fetching available datasets...');
                        try {
                            const { searchDatasets } = await import('./commands/download.js');
                            const datasets = await searchDatasets('');
                            setLoading(false);
                            if (datasets.length === 0) {
                                addOutput('  [-] no datasets available');
                                return;
                            }
                            addOutput([
                                '',
                                '  Available Datasets',
                                '  ────────────────────────────────────────',
                                ...datasets.slice(0, 10).map(d => `  ${d.id.padEnd(12)} | ${(d.size / 1e9).toFixed(1).padStart(5)} GB | ${d.title}`),
                                ...(datasets.length > 10 ? [`  ... and ${datasets.length - 10} more`] : []),
                                '',
                                '  usage: /download <dataset_id> or <name>',
                                '',
                            ]);
                        }
                        catch (err) {
                            setLoading(false);
                            addOutput(`  [-] ${err.message}`, 'red');
                        }
                    });
                    return;
                }
                await withApiCheck(async () => {
                    setLoading(true, `searching datasets for "${query}"...`);
                    try {
                        const { searchDatasets, startDownload, pollDownload } = await import('./commands/download.js');
                        const datasets = await searchDatasets(query);
                        if (datasets.length === 0) {
                            setLoading(false);
                            addOutput(`  [-] no datasets found matching "${query}"`);
                            return;
                        }
                        const target = datasets.find(d => d.id === query || d.title.toLowerCase() === query.toLowerCase()) || datasets[0];
                        setLoading(true, `starting download for ${target.title}...`);
                        const dlId = await startDownload(target);
                        await pollDownload(dlId, (dlStatus) => {
                            setState(s => ({ ...s, loadingMsg: `downloading ${target.id}: ${dlStatus.progress.toFixed(0)}%` }));
                        });
                        setLoading(false);
                        addOutput([
                            '',
                            `  [+] Download complete: ${target.id}`,
                            `  Title: ${target.title}`,
                            `  Size:  ${(target.size / 1e9).toFixed(2)} GB`,
                            '',
                        ], 'green');
                    }
                    catch (err) {
                        setLoading(false);
                        addOutput(`  [-] ${err.message}`, 'red');
                    }
                });
                return;
            }
            // ─── Process (with API check) ─────────────────────────
            case '/process': {
                const fileArg = argStr.trim();
                if (!fileArg) {
                    addOutput('  usage: /process <file.root>');
                    return;
                }
                await withApiCheck(async () => {
                    setLoading(true, `processing ${fileArg}...`);
                    try {
                        const { processFile, pollProcess, formatEventSummary } = await import('./commands/process.js');
                        const procId = await processFile(fileArg);
                        const finalStatus = await pollProcess(procId, (pStatus) => {
                            const pct = pStatus.progress != null ? `${pStatus.progress.toFixed(0)}%` : pStatus.status;
                            setState(s => ({ ...s, loadingMsg: `processing... ${pct}` }));
                        });
                        setLoading(false);
                        addOutput([
                            '',
                            `  [+] Processing complete: ${fileArg}`,
                            ...formatEventSummary(finalStatus.results),
                            '',
                        ]);
                    }
                    catch (err) {
                        setLoading(false);
                        addOutput(`  [-] ${err.message}`, 'red');
                    }
                });
                return;
            }
            // ─── Analysis Placeholder Commands ─────────────────────
            case '/plot':
            case '/fit':
            case '/classify':
            case '/anomaly':
            case '/compare': {
                const fileArg = args.find(a => !a.startsWith('-')) || '';
                if (!fileArg) {
                    addOutput(`  usage: ${cmd} <file> [options]`, 'yellow');
                    return;
                }
                // Delegate to AI for analysis
                const analysisPrompt = `Run ${cmd} analysis on the file ${fileArg}. ${argStr}`;
                await runAgenticQuery(analysisPrompt);
                return;
            }
            case '/import':
            case '/select':
            case '/watch':
            case '/macro': {
                addOutput(`  ${cmd} is not yet implemented. Coming soon.`, 'yellow');
                return;
            }
            // ─── Default: free-form question → agentic AI ─────────
            default: {
                if (!input.startsWith('/')) {
                    await runAgenticQuery(input);
                    return;
                }
                addOutput(`  unknown command: ${cmd}. type /help for available commands.`, 'yellow');
                return;
            }
        }
    }
    const { output, isLoading, loadingMsg, view, aiTokens, aiStreaming, aiTokenCount, aiLatency, pendingTool, toolResults, fileContent, progress, quantumJob, quantumRunning, quantumBackend, quantumCircuit, promptDisabled, showShortcuts } = state;
    const model = config.get('defaultModel');
    // Stable reference for the prompt
    const handleInputRef = useRef(handleInput);
    handleInputRef.current = handleInput;
    const stableHandleInput = useCallback((raw) => {
        handleInputRef.current(raw);
    }, []);
    // Memoize separator to avoid re-creating string each render
    const separator = useMemo(() => '─'.repeat(Math.max(10, size.columns - 4)), [size.columns]);
    return (_jsxs(_Fragment, { children: [_jsx(Static, { items: output, children: (line) => (_jsx(Text, { color: line.color || 'white', bold: line.bold, children: line.text }, line.id)) }), _jsxs(Box, { flexDirection: "column", paddingX: 1, children: [_jsx(Toast, { messages: toastMessages, onDismiss: dismissToast }), showShortcuts && (_jsx(KeyboardShortcuts, { onClose: () => setState(s => ({ ...s, showShortcuts: false })) })), (view === 'ask' || view === 'opask') && (aiTokens || aiStreaming || pendingTool) && (_jsxs(Box, { flexDirection: view === 'opask' ? 'row' : 'column', paddingX: 1, children: [_jsx(Box, { flexDirection: "column", flexGrow: 1, children: _jsx(AIStream, { tokens: aiTokens, isStreaming: aiStreaming, onCancel: () => { abortRef.current?.abort(); setState(s => ({ ...s, aiStreaming: false })); }, model: model, tokenCount: aiTokenCount, latency: aiLatency, pendingTool: pendingTool, toolResults: toolResults, onApprove: handleApprove, onDeny: handleDeny }) }), view === 'opask' && fileContent && (_jsx(Box, { flexDirection: "column", flexGrow: 1, marginLeft: 2, children: _jsx(FilePreview, { content: fileContent.content, filename: fileContent.filename, size: fileContent.size, fileType: fileContent.fileType, focused: false }) }))] })), view === 'open' && fileContent && (_jsx(Box, { paddingX: 1, children: _jsx(FilePreview, { content: fileContent.content, filename: fileContent.filename, size: fileContent.size, fileType: fileContent.fileType, onClose: () => setState(s => ({ ...s, view: 'home', fileContent: undefined })) }) })), view === 'quantum' && (_jsx(Box, { paddingX: 1, children: _jsx(QuantumPanel, { job: quantumJob, isRunning: quantumRunning, backend: quantumBackend, circuitDiagram: quantumCircuit }) })), progress && (_jsx(Box, { paddingX: 1, children: _jsx(ProgressBar, { label: progress.label, percent: progress.percent, speed: progress.speed, eta: progress.eta, mode: progress.mode }) })), isLoading && (_jsx(Box, { paddingX: 1, children: _jsx(InlineSpinner, { label: loadingMsg }) })), _jsx(StatusBar, {}), _jsx(Text, { dimColor: true, children: separator }), _jsx(Box, { paddingX: 1, children: _jsx(Prompt, { onSubmit: stableHandleInput, disabled: promptDisabled, placeholder: promptDisabled ? (pendingTool ? 'Enter to approve, Esc to skip' : 'Processing... (Esc to cancel)') : undefined }) })] })] }));
}
export async function startApp() {
    const { waitUntilExit } = render(_jsx(App, {}), { exitOnCtrlC: false });
    await waitUntilExit();
}
export default App;
//# sourceMappingURL=app.js.map