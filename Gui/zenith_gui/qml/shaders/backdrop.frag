#version 440

// The window's backdrop: a dark field with two slow lights, a faint fog, a dot lattice that thins out
// towards the list, one soft scan line and film grain. Kept quiet on purpose: the type, the rules and
// the mod's own art carry the screen, as the game's menus do.

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float time;
    float intro;
    vec2 res;
    vec4 glowA;
    vec4 glowB;
};

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 uv = qt_TexCoord0;
    vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0);

    vec3 col = mix(vec3(0.030, 0.040, 0.066), vec3(0.016, 0.021, 0.034), smoothstep(0.0, 1.0, uv.y));

    vec2 a = vec2(0.52 + 0.05 * sin(time * 0.11), -0.40 + 0.03 * cos(time * 0.09));
    vec2 b = vec2(-0.74 + 0.04 * cos(time * 0.07), 0.44 + 0.04 * sin(time * 0.13));
    float ga = exp(-dot(p - a, p - a) * 2.0);
    float gb = exp(-dot(p - b, p - b) * 3.2);
    col += glowA.rgb * ga * 0.17 * intro;
    col += glowB.rgb * gb * 0.085 * intro;

    float fog = noise(p * 1.8 + vec2(time * 0.020, -time * 0.014)) * 0.6
              + noise(p * 4.2 - vec2(time * 0.031, time * 0.008)) * 0.4;
    col += (glowA.rgb * 0.045 + vec3(0.012)) * fog * intro;

    vec2 cell = fract(uv * res / 26.0) - 0.5;
    float dots = smoothstep(0.075, 0.0, length(cell));
    float lattice = smoothstep(0.30, 0.95, uv.x) * smoothstep(1.0, 0.25, uv.y);
    col += vec3(0.60, 0.74, 0.88) * dots * lattice * 0.045 * intro;

    float sweep = fract(time * 0.07);
    float band = exp(-pow((uv.y - sweep) * 70.0, 2.0));
    col += glowA.rgb * band * 0.022 * intro;

    float vig = smoothstep(1.30, 0.30, length(p * vec2(0.82, 1.08)));
    col *= mix(0.50, 1.0, vig);
    col += (hash(uv * res + fract(time) * 91.7) - 0.5) * 0.014;

    fragColor = vec4(col, 1.0) * qt_Opacity;
}
