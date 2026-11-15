import QtQuick

// The roadmap: the sheets of the Redux roadmap as the Part 1 trailer shows them (2026, 2027, the fighters of 2027), one at a
// time. A sheet builds up piece by piece when it opens, the way it does in the trailer: its title wipes in, the line draws
// across, each column lands as the line reaches its node, and what stands in a column lands one piece after another. The
// pictures are the roadmap pages themselves in three layers (zenith_gui\art\roadmap, written by tools\roadmap_sheets.py with
// the boxes of their pieces in zenith_gui\roadmap.json). A tab or a tap on the sheet shows the next one; left alone, the
// page goes on by itself. With Motion set to Calm a sheet is shown complete and stays.
Item {
    id: page
    property real reveal: 1
    readonly property var plan: controller.roadmap
    readonly property var sheets: plan.sheets || []
    property int at: 0                         // the sheet that is shown
    readonly property var sheet: sheets.length > 0 ? sheets[Math.min(at, sheets.length - 1)] : null
    readonly property var showing: null        // nothing of this page stands on the window's stage
    property real t: 0                         // sixtieths of a second since the sheet opened
    readonly property var pieces: build(sheet)
    readonly property var rings: nodes(sheet)
    // where the view stands over the time a sheet is shown: the whole sheet while it builds up, then closer on each column
    // in turn so its lines can be read, then the whole sheet again. Each stop: [time, centre x, centre y, zoom], on the page.
    readonly property var stops: views(sheet)
    readonly property real stay: stops.length > 0 ? stops[stops.length - 1][0] + 50 : 660     // when the next sheet comes
    readonly property var view: viewAt(t)

    visible: reveal > 0.001
    function ease(v) { const c = Math.max(0, Math.min(1, v)); return c * c * (3 - 2 * c) }
    function seg(f, a, b) { return Math.max(0, Math.min(1, (f - a) / (b - a))) }
    function outExpo(v) { return v >= 1 ? 1 : v <= 0 ? 0 : 1 - Math.pow(2, -10 * v) }
    function outCubic(v) { const c = 1 - Math.max(0, Math.min(1, v)); return 1 - c * c * c }
    function restart() { clock.from = Date.now(); t = Theme.calm ? 99999 : 0 }
    function choose(i) { at = i; restart(); wait.restart() }
    onAtChanged: restart()

    // where the line stands when it reaches a column's node, and so when that column lands
    function reach(x) { return 5 + 29 * (1 - Math.sqrt(1 - Math.min(0.999, x / 1920 / 1.12))) }
    // a sheet's pieces in the order they are drawn: each a box of the page (1920 x 1080), the layer it is cut from, how it
    // comes in and when
    function build(s) {
        if (!s) return []
        const b = s.boxes || {}, out = []
        const add = (layer, r, how, f0, more) => out.push(Object.assign({ layer: layer, r: r, how: how, f0: f0, grow: 0, len: 10, from: 1 }, more || {}))
        add("fg", [0, 0, 1300, 186], "wipe", 0, { len: 14 })
        add("fg", [1300, 0, 1920, 186], "pop", 3, { from: 1.3 })
        if (b.pw && b.stem) {
            add("fg", [0, 186, 1920, 234], "line", 5, { len: 29 })
            const edge = [0, (b.pw[0][2] + b.pw[1][0]) / 2, (b.pw[1][2] + b.pw[2][0]) / 2, 1920]
            const all = [].concat(b.card || [], b.mod || [], b.li || [])
            for (let i = 0; i < 3; ++i) {
                const f0 = reach(b.stem[i][0])
                add("fg", [edge[i], 234, edge[i + 1], 350], "drop", f0)
                add("fr", [edge[i], 350, edge[i + 1], 870], "rise", f0 + 4)
                const mine = all.filter(r => (r[0] + r[2]) / 2 > edge[i] && (r[0] + r[2]) / 2 < edge[i + 1]).sort((p, q) => (p[1] - q[1]) || (p[0] - q[0]))
                for (let j = 0; j < mine.length; ++j) add("fg", mine[j], "land", f0 + 9 + j * 2.5, { grow: 6 })
            }
            add("fg", [0, 870, 1920, 1080], "foot", 28, { len: 16 })
        } else {
            add("fg", [0, 186, 1920, 290], "wipe", 4, { len: 16 })
            add("fr", [0, 290, 1920, 935], "foot", 0, { len: 6 })
            const cards = b.gcard || []
            for (let j = 0; j < cards.length; ++j) add("fg", cards[j], "deal", 6 + (j % 8) * 1.6 + Math.floor(j / 8) * 3.4, { grow: 5 })
            add("fg", [0, 935, 1920, 1080], "foot", 24, { len: 16 })
        }
        return out
    }
    function views(s) {
        if (!s) return []
        const b = s.boxes || {}, whole = [960, 540, 1], out = [[0].concat(whole), [110].concat(whole)]
        if (b.pw && b.stem) {
            const edge = [0, (b.pw[0][2] + b.pw[1][0]) / 2, (b.pw[1][2] + b.pw[2][0]) / 2, 1920]
            for (let i = 0; i < 3; ++i) {
                const near = [(edge[i] + edge[i + 1]) / 2, 543, 1.5]
                out.push([150 + i * 170].concat(near)); out.push([280 + i * 170].concat(near))
            }
            out.push([670].concat(whole))
        } else {
            out.push([150, 640, 560, 1.5]); out.push([230, 640, 560, 1.5]); out.push([470, 1280, 560, 1.5]); out.push([540, 1280, 560, 1.5])
            out.push([590].concat(whole))
        }
        return out
    }
    function viewAt(f) {
        const s = stops
        if (s.length === 0) return [960, 540, 1]
        if (f <= s[0][0]) return s[0].slice(1)
        for (let i = 1; i < s.length; ++i) if (f < s[i][0]) {
            const u = ease((f - s[i - 1][0]) / (s[i][0] - s[i - 1][0])), a = s[i - 1], c = s[i]
            return [a[1] + (c[1] - a[1]) * u, a[2] + (c[2] - a[2]) * u, a[3] + (c[3] - a[3]) * u]
        }
        return s[s.length - 1].slice(1)
    }
    function nodes(s) {
        const b = s ? (s.boxes || {}) : {}
        return (b.stem || []).map(st => ({ x: st[0], y: 214, f0: reach(st[0]) }))
    }

    Timer { id: wait; interval: 20000 }       // after a tap the page waits before it goes on by itself
    Timer {                                    // counts the time that really passed, so a slow frame never stretches a sheet
        id: clock
        property real from: 0
        interval: 16; repeat: true
        running: page.visible && page.reveal > 0.5
        onRunningChanged: if (running) page.restart()
        onTriggered: {
            if (Theme.calm) { page.t = 99999; return }
            page.t = (Date.now() - from) * 0.06
            if (page.t > page.stay && page.sheets.length > 1 && !wait.running && !over.hovered && !Theme.modal)
                page.at = (page.at + 1) % page.sheets.length
        }
    }

    Row {
        objectName: "roadmapWords"
        x: 128; y: 62
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

    // the sheets, as tabs
    Row {
        id: tabs
        objectName: "roadmapTabs"
        x: box.x + box.width - width; y: 60
        spacing: 24
        opacity: page.ease(page.reveal * 2.4 - 0.4)
        Repeater {
            model: page.sheets
            delegate: Item {
                id: tab
                required property int index
                required property var modelData
                objectName: "roadmapColumn"
                readonly property bool chosen: page.at === index
                width: word.implicitWidth; height: 18
                readonly property bool tabStop: true
                activeFocusOnTab: true
                function press() { Sfx.play("press"); page.choose(index) }
                Keys.onReturnPressed: press()
                Keys.onEnterPressed: press()
                Keys.onSpacePressed: press()
                FocusMark { inset: -4 }
                Text {
                    id: word
                    text: String(tab.modelData.label || tab.modelData.key || "")
                    font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 2.6
                    color: tab.chosen ? Theme.text : tabOver.hovered ? Theme.line : Theme.dim
                    Behavior on color { ColorAnimation { duration: Theme.fast } }
                }
                Rectangle { y: 16; width: tab.chosen ? parent.width : 0; height: 1.5; color: Theme.cyan
                            Behavior on width { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } } }
                HoverHandler { id: tabOver; cursorShape: Qt.PointingHandCursor }
                TapHandler { onTapped: tab.press() }
            }
        }
    }

    // the sheet
    Item {
        id: box
        objectName: "roadmapSheet"
        readonly property real room: page.width - 128 - 36
        readonly property real k: width / 1920          // the page's pixels to the window's
        // above the window's status line and its large button, which every page keeps clear
        width: Math.max(160, Math.min(room, (page.height - 88 - 92) * 16 / 9)); height: width * 9 / 16
        x: 128 + (room - width) / 2; y: 88
        opacity: page.ease(page.reveal * 2.4 - 0.6)
        transform: Translate { y: (1 - box.opacity) * 14 }
        clip: true

        Item {
        id: sheetView
        objectName: "roadmapView"
        width: box.width; height: box.height
        readonly property real zoom: page.view[2]
        transform: [
            Scale { xScale: sheetView.zoom; yScale: sheetView.zoom },
            Translate {     // the view's centre in the middle of the box, never past the sheet's edge
                x: Math.min(0, Math.max(box.width * (1 - sheetView.zoom), box.width / 2 - page.view[0] * box.k * sheetView.zoom))
                y: Math.min(0, Math.max(box.height * (1 - sheetView.zoom), box.height / 2 - page.view[1] * box.k * sheetView.zoom))
            }
        ]

        Image {
            objectName: "roadmapGround"
            anchors.fill: parent
            source: page.sheet ? page.sheet.bg : ""
            smooth: true; mipmap: true
        }
        Repeater {
            model: page.pieces
            delegate: Item {
                id: piece
                required property var modelData
                objectName: "roadmapPiece"
                readonly property var d: modelData
                readonly property real f: page.t - d.f0
                readonly property real x0: d.r[0] - d.grow
                readonly property real y0: d.r[1] - d.grow
                readonly property real w0: d.r[2] - d.r[0] + 2 * d.grow
                readonly property real h0: d.r[3] - d.r[1] + 2 * d.grow
                // how far it has come in, 0 to 1
                readonly property real e: d.how === "land" ? page.outExpo(f / 7) : d.how === "deal" ? page.outExpo(f / 8)
                                          : d.how === "foot" ? page.outCubic(page.seg(f, 0, d.len)) : page.outExpo(f / d.len)
                // it starts above (a heading), below (a panel and what lands in it) or in place
                readonly property real shift: d.how === "drop" ? -48 : d.how === "rise" ? 42 : d.how === "land" ? 30 : d.how === "deal" ? 36 : d.how === "foot" ? 24 : 0
                visible: f >= 0
                x: x0 * box.k
                y: (y0 + shift * (1 - e)) * box.k
                width: w0 * box.k * (d.how === "wipe" ? page.outCubic(page.seg(f, 0, d.len))
                                     : d.how === "line" ? Math.min(1, 1.12 * (1 - Math.pow(1 - page.seg(f, 0, d.len), 2))) : 1)
                height: h0 * box.k
                clip: true
                opacity: d.how === "wipe" || d.how === "line" ? 1 : d.how === "foot" ? page.seg(f, 0, d.len) : page.seg(f, 0, 3)
                scale: d.how === "land" ? 1.2 - 0.2 * e : d.how === "deal" ? 0.5 + 0.5 * e : d.how === "pop" ? d.from + (1 - d.from) * e : 1
                Image {
                    x: -piece.x0 * box.k; y: -piece.y0 * box.k
                    width: 1920 * box.k; height: 1080 * box.k
                    source: page.sheet ? (piece.d.layer === "fg" ? page.sheet.fg : page.sheet.fr) : ""
                    smooth: true; mipmap: true
                }
                // a piece that lands flashes once
                Rectangle {
                    anchors.fill: parent
                    visible: piece.d.how === "land" || piece.d.how === "deal"
                    color: "#ffffff"
                    opacity: 0.42 * Math.exp(-Math.max(0, piece.f) / 3.5)
                }
            }
        }
        // a node rings out as the line reaches it
        Repeater {
            model: page.rings
            delegate: Rectangle {
                required property var modelData
                readonly property real f: page.t - modelData.f0
                readonly property real across: (34 + page.outExpo(f / 20) * 182) * box.k
                visible: f >= 0 && f < 70
                x: modelData.x * box.k - across / 2; y: modelData.y * box.k - across / 2
                width: across; height: across; radius: across / 2
                color: "transparent"
                border.color: "#8fdcff"; border.width: Math.max(1, 3 * box.k)
                opacity: Math.min(1, 1.5 * Math.exp(-Math.max(0, f) / 8))
            }
        }
        }
        Rectangle { anchors.fill: parent; color: "transparent"; border.color: Theme.cyan; border.width: 1; opacity: 0.35 }
        HoverHandler { id: over; cursorShape: Qt.PointingHandCursor }
        TapHandler { onTapped: { Sfx.play("press"); page.choose((page.at + 1) % Math.max(1, page.sheets.length)) } }
    }

    // the other sheets' pictures are read once the page has been opened, so a change of sheet does not wait for a file
    Loader {
        active: page.reveal > 0.01 || item !== null
        sourceComponent: Item {
            visible: false
            Repeater {
                model: page.sheets
                delegate: Item {
                    required property var modelData
                    Image { source: modelData.bg; asynchronous: true }
                    Image { source: modelData.fg; asynchronous: true }
                    Image { source: modelData.fr; asynchronous: true }
                }
            }
        }
    }
}
