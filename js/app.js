/* ========== arranque ========== */
"use strict";

function initApp() {
  loadDB();

  $("#brand-home").addEventListener("click", () => {
    const m = curMatch();
    if (m && m.status === "live") saveDB();
    showHome();
  });

  $$("#tabbar button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

  /* guarda al salir */
  window.addEventListener("beforeunload", () => saveDB());
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveDB(); });

  /* si quedó un partido en vivo, entrar directo */
  const live = App.db.matches.find(x => x.status === "live");
  if (live) {
    live.running = false;   // el reloj no corre solo al reabrir
    App.matchId = live.id;
    showGame();
  } else {
    showHome();
  }
}

document.addEventListener("DOMContentLoaded", initApp);

/* PWA: la app queda instalable y funciona sin señal */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(e => console.warn("SW no registrado", e));
  });
}
