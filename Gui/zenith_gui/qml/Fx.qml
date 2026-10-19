pragma Singleton
import QtQuick

// What the whole window's finish (PostStack) shows at a given moment, and the calls a page makes for a big beat:
// a shock wave from a point, a flash, a shake, a colour split. Positions are in window pixels.
QtObject {
    id: fx
    // the post stack and the room, from Options: "full" or "light" (no bloom, no 3D extras, a still room)
    property string quality: "full"
    readonly property bool full: quality === "full" && !Theme.calm

    property point pointer: Qt.point(0, 0)      // where the pointer is, 0..1 across the window
    property real bloom: 1                      // the bloom's strength over the whole window

    // the beats
    property point shockAt: Qt.point(0.5, 0.5)
    property real shockT: 1                     // 0..1 as the ring travels out; 1 is idle
    property real shockPower: 1
    property real flash: 0
    property color flashTone: "#ff3f6c"
    property real split: 0                      // extra colour split at the edges
    property real shakeX: 0
    property real shakeY: 0

    function shock(x, y, power) {
        shockAt = Qt.point(x, y); shockPower = power === undefined ? 1 : power
        shockRun.restart()
    }
    function burst(tone, amount) {
        flashTone = tone; flash = amount === undefined ? 0.35 : amount; split = 1
        burstRun.restart()
    }
    function pulse(amount) { split = Math.max(split, amount === undefined ? 0.5 : amount); splitRun.restart() }     // a colour split that dies away
    function shake(amount) { shakeAmount = amount === undefined ? 1 : amount; shakeRun.restart() }

    property real shakeAmount: 1
    property real shakeT: 1
    onShakeTChanged: {
        const k = (1 - shakeT) * shakeAmount * 6
        shakeX = Math.sin(shakeT * 71.0) * k
        shakeY = Math.cos(shakeT * 53.0) * k * 0.7
    }

    property NumberAnimation shockRun: NumberAnimation { target: fx; property: "shockT"; from: 0; to: 1; duration: 900; easing.type: Easing.OutCubic }
    property ParallelAnimation burstRun: ParallelAnimation {
        NumberAnimation { target: fx; property: "flash"; to: 0; duration: 520; easing.type: Easing.OutQuad }
        NumberAnimation { target: fx; property: "split"; to: 0; duration: 700; easing.type: Easing.OutCubic }
    }
    property NumberAnimation splitRun: NumberAnimation { target: fx; property: "split"; to: 0; duration: 520; easing.type: Easing.OutCubic }
    property NumberAnimation shakeRun: NumberAnimation { target: fx; property: "shakeT"; from: 0; to: 1; duration: 420; easing.type: Easing.OutQuad }
}
