import QtQuick
import QtQuick3D
import QtQuick.Particles

// Redux: the four parts round the Redux core, on a stage of light. Each part's mark (the approved v3 solid, live) hovers
// over a projector on the floor; a part's mark switches every mod in it, its chips one mod. A part that is on sends data
// down its conduit into the core, and with all four on the core powers up: it charges, a shock wave and lightning go
// out to the four marks, sparks fly, and the room turns red. The floor is a real 3D scene; the marks are in their own
// views (MarkView) placed where the camera sees their projectors; lightning and beams are drawn over it in shaders.
Item {
    id: page
    objectName: "reduxPage"
    property real reveal: 1
    property var redux: ({})          // controller.redux: {name, version, build, parts: [{name, mods: [{id, version}]}]}
    property var mods: []             // controller.mods
    signal partSwitched(var ids, bool on)
    signal switched(string id, bool on)

    visible: reveal > 0.001
    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

    // ---- what is on --------------------------------------------------------------------------------------------------
    readonly property var byId: { const o = {}; for (const m of page.mods) o[m.id] = m; return o }
    readonly property var marks: ({ "Tactics Plus Ultra": "tactics", "BlazBlue EX": "ex", "Entropy Overhaul": "entropy", "Cross Effect": "cross" })
    readonly property var pillars: (page.redux.parts || []).filter(p => page.marks[p.name] !== undefined).slice(0, 4)
    readonly property var others: (page.redux.parts || []).filter(p => page.marks[p.name] === undefined)
    function state(part) {
        const here = (part.mods || []).map(m => page.byId[m.id]).filter(m => m !== undefined && !m.locked)
        const on = here.filter(m => m.enabled)
        return { ids: here.map(m => m.id), on: here.length > 0 && on.length === here.length, some: on.length > 0,
                 count: on.length, total: (part.mods || []).length, here: here.length }
    }
    readonly property var states: page.pillars.map(p => page.state(p))
    readonly property int lit: page.states.filter(s => s.on).length
    readonly property bool powered: page.pillars.length === 4 && page.lit === 4
    function short(mod, id) {
        const t = mod ? mod.title : id
        return t.replace(/^(BlazBlue EX|Entropy Overhaul|Cross Effect|Tactics Plus Ultra|Boons Plus)\s*:\s*/i, "").toUpperCase()
    }

    // ---- the stage's world: the core's projector at the origin, the parts at the four corners of the floor ------------
    readonly property real px_: 335          // a part's distance out (x) and back or forward (z)
    readonly property real pz_: 205
    readonly property real coreH: 128        // how high the core's mark hovers
    readonly property real partH: 92
    function where(i) { return Qt.vector3d((i % 2 ? 1 : -1) * page.px_, 0, (i < 2 ? -1 : 1) * page.pz_) }

    // the camera, and where it puts a point of the world on the page (layout units)
    readonly property real camPitch: 27
    readonly property real camFov: 25
    readonly property vector3d camAt: Qt.vector3d(0, 40, 0)
    readonly property real camDist: 1350
    readonly property real viewX: 96
    readonly property real viewY: 136
    readonly property real viewW: width - 96
    readonly property real viewH: height - 240
    readonly property real focal: (viewH / 2) / Math.tan(camFov / 2 * Math.PI / 180)
    readonly property vector3d camPos: Qt.vector3d(camAt.x, camAt.y + camDist * Math.sin(camPitch * Math.PI / 180), camAt.z + camDist * Math.cos(camPitch * Math.PI / 180))
    function project(p) {
        const a = page.camPitch * Math.PI / 180
        const x = p.x - page.camPos.x, y = p.y - page.camPos.y, z = p.z - page.camPos.z
        const y2 = y * Math.cos(a) - z * Math.sin(a), z2 = y * Math.sin(a) + z * Math.cos(a)
        const k = page.focal / Math.max(1, -z2)
        return { x: page.viewX + page.viewW / 2 + x * k, y: page.viewY + page.viewH / 2 - y2 * k, k: k }
    }

    // ---- time, and the beats ---------------------------------------------------------------------------------------
    property real t: 0
    NumberAnimation on t { from: 0; to: 100000000; duration: 100000000; loops: Animation.Infinite; running: page.visible && Fx.full }
    property real spinRate: page.powered ? 3.2 : 1.0
    Behavior on spinRate { NumberAnimation { duration: 900; easing.type: Easing.InOutCubic } }
    readonly property real turn: page.t * page.spinRate * 0.006        // degrees for the slow rings

    property real charge: 0           // the core charging, then holding at its idle glow
    property real bolts: 0            // lightning to the four marks
    property real flare: 0            // the marks' bloom pushed out
    readonly property color hot: page.powered ? "#ff3a5c" : Theme.cyan
    readonly property color hotFloor: page.powered ? "#ff4f72" : "#3fd6f0"

    onPoweredChanged: {
        if (!page.visible || page.reveal < 0.5) { page.charge = page.powered ? 0.38 : 0; page.bolts = page.powered ? 0.22 : 0; page.flare = page.powered ? 0.25 : 0; return }
        if (page.powered) { powerDown.stop(); powerUp.restart() } else { powerUp.stop(); powerDown.restart() }
    }
    SequentialAnimation {
        id: powerUp
        ScriptAction { script: Sfx.play("charge") }
        ParallelAnimation {
            NumberAnimation { target: page; property: "charge"; from: 0; to: 1; duration: 420; easing.type: Easing.InCubic }
            NumberAnimation { target: Fx; property: "split"; from: 0; to: 0.6; duration: 420; easing.type: Easing.InQuad }
        }
        ScriptAction {
            script: {
                const c = page.project(Qt.vector3d(0, page.coreH, 0))
                const g = page.mapToItem(null, c.x, c.y)
                Fx.shock(g.x, g.y, 1.0); Fx.burst("#ff3f6c", 0.32); Fx.shake(0.9)
                sparks.burst(140); Sfx.play("powerup")
                page.bolts = 1; page.flare = 1
                for (let i = 0; i < partMarks.count; i++) partMarks.itemAt(i).celebrate()
                coreMark.glint()
            }
        }
        ParallelAnimation {
            NumberAnimation { target: page; property: "bolts"; to: 0.22; duration: 1300; easing.type: Easing.OutCubic }
            NumberAnimation { target: page; property: "flare"; to: 0.25; duration: 1400; easing.type: Easing.OutCubic }
            NumberAnimation { target: page; property: "charge"; to: 0.38; duration: 1100; easing.type: Easing.OutCubic }
        }
    }
    SequentialAnimation {
        id: powerDown
        ScriptAction { script: { Sfx.play("powerdown"); Fx.pulse(0.5) } }
        ParallelAnimation {
            NumberAnimation { target: page; property: "bolts"; to: 0; duration: 260 }
            NumberAnimation { target: page; property: "flare"; to: 0; duration: 400 }
            SequentialAnimation {
                NumberAnimation { target: page; property: "charge"; to: 0.6; duration: 60 }
                NumberAnimation { target: page; property: "charge"; to: 0.1; duration: 90 }
                NumberAnimation { target: page; property: "charge"; to: 0.3; duration: 70 }
                NumberAnimation { target: page; property: "charge"; to: 0; duration: 380; easing.type: Easing.OutCubic }
            }
        }
    }
    // powered and idle: the core throws an arc now and then
    Timer {
        interval: 1400; repeat: true
        running: page.powered && page.visible && Fx.full && !powerUp.running
        onTriggered: { interval = 900 + Math.random() * 2200; arcRun.restart() }
    }
    property real arc: 0
    property real arcAngle: 0
    SequentialAnimation {
        id: arcRun
        ScriptAction { script: page.arcAngle = Math.random() * Math.PI * 2 }
        NumberAnimation { target: page; property: "arc"; from: 0; to: 1; duration: 40 }
        NumberAnimation { target: page; property: "arc"; to: 0; duration: 260; easing.type: Easing.InQuad }
    }

    // ---- the floor (a real 3D scene, made at the screen's own resolution) -------------------------------------------
    component Hud: Model {
        id: hud
        property color tint: Theme.cyan
        property real intensity: 1
        property real base: 0.6
        property real flow: 0
        property real count: 1
        property real speed: 0
        property real sweep: 0
        property real sweepAt: 0
        property real sweepWidth: 6
        property real dash: 0
        property real soft: 0.25
        property real reach: 1
        materials: CustomMaterial {
            shadingMode: CustomMaterial.Unshaded
            sourceBlend: CustomMaterial.One; destinationBlend: CustomMaterial.One
            cullMode: Material.NoCulling
            vertexShader: "shaders3d/hud.vert"
            fragmentShader: "shaders3d/hud.frag"
            property color tint: hud.tint
            property real intensity: hud.intensity * page.reveal
            property real base: hud.base
            property real flow: hud.flow
            property real count: hud.count
            property real speed: hud.speed
            property real sweep: hud.sweep
            property real sweepAt: hud.sweepAt
            property real sweepWidth: hud.sweepWidth
            property real dash: hud.dash
            property real soft: hud.soft
            property real reach: hud.reach
            property real time: page.t / 1000
        }
    }
    component Plate: Model {
        id: plate
        property color tint: Theme.cyan
        property real intensity: 1
        property real cells: 9
        source: "../art/hud3d/hex_plate.mesh"
        materials: CustomMaterial {
            shadingMode: CustomMaterial.Unshaded
            sourceBlend: CustomMaterial.One; destinationBlend: CustomMaterial.One
            cullMode: Material.NoCulling
            vertexShader: "shaders3d/hud.vert"
            fragmentShader: "shaders3d/plate.frag"
            property color tint: plate.tint
            property real intensity: plate.intensity * page.reveal
            property real cells: plate.cells
            property real time: page.t / 1000
        }
    }

    Item {
        id: crisp
        x: page.viewX; y: page.viewY
        width: page.viewW; height: page.viewH
        readonly property real u: Theme.unit * Theme.dpr
        enabled: false
        Item {
            width: Math.max(1, Math.round(crisp.width * crisp.u)); height: Math.max(1, Math.round(crisp.height * crisp.u))
            scale: 1 / crisp.u; transformOrigin: Item.TopLeft
            View3D {
                id: floor
                anchors.fill: parent
                visible: page.visible
                opacity: page.ease(page.reveal * 1.6)
                environment: SceneEnvironment {
                    backgroundMode: SceneEnvironment.Transparent
                    antialiasingMode: SceneEnvironment.MSAA; antialiasingQuality: SceneEnvironment.High
                }
                PerspectiveCamera {
                    position: page.camPos
                    eulerRotation.x: -page.camPitch
                    fieldOfView: page.camFov
                    clipNear: 50; clipFar: 5000
                }

                // the core's projector: a lattice plate, rings turning against each other, ticks, a hexagon
                Node {
                    Plate { scale: Qt.vector3d(150, 1, 150); eulerRotation.y: 30; tint: page.hotFloor; intensity: 0.5 + 0.35 * page.charge; cells: 11 }
                    Hud { source: "../art/hud3d/hex_line.mesh"; scale: Qt.vector3d(150, 1, 150); eulerRotation.y: 30; tint: page.hotFloor; intensity: 0.9 + page.charge; base: 0.8; soft: 0.4 }
                    Hud { source: "../art/hud3d/ring_arcs.mesh"; y: 0.5; scale: Qt.vector3d(132, 1, 132); eulerRotation.y: page.turn * 2; tint: page.hotFloor; intensity: 0.5 + 0.9 * page.charge; base: 0.6; sweep: 1; sweepAt: page.t / 2400; sweepWidth: 5 }
                    Hud { source: "../art/hud3d/ring_dash.mesh"; y: 1; scale: Qt.vector3d(172, 1, 172); eulerRotation.y: -page.turn * 1.3; tint: page.hotFloor; intensity: 0.45 + 0.6 * page.charge; base: 0.7 }
                    Hud { source: "../art/hud3d/ring_ticks.mesh"; y: 1.5; scale: Qt.vector3d(192, 1, 192); eulerRotation.y: page.turn * 0.4; tint: page.hotFloor; intensity: 0.4 + 0.4 * page.charge; base: 0.6; soft: 0.1 }
                    Hud { source: "../art/hud3d/ring_thin.mesh"; y: 2; scale: Qt.vector3d(214, 1, 214); tint: page.hotFloor; intensity: 0.35 + 0.5 * page.charge; base: 0.7; sweep: 1; sweepAt: -page.t / 3600; sweepWidth: 3; soft: 0.1 }
                    // the charge: a wave running out across the floor
                    Hud { source: "../art/hud3d/ring_band.mesh"; y: 2.5; visible: page.charge > 0.5; scale: Qt.vector3d(140 + 520 * (page.charge - 0.5), 1, 140 + 520 * (page.charge - 0.5)); tint: "#ff6a85"; intensity: (1 - page.charge) * 3; base: 1 }
                }
                // the halo standing round the core's mark: rings on edge, turning
                Node {
                    y: page.coreH
                    Hud { source: "../art/hud3d/ring_dash.mesh"; scale: Qt.vector3d(122, 1, 122); eulerRotation: Qt.vector3d(90, 0, page.turn * 3); tint: page.hot; intensity: 0.25 + 0.9 * page.charge; base: 0.7 }
                    Hud { source: "../art/hud3d/ring_thin.mesh"; scale: Qt.vector3d(138, 1, 138); eulerRotation: Qt.vector3d(78, page.turn * 2.2, 0); tint: page.hot; intensity: 0.2 + 0.7 * page.charge; base: 0.6; sweep: 1; sweepAt: page.t / 1600; sweepWidth: 4 }
                    Hud { source: "../art/hud3d/ring_thin.mesh"; scale: Qt.vector3d(146, 1, 146); eulerRotation: Qt.vector3d(102, -page.turn * 1.7, 0); tint: page.hot; intensity: 0.15 + 0.6 * page.charge; base: 0.5 }
                }

                // each part: its projector, and the conduit from it into the core
                Repeater3D {
                    model: page.pillars.length
                    delegate: Node {
                        id: part
                        required property int index
                        readonly property var st: page.states[index] || ({ on: false, some: false })
                        readonly property vector3d at: page.where(index)
                        readonly property color tone: st.on ? page.hotFloor : (st.some ? "#2a8fa8" : "#3a4d66")
                        property real fill: st.on ? 1 : 0
                        Behavior on fill { NumberAnimation { duration: 650; easing.type: Easing.InOutCubic } }
                        Node {
                            position: part.at
                            Plate { scale: Qt.vector3d(74, 1, 74); eulerRotation.y: 30; tint: part.tone; intensity: part.st.on ? (page.powered ? 0.45 : 0.8) : 0.35; cells: 7 }
                            Hud { source: "../art/hud3d/hex_band.mesh"; y: 0.5; scale: Qt.vector3d(80, 1, 80); eulerRotation.y: 30; tint: part.tone; intensity: part.st.on ? (page.powered ? 0.8 : 1.1) : 0.45; base: 0.7; soft: 0.35; sweep: part.st.on ? 1 : 0; sweepAt: page.t / 1900 + part.index * 0.25; sweepWidth: 4 }
                            Hud { source: "../art/hud3d/ring_dash.mesh"; y: 1; scale: Qt.vector3d(100, 1, 100); eulerRotation.y: page.turn * (part.index % 2 ? -1.6 : 1.6); tint: part.tone; intensity: part.st.on ? 0.7 : 0.25; base: 0.7 }
                            Hud { source: "../art/hud3d/ring_ticks.mesh"; y: 1.5; scale: Qt.vector3d(112, 1, 112); tint: part.tone; intensity: part.st.on ? 0.45 : 0.18; base: 0.6; soft: 0.1 }
                        }
                        // the conduit: from the projector's rim to the core's, a bus of three lines; pulses run in when on
                        readonly property real reachOut: Math.hypot(at.x, at.z)
                        readonly property vector3d from: Qt.vector3d(at.x * (1 - 108 / reachOut), 0, at.z * (1 - 108 / reachOut))
                        readonly property vector3d to: Qt.vector3d(at.x * 222 / reachOut, 0, at.z * 222 / reachOut)
                        readonly property real len: Math.hypot(to.x - from.x, to.z - from.z)
                        readonly property real ang: Math.atan2(-(to.z - from.z), to.x - from.x) * 180 / Math.PI
                        Node {
                            position: part.from
                            eulerRotation.y: part.ang
                            Hud { source: "../art/hud3d/strip.mesh"; y: 0.5; scale: Qt.vector3d(part.len, 1, 12); tint: part.tone; intensity: 0.35 + 0.9 * part.fill; base: part.st.on ? 0.25 : 0.12; dash: part.st.on ? 0 : 26; flow: part.fill; count: 5; speed: page.powered ? 1.6 : 0.8; soft: 0.5; reach: part.st.on ? part.fill : 1 }
                            Hud { source: "../art/hud3d/strip.mesh"; y: 0.6; z: -11; scale: Qt.vector3d(part.len, 1, 2); tint: part.tone; intensity: 0.6 + 0.6 * part.fill; base: 0.8; soft: 0.3 }
                            Hud { source: "../art/hud3d/strip.mesh"; y: 0.6; z: 11; scale: Qt.vector3d(part.len, 1, 2); tint: part.tone; intensity: 0.6 + 0.6 * part.fill; base: 0.8; soft: 0.3 }
                        }
                    }
                }
            }
        }
    }

    // ---- the light each projector throws up to its mark, under the marks --------------------------------------------
    Repeater {
        model: page.pillars.length
        delegate: ShaderEffect {
            id: beam
            required property int index
            readonly property var st: page.states[index] || ({ on: false })
            readonly property var foot: page.project(page.where(index))
            readonly property var head: page.project(Qt.vector3d(page.where(index).x, page.partH, page.where(index).z))
            x: foot.x - width / 2; y: head.y
            width: 150 * foot.k; height: Math.max(1, foot.y - head.y)
            property color tint: beam.st.on ? page.hot : "#5aa9c4"
            property real time: page.t / 1000
            property real strength: (beam.st.on ? 0.9 : 0.25) * page.reveal
            property real narrow: 0.45
            fragmentShader: "shaders/beam.frag.qsb"
        }
    }
    ShaderEffect {
        readonly property var foot: page.project(Qt.vector3d(0, 0, 0))
        readonly property var head: page.project(Qt.vector3d(0, page.coreH, 0))
        x: foot.x - width / 2; y: head.y
        width: 260 * foot.k; height: Math.max(1, foot.y - head.y)
        property color tint: page.hot
        property real time: page.t / 1000
        property real strength: (0.25 + 0.75 * page.charge + 0.2 * page.lit / 4) * page.reveal
        property real narrow: 0.5
        fragmentShader: "shaders/beam.frag.qsb"
    }

    // ---- the marks -------------------------------------------------------------------------------------------------
    Repeater {
        id: partMarks
        model: page.pillars
        delegate: Item {
            id: node
            objectName: "reduxPart"
            property string partName: modelData.name
            required property int index
            required property var modelData
            readonly property var st: page.states[index] || ({ on: false, some: false, ids: [], here: 0, count: 0, total: 0 })
            readonly property var at: page.project(Qt.vector3d(page.where(index).x, page.partH, page.where(index).z))
            readonly property real shows: page.ease(page.reveal * 2.2 - 0.3 - index * 0.12)
            readonly property bool outRight: index % 2 === 1
            readonly property real size: 238 * at.k
            property real spinY: 0
            property bool wasOn: st.on
            function celebrate() { spinRun.restart(); view.glint() }
            x: at.x - size / 2; y: at.y - size / 2 + Math.sin(page.t / 900 + index * 1.7) * 4 + (1 - shows) * 30
            width: size; height: size
            z: index < 2 ? 1 : 3
            opacity: shows
            SequentialAnimation {
                id: spinRun
                NumberAnimation { target: node; property: "spinY"; from: 0; to: 360; duration: 900; easing.type: Easing.OutCubic }
            }
            onStChanged: {
                if (st.on && !wasOn && page.visible && page.reveal > 0.5) { spinRun.restart(); view.glint() }
                wasOn = st.on
            }

            MarkView {
                id: view
                anchors.fill: parent
                mark: page.marks[node.modelData.name]
                power: node.st.on ? 1 : node.st.some ? 0.55 : 0.28
                Behavior on power { NumberAnimation { duration: 420; easing.type: Easing.OutCubic } }
                flare: page.flare * (node.st.on ? 1 : 0)
                surge: page.flare * 0.6
                yaw: Math.sin(page.t / 1700 + node.index) * 7 + (hover.hovered ? (hover.point.position.x / node.width - 0.5) * 30 : 0) + node.spinY
                pitch: Math.cos(page.t / 2100 + node.index) * 4 + (hover.hovered ? (hover.point.position.y / node.height - 0.5) * 22 : 0)
                lift: hover.hovered ? 14 : 0
                Behavior on lift { NumberAnimation { duration: Theme.fast; easing.type: Easing.OutCubic } }
                sheen: hover.hovered ? 1 : 0
                sheenAt: (page.t / 700) % 3 - 1
                fill: 0.56
            }
            HoverHandler {
                id: hover
                cursorShape: node.st.here ? Qt.PointingHandCursor : Qt.ArrowCursor
                onHoveredChanged: if (hovered) { Sfx.play("hover"); view.glint() }
            }
            TapHandler {
                enabled: node.st.here > 0
                onTapped: { Sfx.play(node.st.on ? "off" : "on"); page.partSwitched(node.st.ids, !node.st.on) }
            }

            // its name, its state and a chip per mod, on the side away from the core
            Column {
                // beside the mark, away from the core, but kept inside the page
                x: {
                    const want = node.x + (node.outRight ? node.width * 0.82 : node.width * 0.18 - width)
                    return Math.max(page.viewX + 14, Math.min(page.width - 36 - width, want)) - node.x
                }
                anchors.verticalCenter: parent.verticalCenter
                width: 172
                spacing: 4
                DecodeText {
                    anchors.right: node.outRight ? undefined : parent.right
                    text: node.modelData.name.toUpperCase()
                    run: node.shows > 0.5
                    font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 2.6
                    color: node.st.on ? Theme.text : Theme.dim
                }
                Text {
                    anchors.right: node.outRight ? undefined : parent.right
                    text: node.st.here === 0 ? qsTr("NOT IN THIS TERMINAL") : node.st.on ? qsTr("ONLINE") : node.st.some ? node.st.count + qsTr(" OF ") + node.st.here + qsTr(" ON") : qsTr("OFFLINE")
                    font.family: Theme.mono; font.pixelSize: 11; font.letterSpacing: 1.6
                    color: node.st.on ? (page.powered ? "#ff6a85" : Theme.cyan) : Theme.faint
                }
                Item { width: 1; height: 2 }
                Repeater {
                    model: node.modelData.mods || []
                    delegate: Chip { required property var modelData; mid: modelData.id; anchors.right: node.outRight ? undefined : parent.right }
                }
            }
        }
    }
    Item {
        id: core
        readonly property var at: page.project(Qt.vector3d(0, page.coreH, 0))
        readonly property real size: 330 * at.k
        readonly property real shows: page.ease(page.reveal * 2 - 0.35)
        x: at.x - size / 2; y: at.y - size / 2 + Math.sin(page.t / 1100) * 3
        width: size; height: size
        z: 2
        opacity: shows
        MarkView {
            id: coreMark
            anchors.fill: parent
            mark: "redux"
            power: 0.35 + 0.65 * Math.min(1, page.lit / 4 + page.charge)
            surge: page.charge
            flare: page.flare + page.charge * 0.5
            yaw: Math.sin(page.t / 2300) * 6
            pitch: Math.cos(page.t / 2900) * 3
            sheen: page.charge > 0.8 ? 1 : 0
            sheenAt: (page.t / 500) % 3 - 1
            fill: 0.56
        }
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            y: page.project(Qt.vector3d(0, 0, 175)).y - core.y
            text: page.powered ? qsTr("REDUX ONLINE") : page.lit + " / " + page.pillars.length + qsTr("  PARTS ONLINE")
            font.family: Theme.display; font.pixelSize: page.powered ? 15 : 12; font.letterSpacing: page.powered ? 5 : 3
            color: page.powered ? "#ff6a85" : Theme.dim
            Behavior on font.letterSpacing { NumberAnimation { duration: 500; easing.type: Easing.OutCubic } }
        }
    }

    // ---- lightning and sparks over everything ---------------------------------------------------------------------
    ShaderEffect {
        id: lightning
        anchors.fill: parent
        z: 4
        visible: (page.bolts > 0.01 || page.arc > 0.01) && Fx.full
        readonly property var c: page.project(Qt.vector3d(0, page.coreH, 0))
        function end(i) { const p = page.project(Qt.vector3d(page.where(i).x * 0.92, page.partH, page.where(i).z * 0.92)); return [p.x, p.y] }
        property vector2d res: Qt.vector2d(width, height)
        property vector2d core: Qt.vector2d(c.x, c.y)
        property vector4d a01: { const a = end(0), b = end(1); return Qt.vector4d(a[0], a[1], b[0], b[1]) }
        property vector4d a23: { const a = end(2), b = end(3); return Qt.vector4d(a[0], a[1], b[0], b[1]) }
        property vector4d a45: {
            const r = 120 * c.k, a = page.arcAngle
            return Qt.vector4d(c.x + Math.cos(a) * r * 0.5, c.y + Math.sin(a) * r * 0.35, c.x + Math.cos(a + 1.1) * r * 1.25, c.y + Math.sin(a + 1.1) * r * 0.8)
        }
        property vector4d k0123: Qt.vector4d(page.bolts, page.bolts * (seed % 3 < 2 ? 1 : 0.4), page.bolts, page.bolts * (seed % 2 ? 1 : 0.5))
        property vector2d k45: Qt.vector2d(page.arc + page.bolts * 0.6, page.bolts * 0.5)
        property real seed: 0
        property real px: 1
        property color hot: "#ff2d55"
        Timer { interval: 55; repeat: true; running: lightning.visible; onTriggered: lightning.seed = Math.floor(Math.random() * 1000) }
        fragmentShader: "shaders/lightning.frag.qsb"
    }
    ParticleSystem { id: sparkSystem; anchors.fill: parent; z: 5; running: page.visible && Fx.full }
    ImageParticle {
        system: sparkSystem
        source: Qt.resolvedUrl("../art/fx/mote.png")
        color: "#ffd0da"; colorVariation: 0.15
        entryEffect: ImageParticle.None
    }
    Emitter {
        id: sparks
        system: sparkSystem
        readonly property var c: page.project(Qt.vector3d(0, page.coreH, 0))
        x: c.x - 20; y: c.y - 20; width: 40; height: 40
        enabled: false
        lifeSpan: 900; lifeSpanVariation: 500
        size: 7; sizeVariation: 5; endSize: 0
        velocity: AngleDirection { angle: 0; angleVariation: 180; magnitude: 520; magnitudeVariation: 300 }
        acceleration: PointDirection { y: 700 }
    }
    Emitter {         // embers rising off the core while it is powered
        system: sparkSystem
        readonly property var c: page.project(Qt.vector3d(0, page.coreH * 0.6, 0))
        x: c.x - 90; y: c.y; width: 180; height: 40
        enabled: page.powered && page.visible
        emitRate: 14; lifeSpan: 2200; lifeSpanVariation: 800
        size: 5; sizeVariation: 3; endSize: 1
        velocity: AngleDirection { angle: -90; angleVariation: 25; magnitude: 70; magnitudeVariation: 40 }
    }

    // ---- the words --------------------------------------------------------------------------------------------------
    Column {
        x: 128; y: 92
        z: 6
        spacing: 0
        opacity: page.ease(page.reveal * 3)
        Row {
            spacing: 10
            NavGlyph { width: 15; height: 15; kind: "redux"; tone: page.powered ? "#ff6a85" : Theme.rose; stroke: 1.4; anchors.verticalCenter: parent.verticalCenter }
            Text { text: qsTr("REDUX"); font.family: Theme.display; font.pixelSize: 11; font.letterSpacing: 3; color: Theme.rose }
        }
        Item { width: 1; height: 8 }
        DecodeText {
            text: (page.redux.name || qsTr("REDUX")).toUpperCase() + " " + String(page.redux.version || "").replace(/\.0$/, "")
            run: page.reveal > 0.3
            font.family: Theme.display; font.pixelSize: 40; font.letterSpacing: 1.4
            color: Theme.text
        }
        Item { width: 1; height: 6 }
        Text {
            text: qsTr("BUILD ") + (page.redux.build || "?") + "    " + page.lit + qsTr(" OF ") + page.pillars.length + qsTr(" PARTS ONLINE")
            font.family: Theme.mono; font.pixelSize: 13; font.letterSpacing: 1.6
            color: page.powered ? "#ff6a85" : Theme.dim
            Behavior on color { ColorAnimation { duration: Theme.base } }
        }
        Item { width: 1; height: 6 }
        Text {
            text: qsTr("Pick a part to switch every mod in it, or a chip for one mod.")
            font.family: Theme.body; font.pixelSize: 13
            color: Theme.faint
        }
    }
    Column {
        anchors.right: parent.right; anchors.rightMargin: 40; y: 96
        z: 6
        spacing: 10
        opacity: page.reveal
        Repeater {      // what is not one of the four parts: the test tools
            model: page.others
            delegate: Row {
                id: other
                required property var modelData
                anchors.right: parent.right
                spacing: 6
                Text { text: other.modelData.name.toUpperCase(); font.family: Theme.display; font.pixelSize: 9; font.letterSpacing: 2; color: Theme.dim; anchors.verticalCenter: parent.verticalCenter }
                Item { width: 4; height: 1 }
                Repeater {
                    model: other.modelData.mods || []
                    delegate: Chip { required property var modelData; mid: modelData.id }
                }
            }
        }
    }

    // a mod's own switch: a small glass plate with its name; dim when this Terminal does not have the mod
    component Chip: Rectangle {
        id: chip
        property string mid: ""
        readonly property var mod: page.byId[mid]
        readonly property bool here: mod !== undefined && !mod.locked
        readonly property bool on: here && mod.enabled
        readonly property color tone: page.powered ? "#ff4d6d" : Theme.cyan
        width: label.implicitWidth + 24; height: 20
        color: on ? Qt.rgba(tone.r, tone.g, tone.b, chipHover.hovered ? 0.22 : 0.13) : (chipHover.hovered ? "#14ffffff" : "#0a0d14")
        border.color: on ? tone : (chipHover.hovered ? Theme.dim : "#3a4458"); border.width: 1
        opacity: here ? 1 : 0.4
        Behavior on color { ColorAnimation { duration: Theme.fast } }
        Rectangle { x: 8; anchors.verticalCenter: parent.verticalCenter; width: 5; height: 5; rotation: 45; color: chip.on ? chip.tone : "#4a556b" }
        Text {
            id: label
            x: 17; anchors.verticalCenter: parent.verticalCenter
            text: page.short(chip.mod, chip.mid)
            font.family: Theme.display; font.pixelSize: 9; font.letterSpacing: 1.3
            color: chip.on ? Theme.text : Theme.dim
        }
        HoverHandler { id: chipHover; cursorShape: chip.here ? Qt.PointingHandCursor : Qt.ArrowCursor; onHoveredChanged: if (hovered && chip.here) Sfx.play("tick") }
        TapHandler { enabled: chip.here; onTapped: { Sfx.play(chip.on ? "off" : "on"); page.switched(chip.mid, !chip.on) } }
    }
}
