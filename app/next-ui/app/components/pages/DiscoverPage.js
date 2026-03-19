'use client';

import { useState, useMemo } from 'react';
import { IconSearch, IconDownload, IconCheck, IconX, IconFilter } from '../shared/Icons';
import s from './DiscoverPage.module.css';

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}

const EXPERIMENTS = ['All', 'CMS', 'ALICE', 'ATLAS'];

const experimentBadge = (exp) => {
  const key = (exp || '').toUpperCase();
  if (key === 'CMS') return s.badgeCMS;
  if (key === 'ALICE') return s.badgeALICE;
  if (key === 'ATLAS') return s.badgeATLAS;
  return s.badgeDefault;
};

function SkeletonCards() {
  return (
    <div className={s.grid}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={s.skeleton}>
          <div className={s.skeletonLines}>
            <div className={s.skeletonLine} />
            <div className={s.skeletonLine} />
          </div>
          <div className={s.skeletonAction} />
        </div>
      ))}
    </div>
  );
}

function DatasetCard({ ds, downloading, downloaded, isSelected, onSelect, onDownload }) {
  const files = ds.files || [];
  const filename = files[0] ? (typeof files[0] === 'string' ? files[0].split('/').pop() : files[0].name || files[0].filename) : null;
  const dlEntry = filename ? downloading?.[filename] : null;
  const isDownloading = dlEntry != null;
  const isReady = Array.isArray(downloaded)
    ? downloaded.some(f => f.filename === filename || f.filename === ds.title)
    : !!downloaded?.[ds.id];
  const progress = dlEntry?.progress ?? null;

  return (
    <div className={`${s.card} ${isSelected ? s.cardSelected : ''}`}>
      <div className={s.cardBody} onClick={() => onSelect(ds)}>
        <div className={s.cardInfo}>
          <p className={s.cardTitle}>{ds.title || ds.name || ds.id}</p>
          {ds.description && <p className={s.cardDesc}>{ds.description}</p>}
        </div>
        <div className={s.cardMeta}>
          {ds.experiment && (
            <span className={`${s.badge} ${experimentBadge(ds.experiment)}`}>
              {ds.experiment}
            </span>
          )}
          {files.length > 0 && (
            <span className={`${s.badge} ${s.fileCount}`}>
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          )}
          {ds.size != null && <span className={s.sizeLabel}>{formatSize(ds.size)}</span>}

          {isReady ? (
            <span className={s.readyBadge}>
              <IconCheck size={12} /> Ready
            </span>
          ) : isDownloading ? (
            <div className={s.progressWrap}>
              <div className={s.progressTrack}>
                <div
                  className={s.progressFill}
                  style={{ width: `${progress != null ? progress : 0}%` }}
                />
              </div>
              <span className={s.progressLabel}>
                {progress != null ? `${Math.round(progress)}%` : 'Starting…'}
              </span>
            </div>
          ) : (
            <button
              className={s.downloadBtn}
              onClick={(e) => {
                e.stopPropagation();
                onDownload(ds);
              }}
            >
              <IconDownload size={13} /> Download
            </button>
          )}
        </div>
      </div>

      {isSelected && files.length > 0 && (
        <div className={s.expandedArea}>
          <div className={s.fileTags}>
            {files.map((f, i) => (
              <span key={i} className={s.fileTag}>
                {typeof f === 'string' ? f : f.name || f.filename || `file-${i}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilePickerModal({ filePicker, onFilePickerChange, onMultiDownload, onToggleFileInPicker }) {
  if (!filePicker) return null;

  const { dataset, selectedFiles = [] } = filePicker;
  const files = dataset?.files || [];
  const selectedSet = new Set(selectedFiles);

  const selectAll = () => {
    files.forEach((f, i) => {
      const key = typeof f === 'string' ? f : f.name || f.filename || `file-${i}`;
      if (!selectedSet.has(key)) onToggleFileInPicker(key);
    });
  };

  const selectNone = () => {
    selectedFiles.forEach((key) => onToggleFileInPicker(key));
  };

  return (
    <div className={s.overlay} onClick={() => onFilePickerChange(null)}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>{dataset?.title || dataset?.name || 'Select Files'}</h3>
          <button className={s.modalClose} onClick={() => onFilePickerChange(null)}>
            <IconX size={15} />
          </button>
        </div>

        <div className={s.modalControls}>
          <button className={s.selectBtn} onClick={selectAll}>Select All</button>
          <button className={s.selectBtn} onClick={selectNone}>Select None</button>
        </div>

        <div className={s.fileList}>
          {files.map((f, i) => {
            const name = typeof f === 'string' ? f : f.name || f.filename || `file-${i}`;
            const size = typeof f === 'object' ? f.size : null;
            const checked = selectedSet.has(name);
            return (
              <div key={i} className={s.fileRow} onClick={() => onToggleFileInPicker(name)}>
                <div className={`${s.fileCheckbox} ${checked ? s.fileCheckboxChecked : ''}`}>
                  {checked && <IconCheck size={11} strokeWidth="3" />}
                </div>
                <span className={s.fileName}>{name}</span>
                {size != null && <span className={s.fileSize}>{formatSize(size)}</span>}
              </div>
            );
          })}
        </div>

        <div className={s.modalFooter}>
          <button className={s.cancelBtn} onClick={() => onFilePickerChange(null)}>
            Cancel
          </button>
          <button
            className={s.confirmBtn}
            disabled={selectedFiles.length === 0}
            onClick={() => onMultiDownload(dataset, selectedFiles)}
          >
            Download {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage({
  datasets = [],
  loading = false,
  experiment = 'All',
  page = 1,
  totalPages = 1,
  totalDatasets = 0,
  downloading = {},
  downloaded = {},
  selected = null,
  onExperimentChange,
  onPageChange,
  onSelect,
  onDownload,
  filePicker,
  onFilePickerChange,
  onMultiDownload,
  onToggleFileInPicker,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return datasets;
    const q = search.toLowerCase();
    return datasets.filter((ds) => {
      const title = (ds.title || ds.name || ds.id || '').toLowerCase();
      const desc = (ds.description || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [datasets, search]);

  return (
    <div className={s.page}>
      <div className={s.scrollArea}>
        {/* Header */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <h1>Discover Datasets</h1>
            <p>Browse and download CERN Open Data</p>
          </div>
          <div className={s.chips}>
            {EXPERIMENTS.map((exp) => (
              <button
                key={exp}
                className={`${s.chip} ${experiment === exp ? s.chipActive : ''}`}
                onClick={() => onExperimentChange?.(exp)}
              >
                {exp}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className={s.searchWrap}>
          <span className={s.searchIcon}>
            <IconSearch size={15} />
          </span>
          <input
            className={s.searchInput}
            type="text"
            placeholder="Search datasets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonCards />
        ) : filtered.length === 0 ? (
          <div className={s.empty}>
            <span className={s.emptyTitle}>No datasets found</span>
            <span>{search ? 'Try a different search term' : 'No datasets available'}</span>
          </div>
        ) : (
          <>
            <div className={s.grid}>
              {filtered.map((ds) => (
                <DatasetCard
                  key={ds.id}
                  ds={ds}
                  downloading={downloading}
                  downloaded={downloaded}
                  isSelected={selected?.id === ds.id}
                  onSelect={onSelect}
                  onDownload={onDownload}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className={s.pagination}>
                <button
                  className={s.pageBtn}
                  disabled={page <= 1}
                  onClick={() => onPageChange?.(page - 1)}
                >
                  Previous
                </button>
                <span className={s.pageInfo}>
                  Page {page} of {totalPages} ({totalDatasets} datasets)
                </span>
                <button
                  className={s.pageBtn}
                  disabled={page >= totalPages}
                  onClick={() => onPageChange?.(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* File Picker Modal */}
      <FilePickerModal
        filePicker={filePicker}
        onFilePickerChange={onFilePickerChange}
        onMultiDownload={onMultiDownload}
        onToggleFileInPicker={onToggleFileInPicker}
      />
    </div>
  );
}
