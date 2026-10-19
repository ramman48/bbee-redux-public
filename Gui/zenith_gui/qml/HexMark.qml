import QtQuick
import QtQuick.Shapes

// The hexagon badge of the game's HUD: an outline, and a core that fills when the thing is on.
Item {
    id: root
    property real fill: 0
    property color tone: Theme.cyan
    property color outline: Theme.line
    property real stroke: 1.4
    implicitWidth: 22; implicitHeight: 22

    function ring(radius) {
        const pts = []
        for (let i = 0; i <= 6; ++i) {
            const angle = Math.PI / 180 * (60 * i - 90)
            pts.push(Qt.point(width / 2 + radius * Math.cos(angle), height / 2 + radius * Math.sin(angle)))
        }
        return pts
    }

    Shape {
        anchors.fill: parent
        objectName: "inked"
        layer.enabled: true; layer.samples: 4; layer.smooth: true
        layer.textureSize: Theme.ink(width, height)
        ShapePath {
            strokeColor: root.outline
            strokeWidth: root.stroke
            fillColor: "transparent"
            joinStyle: ShapePath.MiterJoin
            PathPolyline { path: root.ring(Math.min(root.width, root.height) / 2 - root.stroke) }
        }
        ShapePath {
            strokeColor: "transparent"
            fillColor: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, Math.min(1, root.fill))
            PathPolyline { path: root.ring((Math.min(root.width, root.height) / 2 - root.stroke) * 0.56 * Math.max(0.001, root.fill)) }
        }
    }
}
