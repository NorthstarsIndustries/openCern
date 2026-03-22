import React, { useState, useEffect, useRef, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { LineLayer, ScatterplotLayer, PathLayer, ColumnLayer } from '@deck.gl/layers';
import { OrbitView } from '@deck.gl/core';
import { CanvasContext } from '@luma.gl/core';

// Patch luma.gl CanvasContext to guard against a race condition where the
// ResizeObserver fires before WebGLDevice finishes assigning `this.limits`.
// See: luma.gl v9.2.6 — CanvasContext constructor sets up a ResizeObserver
// that can call getMaxDrawingBufferSize() before the device's `limits` field
// is initialized, causing "Cannot read properties of undefined (reading
// 'maxTextureDimension2D')".
if (typeof CanvasContext?.prototype?.getMaxDrawingBufferSize === 'function') {
  const _origGetMaxSize = CanvasContext.prototype.getMaxDrawingBufferSize;
  CanvasContext.prototype.getMaxDrawingBufferSize = function () {
    if (!this.device?.limits) {
      // Return a safe default until the device is fully initialized.
      // 8192 is the minimum MAX_TEXTURE_SIZE guaranteed by WebGL2.
      return [8192, 8192];
    }
    return _origGetMaxSize.call(this);
  };
}

// Easing function for smooth animations
const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
const hexToRgb = hex => {
  const c = parseInt(hex.replace('#', ''), 16);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
};

export default function ParticleVisualization({ filename }) {
  const [events, setEvents] = useState([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const totalEvents = 5000;
  const [sourceFormat, setSourceFormat] = useState('');
  const [experiment, setExperiment] = useState('');
  const [synthetic, setSynthetic] = useState(false);

  // Guard: only mount DeckGL once the container has real pixel dimensions
  // so that luma.gl can obtain a valid WebGL2 context and query device limits.
  const containerRef = useRef(null);
  const [glReady, setGlReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setGlReady(true);
      }
    };

    // Initial check (may already be sized)
    check();

    const ro = new ResizeObserver(() => check());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wsRef = useRef(null);
  const [viewState, setViewState] = useState({
    target: [0, 0, 0],
    orbitAxis: 'Y',
    rotationX: 30,
    rotationOrbit: 45,
    zoom: -0.2,
    minZoom: -2,
    maxZoom: 10
  });

  const lastInteractionRef = useRef(0);
  const eventChangeTimeRef = useRef(0);
  const prevEventRef = useRef(null);
  const [now, setNow] = useState(0);

  // Connection and loading
  useEffect(() => {
    if (!filename) return;
    setLoading(true);
    setEvents([]);
    setProgress(0);
    setCurrentEventIndex(0);

    let ws = new WebSocket('ws://127.0.0.1:9001');
    wsRef.current = ws;

    let loadedEvents = [];

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'load', file: filename }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.eof) {
          setLoading(false);
          setEvents(loadedEvents);
          // Fetch metadata for format badge
          fetch(`http://127.0.0.1:9002/process/data?filename=${encodeURIComponent(filename)}&page=1&limit=1`)
            .then(r => r.json())
            .then(meta => {
              setSourceFormat(meta.metadata?.format || '');
              setExperiment(meta.metadata?.experiment || '');
              setSynthetic(meta.metadata?.synthetic || false);
            })
            .catch(() => {});
          ws.close();
        } else if (data.error) {
          console.error("Stream error:", data.error);
          setLoading(false);
          ws.close();
        } else {
          // Pre-calculate randomized Jet lines and stagger delays so we don't do it every frame
          data.particles.forEach(p => {
             p.staggerDelay = Math.random() * 15;
             if (p.type === 'jet') {
                 p.jetLines = [];
                 const pVec = [p.px, p.py, p.pz];
                 const mag = Math.sqrt(p.px*p.px + p.py*p.py + p.pz*p.pz);
                 const nx = p.px/mag, ny = p.py/mag, nz = p.pz/mag;
                 // create 8 random directions within 25 degrees (approx 0.43 radians)
                 for(let i=0; i<8; i++) {
                     const ang1 = (Math.random() - 0.5) * 0.43;
                     const ang2 = (Math.random() - 0.5) * 0.43;
                     // rough approximation of cone spread for visual effect
                     const dx = nx + ang1;
                     const dy = ny + ang2;
                     const dz = nz + (ang1*ang2);
                     const dmag = Math.sqrt(dx*dx + dy*dy + dz*dz);
                     p.jetLines.push([dx/dmag, dy/dmag, dz/dmag]);
                 }
                 // pre-calculate bjet highlight
             }
          });
          loadedEvents.push(data);
          setProgress(loadedEvents.length);
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [filename]);

  // Animation Loop
  useEffect(() => {
    let raf;
    const loop = () => {
      const currentNow = Date.now();
      setNow(currentNow);
      
      // Auto-rotation when idle
      const idleTime = currentNow - lastInteractionRef.current;
      if (idleTime > 8000) {
        setViewState(vs => ({
          ...vs,
          rotationOrbit: vs.rotationOrbit + 0.3 * (16 / 1000)
        }));
      }
      
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Handle Event Change
  /* eslint-disable react-hooks/purity */
  const handleEventChange = (idx) => {
    prevEventRef.current = events[currentEventIndex];
    eventChangeTimeRef.current = Date.now();
    setCurrentEventIndex(idx);
    lastInteractionRef.current = Date.now();
  };
  /* eslint-enable react-hooks/purity */

  const jumpToMaxHt = () => {
    if (events.length === 0) return;
    let maxHt = -1;
    let maxIdx = 0;
    events.forEach((e, idx) => {
      if (e.ht > maxHt) {
        maxHt = e.ht;
        maxIdx = idx;
      }
    });
    handleEventChange(maxIdx);
  };

  // Precompute static geometry
  const staticLines = useMemo(() => {
    const lines = [];
    const cOuter = [26, 42, 58]; // #1a2a3a
    const cInner = [21, 32, 48]; // #152030
    const cBeam = [36, 52, 71];  // #243447
    
    // helper to build a cylindrical wireframe cage
    const buildCylinder = (radius, zHalfLen, zStep, radialSegments, color, width) => {
        // Rings
        for (let z = -zHalfLen; z <= zHalfLen; z += zStep) {
            for (let i = 0; i < radialSegments; i++) {
                const a1 = (i / radialSegments) * Math.PI * 2;
                const a2 = ((i + 1) / radialSegments) * Math.PI * 2;
                lines.push({ 
                    source: [Math.cos(a1)*radius, Math.sin(a1)*radius, z], 
                    target: [Math.cos(a2)*radius, Math.sin(a2)*radius, z], 
                    color, width 
                });
            }
        }
        // Longitudinal lines
        for (let i = 0; i < radialSegments; i++) {
            const a = (i / radialSegments) * Math.PI * 2;
            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius;
            lines.push({ 
                source: [x, y, -zHalfLen], 
                target: [x, y, zHalfLen], 
                color, width 
            });
        }
    };

    // Outer Barrel: R=220, Z=±350, rings every 50, 32 segments
    buildCylinder(220, 350, 50, 32, cOuter, 0.5);
    
    // Endcaps: Z=±350, annulus from R=18 to R=220, 24 spokes + inner ring
    for (const z of [-350, 350]) {
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            lines.push({ 
                source: [Math.cos(a)*18, Math.sin(a)*18, z], 
                target: [Math.cos(a)*220, Math.sin(a)*220, z], 
                color: cOuter, width: 0.5 
            });
            // draw the inner hole ring
            const a2 = ((i + 1) / 24) * Math.PI * 2;
            lines.push({ 
                source: [Math.cos(a)*18, Math.sin(a)*18, z], 
                target: [Math.cos(a2)*18, Math.sin(a2)*18, z], 
                color: cOuter, width: 0.5 
            });
        }
    }
    
    // Inner Layer 2 (ECAL): R=140, Z=±350, rings every 50, 24 segments
    buildCylinder(140, 350, 50, 24, cInner, 0.3);
    
    // Inner Layer 1 (Tracker): R=80, Z=±350, rings every 50, 16 segments
    buildCylinder(80, 350, 50, 16, cInner, 0.3);

    // Beam Pipe: R=4, Z=±500, longitudinal lines, 8 segments
    buildCylinder(4, 500, 1000, 8, cBeam, 0.5);

    // Grid Z=0 Plane
    for (let x = -240; x <= 240; x += 20) {
        if (Math.abs(x) <= 250) {
            const bound = Math.sqrt(250*250 - x*x);
            lines.push({ source: [x, -bound, 0], target: [x, bound, 0], color: [26, 42, 58, 76], width: 0.5 });
        }
    }
    for (let y = -240; y <= 240; y += 20) {
        if (Math.abs(y) <= 250) {
            const bound = Math.sqrt(250*250 - y*y);
            lines.push({ source: [-bound, y, 0], target: [bound, y, 0], color: [26, 42, 58, 76], width: 0.5 });
        }
    }

    return lines;
  }, []);

  const stats = events[currentEventIndex] || null;

  const getLayers = () => {
    const layers = [];
    const elapsed = now - eventChangeTimeRef.current;
    
    // 1. Static Detector (Concentric Wireframes)
    // depthWrite: false ensures the cylinder wireframe acts purely visually and never clips particles
    layers.push(new LineLayer({
      id: 'detector-wireframe',
      data: staticLines,
      getSourcePosition: d => d.source,
      getTargetPosition: d => d.target,
      getColor: d => d.color,
      getWidth: d => d.width || 0.5,
      widthUnits: 'pixels',
      opacity: 0.4,
      parameters: {
        depthTest: true,
        depthWrite: false
      }
    }));

    if (!stats) return layers;

    // Transition Logic Calculate
    // Fade out old event (150ms)
    let oldOpacity = 1.0 - Math.min(1.0, elapsed / 150);
    // Collision Point Flash
    // scales up 3->12 over 80ms, contracts 12->3 over next 120ms
    let flashRadius = 3;
    let flashOpacity = 0.15; // default glow opacity
    let centerPulse = (Math.sin(now / 1500 * Math.PI) + 1) / 2; // slow 3s breath
    let centerRadius = 3 + centerPulse * 1;
    let glowRadius = 12 + centerPulse * 3;

    if (elapsed < 80) {
        flashRadius = 3 + (9 * (elapsed / 80));
        flashOpacity = 0.15 + (0.85 * (elapsed / 80));
        centerRadius = flashRadius;
        glowRadius = flashRadius + 5;
    } else if (elapsed < 200) {
        flashRadius = 12 - (9 * ((elapsed - 80) / 120));
        flashOpacity = 1.0 - (0.85 * ((elapsed - 80) / 120));
        centerRadius = flashRadius;
        glowRadius = flashRadius + 5;
    }

    // New Event Rendering
    const processParticles = (event, isOld) => {
        const tLines = [];
        const tHalos = [];
        const pTips = [];
        
        // if old, all lines full length but alpha faded.
        // if new, length animated.
        event.particles.forEach((p, idx) => {
            let factor = 1.0;
            let width = 2.5;
            let c = hexToRgb(p.color);
            let isJet = false;
            let isPhoton = false;

            if (p.type === 'muon') { factor = 1.0; width = 2.5; }
            else if (p.type === 'electron') { factor = 0.55; width = 1.5; }
            else if (p.type === 'jet') { factor = 0.40; width = 1.0; isJet = true; }
            else if (p.type === 'tau') { factor = 0.45; width = 1.5; }
            else if (p.type === 'photon') { factor = 0.55; width = 1.0; isPhoton = true; }

            const targetScale = (p.energy / 50.0) * factor * 1000;
            let currentScale = targetScale;

            let opacity = isOld ? oldOpacity : 1.0;

            if (!isOld) {
                // track animate in 0 to full over 400ms starting after flash + stagger
                const trackStart = 80 + p.staggerDelay;
                if (elapsed < trackStart) {
                    currentScale = 0;
                } else if (elapsed < trackStart + 400) {
                    const t = (elapsed - trackStart) / 400;
                    currentScale = targetScale * easeOutCubic(t);
                }
            }

            if (currentScale > 0 && opacity > 0) {
                let tx = p.px * currentScale;
                let ty = p.py * currentScale;
                let tz = p.pz * currentScale;
                
                // Cap strictly to the tracking cylinder (R=220, Z=±350) as requested
                const r_xy = Math.sqrt(tx*tx + ty*ty);
                if (r_xy > 220) {
                    const scale = 220 / r_xy;
                    tx *= scale; ty *= scale; tz *= scale;
                }
                if (tz > 350) {
                    const scale = 350 / tz;
                    tx *= scale; ty *= scale; tz *= scale;
                } else if (tz < -350) {
                    const scale = -350 / tz;
                    tx *= scale; ty *= scale; tz *= scale;
                }
                const r = Math.sqrt(tx*tx + ty*ty + tz*tz);

                if (isJet && p.jetLines) {
                    // render 8 lines
                    p.jetLines.forEach((jdir, jidx) => {
                        const jop = isOld ? oldOpacity * 0.4 : (0.4 + (jidx/8)*0.6);
                        const jtx = jdir[0] * r; const jty = jdir[1] * r; const jtz = jdir[2] * r;
                        tLines.push({ source: [0,0,0], target: [jtx, jty, jtz], color: [...c, Math.floor(jop*255)], width: 1 });
                    });
                    // B-tag dot
                    if (event.n_bjets > 0 && idx === 0) { // arbitrary mark first jet
                        pTips.push({ position: [tx, ty, tz], color: [0, 212, 255, Math.floor(opacity*255)], radius: 4 });
                    }
                } else {
                    tLines.push({ source: [0,0,0], target: [tx, ty, tz], color: [...c, Math.floor(opacity*255)], width });
                    // glowing halo
                    tHalos.push({ source: [0,0,0], target: [tx*1.2, ty*1.2, tz*1.2], color: [...c, Math.floor(opacity*0.15*255)], width: width*2 });
                    
                    if (isPhoton) {
                        pTips.push({ position: [tx, ty, tz], color: [255, 255, 255, Math.floor(opacity*255)], radius: 4 });
                    }
                }
            }
        });

        return { tLines, tHalos, pTips };
    };

    let allLines = [];
    let allHalos = [];
    let allTips = [];

    if (prevEventRef.current && oldOpacity > 0.01) {
        let oldD = processParticles(prevEventRef.current, true);
        allLines.push(...oldD.tLines); allHalos.push(...oldD.tHalos); allTips.push(...oldD.pTips);
    }
    
    let curD = processParticles(stats, false);
    allLines.push(...curD.tLines); allHalos.push(...curD.tHalos); allTips.push(...curD.pTips);

    layers.push(new LineLayer({
        id: 'particle-halos',
        data: allHalos,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: d => d.color,
        getWidth: d => d.width,
        widthUnits: 'pixels'
    }));

    layers.push(new LineLayer({
        id: 'particle-tracks',
        data: allLines,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: d => d.color,
        getWidth: d => d.width,
        widthUnits: 'pixels'
    }));

    layers.push(new ScatterplotLayer({
        id: 'particle-tips',
        data: allTips,
        getPosition: d => d.position,
        getFillColor: d => d.color,
        getRadius: d => d.radius,
        radiusUnits: 'pixels'
    }));

    // Collision Point & Glow
    layers.push(new ScatterplotLayer({
        id: 'vertex-glow',
        data: [{ position: [0, 0, 0] }],
        getPosition: d => d.position,
        getFillColor: [255, 255, 255, Math.floor(flashOpacity * 255)],
        getRadius: glowRadius,
        radiusUnits: 'pixels',
        parameters: { blendFunc: ['SRC_ALPHA', 'ONE', 'ONE', 'ONE'], blendEquation: 'FUNC_ADD' } // Additive
    }));

    layers.push(new ScatterplotLayer({
        id: 'vertex-core',
        data: [{ position: [0, 0, 0] }],
        getPosition: d => d.position,
        getFillColor: [255, 255, 255, 255],
        getRadius: centerRadius,
        radiusUnits: 'pixels'
    }));

    // MET Arrow
    if (stats.met_vector) {
        let metTargetLength = Math.min(stats.met_vector.pt * 0.003, 180);
        let metLength = 0;
        let metOpacity = 1.0;
        
        let metPulse = (Math.sin(now / 1000 * Math.PI) + 1) / 2; // 2s cycle from 0 to 1
        metOpacity = 0.6 + (0.4 * metPulse);

        // Slides in from 0 over 300ms starting at 280ms
        if (elapsed > 280) {
            if (elapsed < 580) {
                const t = (elapsed - 280) / 300;
                metLength = metTargetLength * easeOutCubic(t);
            } else {
                metLength = metTargetLength;
            }
        }

        if (metLength > 0.1) {
            const mtx = Math.cos(stats.met_vector.phi) * metLength;
            const mty = Math.sin(stats.met_vector.phi) * metLength;
// We will use precise multiple LineLayers for dashes to avoid heavy SSR extension issues
            const dashLen = 12;
            const gapLen = 6;
            const totalDash = dashLen + gapLen;
            const numDashes = Math.floor(metLength / totalDash);
            const metDashes = [];
            for (let i = 0; i <= numDashes; i++) {
                const startR = i * totalDash;
                const endR = Math.min(startR + dashLen, metLength);
                if (startR >= metLength) break;
                metDashes.push({
                    source: [Math.cos(stats.met_vector.phi)*startR, Math.sin(stats.met_vector.phi)*startR, 0],
                    target: [Math.cos(stats.met_vector.phi)*endR, Math.sin(stats.met_vector.phi)*endR, 0]
                });
            }
            
            // Arrow head
            const headLen = 15;
            const tip = [mtx, mty, 0];
            const a1 = stats.met_vector.phi + (150 * Math.PI / 180);
            const a2 = stats.met_vector.phi - (150 * Math.PI / 180);
            metDashes.push({ source: tip, target: [mtx + Math.cos(a1)*headLen, mty + Math.sin(a1)*headLen, 0] });
            metDashes.push({ source: tip, target: [mtx + Math.cos(a2)*headLen, mty + Math.sin(a2)*headLen, 0] });

            layers.push(new LineLayer({
                id: 'met-dashes',
                data: metDashes,
                getSourcePosition: d => d.source,
                getTargetPosition: d => d.target,
                getColor: [255, 107, 53, Math.floor(metOpacity*255)],
                getWidth: 4,
                widthUnits: 'pixels'
            }));
            // met glow
            layers.push(new LineLayer({
                id: 'met-glow',
                data: metDashes,
                getSourcePosition: d => d.source,
                getTargetPosition: d => d.target,
                getColor: [255, 107, 53, Math.floor(metOpacity*0.3*255)],
                getWidth: 10,
                widthUnits: 'pixels'
            }));
        }
    }

    return layers;
  };

  const hudParticleCounts = stats ? stats.particles.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {}) : {};
  const typeDots = { muon: '#ff6b6b', electron: '#7fbbb3', jet: '#dbbc7f', tau: '#d699b6', photon: '#ffffff' };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(circle at center, #0d1117 0%, #080b14 70%)', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1f2937' }}>
      
      {/* Background canvas filler */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} 
           onMouseDown={() => lastInteractionRef.current = Date.now()}
           onWheel={() => lastInteractionRef.current = Date.now()}
           onKeyDown={() => lastInteractionRef.current = Date.now()} >
          {glReady && (
            <DeckGL
              views={new OrbitView({ id: 'orbit-view', orbitAxis: 'Y' })}
              viewState={viewState}
              onViewStateChange={({ viewState }) => { lastInteractionRef.current = Date.now(); setViewState(viewState); }}
              controller={{ doubleClickZoom: false, touchRotate: true }}
              layers={getLayers()}
              style={{ width: '100%', height: '100%' }}
              getCursor={({isHovering, isDragging}) => isDragging ? 'grabbing' : 'grab'}
              onError={(error) => console.warn('DeckGL initialization error:', error)}
            />
          )}
      </div>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: 'rgba(8, 11, 20, 0.7)' }}>
          <div style={{ fontSize: '11px', color: '#4a6080', fontFamily: 'var(--font-geist-mono), monospace', letterSpacing: '3px', marginBottom: '8px' }}>
            LOADING COLLISION DATA
          </div>
          <div style={{ width: '280px', height: '3px', background: '#1e2d45', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ height: '100%', background: '#00d4ff', width: `${Math.min(100, (progress / totalEvents) * 100)}%`, transition: 'width 0.1s linear' }} />
          </div>
          <div style={{ fontSize: '12px', color: '#e2eaf7', fontFamily: 'var(--font-geist-mono), monospace' }}>
            {progress.toLocaleString()} / {totalEvents.toLocaleString()} events
          </div>
        </div>
      )}

      {/* Stats Overlay - Top Right */}
      {!loading && stats && (
        <div style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(8, 11, 20, 0.88)', border: '1px solid #1e2d45', borderRadius: '6px', padding: '16px 20px', width: '220px', zIndex: 5, fontFamily: 'var(--font-geist-mono), monospace' }}>
          {/* Format / Experiment Badge */}
          {(sourceFormat || experiment) && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {sourceFormat && sourceFormat !== 'json' && (
                <span style={{ background: '#1e2d45', color: '#00d4ff', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 600 }}>{sourceFormat}</span>
              )}
              {experiment && (
                <span style={{ background: '#1e2d45', color: '#a7c080', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>{experiment}</span>
              )}
              {synthetic && (
                <span style={{ background: 'rgba(255, 200, 0, 0.15)', color: '#ffc800', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>SYNTHETIC</span>
              )}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ color: '#4a6080', fontSize: '10px', fontWeight: 600 }}>EVENT</span>
             <span style={{ color: '#e2eaf7', fontSize: '10px' }}>{stats.index}</span>
          </div>
          <div style={{ height: '1px', background: '#1e2d45', margin: '12px 0' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4a6080' }}>HT</span>
                  <span style={{ color: '#dbbc7f' }}>{stats.ht.toLocaleString(undefined, {maximumFractionDigits:0})} GeV</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4a6080' }}>MET</span>
                  <span style={{ color: '#ff6b35' }}>{stats.met.toLocaleString(undefined, {maximumFractionDigits:0})} GeV</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4a6080' }}>b-JETS</span>
                  <span style={{ color: '#00d4ff' }}>{stats.n_bjets}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#4a6080' }}>L-PT</span>
                  <span style={{ color: '#e2eaf7' }}>{stats.leading_lepton_pt.toFixed(1)} GeV</span>
              </div>
          </div>
          <div style={{ height: '1px', background: '#1e2d45', margin: '12px 0' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', lineHeight: 1.8 }}>
            {['muon', 'electron', 'jet', 'tau', 'photon'].map(type => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: typeDots[type] }} />
                  <span style={{ color: '#4a6080', textTransform: 'uppercase' }}>{type}</span>
                </div>
                <span style={{ color: '#e2eaf7' }}>&times;{hudParticleCounts[type] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Overlay - Bottom Center */}
      {!loading && events.length > 0 && (
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'rgba(8, 11, 20, 0.92)', borderTop: '1px solid #1e2d45', height: '52px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '16px', zIndex: 10, fontFamily: 'var(--font-geist-mono), monospace' }}>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              disabled={currentEventIndex <= 0} 
              onClick={() => handleEventChange(currentEventIndex - 1)}
              style={{ background: 'transparent', color: currentEventIndex <= 0 ? '#4a6080' : '#4a6080', border: '1px solid #1e2d45', padding: '4px 12px', fontSize: '11px', cursor: currentEventIndex <= 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { if(currentEventIndex > 0) { e.currentTarget.style.color='#00d4ff'; e.currentTarget.style.borderColor='#00d4ff'; } }}
              onMouseLeave={e => { e.currentTarget.style.color='#4a6080'; e.currentTarget.style.borderColor='#1e2d45'; }}
            >
              ← PREV
            </button>
            <button 
              disabled={currentEventIndex >= events.length - 1} 
              onClick={() => handleEventChange(currentEventIndex + 1)}
              style={{ background: 'transparent', color: currentEventIndex >= events.length - 1 ? '#4a6080' : '#4a6080', border: '1px solid #1e2d45', padding: '4px 12px', fontSize: '11px', cursor: currentEventIndex >= events.length - 1 ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { if(currentEventIndex < events.length - 1) { e.currentTarget.style.color='#00d4ff'; e.currentTarget.style.borderColor='#00d4ff'; } }}
              onMouseLeave={e => { e.currentTarget.style.color='#4a6080'; e.currentTarget.style.borderColor='#1e2d45'; }}
            >
              NEXT →
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <input 
              type="range" 
              min="0" 
              max={events.length - 1} 
              value={currentEventIndex} 
              onChange={(e) => handleEventChange(parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', appearance: 'none', background: `linear-gradient(to right, #00d4ff ${(currentEventIndex / (events.length - 1)) * 100}%, #1e2d45 ${(currentEventIndex / (events.length - 1)) * 100}%)`, height: '3px', outline: 'none' }}
              className="custom-scrubber"
            />
            <style>{`
              .custom-scrubber::-webkit-slider-thumb {
                appearance: none; width: 14px; height: 14px; border-radius: 50%;
                background: #00d4ff; border: 2px solid #080b14; transition: transform 0.15s;
              }
              .custom-scrubber::-webkit-slider-thumb:hover { transform: scale(1.28); }
            `}</style>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#e2eaf7', fontSize: '12px' }}>{currentEventIndex + 1} / {events.length}</span>
            <button onClick={jumpToMaxHt} title="Jump to highest energy event"
              style={{ background: 'transparent', color: '#dbbc7f', border: '1px solid #dbbc7f', padding: '4px 12px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              ⚡ MAX HT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
