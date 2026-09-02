"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { developerApi } from "@/lib/developerApi";

export interface DeveloperUser {
  id:         string;
  name:       string;
  email:      string;
  phone:      string | null;
  role:       string;
  experience: string;
  skills:     string[];
  status:     string;
  joinedAt?:  string;
  tasks: {
    pending:    number;
    inProgress: number;
    completed:  number;
  };
}

interface DeveloperAuthContextType {
  developer: DeveloperUser | null;
  loading:   boolean;
  login:     (email: string, password: string) => Promise<void>;
  logout:    () => Promise<void>;
}

const DeveloperAuthContext = createContext<DeveloperAuthContextType | undefined>(undefined);

const DEVELOPER_ROUTES = [
  "/developer/dashboard",
  "/developer/projects",
  "/developer/tasks",
  "/developer/settings",
];

export function DeveloperAuthProvider({ children }: { children: React.ReactNode }) {
  const [developer, setDeveloper] = useState<DeveloperUser | null>(null);
  const [loading, setLoading]     = useState(true);
  const router     = useRouter();
  const pathname   = usePathname();
  const redirected = useRef(false);

  useEffect(() => {
    developerApi.me()
      .then((data) => setDeveloper(data ?? null))
      .catch(() => setDeveloper(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const isProtected = DEVELOPER_ROUTES.some((r) => pathname.startsWith(r));
    if (!developer && isProtected && !redirected.current) {
      redirected.current = true;
      router.push("/developer/login");
    }
    if (developer) redirected.current = false;
  }, [developer, loading, pathname, router]);

  async function login(email: string, password: string) {
    const res = await developerApi.login(email, password);
    if (!res.success) throw new Error(res.message ?? "Login failed.");
    const me = await developerApi.me();
    setDeveloper(me);
    window.location.href = "/developer/dashboard";
  }

  async function logout() {
    try { await developerApi.logout(); } catch { /* ignore */ }
    setDeveloper(null);
    router.push("/developer/login");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0971fe] border-t-transparent" />
      </div>
    );
  }

  return (
    <DeveloperAuthContext.Provider value={{ developer, loading, login, logout }}>
      {children}
    </DeveloperAuthContext.Provider>
  );
}

export function useDeveloperAuth() {
  const ctx = useContext(DeveloperAuthContext);
  if (!ctx) throw new Error("useDeveloperAuth must be used within DeveloperAuthProvider");
  return ctx;
}
