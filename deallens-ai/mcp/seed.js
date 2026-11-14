// Demo CRM data. Dates are expressed as "days ago" / "days from now" so the demo
// always looks fresh. Illustrative only; the live product reads a real CRM via MCP.
const D = 86400000;
const ago = (d) => new Date(Date.now() - d * D).toISOString();
const ahead = (d) => new Date(Date.now() + d * D).toISOString();

export function buildSeed() {
  const companies = [
    { id: "C-100", name: "Northwind Traders", industry: "Retail", owner: "Priya Nair", city: "Mumbai", employees: 850, created_at: ago(540) },
    { id: "C-200", name: "Acme Logistics", industry: "Logistics", owner: "Rohan Mehta", city: "Pune", employees: 2100, created_at: ago(700) },
    { id: "C-300", name: "Zenith Pharma", industry: "Healthcare", owner: "Priya Nair", city: "Hyderabad", employees: 430, created_at: ago(300) },
    { id: "C-400", name: "Helio Foods", industry: "FMCG", owner: "Aman Verma", city: "Delhi", employees: null, created_at: ago(120) },
  ];

  const deals = [
    // Northwind: healthy
    { id: "D-1042", company_id: "C-100", name: "Store analytics rollout", stage: "Negotiation", amount: 500000, probability: 0.7, close_date: ahead(18), last_activity_at: ago(3) },
    { id: "D-1091", company_id: "C-100", name: "POS integration", stage: "Proposal", amount: 450000, probability: 0.5, close_date: ahead(35), last_activity_at: ago(6) },
    { id: "D-1108", company_id: "C-100", name: "Support renewal FY27", stage: "Qualified", amount: 300000, probability: 0.4, close_date: ahead(52), last_activity_at: ago(9) },
    { id: "D-0977", company_id: "C-100", name: "Pilot (2025)", stage: "Closed Won", amount: 250000, probability: 1, close_date: ago(200), last_activity_at: ago(190) },
    // Acme: at risk
    { id: "D-2001", company_id: "C-200", name: "Fleet tracking platform", stage: "Negotiation", amount: 2400000, probability: 0.6, close_date: ago(12), last_activity_at: ago(41) },
    { id: "D-2014", company_id: "C-200", name: "Warehouse dashboards", stage: "Proposal", amount: 900000, probability: 0.4, close_date: ahead(25), last_activity_at: ago(33) },
    { id: "D-2022", company_id: "C-200", name: "API add-on", stage: "Qualified", amount: 350000, probability: 0.3, close_date: ahead(60), last_activity_at: ago(8) },
    { id: "D-1950", company_id: "C-200", name: "Legacy migration", stage: "Closed Lost", amount: 700000, probability: 0, close_date: ago(90), last_activity_at: ago(95) },
    // Zenith: watch
    { id: "D-3005", company_id: "C-300", name: "Compliance reporting suite", stage: "Proposal", amount: 1200000, probability: 0.5, close_date: ahead(20), last_activity_at: ago(15) },
    { id: "D-3011", company_id: "C-300", name: "Training package", stage: "Qualified", amount: 200000, probability: 0.3, close_date: ahead(45), last_activity_at: ago(26) },
    // Helio: sparse / missing data
    { id: "D-4002", company_id: "C-400", name: "Distributor portal", stage: "Qualified", amount: null, probability: 0.3, close_date: null, last_activity_at: ago(12) },
    { id: "D-4007", company_id: "C-400", name: "Demand forecasting pilot", stage: "Proposal", amount: 600000, probability: null, close_date: ahead(40), last_activity_at: ago(10) },
  ];

  const activities = [
    { id: "A-501", company_id: "C-100", deal_id: "D-1042", type: "meeting", subject: "Pricing review with CFO", occurred_at: ago(3), owner: "Priya Nair" },
    { id: "A-502", company_id: "C-100", deal_id: "D-1091", type: "call", subject: "POS API walkthrough", occurred_at: ago(6), owner: "Priya Nair" },
    { id: "A-503", company_id: "C-100", deal_id: "D-1108", type: "email", subject: "Renewal terms sent", occurred_at: ago(9), owner: "Priya Nair" },
    { id: "A-504", company_id: "C-100", deal_id: "D-1042", type: "call", subject: "Security questionnaire", occurred_at: ago(14), owner: "Priya Nair" },
    { id: "A-505", company_id: "C-100", deal_id: "D-1042", type: "meeting", subject: "Stakeholder kickoff", occurred_at: ago(24), owner: "Priya Nair" },
    { id: "A-601", company_id: "C-200", deal_id: "D-2001", type: "email", subject: "Contract redlines received", occurred_at: ago(41), owner: "Rohan Mehta" },
    { id: "A-602", company_id: "C-200", deal_id: "D-2014", type: "call", subject: "Scope clarification", occurred_at: ago(33), owner: "Rohan Mehta" },
    { id: "A-603", company_id: "C-200", deal_id: "D-2022", type: "email", subject: "API docs shared", occurred_at: ago(8), owner: "Rohan Mehta" },
    { id: "A-701", company_id: "C-300", deal_id: "D-3005", type: "meeting", subject: "Compliance demo", occurred_at: ago(15), owner: "Priya Nair" },
    { id: "A-702", company_id: "C-300", deal_id: "D-3011", type: "email", subject: "Training agenda", occurred_at: ago(26), owner: "Priya Nair" },
    { id: "A-801", company_id: "C-400", deal_id: "D-4002", type: "call", subject: "Intro call", occurred_at: ago(12), owner: "Aman Verma" },
    { id: "A-802", company_id: "C-400", deal_id: "D-4007", type: "email", subject: "Pilot outline", occurred_at: ago(10), owner: "Aman Verma" },
  ];

  const tasks = [
    { id: "T-901", company_id: "C-100", deal_id: "D-1042", title: "Send revised quote", due_at: ahead(2), status: "open", owner: "Priya Nair" },
    { id: "T-902", company_id: "C-200", deal_id: "D-2001", title: "Escalate contract to legal", due_at: ago(10), status: "open", owner: "Rohan Mehta" },
    { id: "T-903", company_id: "C-200", deal_id: "D-2014", title: "Book scoping workshop", due_at: ago(5), status: "open", owner: "Rohan Mehta" },
    { id: "T-904", company_id: "C-200", deal_id: "D-2022", title: "Follow up on API trial", due_at: ahead(4), status: "open", owner: "Rohan Mehta" },
    { id: "T-905", company_id: "C-300", deal_id: "D-3005", title: "Share compliance references", due_at: ago(3), status: "open", owner: "Priya Nair" },
    { id: "T-906", company_id: "C-300", deal_id: "D-3011", title: "Confirm training dates", due_at: ahead(7), status: "done", owner: "Priya Nair" },
    { id: "T-907", company_id: "C-400", deal_id: "D-4002", title: "Get budget range", due_at: ahead(5), status: "open", owner: "Aman Verma" },
  ];

  return { companies, deals, activities, tasks, syncedAt: new Date().toISOString() };
}
