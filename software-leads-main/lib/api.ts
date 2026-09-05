const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// ── Token rotation ─────────────────────────────────────────────────────────────
// When a request returns 401 (access token expired), hit /api/auth/refresh once,
// then retry. Concurrent 401s share a single in-flight refresh. If refresh fails,
// the session is over → send the user to login.

let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/api/auth/refresh`, { method: "POST", credentials: "include" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // Allow a fresh refresh attempt on the next expiry cycle.
        setTimeout(() => { refreshPromise = null; }, 0);
      });
  }
  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T = any>(
  path: string,
  init: RequestInit & { params?: Record<string, string> } = {},
  _retried = false
): Promise<T> {
  const { params, ...rest } = init;
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers = new Headers(rest.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url.toString(), {
    ...rest,
    headers,
    credentials: "include", // Include HTTP-only cookies
  });

  // Access token expired → rotate via refresh and retry once.
  if (res.status === 401 && !_retried && !path.includes("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, true);
    redirectToLogin();
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.message ?? `HTTP ${res.status}`) as any;
    err.status = res.status;
    err.errors = body?.errors ?? null;
    err.body   = body;
    throw err;
  }
  return body;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiLead {
  id:             string;
  fullName:       string;
  phone:          string;
  email:          string;
  state?:         string | null;
  city?:          string | null;
  serviceType:    string;
  source:         string;
  status:         string;
  followUp:       boolean;
  reminders?:     ApiReminderGlobal[];
  // legacy/optional (kept so other callers don't break)
  loanType?:      string;
  loanAmount?:    number;
  employmentType?: string | null;
  notes?:         string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface LeadsListResponse {
  success: boolean;
  data: {
    leads: ApiLead[];
    pagination: {
      total: number; page: number; limit: number;
      totalPages: number; hasNext: boolean; hasPrev: boolean;
    };
    tabs: { all: number; followUp: number; noFollowUp: number };
  };
}

export interface EnumsResponse {
  success: boolean;
  data: {
    serviceTypes: string[];
    leadSources:  string[];
    leadStatuses: string[];
  };
}

export interface ApiReminder {
  id:          string;
  leadId:      string;
  reminderAt:  string;
  note:        string;
  isTriggered: boolean;
  createdAt:   string;
  parentReminderId?: string;
  isReReminder?:     boolean;
  parentReminder?: {
    id:          string;
    reminderAt:  string;
    note:        string;
  };
}

export interface ApiReminderGlobal {
  id:         string;
  reminderAt: string;
  note:       string;
  status:     string;
  leadId:     string;
  createdAt:  string;
  updatedAt:  string;
  lead: {
    id?:         string;
    fullName:    string;
    phone:       string;
    serviceType: string;
    followUp?:   boolean;
  };
  parentReminderId?: string;
  isReReminder?:     boolean;
  parentReminder?: {
    id:          string;
    reminderAt:  string;
    note:        string;
  };
}

// ── Leads API ─────────────────────────────────────────────────────────────────

export const leadsApi = {
  getEnums: () =>
    request<EnumsResponse>("/api/leads/enums"),

  list: (params: Record<string, string> = {}) =>
    request<LeadsListResponse>("/api/leads", { params }),

  create: (data: {
    fullName: string; phone: string; email?: string;
    state?: string; city?: string; serviceType: string; source: string;
  }) =>
    request("/api/leads", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<{
    fullName: string; phone: string; email: string;
    state: string; city: string; serviceType: string;
    source: string; status: string;
  }>) =>
    request(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  updateStatus: (id: string, status: string) =>
    request(`/api/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  toggleFollowUp: (id: string) =>
    request(`/api/leads/${id}/follow-up`, { method: "PATCH" }),

  bulkFollowUp: (ids: string[], followUp: boolean) =>
    request("/api/leads/follow-up", {
      method: "PATCH",
      body: JSON.stringify({ ids, followUp }),
    }),

  delete: (id: string) =>
    request(`/api/leads/${id}`, { method: "DELETE" }),

  convertToCustomer: (leadId: string) =>
    request<{ success: boolean; message: string; data: { id: string; [key: string]: any } }>(
      `/api/leads/${leadId}/convert`, { method: "POST" }
    ),

  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/api/leads/bulk-import`, {
      method: "POST",
      body: fd,
      credentials: "include",
    }).then(ejson).then((j) => j.data);
  },

  getImportStatus: (jobId: string) =>
    request<any>(`/api/leads/import/status/${jobId}`).then((j) => j.data ?? j),
};

// ── Employees Admin API ───────────────────────────────────────────────────────

export const employeesApi = {
  getEnums: () =>
    request<any>("/api/employees/enums").then((j) => j.data),

  getAll: () =>
    request<any>("/api/employees").then((j) => j.data),

  get: (id: string) =>
    request<any>(`/api/employees/${id}`).then((j) => j.data),

  create: (data: { name: string; email: string; phone?: string; role: string; target?: number }) =>
    request<any>("/api/employees", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: { name?: string; email?: string; phone?: string; role?: string; isActive?: boolean }) =>
    request<any>(`/api/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<any>(`/api/employees/${id}`, { method: "DELETE" }),

  setTarget: (id: string, data: { target: number; month?: number; year?: number }) =>
    request<any>(`/api/employees/${id}/target`, { method: "POST", body: JSON.stringify(data) }),

  getStats: (id: string) =>
    request<any>(`/api/employees/${id}/stats`).then((j) => j.data),

  assignLead: (leadId: string, employeeId: string) =>
    request<any>(`/api/leads/${leadId}/assign`, { method: "POST", body: JSON.stringify({ employeeId }) }),

  unassignLead: (leadId: string) =>
    request<any>(`/api/leads/${leadId}/assign`, { method: "DELETE" }),

  getLeadFollowUps: (leadId: string) =>
    request<any>(`/api/leads/${leadId}/follow-ups`).then((j) => j.data),
};

