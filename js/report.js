/* ========== reporte post-partido ========== */
"use strict";

function renderReportScreen() {
  const m = curMatch();
  if (!m) return showHome();
  const root = $("#screen");
  root.innerHTML = "";
  const s = computeStats(m);

  root.append(el("h1", null, "Reporte del partido"));
  root.append(el("p", { class: "sub" }, fmtDate(m.date) + (m.status === "finished" ? " · Final" : " · En juego")));

  /* marcador */
  const score = el("div", { class: "card" });
  const deco = t => (m.teams[t].emoji ? m.teams[t].emoji + " " : "") + m.teams[t].name;
  score.append(el("div", { class: "hero-score" },
    el("span", { style: { color: m.teams.A.color } }, deco("A") + " "),
    s.score.A + " – " + s.score.B,
    el("span", { style: { color: m.teams.B.color } }, " " + deco("B"))
  ));
  const pt = el("table");
  const h = el("tr", null, el("th", null, ""));
  const rA = el("tr", null, el("th", null, m.teams.A.name.slice(0, 10)));
  const rB = el("tr", null, el("th", null, m.teams.B.name.slice(0, 10)));
  for (const p of s.partials) { h.append(el("th", null, qLabel(p.q))); rA.append(el("td", null, String(p.A))); rB.append(el("td", null, String(p.B))); }
  pt.append(h, rA, rB);
  score.append(el("div", { class: "sb-partials" }, pt));
  root.append(score);

  /* botones de exportación */
  root.append(el("div", { class: "row wrap no-print", style: { marginBottom: "12px" } },
    el("button", { class: "btn primary grow", onclick: () => downloadReportImage(m) }, "🖼️ Imagen p/ WhatsApp"),
    el("button", { class: "btn grow", onclick: () => window.print() }, "🖨️ PDF / Imprimir"),
    el("button", { class: "btn grow", onclick: () => shareSummary(m) }, "📤 Compartir texto"),
    el("button", { class: "btn grow", onclick: () => exportBoxscoreCSV(m, s) }, "📄 CSV / Excel")
  ));

  /* destacados */
  root.append(el("h2", null, "Destacados"));
  const hi = el("div", { class: "card" });
  for (const t of ["A", "B"]) {
    for (const line of highlights(m, t, s)) {
      hi.append(el("div", { class: "list-item" },
        el("span", { class: "team-dot", style: { background: m.teams[t].color } }),
        el("span", null, line)));
    }
  }
  if (!hi.children.length) hi.append(el("span", { class: "sub" }, "Sin acciones todavía."));
  root.append(hi);

  /* shot chart */
  root.append(el("h2", null, "Mapa de tiros"));
  const wrap = el("div", { class: "court-wrap card", style: { padding: "6px" } });
  const svg = createCourtSVG({});
  paintHoops(svg, m, m.quarter);
  for (const shot of allShots(m)) addShotDot(svg.shotsLayer, shot, m.teams[shot.team].color, { r: 0.26 });
  wrap.append(svg);
  root.append(wrap);

  /* boxscores */
  for (const t of ["A", "B"]) {
    root.append(el("h2", null, "Boxscore · " + m.teams[t].name));
    root.append(boxScoreTable(m, t, s));
  }

  if (m.status === "live") {
    root.append(el("button", {
      class: "btn bad big no-print", style: { marginTop: "14px" },
      onclick: () => confirmModal("Finalizar partido", "¿Dar por terminado el partido?", () => finishMatch(m), "Finalizar")
    }, "🏁 Finalizar partido"));
  }
}

/* boxscore de los dos equipos en CSV (abre en Excel/Sheets) */
function exportBoxscoreCSV(m, s) {
  const rows = [[m.teams.A.name + " " + s.score.A + " - " + s.score.B + " " + m.teams.B.name, fmtDate(m.date)]];
  for (const t of ["A", "B"]) {
    rows.push([]);
    rows.push([m.teams[t].name]);
    rows.push(["Jugador", "MIN", "PTS", "2PM", "2PA", "3PM", "3PA", "TLM", "TLA", "RO", "RD", "AST", "ROB", "PÉR", "TAP", "FP", "+/-", "PIR"]);
    const players = [...m.teams[t].players].sort((a, b) => (s.players[t][b.id]?.pts || 0) - (s.players[t][a.id]?.pts || 0));
    for (const p of players) {
      const l = s.players[t][p.id] || blankLine();
      rows.push(["#" + p.number + " " + p.name, fmtClock(l.secs), l.pts, l.p2m, l.p2a, l.p3m, l.p3a,
        l.ftm, l.fta, l.reb_o, l.reb_d, l.ast, l.rob, l.per, l.tap, l.foul, l.plusminus, pir(l)]);
    }
    const tot = s.team[t];
    rows.push(["TOTAL", "", tot.pts, tot.p2m, tot.p2a, tot.p3m, tot.p3a, tot.ftm, tot.fta,
      tot.reb_o, tot.reb_d, tot.ast, tot.rob, tot.per, tot.tap, tot.foul, "", ""]);
  }
  downloadCSV("quinteto-" + m.teams.A.name + "-vs-" + m.teams.B.name + ".csv", rows);
  toast("Boxscore exportado 📄");
}

