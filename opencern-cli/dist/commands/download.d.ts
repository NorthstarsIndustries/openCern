/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
import type { Dataset, DownloadStatus } from '../services/cern-api.js';
export type { Dataset, DownloadStatus };
export declare function searchDatasets(query: string, experiment?: string, year?: number): Promise<Dataset[]>;
export declare function startDownload(dataset: Dataset, fileNames?: string[]): Promise<string>;
export declare function pollDownload(id: string, onProgress: (status: DownloadStatus) => void, maxPollMs?: number): Promise<DownloadStatus>;
export declare function cancelDownload(id: string): Promise<void>;
export declare function formatDatasetSize(bytes: number): string;
//# sourceMappingURL=download.d.ts.map