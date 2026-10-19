import QtQuick
import QtQuick3D
import "../art/marks3d/marks.js" as Marks

// One of the Redux marks as the solid it was designed as (docs/promo/build/logo3d, built for the Terminal by
// art_build/build_marks.py): 100 units across, its face toward +Z, each part lit the way the approved render lit it.
// `power` takes it from dim (its part off) to lit; `surge` overdrives its light for the power-up; `sheen` and
// `sheenAt` sweep a band of light across it.
Node {
    id: root
    property string mark: "redux"
    property real power: 1
    property real surge: 0
    property real sheen: 0
    property real sheenAt: -1
    property bool glowPass: false     // draw only what blooms, white on black (MarkView's second view)
    readonly property var spec: Marks.marks[mark]
    readonly property string base: Qt.resolvedUrl("../art/marks3d/" + mark + "/")

    Repeater3D {
        model: root.spec ? root.spec.parts : []
        delegate: Model {
            id: part
            required property var modelData
            source: root.base + modelData.mesh
            visible: root.glowPass || !modelData.glowOnly
            materials: [root.glowPass ? mask : modelData.kind === "metal" ? metal : modelData.kind === "gloss" ? gloss : modelData.kind === "toon" ? toon : light]

            CustomMaterial {
                id: mask
                shadingMode: CustomMaterial.Unshaded
                vertexShader: "shaders3d/mark_flat.vert"
                fragmentShader: "shaders3d/mark_mask.frag"
                property real lit: part.modelData.glow ? 1 : 0
            }

            CustomMaterial {
                id: metal
                shadingMode: CustomMaterial.Shaded
                vertexShader: "shaders3d/mark.vert"
                fragmentShader: "shaders3d/mark_metal.frag"
                property TextureInput ramp: TextureInput {
                    texture: Texture { source: part.modelData.ramp ? root.base + part.modelData.ramp : ""; generateMipmaps: false; tilingModeHorizontal: Texture.ClampToEdge }
                }
                property color bevelColor: part.modelData.bevel || "#ffffff"
                property real metal: part.modelData.metal !== undefined ? part.modelData.metal : 1
                property real rough: part.modelData.rough || 0.3
                property real power: root.power
                property real sheen: root.sheen
                property real sheenAt: root.sheenAt
            }
            CustomMaterial {
                id: gloss
                shadingMode: CustomMaterial.Shaded
                vertexShader: "shaders3d/mark.vert"
                fragmentShader: "shaders3d/mark_gloss.frag"
                property color glossColor: part.modelData.color || "#000000"
                property color rimColor: part.modelData.rim || "#ffffff"
                property real hasRim: part.modelData.rim ? 1 : 0
                property real rough: part.modelData.rough || 0.2
                property real power: root.power
                property real sheen: root.sheen
                property real sheenAt: root.sheenAt
            }
            CustomMaterial {
                id: toon
                shadingMode: CustomMaterial.Unshaded
                vertexShader: "shaders3d/mark_flat.vert"
                fragmentShader: "shaders3d/mark_toon.frag"
                property TextureInput ramp: TextureInput {
                    texture: Texture { source: part.modelData.ramp ? root.base + part.modelData.ramp : ""; generateMipmaps: false; magFilter: Texture.Nearest; tilingModeHorizontal: Texture.ClampToEdge }
                }
                property color edgeColor: part.modelData.edge || "#ffffff"
                property real power: root.power
                property real sheen: root.sheen
                property real sheenAt: root.sheenAt
            }
            CustomMaterial {
                id: light
                shadingMode: CustomMaterial.Unshaded
                vertexShader: "shaders3d/mark_flat.vert"
                fragmentShader: "shaders3d/mark_emit.frag"
                property color lightColor: part.modelData.color || "#ffffff"
                property real strength: part.modelData.strength || 1
                property real power: root.power
                property real surge: root.surge
            }
        }
    }
}
