'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styles from './CommandPalette.module.css';

/* ── inline SVG icons (16×16) ── */
const icons = {
  compass: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <polygon points="10.5,5.5 6.5,7 5.5,10.5 9.5,9" fill="currentColor" stroke="none" />
    </svg>
  ),
  folder: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5h4l1.5-1.5H14v9H2z" />
    </svg>
  ),
  code: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5.5,4 2,8 5.5,12" /><polyline points="10.5,4 14,8 10.5,12" />
    </svg>
  ),
  cube: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8 1.5L14 5v6l-6 3.5L2 11V5z" /><path d="M8 8.5V15" /><path d="M2 5l6 3.5L14 5" />
    </svg>
  ),
  brain: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14V8" /><path d="M5 3a3 3 0 0 0-1 5.8V11a2 2 0 0 0 4 0" /><path d="M11 3a3 3 0 0 1 1 5.8V11a2 2 0 0 1-4 0" />
    </svg>
  ),
  gear: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
    </svg>
  ),
  chat: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12v8H5l-3 3V3z" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
    </svg>
  ),
  bolt: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="9,1 4,9 8,9 7,15 12,7 8,7" />
    </svg>
  ),
  sidebar: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="6" y1="2" x2="6" y2="14" />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8a6 6 0 0 1 10.3-4.2" /><polyline points="12,1 12.5,4 9.5,4.5" /><path d="M14 8a6 6 0 0 1-10.3 4.2" /><polyline points="4,15 3.5,12 6.5,11.5" />
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 9l2-2" /><path d="M5.5 10.5a3 3 0 0 1 0-4.24l2-2a3 3 0 1 1 4.24 4.24" /><path d="M10.5 5.5a3 3 0 0 1 0 4.24l-2 2a3 3 0 1 1-4.24-4.24" />
    </svg>
  ),
};

/* ── built-in command definitions ── */
const COMMANDS = [
  { id: 'nav-discover',   label: 'Go to Discover',        icon: 'compass', category: 'Navigation', action: { type: 'navigate', page: 'discover' } },
  { id: 'nav-storage',    label: 'Go to Storage',         icon: 'folder',  category: 'Navigation', action: { type: 'navigate', page: 'storage' } },
  { id: 'nav-workspace',  label: 'Go to Workspace',       icon: 'code',    category: 'Navigation', action: { type: 'navigate', page: 'workspace' } },
  { id: 'nav-visualize',  label: 'Go to Visualize',       icon: 'cube',    category: 'Navigation', action: { type: 'navigate', page: 'visualize' } },
  { id: 'nav-ai',         label: 'Go to AI Analysis',     icon: 'brain',   category: 'Navigation', action: { type: 'navigate', page: 'ai' } },
  { id: 'nav-settings',   label: 'Go to Settings',        icon: 'gear',    category: 'Navigation', action: { type: 'navigate', page: 'settings' } },

  { id: 'act-new-chat',       label: 'New AI Conversation',  icon: 'chat',    category: 'Actions', action: { type: 'new-chat' } },
  { id: 'act-search-data',    label: 'Search Datasets',      icon: 'search',  category: 'Actions', action: { type: 'search-datasets' } },
  { id: 'act-process-all',    label: 'Process All Files',    icon: 'bolt',    category: 'Actions', action: { type: 'process-all' } },
  { id: 'act-toggle-sidebar', label: 'Toggle Sidebar',       icon: 'sidebar', category: 'Actions', action: { type: 'toggle-sidebar' } },
  { id: 'act-check-updates',  label: 'Check for Updates',    icon: 'refresh', category: 'Actions', action: { type: 'check-updates' } },

  { id: 'link-cern',    label: 'CERN Open Data Portal', icon: 'link', category: 'Quick Links', action: { type: 'external', url: 'https://opendata.cern.ch' } },
  { id: 'link-root',    label: 'ROOT Documentation',    icon: 'link', category: 'Quick Links', action: { type: 'external', url: 'https://root.cern' } },
  { id: 'link-github',  label: 'OpenCERN GitHub',       icon: 'link', category: 'Quick Links', action: { type: 'external', url: 'https://github.com/ceoatnorthstar/opencern' } },
];

/* ── simple fuzzy match ── */
function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

/* ── component ── */
export default function CommandPalette({ isOpen, onClose, onNavigate, onAction }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // filtered & grouped results
  const filtered = useMemo(
    () => COMMANDS.filter((cmd) => fuzzyMatch(query, cmd.label)),
    [query],
  );

  // flat list for keyboard nav + grouped structure for rendering
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((cmd) => {
      if (!map.has(cmd.category)) map.set(cmd.category, []);
      map.get(cmd.category).push(cmd);
    });
    return [...map.entries()]; // [[category, items], ...]
  }, [filtered]);

  // reset on open/query change
  useEffect(() => { setSelectedIndex(0); }, [query]);
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // global ⌘K / Ctrl+K listener
  useEffect(() => {
    function handleGlobalKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose?.();
        // parent is responsible for toggling isOpen
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isOpen, onClose]);

  const executeItem = useCallback(
    (cmd) => {
      onClose?.();
      if (cmd.action.type === 'navigate') {
        onNavigate?.(cmd.action.page);
      } else {
        onAction?.(cmd.action);
      }
    },
    [onClose, onNavigate, onAction],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length || 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length || 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) executeItem(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    },
    [filtered, selectedIndex, executeItem, onClose],
  );

  if (!isOpen) return null;

  // build a flat index counter for data-idx
  let flatIdx = -1;

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={styles.modal}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        {/* search input */}
        <div className={styles.inputWrapper}>
          <span className={styles.searchIcon}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* results */}
        <div className={styles.results} ref={listRef}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No results found</div>
          ) : (
            groups.map(([category, items]) => (
              <div key={category}>
                <div className={styles.categoryHeader}>{category}</div>
                {items.map((cmd) => {
                  flatIdx++;
                  const idx = flatIdx;
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={cmd.id}
                      data-idx={idx}
                      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => executeItem(cmd)}
                    >
                      <span className={styles.itemIcon}>{icons[cmd.icon]}</span>
                      <span className={styles.itemLabel}>{cmd.label}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* footer hints */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            <kbd className={styles.kbd}>↑↓</kbd> navigate
          </span>
          <span className={styles.footerHint}>
            <kbd className={styles.kbd}>↵</kbd> select
          </span>
          <span className={styles.footerHint}>
            <kbd className={styles.kbd}>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
