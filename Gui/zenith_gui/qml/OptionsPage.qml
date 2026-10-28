import QtQuick

// Options: the kinds on the left, a table of OPTION and STATUS on the right. Anything that takes
// something away asks first (the window shows the question).
Item {
    id: page
    property real reveal: 1
    property string cat: "general"
    property real catIn: 1         // 0..1: the rows' entrance after the kind is changed
    signal ask(string title, string body, string label, string then)
    signal askField(string title, string body, string label, string then, string field, bool secret)
    signal goSupport()
    signal goRoadmap()
    signal saveList()
    signal openList()
    signal chooseGameFolder()
    signal chooseSaveFolder()

    // the test launch being put together (Testing)
    property int testHero: 0
    property int testMode: 0
    property int testStage: 1
    readonly property var testHeroNow: controller.testHeroes.length > 0 ? controller.testHeroes[Math.min(testHero, controller.testHeroes.length - 1)] : null
    readonly property var testModeNow: controller.testModes.length > 0 ? controller.testModes[Math.min(testMode, controller.testModes.length - 1)] : null
    function wrap(i, n) { return n > 0 ? (i % n + n) % n : 0 }
    readonly property var langNames: controller.languages.map(l => l.name)
    readonly property int langAt: Math.max(0, controller.languages.findIndex(l => l.code === controller.settings.language))
    onCatChanged: { catSwap.restart(); if (cat === "health" && controller.health.length === 0 && !controller.healthRunning) { controller.runHealth(); controller.loadStats() } }

    visible: reveal > 0.001
    function ease(t) { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
    NumberAnimation { id: catSwap; target: page; property: "catIn"; from: 0; to: 1; duration: 520 }

    // game copies are listed only when the loader beside the window can make them
    // a mod's own choices, for the mods in the Library that offer any (and a loader that builds with them)
    readonly property var modChoices: {
        const out = []
        for (const m of controller.mods)
            for (const s of m.settings)
                out.push({ name: (m.title + ": " + s.name).toUpperCase(),
                           text: (s.about !== "" ? s.about + " " : "")
                                 + (s.waiting ? qsTr("Changed: it goes in when you apply.") : (m.installed ? qsTr("A change takes effect with your next install.") : qsTr("It goes in when you install ") + m.title + ".")),
                           kind: "choice", key: "mod:" + m.id + ":" + s.id, options: s.options })
        return out
    }
    readonly property var cats: [{ id: "general", label: qsTr("GENERAL") }]
        .concat(modChoices.length > 0 ? [{ id: "modsettings", label: qsTr("MOD SETTINGS") }] : [])
        .concat([{ id: "lists", label: qsTr("LISTS AND PRESETS") }, { id: "saves", label: qsTr("SAVES AND REPORTS") }])
        .concat(controller.copiesAvailable ? [{ id: "copies", label: qsTr("GAME COPIES") }] : [])
        .concat([{ id: "health", label: qsTr("HEALTH AND STATS") }])
        .concat(controller.testAvailable ? [{ id: "testing", label: qsTr("TESTING") }] : [])
        .concat([{ id: "interface", label: qsTr("INTERFACE") }, { id: "looks", label: qsTr("PICTURE AND SOUND") }, { id: "about", label: qsTr("ABOUT") }])
    readonly property int at: Math.max(0, cats.findIndex(c => c.id === cat))
    // where the glass ends; the table's rows stay above it
    readonly property real panelBottom: page.height - 176
    // the kinds share the panel's height when there are many of them
    readonly property real kindStep: Math.min(52, (page.height - 90 - 176 - 64) / Math.max(1, cats.length))
    readonly property var fixLabels: ({ setup: qsTr("READ AGAIN"), steamverify: qsTr("VERIFY IN STEAM"), checkupdates: qsTr("CHECK NOW") })

    function perform(act) {
        if (act === "checkupdates") controller.checkUpdates()
        else if (act === "mods") controller.openModsFolder()
        else if (act === "game") controller.openGameFolder()
        else if (act === "setup") controller.runSetup()
        else if (act === "backup") controller.backupSave()
        else if (act === "backups") controller.openBackups()
        else if (act === "report") controller.makeReport()
        else if (act === "log") controller.openLog()
        else if (act === "notices") controller.openNotices()
        else if (act === "support") page.goSupport()
        else if (act === "savelist") page.saveList()
        else if (act === "openlist") page.openList()
        else if (act === "bringplain")
            page.ask(qsTr("BRING YOUR SAVE INTO THE GAME WITHOUT MODS?"), qsTr("Close the game first. The saves of your Steam game are copied, and mod characters and what they earned are taken out of the copy. Saves the game without mods already has are replaced; they are kept in the Terminal's save_backups folder first. Your Steam game's own saves are not changed."), qsTr("BRING MY SAVE"), "bringplain")
        else if (act === "deleteplain")
            page.ask(qsTr("DELETE THE GAME WITHOUT MODS?"), qsTr("The copy that PLAY WITHOUT MODS starts is removed from this PC. Its saves are kept, and it is made again the next time you ask for it. Your Steam game, its mods and its saves are not touched."), qsTr("DELETE"), "deleteplain")
        else if (act.startsWith("use:")) controller.useCopy(act.slice(4))
        else if (act === "newcopy") controller.makeCopy()
        else if (act === "updatecopy") controller.updateCopy()
        else if (act === "deletecopy")
            page.ask(qsTr("DELETE ") + controller.copyName.toUpperCase() + "?", controller.copyName + qsTr(" and the mods installed in it are removed from this PC. Its saves are kept. Your Steam game, its mods and its saves are not touched."), qsTr("DELETE"), "deletecopy")
        else if (act === "uninstall")
            page.ask(qsTr("UNINSTALL EVERY MOD?"), qsTr("Every mod is taken out of your game, and the mod characters' Evotypes and records are taken out of your save so the normal game can load it. A full copy of your save is made first. Your mods stay in the Library, ready to install again."), qsTr("UNINSTALL"), "uninstall")
        else if (act === "repair")
            page.ask(qsTr("REPAIR YOUR SAVE?"), qsTr("Every mod character's data is taken out of your save: their Evotypes, their records, and a run in progress with one of them. Everything else stays as it is, and a full copy of your save is made first. Use this when the normal game will not load your save."), qsTr("REPAIR"), "repair")
        // 0.5.0
        else if (act === "undo") {
            const l = controller.lastInstall
            page.ask(qsTr("UNDO THE LAST INSTALL?"), qsTr("Your game goes back to what it held before the install of ") + l.when + ": "
                     + (l.empty ? qsTr("no mods") : l.titles.join(", ")) + qsTr(". Your save is backed up first. Mods you added since stay in the Library."), qsTr("UNDO"), "undo")
        }
        else if (act === "steam") controller.said(controller.addToSteam())
        else if (act === "key") page.askField(qsTr("ENTER YOUR PLAYTESTER KEY"), qsTr("The Redux team gives testers a key. With it the Terminal gets the test builds. Keep it to yourself: it is yours."), qsTr("SIGN IN"), "key", qsTr("Paste the key here"), true)
        else if (act === "signout") page.ask(qsTr("SIGN OUT?"), qsTr("The Terminal goes back to the public builds at its next check. The test builds you have stay until then."), qsTr("SIGN OUT"), "signout")
        else if (act === "gamefolder") page.chooseGameFolder()
        else if (act === "savefolder") page.chooseSaveFolder()
        else if (act === "savefolder-reset") controller.setSaveFolder("")
        else if (act === "savepreset") page.askField(qsTr("SAVE AS A PRESET"), qsTr("The mods you have switched on, and their choices, are kept under this name. USE switches back to them in one press."), qsTr("SAVE"), "preset", qsTr("A name, like Grim night"), false)
        else if (act.startsWith("preset:")) controller.said(controller.usePreset(act.slice(7)))
        else if (act.startsWith("delpreset:")) page.ask(qsTr("DELETE THE PRESET ") + act.slice(10).toUpperCase() + "?", qsTr("Only the preset goes. Your mods and what is switched on stay as they are."), qsTr("DELETE"), "delpreset:" + act.slice(10))
        else if (act.startsWith("restore:")) {
            const b = controller.saveBackups.find(x => x.id === act.slice(8))
            page.ask(qsTr("PUT THIS SAVE BACK?"), qsTr("Your save goes back to the copy from ") + (b ? b.when + " (" + b.why + ")" : act.slice(8)) + qsTr(". The save you have now is copied first and shows in the timeline. Close the game first. ")
                     + qsTr("If that copy has a mod character in it, play it with that mod in your game."), qsTr("PUT IT BACK"), "restore:" + act.slice(8))
        }
        else if (act === "health") { controller.runHealth(); controller.loadStats() }
        else if (act.startsWith("fix:")) controller.healthFix(act.slice(4))
        else if (act === "herodown") page.testHero = page.wrap(page.testHero - 1, controller.testHeroes.length)
        else if (act === "heroup") page.testHero = page.wrap(page.testHero + 1, controller.testHeroes.length)
        else if (act === "modedown") { page.testMode = page.wrap(page.testMode - 1, controller.testModes.length); page.testStage = 1 }
        else if (act === "modeup") { page.testMode = page.wrap(page.testMode + 1, controller.testModes.length); page.testStage = 1 }
        else if (act === "stagedown") page.testStage = Math.max(1, page.testStage - 1)
        else if (act === "stageup") page.testStage = Math.min(page.testModeNow ? page.testModeNow.stages : 1, page.testStage + 1)
        else if (act === "starttest" && page.testHeroNow && page.testModeNow) {
            if (page.testModeNow.id === 0) controller.said(controller.launchTest(page.testHeroNow.id, 0, 0))
            else page.ask(qsTr("START A RUN AT STAGE ") + page.testStage + "?", qsTr("The game opens straight into ") + page.testModeNow.name + qsTr(", stage ") + page.testStage + qsTr(", with ") + page.testHeroNow.name + qsTr(". This replaces your saved run."), qsTr("START"), "test:" + page.testHeroNow.id + ":" + page.testModeNow.id + ":" + page.testStage)
        }
        else if (act === "langdown") controller.setSetting("language", controller.languages[page.wrap(page.langAt - 1, controller.languages.length)].code)
        else if (act === "langup") controller.setSetting("language", controller.languages[page.wrap(page.langAt + 1, controller.languages.length)].code)
        else if (act === "roadmap") page.goRoadmap()
    }
    // the second button of a row
    function perform2(act) { page.perform(act) }

    // the rows of the chosen kind; read again whenever what they show changes
    readonly property var rows: {
        if (cat === "general") return (controller.canUpdate ? [
            { name: qsTr("CHECK FOR UPDATES"), text: controller.edition === "dev"
                  ? qsTr("Get the newest Redux test builds now. The Terminal also checks each time it opens.")
                  : qsTr("Get the newest versions of your mods and the Terminal now. It also checks each time it opens."),
              kind: "button", label: qsTr("CHECK NOW"), act: "checkupdates" }] : []).concat(controller.lastInstall.when ? [
            { name: qsTr("UNDO LAST INSTALL"), text: qsTr("Puts back what your game held before the install of ") + controller.lastInstall.when + ": "
                  + (controller.lastInstall.empty ? qsTr("no mods.") : controller.lastInstall.titles.join(", ") + "."),
              kind: "button", label: qsTr("UNDO"), act: "undo" }] : []).concat([
            { name: qsTr("MODS FOLDER"), text: qsTr("Where your mods live. You can also drop a mod's folder or zip on the window."),
              kind: "button", label: qsTr("OPEN"), act: "mods" }]).concat(controller.steamState !== "" ? [
            { name: qsTr("STEAM LIBRARY"), text: controller.steamState === "added"
                  ? qsTr("The Terminal is in your Steam library, so it opens from Steam, Big Picture and a Steam Deck.")
                  : qsTr("Adds the Terminal to your Steam library as a non-Steam game, so it opens from Steam, Big Picture and a Steam Deck. Close Steam first."),
              kind: "button", label: controller.steamState === "added" ? qsTr("ADD AGAIN") : qsTr("ADD TO STEAM"), act: "steam" }] : []).concat(controller.canUpdate ? [
            { name: qsTr("PLAYTESTER KEY"), text: controller.keyState === "built-in" ? qsTr("This is the Dev edition: it gets the Redux test builds with its own key.")
                  : controller.keyState === "signed-in" ? qsTr("Signed in: the Terminal gets the Redux test builds.")
                  : qsTr("A key from the Redux team opens the test builds. Without one, the Terminal gets the public builds."),
              kind: controller.keyState === "built-in" ? "value" : "button", label: controller.keyState === "built-in" ? qsTr("DEV EDITION")
                  : controller.keyState === "signed-in" ? qsTr("SIGN OUT") : qsTr("ENTER KEY"), act: controller.keyState === "signed-in" ? "signout" : "key" }] : []).concat(controller.introAvailable ? [
            { name: qsTr("SECTOR ZENITH INTRO"), text: qsTr("The short film before the title screen when a modded game starts. Esc or a click skips it. A change takes effect with your next install."),
              kind: "choice", key: "intro", options: [{ value: true, label: qsTr("ON") }, { value: false, label: qsTr("OFF") }] }] : []).concat([
            { name: qsTr("GAME"), text: controller.gamePath !== "" ? qsTr("BlazBlue Entropy Effect") + (controller.gameBuild ? qsTr(", build ") + controller.gameBuild + "." : ".")
                                  : qsTr("Not found yet. Press Set up and install and the Terminal looks for it."),
              detail: controller.gamePath,
              kind: "button", label: qsTr("OPEN"), usable: controller.gamePath !== "", act: "game" },
            { name: qsTr("READ THE GAME'S DATA AGAIN"), text: qsTr("Done once, and again after a game update. It takes a few minutes, and the game must be closed."),
              kind: "button", label: qsTr("READ AGAIN"), act: "setup" },
            { name: qsTr("FIND THE GAME BY HAND"), text: qsTr("For Linux with Proton or Bottles, when the Terminal does not find the game: choose the folder BlazblueEntropyEffect.exe is in."),
              kind: "button", label: qsTr("CHOOSE"), act: "gamefolder" },
            { name: qsTr("SAVE FOLDER"), text: controller.saveFolder !== "" ? qsTr("Your saves are read from this folder.")
                  : qsTr("The game's saves are in the usual place. With Proton or Bottles, choose the folder that holds the game's Steam and Global folders."),
              detail: controller.saveFolder,
              kind: "button", label: qsTr("CHOOSE"), act: "savefolder", label2: controller.saveFolder !== "" ? qsTr("USUAL") : "", act2: "savefolder-reset" },
            { name: qsTr("UNINSTALL EVERY MOD"), text: qsTr("Takes every mod out of the game and cleans your save so the normal game loads it. Your save is backed up first, and your mods stay in the Library."),
              kind: "button", label: qsTr("UNINSTALL"), danger: true,
              act: "uninstall" }
        ])
        if (cat === "modsettings") return modChoices
        if (cat === "lists") return [
            { name: qsTr("SAVE MY LIST"), text: qsTr("The mods you have switched on, with their versions and choices, as one small file to send to someone. It holds names only: no mod, no link, nothing that runs."),
              kind: "button", label: qsTr("SAVE"), usable: controller.mods.filter(m => m.enabled && !m.locked).length > 0, act: "savelist" },
            { name: qsTr("USE A LIST"), text: qsTr("Switches on the mods a list names and says which ones you still need. Nothing is downloaded. You can also drop a list on the window."),
              kind: "button", label: qsTr("OPEN"), act: "openlist" },
            { name: qsTr("SAVE AS A PRESET"), text: qsTr("The mods you have switched on and their choices, kept here under a name, to switch back to in one press."),
              kind: "button", label: qsTr("SAVE"), usable: controller.mods.filter(m => m.enabled && !m.locked).length > 0, act: "savepreset" }
        ].concat(controller.presets.map(p => ({
            name: p.name.toUpperCase(), text: p.count + (p.count === 1 ? qsTr(" mod: ") : qsTr(" mods: ")) + p.titles.join(", ") + (p.count > p.titles.length ? qsTr(" and more.") : "."),
            kind: "button", label: qsTr("USE"), act: "preset:" + p.name, label2: qsTr("DELETE"), danger2: true, act2: "delpreset:" + p.name })))
        if (cat === "saves") return [
            { name: qsTr("BACK UP MY SAVE"), text: qsTr("A full copy of your save, kept in the Terminal's save_backups folder. The game must be closed."),
              kind: "button", label: qsTr("BACK UP"), act: "backup" },
            { name: qsTr("SAVE BACKUPS"), text: controller.backups + (controller.backups === 1 ? qsTr(" copy") : qsTr(" copies")) + qsTr(" so far. The Terminal makes one before every install and uninstall."),
              kind: "button", label: qsTr("OPEN"), usable: controller.backups > 0, act: "backups" },
            { name: qsTr("REPAIR MY SAVE"), text: qsTr("For a save the normal game will not load because it still holds a mod character. A backup is made first."),
              kind: "button", label: qsTr("REPAIR"), danger: true,
              act: "repair" },
            { name: qsTr("FEEDBACK REPORT"), text: qsTr("Zips your latest F9 reports and your mod versions into the feedback folder, to send with your notes. Nothing is uploaded."),
              kind: "button", label: qsTr("MAKE REPORT"), act: "report" },
            { name: qsTr("LAST LOG"), text: qsTr("What the loader printed the last time it ran. Useful in a bug report."),
              kind: "button", label: qsTr("OPEN"), act: "log" }
        ].concat(controller.saveBackups.length > 0 ? [
            { name: qsTr("SAVE TIMELINE"), text: qsTr("Every copy of your save, newest first. RESTORE puts one back; the save you have then is copied first."),
              kind: "value", label: controller.saveBackups.length + (controller.saveBackups.length === 1 ? qsTr(" COPY") : qsTr(" COPIES")) }] : [])
         .concat(controller.saveBackups.slice(0, 20).map(b => ({
            name: b.when, text: qsTr("A copy ") + b.why + ".", kind: "button", label: qsTr("RESTORE"), act: "restore:" + b.id })))
        if (cat === "health") return [
            { name: qsTr("HEALTH CHECK"), text: qsTr("Looks at the game's files, the space on your disks, what your mods need, each mod's files against what was downloaded, and your save."),
              kind: "button", label: controller.healthRunning ? qsTr("CHECKING") : qsTr("CHECK AGAIN"), usable: !controller.healthRunning, act: "health" }
        ].concat(controller.health.map(h => ({
            name: qsTr(h.name), text: h.text, mark: h.state, kind: h.fix ? "button" : "value",
            label: h.fix ? (page.fixLabels[h.fix] || qsTr("FIX")) : (h.state === "ok" ? qsTr("OK") : ""), act: "fix:" + h.fix })))
         .concat(controller.stats.sessions !== undefined ? [
            { name: qsTr("PLAY TIME WITH MODS"), text: controller.stats.sessions > 0
                  ? controller.stats.sessions + (controller.stats.sessions === 1 ? qsTr(" game") : qsTr(" games")) + qsTr(" in the mods' logs on this PC, the last on ") + controller.stats.last + "."
                  : qsTr("No games in the mods' logs on this PC yet."),
              kind: "value", label: controller.stats.hours + qsTr(" H") },
            { name: qsTr("BATTLES AND RUNS"), text: qsTr("Battles and runs the mods saw start."),
              kind: "value", label: controller.stats.battles + "  /  " + controller.stats.runs }] : [])
        if (cat === "testing") return [
            { name: qsTr("CHARACTER"), text: qsTr("Who the game starts with: ") + (page.testHeroNow ? page.testHeroNow.name.toUpperCase() : "") + ".",
              kind: "button", label: qsTr("NEXT"), act: "heroup", label2: qsTr("BACK"), act2: "herodown" },
            { name: qsTr("WHERE"), text: page.testModeNow ? (page.testModeNow.id === 0 ? qsTr("TEST ROOM: the flat room with the dev menu. Your saved run is kept.")
                  : page.testModeNow.name + qsTr(": a run that starts at the stage below.") ) : "",
              kind: "button", label: qsTr("NEXT"), act: "modeup", label2: qsTr("BACK"), act2: "modedown" }
        ].concat(page.testModeNow && page.testModeNow.stages > 0 ? [
            { name: qsTr("STAGE"), text: qsTr("Stage ") + page.testStage + qsTr(" of ") + page.testModeNow.stages + ".",
              kind: "button", label: qsTr("NEXT"), act: "stageup", label2: qsTr("BACK"), act2: "stagedown" }] : []).concat([
            { name: qsTr("START"), text: qsTr("With the game closed: it opens straight into this. Pick your save slot when the game asks.")
                  + (controller.testRunsAvailable ? "" : qsTr(" Runs come with the next test room update; the room works now.")),
              kind: "button", label: qsTr("START TEST"), act: "starttest" }])
        if (cat === "copies") {
            const steam = controller.gameCopy === ""
            const out = [{ name: qsTr("STEAM GAME"), text: qsTr("The game as Steam installed it, with your normal saves."),
                           kind: steam ? "value" : "button", label: steam ? qsTr("IN USE") : qsTr("USE"), act: "use:" }]
            // a copy in use that a game update left behind is updated from its own row
            for (const c of controller.copies)
                out.push({ name: c.name.toUpperCase(),
                           text: c.behind ? (c.inUse ? qsTr("In use. Behind the game's update: update it before you install.")
                                                     : qsTr("Its own mods and its own saves. Behind the game's update."))
                                          : qsTr("Its own mods and its own saves. Game build ") + c.build + ".",
                           kind: c.inUse && !c.behind ? "value" : "button",
                           label: !c.inUse ? qsTr("USE") : (c.behind ? qsTr("UPDATE") : qsTr("IN USE")),
                           act: c.inUse ? "updatecopy" : "use:" + c.id })
            const full = controller.copies.length >= controller.mostCopies
            out.push({ name: qsTr("MAKE A COPY"),
                       text: full ? qsTr("This is the most copies for now. Delete one to make another.")
                                  : qsTr("A second game for a different set of mods, with its own saves. It starts as a new player and takes about 200 MB when the Terminal is on the game's disk."),
                       kind: "button", label: qsTr("MAKE A COPY"), usable: controller.gamePath !== "" && !full, act: "newcopy" })
            if (!steam)
                out.push({ name: qsTr("DELETE ") + controller.copyName.toUpperCase(), text: qsTr("Removes this copy and its mods. Its saves are kept."),
                           kind: "button", label: qsTr("DELETE"), danger: true, act: "deletecopy" })
            if (controller.plainMade && controller.plainSavesAvailable)
                out.push({ name: qsTr("YOUR SAVE IN THE GAME WITHOUT MODS"), text: qsTr("Copies the saves of your Steam game into the game without mods and takes mod characters out of the copy. Your Steam game's saves are only read."),
                           kind: "button", label: qsTr("BRING MY SAVE"), act: "bringplain" })
            if (controller.plainMade)
                out.push({ name: qsTr("GAME WITHOUT MODS"), text: qsTr("The copy that PLAY WITHOUT MODS starts. It never takes mods and has its own saves. Game build ") + controller.plainBuild + ".",
                           kind: "button", label: qsTr("DELETE"), danger: true, act: "deleteplain" })
            return out
        }
        if (cat === "looks") return [
            { name: qsTr("MOTION"), text: qsTr("Full: the backdrop and the pictures move. Calm: they hold still."),
              kind: "choice", key: "motion", options: [{ value: "full", label: qsTr("FULL") }, { value: "calm", label: qsTr("CALM") }] },
            { name: qsTr("GRAPHICS"), text: qsTr("Full: glow, lightning, data rain and particles. Light: less for a slower computer to draw. Off: no effects, drawn without the graphics card, for a window that stays black or flickers; Off takes effect the next time the Terminal opens."),
              kind: "choice", key: "graphics", options: [{ value: "full", label: qsTr("FULL") }, { value: "light", label: qsTr("LIGHT") }, { value: "off", label: qsTr("OFF") }] },
            { name: qsTr("SOUND"), text: qsTr("The sounds the Terminal makes when you point at and press things."),
              kind: "choice", key: "sound", options: [{ value: "on", label: qsTr("ON") }, { value: "off", label: qsTr("OFF") }] },
            { name: qsTr("VOLUME"), text: qsTr("How loud those sounds are."),
              kind: "choice", key: "volume", options: [5, 15, 30, 70, 100].map(v => ({ value: v, label: v + "%" })) },
            { name: qsTr("SIDE BAR HOLO EFFECT"), text: qsTr("On: the words and signs in the column of pages on the left carry the window's holographic colour fringe. Off: they are drawn clean."),
              kind: "choice", key: "railHolo", options: [{ value: "on", label: qsTr("ON") }, { value: "off", label: qsTr("OFF") }] },
            { name: qsTr("DISABLE HOLO EFFECTS"), text: qsTr("On: no holographic colour fringe on any words or signs in the window, the side bar's included. Off: they carry it."),
              kind: "choice", key: "noHolo", options: [{ value: "off", label: qsTr("OFF") }, { value: "on", label: qsTr("ON") }] }
        ]
        if (cat === "interface") return [
            { name: qsTr("OPEN ON"), text: qsTr("The page the Terminal shows first."),
              kind: "choice", key: "startPage", options: [{ value: "home", label: qsTr("HOME") }, { value: "library", label: qsTr("LIBRARY") }] },
            { name: qsTr("CORE FILES"), text: qsTr("Show the shared files the other mods run on in the Library. They go into the game by themselves."),
              kind: "choice", key: "showCore", options: [{ value: false, label: qsTr("HIDE") }, { value: true, label: qsTr("SHOW") }] },
            { name: qsTr("UPDATES"), text: qsTr("When the Terminal opens with newer versions of your installed mods, put them in the game at once. Off: APPLY CHANGES waits for you."),
              kind: "choice", key: "applyUpdates", options: [{ value: true, label: qsTr("AT ONCE") }, { value: false, label: qsTr("ASK ME") }] }
        ].concat(controller.canUpdate ? [
            { name: qsTr("UPDATE CHECKS"), text: qsTr("While the Terminal is open it asks for updates this often, and says so when one is ready."),
              kind: "choice", key: "checkEvery", options: [{ value: 15, label: qsTr("15 MIN") }, { value: 60, label: qsTr("HOURLY") }, { value: 0, label: qsTr("OFF") }] },
            { name: qsTr("WHILE YOU PLAY"), text: qsTr("No update check or download while the game is open."),
              kind: "choice", key: "quietWhilePlaying", options: [{ value: true, label: qsTr("WAIT") }, { value: false, label: qsTr("CHECK") }] }] : []).concat([
            { name: qsTr("TRAY"), text: qsTr("Closing the window keeps the Terminal beside the clock, where it says when an update is ready. Off: closing quits."),
              kind: "choice", key: "tray", options: [{ value: "on", label: qsTr("KEEP") }, { value: "off", label: qsTr("QUIT") }] },
            { name: qsTr("LANGUAGE"), text: qsTr("The Terminal's words: ") + (page.langNames[page.langAt] || qsTr("English")) + qsTr(". Translations are machine-drafted and are being checked by players who speak them."),
              kind: "button", label: qsTr("NEXT"), act: "langup", label2: qsTr("BACK"), act2: "langdown" }])
        return [
            { name: qsTr("THE ZENITH TERMINAL"), text: qsTr("A mod loader for BlazBlue Entropy Effect. Unofficial: not made or endorsed by 91Act or Arc System Works."),
              kind: "value", label: "V" + controller.version + (controller.edition === "dev" ? qsTr("  DEV EDITION") : qsTr("  ALPHA")) },
            { name: qsTr("THE PEOPLE"), text: qsTr("Redux, its characters and this window: Soulve. The mod loader: KittySkin."),
              kind: "button", label: qsTr("SUPPORT"), act: "support" },
            { name: qsTr("ROADMAP"), text: qsTr("What is being made for Redux, and what comes next."),
              kind: "button", label: qsTr("ROADMAP"), act: "roadmap" },
            { name: qsTr("OPEN-SOURCE PARTS"), text: qsTr("Qt for Python and FFmpeg (LGPL), and the typefaces Aldrich, Chakra Petch and Share Tech Mono (SIL Open Font License)."),
              kind: "button", label: qsTr("NOTICES"), act: "notices" }
        ]
    }

    // ---- the glass behind the kinds and the table -------------------------------------------------------------
    GlassPanel { x: 108; y: 90; width: 282; height: page.panelBottom - 90; reveal: page.ease(page.reveal * 2.0) }
    GlassPanel { x: 404; y: 90; width: Math.min(900, page.width - 420 - 40) + 32; height: page.panelBottom - 90; reveal: page.ease(page.reveal * 2.0 - 0.3) }

    // ---- the kinds --------------------------------------------------------------------------------------------
    Item {
        objectName: "optionsKinds"
        x: 124; y: 104
        width: 250

        Text {
            text: qsTr("OPTIONS")
            font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.6
            color: Theme.dim
            opacity: page.ease(page.reveal * 3)
        }
        Rule { y: 24; width: parent.width; grow: page.ease(page.reveal * 2.2) }
        Repeater {
            model: page.cats
            delegate: Item {
                id: kind
                required property int index
                required property var modelData
                readonly property bool chosen: index === page.at
                readonly property real shows: page.ease(page.reveal * 2.4 - 0.3 - index * 0.2)
                y: 44 + index * page.kindStep
                width: 250; height: page.kindStep - 4
                opacity: shows
                transform: Translate { x: (1 - kind.shows) * -18 }
                readonly property bool tabStop: true
                activeFocusOnTab: true
                Keys.onReturnPressed: page.cat = kind.modelData.id
                Keys.onEnterPressed: page.cat = kind.modelData.id
                Keys.onSpacePressed: page.cat = kind.modelData.id
                FocusMark { inset: 0 }
                Rectangle {
                    anchors.fill: parent; anchors.topMargin: 1; anchors.bottomMargin: 1
                    color: "#ffffff"
                    opacity: kind.chosen ? 0.085 : (over.hovered ? 0.045 : 0.02)
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Rectangle {
                    width: 2; height: 20
                    anchors.verticalCenter: parent.verticalCenter
                    x: kind.chosen ? 7 : -3
                    opacity: kind.chosen ? 1 : 0
                    color: Theme.text
                    Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Rectangle {
                    width: 2; height: 20
                    anchors.verticalCenter: parent.verticalCenter
                    x: parent.width - width - (kind.chosen ? 7 : -3)
                    opacity: kind.chosen ? 1 : 0
                    color: Theme.text
                    Behavior on x { NumberAnimation { duration: Theme.base; easing.type: Easing.OutCubic } }
                    Behavior on opacity { NumberAnimation { duration: Theme.fast } }
                }
                Text {
                    x: 24
                    anchors.verticalCenter: parent.verticalCenter
                    text: kind.modelData.label
                    width: parent.width - 40
                    fontSizeMode: Text.HorizontalFit; minimumPixelSize: 11     // a longer name in another language shrinks to fit
                    font.family: Theme.display; font.pixelSize: 13; font.letterSpacing: 1.6
                    color: kind.chosen ? Theme.text : Theme.dim
                    Behavior on color { ColorAnimation { duration: Theme.base } }
                }
                HoverHandler { id: over; cursorShape: Qt.PointingHandCursor }
                TapHandler { onTapped: page.cat = kind.modelData.id }
            }
        }
    }

    // ---- the table --------------------------------------------------------------------------------------------
    // it grows with the window, but a line of words never runs past 900 units
    Item {
        objectName: "optionsTable"
        x: 420; y: 104
        width: Math.min(900, page.width - x - 40)

        Text {
            x: 14
            text: qsTr("OPTION")
            font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.6
            color: Theme.dim
            opacity: page.ease(page.reveal * 3)
        }
        Text {
            anchors.right: parent.right; anchors.rightMargin: 14
            text: qsTr("STATUS")
            font.family: Theme.display; font.pixelSize: 12; font.letterSpacing: 2.6
            color: Theme.dim
            opacity: page.ease(page.reveal * 3)
        }
        Rule { y: 24; width: parent.width; grow: page.ease(page.reveal * 2.2) }
        Flickable {
            id: tableView
            objectName: "optionsRows"
            y: 34
            width: parent.width
            height: page.panelBottom - 14 - 104 - 34     // 14 from the glass's edge, as at its top
            contentHeight: tableRows.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
        Column {
            id: tableRows
            width: parent.width
            Repeater {
                model: page.rows
                delegate: OptionRow {
                    required property int index
                    required property var modelData
                    width: parent.width
                    name: modelData.name
                    text: modelData.text
                    detail: modelData.detail || ""
                    kind: modelData.kind
                    label: modelData.label || ""
                    danger: modelData.danger === true
                    usable: modelData.usable !== false
                    options: modelData.options || []
                    value: modelData.key ? controller.settings[modelData.key] : undefined
                    reveal: page.ease(Math.min(page.reveal, page.catIn) * 2.6 - 0.4 - index * 0.22)
                    onActivated: page.perform(modelData.act)
                    onActivated2: page.perform2(modelData.act2 || "")
                    label2: modelData.label2 || ""
                    danger2: modelData.danger2 === true
                    mark: modelData.mark || ""
                    onPicked: (value) => controller.setSetting(modelData.key, value)
                }
            }
        }
        }
        Rectangle {
            visible: tableView.visibleArea.heightRatio < 0.999
            x: parent.width + 6
            y: 34 + tableView.visibleArea.yPosition * tableView.height
            width: 2
            height: Math.max(18, tableView.visibleArea.heightRatio * tableView.height)
            color: Theme.line
            opacity: 0.4 * page.ease(page.reveal * 2.2 - 0.5)
        }
    }
}
