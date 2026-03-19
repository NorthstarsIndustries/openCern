#pragma once
#include <cmath>

namespace ocern {

struct Vec3 { float x, y, z; };

struct Mat4 {
    float m[16];
    static Mat4 identity();
    static Mat4 perspective(float fov, float aspect, float near, float far);
    static Mat4 lookAt(Vec3 eye, Vec3 center, Vec3 up);
    Mat4 operator*(const Mat4& o) const;
};

class Camera {
public:
    float distance = 400.0f;
    float theta = 0.3f;    // polar angle
    float phi = 0.8f;      // azimuthal angle
    float targetX = 0.0f;
    float targetY = 0.0f;
    float targetZ = 0.0f;

    void rotate(float dx, float dy);
    void zoom(float delta);
    void reset();

    Vec3 getPosition() const;
    Mat4 getViewMatrix() const;
    Mat4 getProjectionMatrix(float aspect) const;
};

} // namespace ocern
