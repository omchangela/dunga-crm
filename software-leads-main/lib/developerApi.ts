const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

let refreshPromise: Promise<boolean> | null = null;

function tryRefreshDev(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/api/developer/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => { refreshPromise = null; }, 0);
      });
  }
  return refreshPromise;
}

function redirectToDevLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.includes("/developer/login")) return;
  window.location.href = `/developer/login?redirect=${encodeURIComponent(window.location.pathname)}`;
}

export const getDeveloperToken = () => typeof window !== "undefined" ? localStorage.getItem("developer_token") : null;

async function devFetch(
  path: string,
  options?: RequestInit,
  _retried = false
): Promise<any> {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getDeveloperToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (res.status === 401 && !_retried && !path.includes("/auth/") && !path.includes("/login")) {
    const refreshed = await tryRefreshDev();
    if (refreshed) return devFetch(path, options, true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("developer_token");
      localStorage.removeItem("developer_user");
    }
    redirectToDevLogin();
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(json?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.errors = json?.errors ?? null;
    err.body   = json;
    throw err;
  }
  return json;
}

export const developerApi = {
  // ─── AUTH ──────────────────────────────────────────────────────────────────
  login: async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/developer/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    const token = json?.data?.token ?? json?.token;
    if (token && typeof window !== "undefined") {
      localStorage.setItem("developer_token", token);
    }
    if (json?.data && typeof window !== "undefined") {
      localStorage.setItem("developer_user", JSON.stringify(json.data));
    }
    return json;
  },

  logout: () =>
    devFetch("/api/developer/logout", { method: "POST" }),

  me: () =>
    devFetch("/api/developer/me").then((j) => j.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    devFetch("/api/developer/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
  dashboard: () =>
    devFetch("/api/developer/dashboard").then((j) => j.data),

  // ─── PROJECTS ──────────────────────────────────────────────────────────────
  projects: {
    list: (params?: { status?: string }) => {
      const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
      return devFetch(`/api/developer/projects${q}`).then((j) => j.data.projects);
    },
    get: (id: string) =>
      devFetch(`/api/developer/projects/${id}`).then((j) => j.data.project),
  },

  // ─── TASKS ─────────────────────────────────────────────────────────────────
  tasks: {
    list: (params?: { status?: string; priority?: string; projectId?: string }) => {
      const q = new URLSearchParams(
        Object.entries(params || {})
          .filter(([, v]) => v)
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return devFetch(`/api/developer/tasks${q ? `?${q}` : ""}`).then((j) => j.data.tasks);
    },
    get: (id: string) =>
      devFetch(`/api/developer/tasks/${id}`).then((j) => j.data.task),
    updateStatus: (id: string, status: string) =>
      devFetch(`/api/developer/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }).then((j) => j.data.task),
  },
};
