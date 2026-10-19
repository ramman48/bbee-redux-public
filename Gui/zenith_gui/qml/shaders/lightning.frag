#version 440

// Lightning off the Redux core (the stand-in drawn strokes, replaced). Each bolt runs from the core toward a point,
// jagged by layered noise that is re-rolled several times a second, thickest in the middle, with forks; a white-hot
// core inside a rose body inside a wide halo. Brightness goes past 1 so the window's bloom takes it.
// Up to four bolts to the parts and two loose arcs round the core; each has its own strength (0: none).
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 res;           // pixels
    vec2 core;          // pixels
    vec4 a01;           // ends of bolts 0 and 1 (x, y, x, y)
    vec4 a23;           // ends of bolts 2 and 3
    vec4 a45;           // ends of the two arcs
    vec4 k0123;         // strengths of bolts 0..3
    vec2 k45;           // and of the arcs
    float seed;         // changes when the bolts re-strike
    float px;           // pixels per layout unit
    vec4 hot;           // the body's colour
};

float hash1(float n) { return fract(sin(n) * 43758.5453123); }
float noise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash1(i), hash1(i + 1.0), f) * 2.0 - 1.0; }
float fbm1(float x) { return noise1(x) * 0.55 + noise1(x * 2.3 + 11.0) * 0.28 + noise1(x * 5.1 + 23.0) * 0.17; }

// the light of one bolt from a to b at this pixel: x = core, y = body, z = halo
vec3 bolt(vec2 p, vec2 a, vec2 b, float s, float k) {
    if (k <= 0.0) return vec3(0.0);
    vec2 ab = b - a;
    float len = length(ab);
    if (len < 1.0) return vec3(0.0);
    vec2 dir = ab / len, nrm = vec2(-dir.y, dir.x);
    vec2 ap = p - a;
    float t = dot(ap, dir) / len;
    if (t < -0.05 || t > 1.05) return vec3(0.0);
    float tc = clamp(t, 0.0, 1.0);
    float env = sin(3.14159 * tc);
    float amp = len * 0.11;
    float off = fbm1(tc * 7.0 + s * 13.1) * amp * env;
    float d = abs(dot(ap, nrm) - off);
    // a fork leaving from a third of the way, wandering off
    float tf = clamp((t - 0.3) / 0.45, 0.0, 1.0);
    float offF = off + (fbm1(tf * 5.0 + s * 7.7 + 3.0) * 0.7 + 0.5 * sign(hash1(s) - 0.5)) * amp * 1.4 * tf;
    float dF = t > 0.3 && t < 0.75 ? abs(dot(ap, nrm) - offF) : 1e4;
    float fadeF = (1.0 - tf);
    float w = px;
    float ends = smoothstep(-0.05, 0.04, t) * smoothstep(1.05, 0.96, t);
    float flick = 0.75 + 0.25 * hash1(s * 3.3 + 1.0);
    vec3 l;
    l.x = exp(-pow(d / (0.9 * w), 2.0)) + exp(-pow(dF / (0.6 * w), 2.0)) * fadeF * 0.7;
    l.y = exp(-pow(d / (2.6 * w), 2.0)) + exp(-pow(dF / (1.8 * w), 2.0)) * fadeF * 0.6;
    l.z = exp(-d / (14.0 * w)) * 0.5 + exp(-dF / (10.0 * w)) * fadeF * 0.2;
    return l * k * ends * flick;
}

void main() {
    vec2 p = qt_TexCoord0 * res;
    vec3 l = vec3(0.0);
    l += bolt(p, core, a01.xy, seed + 1.0, k0123.x);
    l += bolt(p, core, a01.zw, seed + 2.0, k0123.y);
    l += bolt(p, core, a23.xy, seed + 3.0, k0123.z);
    l += bolt(p, core, a23.zw, seed + 4.0, k0123.w);
    l += bolt(p, a45.xy, a45.zw, seed + 5.0, k45.x) * 0.8;
    l += bolt(p, a45.zw, a45.xy, seed + 6.0, k45.y) * 0.8;
    vec3 col = vec3(1.0, 0.93, 0.95) * l.x * 1.6 + hot.rgb * l.y * 1.3 + hot.rgb * l.z * 0.6;
    float a = clamp(max(max(l.x, l.y), l.z * 0.8), 0.0, 1.0);
    fragColor = vec4(col, a) * qt_Opacity;
}
