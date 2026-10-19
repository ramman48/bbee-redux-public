#version 440

// The room behind every page. A dark hall: a grid floor running to a horizon that glows cyan and rose, a haze that
// drifts, light falling from above, and thin columns of data glyphs at three depths that move with the pointer.
// Kept below the words: the floor fades out under the bar at the foot, the glyphs stay faint.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float time;
    float intro;
    vec2 res;
    vec4 glowA;         // cyan
    vec4 glowB;         // rose
    vec2 pointer;       // 0..1
    float horizon;      // the horizon's height, 0 top .. 1 bottom
    float rain;         // how much data rain
    float heat;         // 0..1 the rose's share (a page can warm the room: Redux powered)
};
layout(binding = 1) uniform sampler2D glyphs;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += noise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }

// one layer of data rain: columns `cell` pixels wide, a few of them running, each a bright head and a fading trail
float rainLayer(vec2 frag, float cell, float speed, float density, vec2 shift) {
    vec2 p = (frag + shift) / cell;
    float col = floor(p.x);
    float seed = hash1(col * 1.37 + cell);
    if (seed > density) return 0.0;
    float spd = speed * (0.6 + 0.8 * hash1(col * 3.1 + 2.0));
    float len = 8.0 + 18.0 * hash1(col * 5.7);
    float head = fract(time * spd / 40.0 + seed * 9.0) * (res.y / cell + len * 2.0) - len;
    float row = floor(p.y);
    float behind = head - row;
    if (behind < 0.0 || behind > len) return 0.0;
    float trail = pow(1.0 - behind / len, 2.2);
    // the glyph in this cell, changing now and then
    float pick = floor(hash(vec2(col, row)) * 128.0 + floor(time * (2.0 + 6.0 * hash1(col))) * 37.0);
    pick = mod(pick, 128.0);
    vec2 g = vec2(mod(pick, 16.0), floor(pick / 16.0));
    vec2 inCell = fract(p);
    float a = texture(glyphs, (g + inCell) / vec2(16.0, 8.0)).a;
    float lead = behind < 1.0 ? 1.8 : 1.0;
    return a * trail * lead;
}

void main() {
    vec2 uv = qt_TexCoord0;
    vec2 frag = uv * res;
    float aspect = res.x / res.y;
    vec2 par = (pointer - 0.5);
    vec3 tint = mix(glowA.rgb, glowB.rgb, heat);
    vec3 other = mix(glowB.rgb, glowA.rgb, heat * 0.6);

    // the hall: deep blue-black, a touch lighter toward the horizon
    float h = horizon + par.y * 0.012;
    vec3 col = mix(vec3(0.020, 0.028, 0.050), vec3(0.010, 0.014, 0.026), smoothstep(h, 1.0, uv.y));
    col += tint * 0.05 * exp(-abs(uv.y - h) * 7.0) * intro;

    // light falling from above, slow and broken by the haze
    float beams = 0.0;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float cx = 0.32 + fi * 0.27 + 0.03 * sin(time * 0.05 + fi * 2.0) - par.x * 0.03 * (fi + 1.0);
        float w = 0.05 + 0.03 * fi;
        float d = abs((uv.x - cx) - (uv.y - 0.0) * 0.18 * (fi - 1.0));
        beams += exp(-d * d / (w * w)) * smoothstep(h + 0.05, -0.1, uv.y) * (0.5 + 0.5 * noise(vec2(fi * 4.0, time * 0.07)));
    }
    col += mix(tint, vec3(0.75, 0.85, 1.0), 0.4) * beams * 0.022 * intro;

    // the floor: a grid in perspective, running toward the viewer, fading at the horizon and under the foot bar
    if (uv.y > h) {
        float y = uv.y - h;
        float z = 0.18 / max(y, 1e-4);
        float x = (uv.x - 0.5 + par.x * 0.04) * aspect * z;
        vec2 gp = vec2(x * 1.6, z + time * 0.35);
        vec2 gw = fwidth(gp);
        vec2 line = abs(fract(gp - 0.5) - 0.5) / max(gw, vec2(1e-4));
        float grid = 1.0 - min(min(line.x, line.y), 1.0);
        float big = 1.0 - min(abs(fract(gp.y / 6.0 - 0.5) - 0.5) / max(gw.y / 6.0, 1e-4), 1.0);
        float near = smoothstep(0.0, 0.08, y);
        float far = exp(-z * 0.06);
        float under = smoothstep(1.02, 0.80, uv.y);
        float lit = (grid * 0.55 + big * 0.6) * near * far * under;
        // a pulse running down the floor now and then
        float pulse = exp(-pow((fract(time * 0.06) * 30.0 - z) * 0.9, 2.0));
        col += tint * lit * (0.10 + 0.25 * pulse) * intro;
        col += other * big * near * far * under * 0.04 * intro;
        // the floor catches the horizon's light
        col += tint * 0.05 * exp(-y * 12.0) * intro;
    }
    // the horizon line itself
    float hl = exp(-pow((uv.y - h) * res.y / 1.6, 2.0)) * (0.5 + 0.5 * smoothstep(0.9, 0.1, abs(uv.x - 0.55) * 1.6));
    col += mix(tint, vec3(1.0), 0.35) * hl * 0.30 * intro;

    // haze drifting through the hall
    float fog = fbm(vec2(uv.x * aspect * 1.4 + time * 0.012 - par.x * 0.1, uv.y * 2.2 - time * 0.006));
    col += (tint * 0.06 + other * 0.025) * fog * smoothstep(0.0, 0.6, 1.0 - abs(uv.y - h) * 1.4) * intro;

    // data rain at three depths, faint, stronger away from the left column
    if (rain > 0.0) {
        float side = smoothstep(0.05, 0.45, uv.x);
        float r = rainLayer(frag, 11.0, 7.0, 0.16, par * 12.0) * 0.30
                + rainLayer(frag, 15.0, 9.0, 0.11, par * 26.0) * 0.55
                + rainLayer(frag, 22.0, 12.0, 0.06, par * 48.0) * 0.8;
        float fadeV = smoothstep(0.0, 0.25, uv.y) * smoothstep(h + 0.12, h - 0.1, uv.y);
        col += mix(tint, vec3(0.8, 1.0, 1.0), 0.25) * r * 0.10 * rain * side * fadeV * intro;
    }

    float vig = smoothstep(1.35, 0.25, length((uv - vec2(0.55, 0.5)) * vec2(aspect * 0.62, 1.05)));
    col *= mix(0.55, 1.0, vig);
    float n = hash(frag + fract(time) * 61.0) - 0.5;
    col += n * 0.006;
    fragColor = vec4(col, 1.0) * qt_Opacity;
}
