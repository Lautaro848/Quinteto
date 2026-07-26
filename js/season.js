/* ========== inicio, historial y temporada ========== */
"use strict";

/* ¿el partido pertenece a la categoría activa? (legacy sin id: se incluye) */
function matchOfActiveTeam(m) {
  return !m.teams.A.savedTeamId || m.teams.A.savedTeamId === App.db.myTeamId;
}

function showHome() {
  App.screen = "home";
  App.matchId = null;
  App.trainingId = null;
  $("#tabbar").classList.add("hidden");
  $("#topbar-info").textContent = "";
  const root = $("#screen");
  root.innerHTML = "";

  root.append(el("h1", null, "Quinteto"));
  root.append(el("p", { class: "sub" }, "La planilla digital que reemplaza al papel."));

  const my = myTeam();
  const myMatches = App.db.matches.filter(matchOfActiveTeam);

  /* partido en curso */
  const live = myMatches.find(x => x.status === "live");
  if (live) {
    const s = computeStats(live);
    root.append(el("div", { class: "card" },
      el("div", { class: "row" },
        el("div", { class: "grow" },
          el("b", null, live.teams.A.name + " " + s.score.A + " – " + s.score.B + " " + live.teams.B.name),
          el("div", { class: "sub", style: { margin: 0 } }, "En juego · " + qLabel(live.quarter))),
        el("button", { class: "btn primary", onclick: () => { App.matchId = live.id; showGame(); } }, "Continuar ▶"))
    ));
  }
  const setup = myMatches.find(x => x.status === "setup");

  /* mis equipos / categorías */
  if (my) {
    root.append(el("h2", null, App.db.savedTeams.length > 1 ? "Mis equipos" : "Mi equipo"));
    root.append(el("div", { class: "card row" },
      el("span", { class: "team-dot", style: { background: my.color, width: "14px", height: "14px" } }),
      el("div", { class: "grow" },
        el("b", null, teamMark(my, 24), " ", my.name, catBadge(my)),
        el("div", { class: "sub", style: { margin: 0 } }, my.players.length + " jugadores" +
          (App.db.savedTeams.length > 1 ? " · " + App.db.savedTeams.length + " equipos guardados" : ""))),
      el("button", { class: "btn small", title: "Editar este equipo", onclick: () => showMyTeam() }, "✎"),
      el("button", { class: "btn small", title: "Mis equipos y categorías", onclick: pickCategoryModal }, "⇄"),
      el("button", { class: "btn small", title: "Nuevo equipo / categoría", onclick: createCategory }, "＋")
    ));

    root.append(el("button", {
      class: "btn primary big", style: { marginBottom: "10px" },
      onclick: () => {
        if (setup) { App.matchId = setup.id; showSetup(); return; }
        /* tu equipo se carga solo; en la configuración solo creás al rival */
        const m = newMatch();
        m.teams.A.name = my.name;
        m.teams.A.category = my.category || "";
        m.teams.A.gender = my.gender || "";
        m.teams.A.color = my.color;
        m.teams.A.emoji = my.emoji || "";
        m.teams.A.logo = my.logo || null;
        m.teams.A.savedTeamId = my.id;
        m.teams.A.players = my.players.map(p => ({ ...p, id: uid() }));
        saveDB();
        showSetup();
      }
    }, setup ? "Seguir configurando partido ▶" : "＋ Nuevo partido vs..."));

    /* modo entrenamiento: misma cancha y estadísticas, sin rival */
    const liveTraining = trainingsOfActiveTeam().find(x => x.status === "live");
    root.append(el("button", {
      class: "btn big", style: { marginBottom: "10px" },
      onclick: () => {
        if (liveTraining) { showTraining(liveTraining.id); return; }
        const s = newTraining();
        showTraining(s.id);
        toast("Entrenamiento iniciado 🏋️ Creá ejercicios para etiquetar las acciones");
      }
    }, liveTraining ? "Continuar entrenamiento 🏋️ ▶" : "🏋️ Nuevo entrenamiento"));
  } else {
    root.append(el("div", { class: "card" },
      el("p", { class: "sub" }, "Para arrancar, creá tu equipo una sola vez: nombre, color, escudo y plantel. Después, en cada partido nuevo se carga solo y únicamente cargás al rival."),
      el("button", { class: "btn primary big", onclick: () => showMyTeam() }, "🏀 Crear mi equipo")
    ));
    if (setup) {
      root.append(el("button", {
        class: "btn big", style: { marginBottom: "10px" },
        onclick: () => { App.matchId = setup.id; showSetup(); }
      }, "Seguir configurando partido ▶"));
    }
  }

  /* récord de temporada (de la categoría activa) */
  const finished = myMatches.filter(x => x.status === "finished");
  if (finished.length) {
    let w = 0, l = 0;
    for (const match of finished) {
      const s = computeStats(match);
      if (s.score.A > s.score.B) w++; else if (s.score.A < s.score.B) l++;
    }
    root.append(el("h2", null, "Temporada" + (my ? " · " + teamFullName(my) : "")));
    root.append(el("div", { class: "card row", style: { justifyContent: "space-around", textAlign: "center" } },
      el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.6rem", color: "var(--ok)" } }, String(w)), el("div", { class: "sub", style: { margin: 0 } }, "Ganados")),
      el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.6rem", color: "var(--bad)" } }, String(l)), el("div", { class: "sub", style: { margin: 0 } }, "Perdidos")),
      el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.6rem" } }, String(finished.length)), el("div", { class: "sub", style: { margin: 0 } }, "Jugados"))
    ));
    root.append(seasonAveragesCard(finished));
    root.append(rivalsCard(finished));
  }

  /* historial de partidos */
  if (myMatches.length) {
    root.append(el("h2", null, "Partidos"));
    const card = el("div", { class: "card" });
    for (const match of [...myMatches].reverse()) {
      const s = computeStats(match);
      const won = s.score.A > s.score.B;
      const badge = match.status === "finished"
        ? el("b", { style: { color: won ? "var(--ok)" : (s.score.A === s.score.B ? "var(--muted)" : "var(--bad)") } }, won ? "G" : (s.score.A === s.score.B ? "E" : "P"))
        : el("b", { style: { color: "var(--accent)" } }, match.status === "live" ? "🔴" : "⚙");
      card.append(el("div", { class: "list-item" },
        badge,
        el("div", { class: "grow", onclick: () => { App.matchId = match.id; match.status === "setup" ? showSetup() : showGame(); }, style: { cursor: "pointer" } },
          el("b", null, `${match.teams.A.name} ${s.score.A} – ${s.score.B} ${match.teams.B.name}`),
          el("div", { class: "sub", style: { margin: 0 } }, fmtDate(match.date) + " · " +
            (match.status === "finished" ? "Final" : match.status === "live" ? "En juego" : "Sin empezar"))),
        el("button", {
          class: "btn small bad",
          onclick: () => confirmModal("Borrar partido", "¿Borrar este partido del historial?", () => { deleteMatch(match.id); showHome(); }, "Borrar")
        }, "✕")
      ));
    }
    root.append(card);
  }

  /* entrenamientos */
  const myTrainings = trainingsOfActiveTeam();
  if (myTrainings.length) {
    const finishedT = myTrainings.filter(s => s.status === "finished").length;
    root.append(el("div", { class: "row", style: { alignItems: "baseline" } },
      el("h2", { class: "grow" }, "Entrenamientos"),
      finishedT >= 2 ? el("button", { class: "btn small", onclick: showTrainingEvolution }, "📈 Evolución") : null
    ));
    const tcard = el("div", { class: "card" });
    for (const s of [...myTrainings].reverse()) {
      const shots = s.events.filter(e => e.type === "shot");
      const made = shots.filter(e => e.made).length;
      tcard.append(el("div", { class: "list-item" },
        el("b", null, s.status === "live" ? "🔴" : "🏋️"),
        el("div", { class: "grow", style: { cursor: "pointer" }, onclick: () => showTraining(s.id) },
          el("b", null, fmtDate(s.date) + " · " + fmtClock(s.elapsedSec)),
          el("div", { class: "sub", style: { margin: 0 } },
            shots.length + " tiros (" + fmtPct(made, shots.length) + ")" +
            (s.drills.length ? " · " + s.drills.length + " ejercicios" : "") +
            (s.status === "live" ? " · En curso" : ""))),
        el("button", {
          class: "btn small bad",
          onclick: () => confirmModal("Borrar entrenamiento", "¿Borrar esta sesión del historial?", () => { deleteTraining(s.id); showHome(); }, "Borrar")
        }, "✕")
      ));
    }
    root.append(tcard);
  }

  /* datos */
  root.append(el("h2", null, "Datos"));
  const pend = pendingBackup();
  if (pend >= 3) {
    root.append(el("div", { class: "card", style: { borderColor: "var(--accent)" } },
      el("p", { class: "sub", style: { marginBottom: "8px" } },
        "⚠️ Tenés " + pend + " partidos/entrenamientos sin backup. Si borrás los datos del navegador, se pierden."),
      el("button", { class: "btn primary big", onclick: () => { exportAll(); showHome(); } }, "📦 Exportar backup ahora")));
  }
  const fileIn = el("input", { type: "file", accept: "application/json", style: { display: "none" } });
  fileIn.addEventListener("change", () => { if (fileIn.files[0]) importAll(fileIn.files[0]); });
  root.append(el("div", { class: "card row wrap" },
    el("button", { class: "btn grow", onclick: () => { exportAll(); } }, "📦 Exportar backup"),
    el("button", { class: "btn grow", onclick: () => fileIn.click() }, "📥 Importar backup"),
    finished.length ? el("button", { class: "btn grow", onclick: () => exportSeasonCSV(finished) }, "📄 Temporada CSV") : null,
    fileIn
  ));
  root.append(el("p", { class: "sub", style: { textAlign: "center" } },
    "Todo se guarda automáticamente en este dispositivo."));
}

