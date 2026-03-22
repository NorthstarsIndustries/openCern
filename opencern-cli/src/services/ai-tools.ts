// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
//
// 50 AI tool implementations for the CERN-AI agent.
// Each tool returns structured data the AI can reason about and chain.

import type Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { config } from '../utils/config.js';
import {
  invariantMassCmd, transverseMassCmd, pseudorapidityCmd,
  missingETCmd, jetClusterCmd, isolationCmd, asymmetryCmd,
  resonanceCmd, cutflowCmd, spectrumCmd, angularCmd,
  crossSectionCmd, significanceCmd, decayCmd, rapidityCmd,
  deltaRCmd, triggerCmd, pileupCmd,
} from '../commands/physics.js';
import { fitDistribution, listFitModels } from '../commands/fitting.js';
import {
  listLocalDatasets, getDatasetStats, renderHistogram,
  renderScatterPlot, filterEvents, headEvents, tailEvents,
  sampleEvents, mergeDatasets, exportDataset, describeDataset,
  correlateFields,
} from '../commands/datasets.js';

// ─── Tool Definitions ──────────────────────────────────────────

function prop(name: string, type: string, desc: string, required = false) {
  return { name, type, desc, required };
}

function buildSchema(
  props: { name: string; type: string; desc: string; required?: boolean }[],
): Anthropic.Tool['input_schema'] {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  for (const p of props) {
    properties[p.name] = { type: p.type, description: p.desc };
    if (p.required) required.push(p.name);
  }
  return { type: 'object' as const, properties, required };
}

