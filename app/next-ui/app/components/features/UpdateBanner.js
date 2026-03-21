'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './UpdateBanner.module.css';

/**
 * Resolve the Electron IPC bridge.
 * Prefers the contextBridge-exposed `window.electronAPI`,
 * falls back to `window.require('electron').ipcRenderer` for
 * nodeIntegration: true setups.
 */
function getElectronAPI() {
  if (typeof window === 'undefined') return null;

  if (window.electronAPI) return window.electronAPI;

  try {
    if (typeof window.require === 'function') {
      const { ipcRenderer } = window.require('electron');
      return {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, cb) => {
          const handler = (_event, ...args) => cb(...args);
          ipcRenderer.on(channel, handler);
          return () => ipcRenderer.removeListener(channel, handler);
        },
      };
    }
  } catch {
    /* not in Electron */
  }

  return null;
}

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(null); // { message, percent }
  const [dismissed, setDismissed] = useState(false);
  const apiRef = useRef(null);

  // Check for updates on mount
  useEffect(() => {
    const api = getElectronAPI();
    if (!api) return;
    apiRef.current = api;

    let cancelled = false;

    api.invoke('check-docker-updates')
      .then((result) => {
        if (!cancelled && result?.available) setVisible(true);
      })
      .catch(() => {});

    // Listen for background update notifications
    const unsub = api.on('docker-update-available', () => {
      if (!cancelled) {
        setDismissed(false);
        setVisible(true);
      }
    });

    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Listen for progress events while an update is running
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !updating) return;

    const unsub = api.on('docker-update-progress', (data) => {
      setProgress({
        message: data?.message ?? 'Updating…',
        percent: typeof data?.percent === 'number' ? data.percent : null,
      });

      if (data?.done) {
        setUpdating(false);
        setProgress(null);
        setVisible(false);
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [updating]);

  const handleUpdate = useCallback(async () => {
    const api = apiRef.current;
    if (!api || updating) return;

    setUpdating(true);
    setProgress({ message: 'Starting update…', percent: 0 });

    try {
      const result = await api.invoke('start-docker-update');
      if (!result?.success) {
        setProgress({ message: 'Update failed. Try again later.', percent: null });
        setTimeout(() => {
          setUpdating(false);
          setProgress(null);
        }, 4000);
      }
    } catch {
      setProgress({ message: 'Update failed. Try again later.', percent: null });
      setTimeout(() => {
        setUpdating(false);
        setProgress(null);
      }, 4000);
    }
  }, [updating]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
  }, []);

  // Render nothing outside Electron or when nothing to show
  if (typeof window === 'undefined') return null;
  if (!visible && !updating) return null;
  if (dismissed && !updating) return null;

  const showBanner = (visible || updating) && !dismissed;

  return (
    <div className={`${styles.overlay} ${showBanner ? styles.overlayVisible : ''}`}>
      <div className={styles.banner}>
        <div className={styles.content}>
          {/* Arrow-down-circle icon */}
          <svg className={styles.icon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="10" r="8.5" />
            <path d="M10 6v6m0 0l-2.5-2.5M10 12l2.5-2.5M6.5 14.5h7" />
          </svg>

          <div className={styles.textGroup}>
            <span className={styles.title}>
              {updating ? 'Updating containers…' : 'Container updates available'}
            </span>
            {progress?.message && (
              <span className={styles.message}>{progress.message}</span>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          {!updating && (
            <button className={styles.updateBtn} onClick={handleUpdate}>
              Update Now
            </button>
          )}
          <button
            className={styles.dismissBtn}
            onClick={handleDismiss}
            disabled={updating}
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        {updating && (
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressBar} ${progress?.percent == null ? styles.progressIndeterminate : ''}`}
              style={{ width: progress?.percent != null ? `${progress.percent}%` : undefined }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
