/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
declare function ensureComposeFile(includeQuantum?: boolean): void;
export declare const docker: {
    isDockerRunning(): Promise<boolean>;
    areImagesPresent(includeQuantum?: boolean): Promise<boolean>;
    getLocalDigest(imageName: string): string | null;
    getRemoteDigest(imageName: string): Promise<string | null>;
    checkForUpdates(): Promise<boolean>;
    pullImages(includeQuantum?: boolean): Promise<void>;
    startContainers(includeQuantum?: boolean): Promise<void>;
    stopContainers(): Promise<void>;
    getStatus(): Record<string, {
        running: boolean;
        status: string;
    }>;
    isApiReady(): Promise<boolean>;
    isQuantumReady(): Promise<boolean>;
    getLogs(service: string): string;
    getComposeFile(): string;
    ensureComposeFile: typeof ensureComposeFile;
};
export default docker;
//# sourceMappingURL=docker.d.ts.map