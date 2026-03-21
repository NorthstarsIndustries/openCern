#include "camera.h"
#include <cstring>
#include <algorithm>

namespace ocern {

Mat4 Mat4::identity() {
    Mat4 r;
    std::memset(r.m, 0, sizeof(r.m));
    r.m[0] = r.m[5] = r.m[10] = r.m[15] = 1.0f;
    return r;
}

Mat4 Mat4::perspective(float fov, float aspect, float near, float far) {
    Mat4 r;
    std::memset(r.m, 0, sizeof(r.m));
    float f = 1.0f / std::tan(fov * 0.5f);
    r.m[0] = f / aspect;
    r.m[5] = f;
    r.m[10] = (far + near) / (near - far);
    r.m[11] = -1.0f;
    r.m[14] = (2.0f * far * near) / (near - far);
    return r;
}

Mat4 Mat4::lookAt(Vec3 eye, Vec3 center, Vec3 up) {
    Vec3 f = {center.x - eye.x, center.y - eye.y, center.z - eye.z};
    float fl = std::sqrt(f.x*f.x + f.y*f.y + f.z*f.z);
    f = {f.x/fl, f.y/fl, f.z/fl};

    Vec3 s = {f.y*up.z - f.z*up.y, f.z*up.x - f.x*up.z, f.x*up.y - f.y*up.x};
    float sl = std::sqrt(s.x*s.x + s.y*s.y + s.z*s.z);
    s = {s.x/sl, s.y/sl, s.z/sl};

    Vec3 u = {s.y*f.z - s.z*f.y, s.z*f.x - s.x*f.z, s.x*f.y - s.y*f.x};

    Mat4 r = Mat4::identity();
    r.m[0] = s.x;  r.m[4] = s.y;  r.m[8]  = s.z;
    r.m[1] = u.x;  r.m[5] = u.y;  r.m[9]  = u.z;
    r.m[2] = -f.x; r.m[6] = -f.y; r.m[10] = -f.z;
    r.m[12] = -(s.x*eye.x + s.y*eye.y + s.z*eye.z);
    r.m[13] = -(u.x*eye.x + u.y*eye.y + u.z*eye.z);
    r.m[14] = (f.x*eye.x + f.y*eye.y + f.z*eye.z);
    return r;
}

Mat4 Mat4::operator*(const Mat4& o) const {
    Mat4 r;
    for (int c = 0; c < 4; c++)
        for (int rr = 0; rr < 4; rr++) {
            r.m[c*4+rr] = 0;
            for (int k = 0; k < 4; k++)
                r.m[c*4+rr] += m[k*4+rr] * o.m[c*4+k];
        }
    return r;
}

void Camera::rotate(float dx, float dy) {
    phi += dx * 0.005f;
    theta = std::clamp(theta + dy * 0.005f, 0.1f, 3.04f);
}

void Camera::zoom(float delta) {
    distance = std::clamp(distance - delta * 20.0f, 50.0f, 2000.0f);
}

void Camera::reset() {
    distance = 400.0f;
    theta = 0.3f;
    phi = 0.8f;
    targetX = targetY = targetZ = 0.0f;
}

Vec3 Camera::getPosition() const {
    return {
        targetX + distance * std::sin(theta) * std::cos(phi),
        targetY + distance * std::cos(theta),
        targetZ + distance * std::sin(theta) * std::sin(phi)
    };
}

Mat4 Camera::getViewMatrix() const {
    Vec3 pos = getPosition();
    Vec3 target = {targetX, targetY, targetZ};
    Vec3 up = {0.0f, 1.0f, 0.0f};
    return Mat4::lookAt(pos, target, up);
}

Mat4 Camera::getProjectionMatrix(float aspect) const {
    return Mat4::perspective(0.785f, aspect, 1.0f, 5000.0f);
}

} // namespace ocern