/* ---- varios equipos propios y categorías (U13, U15, Primera…) ---- */
function createCategory() {
  const team = { id: uid(), name: "", category: "", gender: "", color: "#e8622c", emoji: "", logo: null, players: [] };
  App.db.savedTeams.push(team);
  App.db.myTeamId = team.id;
  saveDB();
  showMyTeam();
  toast("Nuevo equipo: completá nombre, categoría y plantel");
}

/* récord de un equipo propio (solo partidos suyos) */
function teamRecord(teamId) {
  let w = 0, l = 0, g = 0;
  for (const m of App.db.matches) {
    if (m.status !== "finished" || m.teams.A.savedTeamId !== teamId) continue;
    const s = computeStats(m);
    g++;
    if (s.score.A > s.score.B) w++; else if (s.score.A < s.score.B) l++;
  }
  return { g, w, l };
}

function pickCategoryModal() {
  const body = el("div");
  body.append(el("p", { class: "sub" },
    "Cada equipo tiene su plantel, temporada, partidos y entrenamientos separados. Con ＋ creás otro (ej: el mismo club en U13 y U15)."));
  for (const t of App.db.savedTeams) {
    const active = t.id === App.db.myTeamId;
    const rec = teamRecord(t.id);
    const trainings = App.db.trainings.filter(s => s.teamId === t.id).length;
    body.append(el("div", { class: "list-item" },
      el("span", { class: "team-dot", style: { background: t.color } }),
      el("div", { class: "grow" },
        el("b", null, teamMark(t, 20), " ", t.name || "Sin nombre", catBadge(t)),
        el("div", { class: "sub", style: { margin: 0 } },
          t.players.length + " jugadores · " + rec.g + " PJ (" + rec.w + "G-" + rec.l + "P)" +
          (trainings ? " · " + trainings + " entren." : "") +
          (active ? " · ✓ Activo" : ""))),
      active
        ? el("b", { style: { color: "var(--ok)" } }, "✓")
        : el("button", {
          class: "btn small primary",
          onclick: () => {
            App.db.myTeamId = t.id;
            saveDB(); closeModal(); showHome();
            toast("Equipo activo: " + teamFullName(t));
          }
        }, "Usar"),
      !active ? el("button", {
        class: "btn small", title: "Editar",
        onclick: () => { App.db.myTeamId = t.id; saveDB(); closeModal(); showMyTeam(); }
      }, "✎") : null,
      App.db.savedTeams.length > 1 && !active ? el("button", {
        class: "btn small bad",
        onclick: () => confirmModal("Borrar equipo", "¿Borrar \"" + teamFullName(t) + "\"? Sus partidos quedan en el historial.", () => {
          App.db.savedTeams = App.db.savedTeams.filter(x => x.id !== t.id);
          saveDB(); closeModal(); showHome();
        }, "Borrar")
      }, "✕") : null
    ));
  }
  openModal("Mis equipos", body, [
    { label: "＋ Nuevo equipo", kind: "primary", onclick: () => { createCategory(); } },
    { label: "Cerrar", kind: "ghost" }
  ]);
}

