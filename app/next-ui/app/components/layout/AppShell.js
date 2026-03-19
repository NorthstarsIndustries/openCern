'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { useIsElectron } from '../../ConvexClientProvider';
import {
  IconSearch, IconFolder, IconFile, IconEye, IconAI, IconSettings,
  IconDownload, IconBell, IconCommand, IconX, IconPause, IconPlay,
  LogoMark,
} from '../shared/Icons';
import CommandPalette from '../features/CommandPalette';
import s from './AppShell.module.css';

const NAV_ITEMS = [
  { id: 'browse', label: 'Discover', icon: IconSearch },
  { id: 'downloaded', label: 'Storage', icon: IconFolder },
  { id: 'workspace', label: 'Workspace', icon: IconFile },
  { id: 'visualize', label: 'Visualize', icon: IconEye },
  { id: 'ai', label: 'AI Analysis', icon: IconAI },
  { id: 'settings', label: 'Settings', icon: IconSettings },
];

const PAGE_TITLES = {
  browse: 'Discover Datasets',
  downloaded: 'Local Storage',
  workspace: 'Workspace',
  visualize: '3D Visualization',
  ai: 'AI Analysis',
  settings: 'Settings',
  about: 'About',
};

export default function AppShell({
  children,
  activeTab,
  onTabChange,
  downloaded = [],
  downloading = {},
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onCommandPalette,
  updateAvailable = false,
  dockerConnected = true,
}) {
  const [showDownloads, setShowDownloads] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const activeDownloads = Object.keys(downloading).length;
  const electron = useIsElectron();

  return (
    <div className={s.shell}>
      {/* Sidebar */}
      <div className={s.sidebar}>
        {/* Brand */}
        <div className={s.sidebarBrand}>
          <LogoMark />
          <div className={s.brandText}>
            <span className={s.brandName}>OpenCERN</span>
            <span className={s.brandSub}>Particle Physics Platform</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className={s.nav}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`${s.navItem} ${isActive ? s.navItemActive : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span className={s.navIcon}><Icon size={18} /></span>
                <span className={s.navLabel}>{item.label}</span>
                {item.id === 'downloaded' && downloaded.length > 0 && (
                  <span className={s.navBadge}>{downloaded.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className={s.sidebarBottom}>
          {/* Download Manager */}
          <div style={{ position: 'relative' }}>
            <button
              className={`${s.navItem} ${showDownloads ? s.navItemActive : ''}`}
              onClick={() => setShowDownloads(!showDownloads)}
            >
              <span className={s.navIcon}><IconDownload size={18} /></span>
              <span className={s.navLabel}>Downloads</span>
              {activeDownloads > 0 && (
                <span style={{
                  marginLeft: 'auto', width: 6, height: 6,
                  background: 'var(--oc-blue-light)', borderRadius: '50%',
                  boxShadow: '0 0 6px var(--oc-blue-light)',
                }} />
              )}
            </button>

            {/* Downloads flyout */}
            {showDownloads && (
              <div className={s.downloadsFlyout}>
                <div className={s.downloadsFlyoutHeader}>
                  <span>Downloads</span>
                  <button
                    onClick={() => setShowDownloads(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--oc-text-muted)', cursor: 'pointer' }}
                  >
                    <IconX size={14} />
                  </button>
                </div>
                {activeDownloads === 0 ? (
                  <div style={{ fontSize: 'var(--oc-text-sm)', color: 'var(--oc-text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    No active downloads
                  </div>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {Object.entries(downloading || {}).map(([fname, info]) => (
                      <div key={fname} className={s.downloadItem}>
                        <div className={s.downloadItemHeader}>
                          <div className={s.downloadItemTitle} title={info.dataset?.title}>
                            {info.dataset?.title || fname}
                          </div>
                          <div className={s.downloadItemPercent}>{(info.progress || 0).toFixed(0)}%</div>
                        </div>
                        <div className={s.progressTrack}>
                          <div
                            className={`${s.progressFill} ${info.status === 'paused' ? s.progressYellow : s.progressBlue}`}
                            style={{ width: `${info.progress || 0}%` }}
                          />
                        </div>
                        <div className={s.downloadActions}>
                          {info.status === 'paused' ? (
                            <button className={s.downloadActionBtn} onClick={() => onResumeDownload?.(fname)}>
                              <IconPlay size={12} />
                            </button>
                          ) : (
                            <button className={s.downloadActionBtn} onClick={() => onPauseDownload?.(fname)}>
                              <IconPause size={12} />
                            </button>
                          )}
                          <button className={`${s.downloadActionBtn} ${s.downloadActionBtnDanger}`} onClick={() => onCancelDownload?.(fname)}>
                            <IconX size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Update available */}
          {updateAvailable && (
            <div className={s.updateBadge}>
              ⚡ Update available
            </div>
          )}

          {/* Docker status */}
          <div className={s.statusRow}>
            <div className={`${s.statusDot} ${dockerConnected ? s.statusDotOnline : s.statusDotOffline}`} />
            <span>{dockerConnected ? 'Engine Connected' : 'Engine Offline'}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={s.main}>
        {/* Header */}
        <div className={s.header}>
          <div className={s.breadcrumb}>
            <span>OpenCERN</span>
            <span className={s.breadcrumbSep}>/</span>
            <span className={s.breadcrumbActive}>{PAGE_TITLES[activeTab] || activeTab}</span>
          </div>

          <div className={s.headerActions}>
            <button className={s.cmdKBadge} onClick={() => setCmdPaletteOpen(true)}>
              <IconCommand size={12} />
              <span>Search</span>
              <kbd style={{ fontSize: 10, opacity: 0.6 }}>⌘K</kbd>
            </button>
            <span className={s.versionBadge}>v0.2.0</span>
            {!electron && (
              <>
                <SignedOut>
                  <div style={{
                    background: 'var(--oc-blue-light)', color: '#fff',
                    padding: '4px 14px', borderRadius: 'var(--oc-radius-md)',
                    fontSize: 'var(--oc-text-sm)', fontWeight: 500, cursor: 'pointer',
                  }}>
                    <SignInButton />
                  </div>
                </SignedOut>
                <SignedIn>
                  <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} />
                </SignedIn>
              </>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className={s.content}>
          {children}
        </div>
      </div>
      <CommandPalette 
        isOpen={cmdPaletteOpen} 
        onClose={() => setCmdPaletteOpen(false)} 
        onNavigate={(page) => { onTabChange(page); setCmdPaletteOpen(false); }} 
        onAction={(act) => { setCmdPaletteOpen(false); /* handle act later */ }} 
      />
    </div>
  );
}
