// Narrative = "AI inference" layer. It only ever sees the verified brief, never raw
// CRM data. With ANTHROPIC_API_KEY set it asks Claude to explain; the output is
// rejected if it contains any number that is not present in the verified context.
import { inr } from "./metrics.js";

export function templateNarrative(b) {
  const m = b.metrics, a = b.account;
  const parts = [
    `${a.name} is ${b.health.status} (${b.health.score}/100).`,
    `Open pipeline is ${m[b.revenue.pipeline].display} (${m[b.revenue.weighted].display} weighted); ${m[b.revenue.atRisk].display} is at risk from stale or slipped deals.`,
    m[b.engagement.lastTouch].value == null ? "There is no recorded engagement." : `The last touchpoint was ${m[b.engagement.lastTouch].display} ago, with ${m[b.engagement.recent].display} in the last 30 days.`,
  ];
  if (b.nextSteps[0]) parts.push(`Top priority: ${b.nextSteps[0].action}.`);
  if (b.risks.missing.length) parts.push(`${b.risks.missing.length} field(s) are missing in the CRM, so some figures are partial.`);
  return { text: parts.join(" "), source: "template" };
}

const numbersIn = (s) => (s.match(/\d+(?:\.\d+)?/g) || []);

export async function narrative(b, { apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.DEALLENS_MODEL || "claude-sonnet-5-5", fetchImpl = fetch } = {}) {
  const fallback = templateNarrative(b);
  if (!apiKey) return fallback;
  const context = {
    account: b.account, health: b.health.status, score: b.health.score,
    metrics: Object.values(b.metrics).map((x) => ({ label: x.label, value: x.display })),
    deductions: b.health.deductions.map((d) => d.reason),
    nextSteps: b.nextSteps.map((s) => s.action), missingFields: b.risks.missing.map((m) => m.note),
  };
  try {
    const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, max_tokens: 400,
        system: "You write a 3-4 sentence account briefing for a sales manager. Use ONLY the facts in the JSON. Never invent numbers, names or dates. If data is missing, say so. Plain prose, no markdown.",
        messages: [{ role: "user", content: JSON.stringify(context) }],
      }),
    });
    if (!res.ok) return fallback;
    const text = (await res.json()).content?.find((c) => c.type === "text")?.text?.trim();
    if (!text) return fallback;
    const allowed = new Set(numbersIn(JSON.stringify(context)));
    if (numbersIn(text).some((n) => !allowed.has(n))) return { ...fallback, note: "AI text rejected: contained ungrounded numbers" };
    return { text, source: "ai" };
  } catch { return fallback; }
}
