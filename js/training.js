/* ========== modo entrenamiento ==========
   Sesiones de práctica con tu equipo: misma cancha y mismas
   estadísticas que un partido, sin rival ni cuartos. Los tiros se
   clasifican contra el aro más cercano (en la práctica se usan los dos)
   y cada acción puede etiquetarse con el ejercicio que se está haciendo. */
"use strict";

function curTraining() {
  return App.db.trainings.find(t => t.id === App.trainingId) || null;
}

function newTraining() {
  const my = myTeam();
  const s = {
    id: uid(),
    date: Date.now(),
    teamId: my.id,                 // categoría a la que pertenece la sesión
    status: "live",                // live | finished
    team: {
      name: my.name, color: my.color, emoji: my.emoji || "", logo: my.logo || null,
      players: JSON.parse(JSON.stringify(my.players))   // mismos ids: sirve para la evolución entre sesiones
    },
    drills: [],                    // [{id, name}] ejercicios de la sesión
    curDrill: null,                // ejercicio activo (null = libre)
    elapsedSec: 0,
    running: false,
    events: [],                    // {id, seq, type, playerId, x, y, pts, made, drillId, t}
    seq: 0
  };
  App.db.trainings.push(s);
  saveDB();
  return s;
}

function deleteTraining(id) {
  App.db.trainings = App.db.trainings.filter(t => t.id !== id);
  if (App.trainingId === id) App.trainingId = null;
  saveDB();
}

function addTEvent(s, ev) {
  ev.id = uid();
  ev.seq = ++s.seq;
  ev.t = Math.round(s.elapsedSec);
  ev.drillId = s.curDrill;
  s.events.push(ev);
  saveDB();
  buzz();
  return ev;
}

function drillName(s, drillId) {
  if (!drillId) return "Libre";
  const d = s.drills.find(x => x.id === drillId);
  return d ? d.name : "Libre";
}

/* aro más cercano: en entrenamiento se tira a los dos */
function nearestSide(x) {
  return x < COURT.W / 2 ? "left" : "right";
}

function allTrainingShots(s) {
  return s.events
    .filter(e => e.type === "shot")
    .map(e => ({ ...e, hoopSide: nearestSide(e.x) }));
}

/* ---- cronómetro (cuenta para arriba) ---- */
let trTimer = null, trLast = null, trLastSave = 0;

function startTrainingLoop() {
  if (trTimer) return;
  trLast = performance.now();
  trTimer = setInterval(() => {
    const s = curTraining();
    const now = performance.now();
    if (!s || !s.running) { trLast = now; return; }
    s.elapsedSec += (now - trLast) / 1000;
    trLast = now;
    if (now - trLastSave > 5000) { saveDB(); trLastSave = now; }
    const c = $("#tr-clock");
    if (c) c.textContent = fmtClock(s.elapsedSec);
  }, 400);
}

/* ---- navegación ---- */
function showTraining(id) {
  App.matchId = null;
  App.trainingId = id;
  App.screen = "training";
  App.ui.sel = null;
  App.ui.trFilter = null;
  $("#tabbar").classList.remove("hidden");
  startTrainingLoop();
  setTab("game");
}

function renderTrainingTab(tab) {
  const s = curTraining();
  if (!s) return showHome();
  $("#topbar-info").textContent = "Entrenamiento · " + fmtDate(s.date);
  if (tab === "game") renderTrainingCourt();
  else if (tab === "stats") renderTrainingStats();
  else if (tab === "shots") renderTrainingShots();
  else if (tab === "timeline") renderTrainingTimeline();
  else renderTrainingSummary();
}

