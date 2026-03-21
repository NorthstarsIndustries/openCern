'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import s from './VisualizePage.module.css';
import { IconEye, IconMaximize, IconCamera } from '../shared/Icons';

const ParticleVisualization = dynamic(
  () => import('../../ParticleVisualization'),
  {
    ssr: false,
    loading: () => (
      <div className={s.loading}>
        <div className={s.spinner} />
        <span>Loading 3D renderer…</span>
      </div>
    ),
  }
);

export default function VisualizePage({ visualizeFile }) {
  if (!visualizeFile) {
    return (
      <div className={s.container}>
        <div className={s.emptyState}>
          <div className={s.emptyCard}>
            <div className={s.emptyIcon}>
              <IconEye size={28} />
            </div>
            <h2 className={s.emptyTitle}>3D Particle Collision Viewer</h2>
            <p className={s.emptyDescription}>
              Select a processed dataset from Local Storage to visualize
              particle collisions in 3D.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.container}>
      <div className={s.toolbar}>
        <div className={s.toolbarLeft}>
          <span className={s.filenameBadge}>
            <span className={s.filenameBadgeDot} />
            {visualizeFile}
          </span>
        </div>
        <div className={s.toolbarRight}>
          <button className={s.toolbarBtn} title="Toggle fullscreen" onClick={() => {}}>
            <IconMaximize size={16} />
          </button>
          <button className={s.toolbarBtn} title="Screenshot" onClick={() => {}}>
            <IconCamera size={16} />
          </button>
        </div>
      </div>
      <div className={s.vizArea}>
        <ParticleVisualization filename={visualizeFile} />
      </div>
    </div>
  );
}
