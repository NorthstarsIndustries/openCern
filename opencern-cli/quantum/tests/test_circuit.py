"""
Tests for /circuit diagram generation.
"""
import pytest


def test_circuit_default_params(client):
    resp = client.get("/circuit")
    assert resp.status_code == 200
    data = resp.json()
    assert "diagram" in data
    assert "q0:" in data["diagram"]


def test_circuit_custom_qubits(client):
    resp = client.get("/circuit", params={"qubits": 2, "layers": 3})
    assert resp.status_code == 200
    diagram = resp.json()["diagram"]
    assert "q0:" in diagram
    assert "q1:" in diagram
    assert "q2:" not in diagram


def test_circuit_single_qubit(client):
    resp = client.get("/circuit", params={"qubits": 1, "layers": 1})
    assert resp.status_code == 200
    assert "q0:" in resp.json()["diagram"]


def test_circuit_many_layers(client):
    resp = client.get("/circuit", params={"qubits": 4, "layers": 10})
    assert resp.status_code == 200
    assert "..." in resp.json()["diagram"]