/* ========== cancha de entrenamiento ========== */
function renderTrainingCourt() {
  const s = curTraining();
  const root = $("#screen");
  root.innerHTML = "";
  const layout = el("div", { class: "game-layout" });
  const main = el("div", { class: "game-main" });
  const side = el("div", { class: "game-side" });
  layout.append(main, side);
  root.append(layout);

  /* cabecera: cronómetro + controles */
  const head = el("div", { id: "scoreboard" });
  head.append(el("div", { class: "sb-main" },
    el("div", { class: "sb-team" },
      el("div", { class: "name" },
        el("span", { class: "team-dot", style: { background: s.team.color } }),
        teamMark(s.team, 18), s.team.name),
      el("div", { class: "sub", style: { margin: 0 } }, "🏋️ Entrenamiento")),
    el("div", { class: "sb-mid" },
      el("div", { class: "sb-q" }, s.status === "finished" ? "FINALIZADO" : "SESIÓN"),
      el("div", { class: "sb-clock", id: "tr-clock" }, fmtClock(s.elapsedSec))),
    el("div", { class: "sb-team" },
      el("div", { class: "sub", style: { margin: 0 } }, "Tiros"),
      el("div", { class: "pts" }, String(s.events.filter(e => e.type === "shot").length)))
  ));
  if (s.status === "live") {
    head.append(el("div", { class: "sb-controls" },
      el("button", {
        class: "btn small " + (s.running ? "bad" : "ok"),
        onclick: () => { s.running = !s.running; trLast = performance.now(); saveDB(); renderTrainingCourt(); }
      }, s.running ? "⏸ Pausar" : "▶ Cronómetro"),
      el("button", {
        class: "btn small", onclick: () => {
          const last = s.events[s.events.length - 1];
          if (!last) { toast("No hay acciones para deshacer"); return; }
          s.events = s.events.filter(e => e.id !== last.id);
          saveDB();
          toast("↩ Deshecho: " + describeTEvent(s, last));
          renderTrainingCourt();
        }
      }, "↩ Deshacer"),
      el("button", {
        class: "btn small", onclick: () =>
          confirmModal("Finalizar entrenamiento", "¿Dar por terminada la sesión? Queda guardada en el historial.", () => {
            s.status = "finished";
            s.running = false;
            saveDB();
            toast("Entrenamiento guardado 🏋️");
            setTab("report");
          }, "Finalizar")
      }, "🏁")
    ));
  }
  main.append(head);

  /* ejercicios */
  main.append(drillBar(s, () => renderTrainingCourt()));

  /* jugadores */
  const row = el("div", { class: "bench" });
  row.append(el("span", { class: "bench-label", style: { color: s.team.color } }, "Plantel"));
  for (const p of [...s.team.players].sort((a, b) => +a.number - +b.number)) {
    const sel = App.ui.sel && App.ui.sel.pid === p.id;
    row.append(playerChip(p, s.team.color, {
      onCourt: true, selected: sel,
      onclick: () => {
        if (s.status !== "live") { toast("La sesión terminó"); return; }
        App.ui.sel = sel ? null : { pid: p.id };
        renderTrainingCourt();
      }
    }));
  }
  main.append(row);

  /* cancha */
  const wrap = el("div", { class: "court-wrap" });
  const svg = createCourtSVG({ onTap: (x, y, e) => onTrainingCourtTap(s, x, y, e, wrap) });
  /* los dos aros del color del equipo: se ataca a ambos */
  for (const ring of svg.querySelectorAll(".hoop-ring")) {
    ring.setAttribute("stroke", s.team.color);
    ring.setAttribute("stroke-width", 0.16);
  }
  /* con un jugador seleccionado, la cancha muestra solo sus tiros */
  let liveShots = allTrainingShots(s);
  if (App.ui.sel) liveShots = liveShots.filter(sh => sh.playerId === App.ui.sel.pid);
  for (const shot of liveShots) {
    addShotDot(svg.shotsLayer, shot, s.team.color, {
      dim: !App.ui.sel && s.curDrill && shot.drillId !== s.curDrill,
      r: App.ui.sel ? 0.32 : 0.26
    });
  }
  wrap.append(svg);
  main.append(wrap);

  /* acciones rápidas */
  const bar = el("div");
  renderTrainingActionBar(bar, s);
  side.append(bar);
}

function drillBar(s, rerender) {
  const bar = el("div", { class: "filters" });
  bar.append(el("span", { class: "sub", style: { margin: "6px 6px 0 0", flex: "none" } }, "Ejercicio:"));
  bar.append(el("button", {
    class: "btn small" + (!s.curDrill ? " active" : ""),
    onclick: () => { s.curDrill = null; saveDB(); rerender(); }
  }, "Libre"));
  for (const d of s.drills) {
    bar.append(el("button", {
      class: "btn small" + (s.curDrill === d.id ? " active" : ""),
      onclick: () => { s.curDrill = d.id; saveDB(); rerender(); }
    }, d.name));
  }
  if (s.status === "live") {
    bar.append(el("button", { class: "btn small ghost", onclick: () => newDrillModal(s, rerender) }, "＋ Ejercicio"));
  }
  return bar;
}

function newDrillModal(s, rerender) {
  const input = el("input", { type: "text", placeholder: "Ej: Tiro de 3 · Contraataque · Libres", maxlength: 24 });
  openModal("Nuevo ejercicio", el("div", null,
    el("p", { class: "sub" }, "Las acciones que registres quedan etiquetadas con el ejercicio activo, para ver estadísticas por ejercicio."),
    input
  ), [
    { label: "Cancelar", kind: "ghost" },
    {
      label: "Crear", kind: "primary", onclick: () => {
        const name = input.value.trim();
        if (!name) { toast("⚠️ Ponele un nombre"); return false; }
        const d = { id: uid(), name };
        s.drills.push(d);
        s.curDrill = d.id;
        saveDB();
        toast("Ejercicio activo: " + name);
        rerender();
      }
    }
  ]);
  setTimeout(() => input.focus(), 50);
}

