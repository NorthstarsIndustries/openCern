export interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    dockerUpdate: boolean;
}
export declare function checkForUpdates(useCache?: boolean): Promise<UpdateInfo>;
export declare function updateDockerImages(onProgress: (image: string) => void): Promise<void>;
export declare function getUpdateBanner(): string | null;
//# sourceMappingURL=update.d.ts.map