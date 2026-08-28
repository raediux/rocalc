// Hides monsters that aren't real targets on this server from the Enemy
// dropdown, and owns the exclusion set that bestiary.js reads so the dropdown
// and the bestiary table can never disagree about what exists.
//
// Excluded: the "(aRO)"/"(Custom)"/"(Renewal)" variants, which are duplicates
// of monsters already listed; Antonio (id 17), a training dummy; and id 548,
// the speculative "Emperium [assuming it's bosstype]" duplicate of the real
// Emperium (id 44). Excluding by id where possible -- m_Monster is positional,
// so an id can never shift, while a name can be edited.
//
// Engine files stay untouched. EnemySort() rebuilds B_Enemy's options on every
// Sort/Place change and both of its branches run the id list through SZ(),
// which drops an entry by setting it to -1 -- so wrapping SZ filters every
// rebuild from one place. Must be loaded AFTER monster_*.js and foot_*.js, and
// BEFORE bestiary.js.
(function () {
  "use strict";

  var c = document.calcForm;
  if (!c || !c.B_Enemy || typeof SZ !== "function" || typeof m_Monster === "undefined") return;

  var EXCLUDE_IDS = { 17: 1, 548: 1 };
  // "[Custom Player]" (id 586) is the PvP target dummy, not a server variant --
  // the parentheses in this pattern are what keep it in the list.
  var EXCLUDE_NAME = /\((aRO|Custom|Renewal)\)/;

  // id -> 1 for every hidden monster. Published so bestiary.js filters its
  // table from this exact set instead of keeping a second copy of the rules.
  var hidden = {};
  for (var i = 0; i < m_Monster.length; i++) {
    var r = m_Monster[i];
    if (r && (EXCLUDE_IDS[r[0]] || EXCLUDE_NAME.test(r[1]))) hidden[r[0]] = 1;
  }
  window.RO_HIDDEN_MONSTERS = hidden;

  var innerSZ = SZ;
  SZ = function (list) {
    list = innerSZ(list);
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== -1 && hidden[list[i]]) list[i] = -1;
    }
    return list;
  };

  // Three regions are made up entirely of hidden variants, so their Place
  // option would filter the Enemy list down to nothing. Found by counting
  // rather than hardcoded, so editing m_MonsterMap or the rules above can't
  // leave a stale empty region behind.
  if (c.ENEMY_SORT2 && typeof m_MonsterMap !== "undefined") {
    for (var p = c.ENEMY_SORT2.options.length - 1; p >= 1; p--) {
      var row = m_MonsterMap[1 * c.ENEMY_SORT2.options[p].value];
      if (!row) continue;
      var kept = 0;
      for (var t = 0; row[t] !== "N" && t < row.length; t++) {
        if (row[t] !== undefined && !hidden[row[t]]) kept++;
      }
      if (kept === 0) c.ENEMY_SORT2.remove(p);
    }
  }

  // foot_*.js already built the dropdown (and LoadLocal3()/URLIN() may have
  // selected into it) before this file ran, so rebuild once and put the
  // selection back. A saved build pointing at a hidden monster has no option
  // left to restore, so it falls back to the engine's own default enemy.
  var want = c.B_Enemy.value;
  if (typeof EnemySort === "function") EnemySort();
  c.B_Enemy.value = want;
  if (c.B_Enemy.selectedIndex < 0) {
    c.B_Enemy.value = 144; // Abysmal Knight, the default foot_*.js resets to
    if (c.B_Enemy.selectedIndex < 0) c.B_Enemy.selectedIndex = 0;
    if (typeof Bskill === "function") Bskill();
    if (typeof calc === "function") calc();
  }
})();
