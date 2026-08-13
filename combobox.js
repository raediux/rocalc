// Searchable combobox layer for rocalc item/equipment/card/enemy selects.
// Progressive enhancement: the original <select> stays in the DOM with its
// name/ID untouched (visually hidden, not display:none). The combobox reads
// options live at open time and commits by setting select.value and
// dispatching a real "change" event, so inline onchange engine handlers fire.
// Engine files are not modified. If this script fails, the raw selects work.
(function () {
  "use strict";
  var form = document.calcForm;
  if (!form || !window.MutationObserver) return;

  var TARGETS = [
    "A_weapon1", "A_weapon1_card1", "A_weapon1_card2", "A_weapon1_card3", "A_weapon1_card4",
    "A_weapon2", "A_weapon2_card1", "A_weapon2_card2", "A_weapon2_card3", "A_weapon2_card4",
    "A_head1", "A_head1_card", "A_head2", "A_head2_card", "A_head3",
    "A_body", "A_body_card", "A_left", "A_left_card",
    "A_shoulder", "A_shoulder_card", "A_shoes", "A_shoes_card",
    "A_acces1", "A_acces1_card", "A_acces2", "A_acces2_card",
    "A_cardshort", "A_cardshortLeft", "A_equipshort",
    "B_Enemy"
  ];
  var targetSet = {};
  TARGETS.forEach(function (n) { targetSet[n] = true; });

  var bound = []; // [{sel, trigger, wrap}]
  var openState = null; // {sel, pop, input, list, items, active}

  function selectedText(sel) {
    var o = sel.options[sel.selectedIndex];
    return o ? o.text : "";
  }

  function refreshLabel(entry) {
    if (!entry.sel.isConnected) return;
    var t = selectedText(entry.sel);
    if (entry.trigger.firstChild.nodeValue !== t) entry.trigger.firstChild.nodeValue = t;
  }

  function commit(sel, value) {
    sel.value = value;
    sel.dispatchEvent(new Event("change")); // fires inline onchange -> engine recalc
  }

  function closePopup() {
    if (!openState) return;
    if (openState.pop.parentNode) openState.pop.parentNode.removeChild(openState.pop);
    var entry = findEntry(openState.sel);
    if (entry) entry.trigger.setAttribute("aria-expanded", "false");
    openState = null;
  }

  function findEntry(sel) {
    for (var i = 0; i < bound.length; i++) if (bound[i].sel === sel) return bound[i];
    return null;
  }

  function setActive(idx) {
    if (!openState) return;
    var items = openState.items;
    if (!items.length) return;
    idx = Math.max(0, Math.min(idx, items.length - 1));
    if (openState.active >= 0 && items[openState.active]) items[openState.active].el.classList.remove("cbx-active");
    openState.active = idx;
    var it = items[idx];
    it.el.classList.add("cbx-active");
    var list = openState.list;
    if (it.el.offsetTop < list.scrollTop) list.scrollTop = it.el.offsetTop;
    else if (it.el.offsetTop + it.el.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = it.el.offsetTop + it.el.offsetHeight - list.clientHeight;
  }

  function applyFilter() {
    if (!openState) return;
    var q = openState.input.value.toLowerCase();
    var visible = [];
    for (var i = 0; i < openState.all.length; i++) {
      var it = openState.all[i];
      var show = !q || it.text.toLowerCase().indexOf(q) !== -1;
      it.el.style.display = show ? "" : "none";
      if (it.group) it.group.style.display = "none"; // re-shown if a child is visible
      if (show) {
        visible.push(it);
        if (it.group) it.group.style.display = "";
      }
    }
    openState.items = visible;
    openState.active = -1;
    if (visible.length) setActive(0);
    // filtering changes the popup's height; an upward-opening one has to be
    // re-anchored or it drifts away from the trigger as the list shrinks
    positionPopup(false);
  }

  var GAP = 2;        // trigger-to-popup breathing room
  var EDGE = 4;       // smallest allowed distance to a screen edge
  var MIN_LIST = 80;  // never clamp the list below this, even in a tight spot

  // The popup is placed in DOCUMENT coordinates (position:absolute on <body>),
  // not viewport ones, so it travels with the page for free: ordinary
  // scrolling, a phone keyboard shoving the page up, and iOS zooming into a
  // focused field all move the trigger and the popup together instead of
  // tearing them apart. body and html carry no filter/transform, so the
  // containing block is the initial one at the document origin and page
  // coordinates apply directly. No trigger sits in its own scroll container,
  // so the page scroll is the only one that can move one.
  //
  // recheckFlip: re-decide whether to open below or above the trigger. Done on
  // open and on resize (rotation, keyboard) but never while typing, so the
  // popup does not jump sides under the user mid-search.
  function positionPopup(recheckFlip) {
    if (!openState) return;
    var entry = findEntry(openState.sel);
    if (!entry) return;
    var pop = openState.pop, list = openState.list;
    var r = entry.trigger.getBoundingClientRect();
    // clientWidth/clientHeight, not innerWidth/innerHeight: the latter count
    // the scrollbars, which the viewport we have to fit inside does not.
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var below = vh - r.bottom - GAP - EDGE;
    var above = r.top - GAP - EDGE;

    list.style.maxHeight = "";            // measure at natural size
    var popH = pop.offsetHeight;
    // Open below unless it doesn't fit there and the other side has more room.
    if (recheckFlip) openState.flip = popH > below && above > below;
    var room = openState.flip ? above : below;
    // Too tall for the side it is on? Clamp the list rather than let options
    // run off the screen edge. On a phone — especially with the on-screen
    // keyboard up — there may only be a couple of hundred pixels to work with,
    // and anything past the edge is unreachable while the popup is open.
    if (popH > room) {
      list.style.maxHeight = Math.max(MIN_LIST, room - (popH - list.offsetHeight)) + "px";
      popH = pop.offsetHeight;
    }

    var left = Math.max(EDGE, Math.min(r.left, vw - pop.offsetWidth - EDGE));
    var top = openState.flip ? r.top - popH - GAP : r.bottom + GAP;
    pop.style.left = left + window.pageXOffset + "px";
    pop.style.top = top + window.pageYOffset + "px";
  }

  function openPopup(entry) {
    closePopup();
    var sel = entry.sel;
    var pop = document.createElement("div");
    pop.className = "cbx-pop";
    var input = document.createElement("input");
    input.type = "text";
    input.className = "cbx-filter";
    input.placeholder = "Type to search… (" + sel.options.length + ")";
    input.setAttribute("autocomplete", "off");
    var list = document.createElement("div");
    list.className = "cbx-list";
    pop.appendChild(input);
    pop.appendChild(list);

    // read options LIVE (engine repopulates them at runtime)
    var all = [];
    var lastGroupEl = null, lastGroup = null;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (o.disabled) continue;
      var grp = o.parentElement && o.parentElement.tagName === "OPTGROUP" ? o.parentElement : null;
      if (grp && grp !== lastGroup) {
        lastGroupEl = document.createElement("div");
        lastGroupEl.className = "cbx-group";
        lastGroupEl.textContent = grp.label;
        list.appendChild(lastGroupEl);
        lastGroup = grp;
      } else if (!grp) { lastGroup = null; lastGroupEl = null; }
      var el = document.createElement("div");
      el.className = "cbx-item" + (i === sel.selectedIndex ? " cbx-selected" : "");
      el.textContent = o.text;
      el.setAttribute("data-v", o.value);
      list.appendChild(el);
      all.push({ el: el, text: o.text, value: o.value, group: lastGroupEl });
    }

    // Appended to <body> (not entry.wrap): position:fixed is relative to the
    // nearest ancestor with a filter/backdrop-filter/transform, not the
    // viewport, per spec. The glass theme puts backdrop-filter on .main and
    // other panel ancestors, which was hijacking the coordinates below.
    document.body.appendChild(pop);
    // Focus lands on the trigger, not the search box, so Home/End address the
    // list immediately — Home jumps straight to the top option, usually
    // "(no X)", without first needing to tab out of the text field.
    //
    // It happens up here, before the measurements below, and with
    // preventScroll: focusing an element that is partly outside the viewport
    // otherwise scrolls it into view, which would both invalidate the rect
    // measured on the next line and fire a scroll event that the global
    // handler reads as "close the popup". preventScroll stops that outright;
    // doing it first means that on a browser that ignores the option, the
    // scroll at least settles before anything is measured.
    entry.trigger.focus({ preventScroll: true });
    pop.style.position = "absolute";
    entry.trigger.setAttribute("aria-expanded", "true");
    openState = { sel: sel, pop: pop, input: input, list: list, all: all, items: all.slice(), active: -1, flip: false };
    positionPopup(true);
    // pre-highlight current selection
    for (var j = 0; j < all.length; j++) if (all[j].value === sel.value) { setActive(j); break; }

    list.addEventListener("mousedown", function (e) {
      var t = e.target;
      if (!t.classList.contains("cbx-item")) return;
      e.preventDefault();
      commit(sel, t.getAttribute("data-v"));
      closePopup();
      entry.trigger.focus();
    });
    list.addEventListener("mousemove", function (e) {
      var t = e.target;
      if (!t.classList.contains("cbx-item") || !openState) return;
      var idx = openState.items.findIndex(function (it) { return it.el === t; });
      if (idx >= 0 && idx !== openState.active) setActive(idx);
    });
    input.addEventListener("input", applyFilter);
    input.addEventListener("keydown", handleNavKey);
  }

  // Shared by the trigger (default focus holder while a popup is open) and
  // the search input (once the user types or explicitly focuses it).
  function handleNavKey(e) {
    if (!openState) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(openState.active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(openState.active - 1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(openState.items.length - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      var it = openState.items[openState.active];
      var sel = openState.sel, entry = findEntry(sel);
      if (it) { commit(sel, it.value); closePopup(); if (entry) entry.trigger.focus(); }
    } else if (e.key === "Escape") {
      e.preventDefault();
      var sel2 = openState.sel, entry2 = findEntry(sel2);
      closePopup();
      if (entry2) entry2.trigger.focus();
    } else if (e.key === "Tab") closePopup();
    else if (document.activeElement !== openState.input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // typing while focus is still on the trigger: hand off to the search
      // box so filter-by-typing keeps working without an extra click/tab.
      // preventDefault is required here: focus() moves onto the input
      // mid-keydown, so without it the browser's own native key handling
      // still fires afterward on the newly-focused input and inserts the
      // same character a second time (the "doubled first letter" bug).
      e.preventDefault();
      openState.input.focus();
      openState.input.value = e.key;
      applyFilter();
    }
  }

  function enhance(sel) {
    if (sel.__cbx || !targetSet[sel.name]) return;
    sel.__cbx = true;
    sel.classList.add("cbx-hosted");
    sel.tabIndex = -1;

    var wrap = document.createElement("span");
    wrap.className = "cbx";
    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "cbx-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.appendChild(document.createTextNode(selectedText(sel)));
    var caret = document.createElement("span");
    caret.className = "cbx-caret";
    trigger.appendChild(caret);
    wrap.appendChild(trigger);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);

    var entry = { sel: sel, trigger: trigger, wrap: wrap };
    bound.push(entry);

    trigger.addEventListener("click", function () {
      if (openState && openState.sel === sel) closePopup();
      else openPopup(entry);
    });
    trigger.addEventListener("keydown", function (e) {
      if (openState && openState.sel === sel) { handleNavKey(e); return; }
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPopup(entry);
      }
    });
    // our own commits + anything else that fires change on the select
    sel.addEventListener("change", function () { refreshLabel(entry); });
  }

  function sweepBindings() {
    // drop entries whose select left the DOM (engine innerHTML rebuilds)
    for (var i = bound.length - 1; i >= 0; i--) {
      if (!bound[i].sel.isConnected) {
        if (openState && openState.sel === bound[i].sel) closePopup();
        if (bound[i].wrap.isConnected) bound[i].wrap.parentNode.removeChild(bound[i].wrap);
        bound.splice(i, 1);
      }
    }
    // bind new/rebuilt selects
    var sels = form.querySelectorAll("select");
    for (var j = 0; j < sels.length; j++) enhance(sels[j]);
  }

  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; sweepBindings(); });
  }).observe(form, { childList: true, subtree: true });

  document.addEventListener("mousedown", function (e) {
    if (openState && !openState.pop.contains(e.target) && !findEntry(openState.sel).trigger.contains(e.target)) closePopup();
  });
  // Scrolling no longer closes the popup. It is positioned in document
  // coordinates, so it travels with its trigger rather than drifting off it;
  // closing on scroll used to paper over that drift, and on a phone it made
  // search unusable — the browser scrolls a focused field into view above the
  // keyboard, which shut the popup the moment you tapped into it.
  //
  // The height clamp is still measured against the viewport though, so it goes
  // stale as a scroll carries the popup toward a screen edge. Recompute it,
  // one layout pass per frame, ignoring scrolls inside the popup's own list.
  // The flip is deliberately not rechecked: the popup must not change sides
  // while the user is scrolling.
  var reflowQueued = false;
  window.addEventListener("scroll", function (e) {
    if (!openState || reflowQueued || openState.pop.contains(e.target)) return;
    reflowQueued = true;
    requestAnimationFrame(function () { reflowQueued = false; positionPopup(false); });
  }, true);
  //
  // Resize repositions instead of closing, for the same reason: on Android the
  // on-screen keyboard opening IS a resize, so closing there meant the popup
  // vanished before a single character could be typed. Rechecking the flip
  // also lets the popup move to whichever side of the trigger still has room
  // once the keyboard has eaten half the screen.
  window.addEventListener("resize", function () { positionPopup(true); });

  // Engine code paths that set select.value directly (LoadLocal, URL import,
  // restriction resets) do not fire change events; keep labels in sync.
  setInterval(function () {
    for (var i = 0; i < bound.length; i++) refreshLabel(bound[i]);
  }, 1500);

  sweepBindings();
})();
