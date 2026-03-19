#include "renderer.h"
#include <string>

namespace ocern {

static const char* LINE_VERT = R"(
#version 330 core
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aColor;

uniform mat4 uProjection;
uniform mat4 uView;
uniform vec4 uDefaultColor;

out vec3 vColor;

void main() {
    gl_Position = uProjection * uView * vec4(aPos, 1.0);
    // Use attribute color if non-zero, otherwise default
    vColor = (aColor.r + aColor.g + aColor.b > 0.01) ? aColor : uDefaultColor.rgb;
}
)";

static const char* LINE_FRAG = R"(
#version 330 core
in vec3 vColor;
out vec4 FragColor;

void main() {
    FragColor = vec4(vColor, 1.0);
}
)";

bool Renderer::init() {
    if (!lineShader_.loadFromSource(LINE_VERT, LINE_FRAG)) {
        return false;
    }

    detector_.init();
    particles_.init();

    glEnable(GL_DEPTH_TEST);
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glEnable(GL_LINE_SMOOTH);

    return true;
}

void Renderer::render(const Camera& camera, float aspect) {
    glClearColor(0.04f, 0.04f, 0.06f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    Mat4 proj = camera.getProjectionMatrix(aspect);
    Mat4 view = camera.getViewMatrix();

    lineShader_.use();
    lineShader_.setMat4("uProjection", proj.m);
    lineShader_.setMat4("uView", view.m);

    // Draw detector layers with different colors
    float detColors[][4] = {
        {0.2f, 0.2f, 0.35f, 0.4f},
        {0.15f, 0.2f, 0.4f, 0.3f},
        {0.1f, 0.15f, 0.35f, 0.25f},
        {0.08f, 0.1f, 0.3f, 0.2f},
    };

    for (int i = 0; i < 4; i++) {
        lineShader_.setVec4("uDefaultColor", detColors[i][0], detColors[i][1], detColors[i][2], detColors[i][3]);
        glLineWidth(1.0f);
    }
    detector_.draw();

    // Draw particle tracks (use vertex colors)
    lineShader_.setVec4("uDefaultColor", 0.5f, 0.5f, 0.8f, 1.0f);
    glLineWidth(2.0f);
    particles_.draw();
}

void Renderer::updateEvent(const Event& event) {
    particles_.update(event, 220.0f);
}

void Renderer::cleanup() {
    detector_.cleanup();
    particles_.cleanup();
}

} // namespace ocern
