import QtQuick

// A small boxed fact about the chosen mod.
Rectangle {
    id: root
    property string label: ""
    property string value: ""
    property color tone: Theme.line
    implicitWidth: row.implicitWidth + 20
    implicitHeight: 26
    color: "transparent"
    border.width: Theme.hair
    border.color: Qt.rgba(tone.r, tone.g, tone.b, 0.32)

    Row {
        id: row
        anchors.centerIn: parent
        spacing: 8
        Text {
            text: root.label
            font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 1.6
            color: Theme.dim
            anchors.verticalCenter: parent.verticalCenter
        }
        Text {
            text: root.value
            font.family: Theme.body; font.pixelSize: 13; font.weight: Font.DemiBold; font.letterSpacing: 0.6
            color: root.tone
            anchors.verticalCenter: parent.verticalCenter
        }
    }
}
