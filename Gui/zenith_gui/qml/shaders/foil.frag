#version 440

// Holographic foil over a card's face, added on top of it (alpha 0: pure light). Thin diagonal bands of the room's
// colours slide with the pointer (`at`, 0..1 on the card) and a soft highlight sits where the pointer is. `power`
// is 0 at rest and 1 under the pointer.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 at;
    float power;
    float time;
    vec4 tone;
};

void main() {
    vec2 uv = qt_TexCoord0;
    float t = (uv.x * 0.7 + uv.y * 0.5) * 9.0 - at.x * 5.0 - at.y * 2.0 + time * 0.15;
    vec3 cyan = vec3(0.31, 0.86, 0.94), rose = vec3(1.0, 0.25, 0.42), gold = vec3(1.0, 0.76, 0.35);
    float w = fract(t / 6.2831);
    vec3 band = w < 0.33 ? mix(cyan, rose, w / 0.33) : (w < 0.66 ? mix(rose, gold, (w - 0.33) / 0.33) : mix(gold, cyan, (w - 0.66) / 0.34));
    float lines = pow(0.5 + 0.5 * sin(t * 3.0), 6.0);
    float spot = exp(-dot(uv - at, uv - at) * 9.0);
    vec3 col = band * (0.05 + 0.10 * lines) * (0.4 + 0.6 * spot) + mix(vec3(1.0), tone.rgb, 0.4) * spot * 0.16;
    // a little foil even at rest, all of it under the pointer
    fragColor = vec4(col * (0.12 + 0.88 * power), 0.0) * qt_Opacity;
}
