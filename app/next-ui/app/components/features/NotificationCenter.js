'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useState,
} from 'react';
import styles from './NotificationCenter.module.css';

/* ─── Icons (inline SVG) ─── */

const icons = {
  success: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L1 18h18L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14.5" r="0.75" fill="currentColor" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.75" fill="currentColor" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 16a2 2 0 104 0M4 13h12l-1.3-3.9A5 5 0 0010 4.5h0a5 5 0 00-4.7 4.6L4 13z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ─── Helpers ─── */

let idCounter = 0;
const genId = () => `notif_${Date.now()}_${++idCounter}`;

const MAX_VISIBLE_TOASTS = 5;
const DEFAULT_DURATION = 5000;

/* ─── Reducer ─── */

const ActionTypes = {
  ADD: 'ADD',
  DISMISS: 'DISMISS',
  CLEAR_ALL: 'CLEAR_ALL',
};

function notificationReducer(state, action) {
  switch (action.type) {
    case ActionTypes.ADD:
      return [action.payload, ...state];
    case ActionTypes.DISMISS:
      return state.filter((n) => n.id !== action.payload);
    case ActionTypes.CLEAR_ALL:
      return [];
    default:
      return state;
  }
}

/* ─── Context ─── */

const NotificationContext = createContext(null);

/* ─── Provider ─── */

export function NotificationProvider({ children }) {
  const [notifications, dispatch] = useReducer(notificationReducer, []);

  const notify = useCallback((options) => {
    const id = genId();
    const notification = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message || null,
      duration: options.duration !== undefined ? options.duration : DEFAULT_DURATION,
      action: options.action || null,
      createdAt: Date.now(),
    };
    dispatch({ type: ActionTypes.ADD, payload: notification });
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    dispatch({ type: ActionTypes.DISMISS, payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_ALL });
  }, []);

  const value = React.useMemo(
    () => ({ notifications, notify, dismiss, clearAll }),
    [notifications, notify, dismiss, clearAll],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/* ─── Hook ─── */

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}

/* ─── Single Toast ─── */

function Toast({ notification, onDismiss }) {
  const { id, type, title, message, duration, action } = notification;
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const hoveredRef = useRef(false);
  const startRef = useRef(null);
  const remainRef = useRef(duration);
  const rafRef = useRef(null);

  // Slide in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const beginExit = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(id), 350);
  }, [id, onDismiss]);

  // Auto-dismiss with progress
  useEffect(() => {
    if (duration === 0) return;

    startRef.current = performance.now();
    remainRef.current = duration;

    const tick = (now) => {
      if (hoveredRef.current) {
        startRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startRef.current;
      const left = remainRef.current - elapsed;
      if (left <= 0) {
        setProgress(0);
        beginExit();
        return;
      }
      setProgress((left / duration) * 100);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, beginExit]);

  const handleMouseEnter = () => {
    hoveredRef.current = true;
  };

  const handleMouseLeave = () => {
    hoveredRef.current = false;
    if (duration > 0) {
      const currentLeft = (progress / 100) * duration;
      remainRef.current = currentLeft;
      startRef.current = performance.now();
    }
  };

  const handleClick = (e) => {
    if (e.target.closest(`.${styles.toastAction}`) || e.target.closest(`.${styles.toastClose}`)) return;
    beginExit();
  };

  const handleActionClick = (e) => {
    e.stopPropagation();
    if (action?.onClick) action.onClick();
    beginExit();
  };

  const typeClass = {
    success: styles.toastSuccess,
    error: styles.toastError,
    warning: styles.toastWarning,
    info: styles.toastInfo,
  }[type];

  const iconClass = {
    success: styles.iconSuccess,
    error: styles.iconError,
    warning: styles.iconWarning,
    info: styles.iconInfo,
  }[type];

  const progressClass = {
    success: styles.progressSuccess,
    error: styles.progressError,
    warning: styles.progressWarning,
    info: styles.progressInfo,
  }[type];

  return (
    <div
      className={`${styles.toast} ${typeClass} ${visible ? styles.visible : ''} ${exiting ? styles.exiting : ''}`}
      role="alert"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={`${styles.toastIcon} ${iconClass}`}>{icons[type]}</span>
      <div className={styles.toastBody}>
        <p className={styles.toastTitle}>{title}</p>
        {message && <p className={styles.toastMessage}>{message}</p>}
        {action && (
          <button className={styles.toastAction} onClick={handleActionClick}>
            {action.label}
          </button>
        )}
      </div>
      <button
        className={styles.toastClose}
        onClick={(e) => { e.stopPropagation(); beginExit(); }}
        aria-label="Dismiss notification"
      >
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {duration > 0 && (
        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressBar} ${progressClass}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Toast Container ─── */

export function ToastContainer() {
  const { notifications, dismiss } = useNotifications();
  const visibleToasts = notifications.slice(0, MAX_VISIBLE_TOASTS);

  return (
    <div className={styles.toastContainer}>
      {visibleToasts.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={dismiss} />
      ))}
    </div>
  );
}

/* ─── Notification Center Panel ─── */

function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function isToday(ts) {
  const now = new Date();
  const d = new Date(ts);
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function groupNotifications(notifications) {
  const today = [];
  const earlier = [];
  for (const n of notifications) {
    if (isToday(n.createdAt)) {
      today.push(n);
    } else {
      earlier.push(n);
    }
  }
  const groups = [];
  if (today.length > 0) groups.push({ label: 'Today', items: today });
  if (earlier.length > 0) groups.push({ label: 'Earlier', items: earlier });
  return groups;
}

export function NotificationCenter({ badgeCount }) {
  const { notifications, dismiss, clearAll } = useNotifications();
  const groups = groupNotifications(notifications);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.bellWrapper}>
            <span style={{ color: '#8B8D9A', width: 18, height: 18, display: 'flex' }}>
              {icons.bell}
            </span>
            {badgeCount > 0 && <span className={styles.badge}>{badgeCount > 99 ? '99+' : badgeCount}</span>}
          </span>
          <h2 className={styles.panelTitle}>Notifications</h2>
        </div>
        {notifications.length > 0 && (
          <button className={styles.clearAllBtn} onClick={clearAll}>
            Clear All
          </button>
        )}
      </div>

      <div className={styles.notifList}>
        {groups.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} style={{ color: '#5A5C6A' }}>
              {icons.bell}
            </span>
            <p className={styles.emptyText}>No notifications yet</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className={styles.groupLabel}>{group.label}</div>
              {group.items.map((n) => {
                const iconClass = {
                  success: styles.iconSuccess,
                  error: styles.iconError,
                  warning: styles.iconWarning,
                  info: styles.iconInfo,
                }[n.type];

                return (
                  <div key={n.id} className={styles.notifItem}>
                    <span className={`${styles.notifIcon} ${iconClass}`}>{icons[n.type]}</span>
                    <div className={styles.notifContent}>
                      <p className={styles.notifItemTitle}>{n.title}</p>
                      {n.message && <p className={styles.notifItemMessage}>{n.message}</p>}
                      <span className={styles.notifTimestamp}>{formatTime(n.createdAt)}</span>
                    </div>
                    <button
                      className={styles.notifDismiss}
                      onClick={() => dismiss(n.id)}
                      aria-label="Dismiss"
                    >
                      <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
