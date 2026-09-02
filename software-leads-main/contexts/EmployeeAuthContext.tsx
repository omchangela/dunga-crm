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
  const [employee, setEmployee] = useState<EmployeeUser | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("employee_user");
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading]   = useState(true);
  const router   = useRouter();
  const pathname = usePathname();
  const redirected = useRef(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("employee_token") : null;
    const isLoginPage = pathname === "/employee/login";

    if (!token && isLoginPage) {
      setLoading(false);
      return;
    }

    employeePortalApi.me()
      .then((data) => {
        setEmployee(data ?? null);
        if (data && typeof window !== "undefined") {
          localStorage.setItem("employee_user", JSON.stringify(data));
        }
      })
      .catch(() => {
        if (!token && isLoginPage) {
          setEmployee(null);
        } else {
          setEmployee(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("employee_token");
            localStorage.removeItem("employee_user");
          }
        }
      })
      .finally(() => setLoading(false));
  }, [pathname]);

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
    if (res.data) {
      setEmployee(res.data);
      if (typeof window !== "undefined") {
        localStorage.setItem("employee_user", JSON.stringify(res.data));
      }
    }
    window.location.href = "/employee/dashboard";
  }

  async function logout() {
    try { await employeePortalApi.logout(); } catch { /* ignore */ }
    setEmployee(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("employee_token");
      localStorage.removeItem("employee_user");
    }
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
