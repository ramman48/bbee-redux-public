#version 440

// A four-point glint as post.py draws them: two crossed streaks, two shorter diagonal ones and a hot core.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 tint;
    float turn;         // radians
    float thin;
};

void main() {
    vec2 p = (qt_TexCoord0 - 0.5) * 2.0;           // -1..1, the streaks reach the edges
    float c = cos(turn), s = sin(turn);
    vec2 q = vec2(p.x * c + p.y * s, -p.x * s + p.y * c);
    float L = 0.62, T = L * thin;
    float st = exp(-pow(q.x / L, 2.0) * 3.0 - pow(q.y / T, 2.0)) + exp(-pow(q.y / L, 2.0) * 3.0 - pow(q.x / T, 2.0));
    vec2 d = vec2(q.x + q.y, q.x - q.y) * 0.7071;
    st += 0.5 * (exp(-pow(d.x / (L * 0.45), 2.0) - pow(d.y / (T * 0.8), 2.0)) + exp(-pow(d.y / (L * 0.45), 2.0) - pow(d.x / (T * 0.8), 2.0)));
    float r2 = dot(p, p);
    st += 1.2 * exp(-r2 / pow(L * 0.07, 2.0)) + 0.35 * exp(-r2 / pow(L * 0.25, 2.0));
    st *= smoothstep(1.0, 0.8, length(p));
    float a = clamp(st, 0.0, 1.0);
    fragColor = vec4(tint.rgb * st, a) * qt_Opacity;
}
