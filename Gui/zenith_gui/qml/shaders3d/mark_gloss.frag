// Lacquer or obsidian: a dark dielectric with a clear coat, so only the chamfers catch the light; with a rim colour
// the chamfers are polished metal of that colour (EX's enamel rimmed in gold, Entropy's obsidian rimmed in violet).
VARYING vec3 vObjN;
VARYING vec2 vUV;

void MAIN()
{
    float nz = normalize(vObjN).z;
    bool face = abs(nz) > 0.97;           // the back is the face again, turned away (a spin shows it)
    float back = nz < -0.97 ? 0.45 : 1.0;
    bool rimmed = hasRim > 0.5 && !face;
    vec3 c = rimmed ? rimColor.rgb : glossColor.rgb;
    float band = exp(-pow((vUV.x + vUV.y * 0.6 - sheenAt) * 7.0, 2.0)) * sheen;
    BASE_COLOR = vec4(c * back * mix(0.25, 1.0, power), 1.0);
    METALNESS = rimmed ? 1.0 : 0.0;
    ROUGHNESS = rimmed ? 0.12 : rough;
    SPECULAR_AMOUNT = rimmed ? 1.0 : 0.25;
    EMISSIVE_COLOR = (rimmed ? rimColor.rgb : rimColor.rgb * 0.5) * band * 1.4;
}
