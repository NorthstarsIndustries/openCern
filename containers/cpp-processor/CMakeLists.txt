cmake_minimum_required(VERSION 3.16)
project(opencern-processor VERSION 1.0.0 LANGUAGES CXX)

# OpenCERN C++ Processor CMake (autotest)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG")

# ── Find ROOT ──
find_package(ROOT REQUIRED COMPONENTS Core RIO Tree TreePlayer)
include(${ROOT_USE_FILE})

# ── nlohmann/json (header-only) ──
include(FetchContent)
FetchContent_Declare(json
    URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz
)
FetchContent_MakeAvailable(json)

# ── Build processor binary ──
add_executable(opencern-processor
    src/main.cpp
)

target_link_libraries(opencern-processor
    PRIVATE
        ROOT::Core
        ROOT::RIO
        ROOT::Tree
        ROOT::TreePlayer
        nlohmann_json::nlohmann_json
)

target_include_directories(opencern-processor
    PRIVATE
        ${CMAKE_SOURCE_DIR}/src
)

install(TARGETS opencern-processor DESTINATION bin)
