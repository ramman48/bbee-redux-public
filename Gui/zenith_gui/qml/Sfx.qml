pragma Singleton
import QtQuick
import QtMultimedia

// The window's sounds: Sfx.play("hover") and the rest. Each name is a short .wav in art/sfx; a name with no file, or
// the sound switched off in Options, plays nothing. A few copies of the busy ones (hover, tick) so quick pointing does
// not cut a sound off.
QtObject {
    id: sfx
    property bool on: true
    property real volume: 0.3
    readonly property var names: ["hover", "tick", "on", "off", "press", "page", "charge", "powerup", "powerdown", "open", "done", "error"]
    readonly property var copies: ({ hover: 3, tick: 3 })

    property var pool: ({})
    property var next: ({})
    property Component maker: Component { SoundEffect { volume: sfx.volume } }

    function _ensure(name) {
        if (sfx.pool[name] !== undefined) return sfx.pool[name]
        const list = []
        const n = sfx.copies[name] || 1
        for (let i = 0; i < n; i++) {
            const e = sfx.maker.createObject(sfx, { source: Qt.resolvedUrl("../art/sfx/" + name + ".wav") })
            if (e) list.push(e)
        }
        const p = sfx.pool; p[name] = list; sfx.pool = p
        return list
    }
    function play(name) {
        if (!sfx.on || sfx.volume <= 0 || sfx.names.indexOf(name) < 0) return
        const list = sfx._ensure(name)
        if (!list.length) return
        const i = (sfx.next[name] || 0) % list.length
        sfx.next[name] = i + 1
        const e = list[i]
        if (e.status === SoundEffect.Error) return
        e.stop(); e.play()
    }
    // load them all once the window is up, so the first press is not late
    function warm() { for (const n of sfx.names) sfx._ensure(n) }
}
