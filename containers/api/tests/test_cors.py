"""
Tests for CORS middleware headers.
"""
import pytest


def test_cors_allows_any_origin(client):
    resp = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert resp.headers.get("access-control-allow-origin") == "*"


def test_cors_present_on_datasets(client):
    resp = client.get("/health", headers={"Origin": "https://app.opencern.dev"})
    assert "access-control-allow-origin" in resp.headers


def test_preflight_options(client):
    resp = client.options(
        "/download",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "*"
    assert "POST" in resp.headers.get("access-control-allow-methods", "")
