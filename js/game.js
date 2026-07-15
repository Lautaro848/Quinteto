/* ========== partido en vivo ========== */
"use strict";

let clockTimer = null;
let lastTickTs = null;
let lastClockSave = 0;

/* ---- reloj ---- */
function startClockLoop() {
  if (clockTimer) return;
  lastTickTs = performance.now();
  clockTimer = setInterval(() => {
    const m = curMatch();
    if (!m || !m.running) return;
    const now = performance.now();
    const dt = (now - lastTickTs) / 1000;
    lastTickTs = now;
    m.clockSec = Math.max(0, m.clockSec - dt);
    if (now - lastClockSave > 5000) { saveDB(); lastClockSave = now; }
    updateClockDisplay(m);
    if (m.clockSec <= 0) {
      m.running = false;
      saveDB();
      toast("⏰ Fin del " + qLabel(m.quarter), { hot: true });
      if (App.tab === "game") renderGameScreen();
    }
  }, 250);
}

function toggleClock(m) {
  m.running = !m.running;
  lastTickTs = performance.now();
  saveDB();
  renderScoreboardInto($("#scoreboard"), m);
}

function updateClockDisplay(m) {
  const c = $("#sb-clock-txt");
  if (c) c.textContent = fmtClock(m.clockSec);
}

/* ---- pantalla de partido ---- */
function showGame() {
  const m = curMatch();
  if (!m) return showHome();
  if (m.status === "setup") return showSetup();
  App.screen = "game";
  App.ui.sel = null;
  App.ui.subIn = null;
  App.ui.pendingShot = null;
  $("#tabbar").classList.remove("hidden");
  startClockLoop();
  setTab(App.tab || "game");
}

