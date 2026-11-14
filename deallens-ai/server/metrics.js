// Deterministic metrics + evidence ledger. No AI in here: every number is
// computed from CRM records and carries the IDs of the records it came from.
const DAY = 86400000;

export const RULES = {
  staleDealDays: 21,        // no activity on an open deal for this long => stale
  noTouchDays: 30,          // no touchpoint on the account for this long => engagement gap
  recentWindowDays: 30,
  healthy: 75, watch: 50,   // score >= healthy: Healthy; >= watch: Watch; else At risk
};

export function inr(n) {
  if (n == null) return "—";
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const isClosed = (d) => /^closed/i.test(d.stage || "");
const daysBetween = (a, b) => Math.floor((a - b) / DAY);
const ts = (v) => (v ? new Date(v).getTime() : null);

const src = (rec, type, summary, extra = {}) => ({ id: rec.id, type, summary, ...extra });

export function buildBrief({ company, deals, activities, tasks, syncedAt }, now = Date.now(), rules = RULES) {
  const missing = [];
  const metrics = {}; // id -> metric (evidence ledger)
  const records = {}; // id -> raw record (for the evidence drawer)
  for (const r of [company, ...deals, ...activities, ...tasks]) records[r.id] = r;

  const metric = (id, label, value, display, formula, sources) => {
    metrics[id] = { id, label, value, display, formula, sources, syncedAt, computedAt: new Date(now).toISOString() };
    return metrics[id];
  };

  // ---------- Revenue ----------
  const open = deals.filter((d) => !isClosed(d));
  const withAmount = open.filter((d) => d.amount != null);
  for (const d of open) {
    if (d.amount == null) missing.push({ record: d.id, field: "amount", note: `${d.name}: amount missing, excluded from pipeline value` });
    if (d.close_date == null) missing.push({ record: d.id, field: "close_date", note: `${d.name}: close date missing` });
    if (d.probability == null) missing.push({ record: d.id, field: "probability", note: `${d.name}: probability missing, excluded from weighted value` });
  }
  if (company.employees == null) missing.push({ record: company.id, field: "employees", note: "Company size missing" });

  const pipeline = withAmount.reduce((s, d) => s + d.amount, 0);
  const weightable = withAmount.filter((d) => d.probability != null);
  const weighted = weightable.reduce((s, d) => s + d.amount * d.probability, 0);

  const dealSources = (list, f) => list.map((d) => src(d, "deal", `${d.name} (${d.stage})`, { amount: f(d) }));
  const mPipeline = metric("m.pipeline", "Open pipeline", pipeline, inr(pipeline),
    `Sum of amount over ${withAmount.length} open deal record(s) (stage not Closed).`, dealSources(withAmount, (d) => d.amount));
  const mWeighted = metric("m.weighted", "Weighted pipeline", weighted, inr(weighted),
    `Sum of amount × probability over ${weightable.length} open deal(s) with both fields.`, dealSources(weightable, (d) => d.amount * d.probability));

  // ---------- Engagement ----------
  const acts = [...activities].sort((a, b) => ts(b.occurred_at) - ts(a.occurred_at));
  const latest = acts[0];
  const daysSince = latest ? daysBetween(now, ts(latest.occurred_at)) : null;
  const recent = acts.filter((a) => daysBetween(now, ts(a.occurred_at)) <= rules.recentWindowDays);
  const mLatest = metric("m.lastTouch", "Days since last touchpoint", daysSince, daysSince == null ? "No activity" : `${daysSince}d`,
    "Today minus occurred_at of the most recent call/meeting/email.", latest ? [src(latest, "activity", `${latest.type}: ${latest.subject}`)] : []);
  const mRecent = metric("m.recentCount", `Touchpoints (last ${rules.recentWindowDays}d)`, recent.length, String(recent.length),
    `Count of activity records within ${rules.recentWindowDays} days.`, recent.map((a) => src(a, "activity", `${a.type}: ${a.subject}`)));

  // ---------- Risks ----------
  const lastActivityOf = (d) => ts(d.last_activity_at);
  const stale = open.filter((d) => lastActivityOf(d) != null && daysBetween(now, lastActivityOf(d)) > rules.staleDealDays);
  const slipped = open.filter((d) => ts(d.close_date) != null && ts(d.close_date) < now);
  const overdue = tasks.filter((t) => t.status !== "done" && ts(t.due_at) < now);
  const atRiskIds = new Set([...stale, ...slipped].map((d) => d.id));
  const atRiskDeals = open.filter((d) => atRiskIds.has(d.id) && d.amount != null);
  const atRisk = atRiskDeals.reduce((s, d) => s + d.amount, 0);

  const mStale = metric("m.staleDeals", `Stale deals (>${rules.staleDealDays}d idle)`, stale.length, String(stale.length),
    `Open deals whose last_activity_at is older than ${rules.staleDealDays} days.`,
    stale.map((d) => src(d, "deal", `${d.name}: idle ${daysBetween(now, lastActivityOf(d))}d`)));
  const mSlipped = metric("m.slipped", "Past-due close dates", slipped.length, String(slipped.length),
    "Open deals whose close_date is before today.", slipped.map((d) => src(d, "deal", `${d.name}: ${-daysBetween(ts(d.close_date), now)}d past close date`)));
  const mOverdue = metric("m.overdueTasks", "Overdue tasks", overdue.length, String(overdue.length),
    "Tasks not done with due_at before today.", overdue.map((t) => src(t, "task", `${t.title}: ${daysBetween(now, ts(t.due_at))}d overdue`)));
  const mAtRisk = metric("m.revenueAtRisk", "Revenue at risk", atRisk, inr(atRisk),
    "Sum of amount over open deals that are stale OR past their close date.", dealSources(atRiskDeals, (d) => d.amount));

  // ---------- Health score (every deduction is itemised) ----------
  const deductions = [];
  const deduct = (points, reason, sources) => { if (points > 0) deductions.push({ points, reason, sources }); };
  if (daysSince == null) deduct(30, "No recorded activity", []);
  else if (daysSince > rules.noTouchDays) deduct(20, `No touchpoint for ${daysSince} days`, mLatest.sources);
  else if (daysSince > 14) deduct(8, `Last touchpoint ${daysSince} days ago`, mLatest.sources);
  deduct(Math.min(30, stale.length * 15), `${stale.length} stale open deal(s)`, mStale.sources);
  deduct(Math.min(24, slipped.length * 12), `${slipped.length} open deal(s) past close date`, mSlipped.sources);
  deduct(Math.min(20, overdue.length * 7), `${overdue.length} overdue task(s)`, mOverdue.sources);
  if (open.length === 0) deduct(15, "No open pipeline", []);
  deduct(Math.min(9, missing.filter((m) => m.record !== company.id).length * 3), "Missing deal fields reduce confidence", []);
  const score = Math.max(0, 100 - deductions.reduce((s, d) => s + d.points, 0));
  const status = score >= rules.healthy ? "Healthy" : score >= rules.watch ? "Watch" : "At risk";
  const mHealth = metric("m.health", "Health score", score, `${score}/100`,
    `100 minus itemised deductions (Healthy ≥${rules.healthy}, Watch ≥${rules.watch}).`,
    deductions.flatMap((d) => d.sources).filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i));

  // ---------- Next steps (rule-based, each cites evidence) ----------
  const steps = [];
  const step = (priority, action, why, sources) => steps.push({ priority, action, why, sources });
  for (const d of slipped) step(1, `Re-confirm close date for "${d.name}" (${inr(d.amount)})`, `Close date passed ${-daysBetween(ts(d.close_date), now)} days ago while the deal is still open.`, [src(d, "deal", d.name)]);
  for (const t of overdue) step(2, `Complete overdue task: ${t.title}`, `Due ${daysBetween(now, ts(t.due_at))} days ago.`, [src(t, "task", t.title)]);
  for (const d of stale.filter((d) => !slipped.includes(d))) step(2, `Re-engage on "${d.name}"`, `No activity for ${daysBetween(now, lastActivityOf(d))} days.`, [src(d, "deal", d.name)]);
  if (daysSince != null && daysSince > rules.noTouchDays) step(1, "Schedule an executive touchpoint this week", `No account activity for ${daysSince} days.`, mLatest.sources);
  for (const m of missing.filter((m) => m.record !== company.id).slice(0, 3)) step(3, `Fill in ${m.field} on ${m.record}`, m.note, [{ id: m.record, type: "deal", summary: m.note }]);
  if (steps.length === 0) {
    const top = [...withAmount].sort((a, b) => b.amount - a.amount)[0];
    if (top) step(3, `Advance "${top.name}" to the next stage`, "Largest open deal and no active risks found.", [src(top, "deal", top.name)]);
  }
  steps.sort((a, b) => a.priority - b.priority);

  return {
    account: { id: company.id, name: company.name, industry: company.industry, owner: company.owner, city: company.city },
    syncedAt, computedAt: new Date(now).toISOString(),
    health: { status, score, deductions, metric: mHealth.id },
    revenue: { pipeline: mPipeline.id, weighted: mWeighted.id, atRisk: mAtRisk.id, openDeals: open.map((d) => ({ id: d.id, name: d.name, stage: d.stage, amount: d.amount, probability: d.probability, close_date: d.close_date })) },
    engagement: { lastTouch: mLatest.id, recent: mRecent.id, latest: latest ? { id: latest.id, type: latest.type, subject: latest.subject, occurred_at: latest.occurred_at } : null },
    risks: { stale: mStale.id, slipped: mSlipped.id, overdue: mOverdue.id, missing },
    nextSteps: steps,
    metrics, records,
  };
}

export function freshness(syncedAt, now = Date.now()) {
  const mins = Math.floor((now - new Date(syncedAt).getTime()) / 60000);
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`;
}
