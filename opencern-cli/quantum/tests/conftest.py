"""
Shared fixtures for OpenCERN Quantum service tests.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from fastapi.testclient import TestClient
    from vqc_classifier import app

    HAS_DEPS = True
except Exception:
    HAS_DEPS = False

skip_no_deps = pytest.mark.skipif(not HAS_DEPS, reason="FastAPI or quantum dependencies unavailable")


@pytest.fixture()
def client():
    if not HAS_DEPS:
        pytest.skip("FastAPI or quantum dependencies unavailable")
    with TestClient(app) as c:
        yield c
