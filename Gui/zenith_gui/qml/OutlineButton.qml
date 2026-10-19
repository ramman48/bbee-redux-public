import QtQuick

// A second-rank action: a cut-corner outline of light (the big action's plate, unfilled) that fills and glows when the
// pointer is over it. `danger` is for the actions that take something away.
Item {
    id: root
    property string label: ""
    property color tone: Theme.line
    property bool danger: false
    signal clicked()
    readonly property bool tabStop: true
    activeFocusOnTab: true
    Keys.onReturnPressed: root.press()
    Keys.onEnterPressed: root.press()
    Keys.onSpacePressed: root.press()
    FocusMark {}

    implicitWidth: Math.max(128, word.implicitWidth + 44)
    implicitHeight: 38
    readonly property color ink: danger ? Theme.rose : tone
    readonly property real cut: 9
    property real glow: hover.hovered && enabled ? 1 : 0
    Behavior on glow { NumberAnimation { duration: Theme.fast; easing.type: Easing.OutCubic } }
    property real flash: 0
    function press() { flashRun.restart(); Sfx.play("press"); root.clicked() }
    NumberAnimation { id: flashRun; target: root; property: "flash"; from: 0.7; to: 0; duration: 360; easing.type: Easing.OutCubic }
    opacity: enabled ? 1 : 0.32
    scale: tap.pressed ? 0.972 : 1
    Behavior on scale { NumberAnimation { duration: Theme.fast; easing.type: Easing.OutCubic } }

    ShaderEffect {
        readonly property real padding: 10
        x: -padding; y: -padding; width: root.width + 2 * padding; height: root.height + 2 * padding
        property vector2d size: Qt.vector2d(root.width, root.height)
        property real pad: padding
        property real cut: root.cut
        property real px: Theme.unit * Theme.dpr
        property color tone: Qt.rgba(root.ink.r, root.ink.g, root.ink.b, 1)
        property real fill: 0.0
        property real time: 0
        property real hover: root.glow
        property real press: root.flash
        property real sheen: -2
        property real live: 0
        opacity: 0.55 + 0.45 * root.glow
        fragmentShader: "shaders/button.frag.qsb"
    }
    Text {
        id: word
        anchors.centerIn: parent
        text: root.label
        font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 1.8
        color: Qt.rgba(root.ink.r + (1 - root.ink.r) * root.glow, root.ink.g + (1 - root.ink.g) * root.glow,
                       root.ink.b + (1 - root.ink.b) * root.glow, 1)
    }
    HoverHandler { id: hover; cursorShape: Qt.PointingHandCursor; enabled: root.enabled; onHoveredChanged: if (hovered) Sfx.play("tick") }
    TapHandler { id: tap; enabled: root.enabled; onTapped: root.press() }
}
