// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
//
// 20 physics analysis commands for HEP data analysis.

import { readFileSync, existsSync } from 'fs';

// ─── Types ──────────────────────────────────────────────────────

interface Particle {
  type?: string;
  pt?: number;
  eta?: number;
  phi?: number;
  energy?: number;
  charge?: number;
  mass?: number;
  px?: number;
  py?: number;
  pz?: number;
}

interface HEPEvent {
  eventId?: number;
  particles?: Particle[];
  jets?: Particle[];
  met?: number;
  metPhi?: number;
  ht?: number;
  nPV?: number;
  [key: string]: unknown;
}

// ─── Helpers ────────────────────────────────────────────────────

function loadEvents(filePath: string): HEPEvent[] {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  return raw.events || (Array.isArray(raw) ? raw : []);
}

function particlesOfType(event: HEPEvent, type: string): Particle[] {
  if (!event.particles) return [];
  return event.particles.filter(p => p.type?.toLowerCase() === type.toLowerCase());
}

function fourMomentum(p: Particle): { E: number; px: number; py: number; pz: number } {
  if (p.px !== undefined && p.py !== undefined && p.pz !== undefined && p.energy !== undefined) {
    return { E: p.energy, px: p.px, py: p.py, pz: p.pz };
  }
  const pt = p.pt || 0;
  const eta = p.eta || 0;
  const phi = p.phi || 0;
  const mass = p.mass || 0;
  const px = pt * Math.cos(phi);
  const py = pt * Math.sin(phi);
  const pz = pt * Math.sinh(eta);
  const E = p.energy || Math.sqrt(px * px + py * py + pz * pz + mass * mass);
  return { E, px, py, pz };
}

function invariantMass2(p1: Particle, p2: Particle): number {
  const a = fourMomentum(p1);
  const b = fourMomentum(p2);
  const E = a.E + b.E;
  const px = a.px + b.px;
  const py = a.py + b.py;
  const pz = a.pz + b.pz;
  return E * E - px * px - py * py - pz * pz;
}

function histogram(values: number[], bins: number, title: string): string[] {
  if (values.length === 0) return ['  [-] No values to histogram'];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bw = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / bw), bins - 1);
    counts[idx]++;
  }
  const maxCount = Math.max(...counts);
  const barScale = 40;
  const lines = [
    '', `  ${title}`,
    '  ────────────────────────────────────────',
    `  ${values.length} entries, range [${min.toFixed(2)}, ${max.toFixed(2)}]`, '',
  ];
  for (let i = 0; i < bins; i++) {
    const lo = (min + i * bw).toFixed(1);
    const barLen = Math.round((counts[i] / maxCount) * barScale);
    lines.push(`  ${lo.padStart(8)} | ${'█'.repeat(barLen)} ${counts[i]}`);
  }
  lines.push('');

  // Stats
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  lines.push(`  Mean: ${mean.toFixed(3)}, Std: ${std.toFixed(3)}, Entries: ${values.length}`);
  lines.push('');
  return lines;
}

function checkFile(filePath: string): string | null {
  if (!filePath) return '  [-] No file specified. Usage: /command <file>';
  if (!existsSync(filePath)) return `  [-] File not found: ${filePath}`;
  return null;
}

// ─── Commands ───────────────────────────────────────────────────