const TRAINING_ACTIONS = [
  ["ast", "🅰️ Asist."], ["rob", "🖐️ Robo"], ["per", "💨 Pérdida"], ["tap", "🚫 Tapa"],
  ["reb_o", "⬆️ Reb. of."], ["reb_d", "⬇️ Reb. def."], ["foul", "🟨 Falta"]
];

function renderTrainingActionBar(wrap, s) {
  wrap.innerHTML = "";
  if (s.status !== "live") {
    wrap.append(el("div", { class: "action-hint" }, "Sesión finalizada. Mirá el resumen 📤"));
    return;
  }
  const sel = App.ui.sel;
  if (!sel) {
    wrap.append(el("div", { class: "action-hint" },
      "Tocá un jugador y después el lugar del tiro (vale cualquiera de los dos aros), o una acción rápida."));
    return;
  }
  const p = s.team.players.find(x => x.id === sel.pid);
  const bar = el("div", { id: "action-bar" });
  wrap.append(el("div", {
    class: "action-hint",
    style: { color: s.team.color, fontWeight: "700", padding: "2px 0" }
  }, "● #" + p.number + " " + p.name + " — tocá la cancha para un tiro" + (s.curDrill ? " · " + drillName(s, s.curDrill) : "")));
  for (const [type, txt] of TRAINING_ACTIONS) {
    bar.append(el("button", {
      class: "btn", onclick: () => {
        addTEvent(s, { type, playerId: sel.pid });
        toast(ACTION_NAMES[type] + " · #" + p.number + " " + p.name);
        renderTrainingCourt();
      }
    }, txt));
  }
  bar.append(el("button", {
    class: "btn ok", onclick: () => { addTEvent(s, { type: "ft", playerId: sel.pid, made: true }); toast("✔ Libre anotado · " + p.name); renderTrainingCourt(); }
  }, "TL ✓"));
  bar.append(el("button", {
    class: "btn bad", onclick: () => { addTEvent(s, { type: "ft", playerId: sel.pid, made: false }); toast("✗ Libre errado · " + p.name); renderTrainingCourt(); }
  }, "TL ✗"));
  wrap.append(bar);
}

function onTrainingCourtTap(s, x, y, e, wrap) {
  if (s.status !== "live") return;
  const sel = App.ui.sel;
  if (!sel) { toast("Primero tocá al jugador que tiró"); return; }

  $$(".shot-pop", wrap).forEach(n => n.remove());
  const side = nearestSide(x);
  const auto3 = isThree(x, y, side);
  let pts = auto3 ? 3 : 2;
  const dist = distToHoop(x, y, side);

  const rect = wrap.getBoundingClientRect();
  const pop = el("div", { class: "shot-pop" });
  const val = el("span", { class: "val" });
  const refreshVal = () => {
    const manual = pts !== (auto3 ? 3 : 2);
    val.innerHTML = "<b>" + pts + "P</b> <small style='color:var(--muted)'>" +
      (manual ? "corregido ↔" : (auto3 ? "afuera" : "adentro") + " del arco") +
      " · " + dist.toFixed(1) + " m</small>";
  };
  refreshVal();

  const p = s.team.players.find(pl => pl.id === sel.pid);
  const commit = made => {
    addTEvent(s, { type: "shot", playerId: sel.pid, x: +x.toFixed(2), y: +y.toFixed(2), pts, made });
    toast((made ? "✔ +" + pts + " " : "✗ Tiro de " + pts + " errado · ") + "#" + p.number + " " + p.name, { hot: made });
    pop.remove();
    renderTrainingCourt();
  };

  pop.append(
    val,
    el("button", { class: "btn small", title: "Corregir 2P/3P", onclick: () => { pts = pts === 2 ? 3 : 2; refreshVal(); } }, "↔"),
    el("button", { class: "btn small ok", onclick: () => commit(true) }, "✓"),
    el("button", { class: "btn small bad", onclick: () => commit(false) }, "✗"),
    el("button", { class: "btn small ghost", onclick: () => pop.remove() }, "✕")
  );
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  pop.style.left = Math.min(Math.max(px, 90), rect.width - 90) + "px";
  pop.style.top = Math.max(py, 56) + "px";
  wrap.append(pop);
}

