// Markdown brief + evidence manifest exporters.
export function toMarkdown(b, narrativeText) {
  const m = b.metrics;
  const L = [];
  L.push(`# Account brief: ${b.account.name}`, `_Synced ${b.syncedAt} · Computed ${b.computedAt}_`, "");
  L.push(`**Health:** ${b.health.status} (${b.health.score}/100)`, "", `> AI narrative (inference, not fact): ${narrativeText}`, "");
  L.push("## Revenue", `- Open pipeline: ${m[b.revenue.pipeline].display}`, `- Weighted: ${m[b.revenue.weighted].display}`, `- At risk: ${m[b.revenue.atRisk].display}`, "");
  L.push("## Engagement", `- Days since last touchpoint: ${m[b.engagement.lastTouch].display}`, `- Touchpoints last 30d: ${m[b.engagement.recent].display}`, "");
  L.push("## Risks", `- Stale deals: ${m[b.risks.stale].display}`, `- Past-due close dates: ${m[b.risks.slipped].display}`, `- Overdue tasks: ${m[b.risks.overdue].display}`);
  for (const x of b.risks.missing) L.push(`- Missing data: ${x.note} (${x.record})`);
  L.push("", "## Next steps");
  b.nextSteps.forEach((s, i) => L.push(`${i + 1}. ${s.action} — ${s.why} [${s.sources.map((x) => x.id).join(", ")}]`));
  L.push("", "## Evidence", ...Object.values(m).map((x) => `- ${x.label} = ${x.display}: ${x.formula} Sources: ${x.sources.map((s) => s.id).join(", ") || "none"}`));
  return L.join("\n");
}

export function evidenceManifest(briefs) {
  return { generatedAt: new Date().toISOString(), accounts: briefs.map((b) => ({ account: b.account, syncedAt: b.syncedAt, metrics: b.metrics })) };
}
