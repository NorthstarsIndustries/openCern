cmake_minimum_required(VERSION 3.16)
project(opencern-sim VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Find dependencies ────────────────────────────────────

# OpenGL
if(APPLE)
    find_library(OPENGL_FRAMEWORK OpenGL REQUIRED)
    find_library(COCOA_FRAMEWORK Cocoa REQUIRED)
    find_library(IOKIT_FRAMEWORK IOKit REQUIRED)
    find_library(COREVIDEO_FRAMEWORK CoreVideo REQUIRED)
endif()

find_package(OpenGL REQUIRED)

# GLFW
find_package(glfw3 3.3 QUIET)
if(NOT glfw3_FOUND)
    message(STATUS "GLFW not found via find_package, trying pkg-config...")
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GLFW REQUIRED glfw3)
endif()

# ── Dear ImGui (vendored) ───────────────────────────────

set(IMGUI_DIR ${CMAKE_CURRENT_SOURCE_DIR}/vendor/imgui)
set(IMGUI_SOURCES
    ${IMGUI_DIR}/imgui.cpp
    ${IMGUI_DIR}/imgui_draw.cpp
    ${IMGUI_DIR}/imgui_tables.cpp
    ${IMGUI_DIR}/imgui_widgets.cpp
    ${IMGUI_DIR}/imgui_impl_glfw.cpp
    ${IMGUI_DIR}/imgui_impl_opengl3.cpp
)

# ── Source files ─────────────────────────────────────────

set(SOURCES
    src/main.cpp
    src/renderer.cpp
    src/detector.cpp
    src/event_loader.cpp
    src/camera.cpp
    src/particles.cpp
    src/hud.cpp
    src/shader.cpp
    src/gui.cpp
)

add_executable(opencern-sim ${SOURCES} ${IMGUI_SOURCES})

target_include_directories(opencern-sim PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${IMGUI_DIR}
)

# ── Link libraries ───────────────────────────────────────

if(APPLE)
    target_link_libraries(opencern-sim PRIVATE
        OpenGL::GL
        glfw
        ${COCOA_FRAMEWORK}
        ${IOKIT_FRAMEWORK}
        ${COREVIDEO_FRAMEWORK}
    )
else()
    target_link_libraries(opencern-sim PRIVATE
        OpenGL::GL
        glfw
        dl
    )
endif()

# ── Shader files: embed paths ────────────────────────────

target_compile_definitions(opencern-sim PRIVATE
    SHADER_DIR="${CMAKE_CURRENT_SOURCE_DIR}/shaders"
)

# ── Install ──────────────────────────────────────────────

install(TARGETS opencern-sim DESTINATION bin)
