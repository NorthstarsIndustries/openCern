export interface LocalDataset {
    name: string;
    path: string;
    size: number;
    type: string;
    modified: Date;
    eventCount?: number;
    experiment?: string;
}
export declare function listLocalDatasets(): LocalDataset[];
export declare function formatDatasetList(datasets: LocalDataset[]): string[];
export declare function getDatasetStats(filePath: string): string[];
export declare function renderHistogram(filePath: string, field: string): string[];
export declare function renderScatterPlot(filePath: string, xField: string, yField: string): string[];
export declare function headEvents(filePath: string, n?: number): string[];
export declare function tailEvents(filePath: string, n?: number): string[];
export declare function describeDataset(filePath: string): string[];
export declare function filterEvents(filePath: string, filters: Record<string, string>): string[];
export declare function sampleEvents(filePath: string, n?: number): string[];
export declare function exportDataset(filePath: string, format: string): string[];
export declare function mergeDatasets(file1: string, file2: string): string[];
export declare function correlateFields(filePath: string): string[];
//# sourceMappingURL=datasets.d.ts.map