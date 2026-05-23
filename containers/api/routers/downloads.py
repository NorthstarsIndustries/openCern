"""
OpenCERN API — Downloads Router
Supports HTTP, XRootD, and selective multi-file downloads with folder organization.
"""
import os
import re
import logging
import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import List
from models import DownloadStatus
from services.downloader import download_status, cancelled_downloads, download_file_async
from config import DATA_DIR
from utils.safe_path import safe_join_or_none

log = logging.getLogger("opencern.downloads")
router = APIRouter()


def slugify(text: str) -> str:
    """Convert a title to a filesystem-safe folder name."""
    text = text.strip().lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return text[:80] or "untitled"


class MultiDownloadRequest(BaseModel):
    dataset_title: str
    files: List[str]  # List of URLs to download


# ──────────────────────────────────────────────────────────────────
# Single file download (existing)
# ──────────────────────────────────────────────────────────────────
@router.post("/download")
async def start_download(file_url: str, filename: str, background_tasks: BackgroundTasks):
    download_status[filename] = DownloadStatus(filename=filename, status="pending", progress=0.0)
    background_tasks.add_task(download_file_async, file_url, filename)
    return {"message": "Download started", "status": "pending"}


# ──────────────────────────────────────────────────────────────────
# Multi-file selective download (new)
# Downloads selected files into ~/opencern-datasets/data/{dataset-slug}/
# ──────────────────────────────────────────────────────────────────
@router.post("/download/multi")
async def start_multi_download(req: MultiDownloadRequest, background_tasks: BackgroundTasks):
    """Download selected files from a multi-file dataset into a named folder."""
    folder_name = slugify(req.dataset_title)
    folder_path = safe_join_or_none(DATA_DIR, folder_name)
    if folder_path is None:
        raise HTTPException(status_code=400, detail="Invalid dataset title")
    os.makedirs(folder_path, exist_ok=True)

    results = []
    for url in req.files:
        filename = url.split("/")[-1]
        # Use folder-prefixed key for tracking: "dataset-slug/filename.root"
        track_key = f"{folder_name}/{filename}"

        download_status[track_key] = DownloadStatus(
            filename=track_key, status="pending", progress=0.0
        )
        background_tasks.add_task(
            download_file_async, url, filename, subfolder=folder_name
        )
        results.append({"filename": filename, "track_key": track_key})

    return {
        "message": f"Downloading {len(req.files)} files into {folder_name}/",
        "folder": folder_name,
        "files": results,
    }


# ──────────────────────────────────────────────────────────────────
# XRootD proxy (existing)
# ──────────────────────────────────────────────────────────────────
@router.post("/download/xrootd")
async def start_xrootd_download(uri: str, filename: str):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "http://opencern-xrootd:8081/fetch",
                params={"uri": uri, "filename": filename},
            )
            return resp.json()
    except Exception:
        log.exception("XRootD proxy fetch failed")
        return {"error": "XRootD proxy unavailable"}


@router.get("/download/xrootd/status")
async def xrootd_download_status(filename: str):
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                "http://opencern-xrootd:8081/status",
                params={"filename": filename},
            )
            return resp.json()
    except Exception:
        log.exception("XRootD proxy status failed")
        return {"error": "XRootD proxy unavailable"}


# ──────────────────────────────────────────────────────────────────
# Cancel / Resume / Status (existing)
# ──────────────────────────────────────────────────────────────────
@router.post("/download/cancel")
async def cancel_download(filename: str):
    cancelled_downloads.add(filename)
    if filename in download_status:
        download_status[filename].status = "cancelled"
    return {"message": f"Download of {filename} cancelled"}


@router.post("/download/resume")
async def resume_download(file_url: str, filename: str, background_tasks: BackgroundTasks):
    if filename in cancelled_downloads:
        cancelled_downloads.discard(filename)
        download_status[filename] = DownloadStatus(filename=filename, status="pending", progress=0.0)
        background_tasks.add_task(download_file_async, file_url, filename)
        return {"message": f"Download of {filename} resumed"}
    return {"error": f"No cancelled download found for {filename}"}


@router.get("/download/status")
async def get_download_status(filename: str):
    status = download_status.get(filename)
    if status:
        return status
    return {"error": "File not found in download status"}
