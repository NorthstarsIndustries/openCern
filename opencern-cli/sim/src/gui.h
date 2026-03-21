#pragma once

#include "event_loader.h"
#include <GLFW/glfw3.h>

namespace ocern {

// ImGui-based overlay for event inspection and navigation.
class GUI {
public:
    bool init(GLFWwindow* window);
    void shutdown();

    // Call at the start of a frame (before any ImGui rendering)
    void beginFrame();

    // Render all GUI panels. Returns true if ImGui wants the mouse/keyboard.
    bool render(const Event& event, int& currentEvent, int totalEvents,
                int trackCount, float fps, const EventLoader& loader);

    // Call at the end of a frame (draws ImGui draw data)
    void endFrame();

    // True when ImGui is capturing mouse or keyboard input
    bool wantsMouse() const;
    bool wantsKeyboard() const;

    // Toggle the particle detail table
    void toggleParticleTable() { showParticleTable_ = !showParticleTable_; }

private:
    bool initialized_ = false;

    // Panel state
    bool showStats_ = true;
    bool showControls_ = true;
    bool showParticleTable_ = false;
};

} // namespace ocern
