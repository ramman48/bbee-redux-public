#version 440

// The light a projector throws up to its mark: wide at the plate, narrowing upward, made of fine rising lines and a
// slow flicker, brightest at its edges and its foot.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 tint;
    float time;
    float strength;
    float narrow;       // its width at the top as a share of the foot's
};

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

void main() {
    vec2 uv = qt_TexCoord0;              // y 0 at the top, 1 at the foot
    float w = mix(narrow, 1.0, uv.y);
    float x = (uv.x - 0.5) / (0.5 * w);
    if (abs(x) > 1.0) { fragColor = vec4(0.0); return; }
    float edge = pow(abs(x), 6.0) * 0.8 + 0.25 * (1.0 - abs(x));
    float lines = 0.6 + 0.4 * step(0.5, fract(uv.y * 90.0 - time * 1.6));
    float streak = 0.5 + 0.5 * sin(x * 18.0 + hash(vec2(floor(x * 9.0), 1.0)) * 6.0 + time * 0.8);
    float v = pow(uv.y, 1.6);
    float k = strength * (edge + streak * 0.12) * lines * v * smoothstep(1.0, 0.96, abs(x));
    fragColor = vec4(tint.rgb * k, k * 0.6) * qt_Opacity;
}
