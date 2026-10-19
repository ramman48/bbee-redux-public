// Cel colour (Cross Effect's comic press): flat light, a stepped ramp down the face, a flat edge colour on the chamfer.
VARYING vec3 vObjN;
VARYING vec2 vUV;

vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

void MAIN()
{
    float nz = normalize(vObjN).z;
    bool face = abs(nz) > 0.97;           // the back is the face again, turned away (a spin shows it)
    float back = nz < -0.97 ? 0.45 : 1.0;
    vec3 c = face ? toLinear(texture(ramp, vec2(clamp(vUV.y, 0.002, 0.998), 0.5)).rgb) : edgeColor.rgb;
    float band = exp(-pow((vUV.x + vUV.y * 0.6 - sheenAt) * 7.0, 2.0)) * sheen;
    FRAGCOLOR = vec4(c * back * mix(0.22, 1.0, power) + c * band * 0.9, 1.0);
}