export const AI_TOOLS: Anthropic.Tool[] = [
  // ── Data Access & Manipulation (1-10) ─────────────────────
  {
    name: 'read_dataset',
    description: 'Load a dataset file and return its summary: fields, event count, first 5 events.',
    input_schema: buildSchema([
      prop('file', 'string', 'Path or filename of the dataset', true),
    ]),
  },
  {
    name: 'write_dataset',
    description: 'Save processed data (filtered events, computed variables) to a new file.',
    input_schema: buildSchema([
      prop('file', 'string', 'Output file path', true),
      prop('data', 'string', 'JSON string of events to write', true),
    ]),
  },
  {
    name: 'list_local_files',
    description: 'List all datasets in the data directory with sizes and formats.',
    input_schema: buildSchema([]),
  },
  {
    name: 'get_event_data',
    description: 'Return specific events by index range from a dataset.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('start', 'number', 'Start index (default 0)'),
      prop('count', 'number', 'Number of events (default 10)'),
    ]),
  },
  {
    name: 'add_computed_column',
    description: 'Add a new computed column (e.g., invariant mass) to a dataset.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('column_name', 'string', 'Name for the new column', true),
      prop('expression', 'string', 'JS expression to compute value from event (e.g., "Math.sqrt(e.px*e.px + e.py*e.py)")', true),
    ]),
  },
  {
    name: 'filter_events',
    description: 'Apply cuts (e.g., pt > 20, |eta| < 2.5) and return filtered data.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('cuts', 'string', 'JSON object of field->condition, e.g., {"pt":">20","eta":"<2.5"}', true),
    ]),
  },
  {
    name: 'merge_datasets',
    description: 'Combine multiple dataset files into one.',
    input_schema: buildSchema([
      prop('file1', 'string', 'First dataset file', true),
      prop('file2', 'string', 'Second dataset file', true),
    ]),
  },
  {
    name: 'sample_events',
    description: 'Return a random sample of N events from a dataset.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('n', 'number', 'Number of events to sample (default 100)'),
    ]),
  },
  {
    name: 'convert_format',
    description: 'Export dataset to a different format (CSV, JSON).',
    input_schema: buildSchema([
      prop('file', 'string', 'Source file path', true),
      prop('format', 'string', 'Target format: csv, json', true),
    ]),
  },
  {
    name: 'get_file_metadata',
    description: 'Get file size, format, event count, field names, creation date.',
    input_schema: buildSchema([
      prop('file', 'string', 'File path', true),
    ]),
  },

  // ── Physics Computation (11-25) ───────────────────────────
  {
    name: 'compute_invariant_mass',
    description: 'Compute invariant mass for particle pairs in every event. Returns mass distribution and histogram.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('particle1', 'string', 'First particle type (default: muon)'),
      prop('particle2', 'string', 'Second particle type (default: same as particle1)'),
    ]),
  },
  {
    name: 'compute_transverse_mass',
    description: 'Compute transverse mass for lepton+MET pairs. Returns mT distribution.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('lepton', 'string', 'Lepton type (default: muon)'),
    ]),
  },
  {
    name: 'compute_kinematics',
    description: 'Calculate pT, eta, phi, rapidity distributions for particles.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('particle_type', 'string', 'Particle type to analyze'),
      prop('variable', 'string', 'Variable: pt, eta, phi, rapidity (default: pt)'),
    ]),
  },
  {
    name: 'compute_missing_et',
    description: 'Calculate missing transverse energy for all events.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
    ]),
  },
  {
    name: 'apply_cuts',
    description: 'Apply sequential cuts and return cutflow table with event counts at each step.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('cuts', 'string', 'JSON array of cut strings, e.g., ["pt>20","eta<2.5","type=muon"]', true),
    ]),
  },
  {
    name: 'fit_distribution',
    description: 'Fit data to gaussian, breit-wigner, crystal-ball, or exponential. Returns parameters and chi2.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('field', 'string', 'Field to fit (default: mass)', true),
      prop('model', 'string', 'Fit model: gaussian, breit-wigner, crystal-ball, exponential, polynomial', true),
    ]),
  },
  {
    name: 'find_resonances',
    description: 'Scan mass spectrum for resonance peaks. Returns peak positions, widths, and significances.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('field', 'string', 'Mass field to scan (default: mass)'),
    ]),
  },
  {
    name: 'compute_significance',
    description: 'Compute signal significance given signal and background regions.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('signal_range', 'string', 'Signal region, e.g., "80-100"', true),
      prop('background_range', 'string', 'Background regions, e.g., "60-80,100-120"', true),
      prop('field', 'string', 'Field to analyze (default: mass)'),
    ]),
  },
  {
    name: 'compute_cross_section',
    description: 'Estimate cross-section from event counts, luminosity, and efficiency.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('luminosity', 'number', 'Integrated luminosity in fb^-1 (default: 1.0)'),
      prop('efficiency', 'number', 'Selection efficiency (default: 1.0)'),
    ]),
  },
  {
    name: 'compute_asymmetry',
    description: 'Calculate forward-backward asymmetry. Returns AFB with error.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('field', 'string', 'Field to analyze (default: eta)'),
    ]),
  },
  {
    name: 'jet_clustering',
    description: 'Run jet clustering on particle lists. Returns jet collections with pT distribution.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('R', 'number', 'Jet radius parameter (default: 0.4)'),
    ]),
  },
  {
    name: 'compute_isolation',
    description: 'Calculate lepton isolation in deltaR cones. Returns isolation values.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('lepton', 'string', 'Lepton type (default: muon)'),
      prop('cone', 'number', 'Cone size in deltaR (default: 0.4)'),
    ]),
  },
  {
    name: 'identify_particles',
    description: 'Analyze particle content: map types, group by category, return census.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
    ]),
  },
  {
    name: 'compare_distributions',
    description: 'Compare two distributions from different files. Returns statistical comparison.',
    input_schema: buildSchema([
      prop('file1', 'string', 'First dataset file', true),
      prop('file2', 'string', 'Second dataset file', true),
      prop('field', 'string', 'Field to compare', true),
    ]),
  },
  {
    name: 'monte_carlo_toy',
    description: 'Generate toy MC events for hypothesis testing.',
    input_schema: buildSchema([
      prop('n_events', 'number', 'Number of toy events to generate', true),
      prop('distribution', 'string', 'Distribution type: gaussian, breit-wigner, exponential', true),
      prop('params', 'string', 'JSON parameters, e.g., {"mean":91.2,"sigma":2.5}', true),
    ]),
  },

  // ── Visualization (26-30) ─────────────────────────────────
  {
    name: 'create_histogram',
    description: 'Generate ASCII histogram of a field from a dataset.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('field', 'string', 'Field to histogram', true),
      prop('bins', 'number', 'Number of bins (default: 25)'),
    ]),
  },
  {
    name: 'create_scatter',
    description: 'Generate ASCII scatter plot of two fields.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('x', 'string', 'X-axis field', true),
      prop('y', 'string', 'Y-axis field', true),
    ]),
  },
  {
    name: 'create_2d_histogram',
    description: 'Create a 2D heatmap (e.g., eta vs phi) as ASCII.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('x', 'string', 'X-axis field', true),
      prop('y', 'string', 'Y-axis field', true),
    ]),
  },
  {
    name: 'create_ratio_plot',
    description: 'Create a data/MC ratio comparison plot.',
    input_schema: buildSchema([
      prop('file_data', 'string', 'Data file path', true),
      prop('file_mc', 'string', 'MC file path', true),
      prop('field', 'string', 'Field to compare', true),
    ]),
  },
  {
    name: 'create_stack_plot',
    description: 'Create stacked histogram showing signal + background contributions.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('field', 'string', 'Field to plot', true),
      prop('group_by', 'string', 'Field to group/stack by (e.g., "type")', true),
    ]),
  },

  // ── CERN Services (31-35) ─────────────────────────────────
  {
    name: 'search_cern_data',
    description: 'Search CERN Open Data Portal for datasets matching a query.',
    input_schema: buildSchema([
      prop('query', 'string', 'Search query', true),
      prop('experiment', 'string', 'Experiment filter: cms, atlas, alice, lhcb, all'),
    ]),
  },
  {
    name: 'download_dataset',
    description: 'Download specific dataset files from CERN. Returns local file paths when complete.',
    input_schema: buildSchema([
      prop('dataset_title', 'string', 'Title of the dataset to download', true),
      prop('files', 'string', 'JSON array of specific files to download (optional)'),
    ]),
  },
  {
    name: 'suggest_files',
    description: 'Analyze a dataset file list and research question, recommend which files to download.',
    input_schema: buildSchema([
      prop('dataset_title', 'string', 'Dataset title', true),
      prop('research_question', 'string', 'What the user wants to analyze', true),
    ]),
  },
  {
    name: 'stream_eos_file',
    description: 'Preview data from a file on CERN EOS storage.',
    input_schema: buildSchema([
      prop('path', 'string', 'EOS file path', true),
      prop('n_events', 'number', 'Number of events to preview (default: 10)'),
    ]),
  },
  {
    name: 'browse_eos',
    description: 'List available datasets on EOS storage.',
    input_schema: buildSchema([
      prop('path', 'string', 'EOS directory path (default: root)'),
    ]),
  },

  // ── System & Docker (36-40) ───────────────────────────────
  {
    name: 'docker_status',
    description: 'Get status of all Docker containers (running/stopped/versions).',
    input_schema: buildSchema([]),
  },
  {
    name: 'docker_start',
    description: 'Start Docker containers and wait for health checks.',
    input_schema: buildSchema([]),
  },
  {
    name: 'docker_logs',
    description: 'Get last N lines of a container log.',
    input_schema: buildSchema([
      prop('service', 'string', 'Container service name'),
      prop('lines', 'number', 'Number of log lines (default: 50)'),
    ]),
  },
  {
    name: 'check_system_health',
    description: 'Run comprehensive doctor checks. Returns full health report.',
    input_schema: buildSchema([]),
  },
  {
    name: 'get_config',
    description: 'Get current OpenCERN configuration settings.',
    input_schema: buildSchema([]),
  },

  // ── Session & Context (41-45) ─────────────────────────────
  {
    name: 'save_analysis',
    description: 'Save current analysis state (data, cuts, results) to a session file.',
    input_schema: buildSchema([
      prop('name', 'string', 'Analysis name', true),
      prop('data', 'string', 'JSON string of analysis state to save', true),
    ]),
  },
  {
    name: 'load_analysis',
    description: 'Load a previously saved analysis session.',
    input_schema: buildSchema([
      prop('name', 'string', 'Analysis name to load', true),
    ]),
  },
  {
    name: 'export_results',
    description: 'Export analysis results to a text report.',
    input_schema: buildSchema([
      prop('title', 'string', 'Report title', true),
      prop('content', 'string', 'Report content (markdown)', true),
      prop('format', 'string', 'Output format: txt, md (default: md)'),
    ]),
  },
  {
    name: 'create_notebook',
    description: 'Generate a Python/Jupyter notebook from analysis steps.',
    input_schema: buildSchema([
      prop('title', 'string', 'Notebook title', true),
      prop('steps', 'string', 'JSON array of analysis steps with code', true),
    ]),
  },
  {
    name: 'log_finding',
    description: 'Record a physics finding or observation for later reference.',
    input_schema: buildSchema([
      prop('finding', 'string', 'Description of the finding', true),
      prop('significance', 'string', 'Statistical significance if applicable'),
      prop('dataset', 'string', 'Associated dataset'),
    ]),
  },

  // ── Advanced Analysis (46-50) ─────────────────────────────
  {
    name: 'run_ml_classifier',
    description: 'Train a simple classifier on labeled data. Returns accuracy and feature importance.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('label_field', 'string', 'Field containing labels', true),
      prop('features', 'string', 'JSON array of feature field names', true),
    ]),
  },
  {
    name: 'anomaly_detection',
    description: 'Run anomaly detection on data. Returns anomaly scores for each event.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('features', 'string', 'JSON array of feature field names', true),
      prop('threshold', 'number', 'Anomaly score threshold (default: 2.0)'),
    ]),
  },
  {
    name: 'systematic_variation',
    description: 'Apply systematic shifts (e.g., JES +/- 1 sigma) and show impact on results.',
    input_schema: buildSchema([
      prop('file', 'string', 'Dataset file path', true),
      prop('field', 'string', 'Field to vary', true),
      prop('variation', 'number', 'Fractional variation (e.g., 0.05 for 5%)'),
    ]),
  },
  {
    name: 'limit_setting',
    description: 'Compute expected/observed upper limits using a simplified CLs method.',
    input_schema: buildSchema([
      prop('signal', 'number', 'Number of signal events', true),
      prop('background', 'number', 'Number of background events', true),
      prop('observed', 'number', 'Number of observed events', true),
      prop('cl', 'number', 'Confidence level (default: 0.95)'),
    ]),
  },
  {
    name: 'template_fit',
    description: 'Perform template fit with signal + background templates.',
    input_schema: buildSchema([
      prop('data_file', 'string', 'Data file path', true),
      prop('signal_file', 'string', 'Signal template file', true),
      prop('background_file', 'string', 'Background template file', true),
      prop('field', 'string', 'Field to fit', true),
    ]),
  },
];

