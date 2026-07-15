/* ========== configuración del partido ========== */
"use strict";

function showSetup() {
  const m = curMatch();
  if (!m) return showHome();
  App.screen = "setup";
  $("#tabbar").classList.add("hidden");
  $("#topbar-info").textContent = "Configuración";
  const root = $("#screen");
  root.innerHTML = "";

  root.append(el("h1", null, "Nuevo partido"));
  root.append(el("p", { class: "sub" }, "Cargá los equipos, elegí el lado de ataque y el quinteto inicial."));

  root.append(teamCard(m, "A"), teamCard(m, "B"));

  /* ---- lado de ataque ---- */
  const sideCard = el("div", { class: "card" });
  sideCard.append(el("h2", { style: { marginTop: 0 } }, "Lado de ataque · 1er tiempo"));
  const preview = el("div", { class: "court-wrap" });
  const svg = createCourtSVG({
    onTap: x => { m.attackRight = x >= COURT.W / 2; saveDB(); refresh(); }
  });
  preview.append(svg);
  const dirTxt = el("div", { class: "dir-bar" });
  const refresh = () => {
    paintHoops(svg, m, 1);
    drawAttackArrows(svg, m, 1);
    const right = m.attackRight;
    dirTxt.innerHTML = "";
    dirTxt.append(
      el("span", null, right ? escName(m, "B") + " ataca ⬅" : escName(m, "A") + " ataca ⬅"),
      el("span", null, right ? escName(m, "A") + " ataca ➡" : escName(m, "B") + " ataca ➡")
    );
  };
  sideCard.append(
    el("p", { class: "sub", style: { marginBottom: "8px" } },
      "Tocá el aro al que ataca ", el("b", null, m.teams.A.name), " en el primer tiempo. El rival ataca el aro opuesto. Al entretiempo se invierte solo."),
    preview, dirTxt
  );
  root.append(sideCard);

  /* ---- duración de cuartos ---- */
  const durCard = el("div", { class: "card row" });
  durCard.append(el("div", { class: "grow" }, el("label", { class: "fld" }, "Minutos por cuarto"),
    (() => {
      const s = el("select", {
        onchange: e => {
          m.quarterLengthMin = +e.target.value;
          if (m.status === "setup") m.clockSec = m.quarterLengthMin * 60;
          saveDB();
        }
      });
      for (const v of [6, 8, 10, 12]) {
        s.append(el("option", { value: v, selected: m.quarterLengthMin === v ? "" : null }, v + " min"));
      }
      return s;
    })()
  ));
  root.append(durCard);

  /* ---- quintetos iniciales ---- */
  root.append(startersCard(m, "A"), startersCard(m, "B"));

  /* ---- empezar ---- */
  const startBtn = el("button", {
    class: "btn primary big",
    onclick: () => {
      const errs = [];
      for (const t of ["A", "B"]) {
        if (m.teams[t].players.length < 5) errs.push(m.teams[t].name + ": cargá al menos 5 jugadores");
        else if (m.starters[t].length !== 5) errs.push(m.teams[t].name + ": elegí el quinteto inicial (5)");
      }
      if (errs.length) { toast("⚠️ " + errs[0]); return; }
      m.status = "live";
      m.clockSec = m.quarterLengthMin * 60;
      persistMyTeam(m);
      saveDB();
      showGame();
      toast("¡Salto inicial! 🏀");
    }
  }, "Empezar partido ▶");
  root.append(startBtn);
  root.append(el("button", {
    class: "btn ghost big", style: { marginTop: "8px" },
    onclick: () => confirmModal("Descartar partido", "¿Borrar esta configuración?", () => { deleteMatch(m.id); showHome(); })
  }, "Descartar"));

  refresh();
}

function escName(m, t) { return m.teams[t].name; }

/* guarda el plantel del equipo A para reutilizar */
function persistMyTeam(m) {
  const tA = m.teams.A;
  const id = tA.savedTeamId || uid();
  tA.savedTeamId = id;
  App.db.myTeamId = id;
  upsertSavedTeam({ id, name: tA.name, color: tA.color, players: JSON.parse(JSON.stringify(tA.players)) });
}

/* ---- tarjeta de equipo ---- */
function teamCard(m, t) {
  const team = m.teams[t];
  const card = el("div", { class: "card" });
  card.append(el("h2", { style: { marginTop: 0 } }, t === "A" ? "Tu equipo" : "Rival"));

  const nameIn = el("input", {
    type: "text", value: team.name, placeholder: "Nombre del equipo",
    oninput: e => { team.name = e.target.value; saveDB(); }
  });
  const colorIn = el("input", {
    type: "color", value: team.color,
    oninput: e => { team.color = e.target.value; saveDB(); }
  });
  card.append(el("div", { class: "row", style: { marginBottom: "10px" } }, el("div", { class: "grow" }, nameIn), colorIn));

  /* cargar guardados / importar de partido anterior */
  const loadRow = el("div", { class: "row wrap", style: { marginBottom: "10px" } });
  if (App.db.savedTeams.length) {
    loadRow.append(el("button", { class: "btn small", onclick: () => pickSavedTeam(m, t) }, "📂 Plantel guardado"));
  }
  const pastRivals = App.db.matches.filter(x => x.id !== m.id && x.teams.B.players.length);
  if (t === "B" && pastRivals.length) {
    loadRow.append(el("button", { class: "btn small", onclick: () => pickPastRival(m) }, "⏪ De partido anterior"));
  }
  if (loadRow.children.length) card.append(loadRow);

  card.append(rosterEditor(m, t, () => showSetup()));
  return card;
}

