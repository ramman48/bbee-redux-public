#version 440

// The page change: a wave of hex cells crossing the page from the rail. Each cell lights its rim as the front
// reaches it, fills dark glass for a moment (the pages swap under it), shows a few code glyph flickers, and drains.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec2 res;           // layout units
    vec2 origin;        // where the wave starts, layout units
    float t;            // 0..1 through the change
    float cell;         // a cell's size, layout units
    vec4 tint;
    vec4 shade;         // the glass a cell fills with
};

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

// the hex cell a point is in: its centre, and the point's distance to the cell's rim (0 at the rim)
vec4 hexCell(vec2 p) {
    const vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(g);
    float d = 0.5 - max(dot(q, normalize(r)), q.x);
    return vec4(p - g, d, 0.0);
}

void main() {
    vec2 p = qt_TexCoord0 * res;
    vec4 hc = hexCell(p / cell);
    vec2 c = hc.xy * cell;
    float rim = hc.z;                                   // 0 at the rim .. 0.5 at the centre (cell units)
    float far = length(res);
    float d = length(c - origin) / far;                 // 0 near the rail .. ~1 at the far corner
    float jitter = hash(hc.xy) * 0.12;
    float start = d * 0.55 + jitter;
    float u = clamp((t - start) / 0.42, 0.0, 1.0);     // this cell's own 0..1
    if (u <= 0.0 || u >= 1.0) { fragColor = vec4(0.0); return; }
    float up = smoothstep(0.0, 0.18, u), down = 1.0 - smoothstep(0.45, 1.0, u);
    float on = up * down;
    float shrink = mix(0.5, 0.0, on);                   // the glass grows out from the centre, then back
    float glass = smoothstep(shrink - 0.02, shrink + 0.02, 0.5 - rim) * on;
    float edge = exp(-pow(rim * cell / 1.1, 2.0)) * on;
    float front = exp(-pow((u - 0.12) * 9.0, 2.0));    // the moment the wave hits: the rim flares
    float flick = step(0.82, hash(hc.xy + floor(t * 24.0))) * on * 0.5;
    vec3 col = shade.rgb * glass + tint.rgb * (edge * (0.55 + 1.6 * front) + flick * 0.25 + front * 0.18 * (1.0 - rim * 2.0));
    float a = clamp(glass * shade.a + edge * 0.9 + front * 0.2, 0.0, 1.0);
    fragColor = vec4(col, a) * qt_Opacity;
}