/* ---- head-to-head contra cada rival ---- */
function rivalsCard(finished) {
  const byRival = {};
  for (const m of finished) {
    const key = m.teams.B.name.trim().toLowerCase();
    if (!key) continue;
    if (!byRival[key]) byRival[key] = { name: m.teams.B.name, color: m.teams.B.color, w: 0, l: 0, e: 0, pf: 0, pc: 0, n: 0 };
    const r = byRival[key];
    const s = computeStats(m);
    r.n++;
    r.pf += s.score.A; r.pc += s.score.B;
    r.color = m.teams.B.color;
    if (s.score.A > s.score.B) r.w++; else if (s.score.A < s.score.B) r.l++; else r.e++;
  }
  const rivals = Object.values(byRival).sort((a, b) => b.n - a.n);
  const card = el("div", { class: "card" });
  if (!rivals.length) return card;
  card.append(el("h2", { style: { marginTop: 0 } }, "Contra cada rival"));
  for (const r of rivals) {
    card.append(el("div", { class: "list-item" },
      el("span", { class: "team-dot", style: { background: r.color } }),
      el("div", { class: "grow" },
        el("b", null, r.name),
        el("div", { class: "sub", style: { margin: 0 } },
          r.n + (r.n === 1 ? " partido" : " partidos") + " · promedio " +
          (r.pf / r.n).toFixed(0) + "–" + (r.pc / r.n).toFixed(0))),
      el("b", { style: { color: r.w > r.l ? "var(--ok)" : r.w < r.l ? "var(--bad)" : "var(--muted)" } },
        r.w + "-" + r.l + (r.e ? "-" + r.e : ""))
    ));
  }
  return card;
}