// 1. /invariant-mass
export function invariantMassCmd(
  filePath: string,
  particle1: string = 'muon',
  particle2: string = 'muon',
): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const masses: number[] = [];

  for (const ev of events) {
    const p1List = particlesOfType(ev, particle1);
    const p2List = particle1 === particle2 ? p1List : particlesOfType(ev, particle2);

    if (particle1 === particle2) {
      for (let i = 0; i < p1List.length; i++) {
        for (let j = i + 1; j < p1List.length; j++) {
          // Require opposite charge for same-type
          if (p1List[i].charge !== undefined && p1List[j].charge !== undefined &&
              p1List[i].charge === p1List[j].charge) continue;
          const m2 = invariantMass2(p1List[i], p1List[j]);
          if (m2 > 0) masses.push(Math.sqrt(m2));
        }
      }
    } else {
      for (const a of p1List) {
        for (const b of p2List) {
          const m2 = invariantMass2(a, b);
          if (m2 > 0) masses.push(Math.sqrt(m2));
        }
      }
    }
  }

  if (masses.length === 0) {
    return [`  [-] No ${particle1}-${particle2} pairs found in ${events.length} events`];
  }

  const lines = histogram(masses, 25, `Invariant Mass: ${particle1}+${particle2} (GeV)`);

  // Look for known resonances
  const mean = masses.reduce((a, b) => a + b, 0) / masses.length;
  const knownPeaks = [
    { name: 'J/ψ', mass: 3.097 }, { name: 'Υ', mass: 9.460 },
    { name: 'Z⁰', mass: 91.188 }, { name: 'H⁰', mass: 125.25 },
    { name: 'W±', mass: 80.377 }, { name: 'top', mass: 172.69 },
  ];
  for (const peak of knownPeaks) {
    if (Math.abs(mean - peak.mass) / peak.mass < 0.15) {
      lines.push(`  Possible resonance: ${peak.name} (expected ${peak.mass} GeV)`);
    }
  }

  return lines;
}

// 2. /transverse-mass
export function transverseMassCmd(filePath: string, leptonType: string = 'muon'): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const mtValues: number[] = [];

  for (const ev of events) {
    const leptons = particlesOfType(ev, leptonType);
    const met = ev.met ?? 0;
    const metPhi = ev.metPhi ?? 0;

    for (const lep of leptons) {
      const pt1 = lep.pt ?? 0;
      const phi1 = lep.phi ?? 0;
      const dphi = phi1 - metPhi;
      const mt = Math.sqrt(2 * pt1 * met * (1 - Math.cos(dphi)));
      if (mt > 0 && !isNaN(mt)) mtValues.push(mt);
    }
  }

  if (mtValues.length === 0) return ['  [-] No lepton+MET pairs found'];
  return histogram(mtValues, 25, `Transverse Mass: ${leptonType}+MET (GeV)`);
}

// 3. /rapidity
export function rapidityCmd(filePath: string, particleType?: string): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const yValues: number[] = [];

  for (const ev of events) {
    const particles = particleType
      ? particlesOfType(ev, particleType)
      : (ev.particles || []);
    for (const p of particles) {
      const fm = fourMomentum(p);
      if (fm.E > Math.abs(fm.pz)) {
        const y = 0.5 * Math.log((fm.E + fm.pz) / (fm.E - fm.pz));
        if (isFinite(y)) yValues.push(y);
      }
    }
  }

  if (yValues.length === 0) return ['  [-] No particles with valid rapidity'];
  return histogram(yValues, 25, 'Rapidity Distribution');
}

// 4. /pseudorapidity
export function pseudorapidityCmd(filePath: string, particleType?: string): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const etaValues: number[] = [];

  for (const ev of events) {
    const particles = particleType
      ? particlesOfType(ev, particleType)
      : (ev.particles || []);
    for (const p of particles) {
      if (p.eta !== undefined) {
        etaValues.push(p.eta);
      }
    }
  }

  if (etaValues.length === 0) return ['  [-] No particles with eta values'];
  return histogram(etaValues, 25, `Pseudorapidity (η) Distribution${particleType ? `: ${particleType}` : ''}`);
}

// 5. /delta-r
export function deltaRCmd(filePath: string, type1: string = 'muon', type2: string = 'jet'): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const drValues: number[] = [];

  for (const ev of events) {
    const list1 = particlesOfType(ev, type1);
    const list2 = type1 === type2 ? list1 : particlesOfType(ev, type2);

    for (const a of list1) {
      for (const b of list2) {
        if (a === b) continue;
        const deta = (a.eta ?? 0) - (b.eta ?? 0);
        let dphi = (a.phi ?? 0) - (b.phi ?? 0);
        while (dphi > Math.PI) dphi -= 2 * Math.PI;
        while (dphi < -Math.PI) dphi += 2 * Math.PI;
        const dr = Math.sqrt(deta * deta + dphi * dphi);
        drValues.push(dr);
      }
    }
  }

  if (drValues.length === 0) return [`  [-] No ${type1}-${type2} pairs found`];
  return histogram(drValues, 25, `ΔR(${type1}, ${type2})`);
}

