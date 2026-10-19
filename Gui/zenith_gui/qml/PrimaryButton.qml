import QtQuick

// The one big action. A cut-corner plate of lit glass in the accent colour (shaders/button.frag): light runs round its
// rim, a sheen crosses it now and then, the pointer makes it surge and a press flashes it.
Item {
    id: root
    property string label: qsTr("INSTALL")
    property color tone: Theme.rose
    property bool lively: true
    property bool compact: false
    signal clicked()
    readonly property bool tabStop: true
    activeFocusOnTab: true
    Keys.onReturnPressed: root.press()
    Keys.onEnterPressed: root.press()
    Keys.onSpacePressed: root.press()
    FocusMark {}

    implicitWidth: 312; implicitHeight: 58
    readonly property real cut: compact ? 11 : 15
    opacity: enabled ? 1 : 0.4
    property real sheen: -0.4
    property real hot: hover.hovered && enabled ? 1 : 0
    Behavior on hot { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
    property real flash: 0
    function press() { flashRun.restart(); Sfx.play("press"); root.clicked() }
    scale: !enabled ? 1 : (tap.pressed ? 0.972 : (hover.hovered ? 1.018 : 1))
    Behavior on scale { NumberAnimation { duration: Theme.fast; easing.type: Easing.OutCubic } }

    SequentialAnimation on sheen {
        loops: Animation.Infinite
        running: root.lively && root.enabled && !Theme.calm
        PauseAnimation { duration: 2400 }
        NumberAnimation { from: -0.4; to: 1.4; duration: 1000; easing.type: Easing.InOutCubic }
    }
    SequentialAnimation {
        id: flashRun
        NumberAnimation { target: root; property: "flash"; from: 1; to: 0; duration: 420; easing.type: Easing.OutCubic }
    }
    property real time: 0
    NumberAnimation on time { from: 0; to: 100000; duration: 100000000; loops: Animation.Infinite; running: root.visible && root.lively && Fx.full }

    ShaderEffect {
        readonly property real padding: 14
        x: -padding; y: -padding; width: root.width + 2 * padding; height: root.height + 2 * padding
        property vector2d size: Qt.vector2d(root.width, root.height)
        property real pad: padding
        property real cut: root.cut
        property real px: Theme.unit * Theme.dpr
        property color tone: root.tone
        property real fill: 1
        property real time: root.time
        property real hover: root.hot
        property real press: root.flash
        property real sheen: root.sheen
        property real live: root.lively && root.enabled ? 1 : 0
        fragmentShader: "shaders/button.frag.qsb"
    }
    Text {
        anchors.centerIn: parent
        text: root.label
        font.family: Theme.display
        font.pixelSize: root.compact ? 13 : 17
        font.letterSpacing: (root.compact ? 2 : 2.6) + root.hot * 0.8
        color: "#ffffff"
        style: Text.Raised; styleColor: Qt.rgba(0, 0, 0, 0.25)
    }
    HoverHandler { id: hover; cursorShape: Qt.PointingHandCursor; enabled: root.enabled; onHoveredChanged: if (hovered) Sfx.play("hover") }
    TapHandler { id: tap; enabled: root.enabled; onTapped: root.press() }
}
