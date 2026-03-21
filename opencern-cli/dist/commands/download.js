/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
import { cernApi } from '../services/cern-api.js';
export async function searchDatasets(query, experiment, year) {
    return cernApi.searchDatasets(query, experiment, year);
}
export async function startDownload(dataset, fileNames) {
    const result = await cernApi.startDownload(dataset, fileNames);
    return result.id;
}
export async function pollDownload(id, onProgress) {
    while (true) {
        const status = await cernApi.downloadStatus(id);
        onProgress(status);
        if (status.status === 'done' || status.status === 'error' || status.status === 'cancelled') {
            return status;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}
export async function cancelDownload(id) {
    await cernApi.cancelDownload(id);
}
export function formatDatasetSize(bytes) {
    if (bytes > 1e9)
        return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes > 1e6)
        return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
}
//# sourceMappingURL=download.js.map