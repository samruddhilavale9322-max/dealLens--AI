#!/usr/bin/env node
// Minimal read-only CRM MCP server (JSON-RPC 2.0 over stdio, newline-delimited).
// Implements initialize, tools/list and tools/call from the Model Context Protocol.
// Swap this for the HubSpot / Zoho remote MCP server in production; the client
// in server/mcpClient.js only depends on the tool names declared below.
import readline from "node:readline";
import { buildSeed } from "./seed.js";

const data = buildSeed();

const tools = [
  { name: "crm_list_companies", description: "List companies (id, name, industry, owner).", inputSchema: { type: "object", properties: {} } },
  { name: "crm_get_company", description: "Get one company record by id.", inputSchema: { type: "object", properties: { company_id: { type: "string" } }, required: ["company_id"] } },
  { name: "crm_list_deals", description: "List deals for a company (all stages).", inputSchema: { type: "object", properties: { company_id: { type: "string" } }, required: ["company_id"] } },
  { name: "crm_list_activities", description: "List calls, meetings and emails for a company.", inputSchema: { type: "object", properties: { company_id: { type: "string" } }, required: ["company_id"] } },
  { name: "crm_list_tasks", description: "List tasks for a company.", inputSchema: { type: "object", properties: { company_id: { type: "string" } }, required: ["company_id"] } },
].map((t) => ({ ...t, annotations: { readOnlyHint: true } }));

function callTool(name, args = {}) {
  const cid = args.company_id;
  const out = (payload) => ({ content: [{ type: "text", text: JSON.stringify({ syncedAt: new Date().toISOString(), ...payload }) }] });
  switch (name) {
    case "crm_list_companies": return out({ records: data.companies });
    case "crm_get_company": {
      const rec = data.companies.find((c) => c.id === cid);
      if (!rec) throw Object.assign(new Error(`Company not found: ${cid}`), { code: -32602 });
      return out({ records: [rec] });
    }
    case "crm_list_deals": return out({ records: data.deals.filter((r) => r.company_id === cid) });
    case "crm_list_activities": return out({ records: data.activities.filter((r) => r.company_id === cid) });
    case "crm_list_tasks": return out({ records: data.tasks.filter((r) => r.company_id === cid) });
    default: throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }
}

function handle(msg) {
  switch (msg.method) {
    case "initialize":
      return { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "deallens-demo-crm", version: "0.1.0" } };
    case "tools/list": return { tools };
    case "tools/call": return callTool(msg.params?.name, msg.params?.arguments);
    case "ping": return {};
    default: throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return; // notification (e.g. notifications/initialized)
  try {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: handle(msg) }) + "\n");
  } catch (e) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: e.code ?? -32603, message: e.message } }) + "\n");
  }
});