/* editor de plantel (también se usa con partido empezado) */
function rosterEditor(m, t, onChange) {
  const team = m.teams[t];
  const box = el("div");

  const list = el("div");
  const render = () => {
    list.innerHTML = "";
    for (const p of team.players) {
      list.append(el("div", { class: "p-row" },
        el("input", {
          type: "text", value: p.number, inputmode: "numeric", placeholder: "N°",
          oninput: e => { p.number = e.target.value.trim(); saveDB(); }
        }),
        el("input", {
          type: "text", value: p.name, placeholder: "Nombre",
          oninput: e => { p.name = e.target.value; saveDB(); }
        }),
        el("button", {
          class: "btn small bad", title: "Borrar jugador",
          onclick: () => {
            confirmModal("Borrar jugador", "¿Borrar a #" + p.number + " " + p.name + "?", () => {
              team.players = team.players.filter(x => x.id !== p.id);
              m.starters[t] = m.starters[t].filter(x => x !== p.id);
              saveDB();
              render();
              if (onChange) onChange();
            });
          }
        }, "✕")
      ));
    }
  };
  render();

  const numIn = el("input", { type: "text", inputmode: "numeric", placeholder: "N°" });
  const nameIn = el("input", { type: "text", placeholder: "Nombre del jugador" });
  const add = () => {
    if (!numIn.value.trim() && !nameIn.value.trim()) return;
    if (team.players.some(p => p.number === numIn.value.trim())) { toast("⚠️ Ese número ya existe"); return; }
    team.players.push(makePlayer(numIn.value || "?", nameIn.value || "Jugador"));
    saveDB();
    numIn.value = ""; nameIn.value = ""; numIn.focus();
    render();
    if (onChange) onChange();
  };
  nameIn.addEventListener("keydown", e => { if (e.key === "Enter") add(); });

  box.append(list, el("div", { class: "p-row" },
    numIn, nameIn, el("button", { class: "btn small ok", onclick: add }, "＋")
  ));
  return box;
}

function pickSavedTeam(m, t) {
  const body = el("div");
  for (const st of App.db.savedTeams) {
    body.append(el("div", { class: "list-item" },
      el("span", { class: "team-dot", style: { background: st.color } }),
      el("div", { class: "grow" }, el("b", null, st.name), el("div", { class: "sub", style: { margin: 0 } }, st.players.length + " jugadores")),
      el("button", {
        class: "btn small primary", onclick: () => {
          m.teams[t].name = st.name;
          m.teams[t].color = st.color;
          m.teams[t].savedTeamId = st.id;
          m.teams[t].players = st.players.map(p => ({ ...p, id: uid() }));
          m.starters[t] = [];
          saveDB(); closeModal(); showSetup();
        }
      }, "Usar")
    ));
  }
  openModal("Planteles guardados", body, [{ label: "Cerrar", kind: "ghost" }]);
}

function pickPastRival(m) {
  const body = el("div");
  const seen = new Set();
  for (const past of [...App.db.matches].reverse()) {
    if (past.id === m.id || !past.teams.B.players.length) continue;
    const key = past.teams.B.name;
    if (seen.has(key)) continue;
    seen.add(key);
    body.append(el("div", { class: "list-item" },
      el("span", { class: "team-dot", style: { background: past.teams.B.color } }),
      el("div", { class: "grow" }, el("b", null, past.teams.B.name),
        el("div", { class: "sub", style: { margin: 0 } }, fmtDate(past.date) + " · " + past.teams.B.players.length + " jugadores")),
      el("button", {
        class: "btn small primary", onclick: () => {
          m.teams.B.name = past.teams.B.name;
          m.teams.B.color = past.teams.B.color;
          m.teams.B.players = past.teams.B.players.map(p => ({ ...p, id: uid() }));
          m.starters.B = [];
          saveDB(); closeModal(); showSetup();
        }
      }, "Usar")
    ));
  }
  openModal("Rivales anteriores", body, [{ label: "Cerrar", kind: "ghost" }]);
}

/* ---- quinteto inicial ---- */
function startersCard(m, t) {
  const team = m.teams[t];
  const card = el("div", { class: "card" });
  const count = () => m.starters[t].length;
  const title = el("h2", { style: { marginTop: 0 } });
  const grid = el("div", { class: "starter-grid" });

  const render = () => {
    title.textContent = "Quinteto inicial · " + team.name + " (" + count() + "/5)";
    grid.innerHTML = "";
    for (const p of team.players) {
      const sel = m.starters[t].includes(p.id);
      grid.append(playerChip(p, team.color, {
        selected: sel, onCourt: sel,
        onclick: () => {
          if (sel) m.starters[t] = m.starters[t].filter(x => x !== p.id);
          else if (count() < 5) m.starters[t].push(p.id);
          else { toast("⚠️ Ya hay 5; sacá uno primero"); return; }
          saveDB(); render();
        }
      }));
    }
    if (!team.players.length) grid.append(el("span", { class: "sub" }, "Cargá jugadores arriba."));
  };
  render();
  card.append(title, grid);
  return card;
}

/* chip circular de jugador */
function playerChip(p, color, opts) {
  opts = opts || {};
  const chip = el("button", {
    class: "chip" + (opts.onCourt ? " oncourt" : " bench-p") + (opts.selected ? " selected" : ""),
    style: { borderColor: color },
    onclick: opts.onclick
  },
    p.number,
    el("small", null, p.name)
  );
  if (opts.fouls) chip.append(el("span", { class: "fouls" }, opts.fouls + "F"));
  return chip;
}
