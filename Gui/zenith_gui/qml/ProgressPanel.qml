import QtQuick
import QtQuick.Shapes

// What is on screen while the loader works: on dark glass, a core on the left whose ring fills as the work goes on
// (the share done in the middle), the steps and a lit bar on the right, and the loader's own last lines in a small
// terminal under them. At the end, either the way into the game or what went wrong, in the loader's words; a finished
// install lands with a shock wave from the core.
Item {
    id: root
    property bool open: false
    property bool running: false
    property string title: ""
    property var steps: []
    property int step: -1
    property string result: ""
    property string resultText: ""
    property var lines: []
    property string resultAction: ""     // play | backups | feedback | report | nothing
    property var download: ({})          // the updater's download: {done, total, mb, speed, left, paused}
    property bool canPause: false
    property bool cancelSafe: false      // stopping now leaves nothing half done (else CANCEL waits for a stall)
    property int stallSeconds: 120
    property string resultHelp: ""       // what a stop means and what to do next, in plain words
    signal play()
    signal folder(string which)
    signal closed()
    signal cancel()
    signal pause(bool on)
    signal send()
    readonly property bool downloading: running && download.total > 0
    readonly property bool stalled: running && quiet >= stallSeconds

    property int seconds: 0              // since this work began
    property int quiet: 0                // since the loader's last line
    function clock(s) { return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60) }
    onRunningChanged: if (running) { seconds = 0; quiet = 0 }
    onLinesChanged: quiet = 0
    Timer { interval: 1000; repeat: true; running: root.running; onTriggered: { root.seconds += 1; root.quiet += 1 } }

    visible: shade.opacity > 0.01
    readonly property color tone: result === "error" ? Theme.amber : Theme.cyan
    // the keyboard goes to CLOSE when the work ends (Tab from there reaches the folder or PLAY)
    onResultChanged: if (result !== "") {
        close.forceActiveFocus()
        Sfx.play(result === "ok" ? "done" : "error")
        if (!Theme.calm) {
            const c = core.mapToItem(null, core.width / 2, core.height / 2)
            Fx.shock(c.x, c.y, result === "ok" ? 0.7 : 0.4)
            Fx.burst(result === "ok" ? "#4fdcf0" : "#ffb648", result === "ok" ? 0.16 : 0.1)
            land.restart()
        }
    }
    property real appear: open ? 1 : 0
    Behavior on appear { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
    property real landed: 0
    NumberAnimation { id: land; target: root; property: "landed"; from: 1; to: 0; duration: 900; easing.type: Easing.OutCubic }

    Rectangle { id: shade; anchors.fill: parent; color: "#05070b"; opacity: 0.86 * root.appear }
    MouseArea { anchors.fill: parent; enabled: root.open; hoverEnabled: true; onWheel: (wheel) => wheel.accepted = true }

    Item {
        id: card
        width: 880; height: 452
        anchors.centerIn: parent
        opacity: root.appear
        scale: 0.96 + 0.04 * root.appear

        Rectangle { anchors.fill: parent; color: "#060910"; opacity: 0.82 * root.appear }
        GlassPanel { anchors.fill: parent; tone: root.tone; reveal: root.appear; shade: 1.2 }
        DataLine { x: 24; y: 70; width: parent.width - 48; grow: root.appear; base: 0.14; packets: root.running ? 4 : 1; rate: 2.2; tone: root.tone }

        DecodeText {
            id: heading
            x: 36; y: 26
            text: root.result === "ok" ? qsTr("DONE") : (root.result === "error" ? qsTr("STOPPED") : qsTr(root.title))
            run: root.open
            font.family: Theme.display; font.pixelSize: 24; font.letterSpacing: 3.4
            color: root.result === "error" ? Theme.amber : Theme.text
        }
        // how long the work has run, and a line when the loader has said nothing for a while: a character's first
        // install reads the player's other game for minutes without a new line, and people took that for a hang
        Text {
            anchors.right: parent.right; anchors.rightMargin: 78; y: 32
            visible: root.result === "" && root.seconds > 0
            text: root.clock(root.seconds)
            font.family: Theme.mono; font.pixelSize: 15
            color: Theme.dim
        }
        HexMark {
            anchors.right: parent.right; anchors.rightMargin: 36; y: 27
            width: 28; height: 28
            fill: root.result === "ok" ? 1 : pulse
            tone: root.tone
            outline: tone
            property real pulse: 0.3
            SequentialAnimation on pulse {
                loops: Animation.Infinite; running: root.running
                NumberAnimation { to: 1; duration: 620; easing.type: Easing.InOutSine }
                NumberAnimation { to: 0.3; duration: 620; easing.type: Easing.InOutSine }
            }
        }

        // ---- the core: a ring that fills with the work, the share in its middle ---------------------------------
        // inside a download the step fills file by file (improvement 3: the share moves with every file, not per step)
        readonly property real share: root.result === "ok" ? 1 : Math.max(0, Math.min(1, (root.step + (root.downloading
                                      ? Math.min(0.95, root.download.done / Math.max(1, root.download.total)) : 0.5)) / Math.max(1, root.steps.length)))
        // the shown share follows the step smoothly: one animation per step
        property real shown: share
        Behavior on shown { NumberAnimation { duration: 620; easing.type: Easing.OutCubic } }
        property real turn: 0
        NumberAnimation on turn { from: 0; to: 360; duration: 9000; loops: Animation.Infinite; running: root.open && !Theme.calm }

        Item {
            id: core
            objectName: "progressCore"
            x: 36; y: 100
            width: 236; height: 236
            readonly property real r: width / 2
            scale: 1 + 0.06 * root.landed

            // the outer tick ring, turning slowly
            Repeater {
                model: 72
                delegate: Rectangle {
                    required property int index
                    readonly property bool lit: index / 72 <= card.shown
                    width: index % 6 === 0 ? 2 : 1.2; height: index % 6 === 0 ? 10 : 6
                    x: core.r - width / 2; y: 0
                    color: lit ? root.tone : Theme.faint
                    opacity: lit ? 0.95 : 0.45
                    transform: Rotation { origin.x: width / 2; origin.y: core.r; angle: index * 5 }
                }
            }
            // the fill
            Shape {
                anchors.fill: parent
                preferredRendererType: Shape.CurveRenderer
                ShapePath {
                    strokeColor: Qt.rgba(1, 1, 1, 0.06); strokeWidth: 8; fillColor: "transparent"; capStyle: ShapePath.FlatCap
                    PathAngleArc { centerX: core.r; centerY: core.r; radiusX: core.r - 24; radiusY: core.r - 24; startAngle: -90; sweepAngle: 360 }
                }
                ShapePath {
                    strokeColor: root.tone; strokeWidth: 8; fillColor: "transparent"; capStyle: ShapePath.FlatCap
                    PathAngleArc { centerX: core.r; centerY: core.r; radiusX: core.r - 24; radiusY: core.r - 24; startAngle: -90; sweepAngle: 360 * card.shown }
                }
                // a bright head on the fill while it works
                ShapePath {
                    strokeColor: "#ffffff"; strokeWidth: 8; fillColor: "transparent"; capStyle: ShapePath.FlatCap
                    strokeStyle: root.running ? ShapePath.SolidLine : ShapePath.DashLine
                    PathAngleArc { centerX: core.r; centerY: core.r; radiusX: core.r - 24; radiusY: core.r - 24
                                   startAngle: -90 + 360 * card.shown - (root.running ? 6 : 0); sweepAngle: root.running ? 6 : 0 }
                }
            }
            // two thin arcs turning against each other inside
            Shape {
                anchors.fill: parent
                rotation: card.turn
                preferredRendererType: Shape.CurveRenderer
                ShapePath {
                    strokeColor: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.55); strokeWidth: 1.5; fillColor: "transparent"
                    PathAngleArc { centerX: core.r; centerY: core.r; radiusX: core.r - 40; radiusY: core.r - 40; startAngle: 0; sweepAngle: 110 }
                }
                ShapePath {
                    strokeColor: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.55); strokeWidth: 1.5; fillColor: "transparent"
                    PathAngleArc { centerX: core.r; centerY: core.r; radiusX: core.r - 40; radiusY: core.r - 40; startAngle: 180; sweepAngle: 110 }
                }
            }
            Shape {
                anchors.fill: parent
                rotation: -card.turn * 1.7
                preferredRendererType: Shape.CurveRenderer
                ShapePath {
                    strokeColor: Qt.rgba(1, 0.25, 0.42, 0.45); strokeWidth: 1.2; fillColor: "transparent"
                    PathAngleArc { centerX: core.r; centerY: core.r; radiusX: core.r - 48; radiusY: core.r - 48; startAngle: 40; sweepAngle: 50 }
                }
                ShapePath {
                    strokeColor: Qt.rgba(1, 0.25, 0.42, 0.45); strokeWidth: 1.2; fillColor: "transparent"
                    PathAngleArc { centerX: core.r; centerY: core.r; radiusX: core.r - 48; radiusY: core.r - 48; startAngle: 220; sweepAngle: 50 }
                }
            }
            // the ring a finish sends out
            Rectangle {
                anchors.centerIn: parent
                width: core.width * (1 + 0.6 * (1 - root.landed)); height: width; radius: width / 2
                color: "transparent"; border.width: 2; border.color: root.tone
                opacity: root.landed * 0.8
                visible: root.landed > 0.01
            }
            // the share
            Row {
                anchors.centerIn: parent
                anchors.verticalCenterOffset: -8
                Text {
                    text: Math.round(card.shown * 100)
                    font.family: Theme.display; font.pixelSize: 52; font.letterSpacing: 1
                    color: Theme.text
                }
                Text {
                    anchors.baseline: parent.children[0].baseline
                    text: "%"
                    font.family: Theme.display; font.pixelSize: 18
                    color: root.tone
                }
            }
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                y: core.r + 24
                text: root.result === "ok" ? qsTr("COMPLETE") : (root.result === "error" ? qsTr("HALTED")
                      : qsTr("STEP ") + Math.max(1, Math.min(root.steps.length, root.step + 1)) + " / " + root.steps.length)
                font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2.6
                color: root.tone
            }
        }

        // ---- the right side: the steps, the bar, the loader's words ------------------------------------------------
        readonly property real side: 312
        Text {
            x: card.side; y: 84
            width: parent.width - card.side - 36
            objectName: "progressNote"
            opacity: root.downloading || root.stalled || (root.running && root.quiet >= 20) ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: Theme.base } }
            text: root.stalled ? qsTr("NO NEW LINE FOR ") + Math.floor(root.quiet / 60) + qsTr(" MIN. IT MAY STILL BE WORKING; CANCEL STOPS IT.")
                : root.downloading ? (root.download.paused ? qsTr("PAUSED   ") : "")
                  + root.download.done + " / " + root.download.total + qsTr(" FILES   ") + Number(root.download.mb).toFixed(1) + qsTr(" MB   ")
                  + (root.download.paused ? "" : Number(root.download.speed).toFixed(1) + qsTr(" MB/S   ABOUT ") + root.download.left + qsTr(" LEFT"))
                : qsTr("STILL WORKING. A FIRST INSTALL CAN TAKE 15 MINUTES.")
            elide: Text.ElideRight
            font.family: root.downloading && !root.stalled ? Theme.mono : Theme.display
            font.pixelSize: root.downloading && !root.stalled ? 13 : 11; font.letterSpacing: 1.2
            color: root.stalled ? Theme.amber : Theme.cyan
        }
        Column {
            x: card.side; y: 108
            spacing: 10
            Repeater {
                model: root.steps
                delegate: Row {
                    required property int index
                    required property string modelData
                    spacing: 14
                    readonly property bool done: index < root.step || root.result === "ok"
                    readonly property bool now: index === root.step && root.running
                    Text {
                        width: 22
                        anchors.verticalCenter: parent.verticalCenter
                        text: String(index + 1).padStart(2, "0")
                        font.family: Theme.mono; font.pixelSize: 11
                        color: parent.done || parent.now ? root.tone : Theme.faint
                    }
                    HexMark {
                        width: 16; height: 16
                        anchors.verticalCenter: parent.verticalCenter
                        fill: parent.done ? 1 : (parent.now ? 0.55 : 0)
                        tone: root.tone
                        outline: parent.done || parent.now ? root.tone : Theme.faint
                        stroke: 1.2
                        Behavior on fill { NumberAnimation { duration: Theme.base; easing.type: Easing.OutBack } }
                    }
                    Text {
                        text: qsTr(modelData).toUpperCase()      // the step's name, in the chosen language
                        font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.5
                        color: parent.done ? Theme.dim : (parent.now ? Theme.text : Theme.faint)
                        anchors.verticalCenter: parent.verticalCenter
                        Behavior on color { ColorAnimation { duration: Theme.base } }
                    }
                }
            }
        }

        // the bar: cells lit up to the current step, with a light running over the lit part
        Row {
            id: bar
            x: card.side; y: 252
            spacing: 4
            readonly property int cells: 30
            property real travel: 0
            NumberAnimation on travel { from: 0; to: 1; duration: 1300; loops: Animation.Infinite; running: root.running }
            Repeater {
                model: bar.cells
                delegate: Rectangle {
                    required property int index
                    width: (card.width - card.side - 36 - (bar.cells - 1) * 4) / bar.cells; height: 8
                    readonly property real lit: Math.max(0, Math.min(1, card.shown * bar.cells - index))
                    readonly property real wave: Math.max(0, 1 - Math.abs(index / bar.cells - bar.travel * card.shown) * 9)
                    color: lit > 0 && wave > 0.6 && root.running ? Qt.lighter(root.tone, 1.4) : root.tone
                    opacity: 0.10 + lit * (root.running ? 0.45 + 0.45 * wave : 0.85)
                }
            }
        }

        // the loader's own words, in a small terminal; the finished words in its place
        Rectangle {
            id: term
            x: card.side; y: 276
            width: parent.width - card.side - 36; height: 96
            color: "#04070b"; opacity: 0.9
            border.width: 1; border.color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.22)
            visible: root.result === ""
            clip: true
            // a scan line drifting down it
            Rectangle {
                width: parent.width; height: 14
                y: -14 + (parent.height + 14) * term.scan
                gradient: Gradient {
                    GradientStop { position: 0; color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.0) }
                    GradientStop { position: 1; color: Qt.rgba(root.tone.r, root.tone.g, root.tone.b, 0.10) }
                }
            }
            property real scan: 0
            NumberAnimation on scan { from: 0; to: 1; duration: 2600; loops: Animation.Infinite; running: term.visible && root.open && !Theme.calm }
            Column {
                x: 12; y: 10
                width: parent.width - 24
                spacing: 3
                Repeater {
                    model: root.lines.slice(-4)
                    delegate: Text {
                        required property int index
                        required property string modelData
                        readonly property bool last: index === Math.min(4, root.lines.length) - 1
                        width: parent.width
                        text: "> " + modelData + (last && root.running && term.blink ? "  _" : "")
                        elide: Text.ElideRight
                        font.family: Theme.mono; font.pixelSize: 12
                        color: last ? "#c6cfdc" : Theme.dim
                        opacity: 0.4 + 0.6 * (index + 1) / Math.max(1, Math.min(4, root.lines.length))
                    }
                }
            }
            property bool blink: true
            Timer { interval: 480; repeat: true; running: term.visible && root.running; onTriggered: term.blink = !term.blink }
        }
        Text {
            id: said
            x: card.side; y: 282
            width: parent.width - card.side - 36
            visible: root.result !== ""
            text: qsTr(root.resultText)
            wrapMode: Text.WordWrap
            maximumLineCount: root.result === "error" && root.resultHelp !== "" ? 2 : 4
            elide: Text.ElideRight
            font.family: Theme.body; font.pixelSize: 15; lineHeight: 1.3
            color: Theme.text
        }
        // what it means and what to do next (improvement 7)
        Text {
            objectName: "resultHelp"
            x: card.side; y: said.y + said.height + 8
            width: parent.width - card.side - 36
            visible: root.result === "error" && root.resultHelp !== ""
            text: qsTr(root.resultHelp)
            wrapMode: Text.WordWrap
            maximumLineCount: 3
            elide: Text.ElideRight
            font.family: Theme.body; font.pixelSize: 14; lineHeight: 1.25
            color: Theme.amber
        }
        // while it works: pause a download, or stop it
        Row {
            anchors.right: parent.right; anchors.rightMargin: 36
            anchors.bottom: parent.bottom; anchors.bottomMargin: 28
            spacing: 18
            visible: root.running
            OutlineButton {
                objectName: "pauseButton"
                visible: root.canPause
                label: root.download.paused ? qsTr("RESUME") : qsTr("PAUSE")
                tone: Theme.dim
                onClicked: root.pause(!root.download.paused)
            }
            OutlineButton {
                objectName: "cancelButton"
                visible: root.cancelSafe || root.stalled
                label: qsTr("CANCEL")
                danger: root.stalled && !root.cancelSafe
                onClicked: root.cancel()
            }
        }

        Row {
            anchors.right: parent.right; anchors.rightMargin: 36
            anchors.bottom: parent.bottom; anchors.bottomMargin: 28
            spacing: 26
            visible: root.result !== ""
            GhostButton { id: close; label: qsTr("CLOSE"); anchors.verticalCenter: parent.verticalCenter; onClicked: root.closed() }
            OutlineButton {
                visible: root.resultAction === "backups" || root.resultAction === "feedback" || root.resultAction === "report"
                anchors.verticalCenter: parent.verticalCenter
                label: qsTr("OPEN FOLDER")
                onClicked: root.folder(root.resultAction === "report" ? "feedback" : root.resultAction)
            }
            OutlineButton {
                objectName: "sendButton"
                visible: root.resultAction === "report"
                anchors.verticalCenter: parent.verticalCenter
                label: qsTr("SEND TO DISCORD")
                tone: Theme.cyan
                onClicked: root.send()
            }
            PrimaryButton {
                visible: root.resultAction === "play" || root.resultAction === "playplain"
                implicitWidth: 200; implicitHeight: 48
                label: qsTr("PLAY")
                onClicked: root.play()
            }
        }
    }
}
