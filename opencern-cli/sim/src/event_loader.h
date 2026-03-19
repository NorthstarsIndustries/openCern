#pragma once
#include <string>
#include <vector>

namespace ocern {

struct Particle {
    float px, py, pz;
    float energy;
    float pt;
    float eta;
    float phi;
    float mass = 0;
    std::string type;   // muon, electron, jet, tau, photon
    std::string color;  // hex color from processed data
};

struct Event {
    int index = 0;
    std::vector<Particle> particles;
    float met_pt = 0;
    float met_phi = 0;
    float met = 0;
    float ht = 0;
    float leading_lepton_pt = 0;
    int n_bjets = 0;
    std::string experiment;
};

class EventLoader {
public:
    bool load(const std::string& path);
    size_t eventCount() const { return events_.size(); }
    const Event& getEvent(size_t idx) const;
    const std::string& filename() const { return filename_; }

    // Find event with highest HT
    size_t maxHtIndex() const;

private:
    std::vector<Event> events_;
    std::string filename_;
};

} // namespace ocern
