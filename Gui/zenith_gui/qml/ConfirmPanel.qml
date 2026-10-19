import QtQuick

// Asked before anything is taken away: what will happen, in plain words, and two answers. On glass of the warning's
// colour, under a band of hazard stripes, with a badge that pulses while the question waits.
Item {
    id: root
    property bool open: false
    property string title: ""
    property string body: ""
    property string label: qsTr("CONFIRM")
    property string cancelLabel: qsTr("CANCEL")
    property bool danger: true
    property string field: ""            // a box to type in under the words, with this hint ("": none)
    property bool secret: false          // what is typed is shown as dots (a playtester key)
    readonly property string typed: input.text
    signal confirmed()
    signal cancelled()

    visible: appear > 0.01
    // the keyboard goes to the safe answer when the question comes up, or to the box when there is one
    onOpenChanged: if (open) { input.text = ""; if (field !== "") input.forceActiveFocus(); else cancel.forceActiveFocus() }
    property real appear: open ? 1 : 0
    Behavior on appear { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }

    Rectangle { anchors.fill: parent; color: "#05070b"; opacity: 0.84 * root.appear }
    MouseArea { anchors.fill: parent; enabled: root.open; hoverEnabled: true; onWheel: (wheel) => wheel.accepted = true; onClicked: root.cancelled() }

    Item {
        id: card
        width: 640
        height: words.y + words.implicitHeight + 104 + (root.field !== "" ? 62 : 0)
        readonly property color tone: root.danger ? Theme.rose : Theme.cyan
        anchors.centerIn: parent
        opacity: root.appear
        scale: 0.97 + 0.03 * root.appear
        MouseArea { anchors.fill: parent }

        Rectangle { anchors.fill: parent; color: "#060910"; opacity: 0.86 }
        GlassPanel { anchors.fill: parent; tone: card.tone; reveal: root.appear; shade: 1.1 }
        // the hazard band along the top
        Item {
            x: 3; y: 3; width: parent.width - 6; height: 6
            clip: true
            visible: root.danger
            Row {
                x: -24 + 24 * card.drift
                spacing: 12
                Repeater {
                    model: Math.ceil(card.width / 24) + 2
                    delegate: Rectangle { width: 12; height: 16; y: -5; rotation: 35; color: Theme.rose; opacity: 0.55 }
                }
            }
        }
        property real drift: 0
        NumberAnimation on drift { from: 0; to: 1; duration: 900; loops: Animation.Infinite; running: root.open && root.danger && !Theme.calm }
        // the badge
        Item {
            id: badge
            x: 34; y: 30
            width: 42; height: 42
            property real pulse: 0
            SequentialAnimation on pulse {
                loops: Animation.Infinite; running: root.open && !Theme.calm
                NumberAnimation { to: 1; duration: 520; easing.type: Easing.OutQuad }
                NumberAnimation { to: 0; duration: 900; easing.type: Easing.InOutQuad }
            }
            HexMark { anchors.fill: parent; fill: 0.18 + 0.2 * badge.pulse; tone: card.tone; outline: card.tone; stroke: 1.6 }
            HexMark { anchors.centerIn: parent; width: 42 + 18 * badge.pulse; height: width; fill: 0; outline: card.tone; stroke: 1; opacity: 1 - badge.pulse }
            Text { anchors.centerIn: parent; text: root.danger ? "!" : "?"; font.family: Theme.display; font.pixelSize: 20; color: Theme.text }
        }

        Text {
            id: heading
            x: 96; y: 30
            width: parent.width - 96 - 36
            height: Math.max(42, implicitHeight)
            verticalAlignment: Text.AlignVCenter
            text: root.title
            textFormat: Text.PlainText        // a mod's or a list's own words: never read as markup
            wrapMode: Text.WordWrap
            font.family: Theme.display; font.pixelSize: 20; font.letterSpacing: 2.4
            color: Theme.text
        }
        Text {
            id: words
            x: 36; y: heading.y + heading.height + 26
            width: parent.width - 72
            text: root.body
            textFormat: Text.PlainText
            wrapMode: Text.WordWrap
            font.family: Theme.body; font.pixelSize: 15; lineHeight: 1.34
            color: "#c6cfdc"
        }
        DataLine { x: 24; y: heading.y + heading.height + 9; width: parent.width - 48; grow: root.appear; base: 0.16; packets: 2; rate: 1.8; tone: card.tone }
        // the box: a preset's name, a playtester key
        Rectangle {
            visible: root.field !== ""
            x: 36; y: words.y + words.implicitHeight + 20
            width: parent.width - 72; height: 42
            color: "#04070b"
            border.width: 1
            border.color: input.activeFocus ? card.tone : Qt.rgba(Theme.line.r, Theme.line.g, Theme.line.b, 0.3)
            TextInput {
                id: input
                objectName: "confirmField"
                anchors.fill: parent; anchors.leftMargin: 14; anchors.rightMargin: 14
                verticalAlignment: TextInput.AlignVCenter
                font.family: Theme.mono; font.pixelSize: 15
                color: Theme.text
                selectionColor: Qt.rgba(card.tone.r, card.tone.g, card.tone.b, 0.4)
                echoMode: root.secret ? TextInput.Password : TextInput.Normal
                maximumLength: 255
                clip: true
                readonly property bool tabStop: true
                Keys.onReturnPressed: if (text.trim() !== "") root.confirmed()
                Keys.onEnterPressed: if (text.trim() !== "") root.confirmed()
            }
            Text {
                anchors.fill: input
                verticalAlignment: Text.AlignVCenter
                visible: input.text === ""
                text: root.field
                font.family: Theme.body; font.pixelSize: 14
                color: Theme.faint
            }
        }
        Row {
            anchors.right: parent.right; anchors.rightMargin: 36
            anchors.bottom: parent.bottom; anchors.bottomMargin: 24
            spacing: 22
            GhostButton { id: cancel; label: root.cancelLabel; anchors.verticalCenter: parent.verticalCenter; onClicked: root.cancelled() }
            OutlineButton { label: root.label; danger: root.danger; enabled: root.field === "" || input.text.trim() !== ""; onClicked: root.confirmed() }
        }
    }
}
