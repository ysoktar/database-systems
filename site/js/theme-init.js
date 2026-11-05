// Applied before first paint so a stored light/dark choice never flashes.
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) { /* storage unavailable: follow the OS setting */ }
})();
