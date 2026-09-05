"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Power } from "lucide-react";

export function UserMenu() {
  const { user, logout, logoutAll } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!user) return null;

  function handleLogoutAll() {
    setShowConfirm(true);
  }

  async function confirmLogoutAll() {
    setShowConfirm(false);
    await logoutAll();
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-[#f5f6fa]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0971fe] text-sm font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-medium text-[#1a2035]">{user.name}</p>
            <p className="text-xs text-[#8094ae]">{user.role}</p>
          </div>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-xl border border-[#e5e9f2] bg-white shadow-lg">
              <div className="border-b border-[#e5e9f2] px-4 py-3">
                <p className="font-medium text-[#1a2035]">{user.name}</p>
                <p className="text-xs text-[#8094ae]">{user.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-[#f5f6fa]"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
                <button
                  onClick={() => { setShowMenu(false); handleLogoutAll(); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Power className="h-4 w-4" />
                  Logout All Devices
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#1a2035]">Logout All Devices?</h3>
            <p className="mt-2 text-sm text-[#8094ae]">
              This will log you out from all devices and browsers. You'll need to log in again.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={confirmLogoutAll}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, Logout All
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-600 hover:bg-[#f5f6fa]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
