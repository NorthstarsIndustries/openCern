'use client';
import React from 'react';
import { LogoMark, IconExternalLink, IconGlobe, IconDatabase } from '../shared/Icons';
import s from './AboutPage.module.css';

const TECH_STACK = [
  { name: 'Next.js', color: '#ECEDF0' },
  { name: 'Electron', color: '#9FEAF9' },
  { name: 'FastAPI', color: '#10B981' },
  { name: 'deck.gl', color: '#F59E0B' },
  { name: 'Claude AI', color: '#D4A574' },
];

export default function AboutPage() {
  return (
    <div className={s.page}>
      <div className={s.scrollArea}>
        <div className={s.card}>
          {/* Brand */}
          <div className={s.brand}>
            <div className={s.logo}>
              <LogoMark size={48} />
            </div>
            <h1 className={s.title}>OpenCERN</h1>
            <p className={s.subtitle}>Particle Physics Analysis Platform</p>
            <span className={s.versionBadge}>v0.2.0</span>
          </div>

          {/* Description */}
          <p className={s.description}>
            A desktop application for browsing, downloading, and analyzing
            particle physics datasets from the CERN Open Data portal. Combines
            interactive 3D event visualization with AI-powered analysis to make
            high-energy physics research accessible to everyone.
          </p>

          <hr className={s.divider} />

          {/* Tech Stack */}
          <div className={s.sectionLabel}>Built With</div>
          <div className={s.techGrid}>
            {TECH_STACK.map((t) => (
              <span key={t.name} className={s.techBadge}>
                <span className={s.techDot} style={{ background: t.color }} />
                {t.name}
              </span>
            ))}
          </div>

          {/* Links */}
          <div className={s.sectionLabel}>Resources</div>
          <div className={s.links}>
            <a
              className={s.link}
              href="http://opendata.cern.ch"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconGlobe size={14} />
              CERN Open Data Portal
              <IconExternalLink size={11} />
            </a>
            <a
              className={s.link}
              href="https://github.com/opencern"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconDatabase size={14} />
              GitHub
              <IconExternalLink size={11} />
            </a>
          </div>

          {/* Copyright */}
          <p className={s.copyright}>© 2025 OpenCERN Project. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
