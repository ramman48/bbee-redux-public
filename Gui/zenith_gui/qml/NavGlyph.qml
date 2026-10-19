import QtQuick
import QtQuick.Shapes

// The signs on the left column, drawn on a 24-unit grid in the same thin angular line as the rest
// of the window: a house, book spines, sliders, a written sheet, a faceted heart, for a Redux set a hexagon with a bolt,
// and for the roadmap a stepped road with three stops.
Item {
    id: root
    property string kind: "home"
    property color tone: Theme.dim
    property real stroke: 1.5
    implicitWidth: 24; implicitHeight: 24

    readonly property var paths: ({
        "home": "M 3 11.5 L 12 3.5 L 21 11.5 M 5.5 10 L 5.5 20.5 L 18.5 20.5 L 18.5 10 M 10 20.5 L 10 14.5 L 14 14.5 L 14 20.5",
        "library": "M 4 4 L 8.5 4 L 8.5 20 L 4 20 Z M 10.5 4 L 15 4 L 15 20 L 10.5 20 Z M 16.7 6.7 L 19.6 5.7 L 22.3 19.3 L 19.4 20.3 Z",
        "options": "M 3 6 L 12 6 M 17 6 L 21 6 M 12.5 4 L 16.5 4 L 16.5 8 L 12.5 8 Z M 3 12 L 6 12 M 11 12 L 21 12 M 6.5 10 L 10.5 10 L 10.5 14 L 6.5 14 Z M 3 18 L 14 18 M 19 18 L 21 18 M 14.5 16 L 18.5 16 L 18.5 20 L 14.5 20 Z",
        "log": "M 5 3.5 L 15 3.5 L 19 7.5 L 19 20.5 L 5 20.5 Z M 15 3.5 L 15 7.5 L 19 7.5 M 8 11.5 L 16 11.5 M 8 14.5 L 16 14.5 M 8 17.5 L 12.5 17.5",
        "support": "M 12 20.5 L 3 11.5 L 3 7 L 6.5 3.8 L 9.5 3.8 L 12 6.6 L 14.5 3.8 L 17.5 3.8 L 21 7 L 21 11.5 Z",
        "roadmap": "M 4 19 L 4 15 L 12 15 L 12 10 L 20 10 L 20 5.5 M 2 19 L 6 19 L 6 22 L 2 22 Z M 10 13.5 L 14 13.5 L 14 16.5 L 10 16.5 Z M 18 2.5 L 22 2.5 L 22 5.5 L 18 5.5 Z",
        "redux": "M 12 2.5 L 20.5 7.25 L 20.5 16.75 L 12 21.5 L 3.5 16.75 L 3.5 7.25 Z M 13.2 6.2 L 8.6 12.6 L 11.8 12.6 L 10.8 17.8 L 15.4 11.2 L 12.2 11.2 Z"
    })

    Shape {
        anchors.fill: parent
        objectName: "inked"
        layer.enabled: true; layer.samples: 4; layer.smooth: true
        layer.textureSize: Theme.ink(width, height)
        ShapePath {
            strokeColor: root.tone
            strokeWidth: root.stroke
            fillColor: "transparent"
            joinStyle: ShapePath.MiterJoin
            capStyle: ShapePath.FlatCap
            scale: Qt.size(root.width / 24, root.height / 24)
            PathSvg { path: root.paths[root.kind] || "" }
        }
    }
}
