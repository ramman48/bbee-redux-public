// A projector's glass plate on the floor: dark glass with a fine hex lattice, lit from its rim inward, a slow scan
// passing over it. Added to what is behind it.
VARYING vec2 vUV;

float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
}

void MAIN()
{
    vec2 p = (vUV - 0.5) * 2.0;
    float r = length(p);
    // the lattice
    vec2 q = p * cells;
    vec2 a = mod(q, vec2(1.0, 1.7320508)) - vec2(0.5, 0.8660254);
    vec2 b = mod(q - vec2(0.5, 0.8660254), vec2(1.0, 1.7320508)) - vec2(0.5, 0.8660254);
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    float line = smoothstep(0.42, 0.5, hexDist(g));
    float rim = smoothstep(0.55, 1.0, r);
    float scan = exp(-pow((r - fract(time * 0.35) * 1.2) * 9.0, 2.0));
    float k = intensity * (0.10 + line * 0.35 * (0.3 + rim) + rim * 0.25 + scan * 0.6) * smoothstep(1.02, 0.9, r);
    FRAGCOLOR = vec4(tint.rgb * k, 1.0);
}
