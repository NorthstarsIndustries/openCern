"""
Tests for the /health endpoint.
"""
import pytest


def test_health_returns_200(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_health_body_contains_status_ok(client):
    resp = client.get("/health")
    data = resp.json()
    assert data["status"] == "ok"


def test_health_response_has_timing_header(client):
    resp = client.get("/health")
    assert "x-response-time-ms" in resp.headers
