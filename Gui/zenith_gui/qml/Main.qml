import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import Qt5Compat.GraphicalEffects

// The Zenith Terminal's window: a column of pages on the left (Home, Library, Options, Log, Support), the
// chosen page in the middle, the featured or chosen mod's own pictures on the right, and one big
// action at the bottom.
ApplicationWindow {
    id: win
    // The screens are laid out for 1280 x 720 and drawn at one scale, the smaller of width / 1280 and
    // height / 720; a wider or taller window gives the layout more of its own units (`lw` by `lh`).
    readonly property var opening: shell.opening()     // where it was left, fitted to the screens there are now
    x: opening.x; y: opening.y
    width: opening.width; height: opening.height
    minimumWidth: 960; minimumHeight: 540
    readonly property real unit: Math.max(0.05, Math.min(width / 1280, height / 720))
    readonly property real lw: width / unit
    readonly property real lh: height / unit
    readonly property bool filled: visibility === Window.Maximized || visibility === Window.FullScreen
    function toggleFill() { if (filled) showNormal(); else showMaximized() }
    // the size and place it has as a plain window, kept for the next time it opens
    property var plain: ({ x: opening.x, y: opening.y, width: opening.width, height: opening.height })
    Timer {
        id: settle
        interval: 300
        onTriggered: if (win.visibility === Window.Windowed) win.plain = { x: win.x, y: win.y, width: win.width, height: win.height }
    }
    onXChanged: settle.restart()
    onYChanged: settle.restart()
    onWidthChanged: settle.restart()
    onHeightChanged: settle.restart()
    property bool quitting: false          // the tray's QUIT, or the tray is off: closing ends the Terminal
    property bool toldTray: false
    onClosing: (close) => {
        shell.remember(plain.x, plain.y, plain.width, plain.height, filled)
        if (win.trayShown && !win.quitting) {
            close.accepted = false
            win.hide()
            if (!win.toldTray) { win.trayMessage(qsTr("The Zenith Terminal"), qsTr("Still here beside the clock. It says when an update is ready.")); win.toldTray = true }
        }
        else if (!shell.capture) Qt.callLater(Qt.quit)      // the app stays open while the tray holds it; else closing ends it
    }
    function showAgain() { win.show(); win.raise(); win.requestActivate() }
    visible: true
    color: Theme.bg
    title: qsTr("The Zenith Terminal")
    flags: shell.capture ? (Qt.Tool | Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus) : (Qt.Window | Qt.FramelessWindowHint)

    // ---- what is chosen ---------------------------------------------------------------------------------------
    property string page: "home"
    property string pageShown: "home"      // follows `page` once the old page has left
    property real pageIn: 0                // 0..1: the shown page's entrance
    readonly property var mods: controller.mods.filter(m => m.kind !== "CORE" || controller.settings.showCore)
    property int current: 0                // the Library's chosen mod
    readonly property var mod: mods.length > 0 ? mods[Math.min(current, mods.length - 1)] : null
    readonly property var heroes: {
        const faces = mods.filter(m => m.kind === "CHARACTER" && m.arts.length > 0)
        return faces.length > 0 ? faces : mods.filter(m => m.arts.length > 0)
    }
    property int featured: 0               // Home's featured character; it moves on by itself
    property int hoverHero: -1             // a card under the pointer is shown at once
    property real cycle: 0
    readonly property int heroAt: hoverHero >= 0 && hoverHero < heroes.length ? hoverHero : Math.min(featured, Math.max(0, heroes.length - 1))
    readonly property var hero: heroes.length > 0 ? heroes[heroAt] : null
    readonly property var stageWant: page === "home" ? (homePage.newsShowing || hero) : page === "library" ? mod
                                    : page === "roadmap" ? roadPage.showing : null
    readonly property string stageId: stageWant ? stageWant.id : ""
    property var shown: null               // the mod whose pictures and words are on screen
    property real swapIn: 0                // 0..1: they leave and come back when it changes
    property bool opened: false            // set once the window has put its first mod on show
    property string notice: ""
    readonly property bool reduxPowered: reduxPage.powered     // the Redux page has all four parts on (it warms the room)

    // the opening: each part of the screen has its own 0..1
    property real bgIn: 0
    property real headIn: 0
    property real railIn: 0
    property real footIn: 0

    // animation time in milliseconds since the window opened (a recording reads it to space its frames evenly)
    property real clock: 0
    property real demoWait: 0      // what the hand-played install screen waits on between its steps
    NumberAnimation on clock { from: 0; to: 36000000; duration: 36000000; loops: Animation.Infinite }

    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
    function go(name) { if (name !== page) page = name }

    Binding { target: Theme; property: "calm"; value: controller.settings.motion === "calm" }
    Binding { target: Fx; property: "quality"; value: controller.settings.graphics || "full" }
    Binding { target: Sfx; property: "on"; value: controller.settings.sound !== "off" && !shell.capture }     // a test or a recording is silent
    Binding { target: Sfx; property: "volume"; value: (controller.settings.volume === undefined ? 30 : controller.settings.volume) / 100 }
    Binding { target: Theme; property: "unit"; value: win.unit }
    Binding { target: Theme; property: "modal"; value: win.askOpen || controller.busy || textPanel.open }
    Binding { target: Theme; property: "keys"; value: shell.keys || win.padKeys }
    property bool padKeys: false           // a game controller was used: the focused control shows its mark
    // the control the keyboard is on (a button, a row, a choice): Space is its own then, not the Library's
    readonly property bool onControl: activeFocusItem !== null && activeFocusItem.tabStop === true
    Binding { target: Theme; property: "dpr"; value: Screen.devicePixelRatio }
    Component.onCompleted: {
        if (opening.maximized) showMaximized()
        if (controller.settings.startPage === "library") { page = "library"; pageShown = "library" }
        shown = stageWant
        opened = true
        Sfx.warm()
        Sfx.play("open")
        entrance.start()
        if (controller.hasLoaded) win.afterLoad()
    }
    // once the folders are read (0.5.0: after the window is on screen): what the updater just brought goes in by itself,
    // else a first open installs what is switched on, else a deleted mod with a newer version is asked about
    property bool afterLoadDone: false
    function afterLoad() {
        if (afterLoadDone) return
        afterLoadDone = true
        if (!controller.applyArrivedUpdates() && !controller.firstOpen()) offerTimer.start()
        Qt.callLater(controller.refreshStatus)
    }
    Connections { target: controller; function onLoaded() { win.afterLoad() } }

    onPageChanged: { pageSwap.restart(); sweep.restart() }
    onStageIdChanged: if (opened && stageId !== "" && (!shown || shown.id !== stageId)) swap.restart()
    onModsChanged: {
        if (current >= mods.length) current = Math.max(0, mods.length - 1)
        if (shown) { const now = mods.find(m => m.id === shown.id); if (now) shown = now }
    }
    onHeroesChanged: if (featured >= heroes.length) featured = 0
    onNoticeChanged: if (notice !== "") noticeTimer.restart()

    ParallelAnimation {
        running: true
        NumberAnimation { target: win; property: "bgIn"; from: 0; to: 1; duration: 1200; easing.type: Easing.OutCubic }
        SequentialAnimation {
            PauseAnimation { duration: 160 }
            NumberAnimation { target: win; property: "headIn"; from: 0; to: 1; duration: 700; easing.type: Easing.OutCubic }
        }
        SequentialAnimation {
            PauseAnimation { duration: 260 }
            NumberAnimation { target: win; property: "railIn"; from: 0; to: 1; duration: 900 }
        }
        SequentialAnimation {
            PauseAnimation { duration: 460 }
            NumberAnimation { target: win; property: "pageIn"; from: 0; to: 1; duration: 1100 }
        }
        SequentialAnimation {
            PauseAnimation { duration: 640 }
            NumberAnimation { target: win; property: "swapIn"; from: 0; to: 1; duration: 760; easing.type: Easing.OutCubic }
        }
        SequentialAnimation {
            PauseAnimation { duration: 900 }
            NumberAnimation { target: win; property: "footIn"; from: 0; to: 1; duration: 600; easing.type: Easing.OutCubic }
        }
    }

    // a page is left quickly and the next one builds itself in
    SequentialAnimation {
        id: pageSwap
        NumberAnimation { target: win; property: "pageIn"; to: 0; duration: 200; easing.type: Easing.InCubic }
        ScriptAction { script: win.pageShown = win.page }
        NumberAnimation { target: win; property: "pageIn"; from: 0; to: 1; duration: 900 }
    }
    // the chosen mod changes: what is shown leaves, is replaced, and comes back in
    SequentialAnimation {
        id: swap
        NumberAnimation { target: win; property: "swapIn"; to: 0; duration: 120; easing.type: Easing.InCubic }
        ScriptAction { script: win.shown = win.stageWant }
        NumberAnimation { target: win; property: "swapIn"; to: 1; duration: 460; easing.type: Easing.OutCubic }
    }
    // Home moves on to the next character by itself, unless a card is under the pointer or something is open
    SequentialAnimation {
        id: cycler
        running: win.page === "home" && win.heroes.length > 1 && win.hoverHero < 0 && !controller.busy && !win.askOpen && !Theme.calm
        loops: Animation.Infinite
        NumberAnimation { target: win; property: "cycle"; from: 0; to: 1; duration: 7000 }
        ScriptAction { script: win.featured = (win.featured + 1) % Math.max(1, win.heroes.length) }
        onRunningChanged: if (!running) win.cycle = 0
    }

    // where the pointer is, for the room's parallax and the pages' light
    HoverHandler { id: pointer; onPointChanged: Fx.pointer = Qt.point(point.position.x / Math.max(1, win.width), point.position.y / Math.max(1, win.height)) }

    // everything drawn goes through the window's finish (bloom, shock waves, flashes); the grips at the edges do not
    PostStack {
    id: post
    anchors.fill: parent
    Backdrop { anchors.fill: parent; reveal: win.bgIn; heat: win.page === "redux" && win.reduxPowered ? 0.75 : 0; horizon: win.page === "redux" ? 0.31 : 0.62 }

    // ---- the pictures -----------------------------------------------------------------------------------------
    Item {
        id: under            // the light behind the pictures, in the layout's units
        width: win.lw; height: win.lh
        scale: win.unit; transformOrigin: Item.TopLeft
        RadialGradient {
            id: aura
            property color tone: win.shown && win.shown.accent ? win.shown.accent : Theme.cyan
            Behavior on tone { ColorAnimation { duration: 520 } }
            width: 980; height: 980
            x: stage.focusX - width / 2
            y: win.lh * 0.44 - height / 2
            opacity: stage.on * win.swapIn * win.bgIn * (win.shown && win.shown.enabled ? 1 : 0.4)
            gradient: Gradient {
                GradientStop { position: 0.0; color: Qt.rgba(aura.tone.r, aura.tone.g, aura.tone.b, 0.24) }
                GradientStop { position: 0.25; color: Qt.rgba(aura.tone.r, aura.tone.g, aura.tone.b, 0.09) }
                GradientStop { position: 0.5; color: Qt.rgba(aura.tone.r, aura.tone.g, aura.tone.b, 0.0) }
            }
        }
        // the name across the back of the room, the floor of light and its sparks
        StageDressing {
            objectName: "stageDressing"
            anchors.fill: parent
            name: !win.shown ? "" : win.shown.back !== undefined ? String(win.shown.back)
                  : win.shown.title.split(":")[0].trim().split(" ")[0].toUpperCase()
            tone: aura.tone
            focusX: stage.focusX
            groundY: stage.groundY
            on: stage.on * win.bgIn
            swap: win.swapIn
            lit: win.shown && win.shown.enabled ? 1 : 0.45
            clearFrom: stage.clearFrom
            visible: win.shown !== null && win.shown.arts.length > 0
        }
        Item {
            id: slash
            anchors.fill: parent
            clip: true
            visible: win.swapIn < 0.999 && stage.on > 0.5 && !Theme.calm
            Repeater {
                model: 2
                delegate: Rectangle {
                    required property int index
                    width: index === 0 ? 120 : 26
                    height: win.lh * 1.7
                    x: stage.focusX - 620 + win.swapIn * (760 + 150 * index) - width / 2
                    y: -win.lh * 0.35
                    rotation: 20
                    color: aura.tone
                    opacity: Math.sin(Math.PI * win.swapIn) * (index === 0 ? 0.16 : 0.34)
                }
            }
        }
    }
    // in the window's own pixels: the pictures are drawn once, at the screen's resolution
    ArtStage {
        id: stage
        objectName: "stage"
        anchors.fill: parent
        u: win.unit
        across: win.lw
        readonly property bool home: win.page === "home"
        readonly property bool road: win.page === "roadmap"     // the roadmap's list reaches a little further right
        property real on: win.page === "home" || win.page === "library" || win.page === "roadmap" ? 1 : 0
        Behavior on on { NumberAnimation { duration: 260; easing.type: Easing.OutCubic } }
        arts: win.shown ? win.shown.arts : []
        tone: aura.tone
        fade: win.swapIn
        lit: (win.shown && win.shown.enabled ? 1 : 0.4) * on * win.bgIn
        // the featured or chosen one stands in the middle of the room right of the words
        focusX: (win.lw + (home ? 610 + 34 : road ? 700 + 34 : 850 - 2)) / 2
        focusY: win.lh * 0.30
        groundY: win.lh - 106
        zoom: home || road ? 1.06 : 1.0
        partyZoom: home || road ? 1.057 : 0.84
        clearFrom: home ? 610 : road ? 700 : 850
        clearTo: home ? 800 : road ? 880 : 975
        Behavior on focusX { NumberAnimation { duration: 620; easing.type: Easing.OutCubic } }
        Behavior on zoom { NumberAnimation { duration: 620; easing.type: Easing.OutCubic } }
        Behavior on partyZoom { NumberAnimation { duration: 620; easing.type: Easing.OutCubic } }
        Behavior on clearFrom { NumberAnimation { duration: 620; easing.type: Easing.OutCubic } }
        Behavior on clearTo { NumberAnimation { duration: 620; easing.type: Easing.OutCubic } }
    }
    // ---- everything else, in the layout's units -----------------------------------------------------------------
    Item {
        id: ui
        objectName: "ui"
        focus: true
        width: win.lw; height: win.lh
        scale: win.unit; transformOrigin: Item.TopLeft
        // the opening: the mark arrives at the centre, flares on the sound's hit and flies to the header
        Opening { id: entrance; z: 1000; width: win.lw; height: win.lh; lw: win.lw; lh: win.lh }
        // a mod without a picture: its initial in a crest
        Item {
            id: crest
            visible: win.shown !== null && win.shown.arts.length === 0 && stage.on > 0.01
            width: 300; height: 300
            x: stage.focusX - width / 2 + (1 - win.swapIn) * 44
            y: (win.lh - height) / 2 - 40
            opacity: win.swapIn * stage.on * (win.shown && win.shown.enabled ? 1 : 0.45)
            property real turn: 0
            NumberAnimation on turn { from: 0; to: 360; duration: 90000; loops: Animation.Infinite; running: !Theme.calm }
            HexMark { anchors.fill: parent; stroke: 1.2; outline: Theme.line; opacity: 0.30; rotation: crest.turn }
            HexMark { anchors.centerIn: parent; width: 230; height: 230; stroke: 1.2; outline: Theme.cyan; opacity: 0.45; rotation: -crest.turn * 1.6 }
            Text {
                anchors.centerIn: parent
                text: win.shown ? win.shown.monogram : ""
                font.family: Theme.display; font.pixelSize: 120
                color: Theme.text
            }
        }

        // the foot of the window stays dark across its whole width, so the action reads over any picture
        Rectangle {
            anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
            height: 150
            gradient: Gradient {
                GradientStop { position: 0.0; color: "#0005070b" }
                GradientStop { position: 0.34; color: "#e605070b" }
                GradientStop { position: 1.0; color: "#fa05070b" }
            }
        }

        Rectangle {
            anchors.left: parent.left; anchors.right: parent.right
            height: 104
            gradient: Gradient {
                GradientStop { position: 0.0; color: "#f005070b" }
                GradientStop { position: 0.55; color: "#b005070b" }
                GradientStop { position: 1.0; color: "#0005070b" }
            }
        }

        // ---- the column of pages ----------------------------------------------------------------------------------
        NavRail {
            id: rail
            enabled: !Theme.modal
            height: win.lh
            page: win.page
            reveal: win.railIn
            redux: !!controller.redux.name
            version: "V" + controller.version
            onPicked: (name) => win.go(name)
        }
        Item {
            id: mark
            x: 25; y: 14; width: 46; height: 46
            opacity: win.headIn * (entrance.fly >= 1 || !entrance.visible ? 1 : 0)
            scale: 0.6 + 0.4 * win.ease(win.headIn * 1.4)
            rotation: (1 - win.ease(win.headIn * 1.4)) * -40
            Image {
                anchors.fill: parent
                source: Qt.resolvedUrl("../../art/logo/zenith_logo.png")
                sourceSize: Qt.size(184, 184)
                mipmap: true
            }
            Rectangle {
                id: glint
                width: 7; height: 7
                x: parent.width / 2 - width / 2; y: 2
                rotation: 45
                color: "#ffffff"
                opacity: 0
                SequentialAnimation on opacity {
                    loops: Animation.Infinite
                    running: !Theme.calm
                    PauseAnimation { duration: 3600 }
                    NumberAnimation { to: 0.85; duration: 160; easing.type: Easing.OutCubic }
                    NumberAnimation { to: 0; duration: 620; easing.type: Easing.InCubic }
                }
            }
            HoverHandler { cursorShape: Qt.PointingHandCursor }
            TapHandler { onTapped: win.go("home") }
        }

        // ---- the pages --------------------------------------------------------------------------------------------
        HomePage {
            id: homePage
            enabled: !Theme.modal
            anchors.fill: parent
            reveal: win.pageShown === "home" ? win.pageIn : 0
            heroes: win.heroes
            featured: win.heroAt
            cycle: win.hoverHero >= 0 ? 1 : win.cycle
            state: controller.state
            wanted: controller.mods.filter(m => m.enabled && !m.locked).length
            updates: controller.mods.filter(m => m.newer).length
            gameBuild: controller.gameBuild
            installedAt: controller.installedAt
            onHovered: (index) => { win.hoverHero = index; if (index >= 0) win.featured = index }
            onPicked: (index) => {
                const at = win.mods.findIndex(m => m.id === win.heroes[index].id)
                if (at >= 0) win.current = at
                win.hoverHero = -1
                win.go("library")
            }
        }
        LibraryPage {
            enabled: !Theme.modal
            anchors.fill: parent
            reveal: win.pageShown === "library" ? win.pageIn : 0
            mods: win.mods
            current: win.current
            shown: win.shown && win.shown.kind !== "ROADMAP" ? win.shown : win.mod     // never a roadmap or news line
            swap: win.swapIn
            gameBuild: controller.gameBuild
            deleted: controller.deleted
            onChose: (index) => win.current = index
            onSwitched: (id, on) => controller.setEnabled(id, on)
            onSetSwitched: (name, on) => controller.setSetEnabled(name, on)
            onAddAsked: addDialog.open()
            onLinkAsked: win.addCopied()
            onSettingsAsked: (mod) => { options.cat = "modsettings"; win.go("options") }
            onSwitchOffAsked: (mod) => win.ask(qsTr("SWITCH OFF ") + mod.title.toUpperCase() + "?",
                mod.title + qsTr(" is needed by ") + mod.neededBy.join(", ") + qsTr(". They stop working without it, so they are switched off with it."),
                qsTr("SWITCH THEM OFF"), "offs:" + [mod.id].concat(mod.neededByIds).join(","), qsTr("CANCEL"), false)
            onChangelogAsked: (mod) => { textPanel.title = mod.title.toUpperCase() + qsTr(": WHAT CHANGED"); textPanel.body = controller.changelog(mod.id); textPanel.open = true }
            onRollBackAsked: (mod) => win.ask(qsTr("ROLL ") + mod.title.toUpperCase() + qsTr(" BACK TO ") + mod.rollbackTo + "?",
                qsTr("The version you had before the last update goes back") + (mod.installed ? qsTr(" and into your game (your save is backed up first)") : "")
                + qsTr(". It stays on ") + mod.rollbackTo + qsTr(" until you press RESUME UPDATES."), qsTr("ROLL BACK"), "rollback:" + mod.id, qsTr("CANCEL"), false)
            onResumeAsked: (mod) => controller.resumeUpdates(mod.id)
            onAddBackAsked: (id) => controller.addBack(id)
            onUninstallAsked: (mod) => win.ask(qsTr("UNINSTALL ") + mod.title.toUpperCase() + "?",
                mod.title + qsTr(" is taken out of your game") + (mod.kind === "CHARACTER" ? qsTr(", and the character's Evotypes and records are taken out of your save") : "")
                + qsTr(". A full copy of your save is made first. The mod's files stay in the Library, so it can be installed again."),
                qsTr("UNINSTALL"), "uninstallMod:" + mod.id)
            onDeleteAsked: (mod) => win.ask(qsTr("DELETE ") + mod.title.toUpperCase() + "?",
                qsTr("The mod's folder is moved to the Recycle Bin. It is not in your game, so nothing else changes."),
                qsTr("DELETE FILES"), "deleteMod:" + mod.id)
        }
        OptionsPage {
            enabled: !Theme.modal
            id: options
            anchors.fill: parent
            reveal: win.pageShown === "options" ? win.pageIn : 0
            onAsk: (title, body, label, then) => win.ask(title, body, label, then)
            onAskField: (title, body, label, then, field, secret) => win.ask(title, body, label, then, qsTr("CANCEL"), false, field, secret)
            onGoSupport: win.go("support")
            onGoRoadmap: win.go("roadmap")
            onChooseGameFolder: gameFolderDialog.open()
            onChooseSaveFolder: saveFolderDialog.open()
            onSaveList: saveListDialog.open()
            onOpenList: openListDialog.open()
        }
        ReduxPage {
            id: reduxPage
            enabled: !Theme.modal
            anchors.fill: parent
            reveal: win.pageShown === "redux" ? win.pageIn : 0
            redux: controller.redux
            mods: win.mods
            onPartSwitched: (ids, on) => controller.setManyEnabled(ids, on)
            onSwitched: (id, on) => controller.setEnabled(id, on)
        }
        LogPage {
            enabled: !Theme.modal
            id: logPage
            anchors.fill: parent
            reveal: win.pageShown === "log" ? win.pageIn : 0
        }
        RoadmapPage {
            id: roadPage
            enabled: !Theme.modal
            anchors.fill: parent
            reveal: win.pageShown === "roadmap" ? win.pageIn : 0
        }
        SupportPage {
            enabled: !Theme.modal
            anchors.fill: parent
            reveal: win.pageShown === "support" ? win.pageIn : 0
            people: controller.supporters
            onOpen: (url) => controller.openLink(url)
            onCopy: (url) => controller.copyLink(url)
        }

        // a line of light crosses the page when it changes
        // the page change: a wave of hex cells from the chosen page's row in the rail, over the swap
        ShaderEffect {
            id: sweep
            objectName: "warp"
            property real t: 1
            function restart() { if (Theme.calm) return; run.restart(); Fx.pulse(0.45); Sfx.play("page") }
            NumberAnimation { id: run; target: sweep; property: "t"; from: 0; to: 1; duration: 720; easing.type: Easing.Linear }
            x: 96; y: 76; width: win.lw - 96; height: win.lh - 176
            visible: t < 1 && !Theme.calm
            property vector2d res: Qt.vector2d(width, height)
            property vector2d origin: Qt.vector2d(0, Math.max(0, 104 + 82 * Math.max(0, rail.at) + 34 - 76))
            property real cell: 34
            property color tint: win.page === "redux" ? Theme.rose : Theme.cyan
            property color shade: "#e605070b"
            fragmentShader: "shaders/warp.frag.qsb"
        }

        // ---- the foot: where things stand, the quiet action, the one big action ----------------------------------
        GlassPanel { x: 110; y: win.lh - 100; width: win.lw - 130; height: 88; reveal: win.footIn; strength: 0.35; shade: 0.5 }
        Rule { objectName: "footRule"; x: 124; y: win.lh - 100; width: win.lw - 158; grow: win.footIn; strength: 0.4 }
        DataLine { objectName: "footLine"; x: 124; y: win.lh - 100 - 4.5; width: win.lw - 158; grow: win.footIn; base: 0; packets: 3; rate: 1.3 }
        Row {
            x: 126; y: win.lh - 70
            spacing: 14
            opacity: win.footIn
            HexMark {
                width: 22; height: 22
                anchors.verticalCenter: parent.verticalCenter
                fill: controller.state === "installed" ? 1 : (controller.state === "changes" ? 0.6 : 0)
                tone: controller.state === "changes" ? Theme.amber : Theme.cyan
                outline: controller.state === "installed" ? Theme.cyan : (controller.state === "changes" ? Theme.amber : Theme.dim)
                Behavior on fill { NumberAnimation { duration: Theme.base; easing.type: Easing.OutBack } }
            }
            Column {
                anchors.verticalCenter: parent.verticalCenter
                spacing: 4
                Text {
                    text: qsTr(controller.stateText).toUpperCase()
                    font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.8
                    color: Theme.text
                }
                Text {
                    text: controller.gameBuild ? qsTr("GAME BUILD ") + controller.gameBuild : qsTr("PRESS THE BUTTON AND THE GAME IS LOOKED FOR")
                    font.family: Theme.body; font.pixelSize: 12; font.letterSpacing: 1
                    color: Theme.dim
                }
            }
        }
        // the game as it stands, when the big button is busy with an install: nothing in it yet, or changes not applied
        OutlineButton {
            id: playNow
            enabled: !Theme.modal
            anchors.right: action.left; anchors.rightMargin: 18
            y: win.lh - 72
            visible: controller.playLabel !== ""
            opacity: win.footIn
            tone: Theme.cyan
            label: qsTr(controller.playLabel)
            // beside a modded game this is the game without mods: a copy, asked about before it is first made
            onClicked: {
                if (controller.plainWanted && !controller.plainMade)
                    win.ask(qsTr("MAKE A GAME WITHOUT MODS?"), qsTr("The Terminal makes a second copy of the game that never takes mods, and starts it. It has its own saves and begins as a new player, because a save with mod characters in it does not load in the game without them. It takes about 200 MB when the Terminal is on the game's disk. Your modded game and its saves stay as they are."),
                            qsTr("MAKE IT"), "makeplain")
                else controller.playQuiet()
            }
        }
        GhostButton {
            anchors.right: playNow.visible ? playNow.left : action.left; anchors.rightMargin: playNow.visible ? 24 : 34
            y: win.lh - 66
            opacity: win.footIn
            visible: controller.state === "installed" || controller.state === "changes"
            label: qsTr("UNINSTALL EVERY MOD")
            enabled: !Theme.modal
            onClicked: options.perform("uninstall")
        }
        PrimaryButton {
            id: action
            objectName: "action"
            x: win.lw - width - 34
            y: win.lh - 79
            label: qsTr(controller.actionLabel)
            enabled: controller.canAct && !Theme.modal
            opacity: win.footIn * (controller.canAct ? 1 : 0.4)
            transform: Translate { y: (1 - win.footIn) * 14 }
            onClicked: win.primary()
        }

        // ---- the top: the name, and the window's own buttons ------------------------------------------------------
        Item {
            id: head
            x: 96
            width: win.lw - 96; height: 76
            // the handle the window is moved by; a double click fills the screen or puts it back
            Item {
                objectName: "grab"
                anchors.left: parent.left; anchors.right: buttons.left
                height: parent.height
                DragHandler { target: null; onActiveChanged: if (active) win.startSystemMove() }
                TapHandler { onDoubleTapped: win.toggleFill() }
            }

            Column {
                x: 30; y: 21
                spacing: 4
                opacity: win.headIn
                DecodeText {
                    text: qsTr("THE ZENITH TERMINAL")
                    run: win.headIn > 0.2
                    font.family: Theme.display; font.pixelSize: 17
                    font.letterSpacing: 3.4 + (1 - win.headIn) * 7
                    color: Theme.text
                }
                Text {
                    text: qsTr("MOD LOADER FOR BLAZBLUE ENTROPY EFFECT   /   UNOFFICIAL")
                    font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2
                    color: Theme.dim
                }
            }
            DataLine { x: 0; y: parent.height - 4.5; width: parent.width; grow: win.headIn; base: 0.06; packets: 2; reverse: 1; rate: 0.9; opacity: 0.8 }
            Text {
                visible: controller.preview || controller.edition === "dev"
                anchors.right: buttons.left; anchors.rightMargin: 16
                y: 31
                text: controller.preview ? qsTr("PREVIEW  /  TEST COPY") : qsTr("DEV EDITION  /  REDUX TEST BUILDS")
                font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2.2
                color: Theme.amber
                opacity: win.headIn * 0.9
            }
            Row {
                id: buttons
                objectName: "windowButtons"
                anchors.right: parent.right; anchors.rightMargin: 20
                y: 18
                spacing: 2
                opacity: win.headIn
                Item {
                    width: 40; height: 36
                    objectName: "mute"
                    readonly property bool on: controller.settings.sound !== "off"
                    function press() { controller.setSetting("sound", on ? "off" : "on") }
                    Rectangle { anchors.fill: parent; color: "#ffffff"; opacity: muteHover.hovered ? 0.08 : 0 }
                    // a speaker; struck through when the sounds are off
                    Rectangle { x: 12; y: 15; width: 4; height: 7; color: "transparent"; border.width: 1.4; border.color: Theme.dim }
                    Rectangle { x: 16; y: 12; width: 1.4; height: 13; color: Theme.dim }
                    Rectangle { x: 16; y: 12; width: 6; height: 1.4; rotation: -35; transformOrigin: Item.Left; color: Theme.dim }
                    Rectangle { x: 16; y: 24; width: 6; height: 1.4; rotation: 35; transformOrigin: Item.Left; color: Theme.dim }
                    Rectangle { visible: parent.on; x: 25; y: 15; width: 1.4; height: 7; color: Theme.dim }
                    Rectangle { visible: parent.on; x: 28; y: 13; width: 1.4; height: 11; color: Theme.dim }
                    Rectangle { visible: !parent.on; anchors.centerIn: parent; width: 20; height: 1.4; rotation: -45; color: Theme.rose }
                    HoverHandler { id: muteHover }
                    TapHandler { onTapped: parent.press() }
                    readonly property bool tabStop: true
                    activeFocusOnTab: true
                    Keys.onReturnPressed: press()
                    Keys.onEnterPressed: press()
                    Keys.onSpacePressed: press()
                    FocusMark { inset: 2 }
                }
                Item {
                    width: 40; height: 36
                    objectName: "minimise"
                    Rectangle { anchors.fill: parent; color: "#ffffff"; opacity: minHover.hovered ? 0.08 : 0 }
                    Rectangle { anchors.centerIn: parent; width: 13; height: 1.4; color: Theme.dim }
                    HoverHandler { id: minHover }
                    TapHandler { onTapped: win.showMinimized() }
                    readonly property bool tabStop: true
                    activeFocusOnTab: true
                    Keys.onReturnPressed: win.showMinimized()
                    Keys.onEnterPressed: win.showMinimized()
                    Keys.onSpacePressed: win.showMinimized()
                    FocusMark { inset: 2 }
                }
                // fill the screen: one square; put it back: two
                Item {
                    objectName: "maximise"
                    width: 40; height: 36
                    Rectangle { anchors.fill: parent; color: "#ffffff"; opacity: maxHover.hovered ? 0.08 : 0 }
                    Rectangle {
                        visible: win.filled
                        x: 17; y: 11; width: 10; height: 10
                        color: "transparent"; border.width: 1.4; border.color: Theme.faint
                    }
                    Rectangle {
                        x: win.filled ? 13 : 14; y: win.filled ? 15 : 12
                        width: win.filled ? 10 : 12; height: width
                        color: win.filled ? Theme.bg : "transparent"; border.width: 1.4; border.color: Theme.dim
                    }
                    HoverHandler { id: maxHover }
                    TapHandler { onTapped: win.toggleFill() }
                    readonly property bool tabStop: true
                    activeFocusOnTab: true
                    Keys.onReturnPressed: win.toggleFill()
                    Keys.onEnterPressed: win.toggleFill()
                    Keys.onSpacePressed: win.toggleFill()
                    FocusMark { inset: 2 }
                }
                Item {
                    width: 40; height: 36
                    objectName: "close"
                    Rectangle { anchors.fill: parent; color: Theme.rose; opacity: closeHover.hovered ? 0.85 : 0 }
                    Rectangle { anchors.centerIn: parent; width: 15; height: 1.4; rotation: 45; color: closeHover.hovered ? "#ffffff" : Theme.dim }
                    Rectangle { anchors.centerIn: parent; width: 15; height: 1.4; rotation: -45; color: closeHover.hovered ? "#ffffff" : Theme.dim }
                    HoverHandler { id: closeHover }
                    TapHandler { onTapped: win.close() }
                    readonly property bool tabStop: true
                    activeFocusOnTab: true
                    Keys.onReturnPressed: win.close()
                    Keys.onEnterPressed: win.close()
                    Keys.onSpacePressed: win.close()
                    FocusMark { inset: 2 }
                }
            }
        }

        Text {
            id: noticeLine
            anchors.right: parent.right; anchors.rightMargin: 34
            y: win.lh - 130
            text: qsTr(win.notice)            // a line from the Python side, found by its template (lang.py)
            textFormat: Text.PlainText
            font.family: Theme.body; font.pixelSize: 14
            color: Theme.text
            opacity: win.notice !== "" ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: Theme.base } }
        }
        Timer { id: noticeTimer; interval: 5000; onTriggered: win.notice = "" }
        Connections { target: controller; function onSaid(text) { win.notice = text } }

        // ---- a mod or a pack chosen from a zip ----------------------------------------------------------------------
        FileDialog {
            id: addDialog
            title: qsTr("Add a mod")
            nameFilters: [qsTr("Mods and packs (*.zip)")]
            onAccepted: { win.addFrom(selectedFile.toString()); win.go("library") }
        }
        // ---- a mod list: saved to send to someone, or opened from someone ---------------------------------------
        FileDialog {
            id: saveListDialog
            title: qsTr("Save my mod list")
            fileMode: FileDialog.SaveFile
            nameFilters: [qsTr("Mod lists (*.zenith.json)")]
            defaultSuffix: "zenith.json"
            onAccepted: win.notice = controller.saveList(selectedFile.toString())
        }
        FileDialog {
            id: openListDialog
            title: qsTr("Use a mod list")
            nameFilters: [qsTr("Mod lists (*.zenith.json *.json)")]
            onAccepted: win.addFrom(selectedFile.toString())
        }
        // ---- Linux, Proton and Bottles: the game's folder and its saves, chosen by hand ------------------------------
        FolderDialog {
            id: gameFolderDialog
            title: qsTr("The folder BlazblueEntropyEffect.exe is in")
            onAccepted: controller.setGameFolder(selectedFolder.toString())
        }
        FolderDialog {
            id: saveFolderDialog
            title: qsTr("The folder that holds the game's Steam and Global folders")
            onAccepted: controller.setSaveFolder(selectedFolder.toString())
        }

        // ---- a mod dropped on the window --------------------------------------------------------------------------
        DropArea {
            id: drop
            anchors.fill: parent
            onDropped: (event) => {
                for (const url of event.urls) win.addFrom(url.toString())
                if (!win.askOpen || !win.asked.then.startsWith("list:")) win.go("library")
            }
        }
        Rectangle {
            anchors.fill: parent
            color: "#05070b"
            opacity: drop.containsDrag ? 0.84 : 0
            Behavior on opacity { NumberAnimation { duration: Theme.fast } }
            Text {
                anchors.centerIn: parent
                text: qsTr("LET GO TO ADD IT")
                font.family: Theme.display; font.pixelSize: 26; font.letterSpacing: 5
                color: Theme.text
            }
        }

        ProgressPanel {
            anchors.fill: parent
            open: controller.busy
            running: controller.running
            title: controller.title
            steps: controller.steps
            step: controller.step
            result: controller.result
            resultText: controller.resultText
            resultAction: controller.resultAction
            lines: controller.logTail
            download: controller.download
            canPause: controller.canPause
            cancelSafe: controller.cancelSafe
            stallSeconds: controller.stallSeconds
            resultHelp: controller.resultHelp
            onCancel: controller.cancel()
            onPause: (on) => controller.pauseDownload(on)
            onSend: win.ask(qsTr("SEND THIS REPORT TO DISCORD?"), qsTr("The report zip goes to the Redux team's Discord channel: your mod versions, the game's and the mods' logs, and your notes. It holds no password and no save. Say in a few words what happened."),
                            qsTr("SEND"), "send", qsTr("CANCEL"), false, qsTr("What happened, in a few words"), false)
            onPlay: { const plain = controller.resultAction === "playplain"; controller.dismiss(); if (plain) controller.playPlain(); else controller.play() }
            onFolder: (which) => { if (which === "feedback") controller.openFeedback(); else controller.openBackups() }
            onClosed: controller.dismiss()
        }

        // a changelog, in full
        TextPanel { id: textPanel; anchors.fill: parent; onClosed: textPanel.open = false }

        // ---- asked before anything is taken away ------------------------------------------------------------------
        ConfirmPanel {
            id: confirm
            anchors.fill: parent
            open: win.askOpen
            field: win.asked.field || ""
            secret: win.asked.secret === true
            title: win.asked.title
            body: win.asked.body
            label: win.asked.label
            cancelLabel: win.asked.cancelLabel || qsTr("CANCEL")
            danger: win.asked.danger !== false
            onConfirmed: { win.askOpen = false; win.proceed(win.asked.then, confirm.typed) }
            onCancelled: {
                win.askOpen = false
                if (win.asked.then.startsWith("bringBack:")) controller.keepDeleted(win.asked.then.slice(10))
            }
        }
    }
    }   // PostStack
    property bool askOpen: false
    property var asked: ({ title: "", body: "", label: "", then: "" })
    function ask(title, body, label, then, cancelLabel, danger, field, secret) {
        asked = { title: title, body: body, label: label, then: then, cancelLabel: cancelLabel || qsTr("CANCEL"), danger: danger !== false,
                  field: field || "", secret: secret === true }
        askOpen = true
    }
    // the big button; asked first when the mods in the game came from the other Terminal (public or Dev)
    function primary() {
        const installs = controller.actionLabel !== "PLAY" && controller.state !== "behind"
        const other = installs ? controller.otherInstall() : ({})
        if (other && other.edition)
            win.ask(qsTr("REPLACE THE ") + other.edition.toUpperCase() + qsTr(" TERMINAL'S MODS?"),
                qsTr("The mods in your game were put there by The Zenith Terminal ") + (other.edition === "Dev" ? qsTr("Dev") : "(public)") + qsTr(" on ") + other.when
                + " (" + other.count + (other.count === 1 ? qsTr(" mod") : qsTr(" mods")) + qsTr("). Installing from this Terminal replaces them with what is switched on here. Your save is backed up first."),
                qsTr("REPLACE THEM"), "primary", qsTr("CANCEL"), false)
        else controller.primary()
    }
    // a mod the player deleted that has a newer version on the channel: asked whether it comes back
    function offerBack() {
        if (win.askOpen || controller.busy) return
        const o = controller.nextOffer()
        if (!o || !o.id) return
        win.ask(qsTr("ADD ") + o.title.toUpperCase() + qsTr(" BACK?"),
            qsTr("You deleted ") + o.title + qsTr(". Version ") + o.version + qsTr(" is out now. Add it back? It is downloaded, switched on ")
            + qsTr("and put in your game. If you keep it deleted, the Terminal asks again when a newer version comes out."),
            qsTr("ADD IT BACK"), "bringBack:" + o.id, qsTr("KEEP IT DELETED"), false)
    }
    Connections {
        target: controller
        function onBusyChanged() { if (!controller.busy) Qt.callLater(win.offerBack) }
    }
    Timer { id: offerTimer; interval: 1800; onTriggered: win.offerBack() }    // after the window's entrance
    // a mod from the disk or from a link: asked about first when it is a download or brings scripts of its own
    function addFrom(url) {
        if (controller.isList(url)) {                         // a mod list: names and versions, nothing to add
            const about = controller.listQuestion(url)
            if (about !== "") win.ask(qsTr("USE THIS LIST?"), about, qsTr("USE IT"), "list:" + url)
            else win.notice = controller.useList(url)
            return
        }
        const question = controller.addQuestion(url)
        if (question !== "") win.ask(qsTr("ADD THIS MOD?"), question, qsTr("ADD IT"), "add:" + url)
        else win.notice = controller.addMod(url)
    }
    function addCopied() {
        const link = controller.copiedLink()
        if (link !== "") win.addFrom(link)
        else win.notice = controller.addLink("")              // says what to copy first
    }
    function proceed(then, typed) {
        if (then === "primary") controller.primary()
        else if (then === "undo") controller.undoInstall()
        else if (then === "signout") controller.signOut()
        else if (then === "key") controller.useKey(typed)
        else if (then === "preset") win.notice = controller.savePreset(typed)
        else if (then === "send") controller.sendReport(typed)
        else if (then.startsWith("delpreset:")) controller.deletePreset(then.slice(10))
        else if (then.startsWith("restore:")) controller.restoreSave(then.slice(8))
        else if (then.startsWith("rollback:")) controller.rollBack(then.slice(9))
        else if (then.startsWith("offs:")) controller.setManyEnabled(then.slice(5).split(","), false)
        else if (then.startsWith("test:")) { const t = then.slice(5).split(":"); win.notice = controller.launchTest(parseInt(t[0]), parseInt(t[1]), parseInt(t[2])) }
        else if (then === "uninstall") controller.uninstall()
        else if (then === "repair") controller.repairSave()
        else if (then === "deletecopy") controller.deleteCopy()
        else if (then === "makeplain") controller.playPlain()
        else if (then === "deleteplain") controller.deletePlain()
        else if (then === "bringplain") controller.bringPlainSaves()
        else if (then.startsWith("list:")) { win.notice = controller.useList(then.slice(5)); win.go("library") }
        else if (then.startsWith("add:")) { win.notice = controller.addMod(then.slice(4)); win.go("library") }
        else if (then.startsWith("uninstallMod:")) controller.uninstallMod(then.slice(13))
        else if (then.startsWith("deleteMod:")) win.notice = controller.deleteMod(then.slice(10))
        else if (then.startsWith("bringBack:")) controller.bringBack(then.slice(10))
    }

    // ---- the edges and corners the window is pulled by: 6 real pixels deep at any scale ----------------------------
    Repeater {
        model: [
            { edges: Qt.TopEdge, x: 12, y: 0, w: -24, h: 6 }, { edges: Qt.BottomEdge, x: 12, y: -6, w: -24, h: 6 },
            { edges: Qt.LeftEdge, x: 0, y: 12, w: 6, h: -24 }, { edges: Qt.RightEdge, x: -6, y: 12, w: 6, h: -24 },
            { edges: Qt.TopEdge | Qt.LeftEdge, x: 0, y: 0, w: 12, h: 12 }, { edges: Qt.TopEdge | Qt.RightEdge, x: -12, y: 0, w: 12, h: 12 },
            { edges: Qt.BottomEdge | Qt.LeftEdge, x: 0, y: -12, w: 12, h: 12 }, { edges: Qt.BottomEdge | Qt.RightEdge, x: -12, y: -12, w: 12, h: 12 }
        ]
        delegate: MouseArea {
            required property var modelData
            objectName: "grip"
            readonly property int edges: modelData.edges
            visible: !win.filled
            x: modelData.x < 0 ? win.width + modelData.x : modelData.x
            y: modelData.y < 0 ? win.height + modelData.y : modelData.y
            width: modelData.w < 0 ? win.width + modelData.w : modelData.w
            height: modelData.h < 0 ? win.height + modelData.h : modelData.h
            cursorShape: edges === Qt.TopEdge || edges === Qt.BottomEdge ? Qt.SizeVerCursor
                       : edges === Qt.LeftEdge || edges === Qt.RightEdge ? Qt.SizeHorCursor
                       : edges === (Qt.TopEdge | Qt.LeftEdge) || edges === (Qt.BottomEdge | Qt.RightEdge) ? Qt.SizeFDiagCursor : Qt.SizeBDiagCursor
            onPressed: win.startSystemResize(edges)
        }
    }

    Shortcut { sequence: "Down"; enabled: win.page === "library"; onActivated: if (win.current < win.mods.length - 1) win.current += 1 }
    Shortcut { sequence: "Up"; enabled: win.page === "library"; onActivated: if (win.current > 0) win.current -= 1 }
    Shortcut {
        sequence: "Space"
        enabled: win.page === "library" && !win.onControl
        onActivated: if (win.mod && !win.mod.locked) controller.setEnabled(win.mod.id, !win.mod.enabled)
    }
    Shortcut { sequence: "Escape"; onActivated: { if (win.askOpen) win.askOpen = false; else controller.dismiss() } }
    Shortcut { sequence: "Ctrl+V"; enabled: win.page === "library" && !controller.busy; onActivated: win.addCopied() }
    Shortcut { sequence: "Ctrl+1"; onActivated: win.go("home") }
    Shortcut { sequence: "Ctrl+2"; onActivated: win.go("library") }
    Shortcut { sequence: "Ctrl+3"; onActivated: win.go("options") }
    Shortcut { sequence: "Ctrl+4"; onActivated: win.go("log") }
    Shortcut { sequence: "Ctrl+5"; onActivated: win.go("support") }
    Shortcut { sequence: "Ctrl+6"; onActivated: win.go("roadmap") }

    // ---- the tray (Tray.qml): only where the Interpreter carries it; an older one opens the window without it ----
    // (made in code, not by a Loader: the tray icon is not an Item)
    property var tray: null
    QtObject {
        Component.onCompleted: {
            if (typeof trayAvailable === "undefined" || !trayAvailable) return
            const made = Qt.createComponent("Tray.qml")
            if (made.status === Component.Ready) win.tray = made.createObject(win, { win: win })
            else console.warn("the tray did not load:", made.errorString())
        }
    }
    readonly property bool trayShown: win.tray !== null && win.tray.visible
    function trayMessage(title, text) { if (win.trayShown) win.tray.showMessage(title, text) }
    Connections { target: controller; function onPopup(title, text) { win.trayMessage(title, text) } }
    // CHECK NOW brought the window's own files: its place is kept, it ends, and run_gui.py opens the new one
    Connections {
        target: controller
        function onReopenWanted() { shell.remember(plain.x, plain.y, plain.width, plain.height, filled); win.quitting = true; Qt.quit() }
    }

    // ---- a game controller (improvement 15): the pad's buttons as the window's own moves --------------------------
    function padFocus(forward) {
        const now = win.activeFocusItem
        let next = now ? now.nextItemInFocusChain(forward) : ui.nextItemInFocusChain(true)
        for (let i = 0; i < 400 && next && !(next.tabStop === true && next.visible && next.enabled); ++i) next = next.nextItemInFocusChain(forward)
        if (next) next.forceActiveFocus(Qt.TabFocusReason)
    }
    function padPage(by) {
        const names = rail.entries.map(e => e.id)
        const at = Math.max(0, names.indexOf(win.page))
        win.go(names[(at + by + names.length) % names.length])
    }
    Connections {
        target: typeof pad !== "undefined" ? pad : null
        ignoreUnknownSignals: true
        function onUsed() { win.padKeys = true; if (!win.visible) win.showAgain() }
        function onAction(name) {
            if (name === "back") { if (textPanel.open) textPanel.open = false; else if (win.askOpen) win.askOpen = false; else if (controller.busy) controller.dismiss(); else if (win.page !== "home") win.go("home") }
            else if (name === "primary") { if (!win.askOpen && !controller.busy) win.primary() }
            else if (name === "pageNext") { if (!Theme.modal) win.padPage(1) }
            else if (name === "pagePrev") { if (!Theme.modal) win.padPage(-1) }
            else if (name === "options") { if (!Theme.modal) win.go("options") }
            else if ((name === "up" || name === "down") && win.page === "library" && !Theme.modal && !win.onControl) {
                if (name === "down" && win.current < win.mods.length - 1) win.current += 1
                if (name === "up" && win.current > 0) win.current -= 1
            }
            else if (name === "up" || name === "left") win.padFocus(false)
            else if (name === "down" || name === "right") win.padFocus(true)
            else if (name === "switch" && win.page === "library" && win.mod && !win.mod.locked && !Theme.modal) controller.setEnabled(win.mod.id, !win.mod.enabled)
            else if (name === "accept") win.padFocus(true)
        }
    }

    // ---- a recording drives the window with cues ("7|page=library"): nothing real is started by them ---------
    property string cue: ""
    onCueChanged: {
        const what = cue.slice(cue.indexOf("|") + 1)
        const eq = what.indexOf("=")
        const name = eq < 0 ? what : what.slice(0, eq), value = eq < 0 ? "" : what.slice(eq + 1)
        if (name === "page") go(value)
        else if (name === "select") current = parseInt(value)
        else if (name === "feature") { featured = parseInt(value); if (cycler.running) cycler.restart() }
        else if (name === "cat") options.cat = value
        else if (name === "log") logPage.which = value
        else if (name === "logshow") logPage.show = value
        else if (name === "install") demo.restart()
        else if (name === "ask" && mod) ask(qsTr("UNINSTALL ") + mod.title.toUpperCase() + "?",
            mod.title + qsTr(" is taken out of your game, and the character's Evotypes and records are taken out of your save. A full copy of your save is made first. The mod's files stay in the Library, so it can be installed again."),
            qsTr("UNINSTALL"), "")
        else if (name === "cancel") askOpen = false
    }
    // the install screen played by hand: nothing is installed
    SequentialAnimation {
        id: demo
        ScriptAction { script: controller.demoBegin(qsTr("INSTALLING")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 520 }
        ScriptAction { script: controller.demoStep(0, qsTr("Game folder link  ok -> D:\\SteamLibrary\\steamapps\\common\\BlazblueEntropyEffect")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 620 }
        ScriptAction { script: controller.demoStep(1, qsTr("Reading the game data (takes a few minutes, only needed once and after each game update)...")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 900 }
        ScriptAction { script: controller.demoStep(1, qsTr("tables decoded: 188, failed: 1")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 520 }
        ScriptAction { script: controller.demoStep(2, qsTr("Save backed up to: save_backups\\20261009_162554_before_install")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 700 }
        ScriptAction { script: controller.demoStep(3, qsTr("game build 25627491; load order: ['bbee-sdk', 'bbee-actors', 'char-nine', 'char-ruby']")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 900 }
        ScriptAction { script: controller.demoStep(4, qsTr("NEW bundle entry: ui/texture/iconpotential/potential_rubytalent.ab")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 620 }
        ScriptAction { script: controller.demoStep(4, qsTr("installed 887 bundles into m_mod.m; merge.json updated (backup: merge.json.orig)")) }
        NumberAnimation { target: win; property: "demoWait"; from: 0; to: 1; duration: 600 }
        ScriptAction { script: controller.demoFinish() }
    }
}