export const getEmployeeToken = () => typeof window !== "undefined" ? localStorage.getItem("employee_token") : null;

function employeeFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getEmployeeToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, { ...init, headers, credentials: "include" }).then((r) => {
    if (
      r.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/employee/login"
    ) {
      localStorage.removeItem("employee_token");
      localStorage.removeItem("employee_user");
      window.location.href = "/employee/login";
      throw new Error("Session expired. Redirecting to login.");
    }
    return r;
  });
}

// Parse a Response as JSON, but turn HTML error pages (e.g. a 404 "<!DOCTYPE html>")
// into a clear, readable error instead of a cryptic "Unexpected token '<'".
async function ejson(r: Response): Promise<any> {
  const text = await r.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const err = new Error(
      r.status === 404
        ? "This action isn't available on the server yet (endpoint not found). The backend needs the matching /api/employee route — see EMPLOYEE_PORTAL_BACKEND_SPEC.md."
        : `Server returned a non-JSON response (HTTP ${r.status}). Please try again later.`
    ) as any;
    err.status = r.status;
    throw err;
  }
}

export const employeePortalApi = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/employee/login`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await ejson(res);
    const token = data?.data?.token ?? data?.token;
    if (token && typeof window !== "undefined") {
      localStorage.setItem("employee_token", token);
    }
    if (data?.data && typeof window !== "undefined") {
      localStorage.setItem("employee_user", JSON.stringify(data.data));
    }
    return data;
  },

  logout: () =>
    employeeFetch(`${BASE}/api/employee/logout`, { method: "POST" }).then(ejson),

  me: () =>
    employeeFetch(`${BASE}/api/employee/me`).then(ejson).then((j) => j.data),

  dashboard: () =>
    employeeFetch(`${BASE}/api/employee/dashboard`).then(ejson).then((j) => j.data),

  leads: (params?: { page?: number; status?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return employeeFetch(`${BASE}/api/employee/leads?${q}`).then(ejson).then((j) => j.data);
  },

  customers: (params?: { page?: number }) => {
    const q = new URLSearchParams(params as any).toString();
    return employeeFetch(`${BASE}/api/employee/customers?${q}`).then(ejson).then((j) => j.data);
  },

  projects: (params?: { status?: string }) => {
    const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return employeeFetch(`${BASE}/api/employee/projects${q}`).then(ejson).then((j) => j.data);
  },

  getLeadDetail: (id: string) =>
    employeeFetch(`${BASE}/api/employee/leads/${id}`).then(ejson).then((j) => j.data),

  getCustomerDetail: (id: string) =>
    employeeFetch(`${BASE}/api/employee/customers/${id}`).then(ejson).then((j) => j.data),

  updateCustomer: (id: string, data: { state?: string; city?: string; status?: string }) =>
    employeeFetch(`${BASE}/api/employee/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(ejson),

  getProjectDetail: (id: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}`).then(ejson).then((j) => j.data),

  createProject: (customerId: string, body: Record<string, unknown>) =>
    employeeFetch(`${BASE}/api/employee/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, ...body }),
    }).then(ejson),

  logFollowUp: (leadId: string, note: string) =>
    employeeFetch(`${BASE}/api/leads/${leadId}/follow-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }).then(ejson),

  changePassword: (currentPassword: string, newPassword: string) =>
    employeeFetch(`${BASE}/api/employee/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(ejson),

  // Create a new lead — the backend auto-assigns it to the authenticated employee.
  createLead: (data: {
    fullName: string; phone: string; email?: string;
    state?: string; city?: string; serviceType: string; source: string;
  }) =>
    employeeFetch(`${BASE}/api/employee/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(ejson),

  // ── Lead operations (scoped to the employee's own assigned leads) ─────────────
  updateLeadStatus: (id: string, status: string) =>
    employeeFetch(`${BASE}/api/employee/leads/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(ejson),

  convertLead: (id: string) =>
    employeeFetch(`${BASE}/api/employee/leads/${id}/convert`, { method: "POST" }).then(ejson),

  toggleFollowUp: (id: string) =>
    employeeFetch(`${BASE}/api/employee/leads/${id}/toggle-follow-up`, { method: "PATCH" }).then(ejson),

  deleteLead: (id: string) =>
    employeeFetch(`${BASE}/api/employee/leads/${id}`, { method: "DELETE" }).then(ejson),

  createReminder: (leadId: string, payload: { reminderAt: string; note: string }) =>
    employeeFetch(`${BASE}/api/employee/leads/${leadId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(ejson),

  // ── Estimation (the employee's own customers' Pending/Rejected projects) ───────
  estimation: () =>
    employeeFetch(`${BASE}/api/employee/estimation`).then(ejson).then((j) => j.data),

  // ── Project operations ─────────────────────────────────────────────────────────
  updateProjectStatus: (id: string, body: { status: string; payments?: any[] }) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(ejson),

  updateProject: (id: string, body: Record<string, unknown>) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(ejson),

  // Estimation PDF (async job): generate → poll status → fetch signed URL.
  generateEstimationPdf: (id: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/pdf`, { method: "POST" }).then(ejson),
  getEstimationPdfStatus: (id: string, jobId: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/pdf/status/${jobId}`).then(ejson),
  getEstimationPdf: (id: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/pdf`).then(ejson),

  // Project (contract) PDF — for converted/active projects.
  generateProjectPdf: (id: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/project-pdf`, { method: "POST" }).then(ejson),
  getProjectPdf: (id: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/project-pdf`).then(ejson),
  getProjectPdfStatus: (id: string, jobId: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/project-pdf/status/${jobId}`).then(ejson),

  // ── Reminders ──────────────────────────────────────────────────────────────────
  listReminders: () =>
    employeeFetch(`${BASE}/api/employee/reminders`).then(ejson),
  createReReminder: (id: string, payload: { reminderAt: string; note: string }) =>
    employeeFetch(`${BASE}/api/employee/reminders/${id}/rereminder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(ejson),
  markReminderDone: (id: string) =>
    employeeFetch(`${BASE}/api/employee/reminders/${id}/done`, { method: "PATCH" }).then(ejson),
  deleteReminder: (id: string) =>
    employeeFetch(`${BASE}/api/employee/reminders/${id}`, { method: "DELETE" }).then(ejson),

  listSubscriptions: (params?: { category?: string; status?: string; projectId?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v).map(([k, v]) => [k, String(v)])
    ).toString();
    return employeeFetch(`${BASE}/api/employee/subscriptions${q ? `?${q}` : ""}`).then(ejson);
  },
  createSubscription: (data: any) =>
    employeeFetch(`${BASE}/api/employee/subscriptions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(ejson),
  updateSubscription: (id: string, data: any) =>
    employeeFetch(`${BASE}/api/employee/subscriptions/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(ejson),
  deleteSubscription: (id: string) =>
    employeeFetch(`${BASE}/api/employee/subscriptions/${id}`, { method: "DELETE" }).then(ejson),
  paySubscription: (id: string, data?: any) =>
    employeeFetch(`${BASE}/api/employee/subscriptions/${id}/pay`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data || {}),
    }).then(ejson),

  addFeature: (id: string, data: { name: string; price?: string }) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(ejson),

  removeFeature: (id: string, featureId: string) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/features/${featureId}`, { method: "DELETE" }).then(ejson),

  listDevelopers: (params?: { search?: string; skill?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v).map(([k, v]) => [k, String(v)])
    ).toString();
    return employeeFetch(`${BASE}/api/employee/developers${q ? `?${q}` : ""}`).then(ejson);
  },

  assignDevelopers: (id: string, developers: string[]) =>
    employeeFetch(`${BASE}/api/employee/projects/${id}/developers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ developers }),
    }).then(ejson).then((j) => j.data),
};

