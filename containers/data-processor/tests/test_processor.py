"""
Test #9: Data processor container tests
Validates the multi-format parser helpers and output schema.
"""
import os
import sys
import json
import tempfile

# Add parent dir to path for import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import main as processor


class TestSupportedExtensions:
    def test_root_is_supported(self):
        assert processor.SUPPORTED_EXTENSIONS[".root"] == "root"

    def test_csv_is_supported(self):
        assert processor.SUPPORTED_EXTENSIONS[".csv"] == "csv"

    def test_lhe_gz_is_supported(self):
        assert processor.SUPPORTED_EXTENSIONS[".lhe.gz"] == "lhe"

    def test_all_formats_present(self):
        expected = {"root", "csv", "tsv", "lhe", "hepmc", "parquet", "hdf5", "yoda", "ntuple"}
        actual = set(processor.SUPPORTED_EXTENSIONS.values())
        assert expected == actual


class TestPDGMap:
    def test_muon(self):
        assert processor.PDG_MAP[13] == "muon"
        assert processor.PDG_MAP[-13] == "muon"

    def test_electron(self):
        assert processor.PDG_MAP[11] == "electron"

    def test_photon(self):
        assert processor.PDG_MAP[22] == "photon"

    def test_jet_from_quark(self):
        assert processor.PDG_MAP[1] == "jet"
        assert processor.PDG_MAP[21] == "jet"


class TestMakeParticle:
    def test_basic_particle(self):
        p = processor.make_particle("muon", 45.0, -1.2, 0.8, mass=0.105)
        assert p["type"] == "muon"
        assert p["color"] == "#ff6b6b"
        assert p["pt"] == 45.0
        assert p["eta"] == -1.2
        assert p["phi"] == 0.8
        assert p["mass"] == 0.105
        assert "px" in p
        assert "py" in p
        assert "pz" in p
        assert "energy" in p

    def test_with_charge_and_pdg(self):
        p = processor.make_particle("electron", 30.0, 0.5, 1.0, charge=-1, pdg_id=11)
        assert p["charge"] == -1
        assert p["pdg_id"] == 11

    def test_without_optional_fields(self):
        p = processor.make_particle("jet", 50.0, 0.0, 0.0)
        assert "charge" not in p
        assert "pdg_id" not in p


class TestWriteOutput:
    def test_writes_valid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = os.path.join(tmpdir, "test.csv")
            open(filepath, "w").close()
            # Monkey-patch output dir
            old_expand = os.path.expanduser
            os.path.expanduser = lambda p: p.replace("~", tmpdir)
            try:
                events = [{"event_id": 1, "experiment": "GENERIC", "particles": []}]
                out = processor.write_output(filepath, "csv", "generic", events, 100, 1.5)
                assert out.endswith(".json")
                with open(out) as f:
                    data = json.load(f)
                assert "metadata" in data
                assert "events" in data
                assert data["metadata"]["format"] == "csv"
                assert data["metadata"]["experiment"] == "GENERIC"
                assert data["metadata"]["events"] == 1
            finally:
                os.path.expanduser = old_expand


class TestCartesianToCylindrical:
    def test_basic_conversion(self):
        import numpy as np
        pt, eta, phi = processor._cartesian_to_cylindrical(
            np.array([10.0]), np.array([0.0]), np.array([0.0])
        )
        assert abs(float(pt[0]) - 10.0) < 0.01
        assert abs(float(phi[0])) < 0.01


class TestProcessNtupleFile:
    def test_four_column_ntuple(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            ntuple = os.path.join(tmpdir, "test.dat")
            with open(ntuple, "w") as f:
                f.write("# pt eta phi mass\n")
                f.write("45.2 -1.2 0.8 0.105\n")
                f.write("30.0 0.5 1.0 0.0005\n")

            old_expand = os.path.expanduser
            os.path.expanduser = lambda p: p.replace("~", tmpdir)
            try:
                out = processor.process_ntuple_file(ntuple, max_events=10, experiment="generic")
                with open(out) as f:
                    data = json.load(f)
                assert data["metadata"]["format"] == "ntuple"
                assert len(data["events"]) == 2
                assert data["events"][0]["particles"][0]["pt"] == 45.2
            finally:
                os.path.expanduser = old_expand


class TestProcessCsvFile:
    def test_csv_with_header(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_file = os.path.join(tmpdir, "test.csv")
            with open(csv_file, "w") as f:
                f.write("pt,eta,phi,mass,type\n")
                f.write("45.2,-1.2,0.8,0.105,muon\n")
                f.write("30.0,0.5,1.0,0.0005,electron\n")

            old_expand = os.path.expanduser
            os.path.expanduser = lambda p: p.replace("~", tmpdir)
            try:
                out = processor.process_csv_file(csv_file, max_events=10, experiment="generic")
                with open(out) as f:
                    data = json.load(f)
                assert data["metadata"]["format"] == "csv"
                assert len(data["events"]) == 2
            finally:
                os.path.expanduser = old_expand
