// Reflects Ray's private-server card changelog on top of a 100% vanilla
// card.js — every automated adjustment patches the engine's own internal
// values directly (globals like n_A_DEF/n_A_STR/n_A_FLEE, the n_tok[]
// array, or a handful of new hardcoded lines in foot_2026-04-06.js) and is
// displayed ONLY in the "Project Baldur Adjustments" floating panel. As of
// 2026-07-06 this is deliberate and total: the real "Additional Enchants &
// Manual Edits on Player" panel is never written to by this script at all,
// so it stays 100% reserved for the user's own manual edits with zero risk
// of automation ever touching or conflicting with them (an earlier version
// wrote deltas into that panel's ARG_RC## fields directly — Ray asked for
// this to change specifically to avoid that risk). If this script fails,
// the calc just runs 100% vanilla — nothing here can crash it.
//
// Scope: only cards with a genuine engine hook are automatable this way —
// the Additional Enchants panel (and the engine generally) has no field for
// status-inflict chance (sleep/poison/silence/...) or item/potion healing
// effectiveness %, so changelog entries that only touch those (Eggyra/Muka/
// Zombie recovery%, and the status-chance half of the Coco/Stainer/Martin/
// Argos/Wootan/Megalodon/Ghoul DEF+status cluster) can't be represented at
// all — only their automatable half is included below.
//
// A handful of cards' bonuses live inside a LOCAL, function-scoped variable
// in StAllCalc that gets combined MULTIPLICATIVELY (e.g. `n_A_MaxHP =
// n_A_MaxHP * (100+I) / 100`) or gets overwritten/repurposed later in the
// same call (ASPD) — there's no way to monkey-patch a delta onto these
// after the fact, so those specific lines are edited directly in
// foot_2026-04-06.js instead (each edit flagged to Ray and approved before
// being made, verified via occurrence-count-checked literal string
// replacement, never sed/regex on that minified file):
//   - Firelock Soldier (card 304, shoes): %MaxHP/%MaxSP refine>=9,+10% ->
//     refine>=7,+9%.
//   - Gold Acidus (card 407, shoes): %MaxHP/%MaxSP "additional" layer at
//     refine<=4, 4%->5% each; HP/SP Recovery Rate at refine<=4, 5%->15% each.
//   - Blue Acidus (card 179, headgear): SP Recovery Rate 5%->15% (CORRECTED
//     2026-07-08 from an earlier 5%->20% overshoot — Ray's in-game tooltip,
//     card ID 4379, shows +15% at refine <=4). Both live SP-recovery lines
//     set to +15: the head2 line `179==n_A_card[9]&&(I+=15)` (unconditional,
//     since the head2 slot has no refine selector in this UI) and the head1
//     line `n_A_HEAD_REFINE<=4&&179==n_A_card[8]&&(I+=15)` (refine<=4 gated).
//     NOTE: an earlier version of this comment claimed the head1/n_A_card[8]
//     line was dead ("card only equips in head2") — that was WRONG. Verified
//     live 2026-07-08: card 179 is offered in BOTH the head1 and head2
//     dropdowns, and the head1 refine gate works (MaxSP +80 at refine<=4,
//     +40 at >=5). The only genuinely dead lines are
//     `179==n_A_card[16/17/18]&&(I+=5)`, since n_A_card is only ever assigned
//     indices 0-15 anywhere in the engine.
//   - Kathryne Keyron (card 177, headgear — = changelog's "Katrinn_Card";
//     confirmed live to equip via head1/n_A_card[8], so no head1-vs-head2
//     trap here): %MATK bonus threshold refine>=9 -> refine>=7, value
//     unchanged at +2%. Since there's no value change, this card needed NO
//     STAT_DELTAS/CODE_DELTAS/REFINE_DELTAS entry at all — the engine edit
//     alone fully implements the changelog ("+9 -> +7 refine requirement").
//     Its OTHER effect (Casting Time -1% per refine level, unconditional)
//     isn't touched by the changelog, left as-is.
//   - Andre Egg (card 54, left/accessory) and Yellow Novus (card 193, body):
//     %MaxHP, added 2026-07-06 as part of converting every CARD_DELTAS entry
//     off the Additional Enchants fields. Both feed the SAME multiplicative
//     %MaxHP block, so both new hardcoded checks (`54==n_A_card[10]&&
//     (I+=5)`, `193==n_A_card[11]&&(I+=2)`) were inserted together right
//     after the block's existing `n_tok[15]+n_A_Buf9[31]` line.
//   - Baby Desert Wolf (card 69, body): %MATK+1, same conversion — inserted
//     `69==n_A_card[11]&&(I+=1)` into the analogous %MATK multiplicative
//     block.
//   - Howard Alt-Eisen (card 159, weapon slot 4): ASPD+6, same conversion.
//     Turned out simpler than the %-based cases above even though it's a
//     plain ADDITIVE block (`n_A_ASPD += I`) — the trap here is different:
//     by the time StAllCalc() fully returns, n_A_ASPD has been overwritten
//     with a derived "delay divisor" value ((200-rawASPD)/50) for damage-
//     per-second math, so there's no "raw ASPD" global left to patch
//     post-hoc. Inserted `159==n_A_card[3]&&(I+=6)` directly into the
//     additive block instead of reverse-computing the transform.
// Everything else in STAT_DELTAS/REFINE_DELTAS/CODE_DELTAS below needs no
// engine edits — see ENGINE_EDIT_SUMMARY further down for how these six
// pure-engine-edit cards still show up in the summary panel.
//
// STAT_CONVERSION_DELTAS (added 2026-07-06): the "every 18/15 stat" armor
// cluster (Obsidian/Egnigem Cenia/Venatu/Ancient Mimic/Mistress of Shelter/
// Observation) reassigns BOTH the source stat AND the divisor AND the
// target stat per card into one 6-card cycle — needs no engine edit since
// every formula reads a clean, frozen base-stat snapshot (SU_STR/AGI/VIT/
// INT/DEX/LUK) and writes to a clean additive global (n_A_STR/AGI/VIT/INT/
// DEX/LUK) — see the dedicated comment above that structure for the full
// per-card mapping.
(function () {
  "use strict";
  var form = document.calcForm;
  if (!form) return;

  // cardName -> { engine global: delta }. Converted 2026-07-06 from an
  // earlier version that wrote these deltas straight into the Additional
  // Enchants ARG_RC## fields — per Ray's direction, EVERY automated
  // adjustment now bypasses the visible fields entirely (same StAllCalc-
  // wrap-and-patch mechanism REFINE_DELTAS already used, just applied
  // unconditionally instead of refine-gated) so those fields stay 100%
  // reserved for the user's own manual edits, with zero risk of automation
  // ever touching them. Everything still shows up in the Project Baldur
  // Adjustments summary, same as before.
  //
  // Confirmed via foot.js which of these globals are simple, safely-
  // patchable-after-the-fact additions (the SAME check REFINE_DELTAS relied
  // on): n_A_DEF/n_A_MDEF (`n_A_DEF = n_tok[18]+n_A_Buf9[34]`, etc.),
  // n_A_HIT (`n_A_HIT += n_tok[8]+n_A_Buf9[36]`), n_A_FLEE, n_A_LUCKY
  // (confirmed this is Perfect Dodge's real variable name — `n_A_LUCKY +=
  // n_tok[11]+n_A_Buf9[38]`), n_A_CRI (Crit Rate), n_A_ATK
  // (`n_A_ATK += I` before a LATER unrelated %-scaling step — patching
  // post-hoc still lands correctly since our delta rides along with
  // whatever %-scaling applies to everyone else's flat ATK), n_A_STR/AGI/
  // VIT/INT/DEX/LUK, n_A_MaxHP/MaxSP (their ADDITIVE phase specifically,
  // confirmed distinct from the %-based phase — see below).
  //
  // Four cards turned out to feed a LOCAL, function-scoped multiplicative
  // variable (same trap as Firelock Soldier) or a variable that gets
  // overwritten/repurposed later in the same StAllCalc call (ASPD — the
  // "raw ASPD number" gets transformed into a "delay divisor" by the time
  // StAllCalc returns), so post-hoc global patching can't work for them —
  // each got a NEW hardcoded engine line instead (flagged and approved
  // before being made, same occurrence-count-verified methodology as every
  // other engine edit this project): Andre Egg and Yellow Novus (%MaxHP),
  // Baby Desert Wolf (%MATK), Howard Alt-Eisen (ASPD). These four need NO
  // entry here at all — the engine edit alone fully implements them — but
  // ENGINE_EDIT_SUMMARY further below still lists them so the Project
  // Baldur Adjustments panel shows every automated card consistently,
  // regardless of which mechanism implements it.
  var STAT_DELTAS = {
    "Lunatic": { n_A_LUK: 2 }, // LUK 1->3
    "Chonchon": { n_A_AGI: 2 }, // AGI 1->3
    "Hornet": { n_A_ATK: 7 }, // ATK 3->10
    "Spore": { n_A_VIT: 1 }, // VIT 2->3
    "Female Thief Bug": { n_A_AGI: 1 }, // AGI 1->2
    "Cornutus": { n_A_DEF: 4 }, // DEF 1->5
    "Golem": { n_A_ATK: 10 }, // ATK 5->15
    "Soldier Skeleton": { n_A_CRI: 1 }, // Critical Rate 9->10
    // DEF-only portion of the "1->3 DEF, 20%->30% status" cluster; the
    // status-chance half has no Additional Enchants field to hold it.
    "Coco": { n_A_DEF: 2 },
    "Stainer": { n_A_DEF: 2 },
    "Martin": { n_A_DEF: 2 },
    "Argos": { n_A_DEF: 2 },
    "Wootan Fighter": { n_A_DEF: 2 },
    "Wootan Shooter": { n_A_DEF: 2 },
    "Megalodon": { n_A_DEF: 2 },
    "Ghoul": { n_A_DEF: 2 },
    // Munak: same DEF baseline pattern (1->3, code18=1) as the cluster
    // above. Its Earth-resist removal lives in CODE_DELTAS below (bypass-UI,
    // same mechanism as Bucket B); its "Payon mobs" resist and Stone Curse
    // chance removal are NOT automatable at all — see the CODE_DELTAS note.
    "Munak": { n_A_DEF: 2 },

    // Batch 2 (2026-07-05) — all live-verified against Your Character totals.
    "Thief Bug": { n_A_FLEE: 4 }, // Added 4 FLEE
    "Tarou": { n_A_ATK: 2 }, // Added 2 ATK
    "Ambernite": { n_A_DEF: 5, n_A_MDEF: 3 }, // DEF 2->7, added 3 MDEF
    "Wormtail": { n_A_HIT: 5 }, // Added 5 HIT (changelog: "Worm_Tail_Card")
    "Male Thief Bug": { n_A_AGI: 1, n_A_FLEE: 2 }, // AGI 2->3, added 2 FLEE
    "Dragon Fly": { n_A_AGI: 1 }, // AGI 1->2
    "Vagabond Wolf": { n_A_STR: 1 }, // STR 1->2
    "Raggler": { n_A_STR: 1, n_A_VIT: 1 }, // STR 1->2, VIT 1->2
    "Mastering": { n_A_LUK: 1 }, // LUK 1->2
    "Vocal": { n_A_MDEF: 2 }, // MDEF 3->5
    // Fireball skill-level part (L3->L5) has no field, not automatable.
    "Mutant Dragonoid": { n_A_ATK: 5 }, // ATK 15->20 (changelog: "Mutant_Dragon_Card")
    // code8=HIT confirmed live via this card + Cecil Damon/Howard Alt-Eisen.
    "Stone Shooter": { n_A_ATK: 5, n_A_HIT: 5 }, // ATK 10->15, HIT 10->15
    // Shuriken-throw-on-hit proc (replacing cloak) has no field, not automatable.
    "Shinobi": { n_A_LUCKY: 1 }, // Added 1 Perfect Dodge
    // Full replacement, not an addition: vanilla LUK+3 removed entirely,
    // Perfect Dodge+3 added in its place (changelog: "Baby_Leopard_Card").
    "Baby Leopard": { n_A_LUK: -3, n_A_LUCKY: 3 },
    "Alarm": { n_A_MaxHP: 100 }, // MaxHP 300->400
    // Wild Rose's OTHER effect (vanilla "[Thief class] Perfect Dodge +5",
    // card ID 391) was wrongly flagged "not reflected" in the changelog note
    // below — confirmed 2026-07-07 it's already fully computed by vanilla
    // itself: foot.js hardcodes `2==n_A_JobClass()&&391==n_A_card[13]&&
    // (n_A_LUCKY+=5)`. Live-verified: Thief + Wild Rose in the shoes-card
    // slot moves n_A_LUCKY from 1.1 to 6.1 (+5), no delta entry needed.
    "Wild Rose": { n_A_LUK: 1 }, // Added 1 LUK
    "Eclipse": { n_A_VIT: 1 }, // VIT 1->2
    // This is "Dancing_Dragon_Card" in the changelog — same card, this
    // data's own name is "Zhu Po Long" (confirmed via its own code comment).
    "Zhu Po Long": { n_A_CRI: 1 }, // Crit Rate 3->4
    // code9=FLEE confirmed live via this card.
    "Choco": { n_A_FLEE: 5 }, // FLEE 10->15 (banana juice/provoke not automatable)
    "Tamruan": { n_A_DEF: 1 }, // DEF 2->3 (shield charge skill dmg not automatable)
    "Toad": { n_A_LUCKY: 2 }, // Perfect Dodge 1->3
    // Neutral-element resist half (5%->10%) resolved 2026-07-06 via
    // CODE_DELTAS below (code60 = Neutral resist, bypasses the UI same as
    // the rest of Bucket B) — only the DEF part lives here.
    "Parasite": { n_A_DEF: 1 }, // DEF 1->2
    "Waste Stove": { n_A_ATK: 5 }, // ATK 5->10
    "Mineral": { n_A_ATK: 20, n_A_DEF: 4 }, // ATK -25->-5, DEF 3->7
    // WoE:SE "Biolab" card set — changelog uses shorthand names (Harword,
    // Shecil) that don't exist in this data; the actual rows are named
    // after the character's full name. code12=ASPD, code8=HIT confirmed
    // live via this pair (opposite-signed on the two cards, consistent).
    // Howard Alt-Eisen itself (ASPD -5->1) is a pure engine edit now — see
    // ENGINE_EDIT_SUMMARY below — no entry needed here.
    "Cecil Damon": { n_A_HIT: 33 }, // HIT -30->3 (changelog: "Shecil_Card")
    "Alicel": { n_A_DEF: 5 }, // DEF -5->0
    // %HP recovery half (10%->20%) — see CODE_DELTAS below (code75), fixed
    // 2026-07-07 (was wrongly assumed no field existed).
    // Yellow Novus itself (%MaxHP+2) is a pure engine edit now — see
    // ENGINE_EDIT_SUMMARY below — no entry needed here.

    // Deferred-and-resolved (2026-07-06): the changelog's "Picky Egg Card"
    // (id 4011, "1 VIT -> 3 VIT") doesn't match this data's "Picky" card
    // (STR+1, ClassATK+10, no VIT at all) — confirmed no such card/id/name
    // exists in this dataset. Ray pointed at the actual match: "Super Picky"
    // is [66,4,"Super Picky",0,3,1,13,100,0] = VIT+1, flat MaxHP+100 — the
    // VIT baseline (1) matches the changelog exactly. Only VIT is changed
    // here; the flat MaxHP+100 isn't mentioned in the changelog so it's
    // left untouched.
    "Super Picky": { n_A_VIT: 2 }, // VIT 1->3

    // Wooden Golem: changelog assumes DEF baseline 3 (->5), but this data's
    // actual baseline is DEF 1 (confirmed: [240,4,"Wooden Golem",0,75,30,18,1,0]).
    // Ray confirmed the "3" baseline was the changelog's typo, but the target
    // end value (5) is correct — so the delta is 5 minus this data's real
    // baseline (1), i.e. +4, landing on DEF 5 as intended.
    // The card's other effect (code75 = 30% flat HP-recovery, changelog says
    // 30%->50%) — see CODE_DELTAS below, fixed 2026-07-07 (was wrongly
    // assumed not automatable; code75 is NATURAL HP regen, not item/potion
    // recovery% — a real, different field from the genuinely-unautomatable
    // Eggyra/Muka/Zombie gap).
    "Wooden Golem": { n_A_DEF: 4 }, // DEF 1->5

    // "Not yet triaged" pile (2026-07-06) — Ray asked for a full audit
    // against the changelog's 169 entries; these were found to have clean,
    // automatable stat components that had simply never been looked at.
    "Savage": { n_A_VIT: 2, n_A_MaxHP: 200 }, // VIT 3->5 (code3=3, baseline matches), Added 200 HP (new)
    // "Baphomet__Card" in the changelog — matches this dataset's "Baphomet
    // Jr." (code2=AGI+3, code10=CRIT+1, no existing FLEE at all), not the
    // plain "Baphomet" card (code8=HIT-10) — same double-underscore-drops-a-
    // word naming quirk as Yellow Novus ("Novus__Card"). "Added 5 flee" is a
    // wholly new bonus either way (neither card has an existing FLEE code).
    "Baphomet Jr.": { n_A_FLEE: 5 },
    // Freezer: code13=MaxHP+300 is UNCONDITIONAL (confirmed: no hardcoded
    // refine-check exists for card 362 anywhere in foot.js) — same flat,
    // ungated pattern as Alarm. Changelog: "300 -> 400 HP [so its inline
    // with Alarm Card change]" confirms this directly. Its OTHER effect
    // ("[Refine Rate 9~10] +10% damage with Bash") is a skill-specific
    // damage bonus with no generic field — not automatable, not included
    // (changelog's "+9 -> +7" threshold note applies to that part, not HP).
    "Freezer": { n_A_MaxHP: 100 }, // MaxHP 300->400
    // Ice Titan: code3=VIT+2 (baseline matches "Increased VIT 2->5").
    // Its OTHER effect (0.3%->5% chance to gain a TEMPORARY +10->15 DEF
    // buff for 10 seconds on taking damage) is a proc-based temporary buff —
    // this calculator only computes static/permanent totals, has no concept
    // of a chance-triggered timed buff, so this part isn't automatable and
    // isn't included.
    "Ice Titan": { n_A_VIT: 3 }, // VIT 2->5

    // Batch 3 of the untriaged pile (2026-07-06):
    // Zenorc: code17=10 confirmed to feed the same clean `I` var as every
    // other flat-ATK card (`I=n_tok[17],I+=n_A_Buf9[40],...` -> eventually
    // n_A_ATK+=I), matching changelog's "10->12 ATK" baseline exactly. Its
    // poison-inflict removal (code130) is genuinely inert in this engine —
    // confirmed n_tok[130] has zero downstream consumers anywhere (a real
    // dead code/tooltip-only value, not a missed hookup) — and its new
    // "5% orc voucher drop chance" is a drop-rate%, not automatable either.
    "Zenorc": { n_A_ATK: 2 }, // ATK 10->12
    // Fur Seal: codes 8=10(HIT), 9=3(FLEE) confirmed via the same generic
    // codes Wormtail/Choco use — matches changelog's "HIT 10->12, flee 3->4"
    // exactly, automatable regardless of the card's OTHER effect being
    // Acolyte-class-conditional. That other effect ("Class CRIT 9->10
    // against Undead/Demon races, Acolyte only") is a genuine job-
    // conditional hardcoded bonus — folded into Bucket D (job-conditional,
    // still not started: Fur Seal/Agav/Echio/Banshee) rather than modeled
    // here.
    "Fur Seal": { n_A_HIT: 2, n_A_FLEE: 1 }, // HIT 10->12, FLEE 3->4

    // Flagged-item resolution (2026-07-06): Verit's changelog entry ("Added
    // combo with Skull Ring, 1 DEF, 3% chance to cast L1 Turn Undead")
    // doesn't match this dataset's Verit card at all on its face (vanilla
    // here is %MaxHP+8%/%MaxSp+8%, no DEF/combo/proc anywhere) — Ray
    // confirmed this is a WHOLLY NEW effect layered ON TOP of the existing
    // one, not a replacement/correction. Only the flat DEF+1 half is
    // automatable; "combo with Skull Ring" (an accessory ITEM, not a card)
    // only gates a skill-cast %chance (Turn Undead), which has no field
    // regardless of whether the combo condition is modeled — so no combo-
    // detection logic was needed here at all.
    "Verit": { n_A_DEF: 1 }, // new DEF+1 (existing %MaxHP/%MaxSP+8% untouched)
  };

  // Cards whose ENTIRE automated effect lives in an engine edit (foot.js),
  // with no STAT_DELTAS/CODE_DELTAS/REFINE_DELTAS entry needed at all —
  // listed here purely so the Project Baldur Adjustments summary shows
  // every automated card consistently, regardless of which mechanism
  // implements it.
  var ENGINE_EDIT_SUMMARY = {
    "Andre Egg": ["+5% MaxHP (5%->10%)"],
    "Yellow Novus": ["+2% MaxHP (changelog: \"Novus__Card\")"],
    "Baby Desert Wolf": ["+1% MATK (changelog: \"Desert_Wolf_Babe_Card\")"],
    "Howard Alt-Eisen": ["+6 ASPD (-5->1, changelog: \"Harword_Card\")"],
    "Firelock Soldier": ["Max HP/SP -1%"],
    "Kathryne Keyron": ["%MATK refine>=9 -> refine>=7 (changelog: \"Katrinn_Card\")"],
    // Gold Acidus's and Blue Acidus's engine-edit halves were confirmed and
    // implemented in foot.js long ago (see the header comment's engine-edit
    // list) but never actually got an ENGINE_EDIT_SUMMARY entry, so neither
    // ever showed up in this small delta panel — a real gap, found and
    // fixed 2026-07-07 while compiling the full-changelog reference table
    // below. Gold Acidus's unconditional %MaxHP/%MaxSP base (code15/16) is
    // separately handled in CODE_DELTAS above; this entry covers only its
    // refine<=4 "additional" engine-edit layer.
    "Gold Acidus": ["Refine <=4: additional MaxHP +5%, MaxSP +5%, HP/SP Recovery Rate +15% (was +4%/+4%/+5%)"],
    "Blue Acidus": ["SP Recovery Rate +15% (was +5%; refine<=4 in head1, unconditional in head2)"],
    // 2026-07-06: card.js data edits (not foot.js formula edits) — a slot
    // reassignment and two renames/reworks Ray approved as a card.js
    // exception, same basis as the foot.js engine edits above.
    "Baby Garm/Hatii": ["Moved from weapon to accessory slot (changelog: \"Garm_Baby_Card\")"],
    "Piere": ["Renamed from \"Andre Larva\" (changelog: drops from Piere instead of Andre; stats unchanged)"],
    "Deniro": ["Renamed from \"Soldier Andre\"; -30% dmg from Plant replaced with flat +30 DEF (changelog's \"Ant Hell card changes\" section)"],
  };

  // Race/element/size bonuses bypass the Additional Enchants UI entirely
  // (Ray's direction, 2026-07-06): the panel's vs-target slots are scarce
  // (found via investigation: ARG_RC0-3+A9_Skill0-3 are 4 single-use
  // OFFENSIVE slots — ATK/MATK/Long-range/Crit dmg vs one target each;
  // ARG_RC4-7+A9_Skill4-7 are 4 single-use DEFENSIVE resist-vs-target slots,
  // confirmed live by setting ARG_RC4+Ghost and watching n_A_element[8] move
  // — the UI's own visible text labels on that row belong to a DIFFERENT,
  // unrelated field sharing the same <tr>, not to ARG_RC4-7 itself) and
  // shared across every card that would want one. Rather than build slot
  // allocation, these deltas are injected directly into the engine's generic
  // per-code dispatch function (StPlusCard, called for every n_tok index
  // 1-210 inside StAllCalc — see the Noxious note below for how this generic
  // loop works) and shown ONLY in our own summary table; the visible
  // Additional Enchants fields are left untouched.
  //
  // Code numbering (confirmed via foot.js's StPlusCard + the "Player
  // Resistance" info-panel display function, KakutyouKansuu2's wKK==12
  // branch):
  //   30-39 = % ATK dmg vs race    (Formless,Undead,Brute,Plant,Insect,Fish,Demon,Demi-Human,Angel,Dragon)
  //   50-59 = % resist vs race     (same race order)
  //   60-69 = % resist vs element  (Neutral,Water,Earth,Fire,Wind,Poison,Holy,Shadow,Ghost,Undead)
  //   190/191/192 = % resist vs Small/Medium/Large size
  //   77/79 = % resist vs Boss/Normal
  var CODE_DELTAS = {
    // Mobster and Noxious moved here 2026-07-06 from the old field-writing
    // CARD_DELTAS (they already routed through this exact generic per-code
    // dispatch under the hood — ARG_RC42/45 were just a UI shortcut into the
    // SAME n_A_Buf9 slots StPlusCard's own codes feed — so no new mechanism
    // was needed, just moving the entry).
    // ARG_RC42 -> n_A_Buf9[57] -> n_tok[70] (the actual crit-damage-% used
    // in the damage formula) traced and confirmed live by reading n_tok[70]
    // directly — my first attempt showed "no effect" only because the one
    // sidebar text line I was checking doesn't redraw from a plain recalc,
    // not because the field is inert.
    // Mobster's OTHER effect (vanilla "[Thief class] CRIT+4", card ID 328)
    // was wrongly flagged "not reflected" in the changelog note below —
    // confirmed 2026-07-07 it's already fully computed by vanilla itself:
    // foot.js hardcodes `2==n_A_JobClass()&&(I+=4*CardNumSearch(328))`
    // feeding straight into `n_A_CRI+=I`. Live-verified: Thief + Mobster
    // equipped moves n_A_CRI from 1 to 5 (+4), no engine edit or delta entry
    // needed — the changelog doesn't change this value, just restates it.
    "Mobster": [{ code: 70, delta: 3, label: "+3% Crit Dmg (15%->18%)" }],
    // code78 ("% Long-range ATK and MATK based damage resistance") is
    // reached via the SAME generic dispatch loop that a narrow text search
    // for "n_tok[78] +=" missed entirely — Ray was right that the field
    // existed. Noxious's own vanilla contribution reads exactly 10
    // (matching the changelog's stated baseline).
    "Noxious": [{ code: 78, delta: 5, label: "+5% Long-range dmg resist (10%->15%)" }],
    // Wooden Golem/Yellow Novus's "HP recovery rate% not reflected" notes
    // were WRONG, corrected 2026-07-07 — the earlier "no field for item/
    // potion recovery%" policy (see the header comment near STAT_DELTAS)
    // conflated NATURAL HP regen (code75, which these cards actually use)
    // with potion/item healing effectiveness (which genuinely has no
    // field). code75 feeds `n_tok[75]` through the SAME generic StPlusCard
    // dispatch loop as every other CODE_DELTAS entry, straight into
    // `n_A_HPR` (foot.js: `I=100,I+=n_tok[75]+n_A_Buf9[45],...,
    // n_A_HPR=Math.floor(n_A_HPR*I/100)`) — a real, displayed stat. Confirmed
    // live with a boosted VIT/MaxHP to make the multiplier visible past
    // flooring: Wooden Golem alone moved n_A_HPR from 22 to 28 (+30%,
    // matching its unconditional vanilla base); patching code75 by a
    // further +20 moved it to 33 (+50% total), confirming the delta math.
    "Wooden Golem": [{ code: 75, delta: 20, label: "+20% HP Recovery Rate (30%->50%)" }],
    "Yellow Novus": [{ code: 75, delta: 10, label: "+10% HP Recovery Rate (10%->20%)" }],
    // Deviace (weapon card): vanilla already gives +7% ATK dmg vs Brute(32),
    // Plant(33), Insect(34), Demi-Human(37) via its own card codes — matches
    // [20,1,"Deviace",0,37,7,32,7,33,7,34,7,0] exactly. Changelog: "Changed
    // from 7% to demi, plant, insect and brute to 7% to all races." The vs-
    // race UI slot only supports one target at a time and has no "all races"
    // option, so per Ray's instruction this fills in the remaining 6 races
    // directly instead of fighting over a UI slot.
    "Deviace": [
      { code: 30, delta: 7, label: "+7% ATK dmg vs Formless" },
      { code: 31, delta: 7, label: "+7% ATK dmg vs Undead" },
      { code: 35, delta: 7, label: "+7% ATK dmg vs Fish" },
      { code: 36, delta: 7, label: "+7% ATK dmg vs Demon" },
      { code: 38, delta: 7, label: "+7% ATK dmg vs Angel" },
      { code: 39, delta: 7, label: "+7% ATK dmg vs Dragon" },
    ],
    // Permeter (shield): vanilla is Shadow(67)+15, Undead-element(69)+15
    // (confirmed via [347,2,"Permeter",0,67,15,69,15,0] — NOT Ghost as the
    // changelog's "Added in 15% to ghost" wording might suggest at a glance).
    // Ray confirmed this is a genuine ADDITION: Ghost(68)+15 on top of the
    // existing Shadow/Undead resists, not a correction to them.
    "Permeter": [
      { code: 68, delta: 15, label: "+15% resist vs Ghost" },
    ],
    // Whisper: vanilla Ghost(68) resist is -50 (a PENALTY — takes 50% extra
    // damage from Ghost-element attacks; confirmed via
    // [76,5,"Whisper",0,9,20,68,-50,0]). Changelog: "Removed -50% damage
    // from Ghost" = remove the penalty entirely (-50 -> 0, delta +50).
    "Whisper": [
      { code: 68, delta: 50, label: "+50% resist vs Ghost (removes vanilla -50% penalty)" },
    ],
    // Hodremlin: vanilla Small(190)/Medium(191)/Large(192) resist all +15
    // (confirmed via [467,3,"Hodremlin",...,190,15,191,15,192,15,0]).
    // Changelog raises Small and Large to 20; Medium explicitly untouched
    // ("medium unchanged because of PVP").
    "Hodremlin": [
      { code: 190, delta: 5, label: "+5% resist vs Small" },
      { code: 192, delta: 5, label: "+5% resist vs Large" },
    ],
    // Roween: vanilla Water(41, % ATK dmg vs element) is +10% (confirmed via
    // [480,5,"Roween",0,9,5,11,3,41,10,115,15,0]). Changelog raises this to
    // 15%. (Its other code, 115, isn't read anywhere in the damage formulas
    // — grepped for every n_tok[115] usage, found none — and the changelog
    // doesn't mention a second effect for this card, so it's left untouched.)
    "Roween": [
      { code: 41, delta: 5, label: "+5% ATK dmg vs Water" },
    ],

    // Batch 2 (2026-07-06):
    // Galion: vanilla Water(41, % ATK dmg vs element) is +5% (confirmed via
    // [490,7,"Galion",0,8,5,41,5,0] — same code Roween uses; cards stack
    // additively here same as vanilla RO card-code accumulation always does,
    // no conflict). Changelog raises to 10%.
    "Galion": [
      { code: 41, delta: 5, label: "+5% ATK dmg vs Water" },
    ],
    // Knocker: vanilla Formless(30, % ATK dmg vs race) is +5% (confirmed via
    // [473,2,"Knocker",...,30,5,0]). Changelog raises to 10%. The card's
    // other changelog effect ("0.1% -> 1% r.elu & r.ori drop rate") is a
    // drop-chance mechanic with no engine field — flagged to Ray rather than
    // silently dropped, left out per his standing instruction to surface
    // non-combat/non-stat effects rather than quietly omit them.
    "Knocker": [
      { code: 30, delta: 5, label: "+5% ATK dmg vs Formless" },
    ],
    // Venomous: has ZERO numeric codes in vanilla (pure self-poison proc,
    // confirmed via ["Venomous","When receiving ATK based damage, 30% chance
    // to cause [Poison] status effect on both yourself and your attacker.",0]
    // — no code/value pairs at all). Changelog adds Poison-element(65)
    // resistance +50% as a wholly new effect to offset the self-poison proc
    // — this is a clean addition, no existing baseline to preserve.
    "Venomous": [
      { code: 65, delta: 50, label: "+50% resist vs Poison" },
    ],
    // Parasite: deferred neutral-resist half resolved. Vanilla Neutral(60,
    // % resist vs element) is +5% (confirmed via
    // [358,3,"Parasite","",60,5,18,1,0] — code18=1 is the DEF part already
    // handled in STAT_DELTAS above). Changelog: "5% -> 10% neutral
    // reduction", baseline matches exactly. Delta +5.
    "Parasite": [
      { code: 60, delta: 5, label: "+5% resist vs Neutral" },
    ],
    // Munak (left/accessory slot): vanilla Earth(62, % resist vs element) is
    // +5% (confirmed via [125,3,"Munak",0,18,1,62,5,159,15,0] — code18=DEF+1
    // handled in STAT_DELTAS above). CORRECTION 2026-07-07: code159=15 was
    // originally mislabeled "Stone Curse status chance%" and dismissed as
    // not automatable — it's actually the SAME status-AILMENT-RESISTANCE
    // mechanism (codes 150-159) confirmed automatable for Red Novus/Skogul/
    // Flame Skull, just never retrofitted onto this card (or the rest of
    // the Coco/Stainer/Martin/Argos/Wootan/Ghoul/Megalodon cluster below —
    // all processed before that mechanism was discovered). Changelog:
    // "Removed stone curse and earth effects" — removes BOTH entirely
    // (Earth delta -5, Stone Curse delta -15). The changelog's OTHER new
    // effect ("Increased resistance to some Payon mobs by 30%") targets a
    // hand-picked monster list with no matching race/element/size/type
    // category this engine supports — still not automatable, still flagged
    // rather than silently dropped.
    "Munak": [
      { code: 62, delta: -5, label: "-5% resist vs Earth (removed)" },
      { code: 159, delta: -15, label: "-15% resist vs Stone Curse (removed)" },
    ],
    // Batch 4 (2026-07-07) — the rest of the "1->3 DEF, 20%->30% status"
    // cluster: every card here has an UNCONDITIONAL code in the 150-159
    // status-resist range at baseline 20 (confirmed via each card's own
    // m_Card entry), matching the changelog's stated status name and
    // baseline exactly except Argos (see below) — same correction as Munak
    // above, retrofitting the newly-discovered resist mechanism onto cards
    // processed before it was found. DEF halves already live in STAT_DELTAS.
    "Coco": [{ code: 155, delta: 10, label: "+10% resist vs Sleep" }],
    "Stainer": [{ code: 156, delta: 10, label: "+10% resist vs Silence" }],
    "Martin": [{ code: 154, delta: 10, label: "+10% resist vs Blind" }],
    "Ghoul": [{ code: 150, delta: 10, label: "+10% resist vs Poison" }],
    "Megalodon": [{ code: 152, delta: 10, label: "+10% resist vs Freeze" }],
    "Wootan Shooter": [{ code: 157, delta: 10, label: "+10% resist vs Confusion" }],
    "Wootan Fighter": [{ code: 158, delta: 10, label: "+10% resist vs Bleeding" }],
    // Argos: changelog says "20% -> 30% poison", but its actual code is 159
    // (Stone Curse, confirmed via [124,3,"Argos",0,18,1,159,20,0]), not 150
    // (Poison) — every other card in this cluster matches its stated status
    // exactly, only Argos doesn't. The baseline (20) does match, though, so
    // per Ray this is treated as a typo in the changelog's status name, not
    // a real mismatch — same class of imprecision as Wooden Golem's stale
    // DEF baseline.
    "Argos": [{ code: 159, delta: 10, label: "+10% resist vs Stone Curse" }],

    // MAJOR CORRECTION (2026-07-06): a status-AILMENT-resistance mechanism
    // DOES exist (codes 150-159, one per v_Effect entry: 150=Poison,
    // 151=Stun, 152=Freeze, 153=Curse, 154=Blind, 155=Sleep, 156=Silence,
    // 157=Chaos/Confusion, 158=Bleeding, 159=Stone Curse) — this overturns
    // the "no status field exists" assumption written into several earlier
    // comments in this file (Coco/Stainer/Martin cluster, Munak, etc.).
    // Confirmed live: manually setting n_tok[157]/[158] correctly moved the
    // Chaos/Bleeding resistance numbers shown by the "Player Resistance"
    // info panel (Other Info dropdown, KakutyouKansuu()'s wKK==12 branch —
    // NOT KakutyouKansuu2(), a same-prefixed but unrelated function that
    // handles a totally different dropdown case). This is DIFFERENT from
    // status-inflict CHANCE (the % chance to CAUSE a status on a target),
    // which still has no field — this is resistance to BEING afflicted.
    // Red Novus (= changelog's "Novus_Card", single underscore — a THIRD
    // Novus-family card distinct from Yellow Novus/"Novus__Card"): pure
    // self-Chaos proc card, no existing codes at all. Changelog: "added 50%
    // confusion resistance" to offset the self-inflicted Chaos.
    "Red Novus": [
      { code: 157, delta: 50, label: "+50% resist vs Confusion" },
    ],
    // Skogul: pure self-Bleeding proc card, no existing codes at all.
    // Changelog: "added 50% resistance to bleed" to offset the self-inflicted
    // Bleeding.
    "Skogul": [
      { code: 158, delta: 50, label: "+50% resist vs Bleeding" },
    ],
    // Archdam: vanilla has code73=20 (%Cast Time reduction — confirmed via
    // n_tok[73] feeding directly into the cast-time formula in foot.js:
    // "I += n_tok[73] - n_A_Buf9[26]", where n_A_Buf9[26] is ARG_RC86's raw
    // value; note the OPPOSITE sign convention between the two, which is why
    // this uses the CODE_DELTAS bypass rather than the ARG_RC86 UI field —
    // typing a positive number into ARG_RC86 would move cast time the WRONG
    // direction relative to how the card's own code73 contributes). Baseline
    // matches changelog's "-20% cast rate" exactly. Changelog: "-20% -> -10%
    // cast rate" — delta -10.
    "Archdam": [
      { code: 73, delta: -10, label: "-10% cast time reduction (20%->10%)" },
    ],

    // Batch 3 of the untriaged pile (2026-07-06):
    // Flame Skull: all 4 of its codes (151=Stun,153=Curse,154=Blind,159=
    // Stone Curse, confirmed via foot.js's status-resistance mechanism,
    // codes 150-159 — the same one Red Novus/Skogul use) read exactly 30
    // in vanilla, matching the changelog's stated baseline ("30%->50%
    // resistances") across the board. Delta +20 each.
    "Flame Skull": [
      { code: 151, delta: 20, label: "+20% resist vs Stun (30%->50%)" },
      { code: 153, delta: 20, label: "+20% resist vs Curse (30%->50%)" },
      { code: 154, delta: 20, label: "+20% resist vs Blind (30%->50%)" },
      { code: 159, delta: 20, label: "+20% resist vs Stone Curse (30%->50%)" },
    ],
    // Zombie Slaughter / Ragged Zombie: both share the identical pair of
    // codes 37 (%ATK dmg vs Demi-Human, confirmed via the standard 30-39
    // race-order numbering) and 177 (%MATK dmg vs Demi-Human — a SEPARATE
    // numbering range from the ATK series, confirmed via foot.js's info-
    // panel display string literally containing "...% vs</td><td>"+
    // v_Race[7]+"..." right after the `n_tok[177]+=` line, v_Race[7] =
    // Demi-Human), both baseline 1, matching the changelog's "1%->5% ATK%
    // and MATK% increase" on both cards exactly. Their other changelog
    // effects (a flat per-kill HP-recovery proc, and a PvE-mobs-only vs.
    // PvE+PvP scope narrowing) aren't automatable — proc/PvP-split, same
    // categories as Ice Titan/Thara Frog above — left out.
    "Zombie Slaughter": [
      { code: 37, delta: 4, label: "+4% ATK dmg vs Demi-Human (1%->5%)" },
      { code: 177, delta: 4, label: "+4% MATK dmg vs Demi-Human (1%->5%)" },
    ],
    "Ragged Zombie": [
      { code: 37, delta: 4, label: "+4% ATK dmg vs Demi-Human (1%->5%)" },
      { code: 177, delta: 4, label: "+4% MATK dmg vs Demi-Human (1%->5%)" },
    ],
    // Joker: current data (code220=27) is confirmed inert in the stat-calc
    // engine (zero hits anywhere in foot.js's n_tok consumption) — likely a
    // skill-grant flag consumed by an entirely different function, matching
    // the changelog's own "Added L1 Gank" skill text. Its "Take 20% more
    // damage from all races" is a wholly new debuff with no existing
    // baseline to cancel — applies -20 to all 10 race-resist codes (50-59).
    // Ray approved adding this despite the changelog itself flagging the
    // card "[Subject to further change or reversion]".
    "Joker": [
      { code: 50, delta: -20, label: "-20% resist vs Formless" },
      { code: 51, delta: -20, label: "-20% resist vs Undead" },
      { code: 52, delta: -20, label: "-20% resist vs Brute" },
      { code: 53, delta: -20, label: "-20% resist vs Plant" },
      { code: 54, delta: -20, label: "-20% resist vs Insect" },
      { code: 55, delta: -20, label: "-20% resist vs Fish" },
      { code: 56, delta: -20, label: "-20% resist vs Demon" },
      { code: 57, delta: -20, label: "-20% resist vs Demi-Human" },
      { code: 58, delta: -20, label: "-20% resist vs Angel" },
      { code: 59, delta: -20, label: "-20% resist vs Dragon" },
    ],

    // Agav: unconditional flat DEF-10 (code18, confirmed via
    // [476,4,"Agav","[Mage Class] SP+100",89,5,18,-10,0] — the code89=5 is
    // the Mage-only SP+100 hook, handled separately via JOB_CARD_DELTAS
    // below since it's job-gated; this DEF part is NOT job-gated at all).
    // Changelog: "-10 -> -3 DEF", delta +7.
    "Agav": [{ code: 18, delta: 7, label: "+7 DEF (-10->-3)" }],

    // Magmaring and Thara Frog investigated 2026-07-06, deliberately NOT
    // added:
    // - Magmaring: changelog says "5% -> 10% earth ele", but actual data
    //   already has Earth(42, % ATK dmg vs element) at 10% (confirmed via
    //   [483,5,"Magmaring",0,17,5,42,10,112,15,0]) — already at the
    //   changelog's stated target. Ray confirmed: no change needed (the "5%"
    //   baseline in the changelog is stale). (Its other code, 112, isn't
    //   read anywhere in the damage formulas and isn't in the changelog —
    //   left untouched regardless.)
    // - Thara Frog: vanilla is Demi-Human race resistance 30% (code57,
    //   confirmed via [56,3,"Thara Frog",0,57,30,0] — matches real RO's
    //   "reduces damage from Demi-Human monsters by 30%"). Changelog splits
    //   this into "30% vs mobs, reduced to 20% vs players (PvP)" — this
    //   calculator has no separate PvE/PvP race-resist split. Ray confirmed:
    //   this calc is PvE-only, leave at vanilla 30%, no delta.

    // Bucket C (2026-07-06) — Sting removes its vanilla unconditional DEF+2
    // (m_Card code18=2, a real generic code pair in its own array, applied
    // via the normal StPlusCard path) as part of a full rework. Canceled
    // here; its refine-conditional replacement lives in REFINE_DELTAS below.
    // CORRECTION 2026-07-07: Arclouze's DEF+2 was WRONGLY treated the same
    // way — its own m_Card array has NO code pairs at all (confirmed via
    // the raw data: `[222,3,"Arclouze","[Refine Rate 0~5] DEF +2, MDEF
    // +3",0]`, a bare "0" terminator). Its real DEF+2 is hardcoded by card
    // ID instead, and — unlike what the old CODE_DELTAS entry assumed — is
    // REFINE-GATED, not unconditional: `n_A_LEFT_REFINE<=5&&222==
    // n_A_card[10]&&(n_A_DEF+=2)`, sitting right next to the already-known
    // MDEF+3 refine-gated line. Canceling it as a flat -2 via CODE_DELTAS
    // was wrong at any refine above 5, where vanilla never granted the +2
    // in the first place — live-tested and confirmed: at refine 9, DEF
    // came out to -2 instead of 0. Moved into REFINE_DELTAS below so the
    // cancellation is refine-aware like the real vanilla check.
    "Sting": [{ code: 18, delta: -2, label: "-2 DEF (removed, card reworked)" }],

    // Chung E (garment): vanilla LUK-5 base (m_Card code6=-5, confirmed via
    // [402,5,"Chung E","<b>For each refine level:</b> LUK +1, CRIT +1",6,-5,0])
    // plus a per-refine-level LUK+1/CRIT+1 scaling hardcoded in foot.js
    // (`402 == n_A_card[12] && (I += n_A_SHOULDER_REFINE)` feeding n_A_CRI,
    // and a matching one feeding the STR/AGI/VIT/INT/DEX/LUK calc block for
    // LUK). Changelog only changes the BASE penalty ("-5 -> -3 LUK"); the
    // per-refine scaling rate itself is untouched, so this needs no
    // REFINE_DELTAS entry at all — just cancel-and-replace the base via
    // CODE_DELTAS. (The changelog's "[Safe rate is immediately +1]" aside is
    // about the refine-safety mechanic, unrelated to this card's stat
    // contribution — not modeled here.)
    "Chung E": [{ code: 6, delta: 2, label: "+2 LUK (base -5 -> -3)" }],
    // Seyren Windsor (headgear, selectable in BOTH head1 and head2 —
    // CORRECTED 2026-07-07, an earlier pass wrongly assumed head2-only and
    // called the per-refine scaling dead code): foot.js's only hardcoded
    // check (`180==n_A_card[8]&&(n+=n_A_HEAD_REFINE)`, STR+1/refine) is
    // keyed to head1 and IS live when equipped there. Doesn't matter for our
    // implementation either way, though: this scaling is a separate,
    // orthogonal mechanic from the code1 base-STR delta below (which applies
    // via the generic per-code dispatch regardless of slot) — the changelog
    // only touches the base penalty, so there's nothing to cancel or adjust
    // for the scaling — CODE_DELTAS only, no REFINE_DELTAS needed.
    "Seyren Windsor": [{ code: 1, delta: 2, label: "+2 STR (base -6 -> -4)" }],
    // Dimik (body): vanilla VIT-5 base (code3=-5, confirmed via
    // [198,4,"Dimik","<b>For each refine level:</b> VIT +1",3,-5,0]) plus a
    // per-refine-level VIT+1 scaling hardcoded in foot.js
    // (`198 == n_A_card[11] && (e += n_A_BODY_REFINE)`). Changelog: "-5 ->
    // null VIT" — reads as removing the base penalty entirely (delta = 0 -
    // (-5) = +5), leaving only the per-refine scaling untouched — same
    // pattern as Chung E/Seyren, CODE_DELTAS only.
    "Dimik": [{ code: 3, delta: 5, label: "+5 VIT (base -5 -> 0, removed)" }],
    // Tha Odium (= "Odium of Thanatos" in this data; shoes): vanilla AGI-5
    // base (code2=-5, confirmed via [406,6,"Odium of Thanatos","<b>For each
    // refine level:</b> AGI +1",2,-5,0]) plus a per-refine-level AGI+1
    // scaling hardcoded in foot.js (`406 == n_A_card[13] && (t +=
    // n_A_SHOES_REFINE)`). Changelog: "-5 -> -4 AGI", base only.
    "Odium of Thanatos": [{ code: 2, delta: 1, label: "+1 AGI (base -5 -> -4)" }],
    // Tha Despero (= "Despero of Thanatos" in this data; left/accessory):
    // vanilla INT-6 base (code4=-6, confirmed via [173,3,"Despero of
    // Thanatos","<b>For each refine level:</b> INT +1",4,-6,0]) plus a
    // per-refine-level INT+1 scaling hardcoded in foot.js (`173 ==
    // n_A_card[10] && (A += n_A_LEFT_REFINE)`). Changelog: "-6 -> -4 INT",
    // base only.
    "Despero of Thanatos": [{ code: 4, delta: 2, label: "+2 INT (base -6 -> -4)" }],

    // Gold Acidus (= changelog's "Acidus_Card"; shoes): its unconditional
    // %MaxHP/%MaxSP (code15=4, code16=4, confirmed via [407,6,"Gold
    // Acidus","[Refine Rate 0~4] Additional MaxHP +4%, MaxSP +4%, HP
    // Recovery Rate +5% and SP Recovery Rate +5%",15,4,16,4,0]) apply via
    // the normal generic StPlusCard path — cleanly patchable here, no engine
    // edit needed for this half. Changelog: "4% -> 5% SP HP" (the
    // unconditional base for both). The card's REFINE-CONDITIONAL "additional"
    // layers (a further +4%/+4% at refine<=4, PLUS a separate HP/SP recovery-
    // rate bonus) are a different story — see the foot.js edit note below.
    "Gold Acidus": [
      { code: 15, delta: 1, label: "+1% MaxHP (base 4% -> 5%)" },
      { code: 16, delta: 1, label: "+1% MaxSP (base 4% -> 5%)" },
    ],
  };

  // code -> total delta across all currently-equipped CODE_DELTAS cards;
  // recomputed fresh every recompute(). The patched StPlusCard below reads
  // this live, so updating this object alone is enough for the next A9(1)
  // recalc to pick up the change.
  var codeDeltaTotals = {};

  function patchStPlusCard() {
    if (typeof window.StPlusCard !== "function" || window.StPlusCard.__cesPatched) return;
    var original = window.StPlusCard;
    var patched = function (code) {
      return original(code) + (codeDeltaTotals[code] || 0);
    };
    patched.__cesPatched = true;
    window.StPlusCard = patched;
  }

  // Refine-tier-conditional bonuses (Bucket C): unlike the generic per-code
  // StPlusCard dispatch Bucket B uses, these are hardcoded directly by card
  // ID inside StAllCalc, e.g. (foot.js):
  //   n_A_BODY_REFINE <= 5 && 283 == n_A_card[11] && (n_A_DEF += 2)
  // There's no generic dispatch to hook here, so instead StAllCalc itself is
  // wrapped: call the original (which applies vanilla's own hardcoded
  // checks using VANILLA thresholds/values into the global n_A_DEF/n_A_MDEF/
  // n_A_STR/etc. variables), then immediately apply the difference between
  // what vanilla just added and what the custom ruleset wants, based on the
  // same refine-level global vanilla itself reads. This runs synchronously
  // before the rest of calc() uses those globals for damage math, same as
  // calc() itself calls StAllCalc() as its first step.
  //
  // Each entry's `apply(refine)` returns the DELTA (custom minus vanilla)
  // for each affected global, so it can be added directly regardless of
  // whether vanilla's own condition was met this refine level or not.
  var REFINE_DELTAS = {
    // Goat (body slot): vanilla refine<=5 gives DEF+2/MDEF+5 (confirmed via
    // foot.js: "n_A_BODY_REFINE <= 5 && 283 == n_A_card[11]"). Changelog
    // tightens the threshold to <=4 (per the changelog's global refine-easing
    // policy) and raises the values to DEF+5/MDEF+7.
    "Goat": {
      refineVar: "n_A_BODY_REFINE",
      apply: function (refine) {
        var vDEF = refine <= 5 ? 2 : 0, vMDEF = refine <= 5 ? 5 : 0;
        var nDEF = refine <= 4 ? 5 : 0, nMDEF = refine <= 4 ? 7 : 0;
        return { n_A_DEF: nDEF - vDEF, n_A_MDEF: nMDEF - vMDEF };
      },
    },
    // Megalith (shoes slot): vanilla refine<=5 gives MDEF+7 only (confirmed
    // via foot.js: "n_A_SHOES_REFINE <= 5 && 381 == n_A_card[13]"). Changelog
    // tightens the threshold to <=4 and adds VIT+2/DEF+4 under the same
    // condition (confirmed with Ray).
    "Megalith": {
      refineVar: "n_A_SHOES_REFINE",
      apply: function (refine) {
        var vMDEF = refine <= 5 ? 7 : 0;
        var nMDEF = refine <= 4 ? 7 : 0, nVIT = refine <= 4 ? 2 : 0, nDEF = refine <= 4 ? 4 : 0;
        return { n_A_MDEF: nMDEF - vMDEF, n_A_VIT: nVIT, n_A_DEF: nDEF };
      },
    },
    // Sting (left/accessory slot): vanilla refine>=9 gives MDEF+5 (confirmed
    // via foot.js: "n_A_LEFT_REFINE >= 9 && 310 == n_A_card[10]") — its
    // separate unconditional DEF+2 (code18) is canceled via CODE_DELTAS
    // above. Changelog reworks this entirely ("due to Ambernite and
    // Megaladon duplication"): the MDEF+5 is removed, replaced with +1 to
    // all 6 stats always, +1 more (total +2) at refine>=7 (confirmed with
    // Ray as a full replacement, not additive to the vanilla effect).
    "Sting": {
      refineVar: "n_A_LEFT_REFINE",
      apply: function (refine) {
        var vMDEF = refine >= 9 ? 5 : 0;
        var perStat = 1 + (refine >= 7 ? 1 : 0);
        return {
          n_A_MDEF: 0 - vMDEF,
          n_A_STR: perStat, n_A_AGI: perStat, n_A_VIT: perStat,
          n_A_INT: perStat, n_A_DEX: perStat, n_A_LUK: perStat,
        };
      },
    },
    // Arclouze (left/accessory slot): vanilla refine<=5 gives BOTH DEF+2
    // and MDEF+3 (confirmed via foot.js — both hardcoded by card ID under
    // the SAME refine<=5 condition: "n_A_LEFT_REFINE<=5&&222==n_A_card[10]
    // &&(n_A_DEF+=2)" and the matching MDEF+3 line). CORRECTION 2026-07-07:
    // an earlier pass wrongly treated the DEF+2 as a separate, unconditional
    // generic code (canceled via a flat CODE_DELTAS -2) — Arclouze's own
    // m_Card array actually has NO code pairs at all, so that DEF+2 was
    // never a generic code to begin with, and critically it's refine-gated
    // just like the MDEF. Canceling it unconditionally caused a real bug:
    // at refine 9 (above the threshold), DEF came out to -2 instead of 0,
    // subtracting a bonus vanilla never granted at that refine level.
    // Changelog: "Removed DEF. when +4 or less give 12 MDEF" — DEF is
    // removed at every refine level (cancel vDEF whenever it's vanilla-
    // active), threshold for the MDEF replacement tightens to <=4, value
    // rises to 12.
    "Arclouze": {
      refineVar: "n_A_LEFT_REFINE",
      apply: function (refine) {
        var vDEF = refine <= 5 ? 2 : 0;
        var vMDEF = refine <= 5 ? 3 : 0;
        var nMDEF = refine <= 4 ? 12 : 0;
        return { n_A_DEF: 0 - vDEF, n_A_MDEF: nMDEF - vMDEF };
      },
    },
    // Apocalypse (body): vanilla VIT+2 (code3, unaffected, unconditional)
    // plus a FLAT +800 MaxHP at refine>=9 (confirmed via foot.js:
    // "n_A_BODY_REFINE >= 9 && 225 == n_A_card[11] && (I += 800)", additive
    // into n_A_MaxHP — unlike Firelock Soldier's %-based bonus below, this
    // one is a plain global delta, cleanly patchable). Changelog only eases
    // the threshold to >=7 ("Reduced from +9 to +7"); the value is unchanged.
    "Apocalypse": {
      refineVar: "n_A_BODY_REFINE",
      apply: function (refine) {
        var vHP = refine >= 9 ? 800 : 0;
        var nHP = refine >= 7 ? 800 : 0;
        return { n_A_MaxHP: nHP - vHP };
      },
    },
    // Carat (headgear, position "2" in m_Card): vanilla INT+2 (code4,
    // unaffected) plus a description-only "%MaxSP+150 at refine>=9"
    // (`n_A_HEAD_REFINE >= 9 && 298 == n_A_card[8] && (I += 150)`) that only
    // checks n_A_card[8] (head1) — CORRECTION 2026-07-07: an earlier pass
    // wrongly concluded Carat can only equip in head2 (dropdown check at the
    // time only looked at one slot) and treated this as dead code entirely.
    // Ray caught the resulting bug: Carat is actually selectable in BOTH
    // head1 and head2 dropdowns, so vanilla's +150 check is very much real
    // when equipped in head1 — the old unconditional "+100, clean addition"
    // implementation was double-stacking with vanilla's own +150 in that
    // case (a live-tested +250 net swing at refine 9 in head1, instead of
    // the intended 150->100). Fixed to be slot-aware: cancel vanilla's real
    // +150 only when actually in head1 (n_A_card[8]), then add the new
    // value. In head2, vanilla's check still never fires (confirmed no
    // n_A_card[9]-keyed equivalent exists anywhere), so it stays a clean
    // addition there, matching the original head2 test results exactly.
    "Carat": {
      refineVar: "n_A_HEAD_REFINE",
      apply: function (refine) {
        var inHead1 = window.n_A_card && n_A_card[8] === 298;
        var vSP = inHead1 && refine >= 9 ? 150 : 0;
        var nSP = refine >= 7 ? 100 : 0;
        return { n_A_MaxSP: nSP - vSP };
      },
    },
    // Orc Baby (shoulder/garment slot): vanilla FLEE base 10 (code9,
    // unaffected) + additional FLEE+5 at refine>=9 (confirmed via foot.js:
    // "n_A_SHOULDER_REFINE >= 9 && 403 == n_A_card[12] && (n_A_FLEE += 5)",
    // a plain global add) PLUS a separate Neutral-element resist: base 10%
    // (code60, unaffected) + additional +5% at the SAME refine>=9 condition
    // (confirmed via foot.js: "... && (n_tok[60] += 5)"). Changelog only
    // gives explicit numbers for FLEE ("+10+5 -> +10+2 refine bonuses"), but
    // Ray confirmed both the FLEE and Neutral-resist +5 bonuses reduce to +2
    // together, with the same threshold easing to >=7 — the "n_tok60"
    // pseudo-key here is handled specially in patchStAllCalc below since
    // n_tok is an array, not a simple global.
    "Orc Baby": {
      refineVar: "n_A_SHOULDER_REFINE",
      apply: function (refine) {
        var vBonus = refine >= 9 ? 5 : 0;
        var nBonus = refine >= 7 ? 2 : 0;
        var delta = nBonus - vBonus;
        return { n_A_FLEE: delta, n_tok60: delta };
      },
    },
    // Gibbet (headgear, selectable in BOTH head1 and head2 — CORRECTED
    // 2026-07-07, an earlier pass wrongly assumed head2-only): foot.js has
    // TWO hardcoded checks, `213==n_A_card[9]&&(n_A_MDEF+=5)` (head2) and
    // `213==n_A_card[8]&&(n_A_MDEF+=5)` (head1) — IDENTICAL, both
    // unconditional +5, no refine gate on either. So unlike Carat (where the
    // two slots' checks genuinely differed and canceling the wrong one
    // caused real double-stacking), Gibbet's vanilla contribution is the
    // same flat +5 regardless of which head slot it's in — the `vMDEF=5`
    // constant below is correct either way, no slot-awareness needed.
    "Gibbet": {
      refineVar: "n_A_HEAD_REFINE",
      apply: function (refine) {
        var vMDEF = 5; // unconditional in vanilla (head2)
        var nMDEF = refine <= 4 ? 7 : 0;
        return { n_A_MDEF: nMDEF - vMDEF };
      },
    },
    // Ninetails (shoulder/garment slot): vanilla AGI+2 (code2, unaffected,
    // unconditional) plus FLEE+20 at refine>=9 (confirmed via foot.js:
    // "n_A_SHOULDER_REFINE >= 9 && 271 == n_A_card[12] && (n_A_FLEE += 20)",
    // a plain global add). Changelog: "Flee 20 -> 18 (total amount is 20
    // with 2 agi)" — the card's own hardcoded FLEE contribution drops from
    // 20 to 18, with the AGI+2 (which itself converts to +2 FLEE via the
    // normal AGI-to-FLEE stat formula) keeping the PERCEIVED total at 20.
    // Threshold also eases to >=7 per the global refine-easing policy.
    "Ninetails": {
      refineVar: "n_A_SHOULDER_REFINE",
      apply: function (refine) {
        var vFLEE = refine >= 9 ? 20 : 0;
        var nFLEE = refine >= 7 ? 18 : 0;
        return { n_A_FLEE: nFLEE - vFLEE };
      },
    },
    // Remover (body slot; = changelog's "Removal_Card" — likely just a
    // naming variant): vanilla flat MaxHP+800 (code13, unaffected,
    // unconditional) MINUS 40*refine, unconditionally scaling (no
    // threshold at all, confirmed via foot.js: "186 == n_A_card[11] &&
    // (I -= 40 * n_A_BODY_REFINE)", in the additive MaxHP phase — clean
    // global, no engine edit needed). Changelog: "-40 -> -20 per refine
    // rate HP reduced" — halves the per-refine penalty. Per Ray's explicit
    // instruction, the changelog's separate "10% -> 20% HP recovery" note
    // is SKIPPED — this card has zero existing HP-recovery mechanic
    // anywhere in the data or engine (confirmed via an exhaustive search for
    // every reference to card ID 186), so implementing it would mean adding
    // a wholly new hardcoded line rather than editing an existing one, and
    // the changelog itself flags this card "[May rework]" as unsettled.
    "Remover": {
      refineVar: "n_A_BODY_REFINE",
      apply: function (refine) {
        var vHP = -40 * refine;
        var nHP = -20 * refine;
        return { n_A_MaxHP: nHP - vHP };
      },
    },
  };

  // "Every 18/15 stat" armor cluster (Obsidian/Egnigem Cenia/Venatu/Ancient
  // Mimic/Mistress of Shelter/Observation, all body slot): vanilla forms 3
  // independent mirror pairs, each granting +1 to a stat per every 18 points
  // of a DIFFERENT base stat (all confirmed via foot.js, e.g. "185==
  // n_A_card[11]&&(e+=Math.floor(SU_DEX/18))" — e is the local var that
  // n_A_VIT+=e later reads, confirmed by tracing all six n_A_STR/AGI/VIT/
  // INT/DEX/LUK+=<letter> lines). SU_STR/AGI/VIT/INT/DEX/LUK are a snapshot
  // of the character's BASE stat (1*c.A_STR.value etc.) taken once at the
  // very start of StAllCalc, before any card bonus block runs and never
  // touched again — confirmed via foot.js ("...,SU_STR=n_A_STR,..." sits
  // immediately after the raw n_A_STR=1*c.A_STR.value line). That means it's
  // safe to read these globals AFTER calling the original StAllCalc() below,
  // and — importantly — there's no circular feedback even though the
  // changelog's new mapping forms one full 6-card cycle (each card reads a
  // FROZEN pre-bonus snapshot, not another card's output):
  //   Obsidian(185): SU_DEX/18 -> VIT      Egnigem Cenia(187): SU_INT/18 -> STR
  //   Venatu(189): SU_AGI/18 -> LUK        Ancient Mimic(191): SU_LUK/18 -> AGI
  //   Mistress of Shelter(196): SU_STR/18 -> INT   Observation(197): SU_VIT/18 -> DEX
  // Changelog reworks all 6 at once into a single cycle (STR->DEX->VIT->AGI->
  // INT->LUK->STR) at every 15 points instead of 18 — a genuine source AND
  // target reassignment per card, not a value tweak (Ray: "do all 6 as one
  // batch"):
  //   Egnigem Cenia: SU_STR/15 -> DEX   Mistress of Shelter: SU_DEX/15 -> VIT
  //   Obsidian: SU_VIT/15 -> AGI        Observation: SU_AGI/15 -> INT
  //   Venatu: SU_INT/15 -> LUK          Ancient Mimic: SU_LUK/15 -> STR
  // Venatu happens to keep the same TARGET (LUK) as vanilla; Ancient Mimic
  // happens to keep the same SOURCE (LUK) as vanilla — handled generically
  // (remove the old target's vanilla contribution, add the new target's
  // contribution; when old/new target is the same stat the two deltas
  // collapse into one net delta on that single global automatically).
  var STAT_CONVERSION_DELTAS = {
    "Egnigem Cenia": { oldSrc: "SU_INT", oldDst: "n_A_STR", newSrc: "SU_STR", newDst: "n_A_DEX" },
    "Mistress of Shelter": { oldSrc: "SU_STR", oldDst: "n_A_INT", newSrc: "SU_DEX", newDst: "n_A_VIT" },
    "Obsidian": { oldSrc: "SU_DEX", oldDst: "n_A_VIT", newSrc: "SU_VIT", newDst: "n_A_AGI" },
    "Observation": { oldSrc: "SU_VIT", oldDst: "n_A_DEX", newSrc: "SU_AGI", newDst: "n_A_INT" },
    "Venatu": { oldSrc: "SU_AGI", oldDst: "n_A_LUK", newSrc: "SU_INT", newDst: "n_A_LUK" },
    "Ancient Mimic": { oldSrc: "SU_LUK", oldDst: "n_A_AGI", newSrc: "SU_LUK", newDst: "n_A_STR" },
  };

  function statConversionDelta(rule) {
    var oldVal = window[rule.oldSrc] || 0;
    var newVal = window[rule.newSrc] || 0;
    var oldContribution = Math.floor(oldVal / 18);
    var newContribution = Math.floor(newVal / 15);
    var delta = {};
    delta[rule.oldDst] = (delta[rule.oldDst] || 0) - oldContribution;
    delta[rule.newDst] = (delta[rule.newDst] || 0) + newContribution;
    return delta;
  }

  // Bucket D (job-conditional), investigated and implemented 2026-07-06.
  // `n_A_JobClass()` is a plain global function (safe to call anytime after
  // the original StAllCalc() has run, same as reading any other post-hoc
  // global) — vanilla's own hardcoded checks compare it directly, e.g.
  // `5==n_A_JobClass()&&(I-=100*CardNumSearch(474))` for Banshee. Confirmed
  // job IDs directly from each card's own flavor text/changelog wording:
  // 5=Mage (Banshee/Agav's own "[Mage Class]" text), 1=Swordsman (matches
  // Echio's changelog "for swordsman"). All three hardcoded lines below sit
  // in the SAME clean additive MaxHP/MaxSP phases already confirmed safe by
  // Remover/Apocalypse/Alarm (e.g. Echio's own line sits immediately next to
  // Remover's `186==n_A_card[11]` line in the exact same comma-expression
  // block) — no engine edit needed, just a job-gated delta like everything
  // else here.
  // Fur Seal's OTHER changelog line ("Class CRIT 9->10 vs Undead/Demon,
  // Acolyte only") — corrected 2026-07-07, the original "zero engine hook"
  // conclusion above was WRONG (found via a narrow literal-text search for
  // `CardNumSearch(253)` alone, which missed a match sitting inside a
  // longer comma expression). The real hook: foot.js's `n_A_CRI` block has
  // `3!=n_A_JobClass()||1!=n_B[2]&&6!=n_B[2]||(I+=9*CardNumSearch(253))`
  // feeding straight into `n_A_CRI+=I` — `n_B[2]` is the selected target
  // monster's race (v_Race index; 1=Undead, 6=Demon), confirmed live:
  // Acolyte+Fur Seal equipped moves n_A_CRI from 1 to 10 (+9) against an
  // Undead target (Archer Skeleton) AND a Demon target (Aliot), and drops
  // back to +0 with a non-Acolyte job. Same "job-conditional" shape as
  // Banshee/Agav/Echio below, just also gated on the selected enemy's race.
  var JOB_CARD_DELTAS = {
    // Banshee: Mage-only MaxHP-100 -> MaxHP-20 (changelog only touches this
    // half; its MaxSP+100 and skill-dmg% aren't mentioned, left alone).
    "Banshee": { job: 5, global: "n_A_MaxHP", vanilla: -100, custom: -20 },
    // Agav: Mage-only MaxSP+100 -> +200. Its DEF-10->-3 is a SEPARATE,
    // UNCONDITIONAL change (not job-gated at all) — handled via CODE_DELTAS
    // above instead (code18, delta+7).
    "Agav": { job: 5, global: "n_A_MaxSP", vanilla: 100, custom: 200 },
    // Echio: Swordsman-only MaxHP+500 -> +750.
    "Echio": { job: 1, global: "n_A_MaxHP", vanilla: 500, custom: 750 },
    // Fur Seal: Acolyte-only, vs Undead(1)/Demon(6) target race, CRIT+9 -> +10.
    "Fur Seal": { job: 3, races: [1, 6], global: "n_A_CRI", vanilla: 9, custom: 10 },
  };

  function jobCardDelta(rule) {
    if ((window.n_A_JobClass && n_A_JobClass()) !== rule.job) return null;
    if (rule.races && (!window.n_B || rule.races.indexOf(n_B[2]) === -1)) return null;
    var delta = {};
    delta[rule.global] = rule.custom - rule.vanilla;
    return delta;
  }

  var GLOBAL_LABELS = {
    n_A_DEF: "DEF", n_A_MDEF: "MDEF", n_A_STR: "STR", n_A_AGI: "AGI",
    n_A_VIT: "VIT", n_A_INT: "INT", n_A_DEX: "DEX", n_A_LUK: "LUK",
    n_A_MaxHP: "MaxHP", n_A_MaxSP: "MaxSP", n_A_FLEE: "FLEE",
    n_A_HIT: "HIT", n_A_LUCKY: "Perfect Dodge", n_A_CRI: "Crit Rate",
    n_A_ATK: "ATK",
    n_tok60: "%resist vs Neutral",
  };

  // Multi-card combo bonuses: unlike everything else here, these depend on
  // 2 SPECIFIC cards being equipped simultaneously, not any single card.
  //
  // Mini-boss FLEE combos: initially misread as "2+ of these 6 cards
  // together" (which is impossible — all 6 share the single garment card
  // slot). Ray corrected this: each of the 6 actually combos with its OWN
  // DIFFERENT partner card, confirmed by calling the live tool's own
  // tooltip-builder (`Click_Card(id)` -> reads `#B_SETUMEI`) for each:
  //   Mastering + Poring, Eclipse + Lunatic, Vagabond Wolf + Wolf,
  //   Toad + Roda Frog, Dragon Fly + Chonchon, Vocal + Rocker
  // — all genuinely FLEE+18 per the tooltip. Each partner is confirmed
  // equipped in a DIFFERENT slot type (weapon/body/shoes) than the garment
  // slot the 6 "mini-boss" cards share, so every pair IS achievable
  // simultaneously in practice (unlike my first, wrong reading).
  // CORRECTION: initially concluded (from a literal-text grep for
  // "n_tok[90]") that the underlying w_SC/code90 machinery was tooltip-only
  // with no real numeric effect — this was WRONG. Direct empirical testing
  // proved it out: n_tok[90] genuinely DOUBLES (16 -> 32, confirmed live)
  // when both cards in a pair are equipped (each card's own code90 entry
  // independently contributes the same w_SC row-index value via the generic
  // StPlusCard dispatch), and n_A_FLEE genuinely jumps by +18 when this
  // happens — verified with an isolated before/after diff, and confirmed
  // it's specific to the real pair (Mastering+Rocker, an unrelated
  // combination, produces zero change). Could not locate the exact
  // consuming line despite an exhaustive text search (grepped every literal
  // "[90]" occurrence and every "StPlusCard(90)" call in foot.js/head.js —
  // it's likely a computed/indirect array access a literal-text search can't
  // catch), but pinpointing it isn't necessary: since vanilla reliably
  // contributes +18 whenever the pair is active, the fix is just the DELTA
  // (20-18=+2) on top of vanilla's own real contribution, not a flat +20 —
  // confirmed this lands on the correct total (20) via live testing.
  // Steel Chonchon + Chonchon (2026-07-07): the ONE genuine gap found in a
  // full 169-entry raw-changelog cross-reference — "Combo function added
  // with Chonchon_Card: 3% ASPD" had zero existing engine hook anywhere
  // (confirmed: no CardNumSearch(74)/CardNumSearch(88) hit at all, no code90
  // combo-marker on either card's own m_Card entry — a wholly NEW effect,
  // unlike the mini-boss FLEE combos which were pre-existing vanilla
  // behavior this project just needed to top up). Live-verified equip
  // slots don't conflict: Steel Chonchon is body, Chonchon is shoes.
  // Needed a real engine edit, not a delta — same trap as Howard Alt-Eisen:
  // raw ASPD gets discarded/transformed by the time StAllCalc returns, so
  // there's no final-ASPD global to patch post-hoc. Traced Howard Alt-
  // Eisen's own insertion point further this time and found it's not flat
  // ASPD at all — it's the source for a %-based equipment-ASPD term
  // (`var E=I` right after the accumulator, then
  // `percentAspdEquipment=(195-n_A_ASPD)*(E/100)`) — so this combo's "3%"
  // slots into the exact same accumulator Howard Alt-Eisen already uses.
  // Inserted `CardNumSearch(74)&&CardNumSearch(88)&&(I+=3)` immediately
  // after Howard Alt-Eisen's own `159==n_A_card[3]&&(I+=6)` line in
  // foot_2026-04-06.js. Live-verified: displayed ASPD stays flat with just
  // one of the two cards equipped (150.3, matching baseline), jumps
  // 150.5->153.5 (a clean +3) only when BOTH are equipped together, and
  // Steel Chonchon alone contributes nothing on its own — confirming the
  // combo gate works and neither card carries the bonus independently.
  // Unlike the FLEE combos, the engine edit produces the FULL effect
  // directly (no separate top-up delta needed on top of an existing
  // vanilla contribution) — apply() returns {} on purpose, this entry
  // exists purely so the combo shows up in the summary panels.
  var COMBO_DELTAS = [
    { pair: ["Mastering", "Poring"] },
    { pair: ["Eclipse", "Lunatic"] },
    { pair: ["Vagabond Wolf", "Wolf"] },
    { pair: ["Toad", "Roda Frog"] },
    { pair: ["Dragon Fly", "Chonchon"] },
    { pair: ["Vocal", "Rocker"] },
  ].map(function (rule) {
    rule.apply = function () { return { n_A_FLEE: 2 }; }; // delta on top of vanilla's real +18 (18->20)
    rule.label = "+2 FLEE (combo: " + rule.pair[0] + " + " + rule.pair[1] + ", 18->20)";
    return rule;
  }).concat([
    {
      pair: ["Steel Chonchon", "Chonchon"],
      apply: function () { return {}; }, // full effect is baked into the engine edit itself
      label: "+3% ASPD (combo: Steel Chonchon + Chonchon, new)",
    },
  ]);

  // n_tokNN pseudo-keys address window.n_tok[NN] (an array element) rather
  // than a simple window[name] global — everything else in REFINE_DELTAS so
  // far only needed plain globals, Orc Baby's Neutral-resist half is the
  // first to need this.
  function applyGlobalDelta(name, amount) {
    var m = /^n_tok(\d+)$/.exec(name);
    if (m) {
      if (window.n_tok) window.n_tok[+m[1]] += amount;
      return;
    }
    if (typeof window[name] === "number") window[name] += amount;
  }

  function describeRefineDelta(delta) {
    var parts = [];
    for (var g in delta) {
      if (delta[g]) parts.push((delta[g] > 0 ? "+" : "") + delta[g] + " " + (GLOBAL_LABELS[g] || g));
    }
    return parts;
  }

  function patchStAllCalc() {
    if (typeof window.StAllCalc !== "function" || window.StAllCalc.__cesPatched) return;
    var original = window.StAllCalc;
    var patched = function () {
      var result = original.apply(this, arguments);
      var names = equippedCardNames();
      for (var s = 0; s < names.length; s++) {
        var statDelta = STAT_DELTAS[names[s]];
        if (!statDelta) continue;
        for (var gs in statDelta) {
          if (statDelta[gs]) applyGlobalDelta(gs, statDelta[gs]);
        }
      }
      for (var i = 0; i < names.length; i++) {
        var rule = REFINE_DELTAS[names[i]];
        if (!rule) continue;
        var refine = window[rule.refineVar] || 0;
        var delta = rule.apply(refine);
        for (var g in delta) {
          if (delta[g]) applyGlobalDelta(g, delta[g]);
        }
      }
      for (var s2 = 0; s2 < names.length; s2++) {
        var convRule = STAT_CONVERSION_DELTAS[names[s2]];
        if (!convRule) continue;
        var convDelta = statConversionDelta(convRule);
        for (var gc in convDelta) {
          if (convDelta[gc]) applyGlobalDelta(gc, convDelta[gc]);
        }
      }
      for (var j1 = 0; j1 < names.length; j1++) {
        var jobRule = JOB_CARD_DELTAS[names[j1]];
        if (!jobRule) continue;
        var jobDelta = jobCardDelta(jobRule);
        if (!jobDelta) continue;
        for (var gj in jobDelta) {
          if (jobDelta[gj]) applyGlobalDelta(gj, jobDelta[gj]);
        }
      }
      for (var c1 = 0; c1 < COMBO_DELTAS.length; c1++) {
        var combo = COMBO_DELTAS[c1];
        var hasBoth = names.indexOf(combo.pair[0]) >= 0 && names.indexOf(combo.pair[1]) >= 0;
        if (!hasBoth) continue;
        var comboDelta = combo.apply();
        for (var g2 in comboDelta) {
          if (comboDelta[g2]) applyGlobalDelta(g2, comboDelta[g2]);
        }
      }
      refreshMaxHPMaxSPDisplay();
      return result;
    };
    patched.__cesPatched = true;
    window.StAllCalc = patched;
  }

  // n_A_MaxHP/n_A_MaxSP are the only two "Your Character" stats whose
  // on-screen text is written via myInnerHtml("A_MaxHP"/"A_MaxSP", ...)
  // INSIDE StAllCalc itself (right after their own late-stage multiplicative
  // skill/status modifiers), not by calc() afterward the way DEF/STR/etc.
  // are — confirmed via foot.js: `n_A_MaxHP>=100?n_A_MaxHP>=1e4?myInnerHtml(...)
  // :myInnerHtml(...):myInnerHtml(...)` and the analogous MaxSP line. Since
  // every delta mechanism here applies its deltas to window.n_A_MaxHP/
  // n_A_MaxSP AFTER the original StAllCalc() call has already returned (and
  // therefore after that DOM write already ran with the pre-patch value),
  // the "Your Character" panel silently kept showing the stale vanilla
  // number for every card that touches MaxHP/MaxSP (Savage, Alarm, Freezer,
  // Apocalypse, Remover, Echio, Banshee, Carat) even though the underlying
  // global — and therefore anything else that reads it — was always
  // correct. Re-invoking myInnerHtml here with the exact same formatting
  // rules vanilla uses (padding under 100/10000) fixes the display without
  // touching foot.js. Called unconditionally at the end of every recalc
  // (cheap, and always keeps the display in sync regardless of which
  // mechanism, if any, touched these two stats this cycle).
  function refreshMaxHPMaxSPDisplay() {
    if (typeof window.myInnerHtml !== "function") return;
    var hp = window.n_A_MaxHP;
    if (typeof hp === "number") {
      myInnerHtml("A_MaxHP", hp >= 100 ? (hp >= 1e4 ? " " + hp : hp) : " " + hp, 0);
    }
    var sp = window.n_A_MaxSP;
    if (typeof sp === "number") {
      myInnerHtml("A_MaxSP", sp >= 100 ? sp : " " + sp, 0);
    }
  }

  function activeCombos(names) {
    var active = [];
    for (var i = 0; i < COMBO_DELTAS.length; i++) {
      var combo = COMBO_DELTAS[i];
      if (names.indexOf(combo.pair[0]) >= 0 && names.indexOf(combo.pair[1]) >= 0) active.push(combo.label);
    }
    return active;
  }

  var CARD_SLOTS = [
    "A_weapon1_card1", "A_weapon1_card2", "A_weapon1_card3", "A_weapon1_card4",
    "A_weapon2_card1", "A_weapon2_card2", "A_weapon2_card3", "A_weapon2_card4",
    "A_head1_card", "A_head2_card", "A_body_card", "A_left_card",
    "A_shoulder_card", "A_shoes_card", "A_acces1_card", "A_acces2_card",
  ];

  // Nothing here writes to the Additional Enchants fields (2026-07-06 — see
  // the file header), so this script itself has no reason to force that
  // panel open — theme-payon.js does that instead, for an unrelated reason
  // (Ray wants the panel permanently visible with no collapse/hide option
  // at all, not just open by default). The Project Baldur Adjustments panel
  // only needs "A9TD" (the toggle row's own <td>, always present) to
  // position itself, regardless of which script is responsible for the
  // real panel's open state.

  function equippedCardNames() {
    var names = [];
    for (var i = 0; i < CARD_SLOTS.length; i++) {
      var sel = form[CARD_SLOTS[i]];
      if (!sel || sel.selectedIndex < 0) continue;
      var opt = sel.options[sel.selectedIndex];
      if (opt && opt.value !== "0") names.push(opt.text.trim());
    }
    return names;
  }

  // Full static reference table (added 2026-07-07, per Ray's request): shows
  // EVERY automated card's complete final effect, grouped by equip slot then
  // alphabetically — unlike the small delta-only panel above/below it, this
  // doesn't depend on what's currently equipped. "full" combines the card's
  // unaffected vanilla stats with the new patched values into one final
  // reading (e.g. Carat's own INT+2 plus its patched MaxSP bonus); "delta"
  // is the change from vanilla, matching the small panel's convention.
  // Conditional effects use a consistent bracket-tag convention: [Refine +N]
  // for refine-gated bonuses, [Mage only]/[Swordsman only] for job-gated
  // ones, [+ PartnerName] for the mini-boss FLEE combos. Slot data for every
  // card below was confirmed live (not assumed from m_Card's unreliable
  // "position" field) via the same CARD_SLOTS dropdown-membership check used
  // throughout this project. Two real gaps found and fixed while compiling
  // this: Gold Acidus's refine-conditional engine-edit layer and Blue Acidus
  // entirely were missing from ENGINE_EDIT_SUMMARY (never showed up in the
  // small delta panel either) — both added there too.
  var FULL_CHANGELOG = [
    { slot: "Headgear", cards: [
      { name: "Banshee", full: "[Mage only] MaxSP +100, MaxHP -20 (Soul Strike/Napalm Beat/Napalm Vulcan dmg +20%)", delta: "MaxHP -100 -> -20 (Mage only)" },
      { name: "Blue Acidus", full: "MaxSP +40 · [Refine ≤4] MaxSP +40, SP Recovery Rate +15%", delta: "SP Recovery Rate 5% -> 15% (refine ≤4)" },
      { name: "Carat", full: "INT +2 · [Refine +7] MaxSP +100", delta: "Refine +9 -> +7, 150 -> 100 SP" },
      { name: "Coco", full: "DEF +3, Sleep resist +30%", delta: "+2 DEF (1 -> 3), +10% Sleep resist (20% -> 30%)" },
      { name: "Ghoul", full: "DEF +3, Poison resist +30%", delta: "+2 DEF (1 -> 3), +10% Poison resist (20% -> 30%)" },
      { name: "Gibbet", full: "[Refine ≤4] MDEF +7", delta: "MDEF +5 (unconditional) -> +7 (refine ≤4 only)" },
      { name: "Kathryne Keyron", full: "Cast Time -1%/refine · [Refine +7] MATK +2%", delta: "Refine +9 -> +7 (value unchanged)" },
      { name: "Knocker", full: "ATK dmg vs Formless +10% (0.1%->1% Elunium/Oridecon drop chance)", delta: "+5% (5% -> 10%)" },
      { name: "Martin", full: "DEF +3, Blind resist +30%", delta: "+2 DEF (1 -> 3), +10% Blind resist (20% -> 30%)" },
      { name: "Permeter", full: "+15% resist vs Shadow, Undead, Ghost", delta: "+15% Ghost (new)" },
      { name: "Seyren Windsor", full: "STR -4 base, +1 STR per refine level", delta: "Base STR -6 -> -4" },
      { name: "Stainer", full: "DEF +3, Silence resist +30%", delta: "+2 DEF (1 -> 3), +10% Silence resist (20% -> 30%)" },
      { name: "Wootan Fighter", full: "DEF +3, Bleeding resist +30%", delta: "+2 DEF (1 -> 3), +10% Bleeding resist (20% -> 30%)" },
      { name: "Wootan Shooter", full: "DEF +3, Confusion resist +30%", delta: "+2 DEF (1 -> 3), +10% Confusion resist (20% -> 30%)" },
    ]},
    { slot: "Weapon", cards: [
      { name: "Cecil Damon", full: "ASPD +5%, HIT +3", delta: "+33 HIT (-30 -> 3)" },
      { name: "Deviace", full: "ATK dmg +7% vs all races", delta: "Was Brute/Plant/Insect/Demi-Human only" },
      { name: "Female Thief Bug", full: "AGI +2, FLEE +1", delta: "+1 AGI (1 -> 2)" },
      { name: "Fur Seal", full: "HIT +12, FLEE +4, [Acolyte only] CRIT +10 vs Undead/Demon", delta: "+2 HIT (10->12), +1 FLEE (3->4), +1 CRIT vs Undead/Demon (9->10, Acolyte only)" },
      { name: "Golem", full: "ATK +15", delta: "+10 ATK (5 -> 15)" },
      { name: "Hornet", full: "STR +1, ATK +10", delta: "+7 ATK (3 -> 10)" },
      { name: "Howard Alt-Eisen", full: "HIT +30, ASPD +1 (was -5)", delta: "+6 ASPD" },
      { name: "Lunatic", full: "LUK +3, Crit Rate +1, Perfect Dodge +1", delta: "+2 LUK (1 -> 3)" },
      { name: "Mobster", full: "Crit Dmg +18%, [Thief only] CRIT+4", delta: "+3% (15% -> 18%)" },
      { name: "Mutant Dragonoid", full: "ATK +20 (grants Fireball skill, L3->L5 per changelog)", delta: "+5 ATK (15 -> 20)" },
      { name: "Piere", full: "INT +1, MaxSP +10 (renamed from Andre Larva)", delta: "Renamed, now drops from Piere" },
      { name: "Soldier Skeleton", full: "Crit Rate +10", delta: "+1 (9 -> 10)" },
      { name: "Stone Shooter", full: "ATK +15, HIT +15", delta: "+5 ATK, +5 HIT (10 -> 15 each)" },
      { name: "Zenorc", full: "ATK +12", delta: "+2 ATK (10 -> 12)" },
    ]},
    { slot: "Body", cards: [
      { name: "Agav", full: "DEF -3 · [Mage only] MaxSP +200", delta: "+7 DEF (-10 -> -3); MaxSP +100 -> +200 (Mage only)" },
      { name: "Alicel", full: "FLEE +10, DEF penalty removed (was -5)", delta: "+5 DEF" },
      { name: "Ancient Mimic", full: "LUK/15 -> STR +1 (cycle)", delta: "Reassigned: was LUK/18->AGI, now LUK/15->STR" },
      { name: "Apocalypse", full: "VIT +2 · [Refine +7] MaxHP +800", delta: "Refine +9 -> +7 (value unchanged)" },
      { name: "Archdam", full: "ATK +10, Cast time -10%", delta: "-10% (was -20%)" },
      { name: "Baby Desert Wolf", full: "INT +1, MATK +1%", delta: "+1% MATK (new)" },
      { name: "Baby Leopard", full: "Perfect Dodge +3 ([Merchant only] armor unbreakable)", delta: "LUK +3 removed, Perfect Dodge +3 added" },
      { name: "Cornutus", full: "DEF +5 (armor unbreakable)", delta: "+4 DEF (1 -> 5)" },
      { name: "Dimik", full: "VIT +0 base, +1 VIT per refine level", delta: "Base VIT -5 -> 0 (removed)" },
      { name: "Echio", full: "ATK +15, [Swordsman only] MaxHP +750", delta: "+500 -> +750 (Swordsman only)" },
      { name: "Egnigem Cenia", full: "STR/15 -> DEX +1 (cycle)", delta: "Reassigned: was INT/18->STR, now STR/15->DEX" },
      { name: "Goat", full: "[Refine ≤4] DEF +5, MDEF +7", delta: "Refine ≤5 -> ≤4; DEF+2/MDEF+5 -> DEF+5/MDEF+7" },
      { name: "Mineral", full: "ATK -5, DEF +7", delta: "+20 ATK (-25 -> -5), +4 DEF (3 -> 7)" },
      { name: "Mistress of Shelter", full: "DEX/15 -> VIT +1 (cycle)", delta: "Reassigned: was STR/18->INT, now DEX/15->VIT" },
      { name: "Obsidian", full: "VIT/15 -> AGI +1 (cycle)", delta: "Reassigned: was DEX/18->VIT, now VIT/15->AGI" },
      { name: "Observation", full: "AGI/15 -> INT +1 (cycle)", delta: "Reassigned: was VIT/18->DEX, now AGI/15->INT" },
      { name: "Red Novus", full: "Confusion resist +50% (offsets a 30% self-Chaos proc, not otherwise reflected)", delta: "+50% (new)" },
      { name: "Remover", full: "MaxHP +800 base, -20/refine", delta: "-40/refine -> -20/refine" },
      { name: "Savage", full: "VIT +5, MaxHP +200", delta: "+2 VIT (3 -> 5), +200 MaxHP (new)" },
      { name: "Skogul", full: "Bleeding resist +50% (offsets a 30% self-Bleeding proc, not otherwise reflected)", delta: "+50% (new)" },
      { name: "Steel Chonchon", full: "DEF +2, Wind resist +10% · [+ Chonchon] ASPD +3%", delta: "combo +3% ASPD (new, w/ Chonchon)" },
      { name: "Super Picky", full: "VIT +3, MaxHP +100", delta: "+2 VIT (1 -> 3)" },
      { name: "Thief Bug", full: "AGI +1, FLEE +4", delta: "+4 FLEE (new)" },
      { name: "Venatu", full: "INT/15 -> LUK +1 (cycle)", delta: "Reassigned: was AGI/18->LUK, now INT/15->LUK" },
      { name: "Venomous", full: "Poison resist +50% (offsets a 30% self-Poison proc, not otherwise reflected)", delta: "+50% (new)" },
      { name: "Waste Stove", full: "INT +1, ATK +10", delta: "+5 ATK (5 -> 10)" },
      { name: "Wooden Golem", full: "DEF +5, HP Recovery Rate +50%", delta: "+4 DEF (1 -> 5), +20% HP Recovery Rate (30% -> 50%)" },
      { name: "Yellow Novus", full: "MaxHP +500, MaxHP +2%, HP Recovery Rate +20%", delta: "+2% MaxHP (new), +10% HP Recovery Rate (10% -> 20%)" },
    ]},
    { slot: "Left hand / shield", cards: [
      { name: "Ambernite", full: "DEF +7, MDEF +3", delta: "+5 DEF (2 -> 7), +3 MDEF (new)" },
      { name: "Andre Egg", full: "MaxHP +10%", delta: "+5% (new)" },
      { name: "Argos", full: "DEF +3, Stone Curse resist +30%", delta: "+2 DEF (1 -> 3), +10% Stone Curse resist (20% -> 30%)" },
      { name: "Arclouze", full: "[Refine ≤4] MDEF +12", delta: "Removed base DEF+2; MDEF 3 (≤5) -> 12 (≤4)" },
      { name: "Deniro", full: "DEF +30 (renamed from Soldier Andre)", delta: "Plant resist +30 removed, flat DEF +30 added" },
      { name: "Despero of Thanatos", full: "INT -4 base, +1 INT per refine level", delta: "Base INT -6 -> -4" },
      { name: "Flame Skull", full: "+50% resist vs Stun, Curse, Blind, Stone Curse (also 5% chance each to inflict these on your attacker when hit)", delta: "+20% each (30% -> 50%)" },
      { name: "Hodremlin", full: "+20% resist vs Small/Large, +15% vs Medium (also 0.3% chance for temporary +30 Perfect Dodge for 10s)", delta: "+5% Small, +5% Large (Medium unchanged)" },
      { name: "Megalodon", full: "DEF +3, Freeze resist +30%", delta: "+2 DEF (1 -> 3), +10% Freeze resist (20% -> 30%)" },
      { name: "Munak", full: "DEF +3 (Earth and Stone Curse resist removed; +30% resist vs some Payon mobs)", delta: "+2 DEF (1 -> 3); Earth and Stone Curse resist removed" },
      { name: "Parasite", full: "DEF +2, Neutral resist +10%", delta: "+1 DEF (1 -> 2), +5% Neutral (5% -> 10%)" },
      { name: "Sting", full: "All stats +1 · [Refine +7] +1 more (total +2)", delta: "Reworked (was DEF+2, MDEF+5 at refine ≥9)" },
      { name: "Tamruan", full: "DEF +3 (10%->25% more dmg with Shield Charge/Boomerang)", delta: "+1 DEF (2 -> 3)" },
    ]},
    { slot: "Garment / shoulder", cards: [
      { name: "Baphomet Jr.", full: "AGI +3, Crit Rate +1, FLEE +5", delta: "+5 FLEE (new)" },
      { name: "Choco", full: "FLEE +15, Perfect Dodge +5 (banana juice/Provoke skill)", delta: "+5 FLEE (10 -> 15)" },
      { name: "Chung E", full: "LUK -3 base, +1 LUK / +1 Crit Rate per refine level", delta: "Base LUK -5 -> -3" },
      { name: "Dragon Fly", full: "AGI +2 · [+ Chonchon] FLEE +20", delta: "+1 AGI (1 -> 2); combo +2 FLEE (18 -> 20)" },
      { name: "Eclipse", full: "VIT +2 · [+ Lunatic] FLEE +20", delta: "+1 VIT (1 -> 2); combo +2 FLEE (18 -> 20)" },
      { name: "Mastering", full: "LUK +2 · [+ Poring] FLEE +20", delta: "+1 LUK (1 -> 2); combo +2 FLEE (18 -> 20)" },
      { name: "Ninetails", full: "AGI +2 · [Refine +7] FLEE +18", delta: "Refine +9->+7, FLEE 20->18 (AGI+2 keeps total at 20)" },
      { name: "Noxious", full: "Neutral resist +10%, Long-range dmg resist +15%", delta: "+5% (10% -> 15%)" },
      { name: "Orc Baby", full: "FLEE +10, Neutral resist +10% · [Refine +7] both +2 more", delta: "Refine +9 -> +7, bonus +5 -> +2 (both FLEE and Neutral)" },
      { name: "Roween", full: "FLEE +5, Perfect Dodge +3, ATK dmg vs Water +15%", delta: "+5% (10% -> 15%)" },
      { name: "Toad", full: "Perfect Dodge +3 · [+ Roda Frog] FLEE +20", delta: "+2 Perfect Dodge (1 -> 3); combo +2 FLEE (18 -> 20)" },
      { name: "Vagabond Wolf", full: "STR +2 · [+ Wolf] FLEE +20", delta: "+1 STR (1 -> 2); combo +2 FLEE (18 -> 20)" },
      { name: "Vocal", full: "MDEF +5 · [+ Rocker] FLEE +20", delta: "+2 MDEF (3 -> 5); combo +2 FLEE (18 -> 20)" },
      { name: "Whisper", full: "FLEE +20, Ghost resist penalty removed (was -50%)", delta: "+50% resist (removes vanilla -50% penalty)" },
    ]},
    { slot: "Shoes", cards: [
      { name: "Alarm", full: "VIT +1, MaxHP +400", delta: "+100 (300 -> 400)" },
      { name: "Chonchon", full: "FLEE +2, AGI +3 · [+ Dragon Fly] FLEE +20 · [+ Steel Chonchon] ASPD +3%", delta: "+2 AGI (1 -> 3); combo +2 FLEE (18 -> 20, w/ Dragon Fly); combo +3% ASPD (new, w/ Steel Chonchon)" },
      { name: "Freezer", full: "MaxHP +400 (+10% dmg with Bash at refine 9-10)", delta: "+100 (300 -> 400)" },
      { name: "Gold Acidus", full: "MaxHP/MaxSP +5% · [Refine ≤4] +5% more each, HP/SP Recovery Rate +15%", delta: "Base 4% -> 5%; additional layer 4% -> 5%, recovery 5% -> 15%" },
      { name: "Ice Titan", full: "VIT +5 (0.3%->5% chance for temporary +10->15 DEF for 10s)", delta: "+3 VIT (2 -> 5)" },
      { name: "Male Thief Bug", full: "AGI +3, FLEE +2", delta: "+1 AGI (2 -> 3), +2 FLEE (new)" },
      { name: "Megalith", full: "[Refine ≤4] MDEF +7, VIT +2, DEF +4", delta: "Refine ≤5 -> ≤4; added VIT+2/DEF+4" },
      { name: "Odium of Thanatos", full: "AGI -4 base, +1 AGI per refine level", delta: "Base AGI -5 -> -4" },
      { name: "Raggler", full: "STR +2, VIT +2", delta: "+1 STR (1 -> 2), +1 VIT (1 -> 2)" },
      { name: "Verit", full: "MaxHP +8%, MaxSP +8%, DEF +1 (3% chance to cast Turn Undead via Skull Ring combo)", delta: "+1 DEF (new)" },
      { name: "Wild Rose", full: "AGI +1, LUK +1, [Thief only] Perfect Dodge +5", delta: "+1 LUK (new)" },
      { name: "Zombie Slaughter", full: "+5% ATK/MATK dmg vs Demi-Human (50->100 HP per kill proc)", delta: "+4% each (1% -> 5%)" },
    ]},
    { slot: "Accessory", cards: [
      { name: "Baby Garm/Hatii", full: "(moved from weapon to accessory slot)", delta: "Slot reassignment only" },
      { name: "Galion", full: "HIT +5, ATK dmg vs Water +10%", delta: "+5% (5% -> 10%)" },
      { name: "Joker", full: "All race resist -20% (grants Gank skill, 7% auto-steal)", delta: "-20% each (new debuff, vs all 10 races)" },
      { name: "Ragged Zombie", full: "+5% ATK/MATK dmg vs Demi-Human (0.1%->2% Bleeding-on-hit chance)", delta: "+4% each (1% -> 5%)" },
      { name: "Shinobi", full: "AGI +1, Perfect Dodge +1 (cloak/Shuriken proc-on-hit)", delta: "+1 (new)" },
      { name: "Spore", full: "VIT +3", delta: "+1 VIT (2 -> 3)" },
      { name: "Tarou", full: "STR +2, ATK +2", delta: "+2 (new)" },
      { name: "Wormtail", full: "DEX +2, HIT +5", delta: "+5 (new)" },
      { name: "Zhu Po Long", full: "AGI +1, Crit Rate +4", delta: "+1 (3 -> 4)" },
    ]},
  ];

  // Static (equip-independent) — built once and left alone, unlike the
  // delta panel above which rebuilds on every recompute(). Targets the
  // static #fullChangelogSection container in index.html (a normal
  // <div class="main">, not position:absolute like the small per-equip
  // delta panel) — this table is too large (~100 rows) to float in a
  // margin without either overflowing or overlapping whatever page content
  // comes after it, so it lives in normal document flow as its own section
  // instead, same as every other major section on the page. Single real
  // <table> throughout (not one table per slot group) so the name/full/
  // delta columns stay aligned across every group instead of each group
  // sizing its columns independently.
  // Highlights the [Refine +7] / [Mage only] / [+ PartnerName] condition
  // tags used throughout FULL_CHANGELOG's "full" strings — present in the
  // approved mockup but lost when the plain-text data was written out, since
  // nothing wrapped the bracketed portion in its own span. Every tag in this
  // data is a single bracketed clause with no nested brackets, so a plain
  // global regex swap is safe.
  function highlightTags(text) {
    return text.replace(/\[([^\]]+)\]/g, '<span class="ces-fc-tag">[$1]</span>');
  }

  function ensureFullChangelogTable() {
    var container = document.getElementById("fullChangelogSection");
    if (!container || container.__cesBuilt) return;
    container.__cesBuilt = true;
    var rows = ['<div class="ces-fc-heading">Card</div>'];
    // Explicit <colgroup> widths, not just CSS on the <td>s — needed because
    // the slot-header rows below use a single colspan=3 cell, which breaks
    // table-layout:fixed's usual "read widths off the first row" column
    // sizing (confirmed live: without this, .ces-card rendered at ~268px
    // despite its CSS width being set to 110px).
    rows.push('<table class="ces-fc-table"><colgroup><col class="ces-fc-col-card">' +
      '<col class="ces-fc-col-full"><col class="ces-fc-col-delta"></colgroup><tbody>');
    for (var i = 0; i < FULL_CHANGELOG.length; i++) {
      var group = FULL_CHANGELOG[i];
      rows.push('<tr class="ces-fc-slot"><td colspan="3">' + group.slot + "</td></tr>");
      for (var j = 0; j < group.cards.length; j++) {
        var c = group.cards[j];
        rows.push(
          '<tr><td class="ces-card">' + c.name + '</td><td class="ces-fc-full">' + highlightTags(c.full) +
          '</td><td class="ces-fc-delta">' + c.delta + "</td></tr>"
        );
      }
    }
    rows.push("</tbody></table>");
    container.innerHTML = rows.join("");
  }

  // --- dedicated summary panel, floating in the wide unused margin to the
  // right of the Equipment & Cards column (that column only uses ~600px of
  // its ~999px-wide container, confirmed via live inspection — not nested
  // in the Additional Enchants table anymore, so the real panel keeps its
  // full original width/colspan). Built once and left in the DOM as a
  // sibling of the Additional Enchants panel, absolutely positioned within
  // their shared container so it scrolls naturally with the page; contents
  // AND vertical position both get refreshed on every recompute(), since the
  // Additional Enchants row's own position shifts around whenever a card
  // tooltip or other content above it changes height (a first version that
  // only positioned once at creation went stale/misaligned as soon as that
  // happened — caught via live pixel measurement, not visually obvious).
  function ensureSummaryColumn() {
    var panel = document.getElementById("cesSummaryPanel");
    var a9td = document.getElementById("A9TD");
    if (!panel) {
      var container = (a9td && a9td.closest(".main")) || document.body;
      panel = document.createElement("div");
      panel.id = "cesSummaryPanel";
      panel.className = "ces-summary";
      panel.innerHTML =
        '<div class="ces-summary-title">Project Baldur Adjustments</div>' +
        '<table class="ces-summary-table"><tbody id="cesSummaryBody"></tbody></table>';
      container.appendChild(panel);
    }

    // Line up its top edge with the Additional Enchants toggle row, in
    // container-relative coordinates (container is position:relative).
    var toggleRow = a9td && a9td.closest("tr");
    if (toggleRow) {
      var containerBox = panel.parentElement.getBoundingClientRect();
      var rowBox = toggleRow.getBoundingClientRect();
      panel.style.top = Math.round(rowBox.top - containerBox.top) + "px";
    }
    return panel.querySelector("#cesSummaryBody");
  }

  function renderSummary(perCard, combos) {
    var body = ensureSummaryColumn();
    if (!body) return;
    var rows = [];
    var cardNames = Object.keys(perCard).sort();
    for (var i = 0; i < cardNames.length; i++) {
      var name = cardNames[i];
      var entry = perCard[name];
      var parts = [];
      var stat = entry.stat || {};
      for (var g in stat) {
        var label = GLOBAL_LABELS[g] || g;
        var v = stat[g];
        parts.push((v > 0 ? "+" : "") + v + " " + label);
      }
      var codes = entry.codes || [];
      for (var j = 0; j < codes.length; j++) parts.push(codes[j].label);
      var refineParts = entry.refine || [];
      for (var k = 0; k < refineParts.length; k++) parts.push(refineParts[k]);
      var convParts2 = entry.conversion || [];
      for (var cp = 0; cp < convParts2.length; cp++) parts.push(convParts2[cp]);
      var jobParts = entry.job || [];
      for (var jp = 0; jp < jobParts.length; jp++) parts.push(jobParts[jp]);
      var engineParts = entry.engine || [];
      for (var e = 0; e < engineParts.length; e++) parts.push(engineParts[e]);
      rows.push(
        '<tr><td class="ces-card">' + name + "</td><td class=\"ces-vals\">" + parts.join(", ") + "</td></tr>"
      );
    }
    for (var m = 0; combos && m < combos.length; m++) {
      rows.push('<tr><td class="ces-card">Combo</td><td class="ces-vals">' + combos[m] + "</td></tr>");
    }
    body.innerHTML = rows.length
      ? rows.join("")
      : '<tr><td colspan="2" class="ces-empty">(no changed cards equipped)</td></tr>';
  }

  function recompute() {
    // Nothing here writes to any Additional Enchants field anymore — every
    // mechanism (STAT_DELTAS, CODE_DELTAS, REFINE_DELTAS, COMBO_DELTAS)
    // patches the engine directly via the patched StAllCalc/StPlusCard, so
    // this function's only jobs are: (1) refresh codeDeltaTotals (read live
    // by the patched StPlusCard), (2) rebuild the summary display, and
    // (3) force a recalc so the just-changed equip state is reflected
    // immediately rather than waiting for some other trigger.
    var perCard = {};
    var names = equippedCardNames();

    for (var i = 0; i < names.length; i++) {
      var statDelta = STAT_DELTAS[names[i]];
      if (!statDelta) continue;
      perCard[names[i]] = perCard[names[i]] || {};
      perCard[names[i]].stat = statDelta;
    }

    // Bypass-UI code-level deltas (race/element/size bonuses, and Mobster/
    // Noxious's crit-dmg/long-range-resist). StPlusCard reads
    // codeDeltaTotals live, so refreshing this object is all that's needed
    // for the next recalc to pick the change up.
    var newCodeTotals = {};
    for (var i2 = 0; i2 < names.length; i2++) {
      var entries = CODE_DELTAS[names[i2]];
      if (!entries) continue;
      perCard[names[i2]] = perCard[names[i2]] || {};
      perCard[names[i2]].codes = entries;
      for (var e = 0; e < entries.length; e++) {
        newCodeTotals[entries[e].code] = (newCodeTotals[entries[e].code] || 0) + entries[e].delta;
      }
    }
    codeDeltaTotals = newCodeTotals;

    // Refine-conditional deltas (Bucket C) — purely for the display text;
    // the actual math is applied by the patched StAllCalc regardless. This
    // label can go stale if refine changes without touching a card slot,
    // which is why the refine-level inputs are also bound to recompute()
    // (see REFINE_FIELDS below).
    for (var i3 = 0; i3 < names.length; i3++) {
      var rule = REFINE_DELTAS[names[i3]];
      if (!rule) continue;
      var refine = window[rule.refineVar] || 0;
      var delta = rule.apply(refine);
      var parts = describeRefineDelta(delta);
      perCard[names[i3]] = perCard[names[i3]] || {};
      perCard[names[i3]].refine = parts.length
        ? parts
        : ["no change at current refine (+" + refine + ")"];
    }

    // "Every 18/15 stat" armor cluster — purely for the display text; the
    // actual math is applied by the patched StAllCalc regardless. Reads the
    // same SU_* base-stat snapshot the patch itself uses, so this can go
    // stale if a base stat input changes without also touching a card slot,
    // same caveat as the REFINE_DELTAS labels above (not re-bound to the
    // stat inputs since those already trigger a full recalc, and this
    // calculator recomputes the summary on every card-slot/refine change,
    // which is the common case for these cards).
    for (var i5 = 0; i5 < names.length; i5++) {
      var convRule2 = STAT_CONVERSION_DELTAS[names[i5]];
      if (!convRule2) continue;
      var convDelta2 = statConversionDelta(convRule2);
      var convParts = describeRefineDelta(convDelta2);
      perCard[names[i5]] = perCard[names[i5]] || {};
      perCard[names[i5]].conversion = convParts.length ? convParts : ["no change"];
    }

    // Bucket D (job-conditional) — purely for the display text (the real
    // math is always correct regardless of trigger, same as REFINE_DELTAS,
    // since StAllCalc is patched directly). A_JOB and B_Enemy (needed for
    // Fur Seal's race gate) are both bound to recompute() below so this
    // text doesn't go stale when job/target changes without a card re-equip.
    for (var i6 = 0; i6 < names.length; i6++) {
      var jobRule2 = JOB_CARD_DELTAS[names[i6]];
      if (!jobRule2) continue;
      var jobDelta2 = jobCardDelta(jobRule2);
      perCard[names[i6]] = perCard[names[i6]] || {};
      perCard[names[i6]].job = jobDelta2
        ? describeRefineDelta(jobDelta2)
        : ["no change (conditional bonus not currently active — check job" +
           (jobRule2.races ? "/target race" : "") + ")"];
    }

    // Cards whose entire effect is a pure engine edit (no delta to compute
    // at all — just a static label for display consistency).
    for (var i4 = 0; i4 < names.length; i4++) {
      var engineLines = ENGINE_EDIT_SUMMARY[names[i4]];
      if (!engineLines) continue;
      perCard[names[i4]] = perCard[names[i4]] || {};
      perCard[names[i4]].engine = engineLines;
    }

    renderSummary(perCard, activeCombos(names));
    if (typeof window.A9 === "function") window.A9(1);
  }

  function bindSlot(name) {
    var sel = form[name];
    if (!sel || sel.__cesBound) return;
    sel.__cesBound = true;
    sel.addEventListener("change", recompute);
  }

  // Refine-level inputs relevant to REFINE_DELTAS (Bucket C): the actual
  // damage math stays correct without this (StAllCalc is patched directly
  // and reapplies on every recalc regardless of what triggered it), but
  // without rebinding these too, the summary table's displayed refine-based
  // labels go stale whenever refine changes without also touching a card
  // slot. These already have their own onchange handlers that trigger the
  // engine's real recalc — adding our own listener alongside doesn't
  // interfere with that, it just also refreshes our summary text.
  var REFINE_FIELDS = [
    "A_Weapon_refine", "A_HEAD_REFINE", "A_LEFT_REFINE",
    "A_BODY_REFINE", "A_SHOULDER_REFINE", "A_SHOES_REFINE",
    // A_JOB/B_Enemy added 2026-07-07 for JOB_CARD_DELTAS (Bucket D): keeps
    // the summary text fresh when job or target monster changes without
    // also touching a card slot — needed once Fur Seal added a race-gated
    // (B_Enemy-dependent) rule alongside the plain job-gated ones.
    "A_JOB", "B_Enemy",
  ];

  function bindRefineField(name) {
    var el = form[name];
    if (!el || el.__cesBound) return;
    el.__cesBound = true;
    el.addEventListener("change", recompute);
  }

  function sweep() {
    for (var i = 0; i < CARD_SLOTS.length; i++) bindSlot(CARD_SLOTS[i]);
    for (var j = 0; j < REFINE_FIELDS.length; j++) bindRefineField(REFINE_FIELDS[j]);
    recompute(); // panel may have just been rebuilt (fields + our column reset)
  }

  // Card slots get destroyed/recreated by the engine (job change, dual-wield
  // toggle), same as the item/weapon selects combobox.js deals with — rebind
  // whenever the form's DOM shifts. This also catches the Additional
  // Enchants panel itself being toggled closed/open, since that rebuild
  // wipes out our summary <td> too.
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; sweep(); });
  }).observe(form, { childList: true, subtree: true });

  // LoadLocal() (Local Load) and URLIN() (URL-hash character import, still
  // reachable even with the "Load URL" button removed — see index.html)
  // both set dozens of fields via direct .value assignment in one giant
  // comma-expression, never dispatching "change" events, so bindSlot()'s
  // listeners never fire. Both DO call the (already-patched) StAllCalc()
  // themselves at the end, so the underlying math/globals are always
  // correct — confirmed live: n_A_VIT/n_A_MaxHP matched the equipped
  // values exactly after a Local Load — but recompute() (which rebuilds
  // the Project Baldur Adjustments panel from equippedCardNames()) was
  // never triggered, so the panel kept showing stale/empty state, making
  // it look like every automation had silently stopped working even
  // though the character's actual stats were correct the whole time. Same
  // wrap-original-then-call-mine pattern as theme-payon.js's LoadTheme
  // wrapper.
  function wrapForcedRecompute(name) {
    if (typeof window[name] !== "function" || window[name].__cesPatched) return;
    var original = window[name];
    var patched = function () {
      var result = original.apply(this, arguments);
      recompute();
      return result;
    };
    patched.__cesPatched = true;
    window[name] = patched;
  }

  patchStPlusCard();
  patchStAllCalc();
  wrapForcedRecompute("LoadLocal");
  wrapForcedRecompute("URLIN");
  sweep();
  ensureFullChangelogTable();
})();