// ── Reminders API ─────────────────────────────────────────────────────────────

export const remindersApi = {
  listAll: (status?: string) =>
    request<{
      success: boolean;
      data: { reminders: ApiReminderGlobal[]; pendingCount: number };
    }>("/api/reminders", status ? { params: { status } } : {}),

  list: (leadId: string) =>
    request<{ success: boolean; data: any }>(`/api/leads/${leadId}/reminders/lead`),

  create: (leadId: string, payload: { reminderAt: string; note: string }) =>
    request<{ success: boolean; data: ApiReminder }>(`/api/leads/${leadId}/reminders`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createReReminder: (id: string, payload: { reminderAt: string; note: string }) =>
    request<{
      success: boolean;
      message: string;
      data: ApiReminderGlobal & { parentReminderId?: string; isReReminder?: boolean };
    }>(`/api/reminders/${id}/rereminder`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  markDone: (id: string) =>
    request(`/api/reminders/${id}/done`, { method: "PATCH" }),

  update: (id: string, payload: { reminderAt?: string; note?: string }) =>
    request(`/api/reminders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    request(`/api/reminders/${id}`, { method: "DELETE" }),
};

// ── Customer types ────────────────────────────────────────────────────────────

export interface ApiCustomer {
  id:                string;
  fullName:          string;
  phone:             string;
  email:             string;
  state?:            string | null;
  city?:             string | null;
  serviceType?:      string;
  applicationNumber: string;
  status:            string;
  leadId:            string;
  totalProjects?:    number;
  pipeline?:         { pending: number; converted: number; rejected: number };
  documentsCount?:   number;
  createdAt:         string;
  updatedAt?:        string;
  lead?:             { source?: string };
  documents?:        ApiDocument[];
}

export interface ApiDocument {
  id:          string;
  customerId?: string;
  fileName:    string;
  fileUrl:     string;
  filePath:    string;
  fileSize:    number;
  mimeType:    string;
  createdAt:   string;
}

// ── Customers API ─────────────────────────────────────────────────────────────

export const customersApi = {
  list: (params: Record<string, string> = {}) =>
    request<{
      success: boolean;
      data: {
        customers: ApiCustomer[];
        pagination: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
      };
    }>("/api/customers", { params }),

  get: (id: string) =>
    request<{ success: boolean; data: ApiCustomer }>(`/api/customers/${id}`),

  update: (id: string, data: Partial<{ state: string; city: string; status: string }>) =>
    request<{ success: boolean; data: ApiCustomer }>(`/api/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/api/customers/${id}`, { method: "DELETE" }),
};

// ── Documents API ─────────────────────────────────────────────────────────────

export const docsApi = {
  list: (customerId: string) =>
    request<{ success: boolean; data: ApiDocument[] }>(`/api/customers/${customerId}/docs`),

  upload: (customerId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${BASE}/api/customers/${customerId}/docs`, { method: "POST", body: fd, credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          const err = new Error(body?.message ?? `HTTP ${r.status}`) as any;
          err.status = r.status;
          throw err;
        }
        return body as { success: boolean; data: ApiDocument };
      });
  },

  getSignedUrl: (docId: string) =>
    request<{ success: boolean; data: { signedUrl: string; fileName: string; expiresIn: string } }>(`/api/docs/${docId}/url`),

  delete: (docId: string) =>
    request(`/api/docs/${docId}`, { method: "DELETE" }),
};

