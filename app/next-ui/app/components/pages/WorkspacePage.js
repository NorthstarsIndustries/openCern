'use client';

import React, { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  IconFile, IconFolder, IconX, IconChevronRight, IconLayers,
} from '../shared/Icons';
import s from './WorkspacePage.module.css';

const Editor = dynamic(() => import('../../MonacoEditor'), { ssr: false });

/* Small JSON file icon with accent colour */
const JsonFileIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#E8AB53"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

const EVENTS_PER_PAGE = 500;

const EDITOR_OPTIONS = {
  readOnly: false,
  minimap: { enabled: true, renderCharacters: false },
  fontSize: 13,
  fontFamily: "var(--font-geist-mono), 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
  folding: true,
  matchBrackets: 'always',
  renderLineHighlight: 'all',
  scrollBeyondLastLine: false,
  padding: { top: 8 },
  lineNumbersMinChars: 4,
  glyphMargin: false,
  automaticLayout: true,
};

export default function WorkspacePage({
  downloaded = [],
  processing = {},
  inspectingFile,
  inspectorData,
  loadingInspector,
  onOpenInspector,
  onSaveProcessedFile,
  onDeleteProcessedFile,
  editorRef,
}) {
  const [openFile, setOpenFile] = useState(null);
  const [page, setPage] = useState(0);

  /* Processed files list — only files whose processing status is 'processed' */
  const processedFiles = useMemo(
    () => downloaded.filter((f) => processing[f.filename] === 'processed'),
    [downloaded, processing],
  );

  /* Derive editor content from inspectorData with pagination */
  const { pageContent, totalEvents, totalPages } = useMemo(() => {
    if (!inspectorData) return { pageContent: '', totalEvents: 0, totalPages: 0 };

    let events = [];
    try {
      const parsed = typeof inspectorData === 'string' ? JSON.parse(inspectorData) : inspectorData;
      events = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return { pageContent: inspectorData, totalEvents: 0, totalPages: 1 };
    }

    const total = events.length;
    const pages = Math.max(1, Math.ceil(total / EVENTS_PER_PAGE));
    const start = page * EVENTS_PER_PAGE;
    const slice = events.slice(start, start + EVENTS_PER_PAGE);

    return {
      pageContent: JSON.stringify(slice.length === 1 ? slice[0] : slice, null, 2),
      totalEvents: total,
      totalPages: pages,
    };
  }, [inspectorData, page]);

  const jsonFilename = useMemo(() => {
    if (!openFile) return '';
    const base = openFile.replace(/\.[^.]+$/, '');
    return `${base}.json`;
  }, [openFile]);

  const handleOpenFile = useCallback(
    (filename) => {
      setOpenFile(filename);
      setPage(0);
      onOpenInspector?.(filename);
    },
    [onOpenInspector],
  );

  const handleCloseTab = useCallback((e) => {
    e.stopPropagation();
    setOpenFile(null);
  }, []);

  const handleEditorMount = useCallback(
    (editor) => {
      if (editorRef) editorRef.current = editor;
    },
    [editorRef],
  );

  const handlePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages]);

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className={s.workspace}>
      {/* ── Explorer Sidebar ──────────────────────────── */}
      <aside className={s.sidebar}>
        <div className={s.sidebarHeader}>Explorer</div>

        <div className={s.sidebarTree}>
          {processedFiles.length === 0 ? (
            <div className={s.emptyExplorer}>
              <IconFolder size={28} />
              <span className={s.emptyExplorerText}>
                No processed datasets available
              </span>
            </div>
          ) : (
            processedFiles.map((f) => {
              const base = f.filename.replace(/\.[^.]+$/, '');
              const json = `${base}.json`;
              const isActive = openFile === f.filename;

              return (
                <React.Fragment key={f.filename}>
                  {/* Folder-level entry */}
                  <div className={s.treeFolder}>
                    <IconFolder size={14} />
                    <span className={s.treeFolderName}>{f.filename}</span>
                  </div>

                  {/* JSON sub-item */}
                  <div
                    className={`${s.treeItem} ${isActive ? s.treeItemActive : ''}`}
                    onClick={() => handleOpenFile(f.filename)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleOpenFile(f.filename)}
                  >
                    <JsonFileIcon />
                    <span className={s.treeItemName}>{json}</span>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Editor Area ───────────────────────────────── */}
      <div className={s.editorArea}>
        {openFile ? (
          <>
            {/* Tab bar */}
            <div className={s.tabBar}>
              <div className={`${s.tab} ${s.tabActive}`}>
                <JsonFileIcon />
                <span>{jsonFilename}</span>
                <span className={s.tabClose} onClick={handleCloseTab} role="button" tabIndex={0}>
                  <IconX size={12} />
                </span>
              </div>
            </div>

            {/* Breadcrumb + actions */}
            <div className={s.breadcrumbBar}>
              <div className={s.breadcrumb}>
                <span>workspace</span>
                <IconChevronRight size={10} />
                <span>telemetry</span>
                <IconChevronRight size={10} />
                <span>{jsonFilename}</span>
              </div>
              <div className={s.actions}>
                <button className={s.btnSave} onClick={() => onSaveProcessedFile?.(openFile)}>
                  Save
                </button>
                <button className={s.btnDelete} onClick={() => onDeleteProcessedFile?.(openFile)}>
                  Delete
                </button>
              </div>
            </div>

            {/* Editor body or loading */}
            {loadingInspector ? (
              <div className={s.loadingState}>
                <div className={s.spinner} />
                <span className={s.loadingText}>Loading dataset…</span>
              </div>
            ) : (
              <div className={s.editorBody}>
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  theme="vs-dark"
                  value={pageContent}
                  options={EDITOR_OPTIONS}
                  onMount={handleEditorMount}
                />
              </div>
            )}

            {/* Status bar */}
            <div className={s.statusBar}>
              <div className={s.statusLeft}>
                <span>JSON Dataset</span>
                {totalEvents > 0 && (
                  <span>{totalEvents.toLocaleString()} event{totalEvents !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className={s.statusRight}>
                {totalPages > 1 && (
                  <div className={s.statusPagination}>
                    <button className={s.statusBtn} disabled={page === 0} onClick={handlePrev}>
                      Prev
                    </button>
                    <span>
                      {page + 1} / {totalPages}
                    </span>
                    <button className={s.statusBtn} disabled={page >= totalPages - 1} onClick={handleNext}>
                      Next
                    </button>
                  </div>
                )}
                <span>UTF-8</span>
              </div>
            </div>
          </>
        ) : (
          /* Empty state — no file selected */
          <div className={s.emptyState}>
            <div className={s.emptyLogo}>
              <IconLayers size={32} />
            </div>
            <span className={s.emptyText}>Select a dataset from Explorer</span>
          </div>
        )}
      </div>
    </div>
  );
}
