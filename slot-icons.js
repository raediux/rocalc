// Lights up each equipment slot's icon when a real item (not the "(Slot)"
// placeholder) is selected, by maintaining an .eqp-equipped class on the
// slot's .eqp-item. Pure-CSS :has(option:checked) can't do this: Chromium
// doesn't re-run style invalidation when an option's selectedness changes,
// so the rule matches on paper but the rendered style never updates.
// Placeholders always sit at option index 0 (the "(X)" parenthesis prefix
// sorts them first through engine list rebuilds), so "equipped" is simply
// selectedIndex > 0 — uniform across flat and optgroup-based selects.
// Change events cover user edits (combobox commits dispatch real change
// events); the interval sweep covers engine code paths that set .value
// directly without firing change (LoadLocal, job resets), same pattern
// combobox.js uses for its trigger labels.
(function () {
  "use strict";
  var form = document.calcForm;
  if (!form) return;

  var SLOTS = [
    "A_weapon1", "A_weapon2", "A_head1", "A_head2", "A_head3",
    "A_left", "A_body", "A_shoulder", "A_shoes", "A_acces1", "A_acces2"
  ];

  function sweep() {
    for (var i = 0; i < SLOTS.length; i++) {
      var sel = form[SLOTS[i]];
      if (!sel || !sel.closest) continue; // A_weapon2 only exists for dual-wield classes
      var item = sel.closest(".eqp-item");
      if (item) item.classList.toggle("eqp-equipped", sel.selectedIndex > 0);
    }
  }

  // capture:true — combobox.js commits via new Event("change"), which does
  // NOT bubble, so a plain listener here would miss every combobox pick and
  // leave the icon lagging until the next interval sweep. Capture-phase
  // listeners run on ancestors even for non-bubbling events.
  form.addEventListener("change", sweep, true);
  setInterval(sweep, 1200);
  sweep();
})();
