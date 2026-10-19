import QtQuick
import QtQuick3D
import "../art/marks3d/marks.js" as Marks

// A Redux mark, live: the solid in its own small 3D view (Mark3D), its glowing parts in a second one, and the finish of
// the approved still (keylines, under-glow, bloom, halftone, colour split, scan lines, glints) laid round it by
// shaders/markfinish.frag, so the finish follows the mark as it turns. The item is a square in the layout's units; the
// views are made at the screen's own resolution (`u` real pixels to a unit) so nothing is scaled up.
Item {
    id: root
    property string mark: "redux"
    property real power: 1            // 0: its part is off (dim, no bloom to speak of), 1: lit
    property real surge: 0            // its light overdriven (the power-up)
    property real flare: 0            // the bloom pushed out (the power-up)
    property real yaw: 0              // degrees
    property real pitch: 0
    property real roll: 0
    property real lift: 0             // units toward the viewer
    property real sheen: 0
    property real sheenAt: -1
    property real u: Theme.unit * Theme.dpr
    property real fill: 0.6           // how much of the square the mark's 100 units take
    property bool live: visible && opacity > 0
    readonly property var finish: Marks.marks[mark] ? Marks.marks[mark].finish : ({})
    readonly property real pxPerUnit: width * u * fill / 100       // real pixels to one mark unit

    function glint() { for (let i = 0; i < glints.count; i++) glints.itemAt(i).flash() }

    Item {
        id: px
        width: Math.max(1, Math.round(root.width * root.u)); height: Math.max(1, Math.round(root.height * root.u))
        scale: 1 / root.u; transformOrigin: Item.TopLeft
        enabled: false                   // pictures only: a press goes to whatever holds the mark

        // the camera sees `fill` of the square as 100 units at the mark's centre
        readonly property real fov: 16
        readonly property real dist: (50 / root.fill) / Math.tan(fov / 2 * Math.PI / 180)

        View3D {
            id: colorView
            anchors.fill: parent
            visible: root.live
            renderMode: View3D.Offscreen
            environment: SceneEnvironment {
                backgroundMode: SceneEnvironment.Transparent
                lightProbe: Texture { source: Qt.resolvedUrl("../art/marks3d/studio.hdr") }
                probeExposure: 1.0
                antialiasingMode: SceneEnvironment.MSAA; antialiasingQuality: SceneEnvironment.VeryHigh
                tonemapMode: SceneEnvironment.TonemapModeNone
            }
            PerspectiveCamera { id: cam; z: px.dist; fieldOfView: px.fov; clipNear: 10; clipFar: px.dist * 3 }
            Mark3D {
                id: solid
                mark: root.mark; power: root.power; surge: root.surge; sheen: root.sheen; sheenAt: root.sheenAt
                eulerRotation: Qt.vector3d(root.pitch, root.yaw, root.roll); z: root.lift
            }
        }
        View3D {
            id: glowView
            anchors.fill: parent
            visible: root.live
            renderMode: View3D.Offscreen
            environment: SceneEnvironment { backgroundMode: SceneEnvironment.Color; clearColor: "black"; antialiasingMode: SceneEnvironment.MSAA; antialiasingQuality: SceneEnvironment.Medium }
            PerspectiveCamera { z: px.dist; fieldOfView: px.fov; clipNear: 10; clipFar: px.dist * 3 }
            Mark3D {
                mark: root.mark; glowPass: true
                eulerRotation: Qt.vector3d(root.pitch, root.yaw, root.roll); z: root.lift
            }
        }
        ShaderEffectSource { id: colorTex; sourceItem: colorView; hideSource: true; live: root.live; visible: false }
        ShaderEffectSource { id: glowTex; sourceItem: glowView; hideSource: true; live: root.live; visible: false }

        ShaderEffect {
            anchors.fill: parent
            visible: root.live
            readonly property var f: root.finish
            readonly property var kl: f.keylines || []
            readonly property real k: root.pxPerUnit
            property var src: colorTex
            property var glow: glowTex
            property vector2d px: Qt.vector2d(1 / width, 1 / height)
            property color k1: kl.length > 0 ? kl[0][1] : "black"
            property color k2: kl.length > 1 ? kl[1][1] : "black"
            property color k3: kl.length > 2 ? kl[2][1] : "black"
            property vector3d kr: Qt.vector3d(kl.length > 0 ? kl[0][0] * k : 0, kl.length > 1 ? kl[1][0] * k : 0, kl.length > 2 ? kl[2][0] * k : 0)
            property real kn: kl.length
            property color bloomA: f.bloom ? f.bloom.color : "black"
            property color bloomB: f.bloom ? f.bloom.color2 : "black"
            property vector3d br: f.bloom ? Qt.vector3d(f.bloom.radii[0] * k, f.bloom.radii[1] * k, f.bloom.radii[2] * k) : Qt.vector3d(0, 0, 0)
            property vector3d bg: f.bloom ? Qt.vector3d(f.bloom.gains[0], f.bloom.gains[1], f.bloom.gains[2]) : Qt.vector3d(0, 0, 0)
            property real core: f.bloom ? f.bloom.core : 0
            property color under: f.under ? f.under.color : "transparent"
            property vector3d underP: f.under ? Qt.vector3d(f.under.blur * k, f.under.grow * k, f.under.gain) : Qt.vector3d(0, 0, 0)
            property vector4d tone: f.halftone ? Qt.vector4d(Math.max(2, f.halftone.spacing * k), f.halftone.angle * Math.PI / 180, f.halftone.strength, 1) : Qt.vector4d(1, 0, 0, 0)
            property vector2d toneRange: f.halftone ? Qt.vector2d(f.halftone.from, f.halftone.to) : Qt.vector2d(0, 1)
            property color toneInk: f.halftone ? f.halftone.ink : "black"
            property real split: f.split ? Math.max(1, f.split * k) : 0
            property vector3d scan: f.scan ? Qt.vector3d(Math.max(2, f.scan.gap * k), Math.max(1, f.scan.width * k), f.scan.op) : Qt.vector3d(1, 0, 0)
            property vector4d box: Qt.vector4d(0.5 - root.fill / 2, 0.5 - root.fill / 2, 0.5 + root.fill / 2, 0.5 + root.fill / 2)
            property real power: root.power
            property real flare: root.flare
            property real time: 0
            fragmentShader: "shaders/markfinish.frag.qsb"
        }
    }

    // glints on the corners that catch the key light, where the turned solid puts them now
    Repeater {
        id: glints
        model: root.finish.glints || []
        delegate: ShaderEffect {
            id: g
            required property var modelData
            property real size: modelData[2] * root.pxPerUnit / root.u * 2.2
            property real shine: 0
            // the glint's point turned with the solid (yaw, then pitch, then roll) and seen through the camera
            readonly property point at: {
                const r = Math.PI / 180, cy = Math.cos(root.yaw * r), sy = Math.sin(root.yaw * r)
                const cp = Math.cos(root.pitch * r), sp = Math.sin(root.pitch * r), cr = Math.cos(root.roll * r), sr = Math.sin(root.roll * r)
                let x = g.modelData[0], y = g.modelData[1], z = 4
                let t = x * cr - y * sr; y = x * sr + y * cr; x = t                     // roll about Z
                t = y * cp - z * sp; z = y * sp + z * cp; y = t                         // pitch about X
                t = x * cy + z * sy; z = -x * sy + z * cy; x = t                        // yaw about Y
                z += root.lift
                const f = (root.height / 2) / Math.tan(px.fov / 2 * r), d = px.dist - z
                return Qt.point(root.width / 2 + x * f / d, root.height / 2 - y * f / d)
            }
            function flash() { run.restart() }
            x: at.x - width / 2; y: at.y - height / 2
            width: size * (0.6 + 0.6 * shine); height: width
            visible: root.live && shine > 0.01
            property color tint: "white"
            property real turn: (g.modelData[3] + shine * 25) * Math.PI / 180
            property real thin: 0.035
            fragmentShader: "shaders/glint.frag.qsb"
            opacity: shine * (0.4 + 0.6 * root.power)
            SequentialAnimation {
                id: run
                NumberAnimation { target: g; property: "shine"; from: 0; to: 1; duration: 140; easing.type: Easing.OutCubic }
                NumberAnimation { target: g; property: "shine"; to: 0; duration: 620; easing.type: Easing.InCubic }
            }
        }
    }
}