/* mejores actuaciones tipo "Deker: 23 pts, 71% de campo" */
function highlights(m, t, s) {
  const out = [];
  const ranked = m.teams[t].players
    .map(p => ({ p, l: s.players[t][p.id] || blankLine() }))
    .filter(x => x.l.pts > 0 || pir(x.l) > 5)
    .sort((a, b) => pir(b.l) - pir(a.l))
    .slice(0, 2);
  for (const { p, l } of ranked) {
    const fg = fgLine(l);
    const bits = [l.pts + " pts"];
    if (fg.a >= 3) bits.push(fmtPct(fg.m, fg.a) + " de campo");
    const reb = l.reb_o + l.reb_d;
    if (reb >= 5) bits.push(reb + " reb");
    if (l.ast >= 3) bits.push(l.ast + " asist");
    if (l.rob >= 3) bits.push(l.rob + " robos");
    out.push(p.name + ": " + bits.join(", "));
  }
  return out;
}

function summaryText(m) {
  const s = computeStats(m);
  const lines = [
    "🏀 " + m.teams.A.name + " " + s.score.A + " – " + s.score.B + " " + m.teams.B.name,
    "Parciales: " + s.partials.map(p => p.A + "-" + p.B).join(" | ")
  ];
  for (const t of ["A", "B"]) for (const l of highlights(m, t, s)) lines.push("⭐ " + l);
  lines.push("— Planilla hecha con Quinteto");
  return lines.join("\n");
}

function shareSummary(m) {
  const text = summaryText(m);
  if (navigator.share) {
    navigator.share({ text }).catch(() => { });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast("Resumen copiado 📋 Pegalo en WhatsApp"));
  } else {
    openModal("Resumen", el("pre", { style: { whiteSpace: "pre-wrap", fontSize: ".85rem" } }, text), [{ label: "Cerrar", kind: "ghost" }]);
  }
}

/* ---- imagen del reporte (canvas, lista para compartir) ---- */
function downloadReportImage(m) {
  const s = computeStats(m);
  const W = 1080, H = 1400;
  const cv = el("canvas", { width: W, height: H });
  const ctx = cv.getContext("2d");

  ctx.fillStyle = "#12151c";
  ctx.fillRect(0, 0, W, H);

  /* header */
  ctx.fillStyle = "#e8622c";
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("🏀 Quinteto", 48, 78);
  ctx.fillStyle = "#8b94a7";
  ctx.font = "28px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(fmtDate(m.date), W - 48, 78);

  /* marcador */
  ctx.textAlign = "center";
  ctx.font = "bold 46px system-ui, sans-serif";
  const decoName = t => (m.teams[t].emoji ? m.teams[t].emoji + " " : "") + m.teams[t].name;
  ctx.fillStyle = m.teams.A.color;
  ctx.fillText(fitText(ctx, decoName("A"), 420), W * 0.27, 170);
  ctx.fillStyle = m.teams.B.color;
  ctx.fillText(fitText(ctx, decoName("B"), 420), W * 0.73, 170);
  ctx.fillStyle = "#eef1f6";
  ctx.font = "bold 120px system-ui, sans-serif";
  ctx.fillText(s.score.A + " - " + s.score.B, W / 2, 300);
  if (m.status === "finished") {
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillStyle = "#8b94a7";
    ctx.fillText("FINAL", W / 2, 345);
  }

  /* parciales */
  ctx.font = "26px system-ui, sans-serif";
  const pw = Math.min(120, (W - 200) / (s.partials.length + 1));
  let px0 = W / 2 - (pw * (s.partials.length + 1)) / 2;
  ctx.fillStyle = "#8b94a7";
  s.partials.forEach((p, i) => ctx.fillText(qLabel(p.q), px0 + pw * i + pw / 2, 400));
  ctx.fillText("T", px0 + pw * s.partials.length + pw / 2, 400);
  ctx.fillStyle = "#eef1f6";
  s.partials.forEach((p, i) => ctx.fillText(p.A + "-" + p.B, px0 + pw * i + pw / 2, 436));
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText(s.score.A + "-" + s.score.B, px0 + pw * s.partials.length + pw / 2, 436);

  /* cancha con tiros */
  const scale = (W - 96) / COURT.W;
  const cy0 = 490;
  drawCourtCanvas(ctx, 48, cy0, scale, m);
  for (const shot of allShots(m)) {
    const x = 48 + shot.x * scale, y = cy0 + shot.y * scale;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = shot.made ? "#35c46a" : "#e3453c";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = m.teams[shot.team].color;
    ctx.stroke();
  }

  /* destacados */
  let y = cy0 + COURT.H * scale + 70;
  ctx.textAlign = "left";
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.fillStyle = "#8b94a7";
  ctx.fillText("DESTACADOS", 48, y);
  y += 46;
  ctx.font = "30px system-ui, sans-serif";
  for (const t of ["A", "B"]) {
    for (const line of highlights(m, t, s)) {
      ctx.fillStyle = m.teams[t].color;
      ctx.fillText("●", 48, y);
      ctx.fillStyle = "#eef1f6";
      ctx.fillText(fitText(ctx, line, W - 140), 84, y);
      y += 44;
    }
  }

  /* totales de equipo */
  y += 30;
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.fillStyle = "#8b94a7";
  ctx.fillText("EQUIPOS", 48, y);
  y += 46;
  ctx.font = "28px system-ui, sans-serif";
  for (const t of ["A", "B"]) {
    const tot = s.team[t];
    const fg = fgLine(tot);
    ctx.fillStyle = m.teams[t].color;
    ctx.fillText("●", 48, y);
    ctx.fillStyle = "#eef1f6";
    ctx.fillText(fitText(ctx,
      m.teams[t].name + " — " + fmtPct(fg.m, fg.a) + " campo · " + (tot.reb_o + tot.reb_d) + " reb · " +
      tot.ast + " asist · " + tot.per + " pérd · " + tot.foul + " faltas", W - 140), 84, y);
    y += 44;
  }

  cv.toBlob(blob => {
    downloadFile("quinteto-" + m.teams.A.name + "-vs-" + m.teams.B.name + ".png", blob, "image/png");
    toast("Imagen descargada 🖼️ Lista para el grupo");
  }, "image/png");
}

