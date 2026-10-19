#version 440

// A hero's picture on the stage, lit as if it stood in the room's light:
//  - the veil: nothing left of `p0`, all of it right of `p1` (in the picture's own widths), so the words stay readable;
//  - a rim of the mod's own colour on the edges that face the light (behind, up and right);
//  - a sheen band that crosses the picture now and then (`sweep` -0.3..1.3);
//  - arriving and leaving (`fade` < 1) it comes apart as a signal: torn rows, a colour split, a scan of its colour.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(binding = 1) uniform sampler2D src;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float p0;
    float p1;
    float fade;
    float sweep;
    float rim;
    float seed;
    vec2 texel;          // one real pixel, in the picture's 0..1
    vec4 tone;
};

float hash(float x) { return fract(sin(x * 127.1 + seed * 13.7) * 43758.5453); }

void main() {
    vec2 uv = qt_TexCoord0;
    float off = 1.0 - fade;                                      // 0 settled .. 1 gone

    // coming apart: rows torn sideways, more of them the further it has gone
    float row = floor(uv.y * 64.0);
    float torn = step(1.0 - off * 0.9, hash(row + 3.0));
    vec2 q = uv + vec2((hash(row) - 0.5) * 0.16 * off * torn, 0.0);
    float split = (0.004 + 0.02 * off) * off;

    vec4 g = texture(src, q);
    float r = texture(src, q + vec2(split, 0.0)).r;
    float b = texture(src, q - vec2(split, 0.0)).b;
    float a = g.a;
    vec3 col = vec3(r, g.g, b) / max(a, 0.004);                 // the picture comes premultiplied

    // the rim: alpha here against alpha a few pixels toward the light
    vec2 toward = vec2(1.0, -1.25) * texel * 2.0;
    float edge = clamp(a - texture(src, q + toward).a, 0.0, 1.0);
    float lum = dot(col, vec3(0.3, 0.55, 0.15));
    vec3 lit = tone.rgb * edge * (0.35 + 0.4 * lum) * rim;

    // the sheen: a soft diagonal band
    float d = uv.x * 0.8 - uv.y * 0.45 - sweep;
    float sheen = exp(-d * d * 180.0) * 0.22 + exp(-d * d * 2400.0) * 0.18;

    col = col + lit + vec3(sheen) * mix(vec3(1.0), tone.rgb, 0.35);
    // leaving and arriving it reads as the mod's colour, in scan lines
    float lines = 0.75 + 0.25 * sin(uv.y / texel.y * 1.6);
    col = mix(col, tone.rgb * 1.3 * lines, clamp(off * 1.4, 0.0, 0.85));

    // the veil, in the picture's own widths
    float veil = clamp((uv.x - p0) / max(0.0001, p1 - p0), 0.0, 1.0);
    float keep = mix(1.0, step(off * 0.85, hash(row * 1.7 + 11.0)), clamp(off * 2.0, 0.0, 1.0));
    float alpha = a * veil * keep * clamp(fade * 1.6, 0.0, 1.0);
    fragColor = vec4(col * alpha, alpha) * qt_Opacity;
}