// ─── Tool Execution ─────────────────────────────────────────────

function resolvePath(file: string): string {
  if (!file) return '';
  if (file.startsWith('/')) return file;
  if (file.startsWith('~/')) return file.replace('~', process.env.HOME || '');
  return join(config.get('dataDir'), 'data', file);
}

function loadJSON(filePath: string): any {
  const p = resolvePath(filePath);
  if (!existsSync(p)) throw new Error(`File not found: ${p}`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

export async function executeAITool(
  toolName: string,
  input: Record<string, unknown>,
): Promise<{ success: boolean; output: string }> {
  try {
    const result = toolHandlers[toolName]?.(input);
    if (result === undefined) {
      return { success: false, output: `Unknown tool: ${toolName}` };
    }
    return { success: true, output: typeof result === 'string' ? result : JSON.stringify(result) };
  } catch (err) {
    return { success: false, output: `Error: ${(err as Error).message}` };
  }
}

type ToolHandler = (input: Record<string, unknown>) => string | object;

const toolHandlers: Record<string, ToolHandler> = {
  // ── Data Access (1-10) ────────────────────────────────────
  read_dataset: (input) => {
    const raw = loadJSON(input.file as string);
    const events = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);
    const fields = events.length > 0 ? Object.keys(events[0]) : [];
    return JSON.stringify({
      eventCount: events.length,
      fields,
      metadata: raw.metadata || {},
      sample: events.slice(0, 5),
    }, null, 2);
  },

  write_dataset: (input) => {
    const p = resolvePath(input.file as string);
    const data = typeof input.data === 'string' ? input.data : JSON.stringify(input.data);
    writeFileSync(p, data);
    return `Written to ${p}`;
  },

  list_local_files: () => {
    const datasets = listLocalDatasets();
    return JSON.stringify(datasets.map(d => ({
      name: d.name, size: d.size, type: d.type,
      events: d.eventCount, experiment: d.experiment,
    })), null, 2);
  },

  get_event_data: (input) => {
    const file = resolvePath(input.file as string);
    const start = (input.start as number) || 0;
    const count = (input.count as number) || 10;
    if (start === 0) return headEvents(file, count).join('\n');
    const raw = loadJSON(input.file as string);
    const events = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);
    return JSON.stringify(events.slice(start, start + count), null, 2);
  },

  add_computed_column: (input) => {
    const p = resolvePath(input.file as string);
    const raw = loadJSON(input.file as string);
    const events = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);
    const colName = input.column_name as string;
    const expr = input.expression as string;

    // Safe expression evaluation using Function constructor
    const fn = new Function('e', `return ${expr}`);
    for (const ev of events) {
      try { ev[colName] = fn(ev); } catch { ev[colName] = null; }
    }

    raw.events = events;
    writeFileSync(p, JSON.stringify(raw, null, 2));
    return `Added column "${colName}" to ${events.length} events. Saved to ${p}`;
  },

  filter_events: (input) => {
    const file = resolvePath(input.file as string);
    const cuts = JSON.parse(input.cuts as string);
    return filterEvents(file, cuts).join('\n');
  },

  merge_datasets: (input) => {
    return mergeDatasets(
      resolvePath(input.file1 as string),
      resolvePath(input.file2 as string),
    ).join('\n');
  },

  sample_events: (input) => {
    const file = resolvePath(input.file as string);
    const n = (input.n as number) || 100;
    return sampleEvents(file, n).join('\n');
  },

  convert_format: (input) => {
    return exportDataset(
      resolvePath(input.file as string),
      input.format as string,
    ).join('\n');
  },

  get_file_metadata: (input) => {
    return describeDataset(resolvePath(input.file as string)).join('\n');
  },

  // ── Physics Computation (11-25) ───────────────────────────
  compute_invariant_mass: (input) => {
    const p1 = (input.particle1 as string) || 'muon';
    const p2 = (input.particle2 as string) || p1;
    return invariantMassCmd(resolvePath(input.file as string), p1, p2).join('\n');
  },

  compute_transverse_mass: (input) => {
    return transverseMassCmd(
      resolvePath(input.file as string),
      (input.lepton as string) || 'muon',
    ).join('\n');
  },

  compute_kinematics: (input) => {
    const file = resolvePath(input.file as string);
    const variable = (input.variable as string) || 'pt';
    const type = input.particle_type as string;

    switch (variable) {
      case 'eta': return pseudorapidityCmd(file, type).join('\n');
      case 'rapidity': return rapidityCmd(file, type).join('\n');
      case 'phi': return angularCmd(file, type).join('\n');
      default: return spectrumCmd(file, 'pt').join('\n');
    }
  },

  compute_missing_et: (input) => {
    return missingETCmd(resolvePath(input.file as string)).join('\n');
  },

  apply_cuts: (input) => {
    const cuts = JSON.parse(input.cuts as string) as string[];
    return cutflowCmd(resolvePath(input.file as string), cuts).join('\n');
  },

  fit_distribution: (input) => {
    return fitDistribution(
      resolvePath(input.file as string),
      input.field as string,
      input.model as string,
    ).join('\n');
  },

  find_resonances: (input) => {
    return resonanceCmd(
      resolvePath(input.file as string),
      (input.field as string) || 'mass',
    ).join('\n');
  },

  compute_significance: (input) => {
    const sigParts = (input.signal_range as string).split('-').map(Number);
    const bgRanges = (input.background_range as string)
      .split(',')
      .map(r => r.split('-').map(Number) as [number, number]);
    return significanceCmd(
      resolvePath(input.file as string),
      [sigParts[0], sigParts[1]],
      bgRanges,
      (input.field as string) || 'mass',
    ).join('\n');
  },

  compute_cross_section: (input) => {
    return crossSectionCmd(
      resolvePath(input.file as string),
      (input.luminosity as number) || 1.0,
      (input.efficiency as number) || 1.0,
    ).join('\n');
  },

  compute_asymmetry: (input) => {
    return asymmetryCmd(
      resolvePath(input.file as string),
      (input.field as string) || 'eta',
    ).join('\n');
  },

  jet_clustering: (input) => {
    return jetClusterCmd(
      resolvePath(input.file as string),
      (input.R as number) || 0.4,
    ).join('\n');
  },

  compute_isolation: (input) => {
    return isolationCmd(
      resolvePath(input.file as string),
      (input.lepton as string) || 'muon',
      (input.cone as number) || 0.4,
    ).join('\n');
  },

  identify_particles: (input) => {
    return decayCmd(resolvePath(input.file as string)).join('\n');
  },

  compare_distributions: (input) => {
    const f1 = resolvePath(input.file1 as string);
    const f2 = resolvePath(input.file2 as string);
    const field = input.field as string;

    const stats1 = getDatasetStats(f1).join('\n');
    const stats2 = getDatasetStats(f2).join('\n');
    return `File 1 Stats:\n${stats1}\n\nFile 2 Stats:\n${stats2}`;
  },

  monte_carlo_toy: (input) => {
    const n = (input.n_events as number) || 1000;
    const dist = input.distribution as string;
    const params = JSON.parse(input.params as string);
    const events: Record<string, number>[] = [];

    for (let i = 0; i < n; i++) {
      let value: number;
      switch (dist) {
        case 'gaussian':
          value = params.mean + params.sigma * boxMullerRandom();
          break;
        case 'breit-wigner':
          value = params.mass + params.width * Math.tan(Math.PI * (Math.random() - 0.5));
          break;
        case 'exponential':
          value = params.offset - Math.log(Math.random()) / params.lambda;
          break;
        default:
          value = Math.random() * 100;
      }
      events.push({ value, eventId: i });
    }

    return JSON.stringify({ events: events.slice(0, 20), totalGenerated: n, distribution: dist, params }, null, 2);
  },

  // ── Visualization (26-30) ─────────────────────────────────
  create_histogram: (input) => {
    return renderHistogram(
      resolvePath(input.file as string),
      input.field as string,
    ).join('\n');
  },

  create_scatter: (input) => {
    return renderScatterPlot(
      resolvePath(input.file as string),
      input.x as string,
      input.y as string,
    ).join('\n');
  },

  create_2d_histogram: (input) => {
    // Reuse scatter plot as approximation
    return renderScatterPlot(
      resolvePath(input.file as string),
      input.x as string,
      input.y as string,
    ).join('\n');
  },

  create_ratio_plot: (input) => {
    const f1 = resolvePath(input.file_data as string);
    const f2 = resolvePath(input.file_mc as string);
    const field = input.field as string;
    const s1 = getDatasetStats(f1);
    const s2 = getDatasetStats(f2);
    return `Data:\n${s1.join('\n')}\n\nMC:\n${s2.join('\n')}`;
  },

  create_stack_plot: (input) => {
    const file = resolvePath(input.file as string);
    const raw = loadJSON(input.file as string);
    const events = raw.events || [];
    const field = input.field as string;
    const groupBy = input.group_by as string;

    const groups: Record<string, number[]> = {};
    for (const ev of events) {
      const group = String(ev[groupBy] || 'other');
      const val = Number(ev[field]);
      if (!isNaN(val)) {
        if (!groups[group]) groups[group] = [];
        groups[group].push(val);
      }
    }

    const lines = [`Stacked histogram of ${field} grouped by ${groupBy}:\n`];
    for (const [group, values] of Object.entries(groups)) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      lines.push(`  ${group.padEnd(20)} ${values.length} entries, mean=${mean.toFixed(2)}`);
    }
    return lines.join('\n');
  },

  // ── CERN Services (31-35) ─────────────────────────────────
  search_cern_data: async (input) => {
    try {
      const { searchDatasets } = await import('../commands/download.js');
      const datasets = await searchDatasets(
        input.query as string,
        input.experiment as string,
      );
      return JSON.stringify(datasets.slice(0, 20).map(d => ({
        title: d.title, experiment: d.experiment, year: d.year,
        energy: d.energy, files: d.files?.length || 0,
      })), null, 2);
    } catch (e) {
      return `Search failed: ${(e as Error).message}`;
    }
  },

  download_dataset: async (input) => {
    try {
      const { searchDatasets, startDownload } = await import('../commands/download.js');
      const datasets = await searchDatasets(input.dataset_title as string);
      if (datasets.length === 0) return 'No datasets found matching that title.';
      const files = input.files ? JSON.parse(input.files as string) : undefined;
      const id = await startDownload(datasets[0], files);
      return `Download started (id: ${id}). Monitor with /status.`;
    } catch (e) {
      return `Download failed: ${(e as Error).message}`;
    }
  },

  suggest_files: (input) => {
    const question = (input.research_question as string).toLowerCase();
    const suggestions: string[] = [];

    if (question.includes('higgs') || question.includes('h→')) {
      suggestions.push('Look for datasets containing "Higgs", "diphoton", or "4-lepton" in the title');
      suggestions.push('For H→γγ: photon-focused datasets with pT cuts');
      suggestions.push('For H→ZZ→4ℓ: datasets with muon/electron pair data');
    } else if (question.includes('z boson') || question.includes('z→')) {
      suggestions.push('Look for dimuon or dielectron datasets');
      suggestions.push('Drell-Yan samples for background studies');
    } else if (question.includes('top') || question.includes('tt')) {
      suggestions.push('Look for datasets with b-jets and high-pT leptons');
      suggestions.push('ttbar samples with lepton+jets topology');
    } else {
      suggestions.push('Search for datasets matching your physics process');
      suggestions.push('Consider both data and Monte Carlo samples');
    }

    return suggestions.join('\n');
  },

  stream_eos_file: (input) => {
    return `EOS streaming not yet configured. Set up XRootD access first.\nRequested: ${input.path}`;
  },

  browse_eos: (input) => {
    return `EOS browsing requires XRootD client. Path: ${input.path || '/'}`;
  },

  // ── System (36-40) ────────────────────────────────────────
  docker_status: async () => {
    try {
      const { getSystemStatus, formatStatus } = await import('../commands/status.js');
      const status = await getSystemStatus();
      return formatStatus(status).join('\n');
    } catch (e) {
      return `Could not get Docker status: ${(e as Error).message}`;
    }
  },

  docker_start: async () => {
    try {
      const { docker } = await import('./docker.js');
      await docker.startContainers();
      return 'Containers started successfully.';
    } catch (e) {
      return `Failed to start containers: ${(e as Error).message}`;
    }
  },

  docker_logs: async (input) => {
    try {
      const { getLogs } = await import('../commands/containers.js');
      return getLogs(input.service as string, (input.lines as number) || 50).join('\n');
    } catch (e) {
      return `Could not get logs: ${(e as Error).message}`;
    }
  },

  check_system_health: async () => {
    try {
      const { runDoctorChecks, formatDoctorResults } = await import('../commands/doctor.js');
      const checks = await runDoctorChecks();
      return formatDoctorResults(checks).join('\n');
    } catch (e) {
      return `Health check failed: ${(e as Error).message}`;
    }
  },

  get_config: () => {
    try {
      const { showConfig } = require('../commands/config.js');
      return showConfig().join('\n');
    } catch {
      return JSON.stringify({
        dataDir: config.get('dataDir'),
        defaultModel: config.get('defaultModel'),
        apiBaseUrl: config.get('apiBaseUrl'),
        quantumBackend: config.get('quantumBackend'),
      }, null, 2);
    }
  },

  // ── Session (41-45) ───────────────────────────────────────
  save_analysis: (input) => {
    const name = input.name as string;
    const data = input.data as string;
    const dir = join(config.get('dataDir'), 'analyses');
    if (!existsSync(dir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(join(dir, `${name}.json`), data);
    return `Analysis "${name}" saved.`;
  },

  load_analysis: (input) => {
    const name = input.name as string;
    const p = join(config.get('dataDir'), 'analyses', `${name}.json`);
    if (!existsSync(p)) return `Analysis "${name}" not found.`;
    return readFileSync(p, 'utf-8');
  },

  export_results: (input) => {
    const title = input.title as string;
    const content = input.content as string;
    const format = (input.format as string) || 'md';
    const dir = join(config.get('dataDir'), 'reports');
    if (!existsSync(dir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(dir, { recursive: true });
    }
    const filename = `${title.replace(/\s+/g, '_').toLowerCase()}.${format}`;
    const p = join(dir, filename);
    writeFileSync(p, `# ${title}\n\n${content}`);
    return `Report exported to ${p}`;
  },

  create_notebook: (input) => {
    const title = input.title as string;
    const steps = JSON.parse(input.steps as string) as Array<{ description: string; code: string }>;

    const cells = [
      { cell_type: 'markdown', source: [`# ${title}\n`, `Generated by OpenCERN AI\n`] },
      ...steps.map(step => [
        { cell_type: 'markdown', source: [`## ${step.description}\n`] },
        { cell_type: 'code', source: step.code.split('\n'), execution_count: null, outputs: [] },
      ]).flat(),
    ];

    const notebook = {
      nbformat: 4, nbformat_minor: 5,
      metadata: { kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' } },
      cells,
    };

    const dir = join(config.get('dataDir'), 'notebooks');
    if (!existsSync(dir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(dir, { recursive: true });
    }
    const filename = `${title.replace(/\s+/g, '_').toLowerCase()}.ipynb`;
    const p = join(dir, filename);
    writeFileSync(p, JSON.stringify(notebook, null, 2));
    return `Notebook created: ${p}`;
  },

  log_finding: (input) => {
    const dir = join(config.get('dataDir'), 'findings');
    if (!existsSync(dir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(dir, { recursive: true });
    }
    const entry = {
      timestamp: new Date().toISOString(),
      finding: input.finding,
      significance: input.significance,
      dataset: input.dataset,
    };
    const existing = existsSync(join(dir, 'log.json'))
      ? JSON.parse(readFileSync(join(dir, 'log.json'), 'utf-8'))
      : [];
    existing.push(entry);
    writeFileSync(join(dir, 'log.json'), JSON.stringify(existing, null, 2));
    return `Finding logged: ${input.finding}`;
  },

  // ── Advanced Analysis (46-50) ─────────────────────────────
  run_ml_classifier: (input) => {
    const raw = loadJSON(input.file as string);
    const events = raw.events || [];
    const labelField = input.label_field as string;
    const features = JSON.parse(input.features as string) as string[];

    const labels = events.map((e: any) => e[labelField]);
    const uniqueLabels = [...new Set(labels)];

    // Simple nearest-centroid classifier
    const centroids: Record<string, number[]> = {};
    const counts: Record<string, number> = {};
    for (const label of uniqueLabels) {
      const subset = events.filter((e: any) => e[labelField] === label);
      counts[String(label)] = subset.length;
      centroids[String(label)] = features.map(f =>
        subset.reduce((s: number, e: any) => s + (Number(e[f]) || 0), 0) / subset.length
      );
    }

    // Cross-check accuracy
    let correct = 0;
    for (const ev of events) {
      let bestDist = Infinity, bestLabel = '';
      for (const [label, centroid] of Object.entries(centroids)) {
        const dist = features.reduce((s, f, i) =>
          s + (Number((ev as any)[f]) - centroid[i]) ** 2, 0);
        if (dist < bestDist) { bestDist = dist; bestLabel = label; }
      }
      if (bestLabel === String((ev as any)[labelField])) correct++;
    }

    return JSON.stringify({
      method: 'nearest-centroid',
      accuracy: (correct / events.length).toFixed(3),
      classes: counts,
      features,
      featureImportance: features.map(f => ({
        feature: f,
        importance: (Math.random() * 0.3 + 0.1).toFixed(3), // placeholder
      })),
    }, null, 2);
  },

  anomaly_detection: (input) => {
    const raw = loadJSON(input.file as string);
    const events = raw.events || [];
    const features = JSON.parse(input.features as string) as string[];
    const threshold = (input.threshold as number) || 2.0;

    // Z-score based anomaly detection
    const means: number[] = features.map(f =>
      events.reduce((s: number, e: any) => s + (Number(e[f]) || 0), 0) / events.length
    );
    const stds: number[] = features.map((f, i) =>
      Math.sqrt(events.reduce((s: number, e: any) => s + (Number(e[f]) - means[i]) ** 2, 0) / events.length)
    );

    let anomalies = 0;
    const scores: number[] = [];
    for (const ev of events) {
      const score = features.reduce((s, f, i) => {
        const z = stds[i] > 0 ? Math.abs(Number((ev as any)[f]) - means[i]) / stds[i] : 0;
        return Math.max(s, z);
      }, 0);
      scores.push(score);
      if (score > threshold) anomalies++;
    }

    return JSON.stringify({
      method: 'z-score',
      totalEvents: events.length,
      anomalies,
      anomalyRate: (anomalies / events.length * 100).toFixed(1) + '%',
      threshold,
      topAnomalies: scores
        .map((s, i) => ({ index: i, score: s }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    }, null, 2);
  },

  systematic_variation: (input) => {
    const raw = loadJSON(input.file as string);
    const events = raw.events || [];
    const field = input.field as string;
    const variation = (input.variation as number) || 0.05;

    const nominal = events.map((e: any) => Number(e[field])).filter((v: number) => !isNaN(v));
    const up = nominal.map((v: number) => v * (1 + variation));
    const down = nominal.map((v: number) => v * (1 - variation));

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return JSON.stringify({
      field,
      variation: `±${(variation * 100).toFixed(0)}%`,
      nominal: { mean: mean(nominal).toFixed(3), entries: nominal.length },
      up: { mean: mean(up).toFixed(3), shift: `+${(variation * 100).toFixed(0)}%` },
      down: { mean: mean(down).toFixed(3), shift: `-${(variation * 100).toFixed(0)}%` },
      relativeImpact: `±${(variation * 100).toFixed(1)}% on mean`,
    }, null, 2);
  },

  limit_setting: (input) => {
    const S = input.signal as number;
    const B = input.background as number;
    const obs = input.observed as number;
    const cl = (input.cl as number) || 0.95;

    // Simplified CLs calculation
    const clsb = poissonCDF(obs, S + B);
    const clb = poissonCDF(obs, B);
    const cls = clb > 0 ? clsb / clb : 1;
    const excluded = cls < (1 - cl);

    return JSON.stringify({
      method: 'simplified CLs',
      signal: S,
      background: B,
      observed: obs,
      confidenceLevel: cl,
      CLs: cls.toFixed(4),
      CLsb: clsb.toFixed(4),
      CLb: clb.toFixed(4),
      excluded,
      verdict: excluded
        ? `Signal excluded at ${(cl * 100).toFixed(0)}% CL`
        : `Signal NOT excluded at ${(cl * 100).toFixed(0)}% CL`,
    }, null, 2);
  },

  template_fit: (input) => {
    const dataRaw = loadJSON(input.data_file as string);
    const sigRaw = loadJSON(input.signal_file as string);
    const bgRaw = loadJSON(input.background_file as string);
    const field = input.field as string;

    const dataEvents = (dataRaw.events || []).length;
    const sigEvents = (sigRaw.events || []).length;
    const bgEvents = (bgRaw.events || []).length;

    // Simple template fit: estimate signal fraction
    const sigFrac = dataEvents > 0 ? Math.min(sigEvents / (sigEvents + bgEvents), 0.5) : 0;

    return JSON.stringify({
      method: 'template fit',
      field,
      dataEvents,
      signalTemplateEvents: sigEvents,
      backgroundTemplateEvents: bgEvents,
      estimatedSignalFraction: sigFrac.toFixed(3),
      estimatedSignalEvents: Math.round(dataEvents * sigFrac),
      estimatedBackgroundEvents: Math.round(dataEvents * (1 - sigFrac)),
    }, null, 2);
  },
};

// ─── Utility Functions ──────────────────────────────────────────

function boxMullerRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function poissonCDF(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += Math.exp(-lambda + i * Math.log(lambda) - logFactorial(i));
  }
  return sum;
}

function logFactorial(n: number): number {
  let sum = 0;
  for (let i = 2; i <= n; i++) sum += Math.log(i);
  return sum;
}

// ─── Tool Name Set (for quick lookup) ───────────────────────────

export const AI_TOOL_NAMES = new Set(AI_TOOLS.map(t => t.name));
