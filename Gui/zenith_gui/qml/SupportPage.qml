import QtQuick
import Qt5Compat.GraphicalEffects

// Support: the people who make the Terminal and its mods, each with a link to their own Ko-fi page.
// The links open in the person's browser; nothing is bought or unlocked here.
Item {
    id: page
    property real reveal: 1
    property var people: []        // [{name, role, site, url}] (links.json)
    signal open(string url)
    signal copy(string url)

    visible: reveal > 0.001
    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

    // a window taller than the layout's 720 units: the blocks share the extra room
    readonly property real extra: Math.max(0, height - 720)

    Column {
        objectName: "supportWords"
        x: 128; y: 112 + page.extra * 0.3
        width: 660
        spacing: 0

        Row {
            spacing: 10
            opacity: page.ease(page.reveal * 3)
            NavGlyph { width: 15; height: 15; kind: "support"; tone: Theme.rose; stroke: 1.4; anchors.verticalCenter: parent.verticalCenter }
            Text {
                text: qsTr("SUPPORT")
                font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 3
                color: Theme.rose
            }
        }
        Item { width: 1; height: 14 }
        Repeater {
            model: [qsTr("THE PEOPLE"), qsTr("BEHIND IT")]
            delegate: Item {
                required property int index
                required property string modelData
                readonly property real shows: page.ease(page.reveal * 2.6 - 0.25 - index * 0.28)
                width: 660; height: 56
                clip: true
                DecodeText {
                    y: (1 - parent.shows) * 58
                    text: parent.modelData
                    run: parent.shows > 0.05
                    font.family: Theme.display; font.pixelSize: 50; font.letterSpacing: 1.6
                    color: Theme.text
                }
            }
        }
        Item { width: 1; height: 14 }
        Rule { width: 250; grow: page.ease(page.reveal * 2.4 - 0.7); strength: 0.6 }
        Item { width: 1; height: 16 }
        Text {
            width: 560
            text: qsTr("The Terminal and every mod in it are free, and they stay free. If you want to say thanks, these are the people who make them. A tip buys nothing and unlocks nothing: it helps them keep going.")
            wrapMode: Text.WordWrap
            font.family: Theme.body; font.pixelSize: 16
            lineHeight: 1.36
            color: "#c6cfdc"
            opacity: page.ease(page.reveal * 2.4 - 0.8)
        }
    }

    // the emblem: a heart that beats inside turning rings, each beat sending a ring out
    Item {
        id: emblem
        x: page.width - 340; y: 108 + page.extra * 0.3
        width: 250; height: 250
        opacity: page.ease(page.reveal * 2.2 - 0.8)
        property real turn: 0
        property real beat: 0
        property real ring: 1
        NumberAnimation on turn { from: 0; to: 360; duration: 80000; loops: Animation.Infinite; running: !Theme.calm && page.visible }
        SequentialAnimation {
            loops: Animation.Infinite
            running: !Theme.calm && page.visible
            ScriptAction { script: emblem.ring = 0 }
            ParallelAnimation {
                NumberAnimation { target: emblem; property: "ring"; from: 0; to: 1; duration: 1500; easing.type: Easing.OutCubic }
                SequentialAnimation {
                    NumberAnimation { target: emblem; property: "beat"; to: 1; duration: 110; easing.type: Easing.OutQuad }
                    NumberAnimation { target: emblem; property: "beat"; to: 0.15; duration: 200; easing.type: Easing.InQuad }
                    NumberAnimation { target: emblem; property: "beat"; to: 0.7; duration: 100; easing.type: Easing.OutQuad }
                    NumberAnimation { target: emblem; property: "beat"; to: 0; duration: 420; easing.type: Easing.InOutQuad }
                }
            }
            PauseAnimation { duration: 500 }
        }
        RadialGradient {
            anchors.centerIn: parent
            width: 300; height: 300
            gradient: Gradient {
                GradientStop { position: 0.0; color: Qt.rgba(1, 0.25, 0.42, 0.20 + 0.14 * emblem.beat) }
                GradientStop { position: 0.3; color: Qt.rgba(1, 0.25, 0.42, 0.06) }
                GradientStop { position: 0.5; color: Qt.rgba(1, 0.25, 0.42, 0.0) }
            }
        }
        // the ring a beat sends out
        Rectangle {
            anchors.centerIn: parent
            width: 120 + 180 * emblem.ring; height: width; radius: width / 2
            color: "transparent"
            border.width: 1.5; border.color: Theme.rose
            opacity: (1 - emblem.ring) * 0.7
        }
        HexMark { anchors.fill: parent; stroke: 1.2; outline: Theme.line; opacity: 0.30; rotation: emblem.turn }
        HexMark { anchors.centerIn: parent; width: 192; height: 192; stroke: 1.4; outline: Theme.rose; opacity: 0.55; rotation: -emblem.turn * 1.6 }
        // the tick ring
        Repeater {
            model: 48
            delegate: Rectangle {
                required property int index
                width: index % 4 === 0 ? 2 : 1; height: index % 4 === 0 ? 10 : 5
                x: emblem.width / 2 - width / 2; y: emblem.height / 2 - 76
                color: Theme.rose
                opacity: index % 4 === 0 ? 0.7 : 0.35
                transform: Rotation { origin.x: width / 2; origin.y: 76; angle: index * 7.5 + emblem.turn * 0.8 }
            }
        }
        NavGlyph {
            anchors.centerIn: parent
            width: 78; height: 78
            kind: "support"; tone: Qt.tint(Theme.text, Qt.rgba(1, 0.25, 0.42, 0.35 * emblem.beat)); stroke: 1.8
            scale: 1 + 0.09 * emblem.beat
        }
    }

    Row {
        objectName: "supportCards"
        x: 128; y: 384 + page.extra * 0.6
        spacing: 20
        Repeater {
            model: page.people
            delegate: Item {
                id: card
                required property int index
                required property var modelData
                readonly property real shows: page.ease(page.reveal * 2.6 - 1.0 - index * 0.26)
                width: 436; height: 184
                opacity: shows
                transform: Translate { y: (1 - card.shows) * 22 }

                GlassPanel {
                    anchors.fill: parent
                    tone: Theme.rose
                    reveal: card.shows
                    strength: over.hovered ? 1.0 : 0.6
                    Behavior on strength { NumberAnimation { duration: Theme.fast } }
                }

                Item {
                    id: crest
                    x: 24; y: 30
                    width: 58; height: 58
                    property real turn: 0
                    NumberAnimation on turn { from: 0; to: 360; duration: 60000; loops: Animation.Infinite; running: !Theme.calm }
                    HexMark { anchors.fill: parent; stroke: 1.2; outline: Theme.line; opacity: 0.55; rotation: crest.turn }
                    HexMark { anchors.centerIn: parent; width: 44; height: 44; stroke: 1.2; outline: Theme.rose; opacity: 0.7; rotation: -crest.turn * 1.5 }
                    Text {
                        anchors.centerIn: parent
                        text: String(card.modelData.name).charAt(0).toUpperCase()
                        font.family: Theme.display; font.pixelSize: 22
                        color: Theme.text
                    }
                }
                Column {
                    x: 104; y: 26
                    width: parent.width - 128
                    spacing: 6
                    Text {
                        text: String(card.modelData.name).toUpperCase()
                        font.family: Theme.display; font.pixelSize: 21; font.letterSpacing: 1.8
                        color: Theme.text
                    }
                    Text {
                        width: parent.width
                        text: card.modelData.role
                        wrapMode: Text.WordWrap
                        maximumLineCount: 2
                        elide: Text.ElideRight
                        font.family: Theme.body; font.pixelSize: 14
                        lineHeight: 1.25
                        color: Theme.dim
                    }
                    Text {
                        text: card.modelData.site
                        font.family: Theme.mono; font.pixelSize: 13; font.letterSpacing: 0.4
                        color: Theme.cyan
                    }
                }
                Row {
                    x: 24; y: parent.height - 58
                    spacing: 20
                    PrimaryButton {
                        implicitWidth: 176; implicitHeight: 40
                        label: qsTr("OPEN KO-FI")
                        compact: true
                        onClicked: page.open(card.modelData.url)
                    }
                    GhostButton { label: qsTr("COPY LINK"); anchors.verticalCenter: parent.verticalCenter; onClicked: page.copy(card.modelData.url) }
                }
                HoverHandler { id: over }
            }
        }
    }

    Text {
        objectName: "supportNote"
        x: 128; y: 580 + page.extra * 0.8
        width: 900
        text: qsTr("Ko-fi is a separate site that opens in your browser. This is an unofficial fan project: BlazBlue Entropy Effect belongs to 91Act and Arc System Works, and the other characters to their owners.")
        wrapMode: Text.WordWrap
        font.family: Theme.body; font.pixelSize: 12
        color: Theme.faint
        opacity: page.ease(page.reveal * 2.4 - 1.3)
    }
}
