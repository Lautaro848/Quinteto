/* ========== mi equipo y configuración del partido ========== */
"use strict";

/* opciones de personalización */
const PRESET_COLORS = ["#e8622c", "#3b82f6", "#38bdf8", "#22c55e", "#ef4444", "#a855f7", "#eab308", "#14b8a6", "#f472b6", "#f8fafc", "#111827"];
const TEAM_EMOJIS = ["🏀", "🦁", "🐯", "🦅", "🐺", "🐂", "🦈", "⚡", "🔥", "⭐", "🛡️", "👑"];
const TEAM_CATEGORIES = ["Mini", "U13", "U15", "U17", "U19", "U21", "Primera", "Maxi"];
const TEAM_GENDERS = [["M", "Masculino"], ["F", "Femenino"]];
const GENDER_SHORT = { M: "Masc.", F: "Fem." };

/* nombre + categoría + rama para mostrar: "Leones · U15 · Fem." */
function teamFullName(team) {
  return team.name +
    (team.category ? " · " + team.category : "") +
    (GENDER_SHORT[team.gender] ? " · " + GENDER_SHORT[team.gender] : "");
}

/* pastillas de categoría y rama */
function catBadge(team) {
  const frag = document.createDocumentFragment();
  if (team.category) frag.append(el("span", { class: "cat-badge" }, team.category));
  if (GENDER_SHORT[team.gender]) frag.append(el("span", { class: "cat-badge gender" }, GENDER_SHORT[team.gender]));
  return frag.childNodes.length ? frag : null;
}

function escName(m, t) { return m.teams[t].name.trim() || (t === "A" ? "Tu equipo" : "El rival"); }

/* insignia del equipo: foto del logo si hay, si no el emoji */
function teamMark(team, sizePx) {
  if (team.logo) {
    return el("img", {
      class: "team-logo", src: team.logo, alt: "",
      style: { width: sizePx + "px", height: sizePx + "px" }
    });
  }
  if (team.emoji) return el("span", null, team.emoji);
  return null;
}

function myTeam() {
  return App.db.savedTeams.find(t => t.id === App.db.myTeamId) || null;
}

/* ---- campos de personalización (nombre, color, escudo) ----
   Operan directo sobre el objeto team (de un partido o guardado). */
function personalizationFields(team, opts) {
  opts = opts || {};
  const nodes = [];

  nodes.push(el("label", { class: "fld" }, "Nombre"), el("input", {
    type: "text", value: team.name, maxlength: 28,
    placeholder: opts.namePlaceholder || "Nombre del equipo",
    oninput: e => { team.name = e.target.value; saveDB(); }
  }));

  /* color identificatorio: muestras + color libre */
  const swatches = el("div", { class: "swatches", style: { margin: "6px 0 10px" } });
  const customIn = el("input", {
    type: "color", value: team.color, title: "Otro color",
    oninput: e => { team.color = e.target.value; saveDB(); renderSwatches(); }
  });
  const renderSwatches = () => {
    swatches.innerHTML = "";
    for (const c of PRESET_COLORS) {
      swatches.append(el("button", {
        class: "swatch" + (team.color.toLowerCase() === c.toLowerCase() ? " active" : ""),
        style: { background: c }, title: c,
        onclick: () => { team.color = c; customIn.value = c; saveDB(); renderSwatches(); }
      }));
    }
    swatches.append(customIn);
  };
  renderSwatches();
  nodes.push(el("label", { class: "fld", style: { marginTop: "10px" } }, "Color identificatorio"), swatches);

  /* escudo: foto del logo (manda) o emoji (alternativa) */
  const logoRow = el("div", { class: "row", style: { marginBottom: "10px" } });
  const fileIn = el("input", { type: "file", accept: "image/*", style: { display: "none" } });
  fileIn.addEventListener("change", () => {
    const f = fileIn.files[0];
    if (!f) return;
    resizeImageFile(f, 128, dataUrl => {
      if (!dataUrl) { toast("⚠️ No pude leer esa imagen"); return; }
      team.logo = dataUrl;
      saveDB();
      renderLogo();
      toast("Logo cargado 🖼️");
    });
    fileIn.value = "";
  });
  const renderLogo = () => {
    logoRow.innerHTML = "";
    logoRow.append(fileIn);
    if (team.logo) {
      logoRow.append(
        el("img", { class: "team-logo", src: team.logo, style: { width: "44px", height: "44px" } }),
        el("button", { class: "btn small", onclick: () => fileIn.click() }, "📷 Cambiar foto"),
        el("button", {
          class: "btn small bad", title: "Quitar la foto",
          onclick: () => { team.logo = null; saveDB(); renderLogo(); }
        }, "✕")
      );
    } else {
      logoRow.append(el("button", { class: "btn small", onclick: () => fileIn.click() }, "📷 Subir foto del logo"));
    }
  };
  renderLogo();

  const emojiRow = el("div", { class: "emoji-row", style: { marginBottom: "12px" } });
  const renderEmojis = () => {
    emojiRow.innerHTML = "";
    emojiRow.append(el("button", {
      class: "emoji-btn" + (!team.emoji ? " active" : ""), title: "Sin escudo",
      onclick: () => { team.emoji = ""; saveDB(); renderEmojis(); }
    }, "–"));
    for (const em of TEAM_EMOJIS) {
      emojiRow.append(el("button", {
        class: "emoji-btn" + (team.emoji === em ? " active" : ""),
        onclick: () => { team.emoji = em; saveDB(); renderEmojis(); }
      }, em));
    }
  };
  renderEmojis();
  nodes.push(
    el("label", { class: "fld" }, "Escudo (se ve en el marcador): foto del logo…"), logoRow,
    el("label", { class: "fld" }, "…o un emoji"), emojiRow
  );

  return nodes;
}

