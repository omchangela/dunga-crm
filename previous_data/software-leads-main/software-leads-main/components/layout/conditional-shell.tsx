"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Employee and developer portals use their own layouts — skip admin shell.
  if (pathname === "/login" || pathname === "/employee/login" || pathname.startsWith("/employee/") || pathname.startsWith("/developer/")) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
