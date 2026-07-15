/* ========== motor de estadísticas ==========
   Todo se recalcula desde los eventos (event sourcing): borrar o
   corregir cualquier acción deja las estadísticas consistentes.     */
"use strict";

function blankLine() {
  return {
    pts: 0,
    p2m: 0, p2a: 0, p3m: 0, p3a: 0, ftm: 0, fta: 0,
    reb_o: 0, reb_d: 0, ast: 0, rob: 0, per: 0, tap: 0, foul: 0,
    plusminus: 0, secs: 0
  };
}

/* Estadísticas completas del partido.
   Devuelve { players: {A:{pid:line}, B:{...}}, team: {A:line,B:line},
              score:{A,B}, partials:[{q, A, B}], run:{team,pts}|null } */
function computeStats(match) {
  const players = { A: {}, B: {} };
  for (const t of ["A", "B"]) {
    for (const p of match.teams[t].players) players[t][p.id] = blankLine();
  }
  const line = (t, pid) => {
    if (!players[t][pid]) players[t][pid] = blankLine(); // jugador borrado: no rompe
    return players[t][pid];
  };

  const score = { A: 0, B: 0 };
  const partials = {};
  const addPts = (team, q, pts) => {
    score[team] += pts;
    if (!partials[q]) partials[q] = { A: 0, B: 0 };
    partials[q][team] += pts;
  };

  /* quintetos y minutos */
  const on = { A: new Set(match.starters.A), B: new Set(match.starters.B) };
  const lastIn = {};   // pid -> tiempo de juego en el que entró
  for (const t of ["A", "B"]) for (const pid of on[t]) lastIn[pid] = 0;

  const events = match.events;   // ya están en orden de seq
  let lastScorer = null, runPts = 0;

  for (const ev of events) {
    const t = ev.team, opp = t === "A" ? "B" : "A";
    const gt = gameElapsedAt(match, ev.quarter, ev.clock);

    if (ev.type === "sub") {
      if (on[t].has(ev.outId)) {
        const l = line(t, ev.outId);
        l.secs += Math.max(0, gt - (lastIn[ev.outId] ?? 0));
        on[t].delete(ev.outId);
      }
      on[t].add(ev.inId);
      lastIn[ev.inId] = gt;
      continue;
    }

    const l = ev.playerId ? line(t, ev.playerId) : null;
    let pts = 0;

    switch (ev.type) {
      case "shot":
        if (ev.pts === 3) { l.p3a++; if (ev.made) { l.p3m++; pts = 3; } }
        else { l.p2a++; if (ev.made) { l.p2m++; pts = 2; } }
        break;
      case "ft":
        l.fta++; if (ev.made) { l.ftm++; pts = 1; }
        break;
      case "ast": l.ast++; break;
      case "rob": l.rob++; break;
      case "per": l.per++; break;
      case "tap": l.tap++; break;
      case "reb_o": l.reb_o++; break;
      case "reb_d": l.reb_d++; break;
      case "foul": l.foul++; break;
    }

    if (pts > 0) {
      l.pts += pts;
      addPts(t, ev.quarter, pts);
      for (const pid of on[t]) line(t, pid).plusminus += pts;
      for (const pid of on[opp]) line(opp, pid).plusminus -= pts;
      /* corridas */
      if (lastScorer === t) runPts += pts;
      else { lastScorer = t; runPts = pts; }
    }
  }

  /* cerrar minutos al tiempo actual (o al final si terminó) */
  const endT = match.status === "finished"
    ? gameElapsedAt(match, match.quarter, 0)
    : gameElapsedNow(match);
  for (const t of ["A", "B"]) {
    for (const pid of on[t]) {
      line(t, pid).secs += Math.max(0, endT - (lastIn[pid] ?? 0));
    }
  }

  /* totales de equipo */
  const team = { A: blankLine(), B: blankLine() };
  for (const t of ["A", "B"]) {
    for (const l of Object.values(players[t])) {
      for (const k of Object.keys(team[t])) team[t][k] += l[k];
    }
  }

  /* lista de parciales ordenada Q1..Q4, PR... */
  const qMax = Math.max(4, ...Object.keys(partials).map(Number), match.quarter);
  const partialList = [];
  for (let q = 1; q <= qMax; q++) {
    partialList.push({ q, A: partials[q]?.A ?? 0, B: partials[q]?.B ?? 0 });
  }

  const run = (runPts >= 6 && match.status !== "finished")
    ? { team: lastScorer, pts: runPts } : null;

  return { players, team, score, partials: partialList, run };
}

/* valoración PIR (simplificada a lo que se registra) */
function pir(l) {
  return l.pts + l.reb_o + l.reb_d + l.ast + l.rob + l.tap
    - ((l.p2a - l.p2m) + (l.p3a - l.p3m) + (l.fta - l.ftm) + l.per + l.foul);
}

function fgLine(l) {
  const m = l.p2m + l.p3m, a = l.p2a + l.p3a;
  return { m, a };
}

/* eficiencia por zona para un conjunto de tiros */
function zoneStats(shots) {
  const z = {};
  for (const key of Object.keys(ZONE_NAMES)) z[key] = { made: 0, att: 0 };
  for (const s of shots) {
    const zone = shotZone(s.x, s.y, s.hoopSide);
    z[zone].att++;
    if (s.made) z[zone].made++;
  }
  return z;
}

/* tiros de campo del partido con el aro que correspondía en ese cuarto */
function allShots(match) {
  return match.events
    .filter(e => e.type === "shot")
    .map(e => ({ ...e, hoopSide: attackSide(match, e.team, e.quarter) }));
}
