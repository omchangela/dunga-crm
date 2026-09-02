import {
  mockLeads,
  mockCustomers,
  mockProjects,
  mockDevelopers,
  mockDocuments,
  mockFollowUps,
  mockLeadReminders,
  mockDSAs,
  mockBankEmployees,
  mockTasks,
  mockSubscriptions,
} from "./mock-data";
import type { MockDocument, MockFollowUp, DSA, BankEmployee } from "@/types";

const DATA_VERSION = "softleads-v3";
const VERSION_KEY  = "loanapp_data_version";

const KEYS = {
  leads:         "loanapp_leads",
  customers:     "loanapp_customers",
  projects:      "loanapp_projects",
  developers:    "loanapp_developers",
  documents:     "loanapp_documents",
  followups:     "loanapp_followups",
  dsas:          "loanapp_dsas",
  bankEmployees: "loanapp_bank_employees",
  reminders:     "loanapp_lead_reminders",
  tasks:         "loanapp_tasks",
  subscriptions: "loanapp_subscriptions",
} as const;

function migrateIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(VERSION_KEY) !== DATA_VERSION) {
    localStorage.removeItem(KEYS.leads);
    localStorage.removeItem(KEYS.customers);
    localStorage.removeItem(KEYS.projects);
    localStorage.removeItem(KEYS.reminders);
    localStorage.setItem(VERSION_KEY, DATA_VERSION);
  }
}

// ── Primitives ────────────────────────────────────────────────────────────────

function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export function getLeads(): any[] {
  migrateIfNeeded();
  return get(KEYS.leads, mockLeads as any[]);
}

export function saveLead(lead: any): void {
  const leads = getLeads();
  const idx = leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) leads[idx] = lead;
  else leads.unshift(lead);
  set(KEYS.leads, leads);
}

export function updateLeadStatus(
  id: string,
  status: string,
  rejectionReason?: string
): any | null {
  const leads = getLeads();
  const lead = leads.find((l) => l.id === id);
  if (!lead) return null;
  lead.status = status;
  lead.updatedAt = new Date().toISOString();
  if (rejectionReason) lead.rejectionReason = rejectionReason;
  set(KEYS.leads, leads);
  return lead;
}

export function toggleLeadFollowUp(id: string): void {
  const leads = getLeads();
  const lead = leads.find((l) => l.id === id);
  if (!lead) return;
  lead.followUp = !lead.followUp;
  lead.updatedAt = new Date().toISOString();
  set(KEYS.leads, leads);
}

export function bulkLeadFollowUp(ids: string[], followUp: boolean): void {
  const leads = getLeads();
  const now = new Date().toISOString();
  leads.forEach((l) => {
    if (ids.includes(l.id)) {
      l.followUp = followUp;
      l.updatedAt = now;
    }
  });
  set(KEYS.leads, leads);
}

export function deleteLead(id: string): void {
  set(KEYS.leads, getLeads().filter((l) => l.id !== id));
}

// ── Customers ─────────────────────────────────────────────────────────────────

export function getCustomers(): any[] {
  migrateIfNeeded();
  return get(KEYS.customers, mockCustomers as any[]);
}

export function saveCustomer(customer: any): void {
  const customers = getCustomers();
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx >= 0) customers[idx] = customer;
  else customers.unshift(customer);
  set(KEYS.customers, customers);
}

export function deleteCustomer(id: string): void {
  set(KEYS.customers, getCustomers().filter((c) => c.id !== id));
}

export function convertLeadToCustomer(leadId: string): any {
  const leads = getLeads();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("Lead not found");

  const customers = getCustomers();
  if (customers.find((c) => c.leadId === leadId)) throw new Error("Already converted to customer");

  const now = new Date();
  const ym  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const customer = {
    id:                `cust-${crypto.randomUUID().slice(0, 8)}`,
    leadId,
    name:              lead.fullName,
    fullName:          lead.fullName,
    phone:             lead.phone,
    email:             lead.email,
    loanType:          lead.loanType,
    projectType:       lead.projectType ?? "",
    loanAmount:        lead.loanAmount,
    bankName:          "",
    smName:            "",
    smNumber:          "",
    applicationNumber: `APP-${ym}-${rand}`,
    status:            "Active",
    createdAt:         now.toISOString(),
  };

  customers.unshift(customer);
  set(KEYS.customers, customers);

  // auto-create a project from the lead's project info
  const projects = getProjects();
  if (!projects.find((p) => p.leadId === leadId)) {
    const project = {
      id:             `proj-${crypto.randomUUID().slice(0, 8)}`,
      leadId,
      customerId:     customer.id,
      clientName:     lead.fullName,
      phone:          lead.phone,
      email:          lead.email ?? "",
      projectName:    lead.loanType ?? "",
      projectType:    lead.projectType ?? "",
      budget:         lead.loanAmount ?? 0,
      description:    lead.notes ?? "",
      contractNumber: customer.applicationNumber,
      status:         "Active",
      createdAt:      now.toISOString(),
      updatedAt:      now.toISOString(),
    };
    projects.unshift(project);
    set(KEYS.projects, projects);
  }

  updateLeadStatus(leadId, "CONVERTED");
  return customer;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function getProjects(): any[] {
  migrateIfNeeded();
  return get(KEYS.projects, mockProjects as any[]);
}

export function saveProject(project: any): void {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) projects[idx] = project;
  else projects.unshift(project);
  set(KEYS.projects, projects);
}

