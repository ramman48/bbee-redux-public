#version 440

// A panel of dark glass: a faint hex weave that brightens toward the top edge, a lit top rim with a glint that runs
// along it now and then, corner brackets, and a thin frame. It sits behind a block of a page's content.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 size;          // layout units
    float px;           // real pixels to a layout unit
    vec4 tint;
    float time;
    float glintAt;      // where the rim's glint is, 0..1 along the top (outside: none)
    float strength;     // the frame and weave, 0..1
    float shade;        // the glass's darkness, 0..1
};

float hexLine(vec2 p) {
    const vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(g);
    return 0.5 - max(dot(q, normalize(r)), q.x);
}

void main() {
    vec2 p = qt_TexCoord0 * size;
    float hpx = 1.0 / px;
    vec3 t = tint.rgb;
    float top = 1.0 - p.y / size.y;

    // the glass
    vec3 col = vec3(0.012, 0.018, 0.030) * shade;
    float a = 0.62 * shade;
    float weave = 1.0 - smoothstep(0.0, 0.05, hexLine(p / 9.0));
    col += t * weave * (0.015 + 0.05 * pow(top, 3.0)) * strength;
    a += weave * 0.04 * strength;

    // the frame: a hair all round, a lit rim along the top
    float edge = min(min(p.x, size.x - p.x), min(p.y, size.y - p.y));
    float hair = 1.0 - smoothstep(0.0, hpx * 1.2, edge);
    col += t * hair * 0.22 * strength; a += hair * 0.25 * strength;
    float rim = exp(-pow(p.y / (hpx * 1.4), 2.0)) * smoothstep(0.0, 40.0, p.x) * smoothstep(0.0, 40.0, size.x - p.x);
    float glint = exp(-pow((p.x / size.x - glintAt) * 9.0, 2.0));
    col += mix(t, vec3(1.0), 0.4) * rim * (0.5 + 2.2 * glint) * strength;
    a += rim * 0.6 * strength;
    col += t * exp(-p.y / 26.0) * 0.05 * strength * (1.0 + glint);

    // corner brackets
    float L = 14.0, W = hpx * 1.6;
    vec2 c = min(p, size - p);
    float br = 0.0;
    if (c.x < L && c.y < W * 2.0) br = 1.0 - smoothstep(W * 0.5, W * 1.5, c.y);
    if (c.y < L && c.x < W * 2.0) br = max(br, 1.0 - smoothstep(W * 0.5, W * 1.5, c.x));
    col += mix(t, vec3(1.0), 0.3) * br * 0.9 * strength; a += br * 0.8 * strength;

    fragColor = vec4(col, clamp(a, 0.0, 1.0)) * qt_Opacity;
}
