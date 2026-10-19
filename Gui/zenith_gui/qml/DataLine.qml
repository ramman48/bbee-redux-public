import QtQuick

// A hairline that carries light: packets with fading tails run along it (shaders/dataline.frag). Lay it along x;
// turn it with `rotation` for a vertical one. The item is a few units tall and the line is drawn in its middle.
ShaderEffect {
    id: root
    property real grow: 1
    property real base: 0.22
    property real packets: 3
    property real reverse: 0
    property real rate: 1
    property color tone: Theme.cyan
    property real time: 0
    property vector2d size: Qt.vector2d(width * Theme.unit * Theme.dpr, height * Theme.unit * Theme.dpr)
    height: 9
    visible: grow > 0.001 && opacity > 0.001
    NumberAnimation on time {
        from: 0; to: 1000; duration: 1000000 / Math.max(0.05, root.rate); loops: Animation.Infinite
        running: root.visible && !Theme.calm && Fx.full
    }
    fragmentShader: "shaders/dataline.frag.qsb"
}