/* ========== estadísticas de la sesión ========== */
function trainingStats(s, filter) {
  filter = filter || {};
  const lines = {};
  for (const p of s.team.players) lines[p.id] = blankLine();
  const line = pid => lines[pid] || (lines[pid] = blankLine());

  for (const ev of s.events) {
    if (filter.drill && ev.drillId !== filter.drill) continue;
    const l = line(ev.playerId);
    switch (ev.type) {
      case "shot":
        if (ev.pts === 3) { l.p3a++; if (ev.made) { l.p3m++; l.pts += 3; } }
        else { l.p2a++; if (ev.made) { l.p2m++; l.pts += 2; } }
        break;
      case "ft": l.fta++; if (ev.made) { l.ftm++; l.pts++; } break;
      case "ast": l.ast++; break;
      case "rob": l.rob++; break;
      case "per": l.per++; break;
      case "tap": l.tap++; break;
      case "reb_o": l.reb_o++; break;
      case "reb_d": l.reb_d++; break;
      case "foul": l.foul++; break;
    }
  }
  const total = blankLine();
  for (const l of Object.values(lines)) for (const k of Object.keys(total)) total[k] += l[k];
  return { lines, total };
}

function renderTrainingStats() {
  const s = curTraining();
  const root = $("#screen");
  root.innerHTML = "";
  const f = App.ui.trFilter = App.ui.trFilter || { drill: null };

  root.append(el("h1", null, "Estadísticas de la sesión"));
  root.append(el("p", { class: "sub" }, fmtDate(s.date) + " · " + fmtClock(s.elapsedSec) + " de práctica"));

  /* filtro por ejercicio */
  const bar = el("div", { class: "filters" });
  bar.append(el("button", { class: "btn small" + (!f.drill ? " active" : ""), onclick: () => { f.drill = null; renderTrainingStats(); } }, "Toda la sesión"));
  for (const d of s.drills) {
    bar.append(el("button", { class: "btn small" + (f.drill === d.id ? " active" : ""), onclick: () => { f.drill = f.drill === d.id ? null : d.id; renderTrainingStats(); } }, d.name));
  }
  root.append(bar);

  const st = trainingStats(s, f);
  const wrap = el("div", { class: "tbl-wrap" });
  const tbl = el("table", { class: "stats" });
  tbl.append(el("tr", null,
    ["Jugador", "PTS", "2P", "3P", "TL", "REB", "O/D", "AST", "ROB", "PÉR", "TAP", "FP", "PIR"].map(h => el("th", null, h))));
  const rows = [...s.team.players].sort((a, b) => (st.lines[b.id]?.pts || 0) - (st.lines[a.id]?.pts || 0));
  for (const p of rows) {
    const l = st.lines[p.id] || blankLine();
    tbl.append(el("tr", null,
      el("td", null, "#" + p.number + " " + p.name),
      el("td", null, el("b", null, String(l.pts))),
      el("td", null, `${l.p2m}/${l.p2a} ${fmtPct(l.p2m, l.p2a)}`),
      el("td", null, `${l.p3m}/${l.p3a} ${fmtPct(l.p3m, l.p3a)}`),
      el("td", null, `${l.ftm}/${l.fta} ${fmtPct(l.ftm, l.fta)}`),
      el("td", null, String(l.reb_o + l.reb_d)),
      el("td", null, l.reb_o + "/" + l.reb_d),
      el("td", null, String(l.ast)),
      el("td", null, String(l.rob)),
      el("td", null, String(l.per)),
      el("td", null, String(l.tap)),
      el("td", null, String(l.foul)),
      el("td", null, String(pir(l)))
    ));
  }
  const t = st.total, fg = fgLine(t);
  tbl.append(el("tr", { class: "totals" },
    el("td", null, "TOTAL"),
    el("td", null, String(t.pts)),
    el("td", null, `${t.p2m}/${t.p2a} ${fmtPct(t.p2m, t.p2a)}`),
    el("td", null, `${t.p3m}/${t.p3a} ${fmtPct(t.p3m, t.p3a)}`),
    el("td", null, `${t.ftm}/${t.fta} ${fmtPct(t.ftm, t.fta)}`),
    el("td", null, String(t.reb_o + t.reb_d)),
    el("td", null, t.reb_o + "/" + t.reb_d),
    el("td", null, String(t.ast)),
    el("td", null, String(t.rob)),
    el("td", null, String(t.per)),
    el("td", null, String(t.tap)),
    el("td", null, String(t.foul)),
    el("td", null, "")
  ));
  wrap.append(tbl);
  root.append(wrap);
  root.append(el("p", { class: "sub", style: { marginTop: "8px" } },
    "Tiros de campo del " + (f.drill ? "ejercicio" : "total") + ": " + fg.m + "/" + fg.a + " (" + fmtPct(fg.m, fg.a) + ")"));
}

