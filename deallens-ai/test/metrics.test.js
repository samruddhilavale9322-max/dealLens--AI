import test from "node:test";
import assert from "node:assert/strict";
import { buildBrief } from "../server/metrics.js";
import { buildSeed } from "../mcp/seed.js";
import { narrative } from "../server/narrative.js";
import { McpClient } from "../server/mcpClient.js";
import { fetchAccountData } from "../server/crm.js";

const seed = buildSeed();
const forCompany = (id) => ({
  company: seed.companies.find((c) => c.id === id),
  deals: seed.deals.filter((d) => d.company_id === id),
  activities: seed.activities.filter((d) => d.company_id === id),
  tasks: seed.tasks.filter((d) => d.company_id === id),
  syncedAt: seed.syncedAt,
});

test("Northwind pipeline is the sum of its 3 open deals, with source IDs", () => {
  const b = buildBrief(forCompany("C-100"));
  const m = b.metrics[b.revenue.pipeline];
  assert.equal(m.value, 1250000);
  assert.equal(m.display, "₹12.5L");
  assert.deepEqual(m.sources.map((s) => s.id).sort(), ["D-1042", "D-1091", "D-1108"]);
  assert.equal(b.health.status, "Healthy");
});

test("Acme is At risk; revenue at risk counts stale/slipped deals only", () => {
  const b = buildBrief(forCompany("C-200"));
  assert.equal(b.health.status, "At risk");
  assert.equal(b.metrics[b.revenue.atRisk].value, 3300000); // D-2001 + D-2014
  assert.equal(b.metrics[b.risks.overdue].value, 2);
  assert.ok(b.nextSteps.every((s) => s.sources.length > 0), "every next step cites evidence");
});

test("Missing data is reported, never invented", () => {
  const b = buildBrief(forCompany("C-400"));
  const fields = b.risks.missing.map((m) => m.field);
  assert.ok(fields.includes("amount") && fields.includes("probability") && fields.includes("close_date"));
  assert.equal(b.metrics[b.revenue.pipeline].value, 600000); // null amount excluded
});

test("Every metric source resolves to a raw record", () => {
  for (const id of ["C-100", "C-200", "C-300", "C-400"]) {
    const b = buildBrief(forCompany(id));
    for (const m of Object.values(b.metrics)) for (const s of m.sources) assert.ok(b.records[s.id], `${s.id} missing`);
  }
});

test("AI narrative with ungrounded numbers is rejected", async () => {
  const b = buildBrief(forCompany("C-100"));
  const fake = async () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "Pipeline is 999 crore." }] }) });
  const r = await narrative(b, { apiKey: "k", fetchImpl: fake });
  assert.equal(r.source, "template");
});

test("MCP client talks to the demo server and stays read-only", async () => {
  const mcp = new McpClient({ command: process.execPath, args: ["mcp/crm-server.js"] });
  const tools = await mcp.connect();
  assert.ok(tools.includes("crm_list_deals"));
  const data = await fetchAccountData(mcp, "C-100");
  assert.equal(data.deals.length, 4);
  await assert.rejects(() => mcp.callTool("crm_delete_deal", {}));
  mcp.close();
});
