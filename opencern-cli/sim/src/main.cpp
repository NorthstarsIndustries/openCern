/**
 * OpenCERN Collision Event Viewer
 *
 * A standalone C++ OpenGL application that reads processed JSON event files
 * and renders interactive 3D particle collision visualizations.
 *
 * Usage:
 *   opencern-sim <file.json> [--event=N]
 */

#ifdef __APPLE__
#define GL_SILENCE_DEPRECATION
#endif

#include <GLFW/glfw3.h>
#include <iostream>
#include <string>
#include <chrono>
#include <cstring>

#include "renderer.h"
#include "camera.h"
#include "event_loader.h"
#include "hud.h"
#include "gui.h"
#include "imgui_impl_glfw.h"

using namespace ocern;

// ── Globals for GLFW callbacks ──────────────────────────

static Camera g_camera;
static GUI g_gui;
static bool g_mouseDown = false;
static double g_lastMouseX = 0, g_lastMouseY = 0;

static void cursorCallback(GLFWwindow* window, double x, double y) {
    ImGui_ImplGlfw_CursorPosCallback(window, x, y);
    if (!g_gui.wantsMouse() && g_mouseDown) {
        g_camera.rotate(
            static_cast<float>(x - g_lastMouseX),
            static_cast<float>(y - g_lastMouseY)
        );
    }
    g_lastMouseX = x;
    g_lastMouseY = y;
}

static void mouseButtonCallback(GLFWwindow* window, int button, int action, int mods) {
    ImGui_ImplGlfw_MouseButtonCallback(window, button, action, mods);
    if (g_gui.wantsMouse()) return;
    if (button == GLFW_MOUSE_BUTTON_LEFT) {
        g_mouseDown = (action == GLFW_PRESS);
    }
}

static void scrollCallback(GLFWwindow* window, double xoffset, double yoffset) {
    ImGui_ImplGlfw_ScrollCallback(window, xoffset, yoffset);
    if (g_gui.wantsMouse()) return;
    g_camera.zoom(static_cast<float>(yoffset));
}

static void keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods) {
    ImGui_ImplGlfw_KeyCallback(window, key, scancode, action, mods);
}

static void charCallback(GLFWwindow* window, unsigned int c) {
    ImGui_ImplGlfw_CharCallback(window, c);
}

