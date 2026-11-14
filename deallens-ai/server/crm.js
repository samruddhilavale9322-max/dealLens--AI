// Fetch everything needed for one account through MCP and normalise it.
export async function fetchAccountData(mcp, companyId) {
  const [c, d, a, t] = await Promise.all([
    mcp.callTool("crm_get_company", { company_id: companyId }),
    mcp.callTool("crm_list_deals", { company_id: companyId }),
    mcp.callTool("crm_list_activities", { company_id: companyId }),
    mcp.callTool("crm_list_tasks", { company_id: companyId }),
  ]);
  const syncedAt = [c, d, a, t].map((r) => r.syncedAt).sort()[0];
  return { company: c.records[0], deals: d.records, activities: a.records, tasks: t.records, syncedAt };
}
