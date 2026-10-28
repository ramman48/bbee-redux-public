import QtQuick

// The Library: every mod in the mods folder on the left, the chosen one in words in the middle. Its
// pictures are drawn by the window, behind this page.
Item {
    id: page
    property real reveal: 1        // 0..1: the page's entrance
    property var mods: []
    property int current: 0
    property var shown: null       // the mod whose words are on screen (it follows `current` after the swap)
    property real swap: 1          // 0..1: the words leave and come back when the chosen mod changes
    property string gameBuild: ""
    signal chose(int index)
    signal switched(string id, bool on)
    signal setSwitched(string name, bool on)
    signal uninstallAsked(var mod)
    signal deleteAsked(var mod)
    signal addAsked()
    signal linkAsked()
    signal settingsAsked(var mod)
    signal switchOffAsked(var mod)     // switched off while other mods that are on need it (improvement 19)
    signal changelogAsked(var mod)
    signal rollBackAsked(var mod)
    signal resumeAsked(var mod)
    signal addBackAsked(string id)
    property var deleted: []           // mods deleted here, which the update check no longer brings (improvement 4)
    // off, but asked first when other mods that are on need it
    function flip(m, on) {
        if (!m) return
        if (!on && m.neededBy && m.neededBy.length > 0) page.switchOffAsked(m)
        else page.switched(m.id, on)
    }

    visible: reveal > 0.001

    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
    function groupName(kind) { return kind === "CHARACTER" ? qsTr("CHARACTERS") : (kind === "CORE" ? qsTr("CORE FILES") : qsTr("MODS")) }
    function kindName(kind) { return kind === "CHARACTER" ? qsTr("CHARACTER") : (kind === "CORE" ? qsTr("CORE FILE") : qsTr("MOD")) }
    function where(m) {
        if (!m) return ""
        if (m.locked) return qsTr("GOES IN WITH ANY MOD")
        if (m.installed && m.enabled && m.newer) return qsTr("UPDATES FROM ") + m.installedVersion + qsTr(" WHEN YOU APPLY")
        if (m.installed) return m.enabled ? qsTr("IN YOUR GAME") : qsTr("LEAVES WHEN YOU APPLY")
        return m.enabled ? qsTr("GOES IN WHEN YOU INSTALL") : qsTr("NOT IN YOUR GAME")
    }
    function whereTone(m) {
        if (!m || m.locked) return Theme.line
        if (m.installed && m.enabled) return m.newer ? Theme.amber : Theme.cyan
        return m.installed !== m.enabled ? Theme.amber : Theme.line
    }

    // the rows keep their items while the list changes under them, so a switch is seen happening
    ListModel { id: rowsModel }
    function syncRows() {
        for (let i = 0; i < mods.length; ++i) {
            const m = mods[i]
            // a set (Redux) is listed under its own name, with one switch for all of it; the rest by kind
            const group = m.set ? m.set.toUpperCase() : groupName(m.kind)
            const before = i === 0 ? "" : (mods[i - 1].set ? mods[i - 1].set.toUpperCase() : groupName(mods[i - 1].kind))
            const inSet = m.set ? mods.filter(o => o.set === m.set && !o.locked) : []
            const row = { mid: m.id, title: m.title, version: m.version, note: m.note, kind: m.kind,
                          on: m.enabled, locked: m.locked, compatible: m.compatible,
                          channel: m.channel || "", fresh: m.fresh === true, held: m.held === true, preview: m.preview === true,
                          group: group, setName: m.set || "", setCount: inSet.length,
                          setOn: inSet.filter(o => o.enabled).length,
                          opens: i === 0 || before !== group }
            if (i < rowsModel.count) rowsModel.set(i, row)
            else rowsModel.append(row)
        }
        while (rowsModel.count > mods.length) rowsModel.remove(rowsModel.count - 1)
    }
    Component.onCompleted: syncRows()
    onModsChanged: syncRows()
    onShownChanged: detailContainer.contentY = 0

    // ---- the glass behind the list and the details ----------------------------------------------------------
    GlassPanel { x: 108; y: 90; width: 388; height: page.height - 90 - 176; reveal: page.ease(page.reveal * 2.0) }
    GlassPanel { x: 504; y: 90; width: 392; height: page.height - 90 - 176; reveal: page.ease(page.reveal * 2.0 - 0.3); shade: 0.7; strength: 0.7 }

    // ---- the list ---------------------------------------------------------------------------------------------
    Item {
        id: list
        objectName: "libraryList"
        x: 124; y: 104
        width: 356
        height: page.height - y - 180

        Text {
            text: qsTr("YOUR MODS")
            font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.6
            color: Theme.dim
            opacity: page.ease(page.reveal * 3)
        }
        Text {
            anchors.right: parent.right
            text: page.mods.filter(m => m.enabled && !m.locked).length + qsTr(" ON")
            font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.2
            color: Theme.cyan
            opacity: page.ease(page.reveal * 3)
        }
        Rule { y: 24; width: parent.width; grow: page.ease(page.reveal * 2.2) }

        Flickable {
            y: 36
            width: parent.width
            height: parent.height - 36
            contentHeight: rows.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            Column {
                id: rows
                width: parent.width
                Repeater {
                    model: rowsModel
                    delegate: Column {
                        id: entry
                        required property int index
                        required property string mid
                        required property string title
                        required property string version
                        required property string note
                        required property string kind
                        required property bool on
                        required property bool locked
                        required property bool compatible
                        required property bool opens      // the first row of its group: the group's name goes above it
                        required property string group
                        required property string setName
                        required property int setCount
                        required property int setOn
                        required property string channel
                        required property bool fresh
                        required property bool held
                        required property bool preview
                        width: rows.width
                        readonly property real shows: page.ease(page.reveal * (1.6 + page.mods.length * 0.16) - 0.3 - index * 0.16)
                        Item {
                            visible: entry.opens
                            width: parent.width
                            height: entry.opens ? (entry.index === 0 ? 26 : 40) : 0
                            Text {
                                x: 2
                                anchors.bottom: parent.bottom; anchors.bottomMargin: 8
                                text: entry.group + (entry.setName !== "" ? "     " + entry.setOn + qsTr(" OF ") + entry.setCount + qsTr(" ON") : "")
                                font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2.4
                                color: Theme.faint
                                opacity: entry.shows
                            }
                            // the whole set on, or the whole set off
                            Item {
                                id: setSwitch
                                objectName: "setSwitch"
                                visible: entry.opens && entry.setName !== "" && entry.setCount > 1
                                readonly property bool allOn: entry.setOn === entry.setCount
                                readonly property bool tabStop: true
                                activeFocusOnTab: true
                                function press() { page.setSwitched(entry.setName, !allOn) }
                                Keys.onReturnPressed: press()
                                Keys.onEnterPressed: press()
                                Keys.onSpacePressed: press()
                                anchors.right: parent.right
                                anchors.bottom: parent.bottom; anchors.bottomMargin: 2
                                width: setWord.implicitWidth + 20; height: 24
                                opacity: entry.shows
                                FocusMark {}
                                Text {
                                    id: setWord
                                    anchors.centerIn: parent
                                    text: setSwitch.allOn ? qsTr("ALL OFF") : qsTr("ALL ON")
                                    font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2
                                    color: setHover.hovered ? Theme.text : Theme.cyan
                                    Behavior on color { ColorAnimation { duration: Theme.fast } }
                                }
                                HoverHandler { id: setHover; cursorShape: Qt.PointingHandCursor }
                                TapHandler { onTapped: { Sfx.play("press"); setSwitch.press() } }
                            }
                        }
                        ModRow {
                            width: parent.width
                            title: entry.title
                            version: entry.version
                            note: entry.note
                            isOn: entry.on
                            locked: entry.locked
                            compatible: entry.compatible
                            channel: entry.channel
                            fresh: entry.fresh
                            held: entry.held
                            preview: entry.preview
                            selected: entry.index === page.current
                            reveal: entry.shows
                            onChosen: page.chose(entry.index)
                            onSwitched: (on) => page.flip(page.mods[entry.index], on)
                        }
                    }
                }
                Item {
                    objectName: "deletedHead"
                    visible: page.deleted.length > 0
                    width: parent.width; height: visible ? 40 : 0
                    opacity: page.ease(page.reveal * 2 - 1)
                    Text {
                        x: 2
                        anchors.bottom: parent.bottom; anchors.bottomMargin: 8
                        text: qsTr("DELETED     UPDATES LEAVE THESE OUT")
                        font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2.4
                        color: Theme.faint
                    }
                }
                Repeater {
                    model: page.deleted
                    delegate: Item {
                        id: gone
                        required property var modelData
                        objectName: "deletedRow"
                        width: rows.width; height: 46
                        opacity: page.ease(page.reveal * 2 - 1)
                        Rectangle { anchors.fill: parent; anchors.topMargin: 1; anchors.bottomMargin: 1; color: "#ffffff"; opacity: 0.015 }
                        HexMark { x: 30; anchors.verticalCenter: parent.verticalCenter; width: 16; height: 16; fill: 0; outline: Theme.faint; stroke: 1 }
                        Text {
                            x: 66; anchors.verticalCenter: parent.verticalCenter
                            width: parent.width - 66 - addBack.width - 24
                            elide: Text.ElideRight
                            text: gone.modelData.title.toUpperCase() + (gone.modelData.version ? qsTr("   V") + gone.modelData.version : "")
                            font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.2
                            color: Theme.faint
                        }
                        Item {
                            id: addBack
                            objectName: "addBack"
                            anchors.right: parent.right; anchors.rightMargin: 14
                            anchors.verticalCenter: parent.verticalCenter
                            width: addWord.implicitWidth + 20; height: 26
                            readonly property bool tabStop: true
                            activeFocusOnTab: true
                            function press() { Sfx.play("press"); page.addBackAsked(gone.modelData.id) }
                            Keys.onReturnPressed: press()
                            Keys.onEnterPressed: press()
                            Keys.onSpacePressed: press()
                            FocusMark {}
                            Text {
                                id: addWord
                                anchors.centerIn: parent
                                text: qsTr("ADD BACK")
                                font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2
                                color: addHover.hovered ? Theme.text : Theme.cyan
                            }
                            HoverHandler { id: addHover; cursorShape: Qt.PointingHandCursor }
                            TapHandler { onTapped: addBack.press() }
                        }
                    }
                }
                Item {
                    width: parent.width; height: 58
                    opacity: page.ease(page.reveal * 2 - 1) * 0.9
                    Rectangle {
                        anchors.fill: parent; anchors.topMargin: 14
                        color: "transparent"
                        border.width: Theme.hair
                        border.color: Qt.rgba(Theme.line.r, Theme.line.g, Theme.line.b, 0.18)
                    }
                    Text {
                        anchors.centerIn: parent; anchors.verticalCenterOffset: 7
                        text: qsTr("+   DROP A MOD'S FOLDER OR ZIP HERE")
                        font.family: Theme.display; font.pixelSize: 10; font.letterSpacing: 2
                        color: Theme.faint
                    }
                }
            }
        }
    }

    // ---- the chosen mod, in words ---------------------------------------------------------------------------
    Flickable {
        id: detailContainer
        objectName: "libraryDetail"
        x: 520; y: 122
        width: 360
        height: page.height - y - 176
        contentWidth: width
        contentHeight: detail.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        opacity: page.swap * page.ease(page.reveal * 2.2 - 0.7)
        transform: Translate { x: (1 - page.swap) * 28 + (1 - page.ease(page.reveal * 2.2 - 0.7)) * 22 }
        visible: page.shown !== null

        Column {
            id: detail
            width: parent.width
            spacing: 0

            Row {
                spacing: 12
                Text {
                    text: page.shown ? page.kindName(page.shown.kind) : ""
                    font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 3
                    color: page.shown && page.shown.accent ? page.shown.accent : Theme.cyan
                }
                Text {
                    // a part of a set says so here (REDUX: CROSS EFFECT); its own note stays on its row in the list
                    visible: page.shown && (page.shown.note !== "" || page.shown.set !== "")
                    text: !page.shown ? "" : "/   " + (page.shown.set !== ""
                          ? page.shown.set + (page.shown.part ? ": " + page.shown.part : "") : page.shown.note).toUpperCase()
                    font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 2
                    color: Theme.dim
                }
            }
            Item { width: 1; height: 10 }
            Text {
                width: parent.width
                text: page.shown ? page.shown.title.toUpperCase() : ""
                wrapMode: Text.WordWrap
                font.family: Theme.display; font.pixelSize: 38; font.letterSpacing: 1.4
                lineHeight: 1.05
                color: Theme.text
            }
            Item { width: 1; height: 16 }
            Rule {
                width: 236; grow: page.swap; strength: 0.7
                tone: page.shown && page.shown.accent ? page.shown.accent : Theme.line
            }
            Item { width: 1; height: 18 }
            Text {
                width: parent.width
                text: page.shown ? page.shown.about : ""
                wrapMode: Text.WordWrap
                font.family: Theme.body; font.pixelSize: 15
                lineHeight: 1.36
                color: "#c6cfdc"
            }
            Item { width: 1; height: 20 }
            Flow {
                width: parent.width
                spacing: 8
                Chip { label: qsTr("VERSION"); value: page.shown ? page.shown.version + (page.shown.fresh ? qsTr("  NEW") : "") : ""; tone: page.shown && page.shown.newer ? Theme.amber : page.shown && page.shown.fresh ? Theme.cyan : Theme.line }
                Chip {
                    objectName: "channelChip"
                    visible: page.shown && !page.shown.locked && (page.shown.channel || "") !== ""
                    label: qsTr("UPDATES")
                    value: !page.shown ? "" : page.shown.held ? qsTr("HELD ON ") + page.shown.version
                           : page.shown.channel === "DEV" ? qsTr("DEV CHANNEL") : page.shown.channel === "PUBLIC" ? qsTr("PUBLIC CHANNEL") : qsTr("NONE: ADDED BY HAND")
                    tone: page.shown && page.shown.held ? Theme.amber : Theme.line
                }
                Chip {
                    label: page.shown && page.shown.compatible ? qsTr("GAME BUILD") : qsTr("CHECKED ON")
                    value: page.shown ? (page.shown.compatible ? page.shown.checkedOn + qsTr("  OK") : page.shown.checkedOn + qsTr("  /  YOURS ") + page.gameBuild) : ""
                    tone: page.shown && page.shown.compatible ? Theme.line : Theme.amber
                }
                Chip { label: qsTr("STATE"); value: page.where(page.shown); tone: page.whereTone(page.shown) }
                Chip {
                    visible: page.shown && page.shown.settings.length > 0
                    label: qsTr("SETTINGS")
                    value: !page.shown ? "" : page.shown.settingsWaiting ? qsTr("CHANGED: GOES IN WHEN YOU APPLY")
                           : page.shown.settings.length + (page.shown.settings.length === 1 ? qsTr(" CHOICE") : qsTr(" CHOICES"))
                    tone: page.shown && page.shown.settingsWaiting ? Theme.amber : Theme.line
                }
                Chip {
                    objectName: "needsChip"
                    visible: page.shown && page.shown.needTitles && page.shown.needTitles.length > 0
                    label: qsTr("NEEDS")
                    value: page.shown && page.shown.needTitles ? page.shown.needTitles.join(", ").toUpperCase() : ""
                    tone: Theme.line
                }
                Chip {
                    objectName: "neededByChip"
                    visible: page.shown && page.shown.neededBy && page.shown.neededBy.length > 0
                    label: qsTr("NEEDED BY")
                    value: page.shown && page.shown.neededBy ? page.shown.neededBy.join(", ").toUpperCase() : ""
                    tone: Theme.line
                }
                Chip {
                    visible: page.shown && page.shown.missing.length > 0
                    label: qsTr("MISSING")
                    value: page.shown ? page.shown.missing.join(", ").toUpperCase() : ""
                    tone: Theme.amber
                }
            }
            Item { width: 1; height: 14 }
            Text {
                width: parent.width
                visible: text !== ""
                text: page.shown ? page.shown.credit : ""
                wrapMode: Text.WordWrap
                font.family: Theme.body; font.pixelSize: 12; font.letterSpacing: 0.3
                color: Theme.faint
            }
            // what changed, and the version before the last update (improvements 10 and the roll back)
            Item { width: 1; height: modMore.visible ? 16 : 0 }
            Flow {
                id: modMore
                objectName: "modMore"
                width: parent.width
                spacing: 10
                visible: page.shown !== null && !page.shown.locked && (page.shown.hasChangelog || page.shown.rollbackTo !== "" || page.shown.held)
                OutlineButton {
                    objectName: "changelogButton"
                    visible: page.shown && page.shown.hasChangelog === true
                    label: qsTr("WHAT CHANGED")
                    tone: Theme.dim
                    onClicked: page.changelogAsked(page.shown)
                }
                OutlineButton {
                    objectName: "rollBackButton"
                    visible: page.shown && !page.shown.held && (page.shown.rollbackTo || "") !== ""
                    label: qsTr("BACK TO ") + (page.shown ? page.shown.rollbackTo : "")
                    tone: Theme.dim
                    onClicked: page.rollBackAsked(page.shown)
                }
                OutlineButton {
                    objectName: "resumeButton"
                    visible: page.shown && page.shown.held === true
                    label: qsTr("RESUME UPDATES")
                    tone: Theme.cyan
                    onClicked: page.resumeAsked(page.shown)
                }
            }
        }
    }
    // where in the description the shown part is
    Rectangle {
        visible: page.shown !== null && detailContainer.visibleArea.heightRatio < 0.999
        x: detailContainer.x + detailContainer.width + 12
        y: detailContainer.y + detailContainer.visibleArea.yPosition * detailContainer.height
        width: 2
        height: Math.max(18, detailContainer.visibleArea.heightRatio * detailContainer.height)
        color: Theme.line
        opacity: 0.4 * page.swap * page.ease(page.reveal * 2.2 - 0.7)
    }

    // a mod or a pack from a zip (a folder can be dropped on the window)
    Row {
        objectName: "addMod"
        x: 124; y: page.height - 164
        spacing: 12
        opacity: page.ease(page.reveal * 2.2 - 1.0)
        OutlineButton {
            label: qsTr("ADD A MOD")
            tone: Theme.dim
            onClicked: page.addAsked()
        }
        // the link of a zip on GitHub, copied in the browser first
        OutlineButton {
            objectName: "addLink"
            label: qsTr("FROM A LINK")
            tone: Theme.dim
            onClicked: page.linkAsked()
        }
    }

    // what can be done with the chosen mod; it keeps its place whatever the length of the words above
    Row {
        objectName: "libraryActions"
        x: 520; y: page.height - 164
        spacing: 12
        opacity: page.swap * page.ease(page.reveal * 2.2 - 1.0)
        visible: page.shown !== null && !page.shown.locked
        OutlineButton {
            label: page.shown && page.shown.enabled ? qsTr("SWITCH OFF") : qsTr("SWITCH ON")
            onClicked: page.flip(page.shown, !page.shown.enabled)
        }
        // the choices this mod's author offers (they are rows of the Options page)
        OutlineButton {
            objectName: "modSettings"
            visible: page.shown && page.shown.settings.length > 0
            label: qsTr("SETTINGS")
            tone: Theme.dim
            onClicked: page.settingsAsked(page.shown)
        }
        OutlineButton {
            visible: page.shown && page.shown.installed
            label: qsTr("UNINSTALL")
            danger: true
            onClicked: page.uninstallAsked(page.shown)
        }
        OutlineButton {
            visible: page.shown && !page.shown.installed
            label: qsTr("DELETE FILES")
            tone: Theme.dim
            onClicked: page.deleteAsked(page.shown)
        }
    }
}
