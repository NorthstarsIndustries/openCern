"""
OpenCERN API — Files Router
Lists files with nested folder support for multi-file datasets.
"""
import os
import logging
import shutil
import subprocess
from fastapi import APIRouter, HTTPException
from config import DATA_DIR
from utils.safe_path import safe_join_or_none

log = logging.getLogger("opencern.files")
router = APIRouter()


@router.get("/files")
async def list_files():
    """
    List all files and folders in DATA_DIR.
    Returns a flat list where folders are represented as groups with children.
    """
    items = []
    if not os.path.exists(DATA_DIR):
        return items

    for entry in sorted(os.listdir(DATA_DIR)):
        if entry.startswith("."):
            continue
        full_path = os.path.join(DATA_DIR, entry)

        if os.path.isdir(full_path):
            # Dataset folder — list its children
            children = []
            folder_size = 0
            for child in sorted(os.listdir(full_path)):
                if child.startswith("."):
                    continue
                child_path = os.path.join(full_path, child)
                if os.path.isfile(child_path):
                    child_size = os.path.getsize(child_path)
                    folder_size += child_size
                    children.append({
                        "filename": f"{entry}/{child}",
                        "basename": child,
                        "size": child_size,
                        "folder": entry,
                    })
            items.append({
                "filename": entry,
                "type": "folder",
                "size": folder_size,
                "children": children,
                "file_count": len(children),
            })
        elif os.path.isfile(full_path):
            items.append({
                "filename": entry,
                "type": "file",
                "size": os.path.getsize(full_path),
            })

    return items


@router.get("/files/{folder:path}")
async def list_folder_files(folder: str):
    """List files inside a specific dataset folder."""
    folder_path = safe_join_or_none(DATA_DIR, folder)
    if folder_path is None or not os.path.isdir(folder_path):
        raise HTTPException(status_code=404, detail="Folder not found")

    files = []
    for entry in sorted(os.listdir(folder_path)):
        if entry.startswith("."):
            continue
        fp = safe_join_or_none(folder_path, entry)
        if fp is None or not os.path.isfile(fp):
            continue
        files.append({
            "filename": f"{folder}/{entry}",
            "basename": entry,
            "size": os.path.getsize(fp),
            "folder": folder,
        })
    return files


@router.delete("/files/{filepath:path}")
async def delete_file(filepath: str):
    """Delete a file or entire dataset folder."""
    full_path = safe_join_or_none(DATA_DIR, filepath)
    if full_path is None:
        raise HTTPException(status_code=400, detail="Invalid path")
    if os.path.isdir(full_path):
        shutil.rmtree(full_path)
        return {"message": f"Folder {filepath} deleted"}
    elif os.path.isfile(full_path):
        os.remove(full_path)
        return {"message": f"{filepath} deleted"}
    raise HTTPException(status_code=404, detail="File not found")


@router.get("/files/{filename}/reveal")
async def reveal_file(filename: str):
    file_path = safe_join_or_none(DATA_DIR, filename)
    if file_path is None or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    subprocess.run(["open", "-R", file_path], check=False)
    return {"message": f"{filename} revealed"}
