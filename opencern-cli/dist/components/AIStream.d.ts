import React from 'react';
import type { ToolCall, ToolResult } from '../services/anthropic.js';
interface AIStreamProps {
    tokens: string;
    isStreaming: boolean;
    onCancel?: () => void;
    model?: string;
    tokenCount?: number;
    latency?: number;
    pendingTool?: ToolCall | null;
    toolResults?: ToolResult[];
    onApprove?: () => void;
    onDeny?: () => void;
    thinkingText?: string;
}
export declare function AIStream({ tokens, isStreaming, onCancel, model, tokenCount, latency, pendingTool, toolResults, onApprove, onDeny, thinkingText, }: AIStreamProps): React.JSX.Element;
declare const _default: React.MemoExoticComponent<typeof AIStream>;
export default _default;
//# sourceMappingURL=AIStream.d.ts.map