// ── Import-job API (bulk import polling) ──────────────────────────────────────

export interface ApiTask {
  id:            string;
  status:        "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  totalRows?:    number;
  processedRows?: number;
  successCount?: number;
  failureCount?: number;
  errors?:       Array<{ row: number; message: string }>;
  createdAt:     string;
  updatedAt:     string;
}

export const importJobsApi = {
  get: (taskId: string) =>
    request<{ success: boolean; data: ApiTask }>(`/api/tasks/${taskId}`),
};

// ── Dashboard API ─────────────────────────────────────────────────────────────

export interface ApiDashboard {
  totalLeads:     number;
  totalCustomers: number;
  totalConverted: number;
  pipeline: {
    pending:          number;
    rejected:         number;
    converted:        number;
    pendingPercent:   number;
    rejectedPercent:  number;
    convertedPercent: number;
    conversionRate:   number;
  };
  loanTypes: Array<{ type: string; count: number; percent: number }>;
  recentLeads: Array<{
    id: string; fullName: string;
    loanType: string; loanAmount: number; status: string; createdAt: string;
  }>;
  pendingReminders: Array<{
    id: string; reminderAt: string; note: string | null; status: string; leadId: string;
    lead: { fullName: string; phone: string };
  }>;
  pendingRemindersCount: number;
}