/* ========== shot chart de la sesión ========== */
function renderTrainingShots() {
  const s = curTraining();
  const root = $("#screen");
  root.innerHTML = "";
  const f = App.ui.trShotFilter = App.ui.trShotFilter || { pid: null, drill: null, heat: false };

  root.append(el("h1", null, "Mapa de tiros"));
  root.append(el("p", { class: "sub" }, "Verde = anotado · Rojo = errado. En entrenamiento valen los dos aros."));

  const pRow = el("div", { class: "filters" });
  pRow.append(el("button", { class: "btn small" + (f.pid ? "" : " active"), onclick: () => { f.pid = null; renderTrainingShots(); } }, "Todos"));
  for (const p of s.team.players) {
    pRow.append(el("button", {
      class: "btn small" + (f.pid === p.id ? " active" : ""),
      onclick: () => { f.pid = f.pid === p.id ? null : p.id; renderTrainingShots(); }
    }, "#" + p.number));
  }
  root.append(pRow);

  const dRow = el("div", { class: "filters" });
  dRow.append(el("button", { class: "btn small" + (!f.drill ? " active" : ""), onclick: () => { f.drill = null; renderTrainingShots(); } }, "Toda la sesión"));
  for (const d of s.drills) {
    dRow.append(el("button", { class: "btn small" + (f.drill === d.id ? " active" : ""), onclick: () => { f.drill = f.drill === d.id ? null : d.id; renderTrainingShots(); } }, d.name));
  }
  dRow.append(el("button", { class: "btn small" + (f.heat ? " active" : ""), onclick: () => { f.heat = !f.heat; renderTrainingShots(); } }, "🔥 Mapa de calor"));
  root.append(dRow);

  const shots = allTrainingShots(s);
  const selected = shot => (!f.pid || shot.playerId === f.pid) && (!f.drill || shot.drillId === f.drill);

  const wrap = el("div", { class: "court-wrap" });
  const svg = createCourtSVG({});
  for (const ring of svg.querySelectorAll(".hoop-ring")) {
    ring.setAttribute("stroke", s.team.color);
    ring.setAttribute("stroke-width", 0.16);
  }
  if (f.heat) drawHeatZones(svg, null, shots.filter(selected));
  for (const shot of shots) {
    addShotDot(svg.shotsLayer, shot, s.team.color, {
      dim: !selected(shot), r: selected(shot) && f.pid ? 0.34 : 0.26,
      title: describeTEvent(s, shot) + " · " + fmtClock(shot.t)
    });
  }
  wrap.append(svg);
  root.append(wrap);

  const zs = zoneStats(shots.filter(selected));
  const grid = el("div", { class: "zone-grid" });
  for (const [key, name] of Object.entries(ZONE_NAMES)) {
    const z = zs[key];
    grid.append(el("div", { class: "zone-box" },
      el("div", { class: "z-pct", style: { color: z.att ? heatColor(z.made / z.att) : "var(--muted)" } }, fmtPct(z.made, z.att)),
      el("div", { class: "z-name" }, name + " · " + z.made + "/" + z.att)
    ));
  }
  root.append(el("h2", null, "Eficiencia por zona"), grid);
}

/* ========== línea de tiempo de la sesión ========== */
function describeTEvent(s, ev) {
  const p = s.team.players.find(x => x.id === ev.playerId);
  const who = p ? "#" + p.number + " " + p.name : "¿?";
  switch (ev.type) {
    case "shot": return (ev.made ? "✔ " : "✗ ") + ev.pts + "P · " + who;
    case "ft": return (ev.made ? "✔" : "✗") + " Libre · " + who;
    default: return (ACTION_NAMES[ev.type] || ev.type) + " · " + who;
  }
}

function renderTrainingTimeline() {
  const s = curTraining();
  const root = $("#screen");
  root.innerHTML = "";
  root.append(el("h1", null, "Acciones de la sesión"));
  root.append(el("p", { class: "sub" }, "Cualquier acción se puede corregir o borrar; las estadísticas se recalculan al instante."));

  if (!s.events.length) {
    root.append(el("div", { class: "card sub" }, "Todavía no hay acciones registradas."));
    return;
  }
  const card = el("div", { class: "card" });
  for (const ev of [...s.events].reverse()) {
    card.append(el("div", { class: "tl-item" },
      el("span", { class: "tl-time" }, fmtClock(ev.t)),
      el("span", { class: "tl-desc" },
        describeTEvent(s, ev),
        ev.drillId ? el("span", { class: "sub", style: { margin: 0 } }, " · " + drillName(s, ev.drillId)) : null),
      el("button", { class: "btn small", onclick: () => editTEventModal(s, ev) }, "✎"),
      el("button", {
        class: "btn small bad", onclick: () =>
          confirmModal("Borrar acción", describeTEvent(s, ev), () => {
            s.events = s.events.filter(x => x.id !== ev.id);
            saveDB();
            toast("Acción borrada; estadísticas recalculadas");
            renderTrainingTimeline();
          }, "Borrar")
      }, "✕")
    ));
  }
  root.append(card);
}

