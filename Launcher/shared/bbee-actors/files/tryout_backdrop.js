/* bbee-actors: a mod character's own test-room backdrop. The room shows the child of the stage's "Hero" element
   named by actor id; a mod character has none in the stage file, so one is made from an official hero's (same
   quad, same two lights) with the mod's own movie. A character registers with one line:
     globalThis.BB_TRYOUT_BACKDROP[201001] = { movie: "SwiftMaster/swm4000", from: 101101, light: [0.8, 0.9, 1.0] };
   movie = its name in the mod's content.movies; from = the official hero whose backdrop is copied (default
   Hakumen, 101101); light = red, green, blue of the rim light on the hero (default: the copied hero's own).
   Any failure leaves the room as the game would have shown it. docs\tools\TRYOUT_BACKDROP.md */
globalThis.BB_TRYOUT_BACKDROP = globalThis.BB_TRYOUT_BACKDROP || {};
globalThis.BB_TRYOUT_BACKDROP_MAKE = function (hero, baseId) {
  try {
    var want = globalThis.BB_TRYOUT_BACKDROP[baseId];
    if (!want || !want.movie) return null;
    var cs = require("csharp"), UE = cs.UnityEngine;
    var movies = UE.Object.FindObjectOfType(puer.$typeof(cs.NOAH.Criware.CriwareMovieManager));
    if (!movies || !movies.IsMovieExist(want.movie)) return null;
    var from = hero.transform.Find(String(want.from || 101101));
    if (!from) return null;
    var made = UE.Object.Instantiate(from.gameObject, hero.transform);
    made.name = String(baseId);
    var play = made.GetComponentInChildren(puer.$typeof(cs.NOAH.Criware.CriwareMovieAssistScene), true);
    if (!play) { UE.Object.Destroy(made); return null; }
    var one = play.List.get_Item(0);
    one.Movie = want.movie;
    one.Duration = movies.GetMovieDuration(want.movie, true);
    one.Size = movies.GetMovieSize(want.movie, true);
    if (want.light) {
      var l = want.light, lights = made.GetComponentsInChildren(puer.$typeof(cs.ACELight), true);
      for (var i = 0; i < lights.Length; i++) {
        var info = lights.get_Item(i).Light, top = lights.get_Item(i).gameObject.name === "Lr_RoleTopLight";
        /* the two strengths are Hakumen's own, measured on his lights */
        info.HighlightColor = top ? new UE.Color(l[0] * 10, l[1] * 10, l[2] * 10, 0.34) : new UE.Color(l[0] * 5.8, l[1] * 5.8, l[2] * 5.8, 1);
        info.BrightColor = top ? new UE.Color(l[0] * 0.6, l[1] * 0.6, l[2] * 0.6, 0.29) : new UE.Color(l[0] * 1.9, l[1] * 1.9, l[2] * 1.9, 1);
      }
    }
    console.log("ACTORS backdrop: made for " + baseId);
    return made.transform;
  } catch (e) {
    try { console.log("ACTORS backdrop: " + e); } catch (x) {}
    return null;
  }
};
