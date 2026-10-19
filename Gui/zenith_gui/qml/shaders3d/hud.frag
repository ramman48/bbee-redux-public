// Light laid on the stage's floor, added to what is behind it. Soft across its width; a steady glow (`base`); pulses
// running along it (`flow`, `count` of them, at `speed`) as data heading for the core; a bright sweep travelling round a
// ring (`sweep` at `sweepAt`); `dash` breaks it into dashes that crawl (a part that is off).
VARYING vec2 vUV;

void MAIN()
{
    float u = vUV.x, v = vUV.y;
    float edge = smoothstep(0.0, soft, v) * smoothstep(1.0, 1.0 - soft, v);
    float f = fract(u * count - time * speed);
    float pulse = pow(1.0 - f, 10.0) * flow + pow(1.0 - f, 2.5) * flow * 0.25;
    float s = abs(fract(u - sweepAt + 0.5) - 0.5);
    float sw = exp(-pow(s * sweepWidth, 2.0)) * sweep;
    float d = dash > 0.0 ? step(0.5, fract(u * dash - time * 0.15)) : 1.0;
    // `reach`: how far along the light has got (a conduit filling toward the core), with a hot head where it is
    float lit = step(u, reach);
    float head = exp(-pow((u - reach) * 40.0, 2.0)) * step(reach, 0.999) * step(0.001, reach);
    float k = intensity * ((base * d + pulse * 2.4 + sw * 2.0) * lit + head * 3.0) * edge;
    FRAGCOLOR = vec4(tint.rgb * k, 1.0);
}
