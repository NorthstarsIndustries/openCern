#include "particles.h"
#include <cmath>
#include <algorithm>

namespace ocern {

ParticleStyle getParticleStyle(const std::string& type) {
    if (type == "muon" || type == "Muon")
        return {1.0f, 0.42f, 0.42f, 2.5f, 1.0f};     // #ff6b6b
    if (type == "electron" || type == "Electron")
        return {0.5f, 0.73f, 0.7f, 1.5f, 0.55f};      // #7fbbb3
    if (type == "jet" || type == "Jet")
        return {0.86f, 0.74f, 0.5f, 1.0f, 0.4f};      // #dbbc7f
    if (type == "tau" || type == "Tau")
        return {0.84f, 0.6f, 0.71f, 1.5f, 0.45f};     // #d699b6
    if (type == "photon" || type == "Photon")
        return {1.0f, 1.0f, 1.0f, 1.0f, 0.55f};       // #ffffff
    // Default
    return {0.6f, 0.6f, 0.8f, 1.0f, 0.5f};
}

void ParticleRenderer::init() {
    // Track lines
    glGenVertexArrays(1, &vao_);
    glGenBuffers(1, &vbo_);

    // MET arrow
    glGenVertexArrays(1, &metVao_);
    glGenBuffers(1, &metVbo_);

    // Collision vertex
    glGenVertexArrays(1, &vertexVao_);
    glGenBuffers(1, &vertexVbo_);

    // Setup vertex point at origin (white)
    float vertexData[] = {0, 0, 0, 1, 1, 1};
    glBindVertexArray(vertexVao_);
    glBindBuffer(GL_ARRAY_BUFFER, vertexVbo_);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertexData), vertexData, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), nullptr);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);
}

void ParticleRenderer::update(const Event& event, float detectorRadius) {
    std::vector<TrackVertex> verts;
    trackCount_ = 0;

    for (const auto& p : event.particles) {
        ParticleStyle style = getParticleStyle(p.type);
        float maxLen = detectorRadius * style.lengthFrac;

        // Direction from momentum
        float pmag = std::sqrt(p.px*p.px + p.py*p.py + p.pz*p.pz);
        if (pmag < 0.001f) continue;

        float dx = p.px / pmag;
        float dy = p.py / pmag;
        float dz = p.pz / pmag;

        // Scale length by energy, capped at detector radius
        float len = std::min(maxLen, p.energy * 2.0f);

        if (p.type == "jet" || p.type == "Jet") {
            // Jets: 8 sub-tracks in a cone
            float coneAngle = 0.44f; // ~25 degrees
            for (int j = 0; j < 8; j++) {
                float jAngle = (2.0f * M_PI * j) / 8.0f;
                float jdx = dx + coneAngle * std::cos(jAngle) * 0.3f;
                float jdy = dy + coneAngle * std::sin(jAngle) * 0.3f;
                float jdz = dz + coneAngle * std::sin(jAngle + 1.0f) * 0.3f;
                float jmag = std::sqrt(jdx*jdx + jdy*jdy + jdz*jdz);
                jdx /= jmag; jdy /= jmag; jdz /= jmag;

                verts.push_back({0, 0, 0, style.r, style.g, style.b});
                verts.push_back({jdx * len, jdy * len, jdz * len, style.r * 0.6f, style.g * 0.6f, style.b * 0.6f});
            }
        } else {
            // Single track from origin
            verts.push_back({0, 0, 0, style.r, style.g, style.b});
            verts.push_back({dx * len, dy * len, dz * len, style.r * 0.8f, style.g * 0.8f, style.b * 0.8f});
        }
        trackCount_++;
    }

    vertexCount_ = static_cast<int>(verts.size());

    glBindVertexArray(vao_);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_);
    glBufferData(GL_ARRAY_BUFFER, verts.size() * sizeof(TrackVertex), verts.data(), GL_DYNAMIC_DRAW);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(TrackVertex), nullptr);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(TrackVertex), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
    glBindVertexArray(0);

    // MET arrow
    hasMet_ = event.met_pt > 0;
    if (hasMet_) {
        float metLen = std::min(detectorRadius * 0.8f, event.met_pt * 3.0f);
        float mdx = std::cos(event.met_phi) * metLen;
        float mdz = std::sin(event.met_phi) * metLen;
        // Dashed line: multiple segments
        std::vector<float> metVerts;
        int segs = 10;
        for (int i = 0; i < segs; i += 2) {
            float t0 = (float)i / segs;
            float t1 = (float)(i + 1) / segs;
            metVerts.insert(metVerts.end(), {mdx * t0, 0, mdz * t0, 1.0f, 0.65f, 0.0f});
            metVerts.insert(metVerts.end(), {mdx * t1, 0, mdz * t1, 1.0f, 0.65f, 0.0f});
        }
        metVertCount_ = static_cast<int>(metVerts.size() / 6);

        glBindVertexArray(metVao_);
        glBindBuffer(GL_ARRAY_BUFFER, metVbo_);
        glBufferData(GL_ARRAY_BUFFER, metVerts.size() * sizeof(float), metVerts.data(), GL_DYNAMIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), nullptr);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);
    }
}

void ParticleRenderer::draw() const {
    // Collision vertex point
    glBindVertexArray(vertexVao_);
    glPointSize(8.0f);
    glDrawArrays(GL_POINTS, 0, 1);

    // Particle tracks
    if (vertexCount_ > 0) {
        glBindVertexArray(vao_);
        glDrawArrays(GL_LINES, 0, vertexCount_);
    }

    // MET arrow
    if (hasMet_ && metVertCount_ > 0) {
        glBindVertexArray(metVao_);
        glDrawArrays(GL_LINES, 0, metVertCount_);
    }

    glBindVertexArray(0);
}

void ParticleRenderer::cleanup() {
    if (vbo_) glDeleteBuffers(1, &vbo_);
    if (vao_) glDeleteVertexArrays(1, &vao_);
    if (metVbo_) glDeleteBuffers(1, &metVbo_);
    if (metVao_) glDeleteVertexArrays(1, &metVao_);
    if (vertexVbo_) glDeleteBuffers(1, &vertexVbo_);
    if (vertexVao_) glDeleteVertexArrays(1, &vertexVao_);
}

} // namespace ocern
