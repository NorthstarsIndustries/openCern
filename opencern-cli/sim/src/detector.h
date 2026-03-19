#pragma once

#ifdef __APPLE__
#define GL_SILENCE_DEPRECATION
#include <OpenGL/gl3.h>
#else
#include <GL/gl.h>
#endif

namespace ocern {

// Generates wireframe cylinder geometry for the detector layers
class Detector {
public:
    void init();
    void draw() const;
    void cleanup();

private:
    struct Layer {
        float radius;
        float halfZ;
        float r, g, b, a;
        unsigned int vao = 0, vbo = 0;
        int vertexCount = 0;
    };

    Layer layers_[4];

    void buildCylinder(Layer& layer, int radialSegs, int longiRings);
};

} // namespace ocern
