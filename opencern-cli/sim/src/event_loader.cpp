#include "event_loader.h"
#include "../include/json.hpp"
#include <fstream>
#include <iostream>
#include <cmath>
#include <algorithm>

using json = nlohmann::json;

namespace ocern {

bool EventLoader::load(const std::string& path) {
    std::ifstream f(path);
    if (!f) {
        std::cerr << "Cannot open: " << path << "\n";
        return false;
    }

    filename_ = path;
    json root;
    try {
        f >> root;
    } catch (const std::exception& e) {
        std::cerr << "JSON parse error: " << e.what() << "\n";
        return false;
    }

    json eventArray;
    if (root.contains("events") && root["events"].is_array()) {
        eventArray = root["events"];
    } else if (root.contains("particles") && root["particles"].is_array()) {
        eventArray = root["particles"];
    } else if (root.is_array()) {
        eventArray = root;
    } else {
        std::cerr << "No event array found in JSON\n";
        return false;
    }

    events_.clear();
    events_.reserve(eventArray.size());

    for (size_t i = 0; i < eventArray.size(); i++) {
        const auto& je = eventArray[i];
        Event ev;
        ev.index = je.value("index", static_cast<int>(i));
        ev.experiment = je.value("experiment", std::string(""));
        ev.leading_lepton_pt = je.value("leading_lepton_pt", 0.0f);
        ev.n_bjets = je.value("n_bjets", 0);
        ev.met = je.value("met", 0.0f);

        // MET vector
        if (je.contains("met_vector") && je["met_vector"].is_object()) {
            ev.met_pt = je["met_vector"].value("pt", 0.0f);
            ev.met_phi = je["met_vector"].value("phi", 0.0f);
        } else {
            ev.met_pt = je.value("met_pt", je.value("MET", 0.0f));
            ev.met_phi = je.value("met_phi", 0.0f);
        }
        if (ev.met == 0 && ev.met_pt > 0) ev.met = ev.met_pt;

        // Single-particle event format (flat fields)
        if (je.contains("pt") || je.contains("pT")) {
            Particle p;
            p.pt = je.value("pt", je.value("pT", 0.0f));
            p.eta = je.value("eta", 0.0f);
            p.phi = je.value("phi", 0.0f);
            p.energy = je.value("energy", je.value("E", p.pt));
            p.mass = je.value("mass", 0.0f);
            p.type = je.value("type", je.value("particle_type", std::string("particle")));
            p.color = je.value("color", std::string(""));
            p.px = p.pt * std::cos(p.phi);
            p.py = p.pt * std::sin(p.phi);
            p.pz = p.pt * std::sinh(p.eta);
            ev.particles.push_back(p);
            ev.ht = p.pt;
        }

        // Multi-particle event format (nested particles array)
        if (je.contains("particles") && je["particles"].is_array()) {
            for (const auto& jp : je["particles"]) {
                Particle p;
                p.pt = jp.value("pt", jp.value("pT", 0.0f));
                p.eta = jp.value("eta", 0.0f);
                p.phi = jp.value("phi", 0.0f);
                p.energy = jp.value("energy", jp.value("E", p.pt));
                p.mass = jp.value("mass", 0.0f);
                p.type = jp.value("type", jp.value("particle_type", std::string("particle")));
                p.color = jp.value("color", std::string(""));
                if (jp.contains("px")) p.px = jp.value("px", 0.0f);
                else p.px = p.pt * std::cos(p.phi);
                if (jp.contains("py")) p.py = jp.value("py", 0.0f);
                else p.py = p.pt * std::sin(p.phi);
                if (jp.contains("pz")) p.pz = jp.value("pz", 0.0f);
                else p.pz = p.pt * std::sinh(p.eta);
                ev.particles.push_back(p);
                ev.ht += p.pt;
            }
        }

        // Use top-level ht if provided
        if (je.contains("ht")) ev.ht = je.value("ht", ev.ht);

        if (!ev.particles.empty()) {
            events_.push_back(std::move(ev));
        }
    }

    std::cout << "Loaded " << events_.size() << " events from " << path << "\n";
    return !events_.empty();
}

const Event& EventLoader::getEvent(size_t idx) const {
    return events_[idx % events_.size()];
}

size_t EventLoader::maxHtIndex() const {
    if (events_.empty()) return 0;
    size_t best = 0;
    float maxHt = -1;
    for (size_t i = 0; i < events_.size(); i++) {
        if (events_[i].ht > maxHt) {
            maxHt = events_[i].ht;
            best = i;
        }
    }
    return best;
}

} // namespace ocern