/* ---- editor de plantel genérico ----
   opts.onDelete(p): limpieza extra al borrar (ej: sacarlo del quinteto)
   opts.onChange(): re-render externo tras agregar/borrar               */
function rosterEditor(team, opts) {
  opts = opts || {};
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
              if (opts.onDelete) opts.onDelete(p);
              saveDB();
              render();
              if (opts.onChange) opts.onChange();
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
    if (opts.onChange) opts.onChange();
  };
  nameIn.addEventListener("keydown", e => { if (e.key === "Enter") add(); });

  box.append(list, el("div", { class: "p-row" },
    numIn, nameIn, el("button", { class: "btn small ok", onclick: add }, "＋")
  ));
  return box;
}

/* ========== pantalla "Mi equipo" ==========
   Se crea una sola vez; cada partido nuevo lo carga solo. */
function showMyTeam() {
  App.screen = "myteam";
  $("#tabbar").classList.add("hidden");
  $("#topbar-info").textContent = "Mi equipo";

  let team = myTeam();
  if (!team) {
    team = { id: uid(), name: "", color: "#e8622c", emoji: "", players: [] };
    App.db.savedTeams.push(team);
    App.db.myTeamId = team.id;
    saveDB();
  }

  const root = $("#screen");
  root.innerHTML = "";
  root.append(el("h1", null, "Mi equipo"));
  root.append(el("p", { class: "sub" },
    "Lo creás una sola vez. En cada partido nuevo se carga solo y únicamente tenés que cargar al rival. El récord de la temporada es de este equipo."));

  const card = el("div", { class: "card" });
  card.append(...personalizationFields(team, { namePlaceholder: "Nombre de tu equipo (ej: Atlético Naranja)" }));

  /* categoría: para tener varios equipos del mismo club (U13, U15, Primera…) */
  const catRow = el("div", { class: "filters", style: { paddingBottom: "6px" } });
  const catIn = el("input", {
    type: "text", value: team.category || "", maxlength: 16,
    placeholder: "Otra categoría (ej: Mini, Sub-23, Veteranos)",
    oninput: e => { team.category = e.target.value.trim(); saveDB(); renderCats(); }
  });
  const renderCats = () => {
    catRow.innerHTML = "";
    for (const c of TEAM_CATEGORIES) {
      catRow.append(el("button", {
        class: "btn small" + (team.category === c ? " active" : ""),
        onclick: () => {
          team.category = team.category === c ? "" : c;
          catIn.value = team.category;
          saveDB(); renderCats();
        }
      }, c));
    }
  };
  renderCats();
  card.append(el("label", { class: "fld" }, "Categoría (opcional — podés tener varios equipos, ej: Leones U13 y Leones U15)"), catRow, catIn);

  /* rama: masculino / femenino, independiente de la categoría */
  const genRow = el("div", { class: "filters", style: { paddingBottom: "4px" } });
  const renderGenders = () => {
    genRow.innerHTML = "";
    for (const [code, label] of TEAM_GENDERS) {
      genRow.append(el("button", {
        class: "btn small" + (team.gender === code ? " active" : ""),
        onclick: () => { team.gender = team.gender === code ? "" : code; saveDB(); renderGenders(); }
      }, label));
    }
  };
  renderGenders();
  card.append(el("label", { class: "fld", style: { marginTop: "10px" } },
    "Rama (opcional — permite el mismo club y categoría en masculino y femenino)"), genRow);

  card.append(el("label", { class: "fld", style: { marginTop: "12px" } }, "Plantel (número y nombre)"));
  card.append(rosterEditor(team, {}));
  root.append(card);

  root.append(el("button", {
    class: "btn primary big",
    onclick: () => {
      if (!team.name.trim()) { toast("⚠️ Ponele un nombre a tu equipo"); return; }
      if (team.players.length < 5) { toast("⚠️ Cargá al menos 5 jugadores"); return; }
      saveDB();
      toast("Mi equipo guardado ✔");
      showHome();
    }
  }, "Guardar mi equipo ✔"));
  root.append(el("button", { class: "btn ghost big", style: { marginTop: "8px" }, onclick: showHome }, "Volver"));
}