export const dashboardApi = {
  get: () =>
    request<{ success: boolean; data: ApiDashboard }>("/api/dashboard"),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function fetchLeadById(id: string): Promise<ApiLead | null> {
  try {
    const res = await leadsApi.list({ limit: "500", page: "1" });
    return res.data.leads.find((l) => l.id === id) ?? null;
  } catch {
    return null;
  }
}

// ── Projects API ───────────────────────────────────────────────────────────────

export const projectsApi = {
  listAll: (params: Record<string, string> = {}) =>
    request<any>("/api/projects/all", { params }),

  listForCustomer: (customerId: string) =>
    request<any>(`/api/customers/${customerId}/projects`),

  get: (id: string) =>
    request<any>(`/api/projects/${id}`),

  create: (customerId: string, body: any) =>
    request<any>(`/api/customers/${customerId}/projects`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: any) =>
    request<any>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  delete: (id: string) =>
    request(`/api/projects/${id}`, { method: "DELETE" }),

  setDeadline: (id: string, deadline: string | null) =>
    request<any>(`/api/projects/${id}/deadline`, {
      method: "PATCH",
      body: JSON.stringify({ deadline }),
    }),

  setDevelopers: (id: string, developers: string[], deadline?: string | null) =>
    request<any>(`/api/projects/${id}/developers`, {
      method: "PATCH",
      body: JSON.stringify(deadline === undefined ? { developers } : { developers, deadline }),
    }),

  addFeature: (id: string, name: string, price: string) =>
    request<any>(`/api/projects/${id}/features`, {
      method: "POST",
      body: JSON.stringify({ name, price }),
    }),

  removeFeature: (id: string, featureId: string) =>
    request<any>(`/api/projects/${id}/features/${featureId}`, { method: "DELETE" }),

  // Generate a fresh estimation PDF, upload to storage, return its URL.
  generatePdf: (id: string) =>
    request<any>(`/api/projects/${id}/pdf`, { method: "POST" }),

  // Get a signed download URL for an already-generated estimation PDF.
  getPdf: (id: string) =>
    request<any>(`/api/projects/${id}/pdf`),

  // Generate a fresh project (contract) PDF, upload to storage, return its URLs.
  generateProjectPdf: (id: string) =>
    request<any>(`/api/projects/${id}/project-pdf`, { method: "POST" }),

  // Get a signed download URL for an already-generated project (contract) PDF.
  getProjectPdf: (id: string) =>
    request<any>(`/api/projects/${id}/project-pdf`),

  // Poll the async job status for an estimation PDF.
  getPdfStatus: (id: string, jobId: string) =>
    request<any>(`/api/projects/${id}/pdf/status/${jobId}`),

  // Poll the async job status for a project (contract) PDF.
  getProjectPdfStatus: (id: string, jobId: string) =>
    request<any>(`/api/projects/${id}/project-pdf/status/${jobId}`),

  // Get a signed download URL for a Payment Receipt PDF.
  getReceiptPdf: (id: string, payIndex: number = 0) =>
    request<any>(`/api/projects/${id}/receipt-pdf?payIndex=${payIndex}`),
};

// ── Adapters: backend shape -> internal (display) shape the UI renders ──────────

import { d as disp, e as toEnum } from "./enum-maps";

/** Convert a raw API project into the shape the existing pages expect. */
export function adaptProject(raw: any): any {
  if (!raw) return raw;
  return {
    ...raw,
    projectName:  raw.projectName,
    headline:     raw.projectName,
    description:  raw.description ?? "",
    projectType:  disp.service(raw.serviceType ?? ""),
    status:       disp.projStatus(raw.status ?? ""),
    overview: {
      web:   raw.webOverview   ?? [],
      app:   raw.appOverview   ?? [],
      admin: raw.adminOverview ?? [],
    },
    payments:   raw.payments   ?? [],
    timelines:  raw.timelines  ?? [],
    schedules:  raw.schedules  ?? [],
    budget:           Number(raw.budget ?? 0),
    totalProjectCost: Number(raw.totalProjectCost ?? raw.budget ?? 0),
    contractNumber:   raw.contractNumber ?? "",
    deadline:         raw.deadline ?? "",
    developers:       raw.developers   ?? [],
    featureItems:     raw.featureItems ?? [],
    costHistory:      raw.costHistory  ?? [],
    customerId:  raw.customer?.id       ?? raw.customerId,
    clientName:  raw.customer?.fullName ?? raw.clientName ?? "",
    phone:       raw.customer?.phone    ?? raw.phone ?? "",
    email:       raw.customer?.email    ?? raw.email ?? "",
    customer:    raw.customer,
    estimationPdfUrl: raw.estimationPdfUrl ?? null,
    estimationPdfAt:  raw.estimationPdfAt  ?? null,
    projectPdfUrl:    raw.projectPdfUrl    ?? null,
    projectPdfAt:     raw.projectPdfAt     ?? null,
    createdAt:   raw.createdAt,
    updatedAt:   raw.updatedAt,
  };
}

/** Convert a raw API customer into the shape the existing pages expect. */
export function adaptCustomer(raw: any): any {
  if (!raw) return raw;
  return {
    ...raw,
    fullName:    raw.fullName,
    name:        raw.fullName,
    projectType: disp.service(raw.serviceType ?? ""),
    status:      disp.projStatus(raw.status ?? "Active"),
    totalProjects: raw.totalProjects ?? (raw.projects?.length ?? 0),
    pipeline:    raw.pipeline ?? { pending: 0, converted: 0, rejected: 0 },
    projects:    (raw.projects ?? []).map(adaptProject),
    lead:        raw.lead,
  };
}

function pickArray(data: any, key: string): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

// ── High-level facade (adapted return values) ──────────────────────────────────

export async function fetchCustomers(params: Record<string, string> = {}) {
  const res = await customersApi.list(params);
  return {
    customers: (res.data.customers ?? []).map(adaptCustomer),
    pagination: res.data.pagination,
  };
}

export async function fetchCustomer(id: string) {
  const res = await customersApi.get(id);
  return adaptCustomer(res.data);
}

export async function fetchAllProjects(params: Record<string, string> = {}) {
  const res = await projectsApi.listAll(params);
  return {
    projects: pickArray(res.data, "projects").map(adaptProject),
    pagination: res.data?.pagination,
  };
}

export async function fetchProject(id: string) {
  const res = await projectsApi.get(id);
  return adaptProject(res.data);
}

/** Build a create-project POST body from the Add Project form's internal state. */
export function buildCreateProjectBody(form: {
  projectName: string; projectDescription: string; projectType: string; status?: string;
  overviewWeb: string[]; overviewApp: string[]; overviewAdmin: string[];
  payments: { description: string; amount: string }[];
  timelines: { description: string; workingDays: string }[];
  schedules: { description: string; payment: string }[];
}) {
  const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);
  return {
    projectName: form.projectName.trim(),
    description: form.projectDescription.trim(),
    serviceType: form.projectType ? toEnum.service(form.projectType) : "OTHERS",
    ...(form.status ? { status: toEnum.status(form.status) } : {}),
    webOverview:   clean(form.overviewWeb),
    appOverview:   clean(form.overviewApp),
    adminOverview: clean(form.overviewAdmin),
    payments:  form.payments.filter((p) => p.description.trim() || String(p.amount).trim()),
    timelines: form.timelines.filter((t) => t.description.trim() || String(t.workingDays).trim()),
    schedules: form.schedules.filter((s) => s.description.trim() || String(s.payment).trim()),
  };
}

