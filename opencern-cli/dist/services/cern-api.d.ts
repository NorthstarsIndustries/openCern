/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
export interface Dataset {
    id: string;
    title: string;
    description?: string;
    experiment: string;
    year: number;
    energy: string;
    size: number;
    files: string[];
}
export interface DownloadStatus {
    id: string;
    status: 'pending' | 'downloading' | 'extracting' | 'done' | 'error' | 'cancelled';
    progress: number;
    speed: number;
    eta: number;
    error?: string;
}
export interface ProcessStatus {
    id: string;
    status: 'pending' | 'processing' | 'processed' | 'merging' | 'error' | 'idle';
    progress: number;
    currentFile?: string;
    results?: ProcessResults;
    error?: string;
}
export interface ProcessResults {
    eventCount: number;
    particles: Record<string, number>;
    peakHT: number;
    experiment: string;
    outputFile: string;
}
export interface LocalFile {
    name: string;
    path: string;
    size: number;
    type: 'root' | 'json' | 'other';
    modified: string;
}
export declare const cernApi: {
    health(): Promise<{
        status: string;
        version: string;
    }>;
    searchDatasets(query: string, experiment?: string, year?: number): Promise<Dataset[]>;
    startDownload(dataset: Dataset, selectedFiles?: string[]): Promise<{
        id: string;
    }>;
    downloadStatus(id: string): Promise<DownloadStatus>;
    cancelDownload(id: string): Promise<void>;
    listFiles(folder?: string): Promise<LocalFile[]>;
    deleteFile(name: string): Promise<void>;
    processFile(filePath: string): Promise<{
        id: string;
    }>;
    processFolder(folderPath: string): Promise<{
        id: string;
    }>;
    processStatus(id: string): Promise<ProcessStatus>;
    getRootMetadata(filePath: string): Promise<Record<string, unknown>>;
};
export default cernApi;
//# sourceMappingURL=cern-api.d.ts.map