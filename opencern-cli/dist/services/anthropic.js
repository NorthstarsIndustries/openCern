/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getKey } from '../utils/keystore.js';
import { config } from '../utils/config.js';
import { execute, estimateResources } from './executor.js';
import { buildSystemPrompt as buildCernPrompt } from './aiSystemPrompt.js';
// ─── Tool Definitions ────────────────────────────────────────────────
const TOOLS = [
    {
        name: 'execute_python',
        description: 'Execute Python code for data analysis, visualization, or computation. Has access to numpy, pandas, matplotlib, scipy. Generated plots are captured automatically.',
        input_schema: {
            type: 'object',
            properties: {
                code: {
                    type: 'string',
                    description: 'Python code to execute',
                },
                timeout: {
                    type: 'number',
                    description: 'Execution timeout in milliseconds (default: 60000)',
                },
            },
            required: ['code'],
        },
    },
    {
        name: 'execute_bash',
        description: 'Execute a bash command. Restricted to safe operations — destructive commands are blocked.',
        input_schema: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'Bash command to execute',
                },
                timeout: {
                    type: 'number',
                    description: 'Execution timeout in milliseconds (default: 30000)',
                },
            },
            required: ['command'],
        },
    },
    {
        name: 'opencern_cli',
        description: 'Run an OpenCERN CLI command (e.g., download, process, status). Use this to interact with CERN data services programmatically.',
        input_schema: {
            type: 'object',
            properties: {
                args: {
                    type: 'string',
                    description: 'CLI arguments (e.g., "download cms 2016", "process --file data.root")',
                },
            },
            required: ['args'],
        },
    },
];
// ─── State ───────────────────────────────────────────────────────────
let _client = null;
let _history = [];
let _context = {};
let _usage = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    messageCount: 0,
    toolCalls: 0,
    sessionStart: Date.now(),
};
// ─── System Prompt (uses comprehensive CERN-AI prompt) ───────────
// ─── Client Management ───────────────────────────────────────────────
function getClient() {
    if (!_client) {
        const apiKey = getKey('anthropic');
        if (!apiKey) {
            throw new Error('Anthropic API key not configured. Run /config to set it up.');
        }
        _client = new Anthropic({ apiKey });
    }
    return _client;
}
function buildSystemPrompt() {
    const sessionCtx = {};
    if (_context.experiment)
        sessionCtx.experiment = _context.experiment;
    if (_context.downloadedDatasets?.length)
        sessionCtx.downloadedDatasets = _context.downloadedDatasets;
    if (_context.processedFiles?.length)
        sessionCtx.processedFiles = _context.processedFiles;
    if (_context.lastResults)
        sessionCtx.lastResults = _context.lastResults;
    return buildCernPrompt(sessionCtx);
}
// ─── Tool Execution ──────────────────────────────────────────────────
export async function executeToolCall(toolCall) {
    let result;
    switch (toolCall.name) {
        case 'execute_python':
            result = await execute({
                type: 'python',
                code: toolCall.input.code,
                timeout: toolCall.input.timeout || 60000,
            });
            break;
        case 'execute_bash':
            result = await execute({
                type: 'bash',
                code: toolCall.input.command,
                timeout: toolCall.input.timeout || 30000,
            });
            break;
        case 'opencern_cli':
            result = await execute({
                type: 'opencern',
                code: toolCall.input.args,
                timeout: toolCall.input.timeout || 30000,
            });
            break;
        default:
            return {
                toolUseId: toolCall.id,
                success: false,
                output: `Unknown tool: ${toolCall.name}`,
            };
    }
    _usage.toolCalls++;
    let output = '';
    if (result.stdout)
        output += result.stdout;
    if (result.stderr)
        output += (output ? '\n' : '') + result.stderr;
    if (!output)
        output = result.success ? '(no output)' : '(execution failed)';
    return {
        toolUseId: toolCall.id,
        success: result.success,
        output: output.slice(0, 8000),
        images: result.images,
        duration: result.duration,
    };
}
function formatToolCallDisplay(toolCall) {
    switch (toolCall.name) {
        case 'execute_python':
            return toolCall.input.code;
        case 'execute_bash':
            return toolCall.input.command;
        case 'opencern_cli':
            return `opencern ${toolCall.input.args}`;
        default:
            return JSON.stringify(toolCall.input);
    }
}
// ─── Agentic Streaming ──────────────────────────────────────────────
export const anthropicService = {
    initClient(apiKey) {
        _client = new Anthropic({ apiKey });
    },
    /**
     * Simple streaming (no tool use) — for basic /ask queries
     */
    async streamMessage(userMessage, onToken, signal) {
        const client = getClient();
        const model = config.get('defaultModel');
        _history.push({ role: 'user', content: userMessage });
        const messages = _history.map(m => ({
            role: m.role,
            content: m.content,
        }));
        let fullResponse = '';
        const stream = await client.messages.stream({
            model,
            max_tokens: 4096,
            system: buildSystemPrompt(),
            messages,
        });
        for await (const chunk of stream) {
            if (signal?.aborted) {
                stream.controller.abort();
                break;
            }
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                onToken(chunk.delta.text);
                fullResponse += chunk.delta.text;
            }
        }
        const finalMessage = await stream.finalMessage();
        const tokens = finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
        _usage.totalInputTokens += finalMessage.usage.input_tokens;
        _usage.totalOutputTokens += finalMessage.usage.output_tokens;
        _usage.totalTokens += tokens;
        _usage.messageCount++;
        _history.push({ role: 'assistant', content: fullResponse });
        return { totalTokens: tokens };
    },
    /**
     * Agentic streaming — supports tool use with human-in-the-loop approval.
     * Emits events for the TUI to render: text, thinking, tool_call, tool_result, done.
     *
     * The caller provides an `onApproval` callback that presents the tool call to
     * the user and returns true (approved) or false (denied).
     */
    async agenticStream(userMessage, onEvent, onApproval, signal, maxIterations = 10) {
        const client = getClient();
        const model = config.get('defaultModel');
        _history.push({ role: 'user', content: userMessage });
        let iterations = 0;
        while (iterations < maxIterations) {
            iterations++;
            if (signal?.aborted) {
                onEvent({ type: 'done' });
                return;
            }
            const messages = _history.map(m => ({
                role: m.role,
                content: m.content,
            }));
            const stream = await client.messages.stream({
                model,
                max_tokens: 4096,
                system: buildSystemPrompt(),
                messages,
                tools: TOOLS,
            });
            let textContent = '';
            const toolCalls = [];
            let currentToolName = '';
            let currentToolId = '';
            let currentToolInput = '';
            for await (const chunk of stream) {
                if (signal?.aborted) {
                    stream.controller.abort();
                    onEvent({ type: 'done' });
                    return;
                }
                if (chunk.type === 'content_block_start') {
                    if (chunk.content_block.type === 'tool_use') {
                        currentToolName = chunk.content_block.name;
                        currentToolId = chunk.content_block.id;
                        currentToolInput = '';
                    }
                }
                if (chunk.type === 'content_block_delta') {
                    if (chunk.delta.type === 'text_delta') {
                        onEvent({ type: 'text', text: chunk.delta.text });
                        textContent += chunk.delta.text;
                    }
                    if (chunk.delta.type === 'input_json_delta') {
                        currentToolInput += chunk.delta.partial_json;
                    }
                }
                if (chunk.type === 'content_block_stop' && currentToolName) {
                    let input = {};
                    try {
                        input = JSON.parse(currentToolInput);
                    }
                    catch { /* empty input */ }
                    const toolCall = {
                        id: currentToolId,
                        name: currentToolName,
                        input,
                        displayCode: formatToolCallDisplay({ id: currentToolId, name: currentToolName, input }),
                    };
                    // Resource estimation for Python
                    if (currentToolName === 'execute_python') {
                        const est = estimateResources(input.code);
                        if (est.warning)
                            toolCall.resourceWarning = est.warning;
                    }
                    toolCalls.push(toolCall);
                    currentToolName = '';
                    currentToolId = '';
                    currentToolInput = '';
                }
            }
            const finalMessage = await stream.finalMessage();
            _usage.totalInputTokens += finalMessage.usage.input_tokens;
            _usage.totalOutputTokens += finalMessage.usage.output_tokens;
            _usage.totalTokens += finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
            _usage.messageCount++;
            // Save assistant response to history
            _history.push({ role: 'assistant', content: finalMessage.content });
            // No tool calls — we're done
            if (toolCalls.length === 0 || finalMessage.stop_reason !== 'tool_use') {
                onEvent({ type: 'done', totalTokens: _usage.totalTokens });
                return;
            }
            // Process tool calls with human-in-the-loop
            const toolResults = [];
            for (const toolCall of toolCalls) {
                onEvent({ type: 'tool_call', toolCall });
                const approved = await onApproval(toolCall);
                if (!approved) {
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: toolCall.id,
                        content: 'User denied this tool execution.',
                    });
                    onEvent({
                        type: 'tool_result',
                        toolResult: {
                            toolUseId: toolCall.id,
                            success: false,
                            output: 'Denied by user',
                        },
                    });
                    continue;
                }
                const result = await executeToolCall(toolCall);
                onEvent({ type: 'tool_result', toolResult: result });
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: result.output,
                });
            }
            // Feed results back to continue the loop
            _history.push({
                role: 'user',
                content: toolResults,
            });
        }
        onEvent({ type: 'error', error: 'Max iterations reached' });
        onEvent({ type: 'done' });
    },
    // ─── Model Management ──────────────────────────────────────────────
    async listModels() {
        const client = getClient();
        try {
            const response = await client.models.list({ limit: 100 });
            const models = [];
            for await (const model of response) {
                if (model.id.startsWith('claude-')) {
                    models.push({
                        id: model.id,
                        displayName: model.display_name || model.id,
                        maxTokens: 4096,
                    });
                }
            }
            // Sort: latest first
            models.sort((a, b) => b.id.localeCompare(a.id));
            return models;
        }
        catch {
            // Fallback to known models
            return [
                { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', maxTokens: 8192 },
                { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', maxTokens: 8192 },
                { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', maxTokens: 8192 },
                { id: 'claude-sonnet-4-5-20250514', displayName: 'Claude Sonnet 4.5', maxTokens: 8192 },
            ];
        }
    },
    // ─── Context & State ────────────────────────────────────────────────
    addContext(ctx) {
        _context = { ..._context, ...ctx };
    },
    getContext() {
        return _context;
    },
    getUsage() {
        return { ..._usage };
    },
    getUsageFormatted() {
        const uptime = Math.floor((Date.now() - _usage.sessionStart) / 1000);
        const mins = Math.floor(uptime / 60);
        const secs = uptime % 60;
        return [
            '',
            '  Session Usage',
            '  ────────────────────────────────────────',
            `  Input tokens      ${_usage.totalInputTokens.toLocaleString()}`,
            `  Output tokens     ${_usage.totalOutputTokens.toLocaleString()}`,
            `  Total tokens      ${_usage.totalTokens.toLocaleString()}`,
            `  Messages          ${_usage.messageCount}`,
            `  Tool executions   ${_usage.toolCalls}`,
            `  Session uptime    ${mins}m ${secs}s`,
            `  Model             ${config.get('defaultModel')}`,
            '',
        ];
    },
    clearHistory() {
        _history = [];
        _usage = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            messageCount: 0,
            toolCalls: 0,
            sessionStart: Date.now(),
        };
    },
    getHistory() {
        return _history;
    },
};
export default anthropicService;
//# sourceMappingURL=anthropic.js.map