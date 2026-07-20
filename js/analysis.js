/* ========== estadísticas, shot chart y línea de tiempo ========== */
"use strict";

/* ---------- ESTADÍSTICAS ---------- */
function renderStatsScreen() {
  const m = curMatch();
  if (!m) return showHome();
  const root = $("#screen");
  root.innerHTML = "";

  const s = computeStats(m);
  App.ui.statsTeam = App.ui.statsTeam || "A";

  root.append(el("h1", null, "Estadísticas"));
  root.append(el("p", { class: "sub" }, m.teams.A.name + " " + s.score.A + " – " + s.score.B + " " + m.teams.B.name));

  /* pestañas por equipo */
  const seg = el("div", { class: "seg" });
  for (const t of ["A", "B"]) {
    seg.append(el("button", {
      class: App.ui.statsTeam === t ? "active" : "",
      onclick: () => { App.ui.statsTeam = t; renderStatsScreen(); }
    }, m.teams[t].name));
  }
  root.append(seg);

  const t = App.ui.statsTeam;
  root.append(boxScoreTable(m, t, s));

  /* comparativa de equipos */
  root.append(el("h2", null, "Comparativa de equipos"));
  root.append(teamCompareCard(m, s));
}

function boxScoreTable(m, t, s) {
  const wrap = el("div", { class: "tbl-wrap" });
  const tbl = el("table", { class: "stats" });
  tbl.append(el("tr", null,
    ["Jugador", "MIN", "PTS", "2P", "3P", "TL", "REB", "O/D", "AST", "ROB", "PÉR", "TAP", "FP", "+/-", "PIR"].map(h => el("th", null, h))
  ));

  const rows = [...m.teams[t].players].sort((a, b) =>
    (s.players[t][b.id]?.pts || 0) - (s.players[t][a.id]?.pts || 0));

  for (const p of rows) {
    const l = s.players[t][p.id] || blankLine();
    const fg = fgLine(l);
    tbl.append(el("tr", null,
      el("td", null, "#" + p.number + " " + p.name),
      el("td", null, fmtClock(l.secs)),
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
      el("td", null, (l.plusminus > 0 ? "+" : "") + l.plusminus),
      el("td", null, String(pir(l)))
    ));
  }

  const tot = s.team[t];
  const fgT = fgLine(tot);
  tbl.append(el("tr", { class: "totals" },
    el("td", null, "TOTAL"),
    el("td", null, ""),
    el("td", null, String(tot.pts)),
    el("td", null, `${tot.p2m}/${tot.p2a} ${fmtPct(tot.p2m, tot.p2a)}`),
    el("td", null, `${tot.p3m}/${tot.p3a} ${fmtPct(tot.p3m, tot.p3a)}`),
    el("td", null, `${tot.ftm}/${tot.fta} ${fmtPct(tot.ftm, tot.fta)}`),
    el("td", null, String(tot.reb_o + tot.reb_d)),
    el("td", null, tot.reb_o + "/" + tot.reb_d),
    el("td", null, String(tot.ast)),
    el("td", null, String(tot.rob)),
    el("td", null, String(tot.per)),
    el("td", null, String(tot.tap)),
    el("td", null, String(tot.foul)),
    el("td", null, ""),
    el("td", null, "")
  ));
  wrap.append(tbl);
  return wrap;
}

function teamCompareCard(m, s) {
  const card = el("div", { class: "card" });
  const elapsed = m.status === "finished" ? gameElapsedAt(m, m.quarter, 0) : gameElapsedNow(m);
  const adv = { A: advancedTeam(s.team.A, elapsed), B: advancedTeam(s.team.B, elapsed) };
  const rows = [
    ["Puntos", t => s.team[t].pts],
    ["% Tiros de campo", t => { const f = fgLine(s.team[t]); return fmtPct(f.m, f.a); }],
    ["eFG% (pondera el triple)", t => adv[t].efg ? Math.round(adv[t].efg * 100) + "%" : "–"],
    ["% Triples", t => fmtPct(s.team[t].p3m, s.team[t].p3a)],
    ["% Libres", t => fmtPct(s.team[t].ftm, s.team[t].fta)],
    ["Posesiones (est.)", t => adv[t].poss > 0 ? adv[t].poss.toFixed(0) : "–"],
    ["Puntos por posesión", t => adv[t].poss > 0 ? adv[t].ppp.toFixed(2) : "–"],
    ["Ritmo (pos. cada 40')", t => adv[t].pace > 0 ? adv[t].pace.toFixed(0) : "–"],
    ["Minutos pedidos", t => (s.timeouts[t][1] + s.timeouts[t][2])],
    ["Rebotes (of+def)", t => s.team[t].reb_o + s.team[t].reb_d],
    ["Asistencias", t => s.team[t].ast],
    ["Robos", t => s.team[t].rob],
    ["Pérdidas", t => s.team[t].per],
    ["Tapas", t => s.team[t].tap],
    ["Faltas", t => s.team[t].foul]
  ];
  const tbl = el("table", { class: "stats" });
  tbl.append(el("tr", null,
    el("th", null, ""),
    el("th", { style: { color: m.teams.A.color } }, m.teams.A.name),
    el("th", { style: { color: m.teams.B.color } }, m.teams.B.name)));
  for (const [name, fn] of rows) {
    tbl.append(el("tr", null, el("td", null, name), el("td", null, String(fn("A"))), el("td", null, String(fn("B")))));
  }
  card.append(el("div", { class: "tbl-wrap" }, tbl));
  return card;
}