// ── Main ────────────────────────────────────────────────

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Usage: opencern-sim <file.json> [--event=N]\n";
        return 1;
    }

    std::string filePath = argv[1];
    int startEvent = 0;

    for (int i = 2; i < argc; i++) {
        if (std::strncmp(argv[i], "--event=", 8) == 0) {
            startEvent = std::atoi(argv[i] + 8);
        }
    }

    // Load events
    EventLoader loader;
    if (!loader.load(filePath)) {
        std::cerr << "Failed to load events from: " << filePath << "\n";
        return 1;
    }

    // Initialize GLFW
    if (!glfwInit()) {
        std::cerr << "Failed to initialize GLFW\n";
        return 1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
#ifdef __APPLE__
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif
    glfwWindowHint(GLFW_SAMPLES, 4); // MSAA

    GLFWwindow* window = glfwCreateWindow(1440, 900, "OpenCERN Collision Viewer", nullptr, nullptr);
    if (!window) {
        std::cerr << "Failed to create window\n";
        glfwTerminate();
        return 1;
    }

    glfwMakeContextCurrent(window);
    glfwSwapInterval(1); // vsync

    // Initialize renderer
    Renderer renderer;
    if (!renderer.init()) {
        std::cerr << "Failed to initialize renderer\n";
        glfwTerminate();
        return 1;
    }

    // Initialize ImGui overlay (with install_callbacks=false)
    if (!g_gui.init(window)) {
        std::cerr << "Warning: GUI initialization failed, falling back to HUD\n";
    }

    // Set GLFW callbacks AFTER ImGui init so we control dispatch
    glfwSetCursorPosCallback(window, cursorCallback);
    glfwSetMouseButtonCallback(window, mouseButtonCallback);
    glfwSetScrollCallback(window, scrollCallback);
    glfwSetKeyCallback(window, keyCallback);
    glfwSetCharCallback(window, charCallback);

    HUD hud;
    // HUD is kept as fallback but not rendered when ImGui is active

    // Event navigation
    int currentEvent = startEvent % static_cast<int>(loader.eventCount());
    int prevEvent = currentEvent;
    renderer.updateEvent(loader.getEvent(currentEvent));

    // FPS tracking
    auto lastFrame = std::chrono::high_resolution_clock::now();
    float fps = 60.0f;
    int frameCount = 0;
    auto lastFpsUpdate = lastFrame;

    // Tab key toggle debounce
    bool tabWasPressed = false;

    // ── Main loop ───────────────────────────────────────

    while (!glfwWindowShouldClose(window)) {
        // Timing
        auto now = std::chrono::high_resolution_clock::now();
        float dt = std::chrono::duration<float>(now - lastFrame).count();
        lastFrame = now;
        frameCount++;

        auto fpsDelta = std::chrono::duration<float>(now - lastFpsUpdate).count();
        if (fpsDelta >= 1.0f) {
            fps = frameCount / fpsDelta;
            frameCount = 0;
            lastFpsUpdate = now;
        }

        // Input
        glfwPollEvents();

        // ImGui frame
        g_gui.beginFrame();

        // Key handling (only when ImGui doesn't want keyboard)
        if (!g_gui.wantsKeyboard()) {
            if (glfwGetKey(window, GLFW_KEY_Q) == GLFW_PRESS ||
                glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
                glfwSetWindowShouldClose(window, GLFW_TRUE);
            }

            if (glfwGetKey(window, GLFW_KEY_R) == GLFW_PRESS) {
                g_camera.reset();
            }

            // Event navigation with arrow keys
            static bool leftWasPressed = false;
            static bool rightWasPressed = false;

            bool leftNow = glfwGetKey(window, GLFW_KEY_LEFT) == GLFW_PRESS;
            bool rightNow = glfwGetKey(window, GLFW_KEY_RIGHT) == GLFW_PRESS;

            if (leftNow && !leftWasPressed) {
                currentEvent = (currentEvent - 1 + static_cast<int>(loader.eventCount())) % static_cast<int>(loader.eventCount());
            }
            if (rightNow && !rightWasPressed) {
                currentEvent = (currentEvent + 1) % static_cast<int>(loader.eventCount());
            }
            leftWasPressed = leftNow;
            rightWasPressed = rightNow;
        }

        // Tab toggle for particle table
        bool tabNow = glfwGetKey(window, GLFW_KEY_TAB) == GLFW_PRESS;
        if (tabNow && !tabWasPressed) {
            g_gui.toggleParticleTable();
        }
        tabWasPressed = tabNow;

        // Render 3D scene
        int width, height;
        glfwGetFramebufferSize(window, &width, &height);
        glViewport(0, 0, width, height);

        float aspect = (height > 0) ? static_cast<float>(width) / height : 1.0f;
        renderer.render(g_camera, aspect);

        // Render ImGui overlay
        const auto& event = loader.getEvent(currentEvent);
        g_gui.render(event, currentEvent, static_cast<int>(loader.eventCount()),
                     renderer.getParticles().trackCount(), fps, loader);

        // Update event if slider or buttons changed it
        if (currentEvent != prevEvent) {
            currentEvent = std::max(0, std::min(currentEvent, static_cast<int>(loader.eventCount()) - 1));
            renderer.updateEvent(loader.getEvent(currentEvent));
            prevEvent = currentEvent;
        }

        g_gui.endFrame();

        glfwSwapBuffers(window);
    }

    // Cleanup
    g_gui.shutdown();
    renderer.cleanup();
    hud.cleanup();
    glfwDestroyWindow(window);
    glfwTerminate();

    return 0;
}
