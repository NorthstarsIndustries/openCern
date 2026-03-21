/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
import axios, { AxiosError } from 'axios';
import { config } from '../utils/config.js';
import { getToken } from '../utils/auth.js';
function normalizeError(err) {
    if (err instanceof AxiosError) {
        const code = err.response?.status;
        const retryable = !code || code >= 500 || code === 429;
        let msg;
        if (err.code === 'ECONNREFUSED') {
            msg = 'API not running. Start containers with /status or check Docker.';
        }
        else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
            msg = 'API timed out. The server may be overloaded or unresponsive.';
        }
        else if (err.code === 'ENOTFOUND') {
            msg = 'API host not found. Check your apiBaseUrl in /config.';
        }
        else if (code === 401) {
            msg = 'Unauthorized. Run /login to authenticate.';
        }
        else if (code === 403) {
            msg = 'Forbidden. Your account may lack permission for this action.';
        }
        else if (code === 404) {
            msg = 'Endpoint not found. The API version may be incompatible — try /update.';
        }
        else if (code === 422) {
            const detail = err.response?.data?.detail;
            if (Array.isArray(detail)) {
                msg = `Validation error: ${detail.map((d) => d.msg || JSON.stringify(d)).join('; ')}`;
            }
            else {
                msg = `Validation error: ${detail || 'invalid request parameters'}`;
            }
        }
        else if (code === 429) {
            msg = 'Rate limited. Wait a moment and try again.';
        }
        else if (code && code >= 500) {
            msg = `Server error (${code}). The API encountered an internal problem.`;
        }
        else {
            msg = err.response?.data?.detail || err.response?.data?.message || err.message;
        }
        const error = new Error(msg);
        error.code = code;
        error.retryable = retryable;
        return error;
    }
    return err instanceof Error ? err : new Error(String(err));
}
async function withRetry(fn, attempts = 3) {
    let lastErr = new Error('Unknown error');
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        }
        catch (err) {
            lastErr = normalizeError(err);
            const retryable = lastErr.retryable;
            if (!retryable || i === attempts - 1)
                throw lastErr;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
    throw lastErr;
}
function createClient() {
    const baseURL = config.get('apiBaseUrl');
    const token = getToken();
    const client = axios.create({
        baseURL,
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
    return client;
}
export const cernApi = {
    async health() {
        return withRetry(async () => {
            const res = await createClient().get('/health');
            return res.data;
        });
    },
    async searchDatasets(query, experiment = 'all', year) {
        return withRetry(async () => {
            const res = await createClient().get('/datasets', {
                params: { experiment, size: 50 },
            });
            let datasets = res.data.datasets || [];
            const q = query.toLowerCase().trim();
            if (q) {
                datasets = datasets.filter(d => d.title.toLowerCase().includes(q) ||
                    (d.description && d.description.toLowerCase().includes(q)) ||
                    d.id.toLowerCase() === q);
            }
            if (year) {
                datasets = datasets.filter(d => d.year === year);
            }
            return datasets;
        });
    },
    async startDownload(dataset, selectedFiles) {
        return withRetry(async () => {
            const files = selectedFiles && selectedFiles.length > 0 ? selectedFiles : dataset.files;
            const res = await createClient().post('/download/multi', {
                dataset_title: dataset.title,
                files
            });
            // Server returns { folder, files: [{ track_key }] } — use first track_key as poll ID
            const trackKey = res.data.files?.[0]?.track_key || res.data.folder || res.data.id;
            return { id: trackKey };
        });
    },
    async downloadStatus(id) {
        const res = await createClient().get('/download/status', { params: { filename: id } });
        return res.data;
    },
    async cancelDownload(id) {
        await createClient().post('/downloads/cancel', { id });
    },
    async listFiles(folder) {
        return withRetry(async () => {
            const path = folder ? `/files/${folder}` : '/files';
            const res = await createClient().get(path);
            return res.data;
        });
    },
    async deleteFile(name) {
        await createClient().delete(`/files/${encodeURIComponent(name)}`);
    },
    async processFile(filePath) {
        return withRetry(async () => {
            // Strip absolute path to get relative to DATA_DIR, or just use basename
            let relative = filePath.replace(/^~?\/.*\/opencern-datasets\/data\//, '');
            // If still looks absolute, just use the basename
            if (relative.startsWith('/'))
                relative = relative.split('/').pop() || relative;
            const res = await createClient().post('/process', null, {
                params: { filename: relative },
            });
            if (res.data.error)
                throw new Error(res.data.error);
            return { id: res.data.id || relative };
        });
    },
    async processFolder(folderPath) {
        return withRetry(async () => {
            let relative = folderPath.replace(/^~?\/.*\/opencern-datasets\/data\//, '');
            if (relative.startsWith('/'))
                relative = relative.split('/').pop() || relative;
            const res = await createClient().post('/process/folder', null, {
                params: { folder: relative },
            });
            if (res.data.error)
                throw new Error(res.data.error);
            return { id: res.data.id || relative };
        });
    },
    async processStatus(id) {
        const res = await createClient().get('/process/status', { params: { filename: id } });
        return res.data;
    },
    async getRootMetadata(filePath) {
        return withRetry(async () => {
            const res = await createClient().get('/files/root-metadata', { params: { file: filePath } });
            return res.data;
        });
    },
};
export default cernApi;
//# sourceMappingURL=cern-api.js.map