#version 440

// A cut-corner plate of lit glass (the big action, and outlined actions with `fill` low): a body in its colour, lighter
// at the top, a fine hex weave, a machined inner hairline, a bright rim with two packets of light running round it, a
// sheen crossing now and then, and an outer glow. `hover` surges it; `press` flashes it. Light past 1 feeds the bloom.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 size;          // the plate, layout units
    float pad;          // room round it for the glow, layout units
    float cut;          // the corners' cut
    float px;           // real pixels to a layout unit (edge softness)
    vec4 tone;
    float fill;         // 1: a solid plate; low: an outline with a tint
    float time;
    float hover;
    float press;
    float sheen;        // -0.4 .. 1.4 across the plate; outside that, no sheen
    float live;         // the running light on or off
};

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float plate(vec2 p) {          // < 0 inside, layout units
    vec2 q = p - size * 0.5;
    vec2 b = abs(q) - size * 0.5;
    float d = max(b.x, b.y);
    d = max(d, (cut - p.x - p.y) * 0.70710678);
    d = max(d, (cut - (size.x - p.x) - (size.y - p.y)) * 0.70710678);
    return d;
}

float hexLine(vec2 p) {
    const vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(g);
    return 0.5 - max(dot(q, normalize(r)), q.x);
}

void main() {
    vec2 full = size + 2.0 * pad;
    vec2 p = qt_TexCoord0 * full - pad;
    float d = plate(p);
    float aa = 0.75 / px;
    float inside = 1.0 - smoothstep(-aa, aa, d);
    vec3 t = tone.rgb;
    float surge = hover * 0.6 + press;

    // the body
    float v = p.y / size.y;
    vec3 body = mix(t * 1.0, t * 0.66, v);           // 0.83 of the tone behind the word: white on it reads at 4.5 to 1 or better
    float weave = 1.0 - smoothstep(0.0, 0.06, hexLine(p / 7.0));
    body += t * weave * 0.10 * (0.6 + surge);
    float sx = (p.x / size.x) - (1.0 - v) * 0.25;
    float sh = exp(-pow((sx - sheen) * 4.5, 2.0));
    body += vec3(1.0) * sh * 0.35;
    body *= 1.0 + surge * 0.06;                      // the pointer lights the rim and glow, not the body behind the word

    // the rim, the inner hairline, the light running round
    float rim = exp(-pow((d + 0.6) / 0.9, 2.0));
    float hair = exp(-pow((d + 4.0) / 0.55, 2.0)) * 0.35;
    float ang = atan(p.y - size.y * 0.5, (p.x - size.x * 0.5) * size.y / size.x) / 6.2831853 + 0.5;
    float run = 0.0;
    for (int i = 0; i < 2; i++) {
        float f = fract(ang - time * 0.22 - float(i) * 0.5);
        run += exp(-f * 18.0) * smoothstep(0.0, 0.02, f) + exp(-(1.0 - f) * 60.0) * 0.4;
    }
    run *= live;
    vec3 edge = mix(t, vec3(1.0), 0.55) * rim * (0.9 + 2.2 * run + 1.2 * surge) + vec3(1.0) * hair;

    // outside: a glow
    float glow = exp(-max(d, 0.0) / (4.0 + 4.0 * surge)) * (1.0 - inside) * (0.18 + 0.45 * surge + 0.25 * run * rim);
    vec3 col = (body * fill + t * 0.10 * (1.0 - fill) * (1.0 + 2.0 * surge)) * inside + edge * smoothstep(1.5, -0.5, d) + t * glow;
    col += vec3(1.0) * press * 0.6 * inside;
    float a = clamp(inside * mix(0.12 + 0.2 * surge, 1.0, fill) + rim + glow, 0.0, 1.0);
    fragColor = vec4(col, a) * qt_Opacity;
}
