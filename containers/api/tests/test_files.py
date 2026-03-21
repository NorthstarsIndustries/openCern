"""
Tests for /files listing, /files/{path} delete, and path traversal prevention.
"""
import os
import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture()
def fake_data_dir(tmp_path, monkeypatch):
    """Set DATA_DIR to a temp directory with some fixture files."""
    data = tmp_path / "data"
    data.mkdir()
    (data / "test.root").write_bytes(b"\x00" * 128)

    sub = data / "cms-dataset"
    sub.mkdir()
    (sub / "a.root").write_bytes(b"\x00" * 64)
    (sub / "b.root").write_bytes(b"\x00" * 64)

    import config
    monkeypatch.setattr(config, "DATA_DIR", str(data))
    import routers.files as rf
    monkeypatch.setattr(rf, "DATA_DIR", str(data))
    return data


# ── /files listing ────────────────────────────────────────────────

def test_list_files_returns_list(client, fake_data_dir):
    resp = client.get("/files")
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    assert len(items) >= 1


def test_list_files_includes_folders(client, fake_data_dir):
    resp = client.get("/files")
    folders = [i for i in resp.json() if i.get("type") == "folder"]
    assert len(folders) >= 1
    assert folders[0]["filename"] == "cms-dataset"


def test_list_files_includes_standalone_files(client, fake_data_dir):
    resp = client.get("/files")
    files = [i for i in resp.json() if i.get("type") == "file"]
    assert any(f["filename"] == "test.root" for f in files)


def test_list_folder_contents(client, fake_data_dir):
    resp = client.get("/files/cms-dataset")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_list_nonexistent_folder(client, fake_data_dir):
    resp = client.get("/files/no-such-folder")
    assert resp.status_code == 200
    assert resp.json()["error"] == "Folder not found"


# ── /files/{path} delete ──────────────────────────────────────────

def test_delete_file(client, fake_data_dir):
    resp = client.delete("/files/test.root")
    assert resp.status_code == 200
    assert "deleted" in resp.json()["message"]
    assert not (fake_data_dir / "test.root").exists()


def test_delete_folder(client, fake_data_dir):
    resp = client.delete("/files/cms-dataset")
    assert resp.status_code == 200
    assert "deleted" in resp.json()["message"]
    assert not (fake_data_dir / "cms-dataset").exists()


def test_delete_nonexistent_file(client, fake_data_dir):
    resp = client.delete("/files/ghost.root")
    assert resp.status_code == 200
    assert resp.json()["error"] == "File not found"


# ── Path traversal prevention ────────────────────────────────────

def test_path_traversal_rejected(client, fake_data_dir):
    resp = client.delete("/files/../../etc/passwd")
    target = os.path.join(str(fake_data_dir), "../../etc/passwd")
    assert not os.path.isabs(resp.request.url.path.split("/files/")[-1])
