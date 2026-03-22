// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
//
// Pre-built multi-step analysis workflows the AI can reference.
// These describe tool chains for common physics analyses.

export interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: string[];
}

export interface WorkflowStep {
  tool: string;
  description: string;
  inputTemplate: Record<string, string>;
}

export const WORKFLOWS: Workflow[] = [
  {
    name: 'Z Boson Discovery',
    description: 'Find the Z boson in dimuon or dielectron data. Classic resonance analysis.',
    triggers: ['z boson', 'dimuon', 'z peak', 'z→μμ', 'z→ee', 'drell-yan'],
    steps: [
      { tool: 'read_dataset', description: 'Load the dataset and inspect contents', inputTemplate: { file: '{file}' } },
      { tool: 'filter_events', description: 'Select events with exactly 2 opposite-sign muons', inputTemplate: { file: '{file}', cuts: '{"type":"=muon"}' } },
      { tool: 'compute_invariant_mass', description: 'Compute dimuon invariant mass', inputTemplate: { file: '{file}', particle1: 'muon', particle2: 'muon' } },
      { tool: 'fit_distribution', description: 'Fit Breit-Wigner to the mass peak', inputTemplate: { file: '{file}', field: 'mass', model: 'breit-wigner' } },
      { tool: 'create_histogram', description: 'Visualize the mass distribution', inputTemplate: { file: '{file}', field: 'mass' } },
    ],
  },
  {
    name: 'Higgs Search (diphoton)',
    description: 'Search for H→γγ signal. Look for narrow peak at ~125 GeV above falling background.',
    triggers: ['higgs', 'h→γγ', 'diphoton', 'higgs boson', '125 gev'],
    steps: [
      { tool: 'read_dataset', description: 'Load and inspect photon data', inputTemplate: { file: '{file}' } },
      { tool: 'filter_events', description: 'Select events with 2+ photons', inputTemplate: { file: '{file}', cuts: '{"type":"=photon"}' } },
      { tool: 'compute_invariant_mass', description: 'Compute diphoton invariant mass', inputTemplate: { file: '{file}', particle1: 'photon', particle2: 'photon' } },
      { tool: 'fit_distribution', description: 'Fit signal (Gaussian) + background (exponential)', inputTemplate: { file: '{file}', field: 'mass', model: 'gaussian' } },
      { tool: 'compute_significance', description: 'Estimate signal significance', inputTemplate: { file: '{file}', signal_range: '120-130', background_range: '100-120,130-160', field: 'mass' } },
    ],
  },
  {
    name: 'W Boson Mass',
    description: 'Measure W boson via transverse mass in lepton+MET events.',
    triggers: ['w boson', 'w mass', 'w→ℓν', 'transverse mass', 'jacobian peak'],
    steps: [
      { tool: 'read_dataset', description: 'Load dataset', inputTemplate: { file: '{file}' } },
      { tool: 'filter_events', description: 'Select single-lepton events with MET', inputTemplate: { file: '{file}', cuts: '{"type":"=muon"}' } },
      { tool: 'compute_transverse_mass', description: 'Compute lepton+MET transverse mass', inputTemplate: { file: '{file}', lepton: 'muon' } },
      { tool: 'fit_distribution', description: 'Fit the Jacobian edge', inputTemplate: { file: '{file}', field: 'mt', model: 'gaussian' } },
    ],
  },
  {
    name: 'Top Pair Analysis',
    description: 'Analyze top quark pair production in lepton+jets channel.',
    triggers: ['top quark', 'tt̄', 'ttbar', 'top pair', 't→wb'],
    steps: [
      { tool: 'read_dataset', description: 'Load dataset', inputTemplate: { file: '{file}' } },
      { tool: 'jet_clustering', description: 'Reconstruct jets', inputTemplate: { file: '{file}', R: '0.4' } },
      { tool: 'apply_cuts', description: 'Apply event selection: ≥1 lepton, ≥4 jets, MET > 20', inputTemplate: { file: '{file}', cuts: '["met>20"]' } },
      { tool: 'compute_invariant_mass', description: 'Reconstruct top mass from jet combinations', inputTemplate: { file: '{file}', particle1: 'jet', particle2: 'jet' } },
    ],
  },
  {
    name: 'New Physics Search',
    description: 'Generic search for anomalous signals: apply cuts, scan for resonances, set limits.',
    triggers: ['new physics', 'bsm', 'beyond standard model', 'anomaly', 'resonance search', 'bump hunt'],
    steps: [
      { tool: 'read_dataset', description: 'Load and inspect data', inputTemplate: { file: '{file}' } },
      { tool: 'apply_cuts', description: 'Apply baseline selection', inputTemplate: { file: '{file}', cuts: '["pt>30","eta<2.5"]' } },
      { tool: 'find_resonances', description: 'Scan for unexpected peaks', inputTemplate: { file: '{file}', field: 'mass' } },
      { tool: 'compute_significance', description: 'Estimate significance of any excess', inputTemplate: { file: '{file}', signal_range: '{peak_range}', background_range: '{sideband_range}' } },
      { tool: 'limit_setting', description: 'Set upper limits if no excess found', inputTemplate: { signal: '{S}', background: '{B}', observed: '{obs}' } },
    ],
  },
  {
    name: 'Full Analysis Pipeline',
    description: 'Complete analysis from search to results: find data, download, analyze, report.',
    triggers: ['full analysis', 'complete analysis', 'end to end', 'start to finish'],
    steps: [
      { tool: 'search_cern_data', description: 'Search for relevant datasets', inputTemplate: { query: '{query}' } },
      { tool: 'suggest_files', description: 'Recommend specific files', inputTemplate: { dataset_title: '{title}', research_question: '{question}' } },
      { tool: 'download_dataset', description: 'Download selected files', inputTemplate: { dataset_title: '{title}' } },
      { tool: 'read_dataset', description: 'Load and inspect', inputTemplate: { file: '{file}' } },
      { tool: 'apply_cuts', description: 'Apply physics selection', inputTemplate: { file: '{file}', cuts: '{cuts}' } },
      { tool: 'export_results', description: 'Export final report', inputTemplate: { title: '{title}', content: '{content}' } },
    ],
  },
];

export function findWorkflow(query: string): Workflow | undefined {
  const q = query.toLowerCase();
  return WORKFLOWS.find(w =>
    w.triggers.some(t => q.includes(t)) ||
    w.name.toLowerCase().includes(q)
  );
}

export function getWorkflowGuidance(): string {
  let guidance = '\n\nAVAILABLE ANALYSIS WORKFLOWS:\n';
  guidance += 'When a user asks about these topics, follow the corresponding workflow:\n\n';

  for (const wf of WORKFLOWS) {
    guidance += `${wf.name}:\n`;
    guidance += `  Triggers: ${wf.triggers.join(', ')}\n`;
    guidance += `  Steps:\n`;
    for (let i = 0; i < wf.steps.length; i++) {
      guidance += `    ${i + 1}. Use ${wf.steps[i].tool}: ${wf.steps[i].description}\n`;
    }
    guidance += '\n';
  }

  return guidance;
}
