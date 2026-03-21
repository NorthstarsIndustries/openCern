export declare function whoami(): string[];
export interface SavedSession {
    name: string;
    timestamp: string;
    outputCount: number;
    model: string;
}
export declare function listSessions(): string[];
export declare function saveSession(name: string, output: {
    text: string;
}[]): string[];
export declare function loadSession(name: string): {
    lines: string[];
    output: string[];
} | null;
export declare function saveRecall(label: string, data: unknown): void;
export declare function getRecall(): string[];
export declare function setAlias(name: string, command: string): string[];
export declare function resolveAlias(input: string): string;
export declare function listAliases(): string[];
export declare function loadScript(filePath: string): string[] | null;
export declare function quickGet(key: string): string[];
export declare function quickSet(key: string, value: string): string[];
//# sourceMappingURL=session.d.ts.map