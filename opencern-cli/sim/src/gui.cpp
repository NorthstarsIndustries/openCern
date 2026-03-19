#include "gui.h"
#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"
#include <cstdio>
#include <cmath>
#include <algorithm>
#include <map>

namespace ocern {

// ── Color palette (matches Electron app) ────────────────

static const ImVec4 kBgDark       = ImVec4(0.031f, 0.043f, 0.078f, 0.92f);
static const ImVec4 kBgPanel      = ImVec4(0.031f, 0.043f, 0.078f, 0.88f);
static const ImVec4 kBorder       = ImVec4(0.118f, 0.176f, 0.271f, 1.0f);
static const ImVec4 kTextPrimary  = ImVec4(0.886f, 0.918f, 0.969f, 1.0f);
static const ImVec4 kTextDim      = ImVec4(0.290f, 0.376f, 0.502f, 1.0f);
static const ImVec4 kAccentCyan   = ImVec4(0.0f, 0.831f, 1.0f, 1.0f);
static const ImVec4 kAccentGold   = ImVec4(0.859f, 0.737f, 0.498f, 1.0f);
static const ImVec4 kAccentOrange = ImVec4(1.0f, 0.42f, 0.208f, 1.0f);

// Particle type colors matching Electron app
static ImVec4 particleColor(const std::string& type) {
    if (type == "muon")     return ImVec4(1.0f, 0.42f, 0.42f, 1.0f);
    if (type == "electron") return ImVec4(0.498f, 0.733f, 0.702f, 1.0f);
    if (type == "jet")      return ImVec4(0.859f, 0.737f, 0.498f, 1.0f);
    if (type == "tau")      return ImVec4(0.839f, 0.6f, 0.714f, 1.0f);
    if (type == "photon")   return ImVec4(1.0f, 1.0f, 1.0f, 1.0f);
    return ImVec4(0.6f, 0.6f, 0.8f, 1.0f);
}

static void setupStyle() {
    ImGui::StyleColorsDark();
    ImGuiStyle& style = ImGui::GetStyle();
    style.WindowRounding    = 6.0f;
    style.FrameRounding     = 4.0f;
    style.GrabRounding      = 3.0f;
    style.ScrollbarRounding = 4.0f;
    style.TabRounding       = 4.0f;
    style.WindowBorderSize  = 1.0f;
    style.FrameBorderSize   = 0.0f;
    style.WindowPadding     = ImVec2(16, 12);
    style.FramePadding      = ImVec2(8, 4);
    style.ItemSpacing       = ImVec2(8, 6);
    style.ItemInnerSpacing  = ImVec2(6, 4);
    style.GrabMinSize       = 14.0f;
    style.ScrollbarSize     = 10.0f;
    style.Alpha             = 0.95f;
}

bool GUI::init(GLFWwindow* window) {
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();

    ImGuiIO& io = ImGui::GetIO();
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;
    io.IniFilename = nullptr; // Don't save layout to disk

    // Use default font at a readable size
    io.Fonts->AddFontDefault();

    setupStyle();

    // Don't install GLFW callbacks — we manage them in main.cpp
    ImGui_ImplGlfw_InitForOpenGL(window, false);
    ImGui_ImplOpenGL3_Init("#version 330");

    initialized_ = true;
    return true;
}

void GUI::shutdown() {
    if (!initialized_) return;
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    initialized_ = false;
}

void GUI::beginFrame() {
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();
    ImGui::NewFrame();
}

void GUI::endFrame() {
    ImGui::Render();
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}

bool GUI::wantsMouse() const {
    return ImGui::GetIO().WantCaptureMouse;
}

bool GUI::wantsKeyboard() const {
    return ImGui::GetIO().WantCaptureKeyboard;
}

// ── Helper: draw a colored dot ──────────────────────────

static void colorDot(ImVec4 col, float radius = 4.0f) {
    ImVec2 p = ImGui::GetCursorScreenPos();
    p.x += radius;
    p.y += ImGui::GetTextLineHeight() * 0.5f;
    ImGui::GetWindowDrawList()->AddCircleFilled(p, radius, ImGui::ColorConvertFloat4ToU32(col));
    ImGui::Dummy(ImVec2(radius * 2 + 4, ImGui::GetTextLineHeight()));
    ImGui::SameLine();
}

// ── Helper: stat row ────────────────────────────────────

static void statRow(const char* label, const char* value, ImVec4 valColor) {
    ImGui::TextColored(kTextDim, "%s", label);
    ImGui::SameLine(ImGui::GetContentRegionAvail().x - ImGui::CalcTextSize(value).x);
    ImGui::TextColored(valColor, "%s", value);
}

// ── Main render ─────────────────────────────────────────

bool GUI::render(const Event& event, int& currentEvent, int totalEvents,
                 int trackCount, float fps, const EventLoader& loader) {
    ImGuiIO& io = ImGui::GetIO();
    float displayW = io.DisplaySize.x;
    float displayH = io.DisplaySize.y;

    // ── Event Stats Panel (top-right) ───────────────────
    if (showStats_) {
        float panelW = 240.0f;
        ImGui::SetNextWindowPos(ImVec2(displayW - panelW - 20, 20), ImGuiCond_Always);
        ImGui::SetNextWindowSize(ImVec2(panelW, 0), ImGuiCond_Always);
        ImGui::SetNextWindowBgAlpha(0.88f);

        ImGui::Begin("##EventStats", nullptr,
            ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize |
            ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollbar |
            ImGuiWindowFlags_NoCollapse);

        // Header
        ImGui::TextColored(kTextDim, "EVENT");
        ImGui::SameLine(ImGui::GetContentRegionAvail().x - ImGui::CalcTextSize("00000").x);
        ImGui::TextColored(kTextPrimary, "%d", event.index);

        if (!event.experiment.empty()) {
            ImGui::SameLine();
            ImGui::TextColored(kAccentCyan, " %s", event.experiment.c_str());
        }

        ImGui::Separator();
        ImGui::Spacing();

        // Physics stats
        char buf[64];
        snprintf(buf, sizeof(buf), "%.0f GeV", event.ht);
        statRow("HT", buf, kAccentGold);

        snprintf(buf, sizeof(buf), "%.0f GeV", event.met);
        statRow("MET", buf, kAccentOrange);

        if (event.n_bjets > 0) {
            snprintf(buf, sizeof(buf), "%d", event.n_bjets);
            statRow("b-JETS", buf, kAccentCyan);
        }

        if (event.leading_lepton_pt > 0) {
            snprintf(buf, sizeof(buf), "%.1f GeV", event.leading_lepton_pt);
            statRow("L-PT", buf, kTextPrimary);
        }

        snprintf(buf, sizeof(buf), "%d", trackCount);
        statRow("TRACKS", buf, kTextPrimary);

        ImGui::Separator();
        ImGui::Spacing();

        // Particle counts by type
        std::map<std::string, int> counts;
        for (const auto& p : event.particles) {
            counts[p.type]++;
        }

        const char* types[] = {"muon", "electron", "jet", "tau", "photon"};
        for (const char* t : types) {
            auto it = counts.find(t);
            int n = (it != counts.end()) ? it->second : 0;

            colorDot(particleColor(t));

            char typeName[16];
            snprintf(typeName, sizeof(typeName), "%s", t);
            for (char* c = typeName; *c; c++) *c = toupper(*c);
            ImGui::TextColored(kTextDim, "%-10s", typeName);
            ImGui::SameLine();

            snprintf(buf, sizeof(buf), "x%d", n);
            ImGui::TextColored(kTextPrimary, "%s", buf);
        }

        ImGui::End();
    }

    // ── Navigation Bar (bottom) ─────────────────────────
    if (showControls_) {
        float barH = 56.0f;
        ImGui::SetNextWindowPos(ImVec2(0, displayH - barH), ImGuiCond_Always);
        ImGui::SetNextWindowSize(ImVec2(displayW, barH), ImGuiCond_Always);
        ImGui::SetNextWindowBgAlpha(0.92f);

        ImGui::Begin("##NavBar", nullptr,
            ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize |
            ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollbar |
            ImGuiWindowFlags_NoCollapse);

        ImGui::SetCursorPosY(barH * 0.5f - 14.0f);

        // Prev button
        bool canPrev = currentEvent > 0;
        if (!canPrev) ImGui::BeginDisabled();
        if (ImGui::Button("<< PREV", ImVec2(80, 28))) {
            currentEvent--;
        }
        if (!canPrev) ImGui::EndDisabled();
        ImGui::SameLine();

        // Next button
        bool canNext = currentEvent < totalEvents - 1;
        if (!canNext) ImGui::BeginDisabled();
        if (ImGui::Button("NEXT >>", ImVec2(80, 28))) {
            currentEvent++;
        }
        if (!canNext) ImGui::EndDisabled();
        ImGui::SameLine();

        ImGui::Spacing();
        ImGui::SameLine();

        // Event slider
        ImGui::SetNextItemWidth(displayW - 460);
        if (ImGui::SliderInt("##EventSlider", &currentEvent, 0, totalEvents - 1, "")) {
            // Value already updated
        }
        ImGui::SameLine();

        // Event counter
        char buf[64];
        snprintf(buf, sizeof(buf), "%d / %d", currentEvent + 1, totalEvents);
        ImGui::TextColored(kTextPrimary, "%s", buf);
        ImGui::SameLine();

        ImGui::Spacing();
        ImGui::SameLine();

        // Max HT button
        ImGui::PushStyleColor(ImGuiCol_Button, ImVec4(0.859f, 0.737f, 0.498f, 0.15f));
        ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.859f, 0.737f, 0.498f, 0.35f));
        ImGui::PushStyleColor(ImGuiCol_Text, kAccentGold);
        if (ImGui::Button("MAX HT", ImVec2(80, 28))) {
            currentEvent = static_cast<int>(loader.maxHtIndex());
        }
        ImGui::PopStyleColor(3);
        ImGui::SameLine();

