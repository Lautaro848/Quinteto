/* ========== render SVG de la cancha completa ========== */
"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  return n;
}

/* Dibuja media cancha (líneas) para el lado 'left' o 'right' dentro de g */
function drawHalf(g, side) {
  const mirror = x => side === "left" ? x : COURT.W - x;
  const cy = COURT.H / 2;
  const hoop = hoopPos(side);

  /* pintura */
  const px = Math.min(mirror(0), mirror(COURT.PAINT_LEN));
  g.append(svgEl("rect", {
    class: "line", x: px, y: cy - COURT.PAINT_W / 2,
    width: COURT.PAINT_LEN, height: COURT.PAINT_W
  }));

  /* círculo de tiro libre */
  g.append(svgEl("circle", { class: "line", cx: mirror(COURT.PAINT_LEN), cy, r: COURT.FT_R }));

  /* tablero y aro */
  g.append(svgEl("line", {
    class: "line", x1: mirror(COURT.BOARD_FROM_BASE), y1: cy - 0.9,
    x2: mirror(COURT.BOARD_FROM_BASE), y2: cy + 0.9
  }));
  g.append(svgEl("circle", {
    class: "hoop-ring", "data-side": side,
    cx: hoop.x, cy: hoop.y, r: COURT.RIM_R,
    fill: "none", stroke: "#e8622c", "stroke-width": 0.1
  }));

  /* triple: rectas de esquina + arco */
  const yTop = COURT.CORNER_MARGIN, yBot = COURT.H - COURT.CORNER_MARGIN;
  const xc = mirror(COURT.CORNER_X);
  g.append(svgEl("line", { class: "line", x1: mirror(0), y1: yTop, x2: xc, y2: yTop }));
  g.append(svgEl("line", { class: "line", x1: mirror(0), y1: yBot, x2: xc, y2: yBot }));
  const sweep = side === "left" ? 1 : 0;
  g.append(svgEl("path", {
    class: "line",
    d: `M ${xc} ${yTop} A ${COURT.R3} ${COURT.R3} 0 0 ${sweep} ${xc} ${yBot}`
  }));
}

/* Cancha completa. opts: { onTap(x, y en metros) } */
function createCourtSVG(opts) {
  opts = opts || {};
  const svg = svgEl("svg", {
    class: "court-svg",
    viewBox: `-0.3 -0.3 ${COURT.W + 0.6} ${COURT.H + 0.6}`,
    preserveAspectRatio: "xMidYMid meet"
  });

  /* borde y mitad de cancha */
  svg.append(svgEl("rect", { class: "line", x: 0, y: 0, width: COURT.W, height: COURT.H }));
  svg.append(svgEl("line", { class: "line", x1: COURT.W / 2, y1: 0, x2: COURT.W / 2, y2: COURT.H }));
  svg.append(svgEl("circle", { class: "line", cx: COURT.W / 2, cy: COURT.H / 2, r: COURT.CENTER_R }));

  drawHalf(svg, "left");
  drawHalf(svg, "right");

  /* capa de tiros y decoraciones */
  const shotsLayer = svgEl("g", { class: "shots-layer" });
  svg.append(shotsLayer);
  svg.shotsLayer = shotsLayer;

  if (opts.onTap) {
    svg.addEventListener("pointerdown", e => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      if (p.x < -0.2 || p.x > COURT.W + 0.2 || p.y < -0.2 || p.y > COURT.H + 0.2) return;
      const x = Math.min(COURT.W, Math.max(0, p.x));
      const y = Math.min(COURT.H, Math.max(0, p.y));
      opts.onTap(x, y, e);
    });
  }
  return svg;
}

/* pinta cada aro del color del equipo que lo ataca en el cuarto dado */
function paintHoops(svg, match, quarter) {
  for (const ring of svg.querySelectorAll(".hoop-ring")) {
    const side = ring.getAttribute("data-side");
    const team = attackSide(match, "A", quarter) === side ? "A" : "B";
    ring.setAttribute("stroke", match.teams[team].color);
    ring.setAttribute("stroke-width", 0.16);
  }
}

/* flechas de dirección de ataque sobre la cancha */
function drawAttackArrows(svg, match, quarter) {
  let g = svg.querySelector(".arrows-layer");
  if (g) g.remove();
  g = svgEl("g", { class: "arrows-layer" });
  const cy = COURT.H / 2;
  for (const team of ["A", "B"]) {
    const side = attackSide(match, team, quarter);
    const dir = side === "right" ? 1 : -1;
    const y = team === "A" ? cy - 5.6 : cy + 5.6;
    const x0 = COURT.W / 2 - dir * 2.2, x1 = COURT.W / 2 + dir * 2.2;
    const col = match.teams[team].color;
    g.append(svgEl("line", {
      x1: x0, y1: y, x2: x1, y2: y,
      stroke: col, "stroke-width": 0.22, opacity: 0.85, "stroke-linecap": "round"
    }));
    g.append(svgEl("path", {
      d: `M ${x1} ${y} l ${-dir * 0.7} -0.45 l 0 0.9 Z`, fill: col, opacity: 0.85
    }));
  }
  svg.insertBefore(g, svg.shotsLayer);
}

/* agrega un punto de tiro */
function addShotDot(layer, shot, teamColor, opts) {
  opts = opts || {};
  const dot = svgEl("circle", {
    class: "shot-dot " + (shot.made ? "made" : "missed") + (opts.dim ? " dim" : ""),
    cx: shot.x, cy: shot.y, r: opts.r || 0.28,
    stroke: teamColor
  });
  if (opts.title) {
    const t = svgEl("title");
    t.textContent = opts.title;
    dot.append(t);
  }
  layer.append(dot);
  return dot;
}
