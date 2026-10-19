// the stage's floor pieces: u along the piece, v across it
VARYING vec2 vUV;
void MAIN()
{
    vUV = UV0;
    POSITION = MODELVIEWPROJECTION_MATRIX * vec4(VERTEX, 1.0);
}
