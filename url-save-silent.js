// Silences the "URL copied to Clipboard." popup that the vanilla engine's
// URLOUT() fires at the end of its work (see foot_2026-04-06.js: it does
// URL_TEXT.value=... , clipboard.writeText(...) , location.replace(...) ,
// alert("URL copied to Clipboard. ...")). Ray wants the Save-as-URL button to
// copy silently -- the field still fills and the clipboard/address bar still
// update, only the confirmation dialog is dropped.
//
// Engine file stays untouched; we wrap URLOUT and, ONLY for the duration of
// that one call, swallow the specific clipboard-confirmation alert. Any other
// alert (e.g. a genuine engine error) still gets through. Same
// wrap-original-then-restore pattern as card-enchant-sync.js's URLIN wrapper
// and theme-payon.js's LoadTheme wrapper.
(function () {
  "use strict";
  if (typeof window.URLOUT !== "function" || window.URLOUT.__silentCopy) return;

  var originalURLOUT = window.URLOUT;
  var patched = function () {
    var realAlert = window.alert;
    window.alert = function (msg) {
      // Drop only the copy-confirmation dialog; let everything else through.
      if (typeof msg === "string" && msg.indexOf("URL copied to Clipboard") !== -1) return;
      return realAlert.apply(window, arguments);
    };
    try {
      return originalURLOUT.apply(this, arguments);
    } finally {
      window.alert = realAlert;
    }
  };
  patched.__silentCopy = true;
  window.URLOUT = patched;
})();
