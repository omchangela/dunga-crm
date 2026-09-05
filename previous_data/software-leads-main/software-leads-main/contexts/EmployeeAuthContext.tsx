"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { employeePortalApi } from "@/lib/api";

export interface EmployeeUser {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  phone?:   string | null;
  isActive: boolean;
}

interface EmployeeAuthContextType {
  employee: EmployeeUser | null;
  loading:  boolean;
  login:    (email: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);

const EMPLOYEE_ROUTES = [
  "/employee/dashboard",
  "/employee/leads",
  "/employee/customers",
  "/employee/projects",
];

export function EmployeeAuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [loading, setLoading]   = useState(true);
  const router   = useRouter();
  const pathname = usePathname();
  const redirected = useRef(false);

  useEffect(() => {
    employeePortalApi.me()
      .then((data) => setEmployee(data ?? null))
      .catch(() => setEmployee(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const isProtected = EMPLOYEE_ROUTES.some((r) => pathname.startsWith(r));
    if (!employee && isProtected && !redirected.current) {
      redirected.current = true;
      router.push("/employee/login");
    }
    if (employee) redirected.current = false;
  }, [employee, loading, pathname, router]);

  async function login(email: string, password: string) {
    const res = await employeePortalApi.login(email, password);
    if (!res.success) throw new Error(res.message ?? "Login failed.");
    const me = await employeePortalApi.me();
    setEmployee(me);
    window.location.href = "/employee/dashboard";
  }

  async function logout() {
    try { await employeePortalApi.logout(); } catch { /* ignore */ }
    setEmployee(null);
    router.push("/employee/login");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0971fe] border-t-transparent" />
      </div>
    );
  }

  return (
    <EmployeeAuthContext.Provider value={{ employee, loading, login, logout }}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const ctx = useContext(EmployeeAuthContext);
  if (!ctx) throw new Error("useEmployeeAuth must be used within EmployeeAuthProvider");
  return ctx;
}
