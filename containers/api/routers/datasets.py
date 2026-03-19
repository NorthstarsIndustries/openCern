"""
OpenCERN API — Datasets Router
Supports pagination and all experiments: CMS, ALICE, ATLAS
Pulls the COMPLETE catalog from CERN OpenData for each experiment.
"""
from fastapi import APIRouter
import httpx
from services.catalog import fetch_datasets

router = APIRouter()


@router.get("/datasets")
async def get_datasets(experiment: str = "ALICE", page: int = 1, size: int = 20, file_type: str = "root"):
    """
    Fetch the full dataset catalog for an experiment with pagination.

    Args:
        file_type: "root" (default) returns only .root files. "all" returns all file types.

    Returns: { datasets: [...], total: N, page: P, pages: T }
    """
    async with httpx.AsyncClient(verify=False, follow_redirects=True, timeout=30) as client:
        return await fetch_datasets(client, experiment, page, size, file_type=file_type)
