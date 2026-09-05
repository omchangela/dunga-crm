"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { employeePortalApi } from "@/lib/api";

export default function EmployeeSettingsPage() {
  const [form, setForm]     = useState({ current: "", next: "", confirm: "" });
  const [show, setShow]     = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [done, setDone]     = useState(false);

  function toggle(field: keyof typeof show) {
    setShow((p) => ({ ...p, [field]: !p[field] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.current) { setError("Enter your current password."); return; }
    if (form.next.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (form.next !== form.confirm) { setError("New passwords do not match."); return; }
    setSaving(true);
    try {
      const res = await employeePortalApi.changePassword(form.current, form.next);
      if (!res.success) throw new Error(res.message ?? "Failed to change password.");
      setDone(true);
      setForm({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function PasswordInput({ id, label, value, fieldKey, showKey }: {
    id: string; label: string; value: string;
    fieldKey: keyof typeof form; showKey: keyof typeof show;
  }) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="block text-xs font-medium text-gray-700">{label}</label>
        <div className="relative">
          <input
            id={id}
            type={show[showKey] ? "text" : "password"}
            value={value}
            onChange={(e) => { setForm((p) => ({ ...p, [fieldKey]: e.target.value })); setDone(false); }}
            className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 pr-10 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none"
            autoComplete="off"
          />
          <button type="button" onClick={() => toggle(showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8094ae] hover:text-gray-600">
            {show[showKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a2035]">Settings</h1>
        <p className="mt-0.5 text-sm text-[#8094ae]">Manage your account</p>
      </div>

      <div className="max-w-md overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e5e9f2] px-5 py-4">
          <KeyRound className="h-4 w-4 text-[#0971fe]" />
          <p className="font-semibold text-[#1a2035]">Change Password</p>
        </div>

        {done && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Password changed successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5">
          <PasswordInput id="current" label="Current Password"     value={form.current} fieldKey="current" showKey="current" />
          <PasswordInput id="next"    label="New Password"         value={form.next}    fieldKey="next"    showKey="next"    />
          <PasswordInput id="confirm" label="Confirm New Password" value={form.confirm} fieldKey="confirm" showKey="confirm" />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full rounded-lg bg-[#0971fe] py-2.5 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
            {saving ? "Saving…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
