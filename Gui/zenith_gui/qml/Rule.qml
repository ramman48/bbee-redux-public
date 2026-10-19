import QtQuick

// A thin rule with a small tick at each end, as the game's own panels are closed off. `grow` opens it
// from its middle. The lines are one whole pixel thick at any scale.
Item {
    id: root
    property real grow: 1
    property color tone: Theme.line
    property real strength: 0.5
    implicitHeight: 7

    Rectangle {
        objectName: "hair"
        anchors.centerIn: parent
        width: root.width * root.grow
        height: Theme.hair
        color: root.tone
        opacity: root.strength
    }
    Rectangle {
        objectName: "hair"
        x: root.width * (1 - root.grow) / 2
        width: Theme.hair; height: root.height
        color: root.tone
        opacity: root.strength * root.grow
    }
    Rectangle {
        objectName: "hair"
        x: root.width - root.width * (1 - root.grow) / 2 - width
        width: Theme.hair; height: root.height
        color: root.tone
        opacity: root.strength * root.grow
    }
}