function editTEventModal(s, ev) {
  const body = el("div");
  body.append(el("p", { class: "sub" }, fmtClock(ev.t) + " · " + describeTEvent(s, ev)));

  const playerSel = el("select");
  for (const p of s.team.players) {
    playerSel.append(el("option", { value: p.id, selected: p.id === ev.playerId ? "" : null }, "#" + p.number + " " + p.name));
  }
  body.append(el("label", { class: "fld" }, "Jugador"), playerSel);

  let madeSel = null, ptsSel = null;
  if (ev.type === "shot" || ev.type === "ft") {
    madeSel = el("select");
    madeSel.append(
      el("option", { value: "1", selected: ev.made ? "" : null }, "✓ Anotado"),
      el("option", { value: "0", selected: !ev.made ? "" : null }, "✗ Fallado"));
    body.append(el("label", { class: "fld", style: { marginTop: "8px" } }, "Resultado"), madeSel);
  }
  let mover = null;
  if (ev.type === "shot") {
    ptsSel = el("select");
    ptsSel.append(
      el("option", { value: "2", selected: ev.pts === 2 ? "" : null }, "2 puntos"),
      el("option", { value: "3", selected: ev.pts === 3 ? "" : null }, "3 puntos"));
    body.append(el("label", { class: "fld", style: { marginTop: "8px" } }, "Valor"), ptsSel);

    mover = shotMovePicker(ev, s.team.color,
      (x, y) => isThree(x, y, nearestSide(x)) ? 3 : 2,
      (pos, pts) => { ptsSel.value = String(pts); });
    body.append(mover);
  }
  const drillSel = el("select");
  drillSel.append(el("option", { value: "", selected: !ev.drillId ? "" : null }, "Libre"));
  for (const d of s.drills) {
    drillSel.append(el("option", { value: d.id, selected: ev.drillId === d.id ? "" : null }, d.name));
  }
  body.append(el("label", { class: "fld", style: { marginTop: "8px" } }, "Ejercicio"), drillSel);

  openModal("Corregir acción", body, [
    { label: "Cancelar", kind: "ghost" },
    {
      label: "Guardar", kind: "primary", onclick: () => {
        ev.playerId = playerSel.value;
        if (madeSel) ev.made = madeSel.value === "1";
        if (ptsSel) ev.pts = +ptsSel.value;
        if (mover) { const p = mover.getPos(); ev.x = p.x; ev.y = p.y; }
        ev.drillId = drillSel.value || null;
        saveDB();
        toast("Acción corregida ✔");
        setTab(App.tab);
      }
    }
  ]);
}

/* ========== resumen de la sesión ========== */
function renderTrainingSummary() {
  const s = curTraining();
  const root = $("#screen");
  root.innerHTML = "";
  const st = trainingStats(s, {});
  const fg = fgLine(st.total);

  root.append(el("h1", null, "Resumen del entrenamiento"));
  root.append(el("p", { class: "sub" },
    fmtDate(s.date) + " · " + fmtClock(s.elapsedSec) + " de práctica" + (s.status === "finished" ? " · Finalizado" : " · En curso")));

  root.append(el("div", { class: "card row", style: { justifyContent: "space-around", textAlign: "center" } },
    el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.5rem" } }, fg.m + "/" + fg.a),
      el("div", { class: "sub", style: { margin: 0 } }, "Tiros de campo")),
    el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.5rem", color: fg.a ? heatColor(fg.m / fg.a) : "var(--muted)" } }, fmtPct(fg.m, fg.a)),
      el("div", { class: "sub", style: { margin: 0 } }, "Efectividad")),
    el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.5rem" } }, st.total.ftm + "/" + st.total.fta),
      el("div", { class: "sub", style: { margin: 0 } }, "Libres"))
  ));

  /* por ejercicio */
  if (s.drills.length) {
    root.append(el("h2", null, "Por ejercicio"));
    const card = el("div", { class: "card" });
    for (const d of [{ id: null, name: "Libre" }, ...s.drills]) {
      const stD = trainingStats(s, { drill: d.id });
      const fgD = fgLine(stD.total);
      const shots = s.events.filter(e => e.type === "shot" && (d.id ? e.drillId === d.id : !e.drillId)).length;
      if (!shots && !stD.total.fta) continue;
      card.append(el("div", { class: "list-item" },
        el("div", { class: "grow" }, el("b", null, d.name),
          el("div", { class: "sub", style: { margin: 0 } }, fgD.m + "/" + fgD.a + " de campo · " + stD.total.ftm + "/" + stD.total.fta + " libres")),
        el("b", { style: { color: fgD.a ? heatColor(fgD.m / fgD.a) : "var(--muted)" } }, fmtPct(fgD.m, fgD.a))
      ));
    }
    root.append(card);
  }

  /* destacados por jugador */
  root.append(el("h2", null, "Jugadores"));
  const card = el("div", { class: "card" });
  const ranked = [...s.team.players]
    .map(p => ({ p, l: st.lines[p.id] || blankLine() }))
    .filter(x => fgLine(x.l).a > 0 || x.l.fta > 0)
    .sort((a, b) => fgLine(b.l).a - fgLine(a.l).a);
  for (const { p, l } of ranked) {
    const f = fgLine(l);
    card.append(el("div", { class: "list-item" },
      el("div", { class: "grow" }, el("b", null, "#" + p.number + " " + p.name),
        el("div", { class: "sub", style: { margin: 0 } },
          f.m + "/" + f.a + " de campo · " + l.p3m + "/" + l.p3a + " triples · " + l.ftm + "/" + l.fta + " libres")),
      el("b", { style: { color: f.a ? heatColor(f.m / f.a) : "var(--muted)" } }, fmtPct(f.m, f.a))
    ));
  }
  if (!ranked.length) card.append(el("span", { class: "sub" }, "Sin tiros registrados todavía."));
  root.append(card);

  /* compartir */
  root.append(el("div", { class: "row wrap no-print", style: { marginTop: "12px" } },
    el("button", { class: "btn primary grow", onclick: () => shareTrainingSummary(s) }, "📤 Compartir resumen"),
    el("button", { class: "btn grow", onclick: () => window.print() }, "🖨️ PDF / Imprimir")
  ));

  if (s.status === "live") {
    root.append(el("button", {
      class: "btn bad big no-print", style: { marginTop: "12px" },
      onclick: () => confirmModal("Finalizar entrenamiento", "¿Dar por terminada la sesión?", () => {
        s.status = "finished"; s.running = false; saveDB();
        toast("Entrenamiento guardado 🏋️");
        renderTrainingSummary();
      }, "Finalizar")
    }, "🏁 Finalizar entrenamiento"));
  }
}

