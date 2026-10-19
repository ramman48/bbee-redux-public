import QtQuick

// One line of the Options table: what it is and what it does on the left, its control on the right
// (a button, a choice between words, or a plain value).
Item {
    id: root
    property string name: ""
    property string text: ""
    property string detail: ""        // a path or another long single line, cut in its middle when too long
    property string kind: "button"     // button | choice | value
    property string label: ""
    property bool danger: false
    property bool usable: true
    property var options: []
    property var value
    property real reveal: 1
    property string label2: ""        // a second button left of the first (USE / DELETE, BACK / NEXT)
    property bool danger2: false
    property string mark: ""          // a light before the name: ok | warn | bad | off (the health check, status)
    signal activated()
    signal activated2()
    signal picked(var value)
    readonly property color markTone: mark === "bad" ? Theme.rose : mark === "warn" ? Theme.amber : mark === "ok" ? Theme.cyan : Theme.faint

    implicitHeight: Math.max(70, words.implicitHeight + 30)
    opacity: reveal
    transform: Translate { x: (1 - root.reveal) * 18 }

    Rectangle {
        anchors.fill: parent
        color: "#ffffff"
        opacity: over.hovered ? 0.035 : 0
        Behavior on opacity { NumberAnimation { duration: Theme.fast } }
    }
    Rectangle {
        anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
        objectName: "hair"
        height: Theme.hair
        color: Theme.line
        opacity: 0.10
    }
    Column {
        id: words
        x: 14
        anchors.verticalCenter: parent.verticalCenter
        width: parent.width - 320
        spacing: 5
        Row {
            spacing: 9
            HexMark {
                visible: root.mark !== ""
                width: 12; height: 12
                anchors.verticalCenter: parent.verticalCenter
                fill: root.mark === "off" ? 0 : 1
                tone: root.markTone; outline: root.markTone
                stroke: 1.1
            }
            Text {
                text: root.name
                font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.6
                color: root.danger ? Theme.rose : Theme.text
            }
        }
        Text {
            width: parent.width
            text: root.text
            wrapMode: Text.WordWrap
            font.family: Theme.body; font.pixelSize: 13
            lineHeight: 1.25
            color: Theme.dim
        }
        Text {
            width: parent.width
            visible: root.detail !== ""
            text: root.detail
            elide: Text.ElideMiddle
            font.family: Theme.mono; font.pixelSize: 12
            color: Theme.faint
        }
    }
    Item {
        anchors.right: parent.right; anchors.rightMargin: 14
        anchors.verticalCenter: parent.verticalCenter
        width: 280; height: 38
        OutlineButton {
            id: first
            visible: root.kind === "button"
            anchors.right: parent.right
            label: root.label
            danger: root.danger
            enabled: root.usable
            onClicked: root.activated()
        }
        OutlineButton {
            visible: root.kind === "button" && root.label2 !== ""
            anchors.right: first.left; anchors.rightMargin: 10
            label: root.label2
            danger: root.danger2
            tone: Theme.dim
            onClicked: root.activated2()
        }
        Segmented {
            visible: root.kind === "choice"
            anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
            options: root.options
            value: root.value
            onPicked: (value) => root.picked(value)
        }
        Text {
            visible: root.kind === "value"
            anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
            text: root.label
            font.family: Theme.mono; font.pixelSize: 14; font.letterSpacing: 0.6
            color: Theme.line
        }
    }
    HoverHandler { id: over }
}
