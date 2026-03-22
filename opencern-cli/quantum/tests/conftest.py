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


def pytest_collection_modifyitems(config, items):
    if HAS_DEPS:
        return
    skip = pytest.mark.skip(reason="FastAPI or quantum dependencies unavailable")
    for item in items:
        item.add_marker(skip)


@pytest.fixture()
def client():
    if not HAS_DEPS:
        pytest.skip("FastAPI or quantum dependencies unavailable")
    with TestClient(app) as c:
        yield c
