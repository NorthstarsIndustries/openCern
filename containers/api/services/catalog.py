"""
OpenCERN API — Dataset Catalog Service
=======================================
Enterprise-grade: direct CERN API proxy with per-page TTL caching.

Strategy:
  - Each user page request = ONE call to CERN OpenData API (~1s)
  - Responses cached for 5 min → subsequent loads are instant (0ms)
  - No pre-fetching, no waiting, no 500-request waterfall
  - CMS featured datasets are prepended to page 1
"""
import time
import math
import logging
import httpx
from typing import List
from models import Dataset

log = logging.getLogger("opencern.catalog")

# ──────────────────────────────────────────────────────────────────
# Featured CMS datasets (direct HTTP links, instant access)
# ──────────────────────────────────────────────────────────────────
CMS_FEATURED = [
    {"id": "cms-001", "title": "★ Run2012B TauPlusX — Higgs to Tau Tau", "description": "Real CMS collision data from Run2012B. Direct HTTP download.", "files": ["https://root.cern/files/HiggsTauTauReduced/Run2012B_TauPlusX.root"], "size": "1088113510", "year": 2012},
    {"id": "cms-002", "title": "★ Run2012C TauPlusX — Higgs to Tau Tau", "description": "Real CMS collision data from Run2012C. Direct HTTP download.", "files": ["https://root.cern/files/HiggsTauTauReduced/Run2012C_TauPlusX.root"], "size": "1549014154", "year": 2012},
    {"id": "cms-003", "title": "★ GluGluToHToTauTau — Higgs Signal MC", "description": "Simulated Higgs boson production via gluon fusion. Direct HTTP download.", "files": ["https://root.cern/files/HiggsTauTauReduced/GluGluToHToTauTau.root"], "size": "20460281", "year": 2012},
    {"id": "cms-004", "title": "★ VBF HToTauTau — Vector Boson Fusion MC", "description": "Simulated Higgs boson via vector boson fusion. Direct HTTP download.", "files": ["https://root.cern/files/HiggsTauTauReduced/VBF_HToTauTau.root"], "size": "24184554", "year": 2012},
    {"id": "cms-005", "title": "★ DYJetsToLL — Drell-Yan Background", "description": "Simulated Drell-Yan process. Direct HTTP download.", "files": ["https://root.cern/files/HiggsTauTauReduced/DYJetsToLL.root"], "size": "925979447", "year": 2012},
    {"id": "cms-006", "title": "★ TTbar — Top Quark Pair Production", "description": "Simulated top quark pair production. Direct HTTP download.", "files": ["https://root.cern/files/HiggsTauTauReduced/TTbar.root"], "size": "353710208", "year": 2012},
]

# ──────────────────────────────────────────────────────────────────
# TTL Cache  (key → (timestamp, data))
# ──────────────────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 300  # 5 minutes


def _get(key: str):
    if key in _cache:
        ts, val = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return val
    return None


def _put(key: str, val):
    _cache[key] = (time.time(), val)


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────
def _xrd_to_http(uri: str) -> str:
    if uri.startswith("root://eospublic.cern.ch//"):
        return uri.replace("root://eospublic.cern.ch//", "https://eospublic.cern.ch/")
    return uri


def _parse_records(records: list, file_type: str = "root") -> List[Dataset]:
    """Parse raw CERN API records into Dataset models.
    
    Args:
        file_type: Filter files by extension. "root" (default) for .root only,
                   "all" for all file types.
    """
    out = []
    for r in records:
        m = r.get("metadata", {})
        raw_files = m.get("files", [])
        files = [_xrd_to_http(f["uri"]) for f in raw_files if f.get("uri")]

        # Filter by file type if specified
        if file_type == "root":
            files = [f for f in files if f.lower().endswith(".root")]

        if not files:
            # Skip datasets with no matching files
            if file_type != "all":
                continue
            recid = str(r.get("id", ""))
            files = [f"https://opendata.cern.ch/record/{recid}"]

        # Size: try files[].size first, then distribution.size fallback
        total_size = sum(f.get("size", 0) for f in raw_files)
        if total_size == 0:
            dist = m.get("distribution", {})
            total_size = dist.get("size", 0)

        out.append(Dataset(
            id=str(r.get("id", "")),
            title=m.get("title", "Untitled"),
            description=m.get("abstract", {}).get("description", ""),
            files=files,
            size=str(total_size),
            year=int(m.get("date_created", ["0"])[0]) if m.get("date_created") else 0,
        ))
    return out


