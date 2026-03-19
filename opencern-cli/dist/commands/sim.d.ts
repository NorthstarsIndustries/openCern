export interface SimResult {
    success: boolean;
    message: string;
}
export declare function isSimBuilt(): boolean;
export declare function isSimSourcePresent(): boolean;
export declare function checkBuildDeps(): {
    cmake: boolean;
    compiler: boolean;
    glfw: boolean;
};
export declare function buildSim(onOutput: (line: string) => void): SimResult;
export declare function launchSim(filePath: string, event?: number): SimResult;
export declare function getSimStatus(): string[];
//# sourceMappingURL=sim.d.ts.map