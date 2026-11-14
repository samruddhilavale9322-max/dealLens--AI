const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let briefs = [];

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r;
}

async function init() {
  const { accounts } = await (await api("/api/accounts")).json();
  const opts = accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)} — ${esc(a.industry)}</option>`).join("");
  $("selA").innerHTML = opts; $("selB").innerHTML = opts;
  $("selB").selectedIndex = Math.min(1, accounts.length - 1);
}

async function generate(refresh = false) {
  $("err").hidden = true;
  const ids = [$("selA").value, $("selB").value];
  if (ids[0] === ids[1]) return showErr("Pick two different accounts.");
  $("go").disabled = true; $("go").textContent = "Fetching via MCP…";
  try {
    briefs = await Promise.all(ids.map(async (id) => (await api(`/api/brief?id=${id}${refresh ? "&refresh=1" : ""}`)).json()));
    render();
  } catch (e) { showErr(e.message); }
  $("go").disabled = false; $("go").textContent = "Generate briefing";
}
const showErr = (m) => { $("err").textContent = m; $("err").hidden = false; };

function metricBtn(b, id, sub) {
  const m = b.metrics[id];
  return `<button class="metric" data-acct="${esc(b.account.id)}" data-m="${esc(id)}"><b>${esc(m.display)}</b><small>${esc(sub || m.label)}</small></button>`;
}
const srcLinks = (b, sources) => sources.map((s) => `<button class="src" data-acct="${esc(b.account.id)}" data-rec="${esc(s.id)}">${esc(s.id)}</button>`).join(" ");

function renderAccount(b) {
  const r = b.revenue, e = b.engagement, k = b.risks;
  return `<article class="acct">
    <h2>${esc(b.account.name)}</h2>
    <div class="meta">${esc(b.account.industry)} · ${esc(b.account.city)} · Owner ${esc(b.account.owner)}</div>
    <button class="metric" data-acct="${esc(b.account.id)}" data-m="${esc(b.health.metric)}" style="padding:4px 8px">
      <span class="badge ${esc(b.health.status.replace(" ", ""))}">${esc(b.health.status)} · ${b.health.score}/100</span></button>
    <div class="narr"><span class="tag">${b.narrative.source === "ai" ? "AI inference" : "Auto-summary"} · derived from the verified numbers below</span>${esc(b.narrative.text)}</div>

    <section class="q"><h3><span>01</span>Health — why this score</h3>
      <ul class="plain">${b.health.deductions.map((d) => `<li>−${d.points} ${esc(d.reason)} ${srcLinks(b, d.sources)}</li>`).join("") || "<li>No deductions.</li>"}</ul></section>

    <section class="q"><h3><span>02</span>Revenue</h3><div class="chips">
      ${metricBtn(b, r.pipeline)}${metricBtn(b, r.weighted)}${metricBtn(b, r.atRisk)}</div></section>

    <section class="q"><h3><span>03</span>Engagement</h3><div class="chips">
      ${metricBtn(b, e.lastTouch, "since last touchpoint")}${metricBtn(b, e.recent)}</div>
      ${e.latest ? `<p class="meta">Latest: ${esc(e.latest.type)} — ${esc(e.latest.subject)} ${srcLinks(b, [e.latest])}</p>` : ""}</section>

    <section class="q"><h3><span>04</span>Risks</h3><div class="chips">
      ${metricBtn(b, k.stale)}${metricBtn(b, k.slipped)}${metricBtn(b, k.overdue)}</div>
      ${k.missing.map((m) => `<div class="miss">⚠ Missing: ${esc(m.note)} ${srcLinks(b, [{ id: m.record }])}</div>`).join("")}</section>

    <section class="q"><h3><span>05</span>Next steps</h3>
      <ol class="plain">${b.nextSteps.map((s) => `<li class="step">${esc(s.action)} ${srcLinks(b, s.sources)}<small>${esc(s.why)}</small></li>`).join("")}</ol></section>
  </article>`;
}

function render() {
  $("cols").innerHTML = briefs.map(renderAccount).join("");
  const rows = [["Health", (b) => `${b.health.status} (${b.health.score})`], ["Open pipeline", (b) => b.metrics[b.revenue.pipeline].display],
    ["Weighted", (b) => b.metrics[b.revenue.weighted].display], ["At risk", (b) => b.metrics[b.revenue.atRisk].display],
    ["Days since touch", (b) => b.metrics[b.engagement.lastTouch].display], ["Overdue tasks", (b) => b.metrics[b.risks.overdue].display]];
  $("compare").hidden = false;
  $("compare").innerHTML = `<table><tr><th></th>${briefs.map((b) => `<th>${esc(b.account.name)}</th>`).join("")}</tr>${rows.map(([l, f]) => `<tr><td>${l}</td>${briefs.map((b) => `<td>${esc(f(b))}</td>`).join("")}</tr>`).join("")}</table>`;
  const synced = briefs.map((b) => b.syncedAt).sort()[0];
  $("sync").textContent = `Last synced ${new Date(synced).toLocaleTimeString()}`;
  for (const id of ["refresh", "exp-md", "exp-json", "print"]) $(id).disabled = false;
}

const find = (acct) => briefs.find((b) => b.account.id === acct);
function openDrawer(title, html) { $("d-title").textContent = title; $("d-body").innerHTML = html; $("drawer").hidden = false; $("scrim").hidden = false; }
const closeDrawer = () => { $("drawer").hidden = true; $("scrim").hidden = true; };

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-m],[data-rec]"); if (!t) return;
  const b = find(t.dataset.acct);
  if (t.dataset.m) {
    const m = b.metrics[t.dataset.m];
    openDrawer(`${m.label}: ${m.display}`, `
      <p><span class="tag">Calculation (deterministic, not AI)</span>${esc(m.formula)}</p>
      <p class="meta">Synced ${esc(m.syncedAt)}<br>Computed ${esc(m.computedAt)}</p>
      <span class="tag">Source records</span>
      ${m.sources.map((s) => `<div class="row"><span>${esc(s.summary)}</span><span>${s.amount != null ? esc(inr(s.amount)) : ""} <button class="src" data-acct="${esc(b.account.id)}" data-rec="${esc(s.id)}">${esc(s.id)}</button></span></div>`).join("") || "<p>No source records (absence of data).</p>"}
      ${b.health.metric === m.id ? `<span class="tag" style="margin-top:12px">Deductions</span>${b.health.deductions.map((d) => `<div class="row"><span>${esc(d.reason)}</span><b>−${d.points}</b></div>`).join("")}` : ""}`);
  } else {
    const rec = b.records[t.dataset.rec];
    openDrawer(`Record ${t.dataset.rec}`, `<div class="kv">${esc(JSON.stringify(rec, null, 2))}</div><p class="meta">Raw record as returned by the CRM through MCP.</p>`);
  }
});
function inr(n) { return n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(2)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`; }

$("go").onclick = () => generate(false);
$("refresh").onclick = () => generate(true);
$("print").onclick = () => window.print();
$("d-close").onclick = closeDrawer; $("scrim").onclick = closeDrawer;
const ids = () => briefs.map((b) => b.account.id).join(",");
$("exp-md").onclick = () => download(`/api/export?ids=${ids()}`, "deallens-brief.md");
$("exp-json").onclick = () => download(`/api/export?ids=${ids()}&format=json`, "deallens-evidence.json");
async function download(url, name) {
  const blob = await (await api(url)).blob();
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name }); a.click();
}
init().then(() => generate()).catch((e) => showErr(e.message));
