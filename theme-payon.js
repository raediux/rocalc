// Payon Dark theme add-on for rocalc.
// Registers theme index 7 through the engine's own theme arrays and wraps
// themes()/LoadTheme() so the engine files (head/foot/etc) stay untouched.
// Must be loaded AFTER foot_*.js and inside <form name="calcForm">'s document.
(function () {
  var T = 7;

  // Glassmorphism needs translucent panel fills; the engine paints these
  // inline from the arrays below, so rgba() here + backdrop-filter in CSS
  // produces the glass look without touching engine code. Browsers without
  // backdrop-filter get the opaque palette (translucency looks muddy unblurred).
  var glassOK =
    window.CSS &&
    CSS.supports &&
    (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));

  // Engine color arrays (defined in head.js). Index 7 = Glass Dark.
  if (glassOK) {
    bBGC[T] = "#0b0e14"; // canvas base under the CSS gradient blobs
    hBGC1[T] = "rgba(48, 66, 80, 0.50)"; // h1/h3/.links gradient top
    hBGC2[T] = "rgba(20, 28, 36, 0.42)"; // h1/h3/.links gradient bottom
    selBGC[T] = "rgba(52, 64, 79, 0.60)"; // <select> background
    ssBGC[T] = "rgba(42, 52, 65, 0.55)"; // .subheader <select> background
    sBGC[T] = "rgba(36, 47, 60, 0.50)"; // .subheader background
    saBGC[T] = "rgba(170, 96, 28, 0.55)"; // .subheader when section is [Active]
    mBGC[T] = "rgba(17, 22, 29, 0.52)"; // .main panel background
    tBGC[T] = "rgba(28, 36, 47, 0.40)"; // .tborder/.tborderA background
  } else {
    bBGC[T] = "#0e1116";
    hBGC1[T] = "#1d3a41";
    hBGC2[T] = "#101d22";
    selBGC[T] = "#2a3340";
    ssBGC[T] = "#232b36";
    sBGC[T] = "#1b2430";
    saBGC[T] = "#8a4d15";
    mBGC[T] = "#151a21";
    tBGC[T] = "#1a212b";
  }

  // Add the option to the theme select(s) if the HTML doesn't have it yet.
  var sels = document.querySelectorAll("select#theme");
  for (var i = 0; i < sels.length; i++) {
    var s = sels[i],
      found = false;
    for (var j = 0; j < s.options.length; j++) if (s.options[j].value == String(T)) found = true;
    if (!found) {
      var o = document.createElement("option");
      o.value = String(T);
      o.text = "Glass Dark";
      s.add(o);
    }
  }

  // Wrap themes(): run the engine version, then add a body class so CSS can
  // react to dark themes, and fix the .main text color for theme 7 (the
  // engine's else-branch would set it to #000).
  var engineThemes = themes;
  themes = function () {
    // Light (index 0) was removed from the select. Any value that no longer
    // maps to an option (selectedIndex -1) -- e.g. an old saved URL carrying a
    // removed theme, or an engine-restored "last used" Light -- is coerced to
    // Glass Dark before the engine paints, so no runtime path can render light.
    if (c.theme.selectedIndex === -1) c.theme.value = String(T);
    engineThemes();
    var v = 1 * c.theme.value;
    var dark = v == 3 || v == 4 || v == 5 || v == 6 || v == T;
    document.body.classList.toggle("t-dark", dark);
    document.body.classList.toggle("t-payon", v == T);
    if (v == T) {
      var mains = document.querySelectorAll(".main");
      for (var k = 0; k < mains.length; k++) mains[k].style.color = "#cfd6dd";
    }
  };

  // Wrap LoadTheme(): first-time visitors (no saved slot) default to Glass
  // Dark, and saved themes that no longer exist in the select (the removed
  // engine themes 1-6) migrate to Glass Dark instead of loading as "".
  var engineLoadTheme = LoadTheme;
  LoadTheme = function () {
    var fresh = typeof Storage !== "undefined" && localStorage["Slot20"] === undefined;
    // Pre-existing engine quirk, unrelated to anything changed here: themes()
    // unconditionally calls A2(0), which paints "#A2TD" (the collapsible
    // "Supportive / Party Skills" panel's header) — but that panel is built
    // lazily by BufSW() the same way Additional Enchants' "#A9TD" is, so on
    // a genuinely fresh page load (before any panel has ever been toggled
    // open) "#A2TD" doesn't exist yet and A2() throws trying to read its
    // .style. This silently aborts the REST of engineLoadTheme() every time,
    // on every fresh load, for every visitor — discovered while diagnosing
    // why code placed after this call wasn't running. Wrapped defensively
    // here rather than patching the engine file for it.
    try {
      engineLoadTheme();
    } catch (e) {}
    if (fresh || c.theme.selectedIndex === -1 || c.theme.value === "") {
      c.theme.value = String(T);
    }
    try {
      themes();
    } catch (e) {}

    // The "RO server" dropdown was removed from the UI (2026-07-06, Project
    // Baldur is a private classic server, so there's nothing to choose) and
    // replaced with a hidden field hardcoded to "10" (Private classic) — but
    // engineLoadTheme() above restores c.server.value from any previously
    // saved slot/URL, which can silently overwrite that hardcoded default
    // with a stale "0" (iRO classic) from before this change. Force it back
    // every load regardless of what got restored, then rebuild whatever
    // server() would have rebuilt (job list, refine dropdowns) so it's
    // consistent with a value the user could have picked. calc() at the end
    // is the same engine recalc SaveTheme()'s own onChange chain used to do.
    if (c.server && c.server.value !== "10") {
      c.server.value = "10";
      if (typeof servers === "function") servers();
      if (typeof StAllCalc === "function") StAllCalc();
      if (typeof calc === "function") calc();
    }

    // Same story for "Equipment slot restrictions" and "Equipment Card slot
    // restrictions" (2026-07-06: Ray asked for these checked by default).
    // The SAME hardcoded top-level block in foot.js that resets c.server
    // also unconditionally sets restrict_equipslot.checked=false and
    // restrict_cardslot.checked=false as part of normal bootstrap — HTML's
    // own `checked` attribute default gets stomped every load, so it has to
    // be re-forced here too, after that block has already run, using each
    // checkbox's own onClick handler so the corresponding restriction logic
    // actually activates (not just LOOKS checked).
    if (c.restrict_equipslot && !c.restrict_equipslot.checked) {
      c.restrict_equipslot.checked = true;
      if (typeof StAllCalc === "function") StAllCalc();
      if (typeof calc === "function") calc();
    }
    if (c.restrict_cardslot && !c.restrict_cardslot.checked) {
      c.restrict_cardslot.checked = true;
      if (typeof restrictCardslot === "function") restrictCardslot(0);
    }

    // Additional Enchants & Manual Edits on Player: Ray asked for this
    // panel to always show, with no collapse/hide option (2026-07-06).
    // Buf9SW(1) builds it (destroys/recreates its own DOM each time,
    // including a toggle row with onclick="Buf9SW(0)" and a "(click to
    // hide)" label — see foot.js/head.js) — force it open every load (its
    // fields only exist in the DOM once built, same check card-enchant-
    // sync.js used to use), then strip the toggle behavior and label so it
    // can't be collapsed again.
    if (typeof Buf9SW === "function" && !c.ARG_RC32) Buf9SW(1);
    var a9td = document.getElementById("A9TD");
    if (a9td) {
      a9td.removeAttribute("onclick");
      a9td.classList.remove("point");
      var hideLabel = a9td.querySelector(".right");
      if (hideLabel) hideLabel.remove();
    }
  };
})();
