"""
Tests for /process, /process/status, /process/batch, and /process/folder.
"""
import os
import json
import pytest
from unittest.mock import patch, MagicMock
from conftest import skip_no_deps

pytestmark = skip_no_deps


@pytest.fixture()
def fake_dirs(tmp_path, monkeypatch):
    """Redirect DATA_DIR and PROCESSED_DIR to temp paths with fixture files."""
    data = tmp_path / "data"
    data.mkdir()
    processed = tmp_path / "processed"
    processed.mkdir()

    (data / "sample.root").write_bytes(b"\x00" * 64)

    folder = data / "atlas-set"
    folder.mkdir()
    (folder / "run1.root").write_bytes(b"\x00" * 64)
    (folder / "run2.root").write_bytes(b"\x00" * 64)

    import config
    monkeypatch.setattr(config, "DATA_DIR", str(data))
    monkeypatch.setattr(config, "PROCESSED_DIR", str(processed))
    import routers.processing as rp
    monkeypatch.setattr(rp, "DATA_DIR", str(data))
    monkeypatch.setattr(rp, "PROCESSED_DIR", str(processed))

    return {"data": data, "processed": processed}


# ── /process ──────────────────────────────────────────────────────

@patch("routers.processing.run_processor", new_callable=MagicMock)
def test_process_start(mock_proc, client, fake_dirs):
    resp = client.post("/process", params={"filename": "sample.root"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"


@patch("routers.processing.run_processor", new_callable=MagicMock)
def test_process_missing_file(mock_proc, client, fake_dirs):
    resp = client.post("/process", params={"filename": "nope.root"})
    assert resp.status_code == 200
    assert "error" in resp.json()


@patch("routers.processing.run_processor", new_callable=MagicMock)
def test_process_with_experiment_override(mock_proc, client, fake_dirs):
    resp = client.post("/process", params={"filename": "sample.root", "experiment": "cms"})
    assert resp.status_code == 200
    assert resp.json()["experiment"] == "cms"


# ── /process/status ───────────────────────────────────────────────

def test_process_status_idle(client, fake_dirs):
    resp = client.get("/process/status", params={"filename": "unknown.root"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "idle"


def test_process_status_processed_when_output_exists(client, fake_dirs):
    out = fake_dirs["processed"] / "sample.json"
    out.write_text(json.dumps({"events": []}))
    resp = client.get("/process/status", params={"filename": "sample.root"})
    assert resp.json()["status"] == "processed"


# ── /process/batch ────────────────────────────────────────────────

@patch("routers.processing.run_processor", new_callable=MagicMock)
def test_process_batch(mock_proc, client, fake_dirs):
    payload = {"files": ["sample.root"], "experiment": "auto"}
    resp = client.post("/process/batch", json=payload)
    assert resp.status_code == 200
    assert len(resp.json()["files"]) == 1


@patch("routers.processing.run_processor", new_callable=MagicMock)
def test_process_batch_missing_file(mock_proc, client, fake_dirs):
    payload = {"files": ["missing.root"], "experiment": "auto"}
    resp = client.post("/process/batch", json=payload)
    data = resp.json()
    assert any("error" in f for f in data["files"])


# ── /process/folder ───────────────────────────────────────────────

@patch("routers.processing.run_folder_processor", new_callable=MagicMock)
def test_process_folder(mock_fp, client, fake_dirs):
    resp = client.post("/process/folder", params={"folder": "atlas-set"})
    assert resp.status_code == 200
    assert resp.json()["total_files"] == 2


@patch("routers.processing.run_folder_processor", new_callable=MagicMock)
def test_process_folder_nonexistent(mock_fp, client, fake_dirs):
    resp = client.post("/process/folder", params={"folder": "nope"})
    assert resp.status_code == 200
    assert "error" in resp.json()
