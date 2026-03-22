"""
OpenCERN Data Processor — Multi-Format HEP → JSON Pipeline
================================================================
Supports ROOT (CMS NanoAOD, ATLAS flat ntuples, ALICE VSD/ESD),
CSV, TSV, LHE, HepMC, Parquet, HDF5, YODA, and plain-text NTuples.

Usage:
  python main.py ~/opencern-datasets/data/TTbar.root
  python main.py data/*.root --experiment atlas --workers 4
  python main.py data/events.csv --experiment cms
  python main.py data/pythia.lhe.gz
  python main.py data/mc_output.hepmc
"""

import uproot
import numpy as np
import awkward as ak
import json
import os
import sys
import glob
import argparse
import logging
import time
from pathlib import Path
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed

# ──────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("opencern.processor")


# ══════════════════════════════════════════════════════════════════
# EXPERIMENT PROFILES
# ══════════════════════════════════════════════════════════════════
# Each profile defines: tree names to search, particle branches,
# scalar branches, particle colors, and filtering criteria.

PROFILES = {
    # ──────────────────────────────────────────────────────────────
    # CMS — NanoAOD format
    # Tree: "Events", branches: Muon_pt, Jet_pt, MET_pt, etc.
    # ──────────────────────────────────────────────────────────────
    "cms": {
        "trees": ["Events", "events"],
        "detect_branches": ["Muon_pt", "Jet_pt", "MET_pt"],
        "particles": {
            "muon": {
                "pt": "Muon_pt", "eta": "Muon_eta", "phi": "Muon_phi",
                "charge": "Muon_charge", "mass": "Muon_mass",
                "iso": "Muon_pfRelIso03_all", "tightId": "Muon_tightId",
            },
            "electron": {
                "pt": "Electron_pt", "eta": "Electron_eta", "phi": "Electron_phi",
                "charge": "Electron_charge", "mass": "Electron_mass",
            },
            "jet": {
                "pt": "Jet_pt", "eta": "Jet_eta", "phi": "Jet_phi",
                "mass": "Jet_mass", "btag": "Jet_btag", "jetId": "Jet_jetId",
            },
            "tau": {
                "pt": "Tau_pt", "eta": "Tau_eta", "phi": "Tau_phi",
                "charge": "Tau_charge", "mass": "Tau_mass",
            },
            "photon": {
                "pt": "Photon_pt", "eta": "Photon_eta", "phi": "Photon_phi",
                "mass": "Photon_mass",
            },
        },
        "scalars": {
            "MET_pt": "met_pt", "MET_phi": "met_phi",
            "MET_significance": "met_sig",
            "HLT_IsoMu24": "trig_IsoMu24",
            "HLT_Ele27_WPTight_Gsf": "trig_Ele27",
        },
        "colors": {
            "muon": "#ff6b6b", "electron": "#7fbbb3", "jet": "#dbbc7f",
            "tau": "#d699b6", "photon": "#a7c080",
        },
        "filter": {
            "min_lep_pt": 20, "min_met": 20, "min_jet_pt": 30,
        },
    },

    # ──────────────────────────────────────────────────────────────
    # ATLAS — flat ntuple format
    # Tree: "mini", branches: lep_pt, jet_pt, met_et, etc.
    # ──────────────────────────────────────────────────────────────
    "atlas": {
        "trees": ["mini", "truth", "nominal", "CollectionTree"],
        "detect_branches": ["lep_pt", "lep_eta", "jet_pt"],
        "particles": {
            "lepton": {
                "pt": "lep_pt", "eta": "lep_eta", "phi": "lep_phi",
                "energy": "lep_e", "charge": "lep_charge", "type": "lep_type",
                "tight": "lep_isTightID",
            },
            "jet": {
                "pt": "jet_pt", "eta": "jet_eta", "phi": "jet_phi",
                "energy": "jet_e", "btag": "jet_MV2c10",
            },
            "tau": {
                "pt": "tau_pt", "eta": "tau_eta", "phi": "tau_phi",
                "energy": "tau_e", "charge": "tau_charge",
            },
            "photon": {
                "pt": "photon_pt", "eta": "photon_eta", "phi": "photon_phi",
                "energy": "photon_e",
            },
            "largeRjet": {
                "pt": "largeRjet_pt", "eta": "largeRjet_eta",
                "phi": "largeRjet_phi", "energy": "largeRjet_e",
                "mass": "largeRjet_m",
            },
        },
        "scalars": {
            "met_et": "met_pt", "met_phi": "met_phi",
            "mcWeight": "mc_weight",
            "scaleFactor_PILEUP": "sf_pileup",
            "scaleFactor_ELE": "sf_ele",
            "scaleFactor_MUON": "sf_muon",
            "trigE": "trig_electron", "trigM": "trig_muon",
            "lep_n": "n_leptons", "jet_n": "n_jets",
        },
        "colors": {
            "lepton": "#ff6b6b", "jet": "#dbbc7f", "tau": "#d699b6",
            "photon": "#a7c080", "largeRjet": "#e5c07b",
        },
        "filter": {
            "min_lep_pt": 25, "min_met": 25, "min_jet_pt": 25,
        },
    },

    # ──────────────────────────────────────────────────────────────
    # ALICE — VSD (Visual Server Display) / ESD format
    # Tree: "TE" (Tree of Events), branches: track arrays
    # Also handles AliVSD MasterClass format
    # ──────────────────────────────────────────────────────────────
    "alice": {
        "trees": ["TE", "VSD", "ESDTree", "esdTree", "aodTree", "TreeR"],
        "detect_branches": ["AliVSD", "ESDfriend", "Tracks", "SPDVertex"],
        "particles": {
            "track": {
                "pt": "fP.fUniqueID",  # Placeholder — ALICE uses nested objects
                "eta": "fP.fBits",
                "phi": "fP.fBits",
            },
            "muon": {
                "pt": "AliVSD.fR.fMuP.fX",
                "eta": "AliVSD.fR.fMuP.fY",
                "phi": "AliVSD.fR.fMuP.fZ",
            },
        },
        "scalars": {},
        "colors": {
            "track": "#7fbbb3", "muon": "#ff6b6b",
            "v0": "#a7c080", "cascade": "#e5c07b",
        },
        "filter": {
            "min_lep_pt": 0, "min_met": 0, "min_jet_pt": 0,
        },
    },
}


