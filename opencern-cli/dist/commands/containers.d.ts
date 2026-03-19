export declare function getLogs(service?: string, tail?: number): string[];
export declare function restartService(service?: string): Promise<string[]>;
export declare function stopAll(): Promise<string[]>;
export declare function pullImages(onProgress: (image: string) => void): Promise<string[]>;
export declare function containerTop(): string[];
export declare function networkInfo(): string[];
export declare function quickHealth(): Promise<string[]>;
//# sourceMappingURL=containers.d.ts.map