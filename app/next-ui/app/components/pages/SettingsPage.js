'use client';
import React, { useState } from 'react';
import {
  IconAI, IconDocker, IconRefresh, IconFolder, IconInfo, IconEye, IconExternalLink,
} from '../shared/Icons';
import s from './SettingsPage.module.css';

const MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Default)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-haiku-3-20250307', label: 'Claude 3.5 Haiku' },
];

const CONTAINERS = [
  { name: 'API Server', port: '8080', up: true },
  { name: 'Frontend', port: '3000', up: true },
  { name: 'Streamer', port: '9001–9002', up: true },
  { name: 'XRootD', port: '8081', up: true },
];

export default function SettingsPage({
  aiConfig = {},
  onSaveConfig,
  dockerConnected = true,
  updateAvailable = false,
  onCheckUpdates,
  onStartUpdate,
}) {
  const [apiKey, setApiKey] = useState(aiConfig.apiKey || '');
  const [model, setModel] = useState(aiConfig.model || MODELS[0].value);
  const [showKey, setShowKey] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const handleSave = () => {
    onSaveConfig?.({ apiKey, model });
  };

  const handleCheckUpdates = () => {
    setLastChecked(new Date().toLocaleString());
    onCheckUpdates?.();
  };

  return (
    <div className={s.page}>
      <div className={s.scrollArea}>
        <div className={s.container}>
          {/* Page Header */}
          <div className={s.pageHeader}>
            <h1>Settings</h1>
            <p>Configure your OpenCERN environment</p>
          </div>

          {/* ── AI Configuration ── */}
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <div className={s.sectionIcon}><IconAI size={16} /></div>
              <div>
                <h2 className={s.sectionTitle}>AI Configuration</h2>
                <p className={s.sectionDesc}>Anthropic Claude for physics analysis</p>
              </div>
            </div>
            <div className={s.sectionBody}>
              <div className={s.field}>
                <label className={s.label}>API Key</label>
                <div className={s.inputWrap}>
                  <input
                    className={`${s.input} ${s.inputWithBtn}`}
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    className={s.toggleBtn}
                    onClick={() => setShowKey(!showKey)}
                    type="button"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    <IconEye size={14} />
                  </button>
                </div>
                <div className={s.hint}>
                  Pay-per-token.{' '}
                  <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
                    Get a key →
                  </a>
                </div>
              </div>

              <div className={s.field}>
                <label className={s.label}>Default Model</label>
                <select
                  className={s.select}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className={s.btnRow}>
                <button className={s.btnPrimary} onClick={handleSave}>
                  Save Configuration
                </button>
              </div>
            </div>
          </div>

          {/* ── Docker Engine ── */}
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <div className={s.sectionIcon}><IconDocker size={16} /></div>
              <div>
                <h2 className={s.sectionTitle}>Docker Engine</h2>
                <p className={s.sectionDesc}>Container orchestration status</p>
              </div>
            </div>
            <div className={s.sectionBody}>
              <div className={s.statusRow}>
                <div className={`${s.statusDot} ${dockerConnected ? s.statusDotOnline : s.statusDotOffline}`} />
                <span className={s.statusText}>
                  {dockerConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className={s.containerList}>
                {CONTAINERS.map((c) => (
                  <div key={c.name} className={s.containerRow}>
                    <div className={s.containerInfo}>
                      <div className={`${s.containerDot} ${dockerConnected && c.up ? s.containerDotUp : s.containerDotDown}`} />
                      <span className={s.containerName}>{c.name}</span>
                    </div>
                    <span className={s.containerPort}>{c.port}</span>
                  </div>
                ))}
              </div>

              <div className={s.btnRow}>
                <button className={s.btnSecondary} disabled>
                  <IconRefresh size={13} />
                  Restart Containers
                </button>
              </div>
            </div>
          </div>

          {/* ── Updates ── */}
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <div className={s.sectionIcon}><IconRefresh size={16} /></div>
              <div>
                <h2 className={s.sectionTitle}>Updates</h2>
                <p className={s.sectionDesc}>Application version management</p>
              </div>
            </div>
            <div className={s.sectionBody}>
              <div className={s.versionRow}>
                <span className={s.versionLabel}>Current Version</span>
                <span className={s.versionBadge}>v0.2.0</span>
              </div>

              <div className={s.btnRow}>
                <button className={s.btnSecondary} onClick={handleCheckUpdates}>
                  Check for Updates
                </button>
                {updateAvailable && (
                  <button className={s.btnPrimary} onClick={onStartUpdate}>
                    Update Now
                  </button>
                )}
              </div>

              {updateAvailable && (
                <div className={s.updateBanner}>
                  <span className={s.updateBannerText}>
                    ⚡ A new version is available
                  </span>
                </div>
              )}

              <div className={s.lastChecked}>
                Last checked: {lastChecked || 'Never'}
              </div>
            </div>
          </div>

          {/* ── Storage ── */}
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <div className={s.sectionIcon}><IconFolder size={16} /></div>
              <div>
                <h2 className={s.sectionTitle}>Storage</h2>
                <p className={s.sectionDesc}>Local dataset directory</p>
              </div>
            </div>
            <div className={s.sectionBody}>
              <div className={s.pathDisplay}>
                <span className={s.pathText}>~/opencern-datasets</span>
                <button className={s.pathLink} type="button">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Open in Finder <IconExternalLink size={11} />
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* ── About (summary) ── */}
          <div className={s.section}>
            <div className={s.sectionHeader}>
              <div className={s.sectionIcon}><IconInfo size={16} /></div>
              <div>
                <h2 className={s.sectionTitle}>About</h2>
              </div>
            </div>
            <div className={s.sectionBody}>
              <p className={s.aboutSummary}>
                Built with Next.js, Electron &amp; FastAPI. Powered by Claude AI
                for intelligent physics analysis.<br />
                © 2025 OpenCERN Project.{' '}
                <a href="https://github.com/opencern" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