# ──────────────────────────────────────────────────────────────────
# Smart Experiment Detection
# ──────────────────────────────────────────────────────────────────
def detect_experiment(filepath: str) -> str:
    """
    Auto-detect the experiment by inspecting tree names and branches.
    Returns 'cms', 'atlas', or 'alice'.
    """
    with uproot.open(filepath) as f:
        keys = set(f.keys())
        key_names = {k.split(";")[0] for k in keys}

        for exp_name, profile in PROFILES.items():
            # Check if any known tree exists
            for tree_name in profile["trees"]:
                if tree_name in key_names:
                    # Found a matching tree — verify with branch names
                    try:
                        tree = f[tree_name]
                        branches = set(tree.keys())
                        detect = profile["detect_branches"]
                        matches = sum(1 for b in detect if b in branches)
                        if matches >= 1:
                            log.info(f"  Auto-detected: {exp_name.upper()} "
                                     f"(tree={tree_name}, matched {matches}/{len(detect)} branches)")
                            return exp_name
                    except Exception:
                        continue

        # Fallback: inspect all trees for branch patterns
        for key in key_names:
            try:
                obj = f[key]
                if not hasattr(obj, "keys"):
                    continue
                branches = set(obj.keys())

                # CMS signature: Muon_pt or Electron_pt
                if any(b.startswith("Muon_") or b.startswith("Electron_") for b in branches):
                    log.info(f"  Auto-detected: CMS (fallback, tree={key})")
                    return "cms"

                # ATLAS signature: lep_pt, jet_pt
                if any(b.startswith("lep_") for b in branches):
                    log.info(f"  Auto-detected: ATLAS (fallback, tree={key})")
                    return "atlas"

                # ALICE signature: nested objects with Ali*
                if any("Ali" in b or "ESD" in b for b in branches):
                    log.info(f"  Auto-detected: ALICE (fallback, tree={key})")
                    return "alice"
            except Exception:
                continue

    log.warning("  Could not auto-detect experiment. Defaulting to CMS.")
    return "cms"


# ──────────────────────────────────────────────────────────────────
# Vectorized Physics Helpers
# ──────────────────────────────────────────────────────────────────
def vec_to_cartesian(pt, eta, phi, mass):
    """Vectorized pt/eta/phi/mass → px/py/pz/energy."""
    px = pt * np.cos(phi)
    py = pt * np.sin(phi)
    pz = pt * np.sinh(eta)
    energy = np.sqrt(px**2 + py**2 + pz**2 + mass**2)
    return px, py, pz, energy


def vec_to_cartesian_from_energy(pt, eta, phi, energy):
    """Vectorized pt/eta/phi/energy → px/py/pz/mass (ATLAS style)."""
    px = pt * np.cos(phi)
    py = pt * np.sin(phi)
    pz = pt * np.sinh(eta)
    mass_sq = energy**2 - (px**2 + py**2 + pz**2)
    mass = np.sqrt(np.maximum(mass_sq, 0))
    return px, py, pz, mass


def vec_ht(jet_pt):
    if jet_pt is None:
        return None
    return ak.sum(jet_pt, axis=1)


def vec_leading_pt(*pt_arrays):
    maxes = []
    for pt in pt_arrays:
        if pt is not None and len(pt) > 0:
            safe_max = ak.fill_none(ak.max(pt, axis=1), 0.0)
            maxes.append(safe_max)
    if not maxes:
        return None
    combined = maxes[0]
    for m in maxes[1:]:
        combined = np.maximum(combined, m)
    return combined


# ──────────────────────────────────────────────────────────────────
# Multi-Format Support — Shared Helpers
# ──────────────────────────────────────────────────────────────────
SUPPORTED_EXTENSIONS = {
    '.root': 'root', '.csv': 'csv', '.tsv': 'tsv',
    '.lhe': 'lhe', '.lhe.gz': 'lhe',
    '.hepmc': 'hepmc', '.hepmc2': 'hepmc', '.hepmc3': 'hepmc',
    '.parquet': 'parquet',
    '.hdf5': 'hdf5', '.h5': 'hdf5',
    '.yoda': 'yoda',
    '.dat': 'ntuple', '.txt': 'ntuple', '.ntuple': 'ntuple',
}

PDG_MAP = {
    11: "electron", -11: "electron", 13: "muon", -13: "muon",
    15: "tau", -15: "tau", 22: "photon",
    12: "neutrino", -12: "neutrino", 14: "neutrino", -14: "neutrino",
    16: "neutrino", -16: "neutrino",
    1: "jet", -1: "jet", 2: "jet", -2: "jet", 3: "jet", -3: "jet",
    4: "jet", -4: "jet", 5: "jet", -5: "jet", 21: "jet",
    111: "photon", 211: "jet", -211: "jet",
    321: "jet", -321: "jet",
    2212: "jet", -2212: "jet",
}

COLORS = {
    "muon": "#ff6b6b", "electron": "#7fbbb3", "jet": "#dbbc7f",
    "tau": "#d699b6", "photon": "#a7c080", "neutrino": "#83c092",
    "track": "#7fbbb3", "unknown": "#ffffff",
}


def make_particle(ptype, pt, eta, phi, mass=0.0, energy=None,
                  charge=None, pdg_id=None, px=None, py=None, pz=None):
    """Standardized particle dict builder."""
    if px is None or py is None or pz is None:
        px_c, py_c, pz_c, e_c = vec_to_cartesian(
            np.array([pt]), np.array([eta]), np.array([phi]), np.array([mass]))
        px, py, pz = float(px_c[0]), float(py_c[0]), float(pz_c[0])
        if energy is None:
            energy = float(e_c[0])
    if energy is None:
        energy = float(np.sqrt(px**2 + py**2 + pz**2 + mass**2))
    p = {"type": ptype, "color": COLORS.get(ptype, "#ffffff"),
         "pt": round(float(pt), 3), "eta": round(float(eta), 3),
         "phi": round(float(phi), 3), "mass": round(float(mass), 4),
         "px": round(float(px), 3), "py": round(float(py), 3),
         "pz": round(float(pz), 3), "energy": round(float(energy), 3)}
    if charge is not None:
        p["charge"] = int(charge)
    if pdg_id is not None:
        p["pdg_id"] = int(pdg_id)
    return p


