const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// ── Auth API ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const getToken = () => typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
export const getAuthHeaders = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export const authApi = {
  // Login
  login: async (data: LoginData): Promise<{ user: User }> => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Important for cookies
      body: JSON.stringify(data),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.message ?? "Invalid email or password");
    }
    const token = body.token ?? body.data?.token;
    if (token && typeof window !== "undefined") {
      localStorage.setItem("access_token", token);
    }
    return { user: body.user ?? body.data?.user ?? body.data };
  },

  // Get current user
  me: async (): Promise<{ user: User }> => {
    const headers = new Headers();
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${BASE}/api/auth/me`, {
      method: "GET",
      headers,
      credentials: "include", // Important for cookies
    });

    if (!res.ok) {
      throw new Error("Not authenticated");
    }
    const body = await res.json().catch(() => ({}));
    return { user: body.user ?? body.data?.user ?? body.data };
  },

  // Change own password
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await fetch(`${BASE}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message ?? "Failed to change password");
    return body;
  },

  // Refresh tokens
  refresh: async () => {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
      credentials: "include", // Important for cookies
    });
    
    if (!res.ok) {
      throw new Error("Token refresh failed");
    }
    
    const body = await res.json().catch(() => ({}));
    const token = body.token ?? body.data?.token;
    if (token && typeof window !== "undefined") {
      localStorage.setItem("access_token", token);
    }
    return body;
  },

  // Logout current device
  logout: async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
    }
    const res = await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
      credentials: "include", // Important for cookies
    });
    
    if (!res.ok) {
      throw new Error("Logout failed");
    }
    
    return res.json();
  },

  // Logout all devices
  logoutAll: async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
    }
    const res = await fetch(`${BASE}/api/auth/logout-all`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
      credentials: "include", // Important for cookies
    });

    if (!res.ok) {
      throw new Error("Logout all devices failed");
    }

    return res.json();
  },
};

// ── Admin user management (admin-only) ──────────────────────────────────────────

async function authRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const authHeaders = getAuthHeaders();
  Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.message ?? `HTTP ${res.status}`) as any;
    err.status = res.status;
    err.errors = body?.errors ?? null;
    throw err;
  }
  return body;
}

export const usersApi = {
  list: () => authRequest("/api/auth/users"),

  create: (data: { name: string; email: string; password: string; role: string }) =>
    authRequest("/api/auth/users", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<{ name: string; email: string; role: string }>) =>
    authRequest(`/api/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    authRequest(`/api/auth/users/${id}`, { method: "DELETE" }),
};