// 6. /cross-section
export function crossSectionCmd(
  filePath: string,
  luminosity: number = 1.0,
  efficiency: number = 1.0,
): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const N = events.length;
  const sigma = N / (luminosity * efficiency);

  return [
    '',
    '  Cross-Section Estimate',
    '  ────────────────────────────────────────',
    `  Events (N):        ${N.toLocaleString()}`,
    `  Luminosity (L):    ${luminosity} fb⁻¹`,
    `  Efficiency (ε):    ${(efficiency * 100).toFixed(1)}%`,
    `  σ = N / (L × ε):  ${sigma.toFixed(2)} fb`,
    '',
    `  Statistical uncertainty: ±${(sigma / Math.sqrt(N)).toFixed(2)} fb (√N)`,
    '',
  ];
}

// 7. /luminosity
export function luminosityCmd(filePath: string): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const meta = raw.metadata || {};

  return [
    '',
    '  Luminosity Information',
    '  ────────────────────────────────────────',
    `  Integrated luminosity: ${meta.luminosity || 'N/A'}`,
    `  Energy:               ${meta.energy || 'N/A'}`,
    `  Experiment:           ${meta.experiment || 'N/A'}`,
    `  Run period:           ${meta.runPeriod || 'N/A'}`,
    `  Total events:         ${(raw.events?.length || 0).toLocaleString()}`,
    '',
  ];
}

// 8. /efficiency
export function efficiencyCmd(filePath: string, cuts: Record<string, string>): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const total = events.length;

  let passing = events;
  const lines = [
    '', '  Selection Efficiency',
    '  ────────────────────────────────────────',
    `  Total events: ${total}`, '',
    `  ${'Cut'.padEnd(30)} ${'Pass'.padEnd(10)} ${'Eff'.padEnd(10)} Cumulative`,
    '  ' + '─'.repeat(65),
  ];

  for (const [field, condition] of Object.entries(cuts)) {
    const gtMatch = condition.match(/^>(\d+\.?\d*)$/);
    const ltMatch = condition.match(/^<(\d+\.?\d*)$/);

    if (gtMatch) {
      const thr = parseFloat(gtMatch[1]);
      passing = passing.filter(e => {
        const p = e.particles?.[0];
        const val = Number((e as any)[field] ?? (p as any)?.[field]);
        return val > thr;
      });
    } else if (ltMatch) {
      const thr = parseFloat(ltMatch[1]);
      passing = passing.filter(e => {
        const p = e.particles?.[0];
        const val = Number((e as any)[field] ?? (p as any)?.[field]);
        return val < thr;
      });
    }

    const eff = total > 0 ? (passing.length / total * 100).toFixed(1) : '0.0';
    lines.push(`  ${(`${field}${condition}`).padEnd(30)} ${String(passing.length).padEnd(10)} ${(eff + '%').padEnd(10)} ${eff}%`);
  }

  lines.push('');
  return lines;
}

// 9. /cutflow
export function cutflowCmd(filePath: string, cutSpecs: string[]): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  let remaining = [...events];

  const lines = [
    '', '  Cutflow',
    '  ────────────────────────────────────────',
    `  ${'Cut'.padEnd(35)} ${'Events'.padEnd(10)} ${'Rel. ε'.padEnd(10)} Abs. ε`,
    '  ' + '─'.repeat(70),
    `  ${'No cuts'.padEnd(35)} ${String(events.length).padEnd(10)} ${'100.0%'.padEnd(10)} 100.0%`,
  ];

  for (const spec of cutSpecs) {
    const before = remaining.length;
    // Parse cut: "pt>20", "eta<2.5", "type=muon"
    const match = spec.match(/^(\w+)([><=!]+)(.+)$/);
    if (!match) continue;
    const [, field, op, valStr] = match;

    remaining = remaining.filter(ev => {
      const particles = ev.particles || [];
      // Check event-level first, then particle-level
      let val = (ev as any)[field];
      if (val === undefined && particles.length > 0) {
        val = (particles[0] as any)[field];
      }
      if (val === undefined) return false;

      if (op === '>' || op === '>=') return Number(val) >= parseFloat(valStr);
      if (op === '<' || op === '<=') return Number(val) <= parseFloat(valStr);
      if (op === '=' || op === '==') return String(val) === valStr;
      if (op === '!=') return String(val) !== valStr;
      return true;
    });

    const relEff = before > 0 ? (remaining.length / before * 100).toFixed(1) : '0.0';
    const absEff = events.length > 0 ? (remaining.length / events.length * 100).toFixed(1) : '0.0';
    lines.push(`  ${spec.padEnd(35)} ${String(remaining.length).padEnd(10)} ${(relEff + '%').padEnd(10)} ${absEff}%`);
  }

  lines.push('');
  lines.push(`  Final: ${remaining.length} / ${events.length} events (${(events.length > 0 ? remaining.length / events.length * 100 : 0).toFixed(1)}%)`);
  lines.push('');
  return lines;
}