/* ---------- SHOT CHART ---------- */
function renderShotsScreen() {
  const m = curMatch();
  if (!m) return showHome();
  const root = $("#screen");
  root.innerHTML = "";
  const f = App.ui.shotFilter = App.ui.shotFilter || { team: "all", pid: null, q: 0, heat: false };

  root.append(el("h1", null, "Mapa de tiros"));
  root.append(el("p", { class: "sub" }, "Verde = anotado · Rojo = errado · El borde indica el equipo."));

  /* filtros de equipo/jugador */
  const teamSeg = el("div", { class: "seg" });
  for (const [key, label] of [["all", "Ambos"], ["A", m.teams.A.name], ["B", m.teams.B.name]]) {
    teamSeg.append(el("button", {
      class: f.team === key ? "active" : "",
      onclick: () => { f.team = key; f.pid = null; renderShotsScreen(); }
    }, label));
  }
  root.append(teamSeg);

  if (f.team === "A" || f.team === "B") {
    const pRow = el("div", { class: "filters" });
    pRow.append(el("button", { class: "btn small" + (f.pid ? "" : " active"), onclick: () => { f.pid = null; renderShotsScreen(); } }, "Todos"));
    for (const p of m.teams[f.team].players) {
      pRow.append(el("button", {
        class: "btn small" + (f.pid === p.id ? " active" : ""),
        onclick: () => { f.pid = f.pid === p.id ? null : p.id; renderShotsScreen(); }
      }, "#" + p.number));
    }
    root.append(pRow);
  }

  /* filtro de cuarto + heatmap */
  const qRow = el("div", { class: "filters" });
  qRow.append(el("button", { class: "btn small" + (f.q === 0 ? " active" : ""), onclick: () => { f.q = 0; renderShotsScreen(); } }, "Todo el partido"));
  const maxQ = Math.max(4, m.quarter);
  for (let q = 1; q <= maxQ; q++) {
    qRow.append(el("button", { class: "btn small" + (f.q === q ? " active" : ""), onclick: () => { f.q = q; renderShotsScreen(); } }, qLabel(q)));
  }
  qRow.append(el("button", { class: "btn small" + (f.heat ? " active" : ""), onclick: () => { f.heat = !f.heat; renderShotsScreen(); } }, "🔥 Mapa de calor"));
  root.append(qRow);

  /* tiros filtrados */
  let shots = allShots(m);
  const selected = s =>
    (f.team === "all" || s.team === f.team) &&
    (!f.pid || s.playerId === f.pid) &&
    (f.q === 0 || s.quarter === f.q);

  const wrap = el("div", { class: "court-wrap" });
  const svg = createCourtSVG({});
  paintHoops(svg, m, f.q || m.quarter);

  if (f.heat) {
    drawHeatZones(svg, m, shots.filter(selected));
  }
  for (const s of shots) {
    const isSel = selected(s);
    addShotDot(svg.shotsLayer, s, m.teams[s.team].color, {
      dim: !isSel, r: isSel && f.pid ? 0.34 : 0.26,
      title: describeEvent(m, s) + " · " + qLabel(s.quarter) + " " + fmtClock(s.clock)
    });
  }
  wrap.append(svg);
  root.append(wrap);

  /* eficiencia por zona */
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

function heatColor(ratio) {
  /* 0% rojo → 50% amarillo → 100% verde */
  const hue = Math.round(ratio * 120);
  return `hsl(${hue} 75% 55%)`;
}

/* sombrea las zonas (ambas mitades) según eficiencia */
function drawHeatZones(svg, m, shots) {
  const layer = svgEl("g", { class: "heat-layer" });
  const byHalf = { left: [], right: [] };
  for (const s of shots) byHalf[s.hoopSide].push(s);

  for (const side of ["left", "right"]) {
    const zs = zoneStats(byHalf[side].map(s => ({ ...s, hoopSide: side })));
    const mirror = x => side === "left" ? x : COURT.W - x;
    const zoneRects = {
      pintura: [
        { x: Math.min(mirror(0), mirror(COURT.PAINT_LEN)), y: COURT.H / 2 - COURT.PAINT_W / 2, w: COURT.PAINT_LEN, h: COURT.PAINT_W }
      ],
      esquina: [
        { x: Math.min(mirror(0), mirror(COURT.CORNER_X)), y: 0, w: COURT.CORNER_X, h: COURT.CORNER_MARGIN + 0.6 },
        { x: Math.min(mirror(0), mirror(COURT.CORNER_X)), y: COURT.H - COURT.CORNER_MARGIN - 0.6, w: COURT.CORNER_X, h: COURT.CORNER_MARGIN + 0.6 }
      ]
    };
    for (const key of ["pintura", "esquina"]) {
      const z = zs[key];
      if (!z.att) continue;
      for (const r of zoneRects[key]) {
        layer.append(svgEl("rect", {
          class: "zone-fill", x: r.x, y: r.y, width: r.w, height: r.h,
          fill: heatColor(z.made / z.att)
        }));
      }
    }
    /* media distancia y triple frontal: anillos aproximados con arcos */
    for (const [key, r0, r1] of [["media", 0, COURT.R3], ["frontal3", COURT.R3, COURT.R3 + 2.6]]) {
      const z = zs[key];
      if (!z.att) continue;
      const h = hoopPos(side);
      const ring = svgEl("circle", {
        class: "zone-fill", cx: h.x, cy: h.y, r: (r0 + r1) / 2,
        fill: "none", stroke: heatColor(z.made / z.att), "stroke-width": r1 - r0, opacity: 0.16
      });
      layer.append(ring);
    }
  }
  svg.insertBefore(layer, svg.shotsLayer);
}

/* ---------- LÍNEA DE TIEMPO ---------- */
function renderTimelineScreen() {
  const m = curMatch();
  if (!m) return showHome();
  const root = $("#screen");
  root.innerHTML = "";
  root.append(el("h1", null, "Jugadas"));
  root.append(el("p", { class: "sub" }, "Todas las acciones del partido. Tocá ✎ para corregir cualquiera — las estadísticas se recalculan al instante."));

  if (!m.events.length) {
    root.append(el("div", { class: "card sub" }, "Todavía no hay acciones registradas."));
    return;
  }

  const card = el("div", { class: "card" });
  for (const ev of [...m.events].reverse()) {
    const item = el("div", { class: "tl-item" });
    item.append(
      el("span", { class: "tl-time" }, qLabel(ev.quarter) + " " + fmtClock(ev.clock)),
      el("span", { class: "team-dot", style: { background: m.teams[ev.team].color } }),
      el("span", { class: "tl-desc", html: escHtml(describeEvent(m, ev)) }),
      el("button", { class: "btn small", onclick: () => editEventModal(m, ev) }, "✎"),
      el("button", {
        class: "btn small bad", onclick: () =>
          confirmModal("Borrar acción", describeEvent(m, ev), () => {
            removeEvent(m, ev.id);
            toast("Acción borrada; estadísticas recalculadas");
            renderTimelineScreen();
          }, "Borrar")
      }, "✕")
    );
    card.append(item);
  }
  root.append(card);
}

/* mini cancha para corregir la posición de un tiro.
   classify(x, y) devuelve los puntos (2/3) según las reglas del contexto. */
function shotMovePicker(ev, teamColor, classify, onMove) {
  const box = el("div", { style: { marginTop: "10px" } });
  box.append(el("label", { class: "fld" }, "Posición (tocá la cancha para moverlo)"));
  const wrap = el("div", { class: "court-wrap" });
  let pos = { x: ev.x, y: ev.y };
  const svg = createCourtSVG({
    onTap: (x, y) => {
      pos = { x: +x.toFixed(2), y: +y.toFixed(2) };
      render();
      onMove(pos, classify(pos.x, pos.y));
    }
  });
  const render = () => {
    svg.shotsLayer.innerHTML = "";
    addShotDot(svg.shotsLayer, { ...ev, ...pos }, teamColor, { r: 0.4 });
  };
  render();
  wrap.append(svg);
  box.append(wrap);
  box.getPos = () => pos;
  return box;
}

function editEventModal(m, ev) {
  const body = el("div");
  body.append(el("p", { class: "sub" }, qLabel(ev.quarter) + " " + fmtClock(ev.clock) + " · " + describeEvent(m, ev)));

  let playerSel = null, madeSel = null, ptsSel = null;

  if (ev.type !== "sub" && ev.type !== "timeout") {
    playerSel = el("select");
    for (const p of m.teams[ev.team].players) {
      playerSel.append(el("option", { value: p.id, selected: p.id === ev.playerId ? "" : null }, "#" + p.number + " " + p.name));
    }
    body.append(el("label", { class: "fld" }, "Jugador"), playerSel);
  }
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

    const side = attackSide(m, ev.team, ev.quarter);
    mover = shotMovePicker(ev, m.teams[ev.team].color,
      (x, y) => isThree(x, y, side) ? 3 : 2,
      (pos, pts) => { ptsSel.value = String(pts); });
    body.append(mover);
  }
  if (ev.type === "sub") {
    body.append(el("p", { class: "sub" }, "Los cambios se corrigen borrándolos y registrando el correcto."));
  }

  openModal("Corregir acción", body, [
    { label: "Cancelar", kind: "ghost" },
    {
      label: "Guardar", kind: "primary", onclick: () => {
        if (playerSel) ev.playerId = playerSel.value;
        if (madeSel) ev.made = madeSel.value === "1";
        if (ptsSel) ev.pts = +ptsSel.value;
        if (mover) { const p = mover.getPos(); ev.x = p.x; ev.y = p.y; }
        saveDB();
        toast("Acción corregida ✔");
        setTab(App.tab);
      }
    }
  ]);
}
