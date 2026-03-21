"""
Tests for XRootD proxy /fetch and /status endpoints.
"""
import pytest
from unittest.mock import patch, MagicMock
from conftest import skip_no_deps

pytestmark = skip_no_deps


@pytest.fixture(autouse=True)
def _reset_state():
    """Clear global download state between tests."""
    import main

    main.download_state.clear()
    main.cancelled.clear()
    yield
    main.download_state.clear()
    main.cancelled.clear()


# ── /fetch ────────────────────────────────────────────────────────

@patch("main.xrootd_download_task", new_callable=MagicMock)
def test_fetch_valid_uri(mock_task, client):
    resp = client.post("/fetch", params={
        "uri": "root://eospublic.cern.ch//eos/opendata/cms/file.root",
        "filename": "file.root",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


def test_fetch_invalid_protocol(client):
    resp = client.post("/fetch", params={
        "uri": "https://example.com/file.root",
        "filename": "file.root",
    })
    assert resp.status_code == 200
    assert "error" in resp.json()


def test_fetch_missing_uri(client):
    resp = client.post("/fetch", params={"filename": "file.root"})
    assert resp.status_code == 422


def test_fetch_missing_filename(client):
    resp = client.post("/fetch", params={"uri": "root://eos/file.root"})
    assert resp.status_code == 422


# ── /status ───────────────────────────────────────────────────────

def test_status_unknown_file(client):
    resp = client.get("/status", params={"filename": "ghost.root"})
    assert resp.status_code == 200
    assert "error" in resp.json()


@patch("main.xrootd_download_task", new_callable=MagicMock)
def test_status_after_fetch(mock_task, client):
    client.post("/fetch", params={
        "uri": "root://eos/data.root",
        "filename": "data.root",
    })
    resp = client.get("/status", params={"filename": "data.root"})
    assert resp.status_code == 200
    assert resp.json()["filename"] == "data.root"


# ── /cancel ───────────────────────────────────────────────────────

@patch("main.xrootd_download_task", new_callable=MagicMock)
def test_cancel_download(mock_task, client):
    client.post("/fetch", params={
        "uri": "root://eos/big.root",
        "filename": "big.root",
    })
    resp = client.post("/cancel", params={"filename": "big.root"})
    assert resp.status_code == 200
    assert "Cancellation" in resp.json()["message"]


# ── /health ───────────────────────────────────────────────────────

def test_xrootd_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["service"] == "xrootd-proxy"
