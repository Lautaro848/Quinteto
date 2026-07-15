/* ========== inicio, historial y temporada ========== */
"use strict";

function showHome() {
  App.screen = "home";
  App.matchId = null;
  $("#tabbar").classList.add("hidden");
  $("#topbar-info").textContent = "";
  const root = $("#screen");
  root.innerHTML = "";

  root.append(el("h1", null, "Quinteto"));
  root.append(el("p", { class: "sub" }, "La planilla digital que reemplaza al papel."));

  /* partido en curso */
  const live = App.db.matches.find(x => x.status === "live");
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
  const setup = App.db.matches.find(x => x.status === "setup");

  root.append(el("button", {
    class: "btn primary big", style: { marginBottom: "10px" },
    onclick: () => {
      if (setup) { App.matchId = setup.id; showSetup(); return; }
      /* los equipos arrancan vacíos: el usuario los crea desde cero
         (o carga un plantel guardado si él lo elige) */
      newMatch();
      showSetup();
    }
  }, setup ? "Seguir configurando partido ▶" : "＋ Nuevo partido"));

  /* récord de temporada */
  const finished = App.db.matches.filter(x => x.status === "finished");
  if (finished.length) {
    let w = 0, l = 0, t = 0;
    for (const match of finished) {
      const s = computeStats(match);
      if (s.score.A > s.score.B) w++; else if (s.score.A < s.score.B) l++; else t++;
    }
    root.append(el("h2", null, "Temporada"));
    root.append(el("div", { class: "card row", style: { justifyContent: "space-around", textAlign: "center" } },
      el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.6rem", color: "var(--ok)" } }, String(w)), el("div", { class: "sub", style: { margin: 0 } }, "Ganados")),
      el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.6rem", color: "var(--bad)" } }, String(l)), el("div", { class: "sub", style: { margin: 0 } }, "Perdidos")),
      el("div", null, el("div", { class: "hero-score", style: { fontSize: "1.6rem" } }, String(finished.length)), el("div", { class: "sub", style: { margin: 0 } }, "Jugados"))
    ));
    root.append(seasonAveragesCard(finished));
  }

  /* historial */
  if (App.db.matches.length) {
    root.append(el("h2", null, "Partidos"));
    const card = el("div", { class: "card" });
    for (const match of [...App.db.matches].reverse()) {
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

  /* datos */
  root.append(el("h2", null, "Datos"));
  const fileIn = el("input", { type: "file", accept: "application/json", style: { display: "none" } });
  fileIn.addEventListener("change", () => { if (fileIn.files[0]) importAll(fileIn.files[0]); });
  root.append(el("div", { class: "card row wrap" },
    el("button", { class: "btn grow", onclick: exportAll }, "📦 Exportar backup"),
    el("button", { class: "btn grow", onclick: () => fileIn.click() }, "📥 Importar backup"),
    fileIn
  ));
  root.append(el("p", { class: "sub", style: { textAlign: "center" } },
    "Todo se guarda automáticamente en este dispositivo."));
}

/* promedios por jugador de mi equipo, partido a partido */
function seasonAveragesCard(finished) {
  const acc = {};   // clave número+nombre -> {g, pts, reb, ast, pirSum, games:[{pts}]}
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
  const rows = Object.values(acc).sort((a, b) => b.pts / b.g - a.pts / a.g);
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

/* mini gráfico de evolución de puntos partido a partido */
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