export function deleteProject(id: string): void {
  set(KEYS.projects, getProjects().filter((p) => p.id !== id));
}

export interface ProjectPayment {
  id: string;
  amount: number;
  note: string;
  date: string;
  mode: string;
  createdAt: string;
}

export function addProjectPayment(projectId: string, payment: ProjectPayment): void {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return;
  if (!projects[idx].payments) projects[idx].payments = [];
  projects[idx].payments.push(payment);
  projects[idx].updatedAt = new Date().toISOString();
  set(KEYS.projects, projects);
}

export function deleteProjectPayment(projectId: string, paymentId: string): void {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return;
  projects[idx].payments = (projects[idx].payments ?? []).filter((p: any) => p.id !== paymentId);
  projects[idx].updatedAt = new Date().toISOString();
  set(KEYS.projects, projects);
}

export function updateProjectPayment(projectId: string, payment: ProjectPayment): void {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) return;
  const pays: ProjectPayment[] = projects[idx].payments ?? [];
  const pIdx = pays.findIndex((p) => p.id === payment.id);
  if (pIdx < 0) return;
  pays[pIdx] = payment;
  projects[idx].payments = pays;
  projects[idx].updatedAt = new Date().toISOString();
  set(KEYS.projects, projects);
}

// ── Lead Reminders ─────────────────────────────────────────────────────────────

export interface LeadReminder {
  id: string;
  leadId: string;
  reminderAt: string;
  note: string;
  status: "PENDING" | "DONE";
  createdAt: string;
  updatedAt: string;
}

export function getLeadReminders(leadId: string): LeadReminder[] {
  const all = get<LeadReminder[]>(KEYS.reminders, mockLeadReminders as LeadReminder[]);
  return all
    .filter((r) => r.leadId === leadId)
    .sort((a, b) => new Date(b.reminderAt).getTime() - new Date(a.reminderAt).getTime());
}

export function getAllReminders(): LeadReminder[] {
  return get<LeadReminder[]>(KEYS.reminders, mockLeadReminders as LeadReminder[])
    .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime());
}

export function saveLeadReminder(reminder: LeadReminder): void {
  const all = get<LeadReminder[]>(KEYS.reminders, mockLeadReminders as LeadReminder[]);
  const idx = all.findIndex((r) => r.id === reminder.id);
  if (idx >= 0) all[idx] = reminder;
  else all.push(reminder);
  set(KEYS.reminders, all);
}

export function markReminderDone(id: string): void {
  const all = get<LeadReminder[]>(KEYS.reminders, mockLeadReminders as LeadReminder[]);
  const r = all.find((x) => x.id === id);
  if (!r) return;
  r.status = "DONE";
  r.updatedAt = new Date().toISOString();
  set(KEYS.reminders, all);
}

export function deleteLeadReminderById(id: string): void {
  const all = get<LeadReminder[]>(KEYS.reminders, mockLeadReminders as LeadReminder[]);
  set(KEYS.reminders, all.filter((r) => r.id !== id));
}

