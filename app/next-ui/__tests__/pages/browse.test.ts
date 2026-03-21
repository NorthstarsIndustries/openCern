import { describe, it, expect } from "vitest";

interface Dataset {
  id: string;
  title: string;
  description: string;
  experiment?: string;
  files?: unknown[];
  size?: number;
}

function filterDatasets(datasets: Dataset[], query: string): Dataset[] {
  if (!query.trim()) return datasets;
  const q = query.toLowerCase();
  return datasets.filter((ds) => {
    const title = (ds.title || ds.id || "").toLowerCase();
    const desc = (ds.description || "").toLowerCase();
    return title.includes(q) || desc.includes(q);
  });
}

function filterByExperiment(datasets: Dataset[], experiment: string): Dataset[] {
  if (experiment === "All") return datasets;
  return datasets.filter((ds) => ds.experiment === experiment);
}

function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const start = (page - 1) * perPage;
  return { items: items.slice(start, start + perPage), totalPages };
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + units[i];
}

const SAMPLE_DATASETS: Dataset[] = [
  { id: "1", title: "Higgs Boson Dataset", description: "CMS Higgs search data", experiment: "CMS", files: ["file1.root", "file2.root"], size: 1073741824 },
  { id: "2", title: "ALICE Pb-Pb Collisions", description: "Heavy-ion collision data", experiment: "ALICE", files: ["run1.root"], size: 536870912 },
  { id: "3", title: "ATLAS W Boson", description: "W boson production cross-section", experiment: "ATLAS", files: [], size: 268435456 },
  { id: "4", title: "CMS Dimuon Spectrum", description: "Dimuon invariant mass spectrum", experiment: "CMS", files: ["dimuon.root"], size: 104857600 },
  { id: "5", title: "ALICE pp Minimum Bias", description: "Proton-proton minimum bias events", experiment: "ALICE", files: ["minbias.root"], size: 2147483648 },
];

describe("Dataset search filtering", () => {
  it("returns all datasets when query is empty", () => {
    expect(filterDatasets(SAMPLE_DATASETS, "")).toEqual(SAMPLE_DATASETS);
    expect(filterDatasets(SAMPLE_DATASETS, "  ")).toEqual(SAMPLE_DATASETS);
  });

  it("filters by title match", () => {
    const results = filterDatasets(SAMPLE_DATASETS, "higgs");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("1");
  });

  it("filters by description match", () => {
    const results = filterDatasets(SAMPLE_DATASETS, "heavy-ion");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("2");
  });

  it("is case-insensitive", () => {
    const results = filterDatasets(SAMPLE_DATASETS, "ATLAS");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("3");
  });

  it("returns empty when no match", () => {
    const results = filterDatasets(SAMPLE_DATASETS, "nonexistent-dataset");
    expect(results).toHaveLength(0);
  });

  it("matches partial strings", () => {
    const results = filterDatasets(SAMPLE_DATASETS, "dimuon");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("4");
  });
});

describe("Experiment filter", () => {
  it("returns all datasets for 'All'", () => {
    expect(filterByExperiment(SAMPLE_DATASETS, "All")).toEqual(SAMPLE_DATASETS);
  });

  it("filters CMS datasets", () => {
    const results = filterByExperiment(SAMPLE_DATASETS, "CMS");
    expect(results).toHaveLength(2);
    expect(results.every((d) => d.experiment === "CMS")).toBe(true);
  });

  it("filters ALICE datasets", () => {
    const results = filterByExperiment(SAMPLE_DATASETS, "ALICE");
    expect(results).toHaveLength(2);
    expect(results.every((d) => d.experiment === "ALICE")).toBe(true);
  });

  it("filters ATLAS datasets", () => {
    const results = filterByExperiment(SAMPLE_DATASETS, "ATLAS");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("3");
  });

  it("returns empty for unknown experiment", () => {
    const results = filterByExperiment(SAMPLE_DATASETS, "LHCb");
    expect(results).toHaveLength(0);
  });
});

describe("Pagination logic", () => {
  it("returns first page", () => {
    const { items, totalPages } = paginate(SAMPLE_DATASETS, 1, 2);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("1");
    expect(totalPages).toBe(3);
  });

  it("returns second page", () => {
    const { items } = paginate(SAMPLE_DATASETS, 2, 2);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("3");
  });

  it("returns partial last page", () => {
    const { items } = paginate(SAMPLE_DATASETS, 3, 2);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("5");
  });

  it("returns empty for out-of-range page", () => {
    const { items } = paginate(SAMPLE_DATASETS, 10, 2);
    expect(items).toHaveLength(0);
  });

  it("returns 1 total page for empty list", () => {
    const { items, totalPages } = paginate([], 1, 10);
    expect(items).toHaveLength(0);
    expect(totalPages).toBe(1);
  });

  it("single page when items fit", () => {
    const { items, totalPages } = paginate(SAMPLE_DATASETS, 1, 10);
    expect(items).toHaveLength(5);
    expect(totalPages).toBe(1);
  });
});

describe("formatSize utility", () => {
  it("formats 0 bytes", () => {
    expect(formatSize(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(104857600)).toBe("100 MB");
  });

  it("formats gigabytes", () => {
    expect(formatSize(1073741824)).toBe("1 GB");
  });

  it("formats terabytes", () => {
    expect(formatSize(1099511627776)).toBe("1 TB");
  });
});
