/* ========== estado y persistencia ========== */
"use strict";

const DB_KEY = "quinteto.db.v1";

const App = {
  db: null,
  matchId: null,       // partido abierto
  tab: "game",         // pestaña activa en partido
  ui: {}               // estado efímero de la UI
};

function defaultDB() {
  return { savedTeams: [], matches: [], myTeamId: null };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    App.db = raw ? JSON.parse(raw) : defaultDB();
  } catch (e) {
    console.error("Error al leer datos guardados", e);
    App.db = defaultDB();
  }
  if (!App.db.savedTeams) App.db.savedTeams = [];
  if (!App.db.matches) App.db.matches = [];
}

function saveDB() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(App.db));
  } catch (e) {
    console.error("No se pudo guardar", e);
    toast("⚠️ No se pudo guardar (almacenamiento lleno)");
  }
}

function curMatch() {
  return App.db.matches.find(m => m.id === App.matchId) || null;
}

/* ---- equipos guardados ---- */
function upsertSavedTeam(team) {
  const i = App.db.savedTeams.findIndex(t => t.id === team.id);
  if (i >= 0) App.db.savedTeams[i] = team; else App.db.savedTeams.push(team);
  saveDB();
}

/* ---- partidos ---- */
function newMatch() {
  const m = {
    id: uid(),
    date: Date.now(),
    status: "setup",            // setup | live | finished
    quarterLengthMin: 10,
    otLengthMin: 5,
    attackRight: true,          // A ataca a la derecha en Q1/Q2
    teams: {
      A: { name: "Nosotros", color: "#e8622c", savedTeamId: null, players: [] },
      B: { name: "Rival", color: "#3b82f6", savedTeamId: null, players: [] }
    },
    starters: { A: [], B: [] },
    quarter: 1,
    clockSec: 10 * 60,
    running: false,
    events: [],
    seq: 0
  };
  App.db.matches.push(m);
  App.matchId = m.id;
  saveDB();
  return m;
}

function deleteMatch(id) {
  App.db.matches = App.db.matches.filter(m => m.id !== id);
  if (App.matchId === id) App.matchId = null;
  saveDB();
}

/* jugador: {id, number, name} */
function makePlayer(number, name) {
  return { id: uid(), number: String(number).trim(), name: String(name).trim() };
}

function playerById(match, team, pid) {
  return match.teams[team].players.find(p => p.id === pid) || null;
}

function playerLabel(match, team, pid) {
  const p = playerById(match, team, pid);
  return p ? "#" + p.number + " " + p.name : "¿?";
}

/* ---- tiempo de juego ---- */
function quarterLenSec(match, q) {
  return (q <= 4 ? match.quarterLengthMin : match.otLengthMin) * 60;
}

/* segundos de juego transcurridos desde el inicio hasta (quarter, clockSec restante) */
function gameElapsedAt(match, quarter, clockSec) {
  let t = 0;
  for (let q = 1; q < quarter; q++) t += quarterLenSec(match, q);
  return t + (quarterLenSec(match, quarter) - clockSec);
}

function gameElapsedNow(match) {
  return gameElapsedAt(match, match.quarter, match.clockSec);
}

/* ---- eventos ----
   Tipos: shot (x,y,pts,made) · ft (made) · ast · rob · per · tap ·
          reb_o · reb_d · foul · sub (inId,outId)                    */
function addEvent(match, ev) {
  ev.id = uid();
  ev.seq = ++match.seq;
  ev.quarter = ev.quarter ?? match.quarter;
  ev.clock = ev.clock ?? match.clockSec;
  match.events.push(ev);
  saveDB();
  return ev;
}

function removeEvent(match, evId) {
  match.events = match.events.filter(e => e.id !== evId);
  saveDB();
}

function eventById(match, evId) {
  return match.events.find(e => e.id === evId) || null;
}

/* quinteto en cancha de cada equipo justo despues de aplicar los eventos
   hasta 'uptoSeq' (Infinity = estado actual). Derivado de titulares + cambios. */
function lineupsAt(match, uptoSeq) {
  const on = { A: new Set(match.starters.A), B: new Set(match.starters.B) };
  for (const ev of match.events) {
    if (ev.seq > uptoSeq) break;
    if (ev.type === "sub") {
      on[ev.team].delete(ev.outId);
      on[ev.team].add(ev.inId);
    }
  }
  return on;
}

/* ---- export / import ---- */
function exportAll() {
  downloadFile("quinteto-backup-" + new Date().toISOString().slice(0, 10) + ".json",
    JSON.stringify(App.db, null, 2), "application/json");
  toast("Backup exportado 📦");
}

function importAll(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.matches)) throw new Error("formato inválido");
      App.db = data;
      if (!App.db.savedTeams) App.db.savedTeams = [];
      saveDB();
      App.matchId = null;
      showHome();
      toast("Datos importados ✔");
    } catch (e) {
      toast("⚠️ Archivo inválido");
    }
  };
  reader.readAsText(file);
}
