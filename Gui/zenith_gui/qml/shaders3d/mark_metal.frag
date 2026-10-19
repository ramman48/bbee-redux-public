// A face and its chamfer, as logo3d.py's chrome: the face takes its colour from a ramp up its own height (sky, a hard
// horizon, ground) and the chamfer is bright polished metal. `power` dims the whole solid when its part is off;
// `sheen` is a band of light that can be swept across it (0 when idle).
VARYING vec3 vObjN;
VARYING vec2 vUV;

vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

void MAIN()
{
    float nz = normalize(vObjN).z;
    bool face = abs(nz) > 0.97;           // the back is the face again, turned away (a spin shows it)
    float back = nz < -0.97 ? 0.45 : 1.0;
    vec3 c = face ? toLinear(texture(ramp, vec2(clamp(vUV.y, 0.002, 0.998), 0.5)).rgb) : bevelColor.rgb;
    float band = exp(-pow((vUV.x + vUV.y * 0.6 - sheenAt) * 7.0, 2.0)) * sheen;
    BASE_COLOR = vec4(c * back * mix(0.22, 1.0, power), 1.0);
    METALNESS = metal;
    ROUGHNESS = face ? rough : 0.14;
    EMISSIVE_COLOR = c * band * 1.6;
}