def write_output(filepath, format_name, experiment, events, total_scanned, elapsed, extra_meta=None):
    """Write standardized JSON output for any format."""
    filename = Path(filepath).stem
    output_dir = os.path.expanduser("~/opencern-datasets/processed/")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{filename}.json")
    metadata = {
        "source": os.path.basename(filepath), "format": format_name,
        "experiment": experiment.upper(), "events": len(events),
        "processed": datetime.now().isoformat(),
        "total_scanned": total_scanned, "processing_time_sec": round(elapsed, 2),
    }
    if extra_meta:
        metadata.update(extra_meta)
    output = {"metadata": metadata, "events": events}
    with open(output_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    log.info(f"Wrote {len(events)} events to {output_path} ({size_mb:.1f} MB)")
    return output_path


# ──────────────────────────────────────────────────────────────────
# Multi-Format Parsers
# ──────────────────────────────────────────────────────────────────

def _detect_columns(df):
    """Auto-detect column roles from a DataFrame using case-insensitive matching."""
    cols = {c.lower(): c for c in df.columns}
    mapping = {}
    # Direct matches
    for field in ['pt', 'eta', 'phi', 'mass', 'px', 'py', 'pz', 'energy',
                  'pdg_id', 'type', 'charge', 'event_id']:
        if field in cols:
            mapping[field] = cols[field]
    # CMS-style: Muon_pt etc.
    for c in df.columns:
        cl = c.lower()
        if cl.startswith('muon_') or cl.startswith('electron_') or cl.startswith('jet_'):
            mapping.setdefault('_cms_style', True)
            break
    # ATLAS-style: lep_pt etc.
    for c in df.columns:
        cl = c.lower()
        if cl.startswith('lep_') or cl.startswith('jet_'):
            mapping.setdefault('_atlas_style', True)
            break
    # Event grouping column
    for candidate in ['event_id', 'event', 'entry', 'eventid', 'evt']:
        if candidate in cols:
            mapping['_group_col'] = cols[candidate]
            break
    return mapping


def _cartesian_to_cylindrical(px, py, pz):
    """Convert px/py/pz to pt/eta/phi."""
    pt = np.sqrt(px**2 + py**2)
    p = np.sqrt(px**2 + py**2 + pz**2)
    eta = np.where(p > pt, np.arctanh(np.clip(pz / np.maximum(p, 1e-10), -1+1e-10, 1-1e-10)), 0.0)
    phi = np.arctan2(py, px)
    return pt, eta, phi


def process_csv_file(filepath, max_events=5000, experiment="auto", delimiter=','):
    """Process CSV/TSV files with auto-detected columns."""
    import pandas as pd
    filepath = os.path.expanduser(filepath)
    t0 = time.perf_counter()
    fmt = 'tsv' if delimiter == '\t' else 'csv'
    log.info(f"Processing {fmt.upper()} file: {filepath}")

    df = pd.read_csv(filepath, delimiter=delimiter)
    col_map = _detect_columns(df)

    if experiment == "auto":
        if col_map.get('_cms_style'):
            experiment = "cms"
        elif col_map.get('_atlas_style'):
            experiment = "atlas"
        else:
            experiment = "generic"

    group_col = col_map.get('_group_col')
    events = []

    if group_col:
        groups = df.groupby(group_col)
    else:
        groups = [(i, df.iloc[[i]]) for i in range(len(df))]

    for event_id, group in groups:
        if len(events) >= max_events:
            break
        particles = []
        for _, row in (group.iterrows() if hasattr(group, 'iterrows') else [(0, group.iloc[0])]):
            row_dict = row.to_dict() if hasattr(row, 'to_dict') else dict(row)
            # Determine pt/eta/phi/mass or compute from px/py/pz
            has_cyl = all(k in col_map for k in ['pt', 'eta', 'phi'])
            has_cart = all(k in col_map for k in ['px', 'py', 'pz'])

            if has_cyl:
                pt = float(row_dict[col_map['pt']])
                eta = float(row_dict[col_map['eta']])
                phi = float(row_dict[col_map['phi']])
                mass = float(row_dict.get(col_map.get('mass', ''), 0) or 0)
                px_v = float(row_dict[col_map['px']]) if has_cart else None
                py_v = float(row_dict[col_map['py']]) if has_cart else None
                pz_v = float(row_dict[col_map['pz']]) if has_cart else None
                energy = float(row_dict[col_map['energy']]) if 'energy' in col_map else None
            elif has_cart:
                px_v = float(row_dict[col_map['px']])
                py_v = float(row_dict[col_map['py']])
                pz_v = float(row_dict[col_map['pz']])
                pt_a, eta_a, phi_a = _cartesian_to_cylindrical(
                    np.array([px_v]), np.array([py_v]), np.array([pz_v]))
                pt, eta, phi = float(pt_a[0]), float(eta_a[0]), float(phi_a[0])
                mass = float(row_dict.get(col_map.get('mass', ''), 0) or 0)
                energy = float(row_dict[col_map['energy']]) if 'energy' in col_map else None
            else:
                continue

            ptype = str(row_dict.get(col_map.get('type', ''), 'track'))
            if 'pdg_id' in col_map:
                pdg = int(row_dict[col_map['pdg_id']])
                ptype = PDG_MAP.get(pdg, 'unknown')
            else:
                pdg = None
            charge = int(row_dict[col_map['charge']]) if 'charge' in col_map else None

            particles.append(make_particle(
                ptype, pt, eta, phi, mass=mass, energy=energy,
                charge=charge, pdg_id=pdg, px=px_v, py=py_v, pz=pz_v))

        if particles:
            events.append({
                "event_id": int(event_id) if not isinstance(event_id, tuple) else len(events),
                "experiment": experiment.upper(),
                "particles": particles,
            })

    elapsed = time.perf_counter() - t0
    return write_output(filepath, fmt, experiment, events, len(df), elapsed)


def process_lhe_file(filepath, max_events=5000):
    """Process LHE (Les Houches Event) files."""
    import pylhe
    filepath = os.path.expanduser(filepath)
    t0 = time.perf_counter()
    log.info(f"Processing LHE file: {filepath}")

    events = []
    total = 0
    for lhe_event in pylhe.read_lhe_with_attributes(filepath):
        total += 1
        if len(events) >= max_events:
            continue
        particles = []
        for p in lhe_event.particles:
            if p.status != 1:
                continue
            px, py, pz, e = p.px, p.py, p.pz, p.e
            pt = np.sqrt(px**2 + py**2)
            p_mag = np.sqrt(px**2 + py**2 + pz**2)
            eta = float(np.arctanh(np.clip(pz / max(p_mag, 1e-10), -1+1e-10, 1-1e-10)))
            phi = float(np.arctan2(py, px))
            ptype = PDG_MAP.get(p.id, "unknown")
            charge = int(round(p.spin)) if hasattr(p, 'spin') else None
            particles.append(make_particle(
                ptype, pt, eta, phi, mass=p.m, energy=e,
                pdg_id=p.id, px=px, py=py, pz=pz, charge=charge))
        if particles:
            events.append({
                "event_id": total,
                "experiment": "GENERIC",
                "particles": particles,
            })

    elapsed = time.perf_counter() - t0
    return write_output(filepath, "lhe", "generic", events, total, elapsed)


def process_hepmc_file(filepath, max_events=5000):
    """Process HepMC2/HepMC3 files."""
    import pyhepmc
    filepath = os.path.expanduser(filepath)
    t0 = time.perf_counter()
    log.info(f"Processing HepMC file: {filepath}")

    events = []
    total = 0
    with pyhepmc.open(filepath) as f:
        for hepmc_event in f:
            total += 1
            if len(events) >= max_events:
                continue
            particles = []
            for p in hepmc_event.particles:
                if p.status != 1:
                    continue
                mom = p.momentum
                px, py, pz, e = mom.px, mom.py, mom.pz, mom.e
                pt = np.sqrt(px**2 + py**2)
                p_mag = np.sqrt(px**2 + py**2 + pz**2)
                eta = float(np.arctanh(np.clip(pz / max(p_mag, 1e-10), -1+1e-10, 1-1e-10)))
                phi = float(np.arctan2(py, px))
                ptype = PDG_MAP.get(p.pid, "unknown")
                mass = p.generated_mass if hasattr(p, 'generated_mass') and p.generated_mass else 0.0
                particles.append(make_particle(
                    ptype, pt, eta, phi, mass=mass, energy=e,
                    pdg_id=p.pid, px=px, py=py, pz=pz))
            if particles:
                events.append({
                    "event_id": total,
                    "experiment": "GENERIC",
                    "particles": particles,
                })

    elapsed = time.perf_counter() - t0
    return write_output(filepath, "hepmc", "generic", events, total, elapsed)


def process_parquet_file(filepath, max_events=5000, experiment="auto"):
    """Process Parquet files (e.g. CMS NanoAOD exports)."""
    import pyarrow.parquet as pq
    import pandas as pd
    filepath = os.path.expanduser(filepath)
    t0 = time.perf_counter()
    log.info(f"Processing Parquet file: {filepath}")

    pf = pq.ParquetFile(filepath)
    all_rows = []
    for batch in pf.iter_batches(batch_size=50000):
        all_rows.append(batch.to_pandas())
        if sum(len(r) for r in all_rows) > max_events * 10:
            break
    df = pd.concat(all_rows, ignore_index=True)

    # Reuse CSV-style column detection and processing
    col_map = _detect_columns(df)
    if experiment == "auto":
        if col_map.get('_cms_style'):
            experiment = "cms"
        elif col_map.get('_atlas_style'):
            experiment = "atlas"
        else:
            experiment = "generic"

    group_col = col_map.get('_group_col')
    events = []

    if group_col:
        groups = df.groupby(group_col)
    else:
        groups = [(i, df.iloc[[i]]) for i in range(len(df))]

    for event_id, group in groups:
        if len(events) >= max_events:
            break
        particles = []
        for _, row in (group.iterrows() if hasattr(group, 'iterrows') else [(0, group.iloc[0])]):
            row_dict = row.to_dict()
            has_cyl = all(k in col_map for k in ['pt', 'eta', 'phi'])
            has_cart = all(k in col_map for k in ['px', 'py', 'pz'])
            if has_cyl:
                pt = float(row_dict[col_map['pt']])
                eta = float(row_dict[col_map['eta']])
                phi = float(row_dict[col_map['phi']])
                mass = float(row_dict.get(col_map.get('mass', ''), 0) or 0)
                px_v = float(row_dict[col_map['px']]) if has_cart else None
                py_v = float(row_dict[col_map['py']]) if has_cart else None
                pz_v = float(row_dict[col_map['pz']]) if has_cart else None
                energy = float(row_dict[col_map['energy']]) if 'energy' in col_map else None
            elif has_cart:
                px_v = float(row_dict[col_map['px']])
                py_v = float(row_dict[col_map['py']])
                pz_v = float(row_dict[col_map['pz']])
                pt_a, eta_a, phi_a = _cartesian_to_cylindrical(
                    np.array([px_v]), np.array([py_v]), np.array([pz_v]))
                pt, eta, phi = float(pt_a[0]), float(eta_a[0]), float(phi_a[0])
                mass = float(row_dict.get(col_map.get('mass', ''), 0) or 0)
                energy = float(row_dict[col_map['energy']]) if 'energy' in col_map else None
            else:
                continue

            ptype = str(row_dict.get(col_map.get('type', ''), 'track'))
            pdg = int(row_dict[col_map['pdg_id']]) if 'pdg_id' in col_map else None
            if pdg is not None:
                ptype = PDG_MAP.get(pdg, 'unknown')
            charge = int(row_dict[col_map['charge']]) if 'charge' in col_map else None
            particles.append(make_particle(
                ptype, pt, eta, phi, mass=mass, energy=energy,
                charge=charge, pdg_id=pdg, px=px_v, py=py_v, pz=pz_v))

        if particles:
            events.append({
                "event_id": int(event_id) if not isinstance(event_id, tuple) else len(events),
                "experiment": experiment.upper(),
                "particles": particles,
            })

    elapsed = time.perf_counter() - t0
    return write_output(filepath, "parquet", experiment, events, len(df), elapsed)


def process_hdf5_file(filepath, max_events=5000, experiment="auto"):
    """Process HDF5 files by scanning for known dataset patterns."""
    import h5py
    filepath = os.path.expanduser(filepath)
    t0 = time.perf_counter()
    log.info(f"Processing HDF5 file: {filepath}")

    with h5py.File(filepath, 'r') as f:
        datasets = {}
        def visitor(name, obj):
            if isinstance(obj, h5py.Dataset):
                datasets[name] = obj.shape
        f.visititems(visitor)

        # Try to find pt/eta/phi datasets
        ds_names = list(datasets.keys())
        log.info(f"  Found {len(ds_names)} datasets in HDF5")

        # Look for known patterns
        pt_ds = eta_ds = phi_ds = mass_ds = energy_ds = None
        pdg_ds = event_id_ds = None
        for name in ds_names:
            lower = name.lower().split('/')[-1]
            if lower in ('pt', 'muon_pt', 'jet_pt', 'electron_pt') and pt_ds is None:
                pt_ds = name
            elif lower in ('eta', 'muon_eta', 'jet_eta', 'electron_eta') and eta_ds is None:
                eta_ds = name
            elif lower in ('phi', 'muon_phi', 'jet_phi', 'electron_phi') and phi_ds is None:
                phi_ds = name
            elif lower in ('mass', 'muon_mass', 'jet_mass') and mass_ds is None:
                mass_ds = name
            elif lower in ('energy', 'e') and energy_ds is None:
                energy_ds = name
            elif lower in ('pdg_id', 'pdgid', 'pid') and pdg_ds is None:
                pdg_ds = name
            elif lower in ('event_id', 'event', 'entry') and event_id_ds is None:
                event_id_ds = name

        if pt_ds is None or eta_ds is None or phi_ds is None:
            log.error(f"  Cannot find pt/eta/phi datasets in HDF5. Available: {ds_names[:20]}")
            sys.exit(1)

        pt_arr = np.array(f[pt_ds][:])
        eta_arr = np.array(f[eta_ds][:])
        phi_arr = np.array(f[phi_ds][:])
        mass_arr = np.array(f[mass_ds][:]) if mass_ds else np.zeros_like(pt_arr)
        energy_arr = np.array(f[energy_ds][:]) if energy_ds else None
        pdg_arr = np.array(f[pdg_ds][:]) if pdg_ds else None
        event_id_arr = np.array(f[event_id_ds][:]) if event_id_ds else None

    if experiment == "auto":
        # Guess from dataset names
        if any('Muon_' in n for n in ds_names):
            experiment = "cms"
        elif any('lep_' in n for n in ds_names):
            experiment = "atlas"
        else:
            experiment = "generic"

    events = []
    total = len(pt_arr)

    if event_id_arr is not None:
        unique_events = np.unique(event_id_arr)
        for eid in unique_events:
            if len(events) >= max_events:
                break
            mask = event_id_arr == eid
            particles = []
            for j in np.where(mask)[0]:
                ptype = PDG_MAP.get(int(pdg_arr[j]), "track") if pdg_arr is not None else "track"
                e = float(energy_arr[j]) if energy_arr is not None else None
                particles.append(make_particle(
                    ptype, float(pt_arr[j]), float(eta_arr[j]), float(phi_arr[j]),
                    mass=float(mass_arr[j]), energy=e,
                    pdg_id=int(pdg_arr[j]) if pdg_arr is not None else None))
            if particles:
                events.append({
                    "event_id": int(eid), "experiment": experiment.upper(),
                    "particles": particles,
                })
    else:
        for i in range(min(total, max_events)):
            ptype = PDG_MAP.get(int(pdg_arr[i]), "track") if pdg_arr is not None else "track"
            e = float(energy_arr[i]) if energy_arr is not None else None
            p = make_particle(
                ptype, float(pt_arr[i]), float(eta_arr[i]), float(phi_arr[i]),
                mass=float(mass_arr[i]), energy=e,
                pdg_id=int(pdg_arr[i]) if pdg_arr is not None else None)
            events.append({
                "event_id": i, "experiment": experiment.upper(),
                "particles": [p],
            })

    elapsed = time.perf_counter() - t0
    return write_output(filepath, "hdf5", experiment, events, total, elapsed)


def process_yoda_file(filepath, max_events=5000):
    """Process YODA histogram files by synthesizing pseudo-events from bins."""
    filepath = os.path.expanduser(filepath)
    t0 = time.perf_counter()
    log.info(f"Processing YODA file: {filepath}")

    events = []
    total_bins = 0
    experiment = "generic"

    with open(filepath, 'r') as f:
        in_histo = False
        histo_path = ""
        for line in f:
            line = line.strip()
            if line.startswith("BEGIN HISTO1D"):
                in_histo = True
                histo_path = line.split()[-1] if len(line.split()) > 2 else ""
                # Try to detect experiment from path
                if "/ATLAS" in histo_path.upper():
                    experiment = "atlas"
                elif "/CMS" in histo_path.upper():
                    experiment = "cms"
                elif "/ALICE" in histo_path.upper():
                    experiment = "alice"
                continue
            if line.startswith("END HISTO1D"):
                in_histo = False
                continue
            if not in_histo or line.startswith("#") or line.startswith("---"):
                continue
            parts = line.split()
            if len(parts) >= 3:
                try:
                    xlow = float(parts[0])
                    xhigh = float(parts[1])
                    sumw = float(parts[2])
                    if sumw <= 0:
                        continue
                    total_bins += 1
                    if len(events) >= max_events:
                        continue
                    bin_center = (xlow + xhigh) / 2.0
                    events.append({
                        "event_id": len(events) + 1,
                        "experiment": experiment.upper(),
                        "particles": [make_particle(
                            "track", abs(bin_center), 0.0, 0.0,
                            energy=abs(sumw))],
                    })
                except ValueError:
                    continue

    elapsed = time.perf_counter() - t0
    return write_output(filepath, "yoda", experiment, events, total_bins, elapsed,
                        extra_meta={"synthetic": True})


def process_ntuple_file(filepath, max_events=5000, experiment="auto"):
    """Process plain-text NTuple files (.dat, .txt)."""
    filepath = os.path.expanduser(filepath)
    t0 = time.perf_counter()
    log.info(f"Processing NTuple file: {filepath}")

    if experiment == "auto":
        experiment = "generic"

    with open(filepath, 'r') as f:
        lines = f.readlines()

    # Strip comments and empty lines
    data_lines = []
    header = None
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('#'):
            # Last comment line might be a header
            header = stripped.lstrip('#').strip().split()
            continue
        # First non-comment line: check if it's a header
        if header is None:
            try:
                [float(x) for x in stripped.split()]
            except ValueError:
                header = stripped.split()
                continue
        data_lines.append(stripped)

    if not data_lines:
        log.error("No data found in NTuple file")
        sys.exit(1)

    ncols = len(data_lines[0].split())

    # Infer column meanings
    if header and len(header) == ncols:
        col_names = [h.lower() for h in header]
    elif ncols == 4:
        col_names = ['pt', 'eta', 'phi', 'mass']
    elif ncols == 7:
        col_names = ['px', 'py', 'pz', 'energy', 'mass', 'pdg_id', 'charge']
    else:
        log.error(f"Cannot infer columns for {ncols}-column NTuple (no header). "
                  f"Hint: use 4 cols (pt eta phi mass) or 7 cols (px py pz energy mass pdg_id charge).")
        sys.exit(1)

    events = []
    total = len(data_lines)
    for i, line in enumerate(data_lines):
        if len(events) >= max_events:
            break
        vals = line.split()
        if len(vals) != ncols:
            continue
        try:
            row = {col_names[j]: float(vals[j]) for j in range(ncols)}
        except ValueError:
            continue

        if 'pt' in row and 'eta' in row and 'phi' in row:
            pt, eta, phi = row['pt'], row['eta'], row['phi']
            mass = row.get('mass', 0.0)
            px_v = py_v = pz_v = None
        elif 'px' in row and 'py' in row and 'pz' in row:
            px_v, py_v, pz_v = row['px'], row['py'], row['pz']
            pt_a, eta_a, phi_a = _cartesian_to_cylindrical(
                np.array([px_v]), np.array([py_v]), np.array([pz_v]))
            pt, eta, phi = float(pt_a[0]), float(eta_a[0]), float(phi_a[0])
            mass = row.get('mass', 0.0)
        else:
            continue

        pdg = int(row['pdg_id']) if 'pdg_id' in row else None
        ptype = PDG_MAP.get(pdg, "track") if pdg is not None else "track"
        charge = int(row['charge']) if 'charge' in row else None
        energy = row.get('energy')

        p = make_particle(ptype, pt, eta, phi, mass=mass, energy=energy,
                          charge=charge, pdg_id=pdg, px=px_v, py=py_v, pz=pz_v)
        events.append({
            "event_id": i + 1, "experiment": experiment.upper(),
            "particles": [p],
        })

    elapsed = time.perf_counter() - t0
    return write_output(filepath, "ntuple", experiment, events, total, elapsed)


# ──────────────────────────────────────────────────────────────────
# Multi-Format Dispatcher
# ──────────────────────────────────────────────────────────────────
def process_file(filepath, chunk_size=50_000, max_events=5_000, experiment="auto"):
    """Route a file to the appropriate parser based on extension."""
    ext = Path(filepath).suffix.lower()
    if filepath.lower().endswith('.lhe.gz'):
        ext = '.lhe.gz'
    fmt = SUPPORTED_EXTENSIONS.get(ext)
    if fmt == 'root':
        return process_root_file(filepath, chunk_size, max_events, experiment)
    elif fmt == 'csv':
        return process_csv_file(filepath, max_events, experiment)
    elif fmt == 'tsv':
        return process_csv_file(filepath, max_events, experiment, delimiter='\t')
    elif fmt == 'lhe':
        return process_lhe_file(filepath, max_events)
    elif fmt == 'hepmc':
        return process_hepmc_file(filepath, max_events)
    elif fmt == 'parquet':
        return process_parquet_file(filepath, max_events, experiment)
    elif fmt == 'hdf5':
        return process_hdf5_file(filepath, max_events, experiment)
    elif fmt == 'yoda':
        return process_yoda_file(filepath, max_events)
    elif fmt == 'ntuple':
        return process_ntuple_file(filepath, max_events, experiment)
    else:
        log.error(f"Unsupported format: {ext}")
        sys.exit(1)


# ──────────────────────────────────────────────────────────────────
# Tree & Branch Resolution
# ──────────────────────────────────────────────────────────────────
def resolve_tree(filepath: str, profile: dict) -> str:
    """Find the main TTree in the file using the profile's tree list."""
    with uproot.open(filepath) as f:
        key_names = {k.split(";")[0] for k in f.keys()}
        for candidate in profile["trees"]:
            if candidate in key_names:
                return candidate
        # Fallback: first object with entries
        for key in f.keys():
            obj = f[key]
            if hasattr(obj, "num_entries"):
                return key.split(";")[0]
    raise RuntimeError(f"No TTree found in {filepath}")


def resolve_branches(filepath: str, tree_name: str, profile: dict):
    """Return the subset of branches from the profile that exist in the file."""
    with uproot.open(filepath) as f:
        tree = f[tree_name]
        available = set(tree.keys())

    particle_branches = {}
    for ptype, mapping in profile["particles"].items():
        resolved = {}
        for alias, root_name in mapping.items():
            if root_name in available:
                resolved[alias] = root_name
        # Need at least pt + (eta or energy) to be useful
        if "pt" in resolved and ("eta" in resolved or "energy" in resolved):
            particle_branches[ptype] = resolved

    scalar_resolved = {}
    for root_name, alias in profile["scalars"].items():
        if root_name in available:
            scalar_resolved[alias] = root_name

    return particle_branches, scalar_resolved


# ──────────────────────────────────────────────────────────────────
# Core: process a single chunk (vectorized)
# ──────────────────────────────────────────────────────────────────
def process_chunk(chunk_data, particle_branches, scalar_resolved,
                  profile, experiment, global_offset):
    """
    Process one chunk of events with vectorized operations.
    Handles CMS (mass-based) and ATLAS (energy-based) kinematics.
    """
    n_events = 0
    for ptype, mapping in particle_branches.items():
        for alias, root_name in mapping.items():
            if root_name in chunk_data.get(ptype, {}):
                arr = chunk_data[ptype][root_name]
                n_events = len(arr)
                break
        if n_events > 0:
            break
    if n_events == 0:
        # Try scalars
        for alias, root_name in scalar_resolved.items():
            if root_name in chunk_data.get("_scalars", {}):
                n_events = len(chunk_data["_scalars"][root_name])
                break
    if n_events == 0:
        return []

    # ── Read particle arrays ──
    particle_arrays = {}
    for ptype, mapping in particle_branches.items():
        arrays = {}
        for alias, root_name in mapping.items():
            if root_name in chunk_data.get(ptype, {}):
                arrays[alias] = chunk_data[ptype][root_name]
        particle_arrays[ptype] = arrays

    # ── Read scalar arrays ──
    scalars = {}
    for alias, root_name in scalar_resolved.items():
        if root_name in chunk_data.get("_scalars", {}):
            scalars[alias] = chunk_data["_scalars"][root_name]

    # ── Get primary particle pT arrays for filtering ──
    # CMS: muon/electron, ATLAS: lepton, ALICE: track
    primary_pts = []
    for ptype in particle_arrays:
        if "pt" in particle_arrays[ptype]:
            primary_pts.append(particle_arrays[ptype]["pt"])

    jet_pt = None
    for ptype in ["jet"]:
        if ptype in particle_arrays and "pt" in particle_arrays[ptype]:
            jet_pt = particle_arrays[ptype]["pt"]

    ht = vec_ht(jet_pt)
    leading_lep_pt = vec_leading_pt(*primary_pts) if primary_pts else None

    met_pt = scalars.get("met_pt")
    met_phi = scalars.get("met_phi")

    # ── Filtering ──
    filt = profile.get("filter", {})
    mask = np.ones(n_events, dtype=bool)

    if leading_lep_pt is not None and filt.get("min_lep_pt", 0) > 0:
        mask &= np.asarray(leading_lep_pt) > filt["min_lep_pt"]

    if met_pt is not None and filt.get("min_met", 0) > 0:
        mask &= np.asarray(met_pt) > filt["min_met"]

    if jet_pt is not None and filt.get("min_jet_pt", 0) > 0:
        jet_max = ak.fill_none(ak.max(jet_pt, axis=1), 0.0)
        mask &= np.asarray(jet_max) > filt["min_jet_pt"]

    # For ALICE, accept all events (no MET/jet cuts)
    if experiment == "alice":
        mask = np.ones(n_events, dtype=bool)

    indices = np.where(mask)[0]
    if len(indices) == 0:
        return []

    colors = profile.get("colors", {})
    uses_energy = experiment == "atlas"

    # ── Build events ──
    events = []
    for idx in indices:
        i = int(idx)
        event = {
            "index": global_offset + i,
            "experiment": experiment.upper(),
            "ht": round(float(ht[i]), 2) if ht is not None else 0.0,
            "met": round(float(met_pt[i]), 2) if met_pt is not None else 0.0,
            "leading_lepton_pt": round(float(leading_lep_pt[i]), 2) if leading_lep_pt is not None else 0.0,
            "particles": [],
            "met_vector": {
                "pt": round(float(met_pt[i]), 2) if met_pt is not None else 0.0,
                "phi": round(float(met_phi[i]), 3) if met_phi is not None else 0.0,
            },
        }

        for ptype, arrays in particle_arrays.items():
            if "pt" not in arrays:
                continue
            try:
                pts = np.asarray(arrays["pt"][i], dtype=np.float64)
                if len(pts) == 0:
                    continue

                etas = np.asarray(arrays["eta"][i], dtype=np.float64) if "eta" in arrays else np.zeros_like(pts)
                phis = np.asarray(arrays["phi"][i], dtype=np.float64) if "phi" in arrays else np.zeros_like(pts)

                if uses_energy and "energy" in arrays:
                    energies = np.asarray(arrays["energy"][i], dtype=np.float64)
                    px, py, pz, masses = vec_to_cartesian_from_energy(pts, etas, phis, energies)
                else:
                    masses = np.asarray(arrays.get("mass", ak.zeros_like(arrays["pt"]))[i], dtype=np.float64)
                    px, py, pz, energies = vec_to_cartesian(pts, etas, phis, masses)

                color = colors.get(ptype, "#ffffff")

                for j in range(len(pts)):
                    particle = {
                        "type": ptype,
                        "color": color,
                        "pt": round(float(pts[j]), 3),
                        "eta": round(float(etas[j]), 3),
                        "phi": round(float(phis[j]), 3),
                        "mass": round(float(masses[j]), 4) if not uses_energy else round(float(masses[j]), 4),
                        "px": round(float(px[j]), 3),
                        "py": round(float(py[j]), 3),
                        "pz": round(float(pz[j]), 3),
                        "energy": round(float(energies[j]), 3),
                    }
                    event["particles"].append(particle)
            except Exception:
                continue

        events.append(event)

    return events


# ──────────────────────────────────────────────────────────────────
# Core: process a single ROOT file
# ──────────────────────────────────────────────────────────────────
def process_root_file(filepath: str, chunk_size: int = 50_000,
                      max_events: int = 5_000, experiment: str = "auto") -> str:
    """
    Process a single ROOT file. Auto-detects experiment if needed.
    """
    filepath = os.path.expanduser(filepath)
    filename = Path(filepath).stem
    t0 = time.perf_counter()

    log.info("╔══════════════════════════════════════════════════════╗")
    log.info("║  OpenCERN Multi-Experiment Processor                ║")
    log.info("╚══════════════════════════════════════════════════════╝")
    log.info(f"  File     : {filepath}")

    # ── Detect or use forced experiment ──
    if experiment == "auto":
        experiment = detect_experiment(filepath)
    else:
        experiment = experiment.lower()
        log.info(f"  Forced   : {experiment.upper()}")

    profile = PROFILES.get(experiment)
    if not profile:
        log.error(f"  Unknown experiment: {experiment}")
        sys.exit(1)

    log.info(f"  Experiment: {experiment.upper()}")
    log.info(f"  Chunk    : {chunk_size:,} events/batch")
    log.info(f"  Max Out  : {max_events:,} events")

    # ── Resolve tree and branches ──
    tree_name = resolve_tree(filepath, profile)
    particle_branches, scalar_resolved = resolve_branches(filepath, tree_name, profile)

    log.info(f"  Tree     : {tree_name}")
    log.info(f"  Particles: {', '.join(particle_branches.keys()) or 'none'}")
    log.info(f"  Scalars  : {', '.join(scalar_resolved.keys()) or 'none'}")

    if not particle_branches and not scalar_resolved:
        log.warning("  No recognized branches found. Trying generic scan...")
        # Generic mode: just list what's in the tree
        with uproot.open(filepath) as f:
            tree = f[tree_name]
            log.info(f"  Available branches ({len(tree.keys())}):")
            for b in sorted(tree.keys())[:20]:
                log.info(f"    - {b}")
        log.error("  Cannot process — no matching branches for any profile.")
        return ""

    # Build flat branch list
    all_branches = []
    for mapping in particle_branches.values():
        all_branches.extend(mapping.values())
    all_branches.extend(scalar_resolved.values())
    all_branches = list(set(all_branches))

    # ── Chunked iteration ──
    all_events = []
    total_scanned = 0
    chunk_idx = 0

    for chunk in uproot.iterate(
        f"{filepath}:{tree_name}",
        expressions=all_branches,
        step_size=chunk_size,
        library="ak",
    ):
        chunk_len = len(chunk[all_branches[0]])
        chunk_idx += 1

        # Reorganize chunk
        chunk_data = {}
        for ptype, mapping in particle_branches.items():
            chunk_data[ptype] = {}
            for alias, root_name in mapping.items():
                if root_name in chunk.fields:
                    chunk_data[ptype][root_name] = chunk[root_name]

        chunk_data["_scalars"] = {}
        for alias, root_name in scalar_resolved.items():
            if root_name in chunk.fields:
                chunk_data["_scalars"][root_name] = chunk[root_name]

        events = process_chunk(
            chunk_data, particle_branches, scalar_resolved,
            profile, experiment, total_scanned
        )
        all_events.extend(events)
        total_scanned += chunk_len

        log.info(f"  Chunk {chunk_idx:>3} | scanned {total_scanned:>8,} | passed {len(all_events):>6,}")

        if len(all_events) >= max_events * 2:
            log.info("  Early exit: sufficient events collected.")
            break

    # ── Sort by HT descending and cap ──
    all_events.sort(key=lambda e: e.get("ht", 0), reverse=True)
    all_events = all_events[:max_events]

    elapsed = time.perf_counter() - t0

    # ── Write output ──
    output_dir = os.path.expanduser("~/opencern-datasets/processed/")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{filename}.json")

    summary = {
        "source_file": filepath,
        "experiment": experiment.upper(),
        "tree_name": tree_name,
        "total_scanned": total_scanned,
        "filtered_events": len(all_events),
        "processing_time_sec": round(elapsed, 2),
        "events_per_sec": round(total_scanned / max(elapsed, 0.001)),
        "processed_at": datetime.now().isoformat(),
        "particle_types": list(particle_branches.keys()),
        "ht_distribution": np.histogram(
            [e.get("ht", 0) for e in all_events], bins=20
        )[0].tolist() if all_events else [],
        "met_distribution": np.histogram(
            [e.get("met", 0) for e in all_events], bins=20
        )[0].tolist() if all_events else [],
        "avg_particles_per_event": round(
            np.mean([len(e["particles"]) for e in all_events]), 2
        ) if all_events else 0,
    }

    output = {"metadata": summary, "events": all_events}

    with open(output_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    size_mb = os.path.getsize(output_path) / (1024 * 1024)

    log.info("╔══════════════════════════════════════════════════════╗")
    log.info("║  Processing Complete                                ║")
    log.info("╚══════════════════════════════════════════════════════╝")
    log.info(f"  Experiment: {experiment.upper()}")
    log.info(f"  Scanned   : {total_scanned:>10,} events")
    log.info(f"  Filtered  : {len(all_events):>10,} events")
    log.info(f"  Elapsed   : {elapsed:>10.2f} sec")
    log.info(f"  Throughput: {total_scanned / max(elapsed, 0.001):>10,.0f} events/sec")
    log.info(f"  Output    : {output_path} ({size_mb:.1f} MB)")

    return output_path


# ──────────────────────────────────────────────────────────────────
# Multi-file Parallel Processing
# ──────────────────────────────────────────────────────────────────
def process_multiple(file_list, chunk_size, max_events, workers, experiment):
    log.info(f"Processing {len(file_list)} files with {workers} workers...")
    results = {}

    if workers <= 1 or len(file_list) == 1:
        for fp in file_list:
            try:
                out = process_file(fp, chunk_size, max_events, experiment)
                results[fp] = {"status": "ok", "output": out}
            except Exception as e:
                log.error(f"Failed: {fp} — {e}")
                results[fp] = {"status": "error", "error": str(e)}
    else:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(process_file, fp, chunk_size, max_events, experiment): fp
                for fp in file_list
            }
            for future in as_completed(futures):
                fp = futures[future]
                try:
                    out = future.result()
                    results[fp] = {"status": "ok", "output": out}
                    log.info(f"✔ {Path(fp).name}")
                except Exception as e:
                    log.error(f"✘ {Path(fp).name} — {e}")
                    results[fp] = {"status": "error", "error": str(e)}

    succeeded = sum(1 for r in results.values() if r["status"] == "ok")
    failed = len(results) - succeeded
    log.info(f"Done: {succeeded} succeeded, {failed} failed out of {len(file_list)} files.")
    return results


# ──────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────
def build_parser():
    parser = argparse.ArgumentParser(
        prog="opencern-processor",
        description="OpenCERN Multi-Format HEP Data Processor — ROOT/CSV/LHE/HepMC/Parquet/HDF5/YODA/NTuple → JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Experiments:
  auto    Smart auto-detection (default) — inspects tree/branch names
  cms     CMS NanoAOD format (Muon_pt, Jet_pt, MET_pt)
  atlas   ATLAS flat ntuples (lep_pt, jet_pt, met_et)
  alice   ALICE VSD/ESD format (tracks, V0s, muons)

Examples:
  python main.py ~/data/TTbar.root                          # auto-detect CMS
  python main.py ~/data/atlas_data.root --experiment atlas   # force ATLAS
  python main.py ~/data/*.root --workers 4                   # parallel multi-file
  python main.py ~/data/alice/ --experiment alice             # ALICE dataset folder
        """,
    )
    parser.add_argument(
        "files", nargs="+",
        help="Path(s) to data file(s). Supports ROOT, CSV, TSV, LHE, HepMC, Parquet, HDF5, YODA, NTuple.",
    )
    parser.add_argument(
        "--experiment", "-e", type=str, default="auto",
        choices=["auto", "cms", "atlas", "alice"],
        help="Experiment profile to use (default: auto-detect).",
    )
    parser.add_argument(
        "--chunk-size", type=int, default=50_000,
        help="Events per I/O chunk (default: 50000).",
    )
    parser.add_argument(
        "--max-events", type=int, default=5_000,
        help="Max events in output JSON (default: 5000).",
    )
    parser.add_argument(
        "--workers", type=int, default=1,
        help="Parallel processes for multi-file (default: 1).",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable DEBUG logging.",
    )
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Expand globs and directories
    expanded = []
    for pattern in args.files:
        p = os.path.expanduser(pattern)
        if os.path.isdir(p):
            for ext_pattern in SUPPORTED_EXTENSIONS:
                expanded.extend(glob.glob(os.path.join(p, f"*{ext_pattern}")))
        else:
            matched = glob.glob(p)
            if matched:
                expanded.extend(matched)
            else:
                expanded.append(p)

    valid_files = [fp for fp in expanded if os.path.isfile(fp)]
    for fp in expanded:
        if not os.path.isfile(fp):
            log.warning(f"File not found, skipping: {fp}")

    if not valid_files:
        log.error("No valid data files found. Exiting.")
        sys.exit(1)

    t_global = time.perf_counter()

    if len(valid_files) == 1:
        process_file(valid_files[0], args.chunk_size, args.max_events, args.experiment)
    else:
        process_multiple(valid_files, args.chunk_size, args.max_events, args.workers, args.experiment)

    total = time.perf_counter() - t_global
    log.info(f"Total wall-clock time: {total:.2f}s")


if __name__ == "__main__":
    main()
