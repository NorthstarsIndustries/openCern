import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { docker } from '../services/docker.js';
import { config } from '../utils/config.js';
import { isAuthenticated } from '../utils/auth.js';
import { getKey } from '../utils/keystore.js';
function StatusBarComponent() {
    const [status, setStatus] = useState({
        dockerRunning: false,
        apiReady: false,
        quantumReady: false,
        authStatus: false,
        checking: true,
    });
    const pollIntervalRef = useRef(5000);
    const failCountRef = useRef(0);
    const checkStatus = async () => {
        const dockerRunning = docker.isDockerRunning();
        const apiReady = dockerRunning ? await docker.isApiReady() : false;
        const quantumReady = dockerRunning ? await docker.isQuantumReady() : false;
        const authStatus = isAuthenticated();
        // Exponential backoff: if nothing changes and services are stable
        if (dockerRunning && apiReady) {
            failCountRef.current = 0;
            pollIntervalRef.current = Math.min(pollIntervalRef.current * 1.2, 30000);
        }
        else {
            failCountRef.current++;
            pollIntervalRef.current = 5000; // Poll faster when things are down
        }
        setStatus({ dockerRunning, apiReady, quantumReady, authStatus, checking: false });
    };
    useEffect(() => {
        checkStatus();
        let timer;
        const poll = () => {
            timer = setTimeout(async () => {
                await checkStatus();
                poll();
            }, pollIntervalRef.current);
        };
        poll();
        return () => clearTimeout(timer);
    }, []);
    const model = config.get('defaultModel');
    const shortModel = model.replace('claude-', '').replace(/-\d{8}$/, '');
    const username = getKey('opencern-username');
    const di = status.checking ? '~' : status.dockerRunning ? '+' : '-';
    const ai = status.checking ? '~' : status.apiReady ? '+' : '-';
    const qi = status.checking ? '~' : status.quantumReady ? '+' : '-';
    return (_jsx(Box, { flexDirection: "row", paddingX: 1, children: _jsxs(Text, { dimColor: true, children: ["opencern v1.0.0-beta.1", ' | ', "docker [", di, "]", ' | ', "api [", ai, "]", ' | ', "qc [", qi, "]", ' | ', "model: ", shortModel, username ? ` | user: ${username}` : ''] }) }));
}
export const StatusBar = React.memo(StatusBarComponent);
export default StatusBar;
//# sourceMappingURL=StatusBar.js.map