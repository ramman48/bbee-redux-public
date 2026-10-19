// the unlit mark materials (cel colour, light): as mark.vert, and an unlit material places its own vertices
VARYING vec3 vObjN;
VARYING vec2 vUV;
void MAIN()
{
    vObjN = NORMAL;
    vUV = UV0;
    POSITION = MODELVIEWPROJECTION_MATRIX * vec4(VERTEX, 1.0);
}