// 10. /significance
export function significanceCmd(
  filePath: string,
  signalRange: [number, number],
  bgRange: [number, number][],
  field: string = 'mass',
): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const values: number[] = [];
  for (const ev of events) {
    const particles = ev.particles || [];
    for (const p of particles) {
      const v = Number((p as any)[field] ?? (ev as any)[field]);
      if (!isNaN(v)) values.push(v);
    }
  }

  const S = values.filter(v => v >= signalRange[0] && v <= signalRange[1]).length;
  let B = 0;
  for (const [lo, hi] of bgRange) {
    B += values.filter(v => v >= lo && v <= hi).length;
  }
  // Scale background to signal window width
  const sigWidth = signalRange[1] - signalRange[0];
  let bgWidth = 0;
  for (const [lo, hi] of bgRange) bgWidth += hi - lo;
  const Bscaled = bgWidth > 0 ? B * sigWidth / bgWidth : B;

  const simpleZ = Bscaled > 0 ? S / Math.sqrt(Bscaled) : 0;
  const asimovZ = Bscaled > 0
    ? Math.sqrt(2 * ((S + Bscaled) * Math.log(1 + S / Bscaled) - S))
    : 0;

  return [
    '',
    '  Significance Estimate',
    '  ────────────────────────────────────────',
    `  Signal region:   [${signalRange[0]}, ${signalRange[1]}] GeV`,
    `  Signal events:   ${S}`,
    `  Background est:  ${Bscaled.toFixed(1)} (scaled from ${B} events in sidebands)`,
    '',
    `  S/√B:            ${simpleZ.toFixed(2)}σ`,
    `  Asimov Z:        ${asimovZ.toFixed(2)}σ`,
    '',
    simpleZ >= 5 ? '  ★ Exceeds 5σ discovery threshold!' :
    simpleZ >= 3 ? '  ★ Exceeds 3σ evidence threshold.' :
    simpleZ >= 2 ? '  Modest excess (~2σ), more data needed.' :
    '  No significant excess observed.',
    '',
  ];
}

// 11. /spectrum
export function spectrumCmd(filePath: string, field: string = 'energy'): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const values: number[] = [];
  for (const ev of events) {
    for (const p of ev.particles || []) {
      const v = Number((p as any)[field]);
      if (!isNaN(v)) values.push(v);
    }
  }

  if (values.length === 0) return [`  [-] No values for field "${field}"`];

  const lines = histogram(values, 30, `${field.charAt(0).toUpperCase() + field.slice(1)} Spectrum (GeV)`);

  // Peak finding
  const sorted = [...values].sort((a, b) => a - b);
  const bins = 100;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const bw = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / bw), bins - 1);
    counts[idx]++;
  }

  // Find local maxima
  const peaks: { position: number; count: number }[] = [];
  for (let i = 2; i < bins - 2; i++) {
    if (counts[i] > counts[i - 1] && counts[i] > counts[i + 1] &&
        counts[i] > counts[i - 2] && counts[i] > counts[i + 2] &&
        counts[i] > values.length / bins * 2) {
      peaks.push({ position: min + (i + 0.5) * bw, count: counts[i] });
    }
  }

  if (peaks.length > 0) {
    lines.push('  Peaks found:');
    for (const peak of peaks.sort((a, b) => b.count - a.count).slice(0, 5)) {
      lines.push(`    ${peak.position.toFixed(2)} GeV (${peak.count} entries)`);
    }
    lines.push('');
  }

  return lines;
}

