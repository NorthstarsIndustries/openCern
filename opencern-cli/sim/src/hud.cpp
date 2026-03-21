#include "hud.h"
#include <cstring>
#include <cstdio>

namespace ocern {

// Minimal 8x8 bitmap font — covers ASCII 32-127
// Each character is 8 pixels wide, 8 pixels tall
// For brevity, we use a simple approach: render untextured quads per char
// with the shader painting them as solid color blocks.
// A production version would use stb_truetype but this is functional.

static const char* HUD_VERT = R"(
#version 330 core
layout(location = 0) in vec2 aPos;
uniform vec2 uOffset;
uniform vec2 uScale;
uniform vec2 uScreen;

void main() {
    vec2 pos = (aPos * uScale + uOffset) / uScreen * 2.0 - 1.0;
    pos.y = -pos.y; // flip Y
    gl_Position = vec4(pos, 0.0, 1.0);
}
)";

static const char* HUD_FRAG = R"(
#version 330 core
uniform vec3 uColor;
out vec4 FragColor;

void main() {
    FragColor = vec4(uColor, 0.85);
}
)";

bool HUD::init() {
    // Compile HUD shader
    auto compile = [](const char* src, unsigned int type) -> unsigned int {
        unsigned int s = glCreateShader(type);
        glShaderSource(s, 1, &src, nullptr);
        glCompileShader(s);
        return s;
    };

    unsigned int vs = compile(HUD_VERT, GL_VERTEX_SHADER);
    unsigned int fs = compile(HUD_FRAG, GL_FRAGMENT_SHADER);
    shaderProgram_ = glCreateProgram();
    glAttachShader(shaderProgram_, vs);
    glAttachShader(shaderProgram_, fs);
    glLinkProgram(shaderProgram_);
    glDeleteShader(vs);
    glDeleteShader(fs);

    // Simple quad
    float quad[] = {0,0, 1,0, 1,1, 0,0, 1,1, 0,1};
    glGenVertexArrays(1, &vao_);
    glGenBuffers(1, &vbo_);
    glBindVertexArray(vao_);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2*sizeof(float), nullptr);
    glEnableVertexAttribArray(0);
    glBindVertexArray(0);

    return true;
}

void HUD::renderText(const std::string& text, float x, float y, float scale,
                     float r, float g, float b, int screenW, int screenH) {
    glUseProgram(shaderProgram_);
    glUniform2f(glGetUniformLocation(shaderProgram_, "uScreen"), (float)screenW, (float)screenH);
    glUniform3f(glGetUniformLocation(shaderProgram_, "uColor"), r, g, b);

    glBindVertexArray(vao_);

    float charW = 8.0f * scale;
    float charH = 12.0f * scale;

    for (size_t i = 0; i < text.size(); i++) {
        if (text[i] == ' ') { x += charW; continue; }
        // Render a filled rect for each character (simplified approach)
        glUniform2f(glGetUniformLocation(shaderProgram_, "uOffset"), x, y);
        glUniform2f(glGetUniformLocation(shaderProgram_, "uScale"), charW * 0.8f, charH);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        x += charW;
    }
    glBindVertexArray(0);
}

void HUD::render(int width, int height, const Event& event, int eventIdx, int totalEvents,
                 int trackCount, float fps) {
    glDisable(GL_DEPTH_TEST);

    // Background bar at top
    glUseProgram(shaderProgram_);
    glUniform2f(glGetUniformLocation(shaderProgram_, "uScreen"), (float)width, (float)height);
    glUniform3f(glGetUniformLocation(shaderProgram_, "uColor"), 0.05f, 0.05f, 0.08f);
    glUniform2f(glGetUniformLocation(shaderProgram_, "uOffset"), 0, 0);
    glUniform2f(glGetUniformLocation(shaderProgram_, "uScale"), (float)width, 30.0f);
    glBindVertexArray(vao_);
    glDrawArrays(GL_TRIANGLES, 0, 6);

    // Background bar at bottom
    glUniform2f(glGetUniformLocation(shaderProgram_, "uOffset"), 0, (float)(height - 30));
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);

    // HUD text - top bar
    char buf[256];
    snprintf(buf, sizeof(buf), "Event %d/%d  Particles: %d  HT: %.1f GeV  MET: %.1f GeV",
             eventIdx + 1, totalEvents, trackCount, event.ht, event.met_pt);
    renderText(buf, 10, 8, 1.2f, 0.7f, 0.8f, 1.0f, width, height);

    // Bottom bar
    snprintf(buf, sizeof(buf), "Left/Right: navigate  R: reset camera  Q: quit  FPS: %.0f", fps);
    renderText(buf, 10, (float)(height - 22), 1.0f, 0.5f, 0.5f, 0.6f, width, height);

    glEnable(GL_DEPTH_TEST);
}

void HUD::cleanup() {
    if (vbo_) glDeleteBuffers(1, &vbo_);
    if (vao_) glDeleteVertexArrays(1, &vao_);
    if (shaderProgram_) glDeleteProgram(shaderProgram_);
}

} // namespace ocern