function setTab(tab) {
  App.tab = tab;
  $$("#tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const m = curMatch();
  $("#topbar-info").textContent = m ? (m.teams.A.name + " vs " + m.teams.B.name) : "";
  if (tab === "game") renderGameScreen();
  else if (tab === "stats") renderStatsScreen();
  else if (tab === "shots") renderShotsScreen();
  else if (tab === "timeline") renderTimelineScreen();
  else if (tab === "report") renderReportScreen();
}

function renderGameScreen() {
  const m = curMatch();
  if (!m) return showHome();
  const root = $("#screen");
  root.innerHTML = "";

  const sb = el("div", { id: "scoreboard" });
  renderScoreboardInto(sb, m);
  root.append(sb);

  /* dirección de ataque */
  const dir = el("div", { class: "dir-bar" });
  renderDirBar(dir, m);
  root.append(dir);

  /* banca A / cancha / banca B */
  const stats = computeStats(m);
  root.append(benchRow(m, "A", stats));

  const wrap = el("div", { class: "court-wrap" });
  const svg = createCourtSVG({ onTap: (x, y, e) => onCourtTap(m, x, y, e, wrap) });
  paintHoops(svg, m, m.quarter);
  drawAttackArrows(svg, m, m.quarter);
  renderLiveShots(svg, m);
  wrap.append(svg);
  root.append(wrap);

  root.append(benchRow(m, "B", stats));

  /* barra de acciones */
  const bar = el("div", { id: "action-bar-wrap" });
  renderActionBar(bar, m);
  root.append(bar);

  /* fin de cuarto / partido */
  if (m.clockSec <= 0 && m.status === "live") root.append(quarterEndCard(m));
}

/* ---- marcador ---- */
function renderScoreboardInto(sb, m) {
  const s = computeStats(m);
  sb.innerHTML = "";

  const teamBox = t => el("div", { class: "sb-team" },
    el("div", { class: "name" },
      el("span", { class: "team-dot", style: { background: m.teams[t].color } }),
      (m.teams[t].emoji ? m.teams[t].emoji + " " : "") + m.teams[t].name),
    el("div", { class: "pts" }, String(s.score[t]))
  );

  sb.append(el("div", { class: "sb-main" },
    teamBox("A"),
    el("div", { class: "sb-mid" },
      el("div", { class: "sb-q" }, qLabel(m.quarter) + (m.status === "finished" ? " · FINAL" : "")),
      el("div", { class: "sb-clock", id: "sb-clock-txt", onclick: () => m.status === "live" && editClockModal(m) }, fmtClock(m.clockSec))
    ),
    teamBox("B")
  ));

  if (m.status === "live") {
    sb.append(el("div", { class: "sb-controls" },
      el("button", { class: "btn small " + (m.running ? "bad" : "ok"), onclick: () => toggleClock(m) },
        m.running ? "⏸ Pausar" : "▶ Reloj"),
      el("button", { class: "btn small", title: "Deshacer última acción", onclick: () => undoLast(m) }, "↩ Deshacer"),
      el("button", { class: "btn small", onclick: () => gameMenu(m) }, "⋯")
    ));
  }

  /* parciales */
  const t = el("table");
  const h = el("tr", null, el("th", null, ""));
  const rA = el("tr", null, el("th", null, m.teams.A.name.slice(0, 10)));
  const rB = el("tr", null, el("th", null, m.teams.B.name.slice(0, 10)));
  for (const p of s.partials) {
    h.append(el("th", null, qLabel(p.q)));
    rA.append(el("td", null, String(p.A)));
    rB.append(el("td", null, String(p.B)));
  }
  h.append(el("th", { class: "tot" }, "T"));
  rA.append(el("td", { class: "tot" }, String(s.score.A)));
  rB.append(el("td", { class: "tot" }, String(s.score.B)));
  t.append(h, rA, rB);
  sb.append(el("div", { class: "sb-partials" }, t));

  if (s.run) {
    sb.append(el("div", { class: "run-banner" },
      `Corrida ${s.run.pts}-0 · ${s.run.team === "A" ? m.teams.A.name : m.teams.B.name} 🔥`));
  }
}

function renderDirBar(dir, m) {
  dir.innerHTML = "";
  const sideA = attackSide(m, "A", m.quarter);
  const left = sideA === "left" ? "A" : "B";
  const right = sideA === "left" ? "B" : "A";
  dir.append(
    el("span", { style: { color: m.teams[left].color } }, "⬅ ataca " + m.teams[left].name),
    el("span", { style: { color: m.teams[right].color } }, m.teams[right].name + " ataca ➡")
  );
}

/* ---- bancas ---- */
function benchRow(m, t, stats) {
  const on = lineupsAt(m, Infinity)[t];
  const row = el("div", { class: "bench" });
  row.append(el("span", { class: "bench-label", style: { color: m.teams[t].color } }, m.teams[t].name.slice(0, 12)));
  const sorted = [...m.teams[t].players].sort((a, b) => (on.has(b.id) - on.has(a.id)) || (+a.number - +b.number));
  for (const p of sorted) {
    const isOn = on.has(p.id);
    const sel = App.ui.sel && App.ui.sel.team === t && App.ui.sel.pid === p.id;
    const subSel = App.ui.subIn && App.ui.subIn.team === t && App.ui.subIn.pid === p.id;
    const fouls = stats.players[t][p.id]?.foul || 0;
    row.append(playerChip(p, m.teams[t].color, {
      onCourt: isOn,
      selected: sel || subSel,
      fouls,
      onclick: () => onChipTap(m, t, p.id, isOn)
    }));
  }
  return row;
}

function onChipTap(m, t, pid, isOn) {
  if (m.status !== "live") { toast("El partido terminó"); return; }
  const sub = App.ui.subIn;

  if (sub && sub.team === t) {
    if (pid === sub.pid) { App.ui.subIn = null; renderGameScreen(); return; }   // cancelar
    if (isOn) {
      /* completa el cambio: entra sub.pid, sale pid */
      addEvent(m, { type: "sub", team: t, inId: sub.pid, outId: pid });
      toast("🔄 Entra " + playerLabel(m, t, sub.pid) + " por " + playerLabel(m, t, pid));
      App.ui.subIn = null;
      App.ui.sel = null;
      renderGameScreen();
      return;
    }
    toast("Tocá un jugador en cancha para completar el cambio");
    return;
  }

  if (!isOn) {
    /* banca: inicia cambio */
    App.ui.subIn = { team: t, pid };
    App.ui.sel = null;
    toast("Cambio: ahora tocá quién sale de " + m.teams[t].name);
    renderGameScreen();
    return;
  }

  /* en cancha: seleccionar / deseleccionar para acciones */
  App.ui.subIn = null;
  if (App.ui.sel && App.ui.sel.team === t && App.ui.sel.pid === pid) App.ui.sel = null;
  else App.ui.sel = { team: t, pid };
  renderGameScreen();
}

/* ---- barra de acciones rápidas ---- */
const QUICK_ACTIONS = [
  ["ast", "🅰️ Asist."], ["rob", "🖐️ Robo"], ["per", "💨 Pérdida"], ["tap", "🚫 Tapa"],
  ["reb_o", "⬆️ Reb. of."], ["reb_d", "⬇️ Reb. def."], ["foul", "🟨 Falta"]
];
const ACTION_NAMES = {
  shot: "Tiro", ft: "Tiro libre", ast: "Asistencia", rob: "Robo", per: "Pérdida",
  tap: "Tapa", reb_o: "Rebote ofensivo", reb_d: "Rebote defensivo", foul: "Falta", sub: "Cambio"
};

function renderActionBar(wrap, m) {
  wrap.innerHTML = "";
  if (m.status !== "live") {
    wrap.append(el("div", { class: "action-hint" }, "Partido finalizado. Mirá el reporte 📤"));
    return;
  }
  const sel = App.ui.sel;
  if (App.ui.subIn) {
    wrap.append(el("div", { class: "action-hint" }, "🔄 Cambio en curso: tocá el jugador que sale."));
    return;
  }
  if (!sel) {
    wrap.append(el("div", { class: "action-hint" },
      "Tocá un jugador (de cualquier equipo) y después el lugar del tiro, o una acción rápida. Tocar un suplente inicia un cambio."));
    return;
  }
  const bar = el("div", { id: "action-bar" });
  const label = el("div", {
    class: "action-hint",
    style: { color: m.teams[sel.team].color, fontWeight: "700", padding: "2px 0" }
  }, "● " + playerLabel(m, sel.team, sel.pid) + " — tocá la cancha para un tiro");
  for (const [type, txt] of QUICK_ACTIONS) {
    bar.append(el("button", {
      class: "btn", onclick: () => {
        addEvent(m, { type, team: sel.team, playerId: sel.pid });
        toast(ACTION_NAMES[type] + " · " + playerLabel(m, sel.team, sel.pid));
        renderGameScreen();
      }
    }, txt));
  }
  bar.append(el("button", { class: "btn ok", onclick: () => quickFT(m, sel, true) }, "TL ✓"));
  bar.append(el("button", { class: "btn bad", onclick: () => quickFT(m, sel, false) }, "TL ✗"));
  wrap.append(label, bar);
}

function quickFT(m, sel, made) {
  addEvent(m, { type: "ft", team: sel.team, playerId: sel.pid, made });
  toast((made ? "✔ Libre anotado" : "✗ Libre errado") + " · " + playerLabel(m, sel.team, sel.pid));
  renderGameScreen();
}

/* ---- registro de tiro (2 toques) ---- */
function onCourtTap(m, x, y, e, wrap) {
  if (m.status !== "live") return;
  const sel = App.ui.sel;
  if (!sel) { toast("Primero tocá al jugador que tiró"); return; }

  $$(".shot-pop", wrap).forEach(n => n.remove());

  const side = attackSide(m, sel.team, m.quarter);
  let pts = isThree(x, y, side) ? 3 : 2;

  const rect = wrap.getBoundingClientRect();
  const pop = el("div", { class: "shot-pop" });
  const val = el("span", { class: "val" });
  const refreshVal = () => { val.textContent = pts + "P"; };
  refreshVal();

  const commit = made => {
    addEvent(m, { type: "shot", team: sel.team, playerId: sel.pid, x: +x.toFixed(2), y: +y.toFixed(2), pts, made });
    toast((made ? "✔ +" + pts + " " : "✗ Tiro de " + pts + " errado · ") + playerLabel(m, sel.team, sel.pid),
      { hot: made });
    pop.remove();
    renderGameScreen();
  };

  pop.append(
    val,
    el("button", { class: "btn small", title: "Corregir 2P/3P (pie en la línea)", onclick: () => { pts = pts === 2 ? 3 : 2; refreshVal(); } }, "↔"),
    el("button", { class: "btn small ok", onclick: () => commit(true) }, "✓"),
    el("button", { class: "btn small bad", onclick: () => commit(false) }, "✗"),
    el("button", { class: "btn small ghost", onclick: () => pop.remove() }, "✕")
  );

  let px = e.clientX - rect.left, py = e.clientY - rect.top;
  pop.style.left = Math.min(Math.max(px, 90), rect.width - 90) + "px";
  pop.style.top = Math.max(py, 56) + "px";
  wrap.append(pop);
}

/* tiros del cuarto actual sobre la cancha en vivo */
function renderLiveShots(svg, m) {
  const shots = allShots(m);
  for (const s of shots) {
    addShotDot(svg.shotsLayer, s, m.teams[s.team].color, { dim: s.quarter !== m.quarter, r: 0.26 });
  }
}

/* ---- deshacer / menú ---- */
function undoLast(m) {
  const last = m.events[m.events.length - 1];
  if (!last) { toast("No hay acciones para deshacer"); return; }
  removeEvent(m, last.id);
  toast("↩ Deshecho: " + describeEvent(m, last));
  renderGameScreen();
}

function gameMenu(m) {
  const body = el("div");
  body.append(
    el("button", { class: "btn big", style: { marginBottom: "8px" }, onclick: () => { closeModal(); editRostersModal(m); } }, "👥 Editar planteles"),
    el("button", { class: "btn big", style: { marginBottom: "8px" }, onclick: () => { closeModal(); editClockModal(m); } }, "⏱️ Ajustar reloj / cuarto"),
    el("button", {
      class: "btn big bad", onclick: () => {
        closeModal();
        confirmModal("Finalizar partido", "¿Dar por terminado el partido? Después podés ver el reporte.", () => finishMatch(m), "Finalizar");
      }
    }, "🏁 Finalizar partido")
  );
  openModal("Partido", body, [{ label: "Cerrar", kind: "ghost" }]);
}

function editRostersModal(m) {
  const body = el("div");
  const seg = el("div", { class: "seg" });
  const holder = el("div");
  let cur = "A";
  const render = () => {
    seg.innerHTML = "";
    for (const t of ["A", "B"]) {
      seg.append(el("button", { class: cur === t ? "active" : "", onclick: () => { cur = t; render(); } }, m.teams[t].name));
    }
    holder.innerHTML = "";
    holder.append(rosterEditor(m, cur, () => { }));
  };
  render();
  body.append(el("p", { class: "sub" }, "Podés agregar, editar o borrar jugadores incluso con el partido empezado."), seg, holder);
  openModal("Editar planteles", body, [{ label: "Listo", kind: "primary", onclick: () => { if (App.tab === "game") renderGameScreen(); } }]);
}

function editClockModal(m) {
  const minIn = el("input", { type: "number", min: 0, max: 20, value: Math.floor(m.clockSec / 60) });
  const secIn = el("input", { type: "number", min: 0, max: 59, value: Math.floor(m.clockSec % 60) });
  const qSel = el("select");
  for (let q = 1; q <= Math.max(4, m.quarter) + 1; q++) {
    qSel.append(el("option", { value: q, selected: q === m.quarter ? "" : null }, qLabel(q)));
  }
  openModal("Ajustar reloj", el("div", null,
    el("label", { class: "fld" }, "Cuarto"), qSel,
    el("div", { class: "row", style: { marginTop: "8px" } },
      el("div", { class: "grow" }, el("label", { class: "fld" }, "Minutos"), minIn),
      el("div", { class: "grow" }, el("label", { class: "fld" }, "Segundos"), secIn))
  ), [
    { label: "Cancelar", kind: "ghost" },
    {
      label: "Aplicar", kind: "primary", onclick: () => {
        const wasQ = m.quarter;
        m.quarter = +qSel.value;
        m.clockSec = Math.min(quarterLenSec(m, m.quarter), (+minIn.value || 0) * 60 + (+secIn.value || 0));
        m.running = false;
        saveDB();
        if (wasQ <= 2 && m.quarter >= 3) toast("Entretiempo: cambio de lado 🔁", { hot: true, ms: 3200 });
        renderGameScreen();
      }
    }
  ]);
}

/* ---- fin de cuarto / partido ---- */
function quarterEndCard(m) {
  const s = computeStats(m);
  const card = el("div", { class: "card", style: { textAlign: "center" } });
  card.append(el("p", { style: { fontWeight: 700, marginBottom: "10px" } }, "Fin del " + qLabel(m.quarter)));

  if (m.quarter < 4) {
    card.append(el("button", {
      class: "btn primary big", onclick: () => {
        const wasQ2 = m.quarter === 2;
        m.quarter++;
        m.clockSec = quarterLenSec(m, m.quarter);
        saveDB();
        if (wasQ2) toast("Entretiempo: cambio de lado 🔁 Los aros se invirtieron", { hot: true, ms: 3500 });
        else toast("Arranca el " + qLabel(m.quarter));
        renderGameScreen();
      }
    }, m.quarter === 2 ? "Ir al 2° tiempo (cambio de lado) ▶" : "Siguiente cuarto ▶"));
  } else {
    if (s.score.A === s.score.B) {
      card.append(el("button", {
        class: "btn primary big", style: { marginBottom: "8px" }, onclick: () => {
          m.quarter++;
          m.clockSec = quarterLenSec(m, m.quarter);
          saveDB();
          toast("¡Prórroga! 🔥");
          renderGameScreen();
        }
      }, "Empate: jugar prórroga ▶"));
    }
    card.append(el("button", {
      class: "btn ok big", style: { marginTop: "6px" }, onclick: () => finishMatch(m)
    }, "🏁 Finalizar partido"));
  }
  return card;
}

function finishMatch(m) {
  m.status = "finished";
  m.running = false;
  m.clockSec = 0;
  saveDB();
  const s = computeStats(m);
  toast("Final: " + m.teams.A.name + " " + s.score.A + " - " + s.score.B + " " + m.teams.B.name, { hot: true, ms: 4000 });
  setTab("report");
}

/* descripción corta de un evento (para toasts y timeline) */
function describeEvent(m, ev) {
  const who = ev.playerId ? playerLabel(m, ev.team, ev.playerId) : m.teams[ev.team].name;
  switch (ev.type) {
    case "shot": return (ev.made ? "✔ " : "✗ ") + ev.pts + "P · " + who;
    case "ft": return (ev.made ? "✔" : "✗") + " Libre · " + who;
    case "sub": return "🔄 Entra " + playerLabel(m, ev.team, ev.inId) + " por " + playerLabel(m, ev.team, ev.outId);
    default: return (ACTION_NAMES[ev.type] || ev.type) + " · " + who;
  }
}
