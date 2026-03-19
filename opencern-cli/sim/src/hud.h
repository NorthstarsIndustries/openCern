#pragma once

#ifdef __APPLE__
#define GL_SILENCE_DEPRECATION
#include <OpenGL/gl3.h>
#else
#include <GL/gl.h>
#endif

#include "event_loader.h"
#include <string>

namespace ocern {

// Simple text HUD using bitmap font rendered as textured quads.
// For simplicity, we render basic ASCII bitmap text.
class HUD {
public:
    bool init();
    void render(int width, int height, const Event& event, int eventIdx, int totalEvents,
                int trackCount, float fps);
    void cleanup();

private:
    unsigned int shaderProgram_ = 0;
    unsigned int vao_ = 0, vbo_ = 0;
    unsigned int fontTexture_ = 0;

    void renderText(const std::string& text, float x, float y, float scale,
                    float r, float g, float b, int screenW, int screenH);
    void buildFontTexture();
};

} // namespace ocern