// 12. /decay
export function decayCmd(filePath: string): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const decayPatterns: Record<string, number> = {};

  for (const ev of events) {
    const particles = ev.particles || [];
    const types = particles.map(p => p.type || 'unknown').sort();
    const pattern = types.join(' + ');
    decayPatterns[pattern] = (decayPatterns[pattern] || 0) + 1;
  }

  const sorted = Object.entries(decayPatterns).sort((a, b) => b[1] - a[1]);
  const lines = [
    '', '  Decay Patterns',
    '  ────────────────────────────────────────',
  ];

  for (const [pattern, count] of sorted.slice(0, 20)) {
    const pct = (count / events.length * 100).toFixed(1);
    lines.push(`  ${pattern.padEnd(40)} ${String(count).padEnd(8)} (${pct}%)`);
  }

  lines.push('', `  ${sorted.length} unique patterns in ${events.length} events`, '');
  return lines;
}

// 13. /isolation
export function isolationCmd(filePath: string, leptonType: string = 'muon', cone: number = 0.4): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const isoValues: number[] = [];

  for (const ev of events) {
    const leptons = particlesOfType(ev, leptonType);
    const others = (ev.particles || []).filter(p => p.type !== leptonType);

    for (const lep of leptons) {
      let sumPt = 0;
      for (const other of others) {
        const deta = (lep.eta ?? 0) - (other.eta ?? 0);
        let dphi = (lep.phi ?? 0) - (other.phi ?? 0);
        while (dphi > Math.PI) dphi -= 2 * Math.PI;
        while (dphi < -Math.PI) dphi += 2 * Math.PI;
        const dr = Math.sqrt(deta * deta + dphi * dphi);
        if (dr < cone && dr > 0.01) {
          sumPt += other.pt ?? 0;
        }
      }
      const relIso = (lep.pt ?? 1) > 0 ? sumPt / (lep.pt ?? 1) : 0;
      isoValues.push(relIso);
    }
  }

  if (isoValues.length === 0) return [`  [-] No ${leptonType} found for isolation`];
  const lines = histogram(isoValues, 25, `${leptonType} Isolation (ΔR < ${cone})`);
  const isolated = isoValues.filter(v => v < 0.15).length;
  lines.push(`  Isolated (relIso < 0.15): ${isolated} / ${isoValues.length} (${(isolated / isoValues.length * 100).toFixed(1)}%)`);
  lines.push('');
  return lines;
}

// 14. /missing-et
export function missingETCmd(filePath: string): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const metValues: number[] = [];

  for (const ev of events) {
    if (ev.met !== undefined) {
      metValues.push(ev.met);
    } else {
      // Compute from particles
      let sumPx = 0, sumPy = 0;
      for (const p of ev.particles || []) {
        const pt = p.pt ?? 0;
        const phi = p.phi ?? 0;
        sumPx += pt * Math.cos(phi);
        sumPy += pt * Math.sin(phi);
      }
      metValues.push(Math.sqrt(sumPx * sumPx + sumPy * sumPy));
    }
  }

  if (metValues.length === 0) return ['  [-] No events with MET data'];
  return histogram(metValues, 25, 'Missing Transverse Energy (GeV)');
}

// 15. /jet-cluster (simple anti-kT approximation)
export function jetClusterCmd(filePath: string, R: number = 0.4): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  let totalJets = 0;
  const jetPts: number[] = [];

  for (const ev of events) {
    // Use existing jets if available
    if (ev.jets && ev.jets.length > 0) {
      totalJets += ev.jets.length;
      for (const j of ev.jets) jetPts.push(j.pt ?? 0);
      continue;
    }

    // Simple cone clustering on hadron-like particles
    const hadrons = (ev.particles || []).filter(p =>
      p.type !== 'muon' && p.type !== 'electron' && p.type !== 'photon' && p.type !== 'neutrino'
    );
    const used = new Set<number>();
    for (let i = 0; i < hadrons.length; i++) {
      if (used.has(i)) continue;
      let jetPt = hadrons[i].pt ?? 0;
      let jetEta = hadrons[i].eta ?? 0;
      let jetPhi = hadrons[i].phi ?? 0;
      used.add(i);

      for (let j = i + 1; j < hadrons.length; j++) {
        if (used.has(j)) continue;
        const deta = jetEta - (hadrons[j].eta ?? 0);
        let dphi = jetPhi - (hadrons[j].phi ?? 0);
        while (dphi > Math.PI) dphi -= 2 * Math.PI;
        while (dphi < -Math.PI) dphi += 2 * Math.PI;
        const dr = Math.sqrt(deta * deta + dphi * dphi);
        if (dr < R) {
          jetPt += hadrons[j].pt ?? 0;
          used.add(j);
        }
      }

      if (jetPt > 20) {
        totalJets++;
        jetPts.push(jetPt);
      }
    }
  }

  if (jetPts.length === 0) return ['  [-] No jets found'];

  const lines = histogram(jetPts, 25, `Jet pT Distribution (R=${R})`);
  lines.push(`  Total jets: ${totalJets} in ${events.length} events`);
  lines.push(`  Mean jets/event: ${(totalJets / events.length).toFixed(1)}`);
  lines.push('');
  return lines;
}

