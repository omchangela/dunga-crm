"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi, type User } from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  // Check authentication on mount
  useEffect(() => {
    try {
      const cached = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } catch {}
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { user } = await authApi.me();
      setUser(user);
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(user));
      }
    } catch (error) {
      // Access token may have expired — try rotating it via refresh, then retry.
      try {
        await authApi.refresh();
        const { user } = await authApi.me();
        setUser(user);
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(user));
        }
      } catch {
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("user");
          localStorage.removeItem("access_token");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const { user } = await authApi.login({ email, password });
    setUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user));
    }
    
    // Redirect to intended destination or dashboard
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "/dashboard";
    
    // Use window.location for immediate redirect
    window.location.href = redirect;
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("access_token");
      }
      router.push("/login");
    }
  }

  async function logoutAll() {
    try {
      await authApi.logoutAll();
    } catch (error) {
      console.error("Logout all error:", error);
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("access_token");
      }
      router.push("/login");
    }
  }

  // Redirect to login if not authenticated (except on public routes)
  useEffect(() => {
    const isPublicRoute = pathname === "/login" || pathname === "/employee/login" || pathname.startsWith("/employee/") || pathname.startsWith("/developer/");

    if (!loading && !user && !isPublicRoute && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }

    if (user) {
      hasRedirected.current = false;
    }
  }, [user, loading, pathname, router]);

  // If loading or redirecting to login, show loading screen
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0971fe] border-t-transparent" />
      </div>
    );
  }

  // If not authenticated and not on public route, don't render children
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname === "/employee/login" || pathname.startsWith("/employee/") || pathname.startsWith("/developer/");
  if (!user && !isPublicRoute) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0971fe] border-t-transparent" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
