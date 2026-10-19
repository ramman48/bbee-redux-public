import QtQuick

// Home: where things stand, in a few large words, and the characters in the Library as cards. The
// window draws the featured character's pictures behind this page and moves on to the next one by
// itself; a card under the pointer is shown at once, and a press opens it in the Library.
Item {
    id: page
    property real reveal: 1
    property var heroes: []        // the mods with a face to show
    property int featured: 0
    property real cycle: 0         // 0..1: how far the wait for the next one has got
    property string state: ""
    property int wanted: 0         // how many mods are switched on
    property int updates: 0        // how many mods in the game have a newer version in the Library
    property string gameBuild: ""
    property string installedAt: ""
    signal picked(int index)
    signal hovered(int index)      // -1: the pointer left the cards
    property string tab: "library" // under the words: library | news | status
    readonly property var posts: controller.news           // the team's news, shipped with the window
    // NEWS open: the posts that carry pictures stand on the stage one after another (a tap on a post shows it)
    readonly property var pictured: posts.filter(p => p.arts && p.arts.length > 0)
    property int newsAt: 0
    property real newsCycle: 0
    readonly property var newsShowing: tab === "news" && reveal > 0.01 && pictured.length > 0 ? pictured[newsAt % pictured.length] : null
    Timer {      // counts the time that really passed, so a slow frame never stretches the wait
        property real last: 0
        interval: 50; repeat: true
        running: page.newsShowing !== null && page.pictured.length > 1 && !Theme.modal && !Theme.calm
        onRunningChanged: last = Date.now()
        onTriggered: {
            const now = Date.now()
            page.newsCycle += Math.min(2000, now - last) / 7000
            last = now
            if (page.newsCycle >= 1) { page.newsCycle = 0; page.newsAt = (page.newsAt + 1) % page.pictured.length }
        }
    }
    readonly property var lights: controller.statusLights
    readonly property int ready: controller.available.length   // updates the quiet check found (improvement 2)

    visible: reveal > 0.001
    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

    readonly property string count: wanted + (wanted === 1 ? qsTr(" MOD") : qsTr(" MODS"))
    readonly property var lines: state === "installed" ? [qsTr("YOU ARE SET")]
                               : state === "changes" ? [qsTr("CHANGES"), qsTr("WAITING")]
                               : state === "ready" ? (wanted > 0 ? [count + qsTr(" READY"), qsTr("TO INSTALL")] : [qsTr("NOTHING"), qsTr("SWITCHED ON")])
                               : state === "setup" ? [qsTr("ONE SETUP"), qsTr("STEP FIRST")]
                               : state === "behind" ? [qsTr("THIS COPY"), qsTr("IS BEHIND")]
                               : [qsTr("FIRST,"), qsTr("YOUR GAME")]
    readonly property bool onCopy: controller.gameCopy !== ""      // a game copy is being set up, not the Steam game
    readonly property string advice: state === "installed" ? (onCopy ? (wanted === 1 ? qsTr("1 mod is in this copy. Press Play.") : qsTr("%1 mods are in this copy. Press Play.").arg(wanted))
                                                                     : (wanted === 1 ? qsTr("1 mod is in your game. Press Play, or start it from Steam.") : qsTr("%1 mods are in your game. Press Play, or start it from Steam.").arg(wanted)))
                                                            + " " + qsTr("New characters are at the end of the Prototype list.")
                                   : state === "behind" ? qsTr("The game was updated after this copy was made. Press Update copy: it takes the files that changed and puts its mods back in. Its saves stay.")
                                   : state === "changes" ? (updates > 0 ? (updates === 1 ? qsTr("A newer version of a mod is in your Library. Press Apply changes and your game is rebuilt with it. Your save is backed up first.")
                                                                                       : qsTr("Newer versions of %1 mods are in your Library. Press Apply changes and your game is rebuilt with them. Your save is backed up first.").arg(updates))
                                                                       : qsTr("You switched something. Press Apply changes and your game is rebuilt to match. Your save is backed up first."))
                                   : state === "ready" ? (wanted > 0 ? qsTr("Press Install and they are built into your game. Your save is backed up first.") : qsTr("Press Play to start the game as it is, or open the Library and switch a mod on."))
                                   : state === "setup" ? qsTr("The game's data has to be read for this build of the game. Press Set up and install; it takes a few minutes.")
                                   : qsTr("Press Set up and install. The Terminal finds Entropy Effect on this PC and reads its data once, which takes a few minutes.")
    readonly property string tag: state === "installed" ? qsTr("INSTALLED") : (state === "changes" ? qsTr("NOT APPLIED YET") : (state === "ready" && wanted > 0 ? qsTr("READY") : qsTr("TO DO")))
    readonly property color tagTone: state === "changes" || tag === "TO DO" ? Theme.amber : Theme.cyan

    // a window taller than the layout's 720 units: the words and the cards share the extra room
    readonly property real extra: Math.max(0, height - 720)
    // the cards (or what was just updated) sit under the words, however many lines the advice takes
    readonly property real below: Math.max(388 + extra * 0.7, words.y + words.height + 18)

    Column {
        id: words
        objectName: "homeWords"
        x: 128; y: 112 + page.extra * 0.3
        width: 520
        spacing: 0

        Row {
            spacing: 10
            opacity: page.ease(page.reveal * 3)
            HexMark {
                width: 14; height: 14
                anchors.verticalCenter: parent.verticalCenter
                fill: page.state === "installed" ? 1 : 0.55
                tone: page.tagTone; outline: page.tagTone
                stroke: 1.2
            }
            Text {
                text: page.tag
                font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 3
                color: page.tagTone
            }
        }
        Item { width: 1; height: 14 }
        // each line of the headline rises into place behind its own edge
        Repeater {
            model: page.lines
            delegate: Item {
                required property int index
                required property string modelData
                readonly property real shows: page.ease(page.reveal * 2.6 - 0.25 - index * 0.28)
                width: 520; height: 56
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
            width: 452
            text: page.advice.charAt(0).toUpperCase() + page.advice.slice(1)
            wrapMode: Text.WordWrap
            font.family: Theme.body; font.pixelSize: 16
            lineHeight: 1.36
            color: "#c6cfdc"
            opacity: page.ease(page.reveal * 2.4 - 0.8)
        }
        Item { width: 1; height: 12 }
        Text {
            text: (page.gameBuild ? qsTr("GAME BUILD ") + page.gameBuild : qsTr("GAME NOT FOUND YET"))
                  + (page.installedAt ? qsTr("    /    LAST INSTALL ") + page.installedAt.slice(0, 16) : "")
            font.family: Theme.mono; font.pixelSize: 12; font.letterSpacing: 0.6
            color: Theme.faint
            opacity: page.ease(page.reveal * 2.4 - 1.0)
        }
        // what the quiet check found, one press away
        Item { width: 1; height: getUpdates.visible ? 14 : 0 }
        OutlineButton {
            id: getUpdates
            objectName: "getUpdates"
            visible: page.ready > 0 && !controller.busy && page.state !== "behind"
            label: qsTr("GET ") + page.ready + (page.ready === 1 ? qsTr(" UPDATE") : qsTr(" UPDATES"))
            tone: Theme.cyan
            opacity: page.ease(page.reveal * 2.4 - 1.0)
            onClicked: controller.checkUpdates()
        }
    }

    // ---- just updated: what the updater brought, in the cards' place until it is put away -----------------------
    readonly property var news: controller.whatsNew
    Item {
        objectName: "homeNews"
        x: 128; y: page.below
        width: 520; height: 224
        visible: page.news.length > 0
        opacity: page.ease(page.reveal * 2.4 - 0.9)

        Text {
            text: qsTr("JUST UPDATED")
            font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 2.6
            color: Theme.cyan
        }
        Text {
            anchors.right: parent.right
            text: qsTr("GOT IT")
            font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 2.6
            color: gotIt.containsMouse ? Theme.text : Theme.dim
            MouseArea { id: gotIt; anchors.fill: parent; anchors.margins: -8; hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor; onClicked: controller.putAwayWhatsNew() }
        }
        Rectangle {
            y: 24; width: parent.width; height: Math.min(196, newsList.implicitHeight + 28)
            color: Qt.rgba(0.04, 0.07, 0.11, 0.86); border.color: Qt.rgba(0.31, 0.86, 0.94, 0.28); border.width: 1
            Column {
                id: newsList
                x: 18; y: 14; width: parent.width - 36
                spacing: 10
                Repeater {
                    model: page.news.slice(0, 4)
                    delegate: Column {
                        required property var modelData
                        width: parent.width
                        spacing: 3
                        Row {
                            spacing: 12
                            Text {
                                text: modelData.title.toUpperCase()
                                font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.6
                                color: Theme.text
                            }
                            Text {
                                anchors.baseline: parent.children[0].baseline
                                text: (modelData.from ? "V" + modelData.from + "  >  " : qsTr("NEW  ")) + "V" + modelData.to
                                font.family: Theme.mono; font.pixelSize: 12
                                color: Theme.cyan
                            }
                        }
                        Text {
                            visible: modelData.notes.length > 0
                            width: parent.width
                            text: modelData.notes.slice(0, page.news.length > 2 ? 1 : 2).join("  /  ")
                            elide: Text.ElideRight
                            font.family: Theme.body; font.pixelSize: 13
                            color: "#9aa6b8"
                        }
                    }
                }
                Text {
                    visible: page.news.length > 4
                    text: qsTr("AND ") + (page.news.length - 4) + qsTr(" MORE")
                    font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2
                    color: Theme.dim
                }
            }
        }
    }

    // ---- the featured one's plate: low on the right, over its pictures ----------------------------------------------
    Item {
        id: plate
        objectName: "homePlate"
        readonly property bool post: page.newsShowing !== null         // a news post's picture is on the stage
        readonly property var hero: post ? page.newsShowing
                                    : page.heroes.length > 0 ? page.heroes[Math.min(page.featured, page.heroes.length - 1)] : null
        readonly property color accent: hero && hero.accent ? hero.accent : Theme.cyan
        readonly property real shows: page.ease(page.reveal * 2.2 - 1.0)
        visible: hero !== null && shows > 0.001
        width: Math.max(300, Math.min(plate.post ? 540 : 420, title.implicitWidth + (plate.post ? 50 : 150))); height: 70
        x: page.width - 44 - width + (1 - shows) * 30
        y: page.height - 100 - 22 - height
        opacity: shows
        GlassPanel { anchors.fill: parent; tone: plate.accent; reveal: plate.shows }
        Rectangle { x: 0; y: 8; width: 3; height: parent.height - 16; color: plate.accent }
        Text {
            x: 20; y: 12
            text: plate.post ? qsTr("NEWS") + "   " + String(plate.hero.date || "")
                  : qsTr("FEATURED   ") + String(page.featured + 1).padStart(2, "0") + " / " + String(page.heroes.length).padStart(2, "0")
            font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2.6
            color: plate.accent
        }
        DecodeText {
            id: title
            x: 20; y: 30
            text: plate.hero ? plate.hero.title.toUpperCase() : ""
            run: plate.shows > 0.2
            font.family: Theme.display; font.pixelSize: plate.post ? 18 : 22; font.letterSpacing: 1.4
            color: Theme.text
        }
        Column {
            visible: !plate.post
            anchors.right: parent.right; anchors.rightMargin: 18
            anchors.verticalCenter: parent.verticalCenter
            spacing: 4
            Text {
                anchors.right: parent.right
                text: plate.hero ? "V" + plate.hero.version : ""
                font.family: Theme.mono; font.pixelSize: 12
                color: Theme.dim
            }
            Row {
                anchors.right: parent.right
                spacing: 6
                HexMark {
                    width: 10; height: 10
                    anchors.verticalCenter: parent.verticalCenter
                    fill: plate.hero && plate.hero.enabled ? 1 : 0
                    tone: plate.accent; outline: plate.hero && plate.hero.enabled ? plate.accent : Theme.faint
                    stroke: 1.1
                }
                Text {
                    text: plate.hero ? (plate.hero.installed ? qsTr("IN GAME") : (plate.hero.enabled ? qsTr("ON") : qsTr("OFF"))) : ""
                    font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2
                    color: Theme.text
                }
            }
        }
        // the wait for the next one, along the plate's foot
        Rectangle {
            x: 3; anchors.bottom: parent.bottom
            height: 1.5
            width: (parent.width - 3) * (plate.post ? (page.pictured.length > 1 ? page.newsCycle : 1)
                                         : page.heroes.length > 1 ? page.cycle : 1)
            color: plate.accent
            opacity: 0.7
        }
    }

    // ---- the characters ---------------------------------------------------------------------------------------
    Item {
        objectName: "homeCards"
        x: 128; y: page.below
        width: 560; height: 224
        visible: page.news.length === 0

        // three tabs: the characters, the team's news, and how things stand
        Row {
            objectName: "homeTabs"
            spacing: 26
            opacity: page.ease(page.reveal * 2.4 - 0.9)
            Repeater {
                model: [{ id: "library", label: qsTr("IN YOUR LIBRARY") }, { id: "news", label: qsTr("NEWS") }, { id: "status", label: qsTr("STATUS") }]
                delegate: Item {
                    id: tabItem
                    required property var modelData
                    readonly property bool chosen: page.tab === modelData.id
                    width: tabWord.implicitWidth; height: 18
                    readonly property bool tabStop: true
                    activeFocusOnTab: true
                    function press() { Sfx.play("press"); page.tab = modelData.id; if (modelData.id === "status") controller.refreshStatus() }
                    Keys.onReturnPressed: press()
                    Keys.onEnterPressed: press()
                    Keys.onSpacePressed: press()
                    FocusMark { inset: -4 }
                    Text {
                        id: tabWord
                        text: tabItem.modelData.label
                        font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 2.6
                        color: tabItem.chosen ? Theme.text : tabHover.hovered ? Theme.line : Theme.dim
                        Behavior on color { ColorAnimation { duration: Theme.fast } }
                    }
                    Rectangle { y: 16; width: tabItem.chosen ? parent.width : 0; height: 1.5; color: Theme.cyan
                                Behavior on width { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } } }
                    HoverHandler { id: tabHover; cursorShape: Qt.PointingHandCursor }
                    TapHandler { onTapped: tabItem.press() }
                }
            }
        }
        Text {
            visible: page.tab === "library" && page.heroes.length === 0
            y: 34
            text: qsTr("No character is in your Library yet.")
            font.family: Theme.body; font.pixelSize: 14
            color: Theme.dim
        }
        // the team's news
        Flickable {
            objectName: "homePosts"
            visible: page.tab === "news"
            y: 30; width: 520; height: 190
            contentHeight: postList.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            Column {
                id: postList
                width: parent.width
                spacing: 14
                Text {
                    visible: page.posts.length === 0
                    text: qsTr("No news in this version of the Terminal.")
                    font.family: Theme.body; font.pixelSize: 14
                    color: Theme.dim
                }
                Repeater {
                    model: page.posts
                    delegate: Column {
                        id: postItem
                        required property var modelData
                        readonly property int picture: page.pictured.findIndex(p => p.id === modelData.id)
                        readonly property bool onStage: page.newsShowing !== null && page.newsShowing.id === modelData.id
                        width: postList.width
                        spacing: 4
                        TapHandler {
                            enabled: postItem.picture >= 0
                            onTapped: { Sfx.play("press"); page.newsAt = postItem.picture; page.newsCycle = 0 }
                        }
                        HoverHandler { enabled: postItem.picture >= 0; cursorShape: Qt.PointingHandCursor }
                        Row {
                            spacing: 12
                            Rectangle {     // the post whose picture is on the stage
                                visible: postItem.picture >= 0
                                width: 3; height: 13
                                anchors.verticalCenter: parent.verticalCenter
                                color: postItem.modelData.accent ? postItem.modelData.accent : Theme.cyan
                                opacity: postItem.onStage ? 1 : 0.25
                            }
                            Text {
                                text: String(modelData.title).toUpperCase()
                                textFormat: Text.PlainText
                                font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.6
                                color: Theme.text
                            }
                            Text {
                                text: String(modelData.date || "")
                                font.family: Theme.mono; font.pixelSize: 12
                                color: Theme.faint
                            }
                        }
                        Text {
                            width: parent.width
                            text: String(modelData.text || "")
                            textFormat: Text.PlainText
                            wrapMode: Text.WordWrap
                            font.family: Theme.body; font.pixelSize: 13; lineHeight: 1.28
                            color: "#9aa6b8"
                        }
                    }
                }
            }
        }
        // how things stand: a light per line
        Column {
            objectName: "homeStatus"
            visible: page.tab === "status"
            y: 32; width: 560
            spacing: 9
            Repeater {
                model: page.lights
                delegate: Row {
                    required property var modelData
                    spacing: 10
                    readonly property color tone: modelData.state === "bad" ? Theme.rose : modelData.state === "warn" ? Theme.amber
                                                  : modelData.state === "ok" ? Theme.cyan : Theme.faint
                    HexMark {
                        y: 2
                        width: 11; height: 11
                        fill: modelData.state === "off" ? 0 : 1
                        tone: parent.tone; outline: parent.tone; stroke: 1.1
                    }
                    Text {
                        width: 150
                        text: qsTr(modelData.name)
                        font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 1.8
                        color: Theme.text
                    }
                    Text {
                        width: 380
                        text: modelData.text
                        wrapMode: Text.WordWrap
                        maximumLineCount: 2
                        elide: Text.ElideRight
                        font.family: Theme.body; font.pixelSize: 13
                        color: "#9aa6b8"
                    }
                }
            }
        }
        ListView {
            id: cards
            visible: page.tab === "library"
            y: 24
            width: parent.width; height: 196
            orientation: ListView.Horizontal
            spacing: 12
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            model: page.heroes
            delegate: Item {
                id: card
                required property int index
                required property var modelData
                readonly property var art: modelData.arts.length > 0 ? modelData.arts[0] : null
                readonly property bool chosen: index === page.featured
                readonly property real shows: page.ease(page.reveal * 2.6 - 1.0 - index * 0.2)
                width: 152; height: 196
                opacity: shows
                readonly property color accent: modelData.accent ? modelData.accent : Theme.cyan
                // where the pointer is on the card, 0..1; the card turns toward it
                property point at: Qt.point(0.5, 0.5)
                property real tiltX: over.hovered && !Theme.calm ? (0.5 - at.y) * 16 : 0
                property real tiltY: over.hovered && !Theme.calm ? (at.x - 0.5) * 20 : 0
                property real lift: over.hovered ? 1 : 0
                Behavior on tiltX { SmoothedAnimation { velocity: 60 } }
                Behavior on tiltY { SmoothedAnimation { velocity: 60 } }
                Behavior on lift { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
                z: lift
                transform: [
                    Translate { y: (1 - card.shows) * 20 - card.lift * 6 },
                    Rotation { origin.x: card.width / 2; origin.y: card.height / 2; axis { x: 0; y: 1; z: 0 } angle: card.tiltY },
                    Rotation { origin.x: card.width / 2; origin.y: card.height / 2; axis { x: 1; y: 0; z: 0 } angle: card.tiltX }
                ]
                readonly property bool tabStop: true
                activeFocusOnTab: true
                Keys.onReturnPressed: page.picked(card.index)
                Keys.onEnterPressed: page.picked(card.index)
                Keys.onSpacePressed: page.picked(card.index)
                onActiveFocusChanged: page.hovered(activeFocus ? card.index : -1)
                FocusMark { inset: -3; z: 2 }

                Rectangle {
                    anchors.fill: parent
                    color: "#ffffff"
                    opacity: card.chosen ? 0.09 : (over.hovered ? 0.055 : 0.028)
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                // the face, cut from the mod's own picture
                Item {
                    x: 1; y: 1
                    width: parent.width - 2; height: 136
                    clip: true
                    Rectangle { anchors.fill: parent; color: Theme.panel }
                    Image {
                        visible: card.art !== null
                        source: card.art ? card.art.src : ""
                        mipmap: true
                        readonly property real k: card.art ? card.art.card / Math.max(1, (card.art.b - card.art.t) * card.art.h) : 1
                        width: card.art ? card.art.w * k : 0
                        height: card.art ? card.art.h * k : 0
                        x: parent.width / 2 - (card.art ? card.art.fx : 0.5) * width
                        y: parent.height * 0.48 - (card.art ? card.art.fy : 0.2) * height
                        opacity: card.modelData.enabled ? 1 : 0.38
                        transformOrigin: Item.Center
                        scale: over.hovered || card.chosen ? 1.06 : 1
                        Behavior on scale { NumberAnimation { duration: Theme.slow; easing.type: Easing.OutCubic } }
                    }
                    Text {
                        visible: card.art === null
                        anchors.centerIn: parent
                        text: card.modelData.monogram
                        font.family: Theme.display; font.pixelSize: 54
                        color: Theme.dim
                    }
                    Rectangle {
                        anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
                        height: 54
                        gradient: Gradient {
                            GradientStop { position: 0; color: "#0005070b" }
                            GradientStop { position: 1; color: "#f005070b" }
                        }
                    }
                    ShaderEffect {
                        anchors.fill: parent
                        visible: Fx.full && card.art !== null
                        property point at: card.at
                        property real power: card.lift
                        property real time: 0
                        property color tone: card.accent
                        NumberAnimation on time { from: 0; to: 100; duration: 400000; loops: Animation.Infinite; running: card.lift > 0 }
                        fragmentShader: "shaders/foil.frag.qsb"
                    }
                }
                // the edge, lit in the mod's colour under the pointer
                Rectangle {
                    anchors.fill: parent
                    color: "transparent"
                    border.width: 1
                    border.color: card.accent
                    opacity: 0.15 + 0.7 * card.lift
                }
                Rectangle {
                    x: 0; y: 0; width: parent.width * card.lift; height: 2
                    color: card.accent
                    opacity: 0.9 * card.lift
                }
                Text {
                    x: 14; y: 146
                    width: parent.width - 28
                    text: card.modelData.title.toUpperCase()
                    elide: Text.ElideRight
                    font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 1
                    color: card.modelData.enabled ? Theme.text : Theme.dim
                }
                Row {
                    x: 14; y: 168
                    spacing: 7
                    HexMark {
                        width: 11; height: 11
                        anchors.verticalCenter: parent.verticalCenter
                        fill: card.modelData.enabled ? 1 : 0
                        outline: card.modelData.enabled ? Theme.cyan : Theme.faint
                        stroke: 1.1
                    }
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: (card.modelData.installed ? qsTr("IN GAME") : (card.modelData.enabled ? qsTr("ON") : qsTr("OFF"))) + qsTr("   V") + card.modelData.version
                        font.family: Theme.body; font.pixelSize: 11; font.letterSpacing: 0.8
                        color: Theme.dim
                    }
                }
                // the chosen card: the game's bracket marks, and a hairline that fills until the next one
                Rectangle {
                    width: 2; height: 30; y: 150
                    x: card.chosen ? 4 : -4
                    opacity: card.chosen ? 1 : 0
                    color: Theme.text
                    Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Rectangle {
                    width: 2; height: 30; y: 150
                    x: parent.width - width - (card.chosen ? 4 : -4)
                    opacity: card.chosen ? 1 : 0
                    color: Theme.text
                    Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Rectangle {
                    anchors.bottom: parent.bottom
                    height: 2
                    width: card.chosen ? parent.width * (page.heroes.length > 1 ? page.cycle : 1) : 0
                    color: card.modelData.accent ? card.modelData.accent : Theme.cyan
                    opacity: 0.9
                }
                HoverHandler {
                    id: over
                    cursorShape: Qt.PointingHandCursor
                    onHoveredChanged: { page.hovered(hovered ? card.index : -1); if (hovered) Sfx.play("tick") }
                    onPointChanged: card.at = Qt.point(Math.max(0, Math.min(1, point.position.x / card.width)),
                                                       Math.max(0, Math.min(1, point.position.y / card.height)))
                }
                TapHandler { onTapped: { Sfx.play("press"); page.picked(card.index) } }
            }
        }
    }
}
