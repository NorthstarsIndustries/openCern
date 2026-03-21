"""
Tests for the /datasets endpoint.
"""
import pytest
from unittest.mock import patch, AsyncMock

MOCK_CATALOG = {
    "datasets": [{"id": "1", "title": "CMS Run2"}],
    "total": 1,
    "page": 1,
    "pages": 1,
}


@pytest.fixture(autouse=True)
def _mock_fetch(monkeypatch):
    """Patch the catalog service so tests never hit CERN."""
    import services.catalog as cat

    async def fake_fetch(client, experiment, page, size, file_type="root"):
        if experiment not in ("CMS", "ALICE", "ATLAS"):
            return {"datasets": [], "total": 0, "page": page, "pages": 0}
        return {**MOCK_CATALOG, "page": page}

    monkeypatch.setattr(cat, "fetch_datasets", fake_fetch)


def test_datasets_default_params(client):
    resp = client.get("/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert "datasets" in data
    assert "total" in data


def test_datasets_with_experiment_filter(client):
    resp = client.get("/datasets", params={"experiment": "CMS"})
    assert resp.status_code == 200
    assert len(resp.json()["datasets"]) >= 1


def test_datasets_pagination(client):
    resp = client.get("/datasets", params={"page": 2, "size": 5})
    assert resp.status_code == 200
    assert resp.json()["page"] == 2


def test_datasets_empty_for_unknown_experiment(client):
    resp = client.get("/datasets", params={"experiment": "NONEXIST"})
    assert resp.status_code == 200
    assert resp.json()["datasets"] == []


def test_datasets_file_type_param(client):
    resp = client.get("/datasets", params={"file_type": "all"})
    assert resp.status_code == 200
