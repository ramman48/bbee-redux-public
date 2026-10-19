#version 440

// The window's finish: the picture, bent by a shock wave when one runs, with the bloom (a tight and a wide blur of
// the bright pass) added, a colour split growing toward the corners, a flash, a vignette and a fine moving grain.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 res;
    float bloom;
    float split;
    vec2 shockAt;       // 0..1
    float shockT;       // 0..1, 1 idle
    float shockPower;
    vec4 flashTone;
    float flash;
    float grain;
    float time;
};
layout(binding = 1) uniform sampler2D src;
layout(binding = 2) uniform sampler2D near;
layout(binding = 3) uniform sampler2D far;

float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main() {
    vec2 uv = qt_TexCoord0;
    vec2 aspect = vec2(res.x / res.y, 1.0);

    // the shock wave: a ring travelling out that pushes the picture outward across its width
    vec2 off = vec2(0.0);
    if (shockT < 1.0) {
        vec2 d = (uv - shockAt) * aspect;
        float r = length(d);
        float front = shockT * 1.25;
        float width = 0.07 + 0.05 * shockT;
        float x = (r - front) / width;
        float ring = exp(-x * x) * x;
        float fade = (1.0 - shockT) * (1.0 - shockT);
        off = (r > 1e-4 ? d / r : vec2(0.0)) / aspect * ring * 0.035 * shockPower * fade;
    }
    vec2 suv = uv - off;

    // colour split: none in the middle, a little at the corners, more while a beat runs
    vec2 c = (suv - 0.5);
    float edge = dot(c, c);
    float k = (0.0018 + split * 0.010) * edge * 4.0 + length(off) * 0.6;
    vec3 col;
    col.r = texture(src, suv + c * k).r;
    col.g = texture(src, suv).g;
    col.b = texture(src, suv - c * k).b;

    vec3 b = texture(near, suv).rgb * 0.9 + texture(far, suv).rgb * 1.1;
    col += b * bloom;

    // light caught in the shock ring itself
    if (shockT < 1.0) col += flashTone.rgb * length(off) * 9.0;
    col += flashTone.rgb * flash;

    float vig = smoothstep(1.25, 0.35, length(c * vec2(1.0, 1.15)) * 1.4);
    col *= mix(0.72, 1.0, vig);
    float n = hash(uv * res + fract(time * 13.0) * 97.0) - 0.5;
    col += n * grain;
    fragColor = vec4(col, 1.0) * qt_Opacity;
}
