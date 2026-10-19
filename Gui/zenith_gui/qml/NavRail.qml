import QtQuick

// The column on the left: the pages of the Terminal, on dark glass. A lit plate and a glowing bar slide to the chosen
// one; the rail's edge is a line that carries light, brightest at the chosen row; a scan crosses a row under the pointer.
Item {
    id: root
    property string page: "home"
    property real reveal: 1
    property string version: ""
    signal picked(string page)

    property bool redux: false          // the window has a Redux set (redux.json): its page comes after the Library
    readonly property var entries: [{ id: "home", label: qsTr("HOME") }, { id: "library", label: qsTr("LIBRARY") }]
        .concat(redux ? [{ id: "redux", label: qsTr("REDUX") }] : [])
        .concat([{ id: "options", label: qsTr("OPTIONS") }, { id: "log", label: qsTr("LOG") }, { id: "roadmap", label: qsTr("ROADMAP") },
                 { id: "support", label: qsTr("SUPPORT") }])
    readonly property int at: Math.max(0, entries.findIndex(e => e.id === page))
    readonly property real first: 104
    // seven pages in a 720-unit window: the rows close up to leave room for the version under them
    readonly property real step: Math.min(82, Math.floor((height - first - 64) / Math.max(1, entries.length)))
    readonly property real lift: (step - 82) / 2
    width: 96

    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

    Rectangle { anchors.fill: parent; color: "#05070b"; opacity: 0.5 * root.reveal }
    GlassPanel { anchors.fill: parent; reveal: root.reveal; strength: 0.45; shade: 0.55 }
    Rectangle { objectName: "hair"; x: parent.width - width; width: Theme.hair; height: parent.height * root.reveal; color: Theme.line; opacity: 0.14 }
    // the edge carries light, down and up
    DataLine {
        x: root.width + 4; y: 0
        width: root.height; height: 9
        rotation: 90; transformOrigin: Item.TopLeft
        grow: root.reveal; base: 0.0; packets: 4; reverse: 1; rate: 1.6
        opacity: 0.9
    }

    // the chosen row: a plate lit from its bar side, the bar with its glow, and a bright notch on the rail's edge
    Item {
        id: plate
        x: 0; width: parent.width
        y: root.first + root.at * root.step + 5
        height: root.step - 10
        opacity: root.reveal
        Behavior on y { NumberAnimation { duration: 340; easing.type: Easing.OutCubic } }
        Rectangle {
            x: 9; width: parent.width - 19; height: parent.height
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: Qt.rgba(0.31, 0.86, 0.94, 0.16) }
                GradientStop { position: 1.0; color: Qt.rgba(1, 1, 1, 0.035) }
            }
        }
        Rectangle { x: 9; width: parent.width - 19; height: 1; color: Theme.cyan; opacity: 0.35 }
        Rectangle { x: 9; y: parent.height - 1; width: parent.width - 19; height: 1; color: Theme.cyan; opacity: 0.12 }
        Rectangle {
            x: root.width - 2; width: 2
            y: 10; height: parent.height - 20
            color: Theme.cyan
        }
    }
    Rectangle {
        x: 0; width: 3
        y: root.first + root.at * root.step + 21
        height: root.step - 42
        color: Theme.cyan
        opacity: root.reveal
        Behavior on y { NumberAnimation { duration: 420; easing.type: Easing.OutBack; easing.overshoot: 1.1 } }
        Rectangle {
            x: 3; width: 22; height: parent.height
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: Qt.rgba(0.31, 0.86, 0.94, 0.30) }
                GradientStop { position: 1.0; color: Qt.rgba(0.31, 0.86, 0.94, 0.0) }
            }
        }
    }

    Repeater {
        model: root.entries
        delegate: Item {
            id: entry
            required property int index
            required property var modelData
            readonly property bool chosen: index === root.at
            readonly property real shows: root.ease(root.reveal * 2.2 - index * 0.24)
            y: root.first + index * root.step
            width: root.width; height: root.step
            opacity: shows
            transform: Translate { x: (1 - entry.shows) * -14 }
            readonly property bool tabStop: true
            activeFocusOnTab: true
            Keys.onReturnPressed: root.picked(entry.modelData.id)
            Keys.onEnterPressed: root.picked(entry.modelData.id)
            Keys.onSpacePressed: root.picked(entry.modelData.id)
            FocusMark { inset: 6 }

            NavGlyph {
                anchors.horizontalCenter: parent.horizontalCenter
                y: 17 + root.lift
                width: 24; height: 24
                kind: entry.modelData.id
                tone: entry.chosen ? Theme.cyan : (over.hovered ? Theme.text : Theme.dim)
            }
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                y: 51 + root.lift
                text: entry.modelData.label
                width: parent.width - 8; horizontalAlignment: Text.AlignHCenter
                fontSizeMode: Text.HorizontalFit; minimumPixelSize: 6          // a longer word in another language shrinks to fit
                font.family: Theme.display; font.pixelSize: 9; font.letterSpacing: 1.7
                color: entry.chosen || over.hovered ? Theme.text : Theme.dim
                Behavior on color { ColorAnimation { duration: Theme.fast } }
            }
            // a scan crosses the row as the pointer comes onto it
            Rectangle {
                id: scan
                x: 9; width: parent.width - 19; height: 2
                y: 5 + entry.scanAt * (parent.height - 12)
                color: Theme.cyan
                opacity: (1 - entry.scanAt) * 0.7
                visible: entry.scanAt < 1
            }
            property real scanAt: 1
            NumberAnimation { id: scanRun; target: entry; property: "scanAt"; from: 0; to: 1; duration: 320; easing.type: Easing.OutCubic }
            HoverHandler {
                id: over; cursorShape: Qt.PointingHandCursor
                onHoveredChanged: if (hovered && !entry.chosen) { Sfx.play("hover"); if (!Theme.calm) scanRun.restart() }
            }
            TapHandler { onTapped: root.picked(entry.modelData.id) }
        }
    }

    Text {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom; anchors.bottomMargin: 24
        text: (controller.edition === "dev" ? qsTr("DEV") : qsTr("ALPHA")) + "\n" + root.version
        horizontalAlignment: Text.AlignHCenter
        lineHeight: 1.5
        font.family: Theme.display; font.pixelSize: 9; font.letterSpacing: 1.8
        color: controller.edition === "dev" ? Theme.amber : Theme.faint
        opacity: root.reveal
    }
}