        // FPS
        snprintf(buf, sizeof(buf), "%.0f FPS", fps);
        ImGui::TextColored(kTextDim, "%s", buf);

        ImGui::End();
    }

    // ── Particle Detail Table (toggled with Tab) ────────
    if (showParticleTable_) {
        float tableW = 420.0f;
        float tableH = 320.0f;
        ImGui::SetNextWindowPos(ImVec2(20, 20), ImGuiCond_Once);
        ImGui::SetNextWindowSize(ImVec2(tableW, tableH), ImGuiCond_Once);
        ImGui::SetNextWindowBgAlpha(0.92f);

        ImGui::Begin("Particle Details", &showParticleTable_);

        if (ImGui::BeginTable("##ParticleTable", 6,
                ImGuiTableFlags_Borders | ImGuiTableFlags_RowBg |
                ImGuiTableFlags_ScrollY | ImGuiTableFlags_Resizable |
                ImGuiTableFlags_SizingStretchProp)) {

            ImGui::TableSetupScrollFreeze(0, 1);
            ImGui::TableSetupColumn("Type",   ImGuiTableColumnFlags_WidthFixed, 70);
            ImGui::TableSetupColumn("pT",     ImGuiTableColumnFlags_WidthFixed, 60);
            ImGui::TableSetupColumn("eta",    ImGuiTableColumnFlags_WidthFixed, 55);
            ImGui::TableSetupColumn("phi",    ImGuiTableColumnFlags_WidthFixed, 55);
            ImGui::TableSetupColumn("E",      ImGuiTableColumnFlags_WidthFixed, 60);
            ImGui::TableSetupColumn("mass",   ImGuiTableColumnFlags_WidthFixed, 55);
            ImGui::TableHeadersRow();

            for (size_t i = 0; i < event.particles.size(); i++) {
                const auto& p = event.particles[i];
                ImGui::TableNextRow();

                ImGui::TableNextColumn();
                colorDot(particleColor(p.type), 3.0f);
                ImGui::TextUnformatted(p.type.c_str());

                ImGui::TableNextColumn();
                ImGui::Text("%.1f", p.pt);

                ImGui::TableNextColumn();
                ImGui::Text("%.3f", p.eta);

                ImGui::TableNextColumn();
                ImGui::Text("%.3f", p.phi);

                ImGui::TableNextColumn();
                ImGui::Text("%.1f", p.energy);

                ImGui::TableNextColumn();
                ImGui::Text("%.3f", p.mass);
            }

            ImGui::EndTable();
        }

        ImGui::End();
    }

    // ── Keyboard shortcut hints (top-left, subtle) ──────
    {
        ImGui::SetNextWindowPos(ImVec2(16, displayH - 80), ImGuiCond_Always);
        ImGui::SetNextWindowBgAlpha(0.0f);
        ImGui::Begin("##Hints", nullptr,
            ImGuiWindowFlags_NoTitleBar | ImGuiWindowFlags_NoResize |
            ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoScrollbar |
            ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoInputs |
            ImGuiWindowFlags_AlwaysAutoResize | ImGuiWindowFlags_NoBackground);

        ImGui::TextColored(ImVec4(kTextDim.x, kTextDim.y, kTextDim.z, 0.6f),
            "Tab: particles  R: reset  Q: quit");

        ImGui::End();
    }

    return io.WantCaptureMouse || io.WantCaptureKeyboard;
}

} // namespace ocern