/* ========== evolución entre sesiones ==========
   Curvas de % de campo, triples y libres de cada jugador a través de
   los entrenamientos finalizados, con filtro por ejercicio (por nombre). */
function trainingsOfActiveTeam() {
  return App.db.trainings.filter(s => !s.teamId || s.teamId === App.db.myTeamId);
}

function showTrainingEvolution() {
  App.screen = "trevolution";
  App.matchId = null;
  App.trainingId = null;
  $("#tabbar").classList.add("hidden");
  $("#topbar-info").textContent = "Evolución";
  const root = $("#screen");
  root.innerHTML = "";

  const sessions = trainingsOfActiveTeam()
    .filter(s => s.status === "finished")
    .sort((a, b) => a.date - b.date);

  root.append(el("h1", null, "Evolución de entrenamientos"));
  root.append(el("p", { class: "sub" }, "Porcentajes de cada jugador sesión a sesión, para ver si lo que practican rinde."));

  if (sessions.length < 2) {
    root.append(el("div", { class: "card sub" },
      "Necesitás al menos 2 entrenamientos finalizados para ver la evolución (llevás " + sessions.length + ")."));
    root.append(el("button", { class: "btn ghost big", onclick: showHome }, "Volver"));
    return;
  }

  /* filtro por ejercicio (por nombre, uniendo sesiones) */
  const f = App.ui.evoFilter = App.ui.evoFilter || { drill: null };
  const drillNames = [...new Set(sessions.flatMap(s => s.drills.map(d => d.name)))];
  if (drillNames.length) {
    const bar = el("div", { class: "filters" });
    bar.append(el("button", { class: "btn small" + (!f.drill ? " active" : ""), onclick: () => { f.drill = null; showTrainingEvolution(); } }, "Todo"));
    for (const name of drillNames) {
      bar.append(el("button", {
        class: "btn small" + (f.drill === name ? " active" : ""),
        onclick: () => { f.drill = f.drill === name ? null : name; showTrainingEvolution(); }
      }, name));
    }
    root.append(bar);
  }

  /* series por jugador (clave número+nombre para sobrevivir cambios de plantel) */
  const perPlayer = {};   // key -> {number, name, fg: [], p3: [], ft: []}
  const teamSeries = { fg: [], p3: [], ft: [] };

  for (const s of sessions) {
    const drillIds = f.drill ? s.drills.filter(d => d.name === f.drill).map(d => d.id) : null;
    const st = drillIds
      ? sumDrillStats(s, drillIds)
      : trainingStats(s, {});
    const tf = fgLine(st.total);
    teamSeries.fg.push(tf.a ? Math.round(tf.m / tf.a * 100) : null);
    teamSeries.p3.push(st.total.p3a ? Math.round(st.total.p3m / st.total.p3a * 100) : null);
    teamSeries.ft.push(st.total.fta ? Math.round(st.total.ftm / st.total.fta * 100) : null);
    for (const p of s.team.players) {
      const l = st.lines[p.id];
      if (!l) continue;
      const key = p.number + "·" + p.name.toLowerCase();
      if (!perPlayer[key]) perPlayer[key] = { number: p.number, name: p.name, fg: [], p3: [], ft: [] };
      const fgl = fgLine(l);
      perPlayer[key].fg.push(fgl.a ? Math.round(fgl.m / fgl.a * 100) : null);
      perPlayer[key].p3.push(l.p3a ? Math.round(l.p3m / l.p3a * 100) : null);
      perPlayer[key].ft.push(l.fta ? Math.round(l.ftm / l.fta * 100) : null);
    }
  }

  const evoCell = serie => {
    const vals = serie.filter(v => v !== null);
    if (!vals.length) return el("td", null, "–");
    const last = vals[vals.length - 1];
    const prev = vals.length > 1 ? vals[vals.length - 2] : last;
    const arrow = last > prev ? " ↗" : last < prev ? " ↘" : "";
    return el("td", null,
      el("div", null, el("b", { style: { color: heatColor(last / 100) } }, last + "%" + arrow)),
      sparkline(vals));
  };

  root.append(el("h2", null, "Equipo" + (f.drill ? " · " + f.drill : "")));
  const teamTbl = el("table", { class: "stats" });
  teamTbl.append(el("tr", null, ["", "Campo", "Triples", "Libres"].map(h => el("th", null, h))));
  teamTbl.append(el("tr", null, el("td", null, sessions.length + " sesiones"),
    evoCell(teamSeries.fg), evoCell(teamSeries.p3), evoCell(teamSeries.ft)));
  root.append(el("div", { class: "tbl-wrap" }, teamTbl));

  root.append(el("h2", null, "Por jugador"));
  const tbl = el("table", { class: "stats" });
  tbl.append(el("tr", null, ["Jugador", "Campo", "Triples", "Libres"].map(h => el("th", null, h))));
  const players = Object.values(perPlayer)
    .filter(p => p.fg.some(v => v !== null) || p.ft.some(v => v !== null))
    .sort((a, b) => +a.number - +b.number);
  for (const p of players) {
    tbl.append(el("tr", null,
      el("td", null, "#" + p.number + " " + p.name),
      evoCell(p.fg), evoCell(p.p3), evoCell(p.ft)));
  }
  root.append(el("div", { class: "tbl-wrap" }, tbl));

  root.append(el("button", { class: "btn ghost big", style: { marginTop: "12px" }, onclick: showHome }, "Volver"));
}

