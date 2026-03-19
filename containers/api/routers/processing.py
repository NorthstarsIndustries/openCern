"""
OpenCERN API — Processing Router
Supports experiment-aware processing with selective file processing,
folder-level batch processing, and multi-file JSON merging.
"""
import os
import json
import logging
import subprocess
import glob
from fastapi import APIRouter, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Optional
from config import DATA_DIR, PROCESSED_DIR

log = logging.getLogger("opencern.processing")
router = APIRouter()

process_status: dict[str, str] = {}


class ProcessRequest(BaseModel):
    files: List[str]  # file paths relative to DATA_DIR
    experiment: str = "auto"  # auto, cms, atlas, alice


def run_processor(filepath: str, track_key: str, experiment: str = "auto"):
    """Run the C++ data processor binary directly (embedded in API container)."""
    full_path = os.path.join(DATA_DIR, filepath)
    log.info(f"Running C++ processor for {track_key} (experiment={experiment})")

    cmd = [
        "opencern-processor",
        full_path,
        "--experiment", experiment,
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600
        )

        # Log processor output
        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                log.info(f"  [C++] {line}")
        if result.stderr:
            for line in result.stderr.strip().split('\n'):
                log.info(f"  [C++] {line}")

        if result.returncode == 0:
            process_status[track_key] = "processed"
            log.info(f"Processing complete: {track_key}")
        else:
            process_status[track_key] = "error"
            log.error(f"Processing failed: {track_key} (exit code {result.returncode})")
            if result.stderr:
                log.error(f"  stderr: {result.stderr[:500]}")
    except subprocess.TimeoutExpired:
        process_status[track_key] = "error"
        log.error(f"Processing timed out: {track_key} (>600s)")
    except Exception as e:
        process_status[track_key] = "error"
        log.error(f"Processing exception: {track_key} — {e}")


def run_folder_processor(folder_name: str, experiment: str = "auto"):
    """
    Process all ROOT files in a dataset folder.
    Each file is processed individually, then results are merged into
    a single {folder_name}.json with combined events sorted by HT.
    """
    folder_path = os.path.join(DATA_DIR, folder_name)
    root_files = sorted(glob.glob(os.path.join(folder_path, "*.root")))

    if not root_files:
        process_status[folder_name] = "error"
        log.error(f"No ROOT files found in {folder_path}")
        return

    total_files = len(root_files)
    log.info(f"Folder processing: {folder_name} — {total_files} ROOT file(s)")
    process_status[folder_name] = f"processing 0/{total_files}"

    all_events = []
    all_metadata = []
    errors = []

    for idx, root_file in enumerate(root_files):
        basename = os.path.basename(root_file)
        process_status[folder_name] = f"processing {idx + 1}/{total_files}: {basename}"
        log.info(f"  [{idx + 1}/{total_files}] Processing {basename}...")

        # Run C++ processor on this file
        cmd = [
            "opencern-processor",
            root_file,
            "--experiment", experiment,
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=600
            )

            if result.stderr:
                for line in result.stderr.strip().split('\n'):
                    log.info(f"    [C++] {line}")

            if result.returncode == 0:
                # Read the individual output JSON
                stem = os.path.splitext(basename)[0]
                output_json = os.path.join(PROCESSED_DIR, f"{stem}.json")

                if os.path.exists(output_json):
                    with open(output_json, "r") as f:
                        data = json.load(f)

                    all_events.extend(data.get("events", []))
                    all_metadata.append(data.get("metadata", {}))
                    log.info(f"    ✓ {stem}: {len(data.get('events', []))} events")

                    # Remove individual output (we'll create merged)
                    os.remove(output_json)
                else:
                    errors.append(f"{basename}: no output JSON")
            else:
                errors.append(f"{basename}: exit code {result.returncode}")
                log.error(f"    ✗ {basename}: exit code {result.returncode}")

        except subprocess.TimeoutExpired:
            errors.append(f"{basename}: timeout")
            log.error(f"    ✗ {basename}: timed out")
        except Exception as e:
            errors.append(f"{basename}: {str(e)}")
            log.error(f"    ✗ {basename}: {e}")

    if not all_events:
        process_status[folder_name] = "error"
        log.error(f"Folder processing failed: no events extracted from {folder_name}")
        return

    # ── Merge results ──
    process_status[folder_name] = "merging"
    log.info(f"Merging {len(all_events)} events from {len(all_metadata)} file(s)...")

    # Sort by HT descending
    all_events.sort(key=lambda e: e.get("ht", 0), reverse=True)

    # Cap at 5000 events
    max_events = 5000
    if len(all_events) > max_events:
        all_events = all_events[:max_events]

    # Combine metadata
    total_scanned = sum(m.get("total_scanned", 0) for m in all_metadata)
    all_ptypes = set()
    for m in all_metadata:
        all_ptypes.update(m.get("particle_types", []))

    total_particles = sum(len(e.get("particles", [])) for e in all_events)

    merged_metadata = {
        "source_files": [m.get("source_file", "") for m in all_metadata],
        "experiment": all_metadata[0].get("experiment", "AUTO") if all_metadata else "AUTO",
        "total_files": total_files,
        "total_scanned": total_scanned,
        "filtered_events": len(all_events),
        "processor": "C++ (native ROOT) — merged",
        "particle_types": sorted(all_ptypes),
        "avg_particles_per_event": round(total_particles / max(len(all_events), 1), 2),
        "errors": errors if errors else None,
    }

    merged_output = {
        "metadata": merged_metadata,
        "events": all_events,
    }

    # Write merged output
    merged_path = os.path.join(PROCESSED_DIR, f"{folder_name}.json")
    with open(merged_path, "w") as f:
        json.dump(merged_output, f, separators=(",", ":"))

    size_mb = os.path.getsize(merged_path) / (1024 * 1024)
    process_status[folder_name] = "processed"
    log.info(f"Folder processing complete: {folder_name}")
    log.info(f"  Files: {total_files} ({len(errors)} errors)")
    log.info(f"  Events: {len(all_events)} (merged)")
    log.info(f"  Output: {merged_path} ({size_mb:.1f} MB)")


