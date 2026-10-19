import QtQuick

// A panel of dark glass behind a block of a page (shaders/glass.frag): hex weave, a lit top rim whose glint runs along it
// every few seconds, corner brackets. `reveal` builds it in from its top rim down.
ShaderEffect {
    id: root
    property real reveal: 1
    property color tone: Theme.cyan
    property real strength: 1
    property real shade: 1
    property real glintAt: -1
    property vector2d size: Qt.vector2d(width, height)
    property real px: Theme.unit * Theme.dpr
    property color tint: tone
    property real time: 0
    opacity: Math.min(1, reveal * 1.6)
    visible: reveal > 0.001
    transform: Scale { origin.y: 0; yScale: 0.92 + 0.08 * Math.min(1, root.reveal * 1.4) }
    SequentialAnimation on glintAt {
        loops: Animation.Infinite
        running: root.visible && !Theme.calm && Fx.full
        PauseAnimation { duration: 3200 + Math.random() * 2400 }
        NumberAnimation { from: -0.15; to: 1.15; duration: 1300; easing.type: Easing.InOutSine }
    }
    fragmentShader: "shaders/glass.frag.qsb"
}
