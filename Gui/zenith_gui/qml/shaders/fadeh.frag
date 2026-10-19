#version 440

// A layer faded in across its width: none of it left of `from`, all of it right of `to` (0..1 of the width), and
// thinned toward the top and bottom edges by `edge`.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(binding = 1) uniform sampler2D source;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float from;
    float to;
    float edge;
};

void main() {
    vec2 uv = qt_TexCoord0;
    float k = smoothstep(from, to, uv.x);
    float v = edge > 0.0 ? smoothstep(0.0, edge, uv.y) * smoothstep(1.0, 1.0 - edge, uv.y) : 1.0;
    fragColor = texture(source, uv) * k * v * qt_Opacity;
}
