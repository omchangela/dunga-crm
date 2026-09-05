"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/shared/SidebarNav";
import { TopNav } from "@/components/shared/TopNav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f6fa]">

      {/* ── Desktop sidebar — hover to expand, always visible ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <SidebarNav />
      </aside>

      {/* ── Mobile sidebar — slides in from left ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarNav alwaysExpanded />
      </aside>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main content — offset by collapsed sidebar width on desktop ── */}
      <div className="flex min-h-screen flex-col lg:ml-16">
        <TopNav onMobileMenuOpen={() => setMobileOpen((p) => !p)} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

    </div>
  );
}
