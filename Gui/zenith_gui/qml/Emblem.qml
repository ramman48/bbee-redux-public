import QtQuick
import QtQuick.Shapes

// The Terminal's own mark: a hexagon (the game's badge shape) holding a line that climbs to its highest
// point, with a small diamond above it. `draw` assembles it.
Item {
    id: root
    property real draw: 1
    property color tone: Theme.text
    property color accent: Theme.rose
    implicitWidth: 34; implicitHeight: 34

    readonly property real cx: width / 2
    readonly property real cy: height / 2
    readonly property real r: Math.min(width, height) / 2 - 1.5

    function hex(radius) {
        const pts = []
        for (let i = 0; i <= 6; ++i) {
            const angle = Math.PI / 180 * (60 * i - 90)
            pts.push(Qt.point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)))
        }
        return pts
    }

    Shape {
        anchors.fill: parent
        objectName: "inked"
        layer.enabled: true; layer.samples: 4; layer.smooth: true
        layer.textureSize: Theme.ink(width, height)
        opacity: root.draw
        rotation: (1 - root.draw) * -60
        ShapePath {
            strokeColor: root.tone
            strokeWidth: 1.5
            fillColor: "transparent"
            joinStyle: ShapePath.MiterJoin
            PathPolyline { path: root.hex(root.r) }
        }
    }
    Shape {
        anchors.fill: parent
        objectName: "inked"
        layer.enabled: true; layer.samples: 4; layer.smooth: true
        layer.textureSize: Theme.ink(width, height)
        opacity: Math.min(1, root.draw * 1.4)
        ShapePath {
            strokeColor: root.tone
            strokeWidth: 2
            fillColor: "transparent"
            joinStyle: ShapePath.MiterJoin
            capStyle: ShapePath.FlatCap
            startX: root.cx - root.r * 0.50 * root.draw
            startY: root.cy - root.r * 0.16 + root.r * 0.58 * root.draw
            PathLine { x: root.cx; y: root.cy - root.r * 0.16 }
            PathLine { x: root.cx + root.r * 0.50 * root.draw; y: root.cy - root.r * 0.16 + root.r * 0.58 * root.draw }
        }
    }
    Rectangle {
        id: apex
        width: Math.max(3, root.r * 0.20); height: width
        x: root.cx - width / 2
        y: root.cy - root.r * 0.56 - height / 2
        rotation: 45
        color: root.accent
        scale: root.draw
        opacity: root.draw * glow
        property real glow: 1
        SequentialAnimation on glow {
            loops: Animation.Infinite
            NumberAnimation { to: 0.55; duration: 1500; easing.type: Easing.InOutSine }
            NumberAnimation { to: 1; duration: 1500; easing.type: Easing.InOutSine }
        }
    }
}
