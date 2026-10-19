// every mark material: the solid's own normal (a face looks along +Z, a chamfer does not) and its texture space
VARYING vec3 vObjN;
VARYING vec2 vUV;
void MAIN()
{
    vObjN = NORMAL;
    vUV = UV0;
}
