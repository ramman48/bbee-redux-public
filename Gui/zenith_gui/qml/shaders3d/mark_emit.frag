// Light: the Redux seam, EX's corona, Entropy's neon, the Tactics core. Bright enough to bloom; `power` takes it down
// to an ember when the part is off, and `surge` lifts it past white for the power-up.
VARYING vec3 vObjN;
VARYING vec2 vUV;

void MAIN()
{
    float k = strength * mix(0.12, 1.0, power) * (1.0 + surge * 3.0);
    FRAGCOLOR = vec4(lightColor.rgb * k * 2.2, 1.0);
}