function fitText(ctx, text, maxW) {
  let t = text;
  while (t.length > 4 && ctx.measureText(t).width > maxW) t = t.slice(0, -2);
  return t === text ? t : t + "…";
}

/* cancha simplificada en canvas para la imagen */
function drawCourtCanvas(ctx, ox, oy, k, m) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(k, k);
  ctx.lineWidth = 0.08;
  ctx.strokeStyle = "#c9a273";
  ctx.fillStyle = "#23180f";
  ctx.fillRect(0, 0, COURT.W, COURT.H);
  ctx.strokeRect(0, 0, COURT.W, COURT.H);
  ctx.beginPath(); ctx.moveTo(COURT.W / 2, 0); ctx.lineTo(COURT.W / 2, COURT.H); ctx.stroke();
  ctx.beginPath(); ctx.arc(COURT.W / 2, COURT.H / 2, COURT.CENTER_R, 0, Math.PI * 2); ctx.stroke();

  for (const side of ["left", "right"]) {
    const mir = x => side === "left" ? x : COURT.W - x;
    const cy = COURT.H / 2;
    const h = hoopPos(side);
    ctx.strokeRect(Math.min(mir(0), mir(COURT.PAINT_LEN)), cy - COURT.PAINT_W / 2, COURT.PAINT_LEN, COURT.PAINT_W);
    ctx.beginPath(); ctx.arc(mir(COURT.PAINT_LEN), cy, COURT.FT_R, 0, Math.PI * 2); ctx.stroke();
    /* triple */
    const yT = COURT.CORNER_MARGIN, yB = COURT.H - COURT.CORNER_MARGIN;
    ctx.beginPath();
    ctx.moveTo(mir(0), yT); ctx.lineTo(mir(COURT.CORNER_X), yT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mir(0), yB); ctx.lineTo(mir(COURT.CORNER_X), yB);
    ctx.stroke();
    const a = Math.asin((cy - yT) / COURT.R3);
    ctx.beginPath();
    if (side === "left") ctx.arc(h.x, h.y, COURT.R3, -a, a);
    else ctx.arc(h.x, h.y, COURT.R3, Math.PI - a, Math.PI + a);
    ctx.stroke();
    /* aro del color del equipo que lo ataca en el último cuarto */
    const team = attackSide(m, "A", m.quarter) === side ? "A" : "B";
    ctx.beginPath(); ctx.arc(h.x, h.y, COURT.RIM_R, 0, Math.PI * 2);
    ctx.strokeStyle = m.teams[team].color;
    ctx.lineWidth = 0.16;
    ctx.stroke();
    ctx.strokeStyle = "#c9a273";
    ctx.lineWidth = 0.08;
  }
  ctx.restore();
}
