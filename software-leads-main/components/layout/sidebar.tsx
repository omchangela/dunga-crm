"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Bell,
  Building2,
  Briefcase,
  LogOut,
  X,
  Calculator,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { label: "Dashboard",      href: "/dashboard",    icon: LayoutDashboard },
  { label: "Leads",          href: "/leads",         icon: UserPlus        },
  { label: "Customers",      href: "/customers",     icon: Users           },
  { label: "Estimation",     href: "/estimation",    icon: Calculator      },
  { label: "Projects",       href: "/projects",      icon: FolderKanban    },
  { label: "Reminders",      href: "/reminders",     icon: Bell            },
  { label: "Bank Employees", href: "/bank-employees",icon: Building2       },
  { label: "DSA",            href: "/dsa",           icon: Briefcase       },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <img
            src="/dunga_logo.png"
            alt="Dunga Technologies Logo"
            className="h-10 w-auto object-contain"
          />
          <span className="text-sm font-black text-white tracking-tight">Dunga Tech</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-muted hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pt-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}
