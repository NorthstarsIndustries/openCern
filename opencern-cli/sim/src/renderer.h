#pragma once

#include "shader.h"
#include "camera.h"
#include "detector.h"
#include "particles.h"
#include "event_loader.h"

namespace ocern {

class Renderer {
public:
    bool init();
    void render(const Camera& camera, float aspect);
    void updateEvent(const Event& event);
    void cleanup();

    Detector& getDetector() { return detector_; }
    ParticleRenderer& getParticles() { return particles_; }

private:
    Shader lineShader_;
    Detector detector_;
    ParticleRenderer particles_;
};

} // namespace ocern
