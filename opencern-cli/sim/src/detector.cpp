#include "detector.h"
#include <vector>
#include <cmath>

namespace ocern {

void Detector::init() {
    // Beam pipe
    layers_[0] = {4.0f, 500.0f, 0.2f, 0.2f, 0.35f, 0.4f};
    // Tracker
    layers_[1] = {80.0f, 350.0f, 0.15f, 0.2f, 0.4f, 0.3f};
    // ECAL
    layers_[2] = {140.0f, 350.0f, 0.1f, 0.15f, 0.35f, 0.25f};
    // Barrel
    layers_[3] = {220.0f, 350.0f, 0.08f, 0.1f, 0.3f, 0.2f};

    for (auto& l : layers_) {
        buildCylinder(l, 16, 8);
    }
}

void Detector::buildCylinder(Layer& layer, int radialSegs, int longiRings) {
    std::vector<float> verts;

    float r = layer.radius;
    float hz = layer.halfZ;

    // Longitudinal lines (radial segments along Z)
    for (int i = 0; i < radialSegs; i++) {
        float angle = (2.0f * M_PI * i) / radialSegs;
        float x = r * std::cos(angle);
        float y = r * std::sin(angle);
        verts.insert(verts.end(), {x, y, -hz});
        verts.insert(verts.end(), {x, y, hz});
    }

    // Rings at different Z positions
    for (int ring = 0; ring <= longiRings; ring++) {
        float z = -hz + (2.0f * hz * ring) / longiRings;
        for (int i = 0; i < radialSegs; i++) {
            float a1 = (2.0f * M_PI * i) / radialSegs;
            float a2 = (2.0f * M_PI * ((i + 1) % radialSegs)) / radialSegs;
            verts.insert(verts.end(), {r * std::cos(a1), r * std::sin(a1), z});
            verts.insert(verts.end(), {r * std::cos(a2), r * std::sin(a2), z});
        }
    }

    layer.vertexCount = static_cast<int>(verts.size() / 3);

    glGenVertexArrays(1, &layer.vao);
    glGenBuffers(1, &layer.vbo);

    glBindVertexArray(layer.vao);
    glBindBuffer(GL_ARRAY_BUFFER, layer.vbo);
    glBufferData(GL_ARRAY_BUFFER, verts.size() * sizeof(float), verts.data(), GL_STATIC_DRAW);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), nullptr);
    glEnableVertexAttribArray(0);

    glBindVertexArray(0);
}

void Detector::draw() const {
    for (const auto& l : layers_) {
        if (l.vao == 0) continue;
        glBindVertexArray(l.vao);
        glDrawArrays(GL_LINES, 0, l.vertexCount);
    }
    glBindVertexArray(0);
}

void Detector::cleanup() {
    for (auto& l : layers_) {
        if (l.vbo) glDeleteBuffers(1, &l.vbo);
        if (l.vao) glDeleteVertexArrays(1, &l.vao);
        l.vbo = l.vao = 0;
    }
}

} // namespace ocern
