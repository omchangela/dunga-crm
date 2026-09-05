"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, FolderKanban, CheckSquare, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeveloperAuthProvider, useDeveloperAuth } from "@/contexts/DeveloperAuthContext";

const NAV = [
  { label: "Dashboard",   href: "/developer/dashboard", icon: LayoutDashboard },
  { label: "My Projects", href: "/developer/projects",  icon: FolderKanban    },
  { label: "My Tasks",    href: "/developer/tasks",     icon: CheckSquare     },
  { label: "Settings",    href: "/developer/settings",  icon: Settings        },
] as const;

function DeveloperSidebar({ alwaysExpanded = false }: { alwaysExpanded?: boolean }) {
  const pathname = usePathname();
  const { developer, logout } = useDeveloperAuth();
  const [expanded, setExpanded] = useState(false);
  const isOpen = alwaysExpanded || expanded;

  const taskBadge = developer
    ? (developer.tasks?.pending ?? 0) + (developer.tasks?.inProgress ?? 0)
    : 0;

  return (
    <div
      onMouseEnter={() => { if (!alwaysExpanded) setExpanded(true); }}
      onMouseLeave={() => { if (!alwaysExpanded) setExpanded(false); }}
      className={cn(
        "flex h-full flex-col bg-[#1a2035] overflow-hidden transition-all duration-200",
        isOpen ? "w-60" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-3">
        {isOpen ? (
          <div className="px-1">
            <p className="text-sm font-bold text-white">Developer Portal</p>
            <p className="text-xs text-[#a8b4c8]">SoftLeads</p>
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600">
            <span className="text-sm font-extrabold text-white">D</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 [scrollbar-width:none]">
        {NAV.map(({ label, href, icon: Icon }) => {
          const isActive   = pathname.startsWith(href);
          const isTasks    = href === "/developer/tasks";
          const showBadge  = isTasks && taskBadge > 0;
          return (
            <Link key={href} href={href} title={!isOpen ? label : undefined}
              className={cn(
                "group flex items-center gap-3 mx-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-[#a8b4c8] hover:bg-[#252f48] hover:text-white"
              )}>
              <div className="relative shrink-0">
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-white" : "text-[#a8b4c8] group-hover:text-white")} />
                {showBadge && !isOpen && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                    {taskBadge > 9 ? "9+" : taskBadge}
                  </span>
                )}
              </div>
              {isOpen && <span className="truncate">{label}</span>}
              {isOpen && showBadge && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {taskBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Developer info */}
      {isOpen && developer && (
        <div className="mx-2 mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">{developer.name}</p>
          <p className="truncate text-xs text-[#a8b4c8]">{developer.role}</p>
        </div>
      )}

      {/* Logout */}
      <button onClick={() => logout()} title={!isOpen ? "Logout" : undefined}
        className="group mb-4 mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#a8b4c8] hover:bg-[#252f48] hover:text-red-400">
        <LogOut className="h-[18px] w-[18px] shrink-0 group-hover:text-red-400" />
        {isOpen && <span className="truncate">Logout</span>}
      </button>
    </div>
  );
}

function DeveloperShell({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/developer/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <DeveloperSidebar />
      </aside>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <DeveloperSidebar alwaysExpanded />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex min-h-screen flex-col lg:ml-16">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#e5e9f2] bg-white px-4 shadow-sm lg:px-6">
          <button onClick={() => setMobileOpen((p) => !p)}
            className="rounded-lg p-2 text-[#8094ae] hover:bg-[#f5f6fa] lg:hidden">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold text-[#1a2035]">Developer Portal</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <DeveloperAuthProvider>
      <DeveloperShell>{children}</DeveloperShell>
    </DeveloperAuthProvider>
  );
}
