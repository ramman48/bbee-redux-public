import QtQuick

// A choice between two or three words. The lit cell slides to the one that is chosen.
Item {
    id: root
    property var options: []       // [{value, label}]
    property var value
    signal picked(var value)
    // by keyboard: Left and Right move the choice, Enter or Space goes to the next one
    readonly property bool tabStop: true
    activeFocusOnTab: true
    function step(by) { if (options.length > 0) picked(options[(at + by + options.length) % options.length].value) }
    Keys.onLeftPressed: if (at > 0) step(-1)
    Keys.onRightPressed: if (at < options.length - 1) step(1)
    Keys.onReturnPressed: step(1)
    Keys.onEnterPressed: step(1)
    Keys.onSpacePressed: step(1)
    FocusMark {}

    // a cell is as wide as the longest word needs, and never narrower than 92
    readonly property real cell: Math.max(92, options.reduce((most, o) => Math.max(most, String(o.label).length), 0) * 9.5 + 24)
    implicitWidth: cell * options.length
    implicitHeight: 34
    readonly property int at: {
        for (let i = 0; i < options.length; ++i) if (options[i].value === value) return i
        return 0
    }

    Rectangle {
        anchors.fill: parent
        color: "transparent"
        border.width: Theme.hair
        border.color: Qt.rgba(Theme.line.r, Theme.line.g, Theme.line.b, 0.26)
    }
    Rectangle {
        x: root.at * root.cell + 3; y: 3
        width: root.cell - 6; height: parent.height - 6
        color: Qt.rgba(Theme.cyan.r, Theme.cyan.g, Theme.cyan.b, 0.16)
        border.width: Theme.hair
        border.color: Qt.rgba(Theme.cyan.r, Theme.cyan.g, Theme.cyan.b, 0.7)
        Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
    }
    Repeater {
        model: root.options
        delegate: Item {
            required property int index
            required property var modelData
            x: index * root.cell
            width: root.cell; height: root.height
            Text {
                anchors.centerIn: parent
                text: modelData.label
                font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 1.6
                color: index === root.at ? Theme.cyan : (over.hovered ? Theme.text : Theme.dim)
                Behavior on color { ColorAnimation { duration: Theme.fast } }
            }
            HoverHandler { id: over; cursorShape: Qt.PointingHandCursor; onHoveredChanged: if (hovered && index !== root.at) Sfx.play("tick") }
            TapHandler { onTapped: if (index !== root.at) { Sfx.play("on"); root.picked(modelData.value) } }
        }
    }
}
