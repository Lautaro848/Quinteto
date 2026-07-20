/* ========== utilidades ========== */
"use strict";

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

function fmtPct(made, att) {
  if (!att) return "–";
  return Math.round((made / att) * 100) + "%";
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function qLabel(q) {
  return q <= 4 ? "Q" + q : "PR" + (q - 4);
}

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* contraste: texto blanco o negro según color de fondo */
function textOn(hex) {
  const n = parseInt((hex || "#888").slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#111" : "#fff";
}

/* ---- toasts ---- */
function toast(msg, opts) {
  opts = opts || {};
  const t = el("div", { class: "toast" + (opts.hot ? " hot" : "") }, msg);
  $("#toast-wrap").append(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; }, opts.ms || 2200);
  setTimeout(() => t.remove(), (opts.ms || 2200) + 450);
}

/* ---- modal ---- */
function openModal(title, bodyNodes, buttons) {
  const wrap = $("#modal-wrap");
  wrap.innerHTML = "";
  const m = el("div", { class: "modal" });
  if (title) m.append(el("h3", null, title));
  for (const n of [].concat(bodyNodes || [])) if (n) m.append(n);
  if (buttons && buttons.length) {
    const row = el("div", { class: "row wrap", style: { marginTop: "14px", justifyContent: "flex-end" } });
    for (const b of buttons) {
      row.append(el("button", {
        class: "btn " + (b.kind || ""),
        onclick: () => { if (!b.onclick || b.onclick() !== false) closeModal(); }
      }, b.label));
    }
    m.append(row);
  }
  wrap.append(m);
  wrap.classList.remove("hidden");
  wrap.onclick = e => { if (e.target === wrap) closeModal(); };
  return m;
}
function closeModal() {
  const wrap = $("#modal-wrap");
  wrap.classList.add("hidden");
  wrap.innerHTML = "";
}

function confirmModal(title, msg, onOk, okLabel) {
  openModal(title, el("p", { class: "sub", style: { marginBottom: "0" } }, msg), [
    { label: "Cancelar", kind: "ghost" },
    { label: okLabel || "Confirmar", kind: "bad", onclick: onOk }
  ]);
}

/* ---- CSV (separador ; y BOM: abre bien en Excel en español) ---- */
function downloadCSV(name, rows) {
  const esc = v => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const text = "\uFEFF" + rows.map(r => r.map(esc).join(";")).join("\n");
  downloadFile(name, text, "text/csv;charset=utf-8");
}

/* ---- descarga de archivos ---- */
function downloadFile(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: type || "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
