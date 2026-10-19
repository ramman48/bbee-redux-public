import QtQuick

// The roadmap: what the Redux team has out, is testing, has coming up and plans for later (zenith_gui\roadmap.json,
// shipped with the window). One column at a time in a list on the left; the characters it names stand on the
// window's stage on the right (the stage Home uses), one after another by themselves. A tap on a line or a tab
// shows that one and the round waits a while before it goes on.
Item {
    id: page
    property real reveal: 1
    readonly property var plan: controller.roadmap
    readonly property var columns: plan.columns || []
    // the column names roadmap.json uses, written out so they reach the translations (tools/lang_extract.py)
    readonly property var names: [qsTr("OUT NOW"), qsTr("IN TESTING"), qsTr("COMING UP"), qsTr("LATER")]
    property int col: 0                       // the column in the list
    property var selected: null               // the line on the stage
    // every line with a picture, in order: the round goes through these
    readonly property var cast: {
        const out = []
        for (let c = 0; c < columns.length; ++c)
            for (const item of (columns[c].items || [])) if (item.arts && item.arts.length > 0) out.push({ col: c, item: item })
        return out
    }
    // what Main puts on the stage while this page is open
    readonly property var showing: reveal > 0.01 ? selected : null
    readonly property var items: columns.length > 0 ? (columns[Math.min(col, columns.length - 1)].items || []) : []
    readonly property color tone: selected && selected.accent ? selected.accent : Theme.cyan

    visible: reveal > 0.001
    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
    readonly property real extra: Math.max(0, height - 720)

    function castAt(item) { for (let i = 0; i < cast.length; ++i) if (cast[i].item.id === item.id) return i; return -1 }
    function next() {
        if (cast.length === 0) return
        const at = selected ? castAt(selected) : -1
        const n = cast[(at + 1) % cast.length]
        col = n.col; selected = n.item
    }
    function choose(item, c) { col = c; selected = item; wait.restart(); round.progress = 0 }
    function chooseColumn(c) {
        const first = cast.find(e => e.col === c)
        choose(first ? first.item : ((columns[c].items || [])[0] || null), c)
    }
    onCastChanged: if (!selected && cast.length > 0) { col = cast[0].col; selected = cast[0].item }
    Component.onCompleted: if (!selected && cast.length > 0) { col = cast[0].col; selected = cast[0].item }

    // the round: a new character every few seconds, unless the list is under the pointer or a tap is recent
    Timer { id: wait; interval: 15000 }
    QtObject {
        id: round
        property real progress: 0
        readonly property bool running: page.visible && page.reveal > 0.99 && page.cast.length > 1 && !wait.running
                                        && !over.hovered && !Theme.modal && !Theme.calm
    }
    Timer {      // counts the time that really passed, so a slow frame never stretches the wait
        property real last: 0
        interval: 50; repeat: true
        running: round.running
        onRunningChanged: last = Date.now()
        onTriggered: {
            const now = Date.now()
            round.progress += Math.min(2000, now - last) / 6000
            last = now
            if (round.progress >= 1) { round.progress = 0; page.next() }
        }
    }

    Column {
        objectName: "roadmapWords"
        x: 128; y: 104 + page.extra * 0.2
        width: 560
        spacing: 0
        Row {
            spacing: 10
            opacity: page.ease(page.reveal * 3)
            NavGlyph { width: 15; height: 15; kind: "roadmap"; tone: Theme.cyan; stroke: 1.4; anchors.verticalCenter: parent.verticalCenter }
            Text {
                text: qsTr("ROADMAP") + (page.plan.updated ? "     " + page.plan.updated : "")
                font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 3
                color: Theme.cyan
            }
            // not yet read and passed by the lead: says so
            Text {
                objectName: "roadmapDraft"
                visible: page.plan.approved === false
                text: qsTr("DRAFT")
                font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 3
                color: Theme.amber
            }
        }
        Item { width: 1; height: 12 }
        Item {
            width: parent.width; height: 56
            clip: true
            readonly property real shows: page.ease(page.reveal * 2.6 - 0.25)
            DecodeText {
                y: (1 - parent.shows) * 58
                text: qsTr("WHAT COMES NEXT")
                run: parent.shows > 0.05
                font.family: Theme.display; font.pixelSize: 46; font.letterSpacing: 1.6
                color: Theme.text
            }
        }
        Item { width: 1; height: 10 }
        Rule { width: 250; grow: page.ease(page.reveal * 2.4 - 0.7); strength: 0.6 }
        Item { width: 1; height: 22 }

        // the columns, as tabs
        Row {
            objectName: "roadmapTabs"
            spacing: 24
            opacity: page.ease(page.reveal * 2.4 - 0.8)
            Repeater {
                model: page.columns
                delegate: Item {
                    id: tab
                    required property int index
                    required property var modelData
                    objectName: "roadmapColumn"
                    readonly property bool chosen: page.col === index
                    width: word.implicitWidth + count.implicitWidth + 6; height: 18
                    readonly property bool tabStop: true
                    activeFocusOnTab: true
                    function press() { Sfx.play("press"); page.chooseColumn(index) }
                    Keys.onReturnPressed: press()
                    Keys.onEnterPressed: press()
                    Keys.onSpacePressed: press()
                    FocusMark { inset: -4 }
                    Text {
                        id: word
                        text: qsTr(String(tab.modelData.name || ""))
                        font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 2.6
                        color: tab.chosen ? Theme.text : tabOver.hovered ? Theme.line : Theme.dim
                        Behavior on color { ColorAnimation { duration: Theme.fast } }
                    }
                    Text {
                        id: count
                        x: word.implicitWidth + 6; y: -3
                        text: String((tab.modelData.items || []).length)
                        font.family: Theme.mono; font.pixelSize: 9
                        color: tab.chosen ? Theme.cyan : Theme.faint
                    }
                    Rectangle { y: 16; width: tab.chosen ? parent.width : 0; height: 1.5; color: Theme.cyan
                                Behavior on width { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } } }
                    HoverHandler { id: tabOver; cursorShape: Qt.PointingHandCursor }
                    TapHandler { onTapped: tab.press() }
                }
            }
        }
        Item { width: 1; height: 16 }

        // the chosen column's lines
        Item {
            id: panel
            objectName: "roadmapList"
            readonly property real shows: page.ease(page.reveal * 2.4 - 1.0)
            width: parent.width
            height: page.height - page.extra * 0.2 - 375
            opacity: shows
            transform: Translate { y: (1 - panel.shows) * 18 }
            GlassPanel { anchors.fill: parent; reveal: panel.shows; tone: Theme.line; strength: 0.6; shade: 0.7 }
            HoverHandler { id: over }
            Flickable {
                id: flick
                x: 8; y: 10
                width: parent.width - 16; height: parent.height - 20
                contentHeight: list.implicitHeight
                clip: true
                boundsBehavior: Flickable.StopAtBounds
                Behavior on contentY { enabled: !flick.moving; NumberAnimation { duration: 420; easing.type: Easing.OutCubic } }
                Column {
                    id: list
                    width: parent.width
                    spacing: 2
                    Repeater {
                        model: page.items
                        delegate: Item {
                            id: line
                            required property int index
                            required property var modelData
                            readonly property bool chosen: page.selected !== null && page.selected.id === modelData.id
                            readonly property bool pictured: (modelData.arts || []).length > 0
                            readonly property color tone: modelData.accent ? modelData.accent : Theme.cyan
                            width: list.width
                            height: words.implicitHeight + 20
                            readonly property bool tabStop: true
                            activeFocusOnTab: true
                            function press() { Sfx.play("press"); page.choose(modelData, page.col) }
                            Keys.onReturnPressed: press()
                            Keys.onEnterPressed: press()
                            Keys.onSpacePressed: press()
                            onChosenChanged: if (chosen) {       // the line the round is on stays in view
                                const top = y, bottom = y + height
                                if (top < flick.contentY) flick.contentY = Math.max(0, top - 6)
                                else if (bottom > flick.contentY + flick.height) flick.contentY = Math.min(flick.contentHeight - flick.height, bottom - flick.height + 6)
                            }
                            FocusMark { inset: 2 }
                            Rectangle {
                                anchors.fill: parent
                                color: line.tone
                                opacity: line.chosen ? 0.10 : lineOver.hovered ? 0.05 : 0
                                Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                            }
                            Rectangle {
                                x: 0; y: 8; width: 3; height: parent.height - 16
                                color: line.tone
                                opacity: line.chosen ? 1 : 0
                                Behavior on opacity { NumberAnimation { duration: Theme.base } }
                            }
                            HexMark {
                                x: 16; y: 13
                                width: 12; height: 12
                                fill: line.chosen || page.col === 0 ? 1 : 0
                                tone: line.chosen ? line.tone : (page.col === 0 ? Theme.cyan : Theme.line)
                                outline: line.chosen ? line.tone : (page.col === 0 ? Theme.cyan : Theme.line)
                                stroke: 1.1
                            }
                            Column {
                                id: words
                                x: 40; y: 10
                                width: parent.width - 40 - 40
                                spacing: 3
                                Text {
                                    width: parent.width
                                    text: String(line.modelData.title || "").toUpperCase()
                                    textFormat: Text.PlainText
                                    wrapMode: Text.WordWrap
                                    font.family: Theme.display; font.pixelSize: 14; font.letterSpacing: 1.2
                                    color: line.chosen ? Theme.text : Theme.line
                                }
                                Text {
                                    width: parent.width
                                    visible: text !== ""
                                    text: String(line.modelData.text || "")
                                    textFormat: Text.PlainText
                                    wrapMode: Text.WordWrap
                                    font.family: Theme.body; font.pixelSize: 13; lineHeight: 1.25
                                    color: Theme.dim
                                }
                            }
                            // a line with a character on the stage carries a small mark
                            Item {
                                visible: line.pictured
                                anchors.right: parent.right; anchors.rightMargin: 16
                                y: 13; width: 14; height: 14
                                Rectangle { anchors.fill: parent; radius: 7; color: "transparent"; border.color: line.tone; border.width: 1; opacity: line.chosen ? 1 : 0.45 }
                                Rectangle { anchors.centerIn: parent; width: 4; height: 4; radius: 2; color: line.tone; opacity: line.chosen ? 1 : 0.45 }
                            }
                            HoverHandler { id: lineOver; cursorShape: Qt.PointingHandCursor }
                            TapHandler { onTapped: line.press() }
                        }
                    }
                }
            }
        }
        Text {
            visible: page.columns.length === 0
            text: qsTr("This window carries no roadmap.")
            font.family: Theme.body; font.pixelSize: 15
            color: Theme.dim
        }
    }

    // ---- the plate on the stage: which column, which of its pictures, and the name ---------------------------------
    Item {
        id: plate
        objectName: "roadmapPlate"
        readonly property real shows: page.ease(page.reveal * 2.2 - 1.0)
        readonly property int place: page.selected ? page.items.findIndex(i => i.id === page.selected.id) : -1
        visible: page.selected !== null && shows > 0.001
        width: Math.max(300, Math.min(640, name.implicitWidth + 50)); height: 70
        x: page.width - 44 - width + (1 - shows) * 30
        y: page.height - 100 - 22 - height
        opacity: shows
        GlassPanel { anchors.fill: parent; tone: page.tone; reveal: plate.shows }
        Rectangle { x: 0; y: 8; width: 3; height: parent.height - 16; color: page.tone }
        Text {
            x: 20; y: 12
            text: qsTr(String(page.columns.length > 0 ? page.columns[Math.min(page.col, page.columns.length - 1)].name || "" : ""))
                  + (plate.place >= 0 ? "   " + String(plate.place + 1).padStart(2, "0") + " / " + String(page.items.length).padStart(2, "0") : "")
            font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2.6
            color: page.tone
        }
        DecodeText {
            id: name
            x: 20; y: 30
            text: page.selected ? String(page.selected.title || "").toUpperCase() : ""
            run: plate.shows > 0.2
            font.family: Theme.display; font.pixelSize: 22; font.letterSpacing: 1.4
            color: Theme.text
        }
        // the wait for the next one, along the plate's foot
        Rectangle {
            x: 3; anchors.bottom: parent.bottom
            height: 1.5
            width: (parent.width - 3) * (round.running ? round.progress : 1)
            color: page.tone
            opacity: 0.7
        }
    }
}
