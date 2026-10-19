#version 440

// A hairline with packets of light running along it, each with a fading tail. Drawn along x; the item is a few
// pixels tall and the line sits in its middle. `grow` 0..1 draws the line out from the left; `rate` speeds it.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 size;           // in real pixels
    float time;
    float grow;
    float base;          // the line's own strength
    float packets;       // how many run at once (up to 6)
    float reverse;       // 1: half of them run the other way
    vec4 tone;
};

float hash(float x) { return fract(sin(x * 91.7) * 43758.5453); }

void main() {
    vec2 uv = qt_TexCoord0;
    float y = (uv.y - 0.5) * size.y;                       // pixels from the line's middle
    float core = exp(-y * y * 1.6);
    float halo = exp(-y * y * 0.12);
    float lit = 0.0;
    for (int i = 0; i < 6; i++) {
        if (float(i) >= packets) break;
        float fi = float(i);
        float speed = (0.05 + 0.07 * hash(fi + 1.0)) * (reverse > 0.5 && mod(fi, 2.0) > 0.5 ? -1.0 : 1.0);
        float pos = fract(hash(fi + 7.0) + time * speed);
        float tail = (60.0 + 140.0 * hash(fi + 3.0)) / size.x;
        float d = (uv.x - pos) * sign(speed);
        float w = d < 0.0 && d > -tail ? pow(1.0 + d / tail, 3.0) : 0.0;
        w += exp(-pow(d * size.x / 3.0, 2.0)) * 1.5;      // the head
        lit += w;
    }
    float drawn = step(uv.x, grow);
    float a = (core * (base + lit) + halo * lit * 0.35) * drawn;
    vec3 col = mix(tone.rgb, vec3(1.0), clamp(lit * core * 0.35, 0.0, 0.6));
    fragColor = vec4(col * a, a) * qt_Opacity;
}
