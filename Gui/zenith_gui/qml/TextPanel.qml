import QtQuick

// A long text on glass over the window: a mod's changelog. Scrolls; Escape, the pad's B or CLOSE puts it away.
Item {
    id: root
    property bool open: false
    property string title: ""
    property string body: ""
    signal closed()

    visible: appear > 0.01
    property real appear: open ? 1 : 0
    Behavior on appear { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
    onOpenChanged: if (open) { words.contentY = 0; close.forceActiveFocus() }

    Rectangle { anchors.fill: parent; color: "#05070b"; opacity: 0.84 * root.appear }
    MouseArea { anchors.fill: parent; enabled: root.open; hoverEnabled: true; onWheel: (wheel) => wheel.accepted = true; onClicked: root.closed() }

    Item {
        id: card
        objectName: "textPanel"
        width: Math.min(760, root.width - 160)
        height: Math.min(560, root.height - 120)
        anchors.centerIn: parent
        opacity: root.appear
        scale: 0.97 + 0.03 * root.appear
        MouseArea { anchors.fill: parent; onWheel: (wheel) => { words.flick(0, wheel.angleDelta.y * 6); wheel.accepted = true } }
        Keys.onEscapePressed: root.closed()

        Rectangle { anchors.fill: parent; color: "#060910"; opacity: 0.86 }
        GlassPanel { anchors.fill: parent; tone: Theme.cyan; reveal: root.appear; shade: 1.1 }
        Text {
            id: heading
            x: 36; y: 30
            width: parent.width - 72
            text: root.title
            textFormat: Text.PlainText
            elide: Text.ElideRight
            font.family: Theme.display; font.pixelSize: 20; font.letterSpacing: 2.4
            color: Theme.text
        }
        DataLine { x: 24; y: heading.y + heading.height + 12; width: parent.width - 48; grow: root.appear; base: 0.16; packets: 2; rate: 1.8 }
        Flickable {
            id: words
            x: 36; y: heading.y + heading.height + 30
            width: parent.width - 72
            height: parent.height - y - 84
            contentHeight: said.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            Text {
                id: said
                objectName: "textPanelBody"
                width: words.width - 10
                text: root.body !== "" ? root.body : qsTr("This mod has no list of changes.")
                textFormat: Text.PlainText           // a mod's own words: never read as markup
                wrapMode: Text.WordWrap
                font.family: Theme.body; font.pixelSize: 14; lineHeight: 1.32
                color: "#c6cfdc"
            }
            Keys.onUpPressed: contentY = Math.max(0, contentY - 60)
            Keys.onDownPressed: contentY = Math.min(Math.max(0, contentHeight - height), contentY + 60)
        }
        // how far down: a thin bar on the right
        Rectangle {
            visible: words.contentHeight > words.height
            x: parent.width - 22; y: words.y + (words.height - height) * (words.contentY / Math.max(1, words.contentHeight - words.height))
            width: 2; height: Math.max(30, words.height * words.height / Math.max(1, words.contentHeight))
            color: Theme.cyan; opacity: 0.6
        }
        OutlineButton {
            id: close
            objectName: "textPanelClose"
            anchors.right: parent.right; anchors.rightMargin: 36
            anchors.bottom: parent.bottom; anchors.bottomMargin: 24
            label: qsTr("CLOSE")
            onClicked: root.closed()
            Keys.onEscapePressed: root.closed()
        }
    }
}
