// the glow pass: the parts that bloom in white, everything else black (still hiding what is behind it)
VARYING vec3 vObjN;
VARYING vec2 vUV;
void MAIN()
{
    FRAGCOLOR = vec4(vec3(lit), 1.0);
}
