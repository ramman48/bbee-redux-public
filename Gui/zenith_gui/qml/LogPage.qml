import QtQuick

// Log: what the loader printed the last time the window ran it, and what the game wrote the last time it
// ran. The lines that need a look are marked, and the newest are at the bottom. Nothing here changes a file.
Item {
    id: page
    property real reveal: 1
    property string which: "job"       // job | game
    property string show: "all"        // all | problems
    property real swapIn: 1            // 0..1: the lines' entrance after the log or the filter is changed
    property var view: ({ lines: [], when: "", head: "", problems: 0, warns: 0, empty: "" })

    visible: reveal > 0.001
    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

    readonly property var kinds: [
        { id: "job", label: qsTr("LAST INSTALL OR JOB"), text: qsTr("What the loader printed the last time this window ran it.") },
        { id: "game", label: qsTr("LAST GAME RUN"), text: qsTr("What the game wrote the last time it ran. It starts a new log every time.") }
    ]
    readonly property int at: Math.max(0, kinds.findIndex(k => k.id === which))

    function reload() {
        view = controller.logView(which, show === "problems")
        swap.restart()
        Qt.callLater(lines.positionViewAtEnd)
    }
    onWhichChanged: reload()
    onShowChanged: reload()
    onVisibleChanged: if (visible) reload()
    Connections { target: controller; function onBusyChanged() { if (page.visible && !controller.running) page.reload() } }
    Connections { target: controller; function onChanged() { if (page.visible && page.which === "game") page.reload() } }
    NumberAnimation { id: swap; target: page; property: "swapIn"; from: 0; to: 1; duration: 420 }

    // ---- the glass behind the logs and the lines ----------------------------------------------------------------
    GlassPanel { x: 108; y: 90; width: 282; height: page.height - 90 - 176; reveal: page.ease(page.reveal * 2.0) }
    GlassPanel { x: 404; y: 90; width: page.width - 420 - 40 + 32; height: page.height - 90 - 176; reveal: page.ease(page.reveal * 2.0 - 0.3) }

    // ---- the two logs -----------------------------------------------------------------------------------------
    Item {
        objectName: "logKinds"
        x: 124; y: 104
        width: 250

        Row {
            spacing: 9
            opacity: page.ease(page.reveal * 3)
            NavGlyph { width: 14; height: 14; kind: "log"; tone: Theme.dim; stroke: 1.4; anchors.verticalCenter: parent.verticalCenter }
            Text {
                text: qsTr("LOG")
                font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.6
                color: Theme.dim
            }
        }
        Rule { y: 24; width: parent.width; grow: page.ease(page.reveal * 2.2) }
        Repeater {
            model: page.kinds
            delegate: Item {
                id: kind
                required property int index
                required property var modelData
                readonly property bool chosen: index === page.at
                readonly property real shows: page.ease(page.reveal * 2.4 - 0.3 - index * 0.2)
                y: 44 + index * 52
                width: 250; height: 48
                opacity: shows
                transform: Translate { x: (1 - kind.shows) * -18 }
                readonly property bool tabStop: true
                activeFocusOnTab: true
                Keys.onReturnPressed: page.which = kind.modelData.id
                Keys.onEnterPressed: page.which = kind.modelData.id
                Keys.onSpacePressed: page.which = kind.modelData.id
                FocusMark { inset: 0 }
                Rectangle {
                    anchors.fill: parent; anchors.topMargin: 1; anchors.bottomMargin: 1
                    color: "#ffffff"
                    opacity: kind.chosen ? 0.085 : (over.hovered ? 0.045 : 0.02)
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Rectangle {
                    width: 2; height: 20
                    anchors.verticalCenter: parent.verticalCenter
                    x: kind.chosen ? 7 : -3
                    opacity: kind.chosen ? 1 : 0
                    color: Theme.text
                    Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Rectangle {
                    width: 2; height: 20
                    anchors.verticalCenter: parent.verticalCenter
                    x: parent.width - width - (kind.chosen ? 7 : -3)
                    opacity: kind.chosen ? 1 : 0
                    color: Theme.text
                    Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Text {
                    x: 24
                    anchors.verticalCenter: parent.verticalCenter
                    text: kind.modelData.label
                    width: parent.width - 40
                    fontSizeMode: Text.HorizontalFit; minimumPixelSize: 11     // a longer name in another language shrinks to fit
                    font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.6
                    color: kind.chosen ? Theme.text : Theme.dim
                    Behavior on color { ColorAnimation { duration: Theme.base } }
                }
                HoverHandler { id: over; cursorShape: Qt.PointingHandCursor; onHoveredChanged: if (hovered) Sfx.play("tick") }
                TapHandler { onTapped: { Sfx.play("press"); page.which = kind.modelData.id } }
            }
        }
        Text {
            y: 44 + page.kinds.length * 52 + 16
            width: parent.width
            text: page.kinds[page.at].text
            wrapMode: Text.WordWrap
            font.family: Theme.body; font.pixelSize: 13
            lineHeight: 1.3
            color: Theme.faint
            opacity: page.ease(page.reveal * 2.4 - 0.9)
        }
    }

    // ---- the lines --------------------------------------------------------------------------------------------
    Item {
        id: sheet
        objectName: "logSheet"
        x: 420; y: 104
        width: page.width - x - 40
        height: page.height - y - 176

        Text {
            x: 14
            width: parent.width - 260
            elide: Text.ElideRight
            text: page.view.head !== "" ? (page.view.head + (page.view.when !== "" ? "     " + page.view.when : "")).toUpperCase() : qsTr("NOTHING YET")
            font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.2
            color: Theme.dim
            opacity: page.ease(page.reveal * 3)
        }
        Text {
            objectName: "logCount"
            anchors.right: parent.right; anchors.rightMargin: 14
            text: page.view.problems > 0 ? page.view.problems + (page.view.problems === 1 ? qsTr(" PROBLEM") : qsTr(" PROBLEMS"))
                  : page.view.warns > 0 ? page.view.warns + (page.view.warns === 1 ? qsTr(" WARNING") : qsTr(" WARNINGS"))
                  : (page.view.lines.length > 0 ? qsTr("NO PROBLEMS") : "")
            font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.2
            color: page.view.problems > 0 ? Theme.rose : (page.view.warns > 0 ? Theme.amber : Theme.cyan)
            opacity: page.ease(page.reveal * 3)
        }
        Rule { y: 24; width: parent.width; grow: page.ease(page.reveal * 2.2) }

        ListView {
            id: lines
            objectName: "logLines"
            x: 0; y: 36
            width: parent.width - 10
            height: parent.height - 36
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            model: page.view.lines
            opacity: page.ease(Math.min(page.reveal * 2.2 - 0.5, page.swapIn * 1.6))
            delegate: Item {
                id: line
                required property int index
                required property var modelData
                width: lines.width; height: 21
                Rectangle {
                    visible: line.modelData.kind !== ""
                    anchors.fill: parent
                    color: line.modelData.kind === "error" ? Theme.rose : Theme.amber
                    opacity: 0.07
                }
                Rectangle {
                    visible: line.modelData.kind !== ""
                    width: 2; height: parent.height
                    color: line.modelData.kind === "error" ? Theme.rose : Theme.amber
                }
                Text {
                    x: 14
                    width: parent.width - 24
                    anchors.verticalCenter: parent.verticalCenter
                    text: line.modelData.text
                    textFormat: Text.PlainText
                    elide: Text.ElideRight
                    font.family: Theme.mono; font.pixelSize: 13
                    color: line.modelData.kind === "error" ? "#ffd2dc" : (line.modelData.kind === "warn" ? "#ffe2bd" : "#aeb8c8")
                }
            }
        }
        // where in the log the shown lines are
        Rectangle {
            visible: lines.visibleArea.heightRatio < 0.999
            x: parent.width - 4
            y: 36 + lines.visibleArea.yPosition * lines.height
            width: 2
            height: Math.max(18, lines.visibleArea.heightRatio * lines.height)
            color: Theme.line
            opacity: 0.4 * page.ease(page.reveal * 2.2 - 0.5)
        }
        Text {
            objectName: "logEmpty"
            visible: page.view.lines.length === 0
            x: 14; y: 60
            width: Math.min(560, parent.width - 28)
            text: page.view.empty
            wrapMode: Text.WordWrap
            font.family: Theme.body; font.pixelSize: 16
            lineHeight: 1.36
            color: "#c6cfdc"
            opacity: page.ease(page.reveal * 2.2 - 0.6)
        }
    }

    // ---- what can be done with it -----------------------------------------------------------------------------
    Row {
        objectName: "logActions"
        x: 420; y: page.height - 164
        spacing: 12
        opacity: page.ease(page.reveal * 2.2 - 1.0)
        Segmented {
            objectName: "logShow"
            anchors.verticalCenter: parent.verticalCenter
            options: [{ value: "all", label: qsTr("ALL") }, { value: "problems", label: qsTr("PROBLEMS") }]
            value: page.show
            onPicked: (value) => page.show = value
        }
        Item { width: 8; height: 1 }
        OutlineButton {
            label: qsTr("COPY")
            tone: Theme.dim
            onClicked: controller.copyLog(page.which, page.show === "problems")
        }
        OutlineButton {
            label: qsTr("OPEN THE FILE")
            tone: Theme.dim
            onClicked: controller.openLogFile(page.which)
        }
        OutlineButton {
            label: qsTr("READ AGAIN")
            tone: Theme.dim
            onClicked: page.reload()
        }
    }
}