// 16. /trigger
export function triggerCmd(filePath: string, triggerType: string = 'single-muon'): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const triggers: Record<string, { cut: string; threshold: number; field: string; type: string }> = {
    'single-muon': { cut: 'pT > 24 GeV, |η| < 2.4', threshold: 24, field: 'pt', type: 'muon' },
    'single-electron': { cut: 'pT > 27 GeV, |η| < 2.5', threshold: 27, field: 'pt', type: 'electron' },
    'dimuon': { cut: 'pT > 17/8 GeV', threshold: 17, field: 'pt', type: 'muon' },
    'diphoton': { cut: 'pT > 30/18 GeV', threshold: 30, field: 'pt', type: 'photon' },
    'met': { cut: 'MET > 120 GeV', threshold: 120, field: 'met', type: '' },
  };

  const trig = triggers[triggerType];
  if (!trig) {
    return [`  [-] Unknown trigger: ${triggerType}`, `  Available: ${Object.keys(triggers).join(', ')}`];
  }

  let pass = 0;
  for (const ev of events) {
    if (trig.field === 'met') {
      if ((ev.met ?? 0) > trig.threshold) pass++;
    } else {
      const particles = particlesOfType(ev, trig.type);
      if (particles.some(p => (p.pt ?? 0) > trig.threshold)) pass++;
    }
  }

  const eff = events.length > 0 ? (pass / events.length * 100).toFixed(1) : '0.0';

  return [
    '', '  Trigger Simulation',
    '  ────────────────────────────────────────',
    `  Trigger:    ${triggerType}`,
    `  Selection:  ${trig.cut}`,
    `  Pass:       ${pass} / ${events.length} (${eff}%)`,
    '',
  ];
}

// 17. /pileup
export function pileupCmd(filePath: string): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const npvValues: number[] = [];

  for (const ev of events) {
    const npv = ev.nPV ?? (ev as any).nVertices ?? (ev as any).npv;
    if (npv !== undefined) npvValues.push(Number(npv));
  }

  if (npvValues.length === 0) return ['  [-] No pileup (nPV) information in data'];
  return histogram(npvValues, 25, 'Pileup (Number of Primary Vertices)');
}

// 18. /angular
export function angularCmd(filePath: string, particleType?: string): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const phiValues: number[] = [];
  const cosThetaValues: number[] = [];

  for (const ev of events) {
    const particles = particleType
      ? particlesOfType(ev, particleType)
      : (ev.particles || []);
    for (const p of particles) {
      if (p.phi !== undefined) phiValues.push(p.phi);
      if (p.eta !== undefined) {
        const theta = 2 * Math.atan(Math.exp(-p.eta));
        cosThetaValues.push(Math.cos(theta));
      }
    }
  }

  const lines: string[] = [];
  if (phiValues.length > 0) {
    lines.push(...histogram(phiValues, 25, 'Azimuthal Angle (φ)'));
  }
  if (cosThetaValues.length > 0) {
    lines.push(...histogram(cosThetaValues, 25, 'cos(θ*) Distribution'));
  }
  if (lines.length === 0) return ['  [-] No angular data found'];
  return lines;
}

