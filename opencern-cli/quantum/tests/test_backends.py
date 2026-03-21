"""
Tests for /backends listing and /backend switching.
"""
import pytest
from conftest import skip_no_deps

pytestmark = skip_no_deps


def test_list_backends(client):
    resp = client.get("/backends")
    assert resp.status_code == 200
    backends = resp.json()
    assert isinstance(backends, list)
    assert len(backends) >= 1
    names = [b["name"] for b in backends]
    assert "local" in names


def test_backends_contain_required_fields(client):
    resp = client.get("/backends")
    for b in resp.json():
        assert "name" in b
        assert "type" in b
        assert "available" in b


def test_local_backend_always_available(client):
    resp = client.get("/backends")
    local = next(b for b in resp.json() if b["name"] == "local")
    assert local["available"] is True


def test_switch_backend_to_local(client):
    resp = client.post("/backend", json={"backend": "local"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["backend"] == "local"


def test_switch_backend_to_ibm(client):
    resp = client.post("/backend", json={"backend": "ibm", "apiKey": "test-key"})
    assert resp.status_code == 200
    assert resp.json()["backend"] == "ibm"
