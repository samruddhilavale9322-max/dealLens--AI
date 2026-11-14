// Tiny MCP client (stdio transport, JSON-RPC 2.0). Read-only: refuses any tool
// that is not annotated readOnlyHint, enforcing the "start read-only" rule.
import { spawn } from "node:child_process";
import readline from "node:readline";

export class McpClient {
  constructor({ command, args = [], env = {} }) {
    this.command = command; this.args = args; this.env = env;
    this.nextId = 1; this.pending = new Map(); this.tools = new Map();
  }

  async connect() {
    this.proc = spawn(this.command, this.args, { stdio: ["pipe", "pipe", "inherit"], env: { ...process.env, ...this.env } });
    this.proc.on("exit", () => { for (const p of this.pending.values()) p.reject(new Error("MCP server exited")); this.pending.clear(); });
    readline.createInterface({ input: this.proc.stdout }).on("line", (line) => {
      let m; try { m = JSON.parse(line); } catch { return; }
      const p = this.pending.get(m.id); if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    });
    await this.#request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "deallens-ai", version: "0.1.0" } });
    this.#notify("notifications/initialized");
    const { tools } = await this.#request("tools/list");
    for (const t of tools) this.tools.set(t.name, t);
    return [...this.tools.keys()];
  }

  async callTool(name, args) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not offered by server: ${name}`);
    if (!tool.annotations?.readOnlyHint) throw new Error(`Refusing non-read-only tool: ${name}`);
    const res = await this.#request("tools/call", { name, arguments: args });
    const text = res.content?.find((c) => c.type === "text")?.text;
    return JSON.parse(text);
  }

  #request(method, params) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error(`MCP timeout: ${method}`)); }, 10000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  #notify(method, params) { this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n"); }
  close() { this.proc?.kill(); }
}
