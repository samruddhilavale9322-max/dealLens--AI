import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpClient } from "./mcpClient.js";
import { fetchAccountData } from "./crm.js";
import { buildBrief } from "./metrics.js";
import { narrative } from "./narrative.js";
import { toMarkdown, evidenceManifest } from "./export.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || 3000;

// MCP server to connect to. Default: the bundled read-only demo CRM.
const mcp = new McpClient({
  command: process.env.DEALLENS_MCP_COMMAND || process.execPath,
  args: process.env.DEALLENS_MCP_ARGS ? process.env.DEALLENS_MCP_ARGS.split(" ") : [path.join(root, "mcp/crm-server.js")],
});

const cache = new Map();
async function getBrief(id, refresh) {
  if (!refresh && cache.has(id) && Date.now() - cache.get(id).at < 60000) return cache.get(id).value;
  const data = await fetchAccountData(mcp, id);
  const brief = buildBrief(data);
  brief.narrative = await narrative(brief);
  cache.set(id, { at: Date.now(), value: brief });
  return brief;
}

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/api/accounts") {
      const { records, syncedAt } = await mcp.callTool("crm_list_companies", {});
      return send(res, 200, { accounts: records, syncedAt });
    }
    if (url.pathname === "/api/brief") {
      return send(res, 200, await getBrief(url.searchParams.get("id"), url.searchParams.get("refresh") === "1"));
    }
    if (url.pathname === "/api/export") {
      const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean);
      const briefs = await Promise.all(ids.map((i) => getBrief(i, false)));
      if (url.searchParams.get("format") === "json") return send(res, 200, evidenceManifest(briefs));
      return send(res, 200, briefs.map((b) => toMarkdown(b, b.narrative.text)).join("\n\n---\n\n"), "text/markdown; charset=utf-8");
    }
    // static files
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const full = path.join(root, "public", path.normalize(file));
    if (!full.startsWith(path.join(root, "public"))) return send(res, 403, "Forbidden", "text/plain");
    send(res, 200, await fs.readFile(full), mime[path.extname(full)] || "application/octet-stream");
  } catch (e) {
    send(res, e.code === "ENOENT" ? 404 : 500, { error: e.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tools = await mcp.connect();
  console.log(`MCP connected. Tools: ${tools.join(", ")}`);
  server.listen(PORT, () => console.log(`DealLens AI → http://localhost:${PORT}`));
}
export { mcp };