/* ---- CSV de la temporada ---- */
function exportSeasonCSV(finished) {
  const rows = [["Fecha", "Rival", "Puntos propios", "Puntos rival", "Resultado"]];
  for (const m of finished) {
    const s = computeStats(m);
    rows.push([fmtDate(m.date), m.teams.B.name, s.score.A, s.score.B,
      s.score.A > s.score.B ? "G" : s.score.A < s.score.B ? "P" : "E"]);
  }
  rows.push([]);
  rows.push(["Jugador", "PJ", "PTS/partido", "REB/partido", "AST/partido", "PIR/partido"]);
  const acc = seasonAverages(finished);
  for (const r of acc) {
    rows.push(["#" + r.number + " " + r.name, r.g,
      (r.pts / r.g).toFixed(1), (r.reb / r.g).toFixed(1), (r.ast / r.g).toFixed(1), (r.pirSum / r.g).toFixed(1)]);
  }
  downloadCSV("quinteto-temporada.csv", rows);
  toast("Temporada exportada 📄");
}

/* promedios por jugador (datos crudos, reutilizado por la tabla y el CSV) */
function seasonAverages(finished) {
  const acc = {};
  for (const match of finished) {
    const s = computeStats(match);
    for (const p of match.teams.A.players) {
      const l = s.players.A[p.id];
      if (!l || (l.secs === 0 && l.pts === 0 && !fgLine(l).a)) continue;
      const key = p.number + "·" + p.name.toLowerCase();
      if (!acc[key]) acc[key] = { number: p.number, name: p.name, g: 0, pts: 0, reb: 0, ast: 0, pirSum: 0, games: [] };
      const a = acc[key];
      a.g++;
      a.pts += l.pts;
      a.reb += l.reb_o + l.reb_d;
      a.ast += l.ast;
      a.pirSum += pir(l);
      a.games.push(l.pts);
    }
  }
  return Object.values(acc).sort((a, b) => b.pts / b.g - a.pts / a.g);
}

/* promedios por jugador de mi equipo, partido a partido */
function seasonAveragesCard(finished) {
  const rows = seasonAverages(finished);
  const card = el("div", { class: "card" });
  if (!rows.length) return card;

  card.append(el("h2", { style: { marginTop: 0 } }, "Promedios por jugador"));
  const wrap = el("div", { class: "tbl-wrap" });
  const tbl = el("table", { class: "stats" });
  tbl.append(el("tr", null, ["Jugador", "PJ", "PTS", "REB", "AST", "PIR", "Evolución"].map(x => el("th", null, x))));
  for (const r of rows) {
    tbl.append(el("tr", null,
      el("td", null, "#" + r.number + " " + r.name),
      el("td", null, String(r.g)),
      el("td", null, (r.pts / r.g).toFixed(1)),
      el("td", null, (r.reb / r.g).toFixed(1)),
      el("td", null, (r.ast / r.g).toFixed(1)),
      el("td", null, (r.pirSum / r.g).toFixed(1)),
      el("td", null, sparkline(r.games))
    ));
  }
  wrap.append(tbl);
  card.append(wrap);
  return card;
}

/* mini gráfico de evolución */
function sparkline(values) {
  const w = 90, h = 22;
  const svg = svgEl("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: "vertical-align:middle" });
  if (values.length === 1) values = [values[0], values[0]];
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) =>
    (i / (values.length - 1)) * (w - 6) + 3 + "," + (h - 3 - (v / max) * (h - 8)));
  svg.append(svgEl("polyline", {
    points: pts.join(" "), fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round"
  }));
  return svg;
}