/* stats sumando varios ejercicios (mismo nombre en la sesión) */
function sumDrillStats(s, drillIds) {
  const parts = drillIds.map(id => trainingStats(s, { drill: id }));
  const out = { lines: {}, total: blankLine() };
  for (const p of s.team.players) out.lines[p.id] = blankLine();
  for (const part of parts) {
    for (const [pid, l] of Object.entries(part.lines)) {
      if (!out.lines[pid]) out.lines[pid] = blankLine();
      for (const k of Object.keys(l)) out.lines[pid][k] += l[k];
    }
    for (const k of Object.keys(part.total)) out.total[k] += part.total[k];
  }
  return out;
}

function shareTrainingSummary(s) {
  const st = trainingStats(s, {});
  const fg = fgLine(st.total);
  const lines = [
    "🏋️ Entrenamiento " + (s.team.emoji ? s.team.emoji + " " : "") + s.team.name + " · " + fmtDate(s.date),
    "Tiros de campo: " + fg.m + "/" + fg.a + " (" + fmtPct(fg.m, fg.a) + ") · Libres: " + st.total.ftm + "/" + st.total.fta
  ];
  for (const d of s.drills) {
    const stD = trainingStats(s, { drill: d.id });
    const fgD = fgLine(stD.total);
    if (fgD.a) lines.push("• " + d.name + ": " + fgD.m + "/" + fgD.a + " (" + fmtPct(fgD.m, fgD.a) + ")");
  }
  const best = [...s.team.players]
    .map(p => ({ p, l: st.lines[p.id] || blankLine() }))
    .filter(x => fgLine(x.l).a >= 5)
    .sort((a, b) => fgLine(b.l).m / fgLine(b.l).a - fgLine(a.l).m / fgLine(a.l).a)[0];
  if (best) {
    const f = fgLine(best.l);
    lines.push("⭐ " + best.p.name + ": " + f.m + "/" + f.a + " (" + fmtPct(f.m, f.a) + ")");
  }
  lines.push("— Planilla hecha con Quinteto");
  const text = lines.join("\n");
  if (navigator.share) navigator.share({ text }).catch(() => { });
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("Resumen copiado 📋"));
}
