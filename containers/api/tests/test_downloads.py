"""
Tests for /download, /download/status, /download/cancel, and /download/multi.
"""
import pytest
from unittest.mock import patch, MagicMock
from conftest import skip_no_deps

pytestmark = skip_no_deps


@pytest.fixture(autouse=True)
def _isolate_download_state():
    """Reset shared download state between tests."""
    from services.downloader import download_status, cancelled_downloads

    download_status.clear()
    cancelled_downloads.clear()
    yield
    download_status.clear()
    cancelled_downloads.clear()


# ── /download ─────────────────────────────────────────────────────

@patch("routers.downloads.download_file_async", new_callable=MagicMock)
def test_start_download(mock_dl, client):
    resp = client.post("/download", params={"file_url": "https://example.com/f.root", "filename": "f.root"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


@patch("routers.downloads.download_file_async", new_callable=MagicMock)
def test_start_download_creates_status_entry(mock_dl, client):
    client.post("/download", params={"file_url": "https://example.com/a.root", "filename": "a.root"})
    resp = client.get("/download/status", params={"filename": "a.root"})
    assert resp.status_code == 200
    assert resp.json()["filename"] == "a.root"


# ── /download/status ──────────────────────────────────────────────

def test_download_status_missing_file(client):
    resp = client.get("/download/status", params={"filename": "nonexist.root"})
    assert resp.status_code == 200
    assert "error" in resp.json()


# ── /download/cancel ──────────────────────────────────────────────

@patch("routers.downloads.download_file_async", new_callable=MagicMock)
def test_cancel_download(mock_dl, client):
    client.post("/download", params={"file_url": "https://example.com/c.root", "filename": "c.root"})
    resp = client.post("/download/cancel", params={"filename": "c.root"})
    assert resp.status_code == 200
    assert "cancelled" in resp.json()["message"]


@patch("routers.downloads.download_file_async", new_callable=MagicMock)
def test_cancel_sets_status_cancelled(mock_dl, client):
    client.post("/download", params={"file_url": "https://example.com/d.root", "filename": "d.root"})
    client.post("/download/cancel", params={"filename": "d.root"})
    resp = client.get("/download/status", params={"filename": "d.root"})
    assert resp.json()["status"] == "cancelled"


# ── /download/multi ───────────────────────────────────────────────

@patch("routers.downloads.download_file_async", new_callable=MagicMock)
def test_multi_download(mock_dl, client):
    payload = {
        "dataset_title": "CMS Open Data 2012",
        "files": [
            "https://example.com/a.root",
            "https://example.com/b.root",
        ],
    }
    resp = client.post("/download/multi", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "folder" in data
    assert len(data["files"]) == 2


@patch("routers.downloads.download_file_async", new_callable=MagicMock)
def test_multi_download_empty_files(mock_dl, client):
    payload = {"dataset_title": "Empty Set", "files": []}
    resp = client.post("/download/multi", json=payload)
    assert resp.status_code == 200
    assert resp.json()["files"] == []
