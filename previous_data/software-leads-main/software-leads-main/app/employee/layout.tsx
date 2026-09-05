"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, Building2, FolderKanban, LogOut, Menu, X, Settings, Calculator, Bell, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeAuthProvider, useEmployeeAuth } from "@/contexts/EmployeeAuthContext";
import { employeePortalApi } from "@/lib/api";

const NAV = [
  { label: "Dashboard",  href: "/employee/dashboard",  icon: LayoutDashboard },
  { label: "Leads",   href: "/employee/leads",      icon: Users           },
  { label: "Reminders",  href: "/employee/reminders",  icon: Bell            },
  { label: "Customers", href: "/employee/customers", icon: Building2       },
  { label: "Estimation", href: "/employee/estimation", icon: Calculator      },
  { label: "My Projects",   href: "/employee/projects",      icon: FolderKanban },
  { label: "Subscriptions", href: "/employee/subscriptions", icon: CreditCard  },
  { label: "Settings",      href: "/employee/settings",      icon: Settings    },
] as const;

function EmployeeSidebar({ alwaysExpanded = false }: { alwaysExpanded?: boolean }) {
  const pathname = usePathname();
  const { employee, logout } = useEmployeeAuth();
  const [expanded, setExpanded] = useState(false);
  const [reminderBadge, setReminderBadge] = useState(0);
  const isOpen = alwaysExpanded || expanded;

  useEffect(() => {
    if (!employee) return;
    employeePortalApi.listReminders()
      .then((d: any) => {
        const count = d?.pendingCount ?? d?.data?.pendingCount ?? 0;
        setReminderBadge(count);
      })
      .catch(() => {});
  }, [employee]);

  return (
    <div
      onMouseEnter={() => { if (!alwaysExpanded) setExpanded(true); }}
      onMouseLeave={() => { if (!alwaysExpanded) setExpanded(false); }}
      className={cn(
        "flex h-full flex-col bg-[#1a2035] overflow-hidden transition-all duration-200",
        isOpen ? "w-60" : "w-16"
      )}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-3">
        {isOpen ? (
          <div className="px-1">
            <p className="text-sm font-bold text-white">Employee Portal</p>
            <p className="text-xs text-[#a8b4c8]">SoftLeads</p>
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0971fe]">
            <span className="text-sm font-extrabold text-white">E</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 [scrollbar-width:none]">
        {NAV.map(({ label, href, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          const isReminders = href === "/employee/reminders";
          const showBadge = isReminders && reminderBadge > 0;
          return (
            <Link key={href} href={href} title={!isOpen ? label : undefined}
              className={cn(
                "group flex items-center gap-3 mx-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-[#0971fe] text-white" : "text-[#a8b4c8] hover:bg-[#252f48] hover:text-white"
              )}>
              <div className="relative shrink-0">
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-white" : "text-[#a8b4c8] group-hover:text-white")} />
                {showBadge && !isOpen && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                    {reminderBadge > 9 ? "9+" : reminderBadge}
                  </span>
                )}
              </div>
              {isOpen && <span className="truncate">{label}</span>}
              {isOpen && showBadge && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {reminderBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {isOpen && employee && (
        <div className="mx-2 mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">{employee.name}</p>
          <p className="truncate text-xs text-[#a8b4c8]">{employee.role}</p>
        </div>
      )}

      <button onClick={() => logout()} title={!isOpen ? "Logout" : undefined}
        className="group mb-4 mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#a8b4c8] hover:bg-[#252f48] hover:text-red-400">
        <LogOut className="h-[18px] w-[18px] shrink-0 group-hover:text-red-400" />
        {isOpen && <span className="truncate">Logout</span>}
      </button>
    </div>
  );
}

function EmployeeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/employee/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <EmployeeSidebar />
      </aside>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <EmployeeSidebar alwaysExpanded />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex min-h-screen flex-col lg:ml-16">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#e5e9f2] bg-white px-4 shadow-sm lg:px-6">
          <button onClick={() => setMobileOpen((p) => !p)} className="rounded-lg p-2 text-[#8094ae] hover:bg-[#f5f6fa] lg:hidden">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold text-[#1a2035]">Employee Portal</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmployeeAuthProvider>
      <EmployeeShell>{children}</EmployeeShell>
    </EmployeeAuthProvider>
  );
}
