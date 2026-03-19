#pragma once
#include <string>

#ifdef __APPLE__
#define GL_SILENCE_DEPRECATION
#include <OpenGL/gl3.h>
#else
#include <GL/gl.h>
#endif

namespace ocern {

class Shader {
public:
    unsigned int id = 0;

    Shader() = default;
    ~Shader();

    bool loadFromFiles(const std::string& vertPath, const std::string& fragPath);
    bool loadFromSource(const std::string& vertSrc, const std::string& fragSrc);
    void use() const;
    void setMat4(const char* name, const float* mat) const;
    void setVec3(const char* name, float x, float y, float z) const;
    void setVec4(const char* name, float x, float y, float z, float w) const;
    void setFloat(const char* name, float val) const;

private:
    unsigned int compile(const std::string& src, unsigned int type);
};

} // namespace ocern