@router.post("/process")
async def process_file(filename: str, background_tasks: BackgroundTasks,
                       experiment: str = "auto"):
    """Process a single file with optional experiment override."""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        # Try to find the file by basename in any subfolder
        basename = os.path.basename(filename)
        for root, dirs, files in os.walk(DATA_DIR):
            if basename in files:
                filepath = os.path.join(root, basename)
                filename = os.path.relpath(filepath, DATA_DIR)
                break
        else:
            return {"error": f"File not found: {filename}"}

    process_status[filename] = "processing"
    background_tasks.add_task(run_processor, filename, filename, experiment)
    return {"message": "Processing started", "status": "processing", "id": filename, "experiment": experiment}


@router.post("/process/batch")
async def process_batch(req: ProcessRequest, background_tasks: BackgroundTasks):
    """Process multiple selected files with experiment auto-detection or override."""
    results = []
    for rel_path in req.files:
        full_path = os.path.join(DATA_DIR, rel_path)
        if not os.path.exists(full_path):
            results.append({"file": rel_path, "error": "File not found"})
            continue

        process_status[rel_path] = "processing"
        background_tasks.add_task(run_processor, rel_path, rel_path, req.experiment)
        results.append({"file": rel_path, "status": "processing"})

    return {
        "message": f"Processing {len(results)} files",
        "experiment": req.experiment,
        "files": results,
    }


@router.post("/process/folder")
async def process_folder(folder: str, background_tasks: BackgroundTasks,
                         experiment: str = "auto"):
    """
    Process all ROOT files in a dataset folder and merge into single output.
    This is the enterprise-level handler for ATLAS zip archives and
    other multi-file datasets.
    """
    folder_path = os.path.join(DATA_DIR, folder)
    if not os.path.isdir(folder_path):
        return {"error": f"Folder not found: {folder}"}

    root_files = glob.glob(os.path.join(folder_path, "*.root"))
    if not root_files:
        return {"error": f"No ROOT files in {folder}"}

    process_status[folder] = f"processing 0/{len(root_files)}"
    background_tasks.add_task(run_folder_processor, folder, experiment)

    return {
        "message": f"Processing {len(root_files)} ROOT files in {folder}/",
        "status": "processing",
        "total_files": len(root_files),
        "experiment": experiment,
    }


@router.get("/process/status")
async def get_process_status(filename: str):
    stem = os.path.splitext(filename)[0]
    # Check both the original filename and the stem
    output_file = os.path.join(PROCESSED_DIR, f"{stem}.json")
    if os.path.exists(output_file):
        return {"status": "processed"}
    # Check for folder/filename pattern
    basename = os.path.basename(stem)
    alt_output = os.path.join(PROCESSED_DIR, f"{basename}.json")
    if os.path.exists(alt_output):
        return {"status": "processed"}
    status = process_status.get(filename, "idle")
    return {"status": status}


@router.put("/process/data/{filename}")
async def save_processed_data(filename: str, request: Request):
    data = await request.json()
    stem = os.path.splitext(filename)[0]
    output_file = os.path.join(PROCESSED_DIR, f"{stem}.json")
    with open(output_file, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    return {"status": "saved"}


@router.delete("/process/data/{filename}")
async def delete_processed_data(filename: str):
    stem = os.path.splitext(filename)[0]
    output_file = os.path.join(PROCESSED_DIR, f"{stem}.json")
    if os.path.exists(output_file):
        os.remove(output_file)
        return {"message": f"{stem}.json deleted"}
    return {"error": "File not found"}

