"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  ChevronDown,
  LogOut,
  Settings,
  User,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface TopNavProps {
  onMobileMenuOpen: () => void;
}

function initialsOf(name?: string) {
  if (!name) return "U";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function TopNav({ onMobileMenuOpen }: TopNavProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const displayName = user?.name ?? "User";
  const displayRole = user?.role ?? "";
  const initials = initialsOf(user?.name);

  // Helper to format the pathname into a readable title
  const getPageTitle = () => {
    const segment = pathname.split("/").pop();
    if (!segment || segment === "dashboard") return "Dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#e5e9f2] bg-white px-4 shadow-sm lg:px-6">
      
      {/* ── Left Side: Logo & Breadcrumbs ── */}
      <div className="flex items-center gap-4">
        {/* Hamburger (mobile only) */}
        <button
          onClick={onMobileMenuOpen}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 text-[#8094ae] transition-colors hover:bg-[#f5f6fa] hover:text-gray-700 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo */}
        <div className="hidden lg:flex items-center gap-2">
          <img
            src="/dunga_logo.png"
            alt="Dunga Technologies"
            className="h-9 w-auto object-contain"
          />
          <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Dunga Technologies</span>
        </div>

        {/* Vertical Divider (Desktop only) */}
        <div className="hidden h-6 w-[1px] bg-[#e5e9f2] lg:block" />

        {/* Dynamic Page Title / Breadcrumb */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="hidden text-[#8094ae] sm:inline">App</span>
          <ChevronRight className="hidden h-4 w-4 text-[#8094ae] sm:inline" />
          <span className="text-gray-800">{getPageTitle()}</span>
        </div>
      </div>

      {/* ── Right Side: Profile ── */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* User avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#f5f6fa]"
          >
            <div className="rounded-full bg-gradient-to-br from-[#0971fe] via-[#818cf8] to-[#a855f7] p-[2px]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
                <span className="select-none bg-gradient-to-br from-[#0971fe] to-[#a855f7] bg-clip-text text-[11px] font-extrabold text-transparent">
                  {initials}
                </span>
              </div>
            </div>
            <div className="hidden flex-col items-start sm:flex">
              <span className="text-xs font-semibold leading-none text-gray-800">{displayName}</span>
              {displayRole && <span className="mt-0.5 text-[10px] leading-none text-[#8094ae]">{displayRole}</span>}
            </div>
            <ChevronDown
              className={cn(
                "hidden h-3.5 w-3.5 text-[#8094ae] transition-transform duration-200 sm:inline",
                userMenuOpen && "rotate-180"
              )}
            />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-lg">
                <div className="border-b border-[#e5e9f2] bg-gradient-to-r from-[#0971fe]/5 to-[#a855f7]/5 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-full bg-gradient-to-br from-[#0971fe] via-[#818cf8] to-[#a855f7] p-[2px]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                        <span className="select-none bg-gradient-to-br from-[#0971fe] to-[#a855f7] bg-clip-text text-xs font-extrabold text-transparent">{initials}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{displayName}</p>
                      <p className="text-xs text-[#8094ae]">{[displayRole, "SoftLeads"].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-[#f5f6fa]">
                    <User className="h-4 w-4 text-[#8094ae]" />Profile
                  </button>
                  <button className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-[#f5f6fa]">
                    <Settings className="h-4 w-4 text-[#8094ae]" />Settings
                  </button>
                  <div className="my-1 border-t border-[#e5e9f2]" />
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}