// 19. /asymmetry
export function asymmetryCmd(filePath: string, field: string = 'eta'): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  let nForward = 0, nBackward = 0;

  for (const ev of events) {
    for (const p of ev.particles || []) {
      const val = Number((p as any)[field]);
      if (isNaN(val)) continue;
      if (val > 0) nForward++;
      else if (val < 0) nBackward++;
    }
  }

  const total = nForward + nBackward;
  const afb = total > 0 ? (nForward - nBackward) / total : 0;
  const afbErr = total > 0 ? Math.sqrt((1 - afb * afb) / total) : 0;

  return [
    '',
    '  Forward-Backward Asymmetry',
    '  ────────────────────────────────────────',
    `  Field:     ${field}`,
    `  Forward:   ${nForward} (${field} > 0)`,
    `  Backward:  ${nBackward} (${field} < 0)`,
    `  Total:     ${total}`,
    '',
    `  AFB = ${afb.toFixed(4)} ± ${afbErr.toFixed(4)}`,
    '',
    Math.abs(afb) < 2 * afbErr
      ? '  Consistent with symmetric distribution.'
      : afb > 0
        ? '  Significant forward excess detected.'
        : '  Significant backward excess detected.',
    '',
  ];
}

// 20. /resonance
export function resonanceCmd(filePath: string, field: string = 'mass'): string[] {
  const err = checkFile(filePath);
  if (err) return [err];

  const events = loadEvents(filePath);
  const values: number[] = [];
  for (const ev of events) {
    for (const p of ev.particles || []) {
      const v = Number((p as any)[field]);
      if (!isNaN(v) && v > 0) values.push(v);
    }
    // Also check event-level
    const evVal = Number((ev as any)[field]);
    if (!isNaN(evVal) && evVal > 0) values.push(evVal);
  }

  if (values.length === 0) return [`  [-] No values for field "${field}"`];

  // Sliding window peak finder
  const sorted = [...values].sort((a, b) => a - b);
  const bins = 200;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const bw = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / bw), bins - 1);
    counts[idx]++;
  }

  // Find peaks with sliding window
  const windowSize = 5;
  const peaks: { center: number; count: number; localSig: number }[] = [];

  for (let i = windowSize; i < bins - windowSize; i++) {
    const signal = counts.slice(i - 1, i + 2).reduce((a: number, b: number) => a + b, 0);
    const bgLeft = counts.slice(i - windowSize, i - 1).reduce((a: number, b: number) => a + b, 0);
    const bgRight = counts.slice(i + 2, i + windowSize + 1).reduce((a: number, b: number) => a + b, 0);
    const bg = (bgLeft + bgRight) / 2 * 3 / (2 * (windowSize - 1));

    if (bg > 0 && signal > bg * 1.5) {
      const localSig = (signal - bg) / Math.sqrt(bg);
      if (localSig > 2) {
        peaks.push({
          center: min + (i + 0.5) * bw,
          count: signal,
          localSig,
        });
      }
    }
  }

  // Merge nearby peaks
  const merged: typeof peaks = [];
  for (const peak of peaks.sort((a, b) => b.localSig - a.localSig)) {
    if (!merged.some(m => Math.abs(m.center - peak.center) < bw * 3)) {
      merged.push(peak);
    }
  }

  const lines = [
    '', '  Resonance Scan',
    '  ────────────────────────────────────────',
    `  Field: ${field}, ${values.length} entries`,
    `  Range: [${min.toFixed(1)}, ${max.toFixed(1)}] GeV`, '',
  ];

  if (merged.length === 0) {
    lines.push('  No significant resonances found.');
  } else {
    lines.push(`  ${'Position (GeV)'.padEnd(18)} ${'Entries'.padEnd(10)} Local Significance`);
    lines.push('  ' + '─'.repeat(50));
    for (const peak of merged.slice(0, 10)) {
      lines.push(`  ${peak.center.toFixed(2).padEnd(18)} ${String(peak.count).padEnd(10)} ${peak.localSig.toFixed(1)}σ`);
    }
  }

  lines.push('');
  return lines;
}

// ─── Register all physics commands into dispatcher ──────────────

