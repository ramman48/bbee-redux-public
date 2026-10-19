import QtQuick

// The mark on the control the keyboard is on: a light outline just outside it, two real pixels or more.
// It shows from a Tab until the next mouse press (Theme.keys), so a click never leaves one behind.
Rectangle {
    objectName: "focusMark"
    property real inset: -4
    anchors.fill: parent; anchors.margins: inset
    visible: parent.activeFocus && Theme.keys
    color: "transparent"
    border.width: Math.max(2, Math.round(2 * Theme.unit)) / Theme.unit
    border.color: Theme.text
}
