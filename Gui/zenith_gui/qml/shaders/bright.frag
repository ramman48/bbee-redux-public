#version 440

// The bright pass for the window's bloom: what is brighter than the threshold, softly kneed, and the saturated
// accents (cyan, rose, amber light) a little more than plain white text, so words do not halo.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float threshold;
    float knee;
};
layout(binding = 1) uniform sampler2D src;

void main() {
    vec4 c = texture(src, qt_TexCoord0);
    float peak = max(c.r, max(c.g, c.b));
    float lo = min(c.r, min(c.g, c.b));
    float sat = peak > 0.0 ? (peak - lo) / peak : 0.0;
    float t = threshold - sat * 0.22;
    float w = smoothstep(t - knee, t + knee, peak);
    fragColor = vec4(c.rgb * w * mix(0.55, 1.0, sat), 1.0);
}
