'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import styles from './StoragePage.module.css';
import {
  IconFolder,
  IconFile,
  IconCpu,
  IconCheck,
  IconX,
  IconTrash,
  IconChevronRight,
  IconExternalLink,
  IconBox,
  IconDatabase,
  IconRefresh,
  IconChevronLeft,
} from '../shared/Icons';

const Editor = dynamic(() => import('../../MonacoEditor'), { ssr: false });

const formatSize = (bytes) => {
  if (!bytes || bytes <= 0) return 'Unknown';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

/* ── Inspector sidebar ───────────────────────────────── */

function FileRow({
  file,
  processing,
  isExpanded,
  onToggleExpand,
  onProcess,
  onRevealFile,
  onDeleteFile,
  onVisualizeFile,
  onOpenInspector,
  onDeleteProcessedFile,
  onSaveProcessedFile,
}) {
  const fname = file.filename || file.name;
  const pStatus = processing?.[fname] || 'idle';
  const isFolder = file.type === 'folder';
  const isProcessed = pStatus === 'processed';
  const processedName = fname.replace('.root', '.json');

  return (
    <>
      {/* Main row */}
      <div className={styles.fileRow}>
        {isProcessed ? (
          <button
            className={`${styles.expandBtn} ${isExpanded ? styles.expandBtnOpen : ''}`}
            onClick={() => onToggleExpand(fname)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <IconChevronRight size={14} />
          </button>
        ) : (
          <span className={styles.expandPlaceholder} />
        )}

        <span className={styles.fileIcon}>
          {isFolder ? <IconFolder size={16} /> : <IconFile size={16} />}
        </span>

        <span className={styles.fileName} title={fname}>
          {fname}
        </span>

        <span className={styles.fileSize}>{formatSize(file.size)}</span>

        <span className={styles.fileActions}>
          {pStatus === 'processing' || pStatus === 'merging' || pStatus === 'extracting' ? (
            <button className={`${styles.processBtn} ${styles.processBtnActive}`}>
              <IconRefresh size={12} className={styles.spinIcon} />
              {pStatus === 'processing' ? 'Processing…' : pStatus === 'merging' ? 'Merging…' : 'Extracting…'}
            </button>
          ) : isProcessed ? (
            <button className={`${styles.processBtn} ${styles.processBtnDone}`}>
              <IconCheck size={12} /> PROCESSED
            </button>
          ) : pStatus === 'error' ? (
            <button className={`${styles.processBtn} ${styles.processBtnError}`} onClick={() => onProcess(fname)}>
              <IconX size={12} /> RETRY
            </button>
          ) : (
            <button className={styles.processBtn} onClick={() => onProcess(fname)}>
              <IconCpu size={12} /> PROCESS
            </button>
          )}

          <button
            className={styles.iconBtn}
            onClick={() => onRevealFile(fname)}
            title="Reveal in Finder"
          >
            <IconExternalLink size={14} />
          </button>

          <button
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            onClick={() => onDeleteFile(fname)}
            title="Delete"
          >
            <IconTrash size={14} />
          </button>
        </span>
      </div>

      {/* Expanded processed sub-row */}
      {isExpanded && isProcessed && (
        <div className={styles.subRow}>
          <IconFile size={14} style={{ color: 'var(--oc-blue-light)', flexShrink: 0 }} />
          <span className={styles.subFileName} title={processedName}>
            {processedName}
          </span>
          <span className={styles.subActions}>
            <button
              className={`${styles.subBtn} ${styles.subBtnPrimary}`}
              onClick={() => onVisualizeFile(processedName)}
            >
              <IconBox size={12} />
              Visualize 3D
            </button>
            <button
              className={styles.subBtn}
              onClick={() => onOpenInspector(processedName, 1)}
            >
              <IconFile size={12} />
              Open in Editor
            </button>
            {onDeleteProcessedFile && (
              <button
                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                onClick={() => onDeleteProcessedFile(processedName)}
                title="Delete processed file"
              >
                <IconTrash size={14} />
              </button>
            )}
          </span>
        </div>
      )}
    </>
  );
}

/* ── Inspector sidebar ───────────────────────────────── */

function InspectorPanel({
  inspectingFile,
  inspectorData,
  loadingInspector,
  inspectorPage,
  onCloseInspector,
  onOpenInspector,
  editorRef,
}) {
  if (!inspectingFile) return null;

  const inspectName = typeof inspectingFile === 'string' ? inspectingFile : inspectingFile?.filename || inspectingFile?.name || '';
  const meta = inspectorData || {};
  const totalEvents = meta.totalEvents ?? '—';
  const avgParticles = meta.avgParticles ?? '—';
  const content = typeof meta.content === 'string' ? meta.content : JSON.stringify(meta.content, null, 2) || '';
  const page = inspectorPage || 0;

  return (
    <div className={styles.inspector}>
      {/* Header */}
      <div className={styles.inspectorHeader}>
        <span className={styles.inspectorTitle} title={inspectName}>
          {inspectName}
        </span>
        <button className={styles.inspectorClose} onClick={onCloseInspector} title="Close">
          <IconX size={15} />
        </button>
      </div>

      {/* Metadata */}
      <div className={styles.inspectorMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Total Events</span>
          <span className={styles.metaValue}>{totalEvents}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Avg Particles</span>
          <span className={styles.metaValue}>{avgParticles}</span>
        </div>
      </div>

      {/* Editor */}
      <div className={styles.inspectorEditor}>
        {loadingInspector ? (
          <div className={styles.inspectorLoading}>Loading…</div>
        ) : (
          <Editor
            height="100%"
            defaultLanguage="json"
            value={content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 8 },
            }}
            onMount={(editor) => {
              if (editorRef) editorRef.current = editor;
            }}
          />
        )}
      </div>

      {/* Pagination footer */}
      <div className={styles.inspectorFooter}>
        <span className={styles.pageInfo}>Page {page + 1}</span>
        <span className={styles.pageButtons}>
          <button
            className={styles.pageBtn}
            disabled={page <= 0}
            onClick={() =>
              onOpenInspector(inspectingFile, page - 1)
            }
          >
            <IconChevronLeft size={12} />
            Previous
          </button>
          <button
            className={styles.pageBtn}
            onClick={() =>
              onOpenInspector(inspectingFile, page + 1)
            }
          >
            Next
            <IconChevronRight size={12} />
          </button>
        </span>
      </div>
    </div>
  );
}

/* ── Page component ──────────────────────────────────── */

export default function StoragePage({
  downloaded,
  processing,
  expandedFiles,
  inspectingFile,
  inspectorData,
  loadingInspector,
  inspectorPage,
  onProcess,
  onToggleExpand,
  onOpenInspector,
  onCloseInspector,
  onRevealFile,
  onDeleteFile,
  onVisualizeFile,
  onDeleteProcessedFile,
  onSaveProcessedFile,
  editorRef,
}) {
  const files = downloaded || [];
  const expanded = expandedFiles || {};

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Local Storage</h1>
        <p className={styles.subtitle}>Manage downloaded datasets and processed files</p>
      </div>

      {/* Body: file list + optional inspector */}
      <div className={styles.body}>
        <div className={styles.fileList}>
          {files.length === 0 ? (
            <div className={styles.emptyState}>
              <IconDatabase size={36} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No local files</p>
              <p className={styles.emptyHint}>Download datasets from Discover to get started.</p>
            </div>
          ) : (
            files.map((file) => (
              <FileRow
                key={file.filename || file.name}
                file={file}
                processing={processing}
                isExpanded={!!expanded[file.filename || file.name]}
                onToggleExpand={onToggleExpand}
                onProcess={onProcess}
                onRevealFile={onRevealFile}
                onDeleteFile={onDeleteFile}
                onVisualizeFile={onVisualizeFile}
                onOpenInspector={onOpenInspector}
                onDeleteProcessedFile={onDeleteProcessedFile}
                onSaveProcessedFile={onSaveProcessedFile}
              />
            ))
          )}
        </div>

        <InspectorPanel
          inspectingFile={inspectingFile}
          inspectorData={inspectorData}
          loadingInspector={loadingInspector}
          inspectorPage={inspectorPage}
          onCloseInspector={onCloseInspector}
          onOpenInspector={onOpenInspector}
          editorRef={editorRef}
        />
      </div>
    </div>
  );
}
