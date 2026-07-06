// Number-input overlay for stat/level selects: STR/AGI/VIT/INT/DEX/LUK plus
// Base Level and Job Level. Progressive enhancement: the original <select>
// stays in the DOM with its name/ID untouched (visually hidden, not
// display:none). Committing a value sets select.value and dispatches a real
// "change" event, so the engine's inline onchange (StCalc()|StAllCalc()) fires
// exactly as a real select interaction would. Engine files are not modified.
// If this script fails, the raw selects work.
//
// Per user decision: the six primary stats are capped at 1-99 always.
// Vanilla's engine (head.js) lifts this to 130 for third-job classes, but
// that's a Renewal-era mechanic this classic/pre-Renewal calc treats as out
// of scope here — the underlying select can still legitimately hold a value
// >99 (e.g. a loaded save from a third-job build); this overlay just won't
// let you type past 99.
//
// Base Level and Job Level are different: their real caps genuinely vary by
// job (Job Level 10 for Novice vs 70 for Champion; Base Level 99 vs 175 for
// third-job classes) and the engine already sizes each select's option list
// correctly per job. So instead of a fixed number, their max is read live
// from the select's own option count every time — hardcoding one number here
// would either block valid high-tier values or allow invalid low-tier ones.
(function () {
  "use strict";
  var form = document.calcForm;
  if (!form) return;

  var FIELDS = [
    { name: "A_STR", label: "STR", min: 1, max: 99 },
    { name: "A_AGI", label: "AGI", min: 1, max: 99 },
    { name: "A_VIT", label: "VIT", min: 1, max: 99 },
    { name: "A_INT", label: "INT", min: 1, max: 99 },
    { name: "A_DEX", label: "DEX", min: 1, max: 99 },
    { name: "A_LUK", label: "LUK", min: 1, max: 99 },
    { name: "A_BaseLV", label: "Base Level", min: 1, max: "dynamic" },
    { name: "A_JobLV", label: "Job Level", min: 1, max: "dynamic" },
  ];

  function getMax(sel, field) {
    return field.max === "dynamic" ? sel.options.length : field.max;
  }
  function clamp(sel, field, n) {
    return Math.max(field.min, Math.min(getMax(sel, field), n));
  }

  function commit(sel, field, n) {
    var v = String(clamp(sel, field, n));
    if (sel.value === v) return;
    sel.value = v;
    sel.dispatchEvent(new Event("change")); // fires inline onchange -> StCalc()|StAllCalc()
  }

  function enhance(field) {
    var name = field.name;
    var sel = form[name];
    if (!sel || sel.__stin) return;
    sel.__stin = true;
    sel.classList.add("stin-hosted");
    sel.tabIndex = -1;

    var wrap = document.createElement("span");
    wrap.className = "stin";

    var dec = document.createElement("button");
    dec.type = "button";
    dec.className = "stin-btn stin-dec";
    dec.textContent = "−"; // minus
    dec.setAttribute("aria-label", field.label + " decrease");
    dec.tabIndex = -1;

    var el = document.createElement("input");
    el.type = "text";
    el.className = "stin-field";
    el.inputMode = "numeric";
    el.pattern = "[0-9]*";
    el.autocomplete = "off";
    el.maxLength = 3;
    el.setAttribute("aria-label", field.label);

    var inc = document.createElement("button");
    inc.type = "button";
    inc.className = "stin-btn stin-inc";
    inc.textContent = "+";
    inc.setAttribute("aria-label", field.label + " increase");
    inc.tabIndex = -1;

    wrap.appendChild(dec);
    wrap.appendChild(el);
    wrap.appendChild(inc);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);

    // forceRefresh: unconditionally show the select's real value. Used after
    // anything WE explicitly did (buttons, Enter, Escape, arrows, wheel) —
    // the user just took an action on this exact control, so the display
    // must reflect it even though the field still has focus.
    function forceRefresh() {
      el.value = String(1 * sel.value || field.min);
    }
    // passiveRefresh: same, but skipped while the field has focus. Used for
    // triggers that don't originate from this control (engine job-change
    // rebuilds, LoadLocal/URL-import writing sel.value directly, the
    // fallback poll) so an unrelated background update can't clobber
    // whatever the user is mid-typing.
    function passiveRefresh() {
      if (document.activeElement !== el) forceRefresh();
    }
    forceRefresh();

    function commitFromField() {
      var n = parseInt(el.value, 10);
      if (isNaN(n)) { forceRefresh(); return; }
      commit(sel, field, n);
      forceRefresh();
    }

    el.addEventListener("input", function () {
      var stripped = el.value.replace(/[^0-9]/g, "").slice(0, 3);
      if (stripped !== el.value) el.value = stripped;
    });
    el.addEventListener("blur", commitFromField);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commitFromField(); el.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); forceRefresh(); el.blur(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); commit(sel, field, (1 * sel.value || 0) + 1); forceRefresh(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); commit(sel, field, (1 * sel.value || 0) - 1); forceRefresh(); }
    });
    el.addEventListener("wheel", function (e) {
      if (document.activeElement !== el) return;
      e.preventDefault();
      commit(sel, field, (1 * sel.value || 0) + (e.deltaY < 0 ? 1 : -1));
      forceRefresh();
    }, { passive: false });

    function step(delta) {
      return function () {
        commit(sel, field, (1 * sel.value || 0) + delta);
        forceRefresh();
        el.focus();
      };
    }
    dec.addEventListener("click", step(-1));
    inc.addEventListener("click", step(1));

    // Engine paths (job change, LoadLocal, URL import) write sel.value
    // directly without a change event; keep the field in sync regardless.
    // Job change also rebuilds A_BaseLV/A_JobLV's option list (childList
    // mutation) since their real max varies by job — passiveRefresh doesn't
    // need to re-read the max explicitly, forceRefresh/clamp already call
    // getMax(sel, field) fresh on every use.
    sel.addEventListener("change", passiveRefresh);
    new MutationObserver(passiveRefresh).observe(sel, { childList: true });
    setInterval(passiveRefresh, 1000);
  }

  FIELDS.forEach(enhance);
})();
