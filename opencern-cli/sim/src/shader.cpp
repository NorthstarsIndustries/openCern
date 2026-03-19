#include "shader.h"
#include <fstream>
#include <sstream>
#include <iostream>

namespace ocern {

Shader::~Shader() {
    if (id) glDeleteProgram(id);
}

bool Shader::loadFromFiles(const std::string& vertPath, const std::string& fragPath) {
    auto readFile = [](const std::string& path) -> std::string {
        std::ifstream f(path);
        if (!f) return "";
        std::stringstream ss;
        ss << f.rdbuf();
        return ss.str();
    };

    std::string vs = readFile(vertPath);
    std::string fs = readFile(fragPath);
    if (vs.empty() || fs.empty()) {
        std::cerr << "Failed to read shader files\n";
        return false;
    }
    return loadFromSource(vs, fs);
}

bool Shader::loadFromSource(const std::string& vertSrc, const std::string& fragSrc) {
    unsigned int vert = compile(vertSrc, GL_VERTEX_SHADER);
    unsigned int frag = compile(fragSrc, GL_FRAGMENT_SHADER);
    if (!vert || !frag) return false;

    id = glCreateProgram();
    glAttachShader(id, vert);
    glAttachShader(id, frag);
    glLinkProgram(id);

    int success;
    glGetProgramiv(id, GL_LINK_STATUS, &success);
    if (!success) {
        char log[512];
        glGetProgramInfoLog(id, 512, nullptr, log);
        std::cerr << "Shader link error: " << log << "\n";
        return false;
    }

    glDeleteShader(vert);
    glDeleteShader(frag);
    return true;
}

unsigned int Shader::compile(const std::string& src, unsigned int type) {
    unsigned int shader = glCreateShader(type);
    const char* c = src.c_str();
    glShaderSource(shader, 1, &c, nullptr);
    glCompileShader(shader);

    int success;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
    if (!success) {
        char log[512];
        glGetShaderInfoLog(shader, 512, nullptr, log);
        std::cerr << "Shader compile error: " << log << "\n";
        return 0;
    }
    return shader;
}

void Shader::use() const { glUseProgram(id); }

void Shader::setMat4(const char* name, const float* mat) const {
    glUniformMatrix4fv(glGetUniformLocation(id, name), 1, GL_FALSE, mat);
}

void Shader::setVec3(const char* name, float x, float y, float z) const {
    glUniform3f(glGetUniformLocation(id, name), x, y, z);
}

void Shader::setVec4(const char* name, float x, float y, float z, float w) const {
    glUniform4f(glGetUniformLocation(id, name), x, y, z, w);
}

void Shader::setFloat(const char* name, float val) const {
    glUniform1f(glGetUniformLocation(id, name), val);
}

} // namespace ocern
