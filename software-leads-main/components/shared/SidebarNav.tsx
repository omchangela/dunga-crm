"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Bell,
  FolderKanban,
  Code2,
  LogOut,
  Wallet,
  CheckSquare,
  CreditCard,
  Calculator,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Leads",      href: "/leads",      icon: UserPlus        },
  { label: "Reminders",  href: "/reminders",  icon: Bell            },
  { label: "Customers",  href: "/customers",  icon: Users           },
  { label: "Estimation", href: "/estimation", icon: Calculator      },
  { label: "Projects",   href: "/projects",   icon: FolderKanban    },
  { label: "Finances",      href: "/finances",      icon: Wallet       },
  { label: "Developers",   href: "/developers",   icon: Code2        },
  { label: "Employees",    href: "/employees",    icon: Contact      },
  { label: "Tasks",        href: "/tasks",        icon: CheckSquare  },
  { label: "Subscriptions",href: "/subscriptions",icon: CreditCard   },
  
] as const;

interface SidebarNavProps {
  alwaysExpanded?: boolean;
}

export function SidebarNav({ alwaysExpanded = false }: SidebarNavProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const isOpen = alwaysExpanded || expanded;

  return (
    <div
      onMouseEnter={() => { if (!alwaysExpanded) setExpanded(true); }}
      onMouseLeave={() => { if (!alwaysExpanded) setExpanded(false); }}
      className={cn(
        "flex h-full flex-col bg-[#1a2035] overflow-hidden transition-all duration-200 ease-in-out",
        isOpen ? "w-60" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-3">
        {isOpen ? (
          <img src="/loanlogo.png" alt="SoftLeads" className="h-40 max-w-[160px] object-contain" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0971fe]">
            <span className="text-sm font-extrabold text-white">S</span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/" || pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={!isOpen ? label : undefined}
              className={cn(
                "group flex items-center gap-3 mx-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-[#0971fe] text-white"
                  : "text-[#a8b4c8] hover:bg-[#252f48] hover:text-white"
              )}
            >
              <Icon className={cn(
                "h-[18px] w-[18px] shrink-0 transition-colors",
                isActive ? "text-white" : "text-[#a8b4c8] group-hover:text-white"
              )} />
              {isOpen && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={() => logout()}
        title={!isOpen ? "Logout" : undefined}
        className="group mb-4 mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#a8b4c8] transition-colors duration-150 hover:bg-[#252f48] hover:text-red-400"
      >
        <LogOut className="h-[18px] w-[18px] shrink-0 transition-colors group-hover:text-red-400" />
        {isOpen && <span className="truncate">Logout</span>}
      </button>
    </div>
  );
}
