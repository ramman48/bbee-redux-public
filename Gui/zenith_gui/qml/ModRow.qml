import QtQuick

// One mod in the list. A click chooses it; a click on its badge (or the ON / OFF word) switches it.
Item {
    id: root
    property string title: ""
    property string version: ""
    property string note: ""
    property bool isOn: false
    property bool locked: false
    property bool compatible: true
    property bool selected: false
    property real reveal: 1
    property string channel: ""      // DEV | PUBLIC | LOCAL: where its updates come from
    property bool fresh: false       // an update brought it in the last 24 hours
    property bool held: false        // rolled back: kept on this version
    property bool preview: false     // in the game, still being made: an amber PREVIEW tag
    // room the tags left of ON / OFF take from the title and version lines
    readonly property real tagRoom: (fresh ? newMark.width + 6 : 0) + (preview ? previewMark.width + 6 : 0)
    signal chosen()
    signal switched(bool on)
    // by keyboard: Enter chooses the row, Space switches the mod as well
    readonly property bool tabStop: true
    activeFocusOnTab: true
    Keys.onReturnPressed: root.chosen()
    Keys.onEnterPressed: root.chosen()
    Keys.onSpacePressed: { if (!root.locked) { Sfx.play(root.isOn ? "off" : "on"); root.switched(!root.isOn) } root.chosen() }
    FocusMark { inset: 2; z: 2 }

    implicitHeight: 62
    opacity: reveal
    transform: Translate { x: (1 - root.reveal) * -22 }
    onIsOnChanged: if (isOn && reveal >= 1) ping.restart()

    Rectangle {
        anchors.fill: parent
        anchors.topMargin: 1; anchors.bottomMargin: 1
        color: "#ffffff"
        opacity: root.selected ? 0.085 : (hover.hovered ? 0.045 : 0.02)
        Behavior on opacity { NumberAnimation { duration: Theme.fast } }
    }
    // the bracket marks the game puts on its chosen row
    Rectangle {
        width: 2; height: 24
        anchors.verticalCenter: parent.verticalCenter
        x: root.selected ? 7 : -3
        opacity: root.selected ? 1 : 0
        color: Theme.text
        Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
        Behavior on opacity { NumberAnimation { duration: Theme.fast } }
    }
    Rectangle {
        width: 2; height: 24
        anchors.verticalCenter: parent.verticalCenter
        x: root.width - width - (root.selected ? 7 : -3)
        opacity: root.selected ? 1 : 0
        color: Theme.text
        Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
        Behavior on opacity { NumberAnimation { duration: Theme.fast } }
    }

    // switched on: a ring leaves the badge
    HexMark {
        id: ring
        x: badge.x
        anchors.verticalCenter: parent.verticalCenter
        width: 24; height: 24
        outline: Theme.cyan
        stroke: 1.2
        opacity: 0
        ParallelAnimation {
            id: ping
            NumberAnimation { target: ring; property: "scale"; from: 1; to: 2.6; duration: 560; easing.type: Easing.OutCubic }
            NumberAnimation { target: ring; property: "opacity"; from: 0.9; to: 0; duration: 560; easing.type: Easing.OutCubic }
        }
    }
    HexMark {
        id: badge
        x: 26
        anchors.verticalCenter: parent.verticalCenter
        width: 24; height: 24
        fill: root.isOn ? 1 : 0
        tone: root.locked ? Theme.dim : Theme.cyan
        outline: root.isOn ? (root.locked ? Theme.dim : Theme.cyan) : Theme.faint
        Behavior on fill { NumberAnimation { duration: 340; easing.type: Easing.OutBack } }
    }

    Column {
        x: 66
        anchors.verticalCenter: parent.verticalCenter
        spacing: 4
        Item {
            id: titleBox
            width: root.width - 66 - 78 - root.tagRoom
            height: titleText.implicitHeight
            clip: true
            readonly property real overflow: Math.max(0, titleText.implicitWidth - width)

            Text {
                id: titleText
                text: root.title.toUpperCase()
                font.family: Theme.display
                font.pixelSize: 15
                font.letterSpacing: 1.2
                color: root.isOn ? Theme.text : Theme.dim
                x: (hover.hovered && titleBox.overflow > 0) ? -titleBox.overflow : 0
                Behavior on x {
                    NumberAnimation {
                        duration: Math.max(Theme.base, titleBox.overflow * 14)
                        easing.type: Easing.InOutQuad
                    }
                }
                Behavior on color { ColorAnimation { duration: Theme.base } }
            }
        }
        Text {
            text: "V" + root.version + (root.channel !== "" && root.channel !== "LOCAL" ? "   " + root.channel : "")
                  + (root.held ? qsTr("   HELD") : "") + (root.note ? "   " + root.note.toUpperCase() : "")
            font.family: Theme.body
            font.pixelSize: 12
            font.letterSpacing: 0.8
            color: root.compatible ? Theme.dim : Theme.amber
            elide: Text.ElideRight
            width: root.width - 66 - 78 - root.tagRoom
        }
    }

    // new in the last day: a small cyan tag left of ON / OFF
    Rectangle {
        id: newMark
        objectName: "newMark"
        visible: root.fresh
        anchors.right: parent.right; anchors.rightMargin: 58
        anchors.verticalCenter: parent.verticalCenter
        width: newWord.implicitWidth + 10; height: 16
        color: Qt.rgba(Theme.cyan.r, Theme.cyan.g, Theme.cyan.b, 0.16)
        border.width: 1; border.color: Theme.cyan
        Text {
            id: newWord
            anchors.centerIn: parent
            text: qsTr("NEW")
            font.family: Theme.display; font.pixelSize: 9; font.letterSpacing: 1.6
            color: Theme.cyan
        }
    }
    // still being made: an amber tag, left of NEW when both show
    Rectangle {
        id: previewMark
        objectName: "previewMark"
        visible: root.preview
        anchors.right: parent.right; anchors.rightMargin: 58 + (root.fresh ? newMark.width + 6 : 0)
        anchors.verticalCenter: parent.verticalCenter
        width: previewWord.implicitWidth + 10; height: 16
        color: Qt.rgba(Theme.amber.r, Theme.amber.g, Theme.amber.b, 0.16)
        border.width: 1; border.color: Theme.amber
        Text {
            id: previewWord
            anchors.centerIn: parent
            text: qsTr("PREVIEW")
            font.family: Theme.display; font.pixelSize: 9; font.letterSpacing: 1.6
            color: Theme.amber
        }
    }
    Text {
        anchors.right: parent.right
        anchors.rightMargin: 24
        anchors.verticalCenter: parent.verticalCenter
        text: root.locked ? qsTr("CORE") : (root.isOn ? qsTr("ON") : qsTr("OFF"))
        font.family: Theme.display
        font.pixelSize: 11
        font.letterSpacing: 1.8
        color: root.locked ? Theme.faint : (root.isOn ? Theme.cyan : Theme.faint)
        Behavior on color { ColorAnimation { duration: Theme.base } }
    }

    HoverHandler { id: hover; cursorShape: Qt.PointingHandCursor; onHoveredChanged: if (hovered) Sfx.play("tick") }
    MouseArea {
        anchors.fill: parent
        onClicked: (mouse) => {
            const onSwitch = mouse.x < 60 || mouse.x > root.width - 70
            if (onSwitch && !root.locked) { Sfx.play(root.isOn ? "off" : "on"); root.switched(!root.isOn) } else Sfx.play("press")
            root.chosen()
        }
    }
}