# ──────────────────────────────────────────────────────────────────
# Core: fetch ONE page directly from CERN API (instant)
# ──────────────────────────────────────────────────────────────────
async def _fetch_page(client: httpx.AsyncClient, experiment: str, page: int, size: int, file_type: str = "root") -> dict:
    """
    Single API call to CERN OpenData → returns one page of results.
    Cached per (experiment, page, size) for 5 minutes.
    """
    cache_key = f"{experiment}_p{page}_s{size}_ft{file_type}"
    cached = _get(cache_key)
    if cached is not None:
        return cached

    url = (
        f"https://opendata.cern.ch/api/records/"
        f"?type=Dataset&format=json&experiment={experiment}"
        f"&page={page}&size={size}"
    )

    t0 = time.perf_counter()
    resp = await client.get(url, timeout=20)
    data = resp.json()
    elapsed = (time.perf_counter() - t0) * 1000

    hits = data.get("hits", {})
    total = hits.get("total", 0)
    records = hits.get("hits", [])
    datasets = _parse_records(records, file_type=file_type)

    result = {
        "datasets": datasets,
        "total": total,
        "page": page,
        "pages": max(1, math.ceil(total / size)),
    }

    _put(cache_key, result)
    log.info(f"{experiment} page {page} → {len(datasets)} datasets ({elapsed:.0f}ms)")
    return result


# ──────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────
async def fetch_datasets(client: httpx.AsyncClient, experiment: str, page: int = 1, size: int = 20, file_type: str = "root") -> dict:
    """
    Fetch datasets for any experiment with instant pagination.
    Each page = 1 CERN API call (~1s first time, 0ms cached).
    
    Args:
        file_type: "root" (default) filters to .root files only. "all" returns all files.
    """
    exp_map = {"Alice": "ALICE", "Atlas": "ATLAS"}
    exp = exp_map.get(experiment, experiment)

    if exp == "CMS" and page == 1:
        # Page 1 of CMS: show featured datasets first, then fill with CERN API
        featured = [Dataset(**d) for d in CMS_FEATURED]
        remaining = size - len(featured)
        if remaining > 0:
            cern = await _fetch_page(client, "CMS", 1, remaining, file_type=file_type)
            result_datasets = featured + cern["datasets"]
            total = cern["total"] + len(featured)
        else:
            cern = await _fetch_page(client, "CMS", 1, 1, file_type=file_type)  # just for total count
            result_datasets = featured[:size]
            total = cern["total"] + len(featured)
        return {
            "datasets": result_datasets,
            "total": total,
            "page": 1,
            "pages": max(1, math.ceil(total / size)),
        }

    elif exp == "CMS" and page > 1:
        # Page 2+ of CMS: offset by featured count, pull from CERN API
        featured_count = len(CMS_FEATURED)
        # Calculate the corresponding CERN API page
        cern_offset = (page - 1) * size - featured_count
        cern_page = max(1, math.ceil(cern_offset / size) + 1)
        result = await _fetch_page(client, "CMS", cern_page, size, file_type=file_type)
        result["total"] = result["total"] + featured_count
        result["page"] = page
        result["pages"] = max(1, math.ceil(result["total"] / size))
        return result

    elif exp == "all":
        # Fetch page 1 of each experiment in parallel
        import asyncio
        cms_t = fetch_datasets(client, "CMS", page, size, file_type=file_type)
        alice_t = _fetch_page(client, "ALICE", page, size, file_type=file_type)
        atlas_t = _fetch_page(client, "ATLAS", page, size, file_type=file_type)
        cms, alice, atlas = await asyncio.gather(cms_t, alice_t, atlas_t)

        merged = cms["datasets"] + alice["datasets"] + atlas["datasets"]
        total = cms["total"] + alice["total"] + atlas["total"]
        return {
            "datasets": merged[:size],
            "total": total,
            "page": page,
            "pages": max(1, math.ceil(total / size)),
        }

    else:
        # ALICE, ATLAS, or any other experiment — direct proxy
        return await _fetch_page(client, exp, page, size, file_type=file_type)