// ── Leads / Reminders adapters + facade ────────────────────────────────────────

/** Add display `projectType` (from serviceType) so existing lead UI keeps working. */
export function adaptLead(raw: any): any {
  if (!raw) return raw;
  return {
    ...raw,
    projectType: disp.service(raw.serviceType ?? ""),
  };
}

/** Normalize a global reminder: embed lead with id + display projectType. */
export function adaptReminder(raw: any): any {
  if (!raw) return raw;
  const lead = raw.lead
    ? {
        ...raw.lead,
        id:          raw.lead.id ?? raw.leadId,
        projectType: disp.service(raw.lead.serviceType ?? ""),
        loanType:    disp.service(raw.lead.serviceType ?? ""), // legacy field some views read
      }
    : undefined;
  return { ...raw, lead };
}

export async function fetchLeads(params: Record<string, string> = {}) {
  const res = await leadsApi.list(params);
  return {
    leads: res.data.leads.map(adaptLead),
    pagination: res.data.pagination,
    tabs: res.data.tabs,
  };
}

export async function fetchLead(id: string) {
  const res = await request<{ success: boolean; data: any }>(`/api/leads/${id}`);
  return adaptLead(res.data);
}

export async function fetchReminders(status?: string) {
  const res = await remindersApi.listAll(status && status !== "ALL" ? status : undefined);
  return {
    reminders: (res.data.reminders ?? []).map(adaptReminder),
    pendingCount: res.data.pendingCount ?? 0,
  };
}