export function updateLeadReminderById(id: string, updates: Partial<Pick<LeadReminder, "reminderAt" | "note">>): void {
  const all = get<LeadReminder[]>(KEYS.reminders, mockLeadReminders as LeadReminder[]);
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  set(KEYS.reminders, all);
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function getDocuments(leadId: string): MockDocument[] {
  const all = get<Record<string, MockDocument[]>>(KEYS.documents, mockDocuments);
  return all[leadId] ?? [];
}

export function saveDocument(leadId: string, doc: MockDocument): void {
  const all = get<Record<string, MockDocument[]>>(KEYS.documents, mockDocuments);
  if (!all[leadId]) all[leadId] = [];
  const idx = all[leadId].findIndex((d) => d.id === doc.id);
  if (idx >= 0) all[leadId][idx] = doc;
  else all[leadId].push(doc);
  set(KEYS.documents, all);
}

export function deleteDocument(leadId: string, docId: string): void {
  const all = get<Record<string, MockDocument[]>>(KEYS.documents, mockDocuments);
  if (all[leadId]) {
    all[leadId] = all[leadId].filter((d) => d.id !== docId);
    set(KEYS.documents, all);
  }
}

// ── Follow-ups ────────────────────────────────────────────────────────────────

export function getFollowUps(leadId: string): MockFollowUp[] {
  const all = get<Record<string, MockFollowUp[]>>(KEYS.followups, mockFollowUps);
  return all[leadId] ?? [];
}

export function saveFollowUp(leadId: string, fu: MockFollowUp): void {
  const all = get<Record<string, MockFollowUp[]>>(KEYS.followups, mockFollowUps);
  if (!all[leadId]) all[leadId] = [];
  const idx = all[leadId].findIndex((f) => f.id === fu.id);
  if (idx >= 0) all[leadId][idx] = fu;
  else all[leadId].push(fu);
  set(KEYS.followups, all);
}

export function deleteFollowUp(leadId: string, fuId: string): void {
  const all = get<Record<string, MockFollowUp[]>>(KEYS.followups, mockFollowUps);
  if (all[leadId]) {
    all[leadId] = all[leadId].filter((f) => f.id !== fuId);
    set(KEYS.followups, all);
  }
}

// ── Developers ────────────────────────────────────────────────────────────────

export function getDevelopers(): any[] {
  return get(KEYS.developers, mockDevelopers as any[]);
}

export function saveDeveloper(dev: any): void {
  const list = getDevelopers();
  const idx  = list.findIndex((d) => d.id === dev.id);
  if (idx >= 0) list[idx] = dev;
  else list.unshift(dev);
  set(KEYS.developers, list);
}

export function deleteDeveloper(id: string): void {
  set(KEYS.developers, getDevelopers().filter((d) => d.id !== id));
}

// ── DSAs ──────────────────────────────────────────────────────────────────────

export function getDSAs(): DSA[] {
  return get(KEYS.dsas, mockDSAs);
}

export function saveDSA(dsa: DSA): void {
  const list = getDSAs();
  const idx = list.findIndex((d) => d.id === dsa.id);
  if (idx >= 0) list[idx] = dsa;
  else list.unshift(dsa);
  set(KEYS.dsas, list);
}

export function deleteDSA(id: string): void {
  set(KEYS.dsas, getDSAs().filter((d) => d.id !== id));
}

// ── Bank Employees ────────────────────────────────────────────────────────────

export function getBankEmployees(): BankEmployee[] {
  return get(KEYS.bankEmployees, mockBankEmployees);
}

export function saveBankEmployee(emp: BankEmployee): void {
  const list = getBankEmployees();
  const idx = list.findIndex((e) => e.id === emp.id);
  if (idx >= 0) list[idx] = emp;
  else list.unshift(emp);
  set(KEYS.bankEmployees, list);
}

export function deleteBankEmployee(id: string): void {
  set(KEYS.bankEmployees, getBankEmployees().filter((e) => e.id !== id));
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;       // developer id
  projectId: string | null;
  dueDate: string | null;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Todo" | "In Progress" | "Done" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}

export function getTasks(): Task[] {
  return get(KEYS.tasks, mockTasks as Task[]);
}

export function saveTask(task: Task): void {
  const list = getTasks();
  const idx = list.findIndex((t) => t.id === task.id);
  if (idx >= 0) list[idx] = task;
  else list.unshift(task);
  set(KEYS.tasks, list);
}

export function deleteTask(id: string): void {
  set(KEYS.tasks, getTasks().filter((t) => t.id !== id));
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  name: string;
  description: string;
  category: "Domain" | "Hosting" | "SSL" | "Maintenance" | "Software Subscription";
  amount: number;
  billingCycle: "Monthly" | "Quarterly" | "Yearly";
  renewalDate: string;
  status: "Active" | "Expired" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}

export function getSubscriptions(): Subscription[] {
  return get(KEYS.subscriptions, mockSubscriptions as Subscription[]);
}

export function saveSubscription(sub: Subscription): void {
  const list = getSubscriptions();
  const idx = list.findIndex((s) => s.id === sub.id);
  if (idx >= 0) list[idx] = sub;
  else list.unshift(sub);
  set(KEYS.subscriptions, list);
}

export function deleteSubscription(id: string): void {
  set(KEYS.subscriptions, getSubscriptions().filter((s) => s.id !== id));
}
