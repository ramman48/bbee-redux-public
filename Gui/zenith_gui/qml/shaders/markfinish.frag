#version 440

// The finish round a live 3D mark, as docs/promo/build/logo3d/post.py finishes the still render: keylines grown out of
// the mark's own silhouette (largest first), the light of its glowing parts leaking under it, the mark itself, then the
// bloom from its glow pass in the mark's accent; Cross Effect's halftone, Entropy's colour split and scan lines.
// `src` is the mark (premultiplied), `glow` its glowing parts alone (white on black). Lengths are in pixels.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 px;            // one pixel in texture coordinates
    vec4 k1; vec4 k2; vec4 k3;      // keyline colours, outermost first
    vec3 kr;            // their radii
    float kn;           // how many
    vec4 bloomA; vec4 bloomB;       // the bloom's colour from left to right
    vec3 br;            // bloom radii
    vec3 bg;            // and gains
    float core;
    vec4 under;         // under-glow colour (alpha 0: none)
    vec3 underP;        // blur, grow, gain
    vec4 tone;          // halftone: spacing, angle (radians), strength, on
    vec2 toneRange;     // from, to (fractions of the mark's height, down)
    vec4 toneInk;
    float split;        // colour split in pixels
    vec3 scan;          // gap, width, strength
    vec4 box;           // the mark's square in texture coordinates: x0, y0, x1, y1
    float power;        // 0: its part is off, 1: lit
    float flare;        // extra light (the power-up)
    float time;
};
layout(binding = 1) uniform sampler2D src;
layout(binding = 2) uniform sampler2D glow;

float alphaAt(vec2 uv) { return texture(src, uv).a; }

// the silhouette grown by r pixels: the most alpha within r, sampled on two rings (octagonal enough at these sizes)
float grown(vec2 uv, float r) {
    if (r <= 0.0) return alphaAt(uv);
    float m = alphaAt(uv);
    for (int i = 0; i < 16; i++) {
        float a = float(i) * 0.39269908;
        vec2 d = vec2(cos(a), sin(a)) * px;
        m = max(m, alphaAt(uv + d * r));
        m = max(m, alphaAt(uv + d * r * 0.55));
    }
    return m;
}

// the glow pass blurred to about r pixels
float glowBlur(vec2 uv, float r) {
    float s = texture(glow, uv).r * 0.2;
    float w = 0.2;
    for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5235988 + r;
        vec2 d = vec2(cos(a), sin(a)) * px;
        s += texture(glow, uv + d * r * 0.45).r * 0.1;
        s += texture(glow, uv + d * r).r * 0.05;
        w += 0.15;
    }
    return s / w;
}

vec4 over(vec4 top, vec4 under_) { return top + under_ * (1.0 - top.a); }

void main() {
    vec2 uv = qt_TexCoord0;
    vec4 col = vec4(0.0);

    // keylines, outermost first, each laid under what is already there
    vec4 ks[3] = vec4[3](k1, k2, k3);
    float rs[3] = float[3](kr.x, kr.y, kr.z);
    for (int i = 0; i < 3; i++) {
        if (float(i) >= kn) break;
        float m = grown(uv, rs[i]);
        col = over(vec4(ks[i].rgb * m, m), col);
    }

    // light from the glowing parts leaking onto the keylines, under the solid
    if (under.a > 0.0) {
        float g = clamp(glowBlur(uv, underP.x + underP.y) * underP.z * 2.0, 0.0, 1.0);
        col = over(vec4(under.rgb * g, g), col);
    }

    // the solid itself, with the colour split (Entropy) taken from the mark's own picture
    vec4 m = texture(src, uv);
    if (split > 0.0) {
        vec4 r = texture(src, uv + vec2(split, 0.0) * px);
        vec4 b = texture(src, uv - vec2(split, 0.0) * px);
        m = vec4(r.r, m.g, b.b, max(max(r.a, b.a), m.a));
    }
    // halftone dots growing down the mark (Cross Effect's comic press)
    if (tone.w > 0.5 && m.a > 0.5) {
        vec2 p = uv / px;
        float ca = cos(tone.y), sa = sin(tone.y);
        vec2 q = vec2(p.x * ca + p.y * sa, -p.x * sa + p.y * ca);
        vec2 cell = mod(q, tone.x) - tone.x * 0.5;
        float d = length(cell) / (tone.x * 0.5);
        float fy = (uv.y - box.y) / max(1e-4, box.w - box.y);
        float t = clamp((fy - toneRange.x) / max(1e-4, toneRange.y - toneRange.x), 0.0, 1.0);
        float dot_ = step(d, t * 1.05) * tone.z;
        m.rgb *= 1.0 - dot_ * (1.0 - toneInk.rgb);
    }
    // scan lines across the solid (Entropy)
    if (scan.z > 0.0) {
        float row = mod(uv.y / px.y, scan.x);
        m.rgb *= 1.0 - step(row, scan.y) * scan.z;
    }
    col = over(m, col);

    // the bloom: the glow pass at three radii in the accent, and its hot core
    if (bg.x + bg.y + bg.z > 0.0) {
        float g0 = texture(glow, uv).r;
        float tot = glowBlur(uv, br.x) * bg.x + glowBlur(uv, br.y) * bg.y + glowBlur(uv, br.z) * bg.z;
        float fx = (uv.x - box.x) / max(1e-4, box.z - box.x);
        vec3 accent = mix(bloomA.rgb, bloomB.rgb, clamp(fx, 0.0, 1.0));
        float k = mix(0.35, 1.0, power) * (1.0 + flare * 2.5);
        vec3 add = accent * tot * k * 1.6 + vec3(core * g0 * k);
        col.rgb += add;
        col.a = max(col.a, clamp(tot * k * 1.5, 0.0, 1.0));
    }
    fragColor = col * qt_Opacity;
}