export function registerPhysicsHandlers(
  register: (cmd: string, handler: (args: string[], flags: Record<string, string | boolean>) => Promise<{ output: string }>) => void,
  resolvePath: (arg?: string) => string,
): void {
  const text = (lines: string | string[]) => ({ output: Array.isArray(lines) ? lines.join('\n') : lines });

  register('/invariant-mass', async (args, flags) => {
    const p1 = (flags.particle1 as string) || (flags.p1 as string) || args[1] || 'muon';
    const p2 = (flags.particle2 as string) || (flags.p2 as string) || args[2] || p1;
    return text(invariantMassCmd(resolvePath(args[0]), p1, p2));
  });

  register('/transverse-mass', async (args, flags) => {
    const type = (flags.lepton as string) || args[1] || 'muon';
    return text(transverseMassCmd(resolvePath(args[0]), type));
  });

  register('/rapidity', async (args, flags) => {
    return text(rapidityCmd(resolvePath(args[0]), flags.type as string));
  });

  register('/pseudorapidity', async (args, flags) => {
    return text(pseudorapidityCmd(resolvePath(args[0]), flags.type as string));
  });

  register('/delta-r', async (args, flags) => {
    const t1 = (flags.type1 as string) || args[1] || 'muon';
    const t2 = (flags.type2 as string) || args[2] || 'jet';
    return text(deltaRCmd(resolvePath(args[0]), t1, t2));
  });

  register('/cross-section', async (args, flags) => {
    const lumi = parseFloat(flags.luminosity as string) || parseFloat(flags.L as string) || 1.0;
    const eff = parseFloat(flags.efficiency as string) || parseFloat(flags.e as string) || 1.0;
    return text(crossSectionCmd(resolvePath(args[0]), lumi, eff));
  });

  register('/luminosity', async (args) => {
    return text(luminosityCmd(resolvePath(args[0])));
  });

  register('/efficiency', async (args, flags) => {
    const cuts: Record<string, string> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (typeof v === 'string' && (v.startsWith('>') || v.startsWith('<') || v.startsWith('='))) {
        cuts[k] = v;
      }
    }
    return text(efficiencyCmd(resolvePath(args[0]), cuts));
  });

  register('/cutflow', async (args) => {
    // Args after file are cut specs: "pt>20" "eta<2.5" etc.
    return text(cutflowCmd(resolvePath(args[0]), args.slice(1)));
  });

  register('/significance', async (args, flags) => {
    const sigStr = (flags.signal as string) || '80-100';
    const bgStr = (flags.background as string) || '60-80,100-120';
    const field = (flags.field as string) || 'mass';
    const sigParts = sigStr.split('-').map(Number);
    const bgRanges = bgStr.split(',').map(r => r.split('-').map(Number) as [number, number]);
    return text(significanceCmd(resolvePath(args[0]), [sigParts[0], sigParts[1]], bgRanges, field));
  });

  register('/spectrum', async (args, flags) => {
    const field = (flags.field as string) || args[1] || 'energy';
    return text(spectrumCmd(resolvePath(args[0]), field));
  });

  register('/decay', async (args) => {
    return text(decayCmd(resolvePath(args[0])));
  });

  register('/isolation', async (args, flags) => {
    const type = (flags.lepton as string) || args[1] || 'muon';
    const cone = parseFloat(flags.cone as string) || 0.4;
    return text(isolationCmd(resolvePath(args[0]), type, cone));
  });

  register('/missing-et', async (args) => {
    return text(missingETCmd(resolvePath(args[0])));
  });

  register('/jet-cluster', async (args, flags) => {
    const R = parseFloat(flags.R as string) || 0.4;
    return text(jetClusterCmd(resolvePath(args[0]), R));
  });

  register('/trigger', async (args, flags) => {
    const trig = (flags.trigger as string) || args[1] || 'single-muon';
    return text(triggerCmd(resolvePath(args[0]), trig));
  });

  register('/pileup', async (args) => {
    return text(pileupCmd(resolvePath(args[0])));
  });

  register('/angular', async (args, flags) => {
    return text(angularCmd(resolvePath(args[0]), flags.type as string));
  });

  register('/asymmetry', async (args, flags) => {
    const field = (flags.field as string) || 'eta';
    return text(asymmetryCmd(resolvePath(args[0]), field));
  });

  register('/resonance', async (args, flags) => {
    const field = (flags.field as string) || 'mass';
    return text(resonanceCmd(resolvePath(args[0]), field));
  });
}
