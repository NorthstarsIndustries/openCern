"""
Tests for /classify endpoint in the quantum VQC service.
"""
import pytest
from conftest import skip_no_deps

pytestmark = skip_no_deps

SAMPLE_EVENTS = [
    {"pt": 120.5, "eta": -0.8, "phi": 1.2, "energy": 250.0},
    {"pt": 45.0, "eta": 2.1, "phi": -0.5, "energy": 80.0},
]


def test_classify_returns_job_id(client):
    resp = client.post("/classify", json={"events": SAMPLE_EVENTS})
    assert resp.status_code == 200
    assert "jobId" in resp.json()


def test_classify_empty_events_rejected(client):
    resp = client.post("/classify", json={"events": []})
    assert resp.status_code == 400
    assert "No events" in resp.json()["detail"]


def test_classify_malformed_input(client):
    resp = client.post("/classify", json={"events": "not-a-list"})
    assert resp.status_code == 422


def test_classify_missing_body(client):
    resp = client.post("/classify")
    assert resp.status_code == 422


def test_classify_with_backend_param(client):
    payload = {"events": SAMPLE_EVENTS, "backend": "local", "shots": 500}
    resp = client.post("/classify", json=payload)
    assert resp.status_code == 200


def test_results_unknown_job(client):
    resp = client.get("/results/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_results_after_classify(client):
    resp = client.post("/classify", json={"events": SAMPLE_EVENTS})
    job_id = resp.json()["jobId"]
    resp2 = client.get(f"/results/{job_id}")
    assert resp2.status_code == 200
    assert resp2.json()["id"] == job_id
