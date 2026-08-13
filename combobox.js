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
    var r = entry.trigger.getBoundingClientRect();
    pop.style.position = "fixed";
    pop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 340)) + "px";
    pop.style.top = r.bottom + 2 + "px";
    var popH = pop.offsetHeight;
    // clientHeight, not innerHeight: a fixed element's containing block is the
    // layout viewport, which excludes the horizontal scrollbar that
    // innerHeight counts — using the latter drops the popup ~15px too low.
    var vh = document.documentElement.clientHeight;
    // Popups that don't fit below flip above the trigger, and are anchored by
    // their BOTTOM edge rather than a frozen `top`: filtering shrinks the list,
    // and a fixed top would leave the box floating far above the combo it
    // belongs to. Anchoring the bottom keeps it glued as the height changes.
    if (r.bottom + 2 + popH > vh && r.top - popH - 2 > 0) {
      pop.style.top = "auto";
      pop.style.bottom = vh - r.top + 2 + "px";
    }
    entry.trigger.setAttribute("aria-expanded", "true");
    // anchor: where the trigger sat when the coordinates above were computed.
    // The scroll handler closes on movement away from it rather than on any
    // scroll at all, so a scroll that leaves the trigger where it is — the one
    // the act of opening can itself cause, dispatched asynchronously once
    // openState already exists — cannot slam the popup shut as it appears.
    openState = { sel: sel, pop: pop, input: input, list: list, all: all, items: all.slice(), active: -1,
                  anchor: { top: r.top, left: r.left } };
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
  // fixed-position popup would drift away from its trigger on scroll; close it
  // — but only once the trigger has actually moved out from under it. Scrolls
  // that leave it in place (an inner container, or the browser reacting to the
  // focus() in openPopup) leave the popup correctly anchored, so they are not
  // grounds for closing.
  window.addEventListener("scroll", function (e) {
    if (!openState || openState.pop.contains(e.target)) return;
    var entry = findEntry(openState.sel);
    if (entry) {
      var c = entry.trigger.getBoundingClientRect();
      if (Math.abs(c.top - openState.anchor.top) < 1 && Math.abs(c.left - openState.anchor.left) < 1) return;
    }
    closePopup();
  }, true);
  window.addEventListener("resize", closePopup);

  // Engine code paths that set select.value directly (LoadLocal, URL import,
  // restriction resets) do not fire change events; keep labels in sync.
  setInterval(function () {
    for (var i = 0; i < bound.length; i++) refreshLabel(bound[i]);
  }, 1500);

  sweepBindings();
})();