export async function fetchLeadReminders(leadId: string) {
  const res = await remindersApi.list(leadId);
  const d = res.data;
  if (Array.isArray(d)) return d as any[];
  if (d && Array.isArray(d.reminders)) return d.reminders as any[];
  return [] as any[];
}

// ── Finance API ────────────────────────────────────────────────────────────────
// Note: these endpoints return bare objects (no { success, data } envelope).

export const financeApi = {
  summary: () =>
    request<{ summary: { totalPipelineBudget: number; totalReceived: number; outstandingBalance: number } }>(
      "/api/finance/summary"
    ),

  projects: () =>
    request<any>("/api/finance/projects"),

  projectLedger: (projectId: string) =>
    request<{ project: any; summary: { totalBudget: number; totalPaid: number; remainingBalance: number }; history: any[] }>(
      `/api/finance/project/${projectId}`
    ),

  collect: (body: {
    projectId: string; amount: string; paymentMethod: string;
    paymentDate: string; transactionId?: string; note?: string;
  }) =>
    request<any>("/api/finance/collect", { method: "POST", body: JSON.stringify(body) }),

  updateTransaction: (transactionId: string, body: Partial<{
    amount: string; paymentMethod: string; paymentDate: string; transactionId: string; note: string;
  }>) =>
    request<any>(`/api/finance/${transactionId}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteTransaction: (transactionId: string) =>
    request<any>(`/api/finance/${transactionId}`, { method: "DELETE" }),
};

/** Normalize delivery-project list response into an array (bare array or {data}/{projects}). */
export async function fetchFinanceProjects(): Promise<any[]> {
  const res = await financeApi.projects();
  return pickArray(res?.data ?? res, "projects");
}

// ── Developers API ───────────────────────────────────────────────────────────

export const developersApi = {
  enums: () => request<any>("/api/developers/enums"),

  list: (params: Record<string, string> = {}) =>
    request<any>("/api/developers", { params }),

  get: (id: string) => request<any>(`/api/developers/${id}`),

  create: (body: {
    name: string; phone: string; email?: string;
    role: string; experience: string; skills: string[]; status?: string;
  }) => request<any>("/api/developers", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: Partial<{
    name: string; phone: string; email: string;
    role: string; experience: string; skills: string[]; status: string;
  }>) => request<any>(`/api/developers/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  delete: (id: string) => request<any>(`/api/developers/${id}`, { method: "DELETE" }),
};

export async function fetchDevelopers(params: Record<string, string> = {}): Promise<any[]> {
  const res = await developersApi.list(params);
  return pickArray(res?.data ?? res, "developers");
}

export async function fetchDeveloper(id: string): Promise<any> {
  const res = await developersApi.get(id);
  return res?.data ?? res;
}

export interface DeveloperEnums { roles: string[]; experienceLevels: string[]; skills: string[]; }

export async function fetchDeveloperEnums(): Promise<DeveloperEnums> {
  const res = await developersApi.enums();
  const d = res?.data ?? res ?? {};
  return {
    roles:            d.roles ?? d.roleOptions ?? [],
    experienceLevels: d.experienceLevels ?? d.experience ?? d.experienceOptions ?? [],
    skills:           d.skills ?? d.skillOptions ?? [],
  };
}

// ── Tasks API ──────────────────────────────────────────────────────────────────

export const tasksApi = {
  enums: () => request<any>("/api/tasks/enums"),

  projectDevelopers: (projectId: string) =>
    request<any>(`/api/tasks/project/${projectId}/developers`),

  list: (params: Record<string, string> = {}) =>
    request<any>("/api/tasks", { params }),

  create: (body: {
    title: string; description?: string; projectId: string; assignedTo: string;
    dueDate?: string | null; priority?: string; status?: string;
  }) => request<any>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: any) =>
    request<any>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  updateStatus: (id: string, status: string) =>
    request<any>(`/api/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  delete: (id: string) => request<any>(`/api/tasks/${id}`, { method: "DELETE" }),
};

export async function fetchTasks(params: Record<string, string> = {}): Promise<any[]> {
  const res = await tasksApi.list(params);
  return pickArray(res?.data ?? res, "tasks");
}

export async function fetchTaskEnums(): Promise<{ priorities: string[]; statuses: string[] }> {
  const res = await tasksApi.enums();
  const d = res?.data ?? res ?? {};
  return {
    priorities: d.priorities ?? d.priorityOptions ?? [],
    statuses:   d.statuses   ?? d.statusOptions   ?? [],
  };
}

export async function fetchProjectDevelopers(projectId: string): Promise<any[]> {
  const res = await tasksApi.projectDevelopers(projectId);
  return pickArray(res?.data ?? res, "developers");
}

// ── Subscriptions API ──────────────────────────────────────────────────────────

export const subscriptionsApi = {
  enums: () => request<any>("/api/subscriptions/enums"),

  summary: () => request<any>("/api/subscriptions/summary"),

  list: (params: Record<string, string> = {}) =>
    request<any>("/api/subscriptions", { params }),

  get: (id: string) => request<any>(`/api/subscriptions/${id}`),

  create: (body: {
    name: string; description?: string; category: string; amount: number;
    billingCycle: string; renewalDate: string; status?: string;
  }) => request<any>("/api/subscriptions", { method: "POST", body: JSON.stringify(body) }),

  update: (id: string, body: any) =>
    request<any>(`/api/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  delete: (id: string) => request<any>(`/api/subscriptions/${id}`, { method: "DELETE" }),

  // Record a renewal payment: advances renewalDate one cycle, logs a finance
  // transaction against the linked project, and stamps lastPaidAt.
  markPaid: (
    id: string,
    body: { amount?: number; paymentDate?: string; paymentMethod?: string; note?: string } = {},
  ) => request<any>(`/api/subscriptions/${id}/pay`, { method: "POST", body: JSON.stringify(body) }),
};

export async function fetchSubscriptions(params: Record<string, string> = {}): Promise<any[]> {
  const res = await subscriptionsApi.list(params);
  return pickArray(res?.data ?? res, "subscriptions");
}

export async function fetchSubscriptionEnums(): Promise<{ categories: string[]; billingCycles: string[]; statuses: string[] }> {
  const res = await subscriptionsApi.enums();
  const d = res?.data ?? res ?? {};
  return {
    categories:    d.categories    ?? d.categoryOptions ?? [],
    billingCycles: d.billingCycles ?? d.billingCycleOptions ?? [],
    statuses:      d.statuses      ?? d.statusOptions ?? [],
  };
}
