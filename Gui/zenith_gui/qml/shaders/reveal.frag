#version 440

// A picture arriving as a signal: torn into slices that jump sideways and split their colour, resolved from the top
// by a bright scan bar. `p` 0..1 is how far it has resolved; past the bar the slices settle; `flare` whitens it.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(binding = 1) uniform sampler2D src;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float p;
    float seed;
    float flare;
    vec4 tint;
};

float hash(float x) { return fract(sin(x * 127.1 + seed * 13.7) * 43758.5453); }

void main() {
    vec2 uv = qt_TexCoord0;
    float bar = p * 1.25 - 0.1;                          // the scan bar's height
    float behind = smoothstep(bar + 0.02, bar - 0.10, uv.y);   // 1 once the bar has passed
    float row = floor(uv.y * 38.0);
    float tear = (hash(row) - 0.5) * 0.22 * (1.0 - behind) * step(0.45, hash(row + 7.0));
    float split = 0.018 * (1.0 - behind) + 0.004;
    vec2 q = uv + vec2(tear, 0.0);
    float r = texture(src, q + vec2(split, 0.0)).r;
    vec4 g = texture(src, q);
    float b = texture(src, q - vec2(split, 0.0)).b;
    float a = max(g.a, max(texture(src, q + vec2(split, 0.0)).a, texture(src, q - vec2(split, 0.0)).a));
    vec3 col = vec3(r, g.g, b);
    // ahead of the bar only some slices show, as noise; behind it, all
    float show = mix(step(0.72, hash(row + floor(seed * 60.0))) * 0.6, 1.0, behind);
    float scan = exp(-pow((uv.y - bar) * 30.0, 2.0));
    col = mix(col, tint.rgb, (1.0 - behind) * 0.55) + tint.rgb * scan * 1.6 * a + mix(vec3(1.0), tint.rgb, 0.3) * flare * 0.7 * a;
    fragColor = vec4(col * a, a) * show * qt_Opacity + vec4(tint.rgb, 1.0) * scan * 0.35 * smoothstep(0.0, 0.2, p) * smoothstep(1.0, 0.8, p) * qt_Opacity * step(abs(uv.x - 0.5), 0.5);
}