/* ========== configuración del partido ========== */
function showSetup() {
  const m = curMatch();
  if (!m) return showHome();
  App.screen = "setup";
  $("#tabbar").classList.add("hidden");
  $("#topbar-info").textContent = "Configuración";
  const root = $("#screen");
  root.innerHTML = "";

  root.append(el("h1", null, "Nuevo partido"));
  root.append(el("p", { class: "sub" }, "Tu equipo ya está cargado: creá al rival, elegí el lado de ataque y los quintetos."));

  root.append(myTeamSetupCard(m), teamCard(m, "B"));

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
      "Tocá el aro al que ataca ", el("b", null, escName(m, "A")), " en el primer tiempo. El rival ataca el aro opuesto. Al entretiempo se invierte solo."),
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
        if (!m.teams[t].name.trim()) errs.push((t === "A" ? "Tu equipo" : "El rival") + ": ponele un nombre");
        else if (m.teams[t].players.length < 5) errs.push(escName(m, t) + ": cargá al menos 5 jugadores");
        else if (m.starters[t].length !== 5) errs.push(escName(m, t) + ": elegí el quinteto inicial (5)");
      }
      if (errs.length) { toast("⚠️ " + errs[0]); return; }
      m.status = "live";
      m.clockSec = m.quarterLengthMin * 60;
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

/* ---- tarjeta de tu equipo (ya cargado desde "Mi equipo") ---- */
function myTeamSetupCard(m) {
  const team = m.teams.A;
  const card = el("div", { class: "card" });
  card.append(el("h2", { style: { marginTop: 0 } }, "Tu equipo"));
  card.append(el("div", { class: "row", style: { marginBottom: "6px" } },
    el("span", { class: "team-dot", style: { background: team.color, width: "14px", height: "14px" } }),
    el("b", { class: "grow" }, teamMark(team, 22), " ", team.name || "Sin nombre", catBadge(team)),
    el("span", { class: "sub", style: { margin: 0 } }, team.players.length + " jugadores")
  ));
  card.append(el("p", { class: "sub", style: { marginBottom: "8px" } },
    "Cargado desde \"Mi equipo\". Los ajustes de acá abajo valen solo para este partido (ej: sacar a un jugador que hoy no vino)."));
  card.append(el("label", { class: "fld" }, "Plantel para este partido"));
  card.append(rosterEditor(team, {
    onDelete: p => { m.starters.A = m.starters.A.filter(x => x !== p.id); },
    onChange: () => showSetup()
  }));
  return card;
}

/* ---- tarjeta del rival (se crea desde cero) ---- */
function teamCard(m, t) {
  const team = m.teams[t];
  const card = el("div", { class: "card" });
  card.append(el("h2", { style: { marginTop: 0 } }, "Rival"));

  card.append(...personalizationFields(team, { namePlaceholder: "Nombre del rival" }));

  /* importar de partido anterior contra el mismo club */
  const pastRivals = App.db.matches.filter(x => x.id !== m.id && x.teams.B.players.length);
  if (pastRivals.length) {
    card.append(el("div", { class: "row wrap", style: { marginBottom: "10px" } },
      el("button", { class: "btn small", onclick: () => pickPastRival(m) }, "⏪ Rival de partido anterior")));
  }

  card.append(el("label", { class: "fld" }, "Plantel (número y nombre)"));
  card.append(rosterEditor(team, {
    onDelete: p => { m.starters[t] = m.starters[t].filter(x => x !== p.id); },
    onChange: () => showSetup()
  }));
  return card;
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
          m.teams.B.emoji = past.teams.B.emoji || "";
          m.teams.B.logo = past.teams.B.logo || null;
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
    title.textContent = "Quinteto inicial · " + escName(m, t) + " (" + count() + "/5)";
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
