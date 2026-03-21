#pragma once

#ifdef __APPLE__
#define GL_SILENCE_DEPRECATION
#include <OpenGL/gl3.h>
#else
#include <GL/gl.h>
#endif

#include "event_loader.h"
#include <vector>

namespace ocern {

struct TrackVertex {
    float x, y, z;
    float r, g, b;
};

// Color mapping for particle types
struct ParticleStyle {
    float r, g, b;
    float width;
    float lengthFrac;  // fraction of detector radius
};

ParticleStyle getParticleStyle(const std::string& type);

class ParticleRenderer {
public:
    void init();
    void update(const Event& event, float detectorRadius);
    void draw() const;
    void cleanup();

    int trackCount() const { return trackCount_; }

private:
    unsigned int vao_ = 0, vbo_ = 0;
    int vertexCount_ = 0;
    int trackCount_ = 0;

    // MET arrow
    unsigned int metVao_ = 0, metVbo_ = 0;
    int metVertCount_ = 0;
    bool hasMet_ = false;

    // Collision vertex point
    unsigned int vertexVao_ = 0, vertexVbo_ = 0;
};

} // namespace ocern
