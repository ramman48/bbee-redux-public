import QtQuick

// A quiet action: a word, and a rule that opens under it when the pointer is over it.
Item {
    id: root
    property string label: ""
    property color tone: Theme.dim
    signal clicked()
    readonly property bool tabStop: true
    activeFocusOnTab: true
    Keys.onReturnPressed: root.clicked()
    Keys.onEnterPressed: root.clicked()
    Keys.onSpacePressed: root.clicked()
    FocusMark {}
    implicitWidth: word.implicitWidth + 8
    implicitHeight: 34

    Text {
        id: word
        anchors.centerIn: parent
        text: root.label
        font.family: Theme.display
        font.pixelSize: 12
        font.letterSpacing: 1.8
        color: hover.hovered ? Theme.text : root.tone
        Behavior on color { ColorAnimation { duration: Theme.fast } }
    }
    Rectangle {
        anchors.horizontalCenter: parent.horizontalCenter
        objectName: "hair"
        y: parent.height - 6
        height: Theme.hair
        width: hover.hovered ? word.implicitWidth : 0
        color: Theme.text
        opacity: 0.7
        Behavior on width { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
    }
    HoverHandler { id: hover; cursorShape: Qt.PointingHandCursor; onHoveredChanged: if (hovered) Sfx.play("tick") }
    TapHandler { onTapped: { Sfx.play("press"); root.clicked() } }
}
