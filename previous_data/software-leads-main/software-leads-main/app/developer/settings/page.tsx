"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff, User, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { developerApi } from "@/lib/developerApi";
import { useDeveloperAuth } from "@/contexts/DeveloperAuthContext";

const AVATAR_COLORS = [
  "bg-blue-500","bg-purple-500","bg-emerald-500","bg-orange-500",
  "bg-pink-500","bg-teal-500","bg-indigo-500","bg-rose-500",
];
function avatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DeveloperSettingsPage() {
  const { developer } = useDeveloperAuth();
  const router = useRouter();
  const [form, setForm]     = useState({ current: "", next: "", confirm: "" });
  const [show, setShow]     = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const [done,   setDone]   = useState(false);

  function toggle(field: keyof typeof show) {
    setShow((p) => ({ ...p, [field]: !p[field] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.current)          { setError("Enter your current password."); return; }
    if (form.next.length < 8)   { setError("New password must be at least 8 characters."); return; }
    if (form.next !== form.confirm) { setError("New passwords do not match."); return; }
    setSaving(true);
    try {
      const res = await developerApi.changePassword(form.current, form.next);
      if (!res.success) throw new Error(res.message ?? "Failed to change password.");
      setDone(true);
      setForm({ current: "", next: "", confirm: "" });
      setTimeout(() => router.push("/developer/login"), 2000);
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
            className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 pr-10 text-sm text-gray-700 focus:border-teal-500 focus:outline-none"
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
        <p className="mt-0.5 text-sm text-[#8094ae]">Your profile and account settings</p>
      </div>

      {/* Profile card */}
      {developer && (
        <div className="overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#e5e9f2] px-5 py-4">
            <User className="h-4 w-4 text-teal-600" />
            <p className="font-semibold text-[#1a2035]">Profile</p>
          </div>
          <div className="p-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-sm ${avatarBg(developer.name)}`}>
                {initials(developer.name)}
              </div>
              <div>
                <p className="text-lg font-bold text-[#1a2035]">{developer.name}</p>
                <p className="text-sm text-[#8094ae]">{developer.role}</p>
                {developer.experience && (
                  <p className="text-xs text-[#8094ae]">{developer.experience}</p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-0.5 text-xs text-[#8094ae]">Email</p>
                <p className="text-sm font-medium text-[#1a2035]">{developer.email}</p>
              </div>
              {developer.phone && (
                <div>
                  <p className="mb-0.5 text-xs text-[#8094ae]">Phone</p>
                  <p className="text-sm font-medium text-[#1a2035]">{developer.phone}</p>
                </div>
              )}
              {developer.joinedAt && (
                <div>
                  <p className="mb-0.5 text-xs text-[#8094ae]">Joined</p>
                  <p className="text-sm font-medium text-[#1a2035]">{formatDate(developer.joinedAt)}</p>
                </div>
              )}
              <div>
                <p className="mb-0.5 text-xs text-[#8094ae]">Status</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  {developer.status}
                </span>
              </div>
            </div>

            {developer.skills && developer.skills.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs text-[#8094ae]">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {developer.skills.map((skill) => (
                    <span key={skill}
                      className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change password */}
      <div className="max-w-md overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e5e9f2] px-5 py-4">
          <KeyRound className="h-4 w-4 text-teal-600" />
          <p className="font-semibold text-[#1a2035]">Change Password</p>
        </div>

        {done && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Password changed. Redirecting to login…
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5">
          <PasswordInput id="current" label="Current Password"     value={form.current} fieldKey="current" showKey="current" />
          <PasswordInput id="next"    label="New Password"         value={form.next}    fieldKey="next"    showKey="next"    />
          <PasswordInput id="confirm" label="Confirm New Password" value={form.confirm} fieldKey="confirm" showKey="confirm" />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {saving ? "Saving…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
