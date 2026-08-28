// Bestiary panel for rocalc.
// Adds an "Open Bestiary" button next to the Enemy select and slides a
// sortable/filterable monster table in from the right over the calc.
// Engine files stay untouched: the table is built at runtime from the live
// m_Monster array (so it can never drift from monster_*.js), and picking a
// row drives the calc through its own EnemySort()/Bskill()/calc() entry
// points -- the same path the Enemy dropdown uses. Same layered add-on
// pattern as card-enchant-sync.js and url-save-silent.js.
// Must be loaded AFTER monster_*.js and foot_*.js.
(function () {
  "use strict";

  if (typeof m_Monster === "undefined" || !document.calcForm || !document.calcForm.B_Enemy) return;

  var c = document.calcForm;

  // Rows hidden from the table. enemy-list-filter.js owns the rules and hides
  // the same monsters from the Enemy dropdown, so reading its id set here keeps
  // the two lists identical -- every row in this table is selectable, and the
  // dropdown offers nothing the table is missing. The literals are the fallback
  // for that file failing to load, and must stay in step with its rules.
  var HIDDEN = window.RO_HIDDEN_MONSTERS;
  var EXCLUDE_IDS = { 17: 1, 548: 1 };
  var EXCLUDE_NAME = /\((aRO|Custom|Renewal)\)/;
  function isHidden(row) {
    if (HIDDEN) return !!HIDDEN[row[0]];
    return !!EXCLUDE_IDS[row[0]] || EXCLUDE_NAME.test(row[1]);
  }

  // Field positions in an m_Monster row, per the layout comment at the end of
  // monster_*.js. Monster STR is not stored.
  var F = { NAME: 1, RACE: 2, ELEM: 3, SIZE: 4, LV: 5, HP: 6, VIT: 7, DEF: 14, MDEF: 15, BX: 16, JX: 17, FLAG: 19 };

  var DATA = [];
  for (var i = 0; i < m_Monster.length; i++) {
    var r = m_Monster[i];
    if (!r || isHidden(r)) continue;
    DATA.push({
      id: r[0],
      name: r[F.NAME],
      lv: r[F.LV],
      hp: r[F.HP],
      def: r[F.DEF],
      mdef: r[F.MDEF],
      vit: r[F.VIT],
      bx: r[F.BX] || 0,
      jx: r[F.JX] || 0,
      race: v_Race_[r[F.RACE]] || String(r[F.RACE]),
      // Element is stored as type*10 + level; the level is dropped here so
      // Fire 1 through Fire 4 collapse to one filterable value.
      elem: (v_Element_[Math.floor(r[F.ELEM] / 10)] || "?").replace(/\s+$/, ""),
      size: v_Size[r[F.SIZE]] || "?",
      f: r[F.FLAG] || 0
    });
  }
  DATA.sort(function (a, b) { return b.hp - a.hp; });

  var CSS =
    // The stage spans only the area the panel is allowed to cover -- it starts
    // to the right of the fixed results sidebar, so the damage numbers stay
    // visible and clickable. overflow:hidden clips the slide-in so the panel
    // never bleeds over the sidebar on its way in.
    '#bst-stage{position:fixed;top:0;bottom:0;right:0;left:0;overflow:hidden;pointer-events:none;z-index:9999}' +
    // The stage never takes pointer events itself, so whatever the panel does
    // not cover -- the sidebar on its left, the rest of the character column
    // on its right -- stays clickable.
    '#bst-panel{position:absolute;top:0;bottom:0;left:0;width:min(1032px,100%);display:flex;' +
      'pointer-events:auto;' +
      'flex-direction:column;transform:translateX(-100%);transition:transform .3s cubic-bezier(.22,.61,.36,1);' +
      'background:rgba(17,22,29,.94);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
      'border-right:1px solid #2b3542;box-shadow:6px 0 28px rgba(0,0,0,.55);color:#cfd6dd;' +
      'font-family:var(--font-ui,"Inter",Segoe UI,Tahoma,Arial,sans-serif);font-size:12px}' +
    '#bst-panel.open{transform:none}' +
    '@media (prefers-reduced-motion:reduce){#bst-panel{transition:none}}' +
    '#bst-head{display:flex;align-items:baseline;gap:10px;padding:14px 16px 12px;border-bottom:1px solid #2b3542;flex:0 0 auto}' +
    '#bst-head h2{margin:0;font-size:14px;font-weight:700;color:#e8842c;letter-spacing:.01em}' +
    '#bst-head .sub{color:#8b96a4;font-size:11px}' +
    '#bst-head #bst-cur{color:#e8842c}' +
    '#bst-close{margin-left:auto;background:#27303c;color:#dbe2ea;border:1px solid #3a4656;border-radius:6px;' +
      'padding:4px 11px;cursor:pointer;font:inherit;font-size:11.5px;line-height:1.2}' +
    '#bst-close:hover{background:#303a48;border-color:#e8842c}' +
    '#bst-ctl{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-bottom:1px solid #2b3542;flex:0 0 auto}' +
    '#bst-ctl .line{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '#bst-q{flex:1 1 220px;min-width:160px}' +
    '#bst-panel input,#bst-panel select{font:inherit;font-size:12px;line-height:16px;color:#dbe2ea;' +
      'background:#232b36;border:1px solid #3a4656;border-radius:6px;padding:5px 9px}' +
    '#bst-panel select{background:#2a3340}' +
    '#bst-panel input:focus-visible,#bst-panel select:focus-visible,#bst-panel button:focus-visible,' +
      '#bst-panel tbody tr:focus-visible{outline:2px solid #e8842c;outline-offset:1px}' +
    '.bst-range{display:flex;align-items:center;gap:6px;background:#1b2430;border:1px solid #2b3542;' +
      'border-radius:6px;padding:3px 10px}' +
    '.bst-range > span{font-size:10.5px;font-weight:700;letter-spacing:.08em;color:#cfd6dd}' +
    // Prefixed with #bst-panel so it outranks the panel-wide '#bst-panel input'
    // rule above; without the id these flat fields lose padding/border to it
    // and render as boxes inside boxes.
    '#bst-panel .bst-range input{width:56px;text-align:right;padding:2px 3px;border:0;' +
      'border-bottom:1px solid #3a4656;border-radius:0;background:transparent;font-size:12px}' +
    '.bst-range input::-webkit-outer-spin-button,.bst-range input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}' +
    '.bst-range input[type=number]{-moz-appearance:textfield;appearance:textfield}' +
    '.bst-range em{color:#6f7b8a;font-style:normal}' +
    '.bst-chip{background:#27303c;color:#aab4c0;border:1px solid #3a4656;border-radius:6px;padding:6px 11px;' +
      'cursor:pointer;font:inherit;font-size:11.5px;line-height:14px}' +
    '.bst-chip:hover{border-color:#e8842c;color:#dbe2ea}' +
    '.bst-chip[aria-pressed="true"]{background:rgba(170,96,28,.45);border-color:#e8842c;color:#ffc98a;font-weight:600}' +
    '#bst-count{margin-left:auto;color:#8b96a4;font-size:11px;white-space:nowrap}' +
    '#bst-scroll{flex:1 1 auto;overflow:auto}' +
    // Fixed layout holds every column at its set width; the min-width is the
    // sum of those widths, so a narrow panel scrolls the table sideways rather
    // than squeezing columns.
    '#bst-table{width:100%;min-width:1016px;table-layout:fixed;border-collapse:collapse;border-spacing:0}' +
    '#bst-table th{position:sticky;top:0;z-index:1;background:#232b36;color:#aab4c0;text-align:left;' +
      'font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;font-weight:600;padding:9px 10px;' +
      'border-bottom:1px solid #3a4656;cursor:pointer;white-space:nowrap;user-select:none}' +
    '#bst-table th.n{text-align:right}' +
    '#bst-table th .ar{color:#e8842c;font-size:9px;margin-left:3px;visibility:hidden}' +
    '#bst-table th[aria-sort] .ar{visibility:visible}' +
    '#bst-table td{padding:7px 10px;border-bottom:1px solid rgba(58,70,86,.4);white-space:nowrap;overflow:hidden}' +
    '#bst-table td.n{text-align:right;font-variant-numeric:tabular-nums}' +
    '#bst-table td.nm{font-weight:600;color:#e6ebf1;overflow:hidden;text-overflow:ellipsis}' +
    '#bst-table td.dim{color:#8b96a4}' +
    '#bst-table td.zero{color:#5d6875}' +
    '#bst-table tbody tr{cursor:pointer}' +
    '#bst-table tbody tr:nth-child(even){background:rgba(255,255,255,.022)}' +
    '#bst-table tbody tr:hover{background:rgba(52,64,79,.55)}' +
    '#bst-table tbody tr.cur{background:rgba(170,96,28,.25)}' +
    '.bst-tag{display:inline-block;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;' +
      'letter-spacing:.06em;margin-left:5px}' +
    '.bst-tag.boss{background:rgba(190,70,90,.28);color:#ff9fb0}' +
    '.bst-tag.one{background:rgba(90,150,90,.22);color:#a6d6a6}' +
    '.bst-tag.emp{background:rgba(170,96,28,.3);color:#ffc98a}' +
    '#bst-empty{padding:34px;text-align:center;color:#8b96a4}' +
    // The one control that opens a whole other view, sitting in a row of plain
    // dark buttons -- filled with the calc's accent so it reads as the primary
    // action there. themes() only repaints selects and panels, never inputs, so
    // this is not overwritten on theme load.
    '#bst-open{margin-left:12px;background:#e8842c;color:#17202b;border:1px solid #f2983f;' +
      'border-radius:6px;padding:5px 15px;font-weight:700;font-size:12px;letter-spacing:.02em;' +
      'cursor:pointer;box-shadow:0 1px 7px rgba(232,132,44,.4)}' +
    '#bst-open:hover{background:#f5983c;border-color:#ffb055;box-shadow:0 2px 11px rgba(232,132,44,.6)}' +
    '#bst-open:active{box-shadow:0 1px 4px rgba(232,132,44,.4);transform:translateY(1px)}' +
    '#bst-open:focus-visible{outline:2px solid #ffc98a;outline-offset:2px}';

  var style = document.createElement("style");
  style.id = "bst-css";
  style.appendChild(document.createTextNode(CSS));
  document.head.appendChild(style);

  // --- panel -----------------------------------------------------------
  var stage = document.createElement("div");
  stage.id = "bst-stage";

  var panel = document.createElement("div");
  panel.id = "bst-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Bestiary");
  panel.setAttribute("aria-hidden", "true");

  function rangeHTML(key, label) {
    return '<label class="bst-range"><span>' + label + '</span>' +
      '<input type="number" inputmode="numeric" id="bst-' + key + 'min" placeholder="min" aria-label="Minimum ' + label + '">' +
      '<em>&ndash;</em>' +
      '<input type="number" inputmode="numeric" id="bst-' + key + 'max" placeholder="max" aria-label="Maximum ' + label + '"></label>';
  }

  // [key, header, alignment class, column width]. Every column is sized to its
  // widest realistic value -- 252px fits the longest name plus its badge
  // ("Incarnation of Morroc [Human]" + BOSS), 104px fits 95,000,000 and
  // "Demi-Human". The columns total 1016px, which is what the panel width is
  // built around, so nothing is stretched to fill and nothing is squeezed.
  var COLS = [
    ["name", "Monster", "", "252px"], ["hp", "HP", "n", "104px"],
    ["def", "DEF", "n", "62px"], ["mdef", "MDEF", "n", "68px"], ["vit", "VIT", "n", "62px"],
    ["bx", "Base exp", "n", "104px"], ["jx", "Job exp", "n", "104px"],
    ["race", "Race", "", "104px"], ["elem", "Element", "", "84px"], ["size", "Size", "", "72px"]
  ];

  panel.innerHTML =
    '<div id="bst-head"><h2>Bestiary</h2>' +
      '<span class="sub">click a row to load it as the enemy</span>' +
      '<span class="sub" id="bst-cur"></span>' +
      '<button type="button" id="bst-close">Close</button></div>' +
    '<div id="bst-ctl">' +
      '<div class="line">' +
        '<input type="search" id="bst-q" placeholder="Filter by name, race, element, or size&hellip;" aria-label="Filter monsters">' +
        '<select id="bst-race" aria-label="Filter by race"><option value="">All races</option></select>' +
        '<select id="bst-elem" aria-label="Filter by element"><option value="">All elements</option></select>' +
        '<select id="bst-size" aria-label="Filter by size"><option value="">All sizes</option></select>' +
      '</div>' +
      '<div class="line">' +
        rangeHTML("hp", "HP") + rangeHTML("def", "DEF") + rangeHTML("mdef", "MDEF") + rangeHTML("vit", "VIT") +
      '</div>' +
      '<div class="line">' +
        '<button type="button" class="bst-chip" data-f="nonboss" aria-pressed="true">Exclude bosses</button>' +
        '<button type="button" class="bst-chip" data-f="hasexp" aria-pressed="true">Exclude 0 exp</button>' +
        '<button type="button" class="bst-chip" id="bst-reset">Reset all</button>' +
        '<span id="bst-count"></span>' +
      '</div>' +
    '</div>' +
    '<div id="bst-scroll"><table id="bst-table"><colgroup>' +
      COLS.map(function (col) {
        return "<col" + (col[3] ? ' style="width:' + col[3] + '"' : "") + ">";
      }).join("") +
    '</colgroup><thead><tr>' +
      COLS.map(function (col) {
        return '<th data-k="' + col[0] + '" class="' + col[2] + '" tabindex="0" role="button"' +
          (col[0] === "hp" ? ' aria-sort="descending"' : "") + '>' + col[1] +
          '<span class="ar">' + (col[0] === "hp" ? "▼" : "▲") + "</span></th>";
      }).join("") +
    '</tr></thead><tbody id="bst-body"></tbody></table><div id="bst-empty" hidden>No monster matches those filters.</div></div>';

  stage.appendChild(panel);
  document.body.appendChild(stage);

  var $ = function (id) { return document.getElementById(id); };
  var bodyEl = $("bst-body"), emptyEl = $("bst-empty"), countEl = $("bst-count"), scrollEl = $("bst-scroll"),
      q = $("bst-q"), raceSel = $("bst-race"), elemSel = $("bst-elem"), sizeSel = $("bst-size");

  // order: null sorts alphabetically, which is right for race and element.
  // Size gets the engine's own Small/Medium/Large order instead -- alphabetical
  // would read Large, Medium, Small, which is not an order anyone thinks in.
  function fillSelect(sel, key, order) {
    var seen = {}, vals = [];
    for (var k = 0; k < DATA.length; k++) if (!seen[DATA[k][key]]) { seen[DATA[k][key]] = 1; vals.push(DATA[k][key]); }
    if (order) vals.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    else vals.sort();
    for (var v = 0; v < vals.length; v++) sel.appendChild(new Option(vals[v], vals[v]));
  }
  fillSelect(raceSel, "race");
  fillSelect(elemSel, "elem");
  fillSelect(sizeSel, "size", v_Size);

  var RANGES = [["hp", "hp"], ["def", "def"], ["mdef", "mdef"], ["vit", "vit"]];
  var rangeEls = [];
  for (var g = 0; g < RANGES.length; g++) rangeEls.push($("bst-" + RANGES[g][1] + "min"), $("bst-" + RANGES[g][1] + "max"));

  var DEFAULT_FILTERS = ["nonboss", "hasexp"];
  var filters = {};
  DEFAULT_FILTERS.forEach(function (f) { filters[f] = 1; });
  var sortKey = "hp", sortDir = -1;
  var TEXTKEYS = { name: 1, race: 1, elem: 1, size: 1 };

  function num(n) { return n.toLocaleString("en-US"); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]; }); }
  function badge(f) {
    if (f === 1) return ' <span class="bst-tag boss">BOSS</span>';
    if (f === 5) return ' <span class="bst-tag one">1 DMG</span>';
    if (f === 6) return ' <span class="bst-tag emp">EMP</span>';
    return "";
  }
  function bound(id, fallback) {
    var v = $(id).value;
    return v === "" ? fallback : Number(v);
  }

  function render() {
    var term = q.value.trim().toLowerCase();
    var race = raceSel.value, elem = elemSel.value, size = sizeSel.value;
    var lim = RANGES.map(function (r) {
      return [r[0], bound("bst-" + r[1] + "min", -Infinity), bound("bst-" + r[1] + "max", Infinity)];
    });
    var current = 1 * c.B_Enemy.value;

    var rows = DATA.filter(function (m) {
      for (var k = 0; k < lim.length; k++) if (m[lim[k][0]] < lim[k][1] || m[lim[k][0]] > lim[k][2]) return false;
      if (race && m.race !== race) return false;
      if (elem && m.elem !== elem) return false;
      if (size && m.size !== size) return false;
      if (filters.nonboss && m.f === 1) return false;
      if (filters.hasexp && !m.bx && !m.jx) return false;
      if (term && (m.name + " " + m.race + " " + m.elem + " " + m.size).toLowerCase().indexOf(term) === -1) return false;
      return true;
    });

    rows.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      var cmp = typeof x === "string" ? x.localeCompare(y) : x - y;
      return cmp * sortDir || a.name.localeCompare(b.name);
    });

    var keepScroll = scrollEl.scrollTop;
    bodyEl.innerHTML = rows.map(function (m) {
      return '<tr data-id="' + m.id + '" tabindex="0"' + (m.id === current ? ' class="cur"' : "") + ">" +
        '<td class="nm" title="' + esc(m.name) + '">' + esc(m.name) + badge(m.f) + "</td>" +
        '<td class="n">' + num(m.hp) + "</td>" +
        '<td class="n">' + m.def + "</td>" +
        '<td class="n">' + m.mdef + "</td>" +
        '<td class="n">' + m.vit + "</td>" +
        '<td class="n ' + (m.bx ? "dim" : "zero") + '">' + num(m.bx) + "</td>" +
        '<td class="n ' + (m.jx ? "dim" : "zero") + '">' + num(m.jx) + "</td>" +
        '<td class="dim">' + esc(m.race) + "</td>" +
        '<td class="dim">' + esc(m.elem) + "</td>" +
        '<td class="dim">' + esc(m.size) + "</td></tr>";
    }).join("");

    scrollEl.scrollTop = Math.min(keepScroll, scrollEl.scrollHeight);
    emptyEl.hidden = rows.length > 0;
    countEl.textContent = rows.length + " of " + DATA.length + " shown";
  }

  // --- picking an enemy -------------------------------------------------
  // B_Enemy's options are rebuilt by EnemySort() and filtered by the Place
  // dropdown, so a monster outside the current region has no option to select.
  // Resetting Place to All Regions first guarantees the id is present.
  function pick(id) {
    if (c.ENEMY_SORT2 && 1 * c.ENEMY_SORT2.value !== 0) {
      c.ENEMY_SORT2.value = 0;
      if (typeof EnemySort === "function") EnemySort();
    }
    c.B_Enemy.value = id;
    if (typeof Bskill === "function") Bskill();
    if (typeof calc === "function") calc();
    // The panel stays open so several monsters can be compared in a row -- the
    // results column is visible beside it and updates on every pick. Move the
    // highlight by hand rather than re-rendering, which would reset the scroll
    // position out from under the row just clicked.
    markCurrent();
  }

  // Reflects the calc's loaded enemy in the row highlight and the header.
  function markCurrent() {
    var id = 1 * c.B_Enemy.value;
    var prev = bodyEl.querySelector("tr.cur");
    if (prev) prev.classList.remove("cur");
    var next = bodyEl.querySelector('tr[data-id="' + id + '"]');
    if (next) next.classList.add("cur");
    var row = m_Monster[id];
    $("bst-cur").textContent = row ? "· currently loaded: " + row[F.NAME] : "";
  }

  bodyEl.addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (tr) pick(1 * tr.getAttribute("data-id"));
  });
  bodyEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var tr = e.target.closest("tr[data-id]");
    if (tr) { e.preventDefault(); pick(1 * tr.getAttribute("data-id")); }
  });

  // --- sorting ----------------------------------------------------------
  var ths = panel.querySelectorAll("#bst-table th");
  Array.prototype.forEach.call(ths, function (th) {
    function go() {
      var k = th.getAttribute("data-k");
      if (k === sortKey) sortDir *= -1;
      else { sortKey = k; sortDir = TEXTKEYS[k] ? 1 : -1; }
      Array.prototype.forEach.call(ths, function (o) {
        o.removeAttribute("aria-sort");
        o.querySelector(".ar").textContent = "▲";
      });
      th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
      th.querySelector(".ar").textContent = sortDir === 1 ? "▲" : "▼";
      render();
    }
    th.addEventListener("click", go);
    th.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  });

  // --- filter controls --------------------------------------------------
  Array.prototype.forEach.call(panel.querySelectorAll(".bst-chip[data-f]"), function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.getAttribute("data-f");
      if (filters[f]) { delete filters[f]; btn.setAttribute("aria-pressed", "false"); }
      else { filters[f] = 1; btn.setAttribute("aria-pressed", "true"); }
      render();
    });
  });

  $("bst-reset").addEventListener("click", function () {
    q.value = "";
    raceSel.value = "";
    elemSel.value = "";
    sizeSel.value = "";
    rangeEls.forEach(function (el) { el.value = ""; });
    filters = {};
    DEFAULT_FILTERS.forEach(function (f) { filters[f] = 1; });
    Array.prototype.forEach.call(panel.querySelectorAll(".bst-chip[data-f]"), function (b) {
      b.setAttribute("aria-pressed", filters[b.getAttribute("data-f")] ? "true" : "false");
    });
    render();
  });

  [q, raceSel, elemSel, sizeSel].concat(rangeEls).forEach(function (el) {
    el.addEventListener("input", render);
  });

  // --- open / close -----------------------------------------------------
  var lastFocus = null;

  // The panel covers everything to the right of the fixed results sidebar.
  // Measuring #fixable rather than hardcoding --sidebar-reserve keeps this
  // correct when the sidebar is not fixed (narrow or very tall viewports),
  // where the panel simply covers the full width.
  function stageLeft() {
    var fx = document.getElementById("fixable");
    if (!fx) return 0;
    if (getComputedStyle(fx).position !== "fixed") return 0;
    return Math.ceil(fx.getBoundingClientRect().right) + 12;
  }

  function placeStage() {
    stage.style.left = stageLeft() + "px";
  }

  function open() {
    lastFocus = document.activeElement;
    placeStage();
    stage.classList.add("open");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    openBtn.value = "Close Bestiary";
    openBtn.setAttribute("aria-expanded", "true");
    render();
    markCurrent();
    q.focus();
  }

  function close() {
    stage.classList.remove("open");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    openBtn.value = "Open Bestiary";
    openBtn.setAttribute("aria-expanded", "false");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // No click-outside close: the whole point of the left offset is that the
  // results column stays live, so a backdrop swallowing those clicks would
  // defeat it. Close button and Esc only.
  $("bst-close").addEventListener("click", close);
  window.addEventListener("resize", function () {
    if (panel.classList.contains("open")) placeStage();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("open")) close();
  });

  // The button lives right after the Enemy select so it reads as part of that
  // control. type=button keeps it out of the form's submit path, and the
  // calc's own dark-theme input rules style it.
  var openBtn = document.createElement("input");
  openBtn.type = "button";
  openBtn.id = "bst-open";
  openBtn.value = "Open Bestiary";
  openBtn.setAttribute("aria-expanded", "false");
  // The panel never covers the results column, so this button stays visible
  // while it is open and doubles as the close control.
  openBtn.addEventListener("click", function () {
    if (panel.classList.contains("open")) close();
    else open();
  });
  // combobox.js hides the native select and inserts a .cbx wrapper right after
  // it, so anchoring to the select alone would put the button to the LEFT of
  // the visible control. Anchor to the wrapper when it exists.
  var anchor = c.B_Enemy;
  if (anchor.nextElementSibling && anchor.nextElementSibling.className.indexOf("cbx") === 0) {
    anchor = anchor.nextElementSibling;
  }
  anchor.parentNode.insertBefore(openBtn, anchor.nextSibling);
})();
