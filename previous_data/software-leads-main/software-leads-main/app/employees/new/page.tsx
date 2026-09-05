"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { employeesApi } from "@/lib/api";

export default function NewEmployeePage() {
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", target: "" });
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState("");

  useEffect(() => {
    employeesApi.getEnums()
      .then((d) => setRoles(d?.roles ?? []))
      .catch(() => {});
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email.";
    if (!form.role) e.role = "Role is required.";
    if (form.target && Number(form.target) <= 0) e.target = "Target must be a positive number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const res = await employeesApi.create({
        name:   form.name.trim(),
        email:  form.email.trim(),
        phone:  form.phone.trim() || undefined,
        role:   form.role,
        target: form.target ? Number(form.target) : undefined,
      });
      const emailSent = res?.data?.emailSent ?? res?.emailSent ?? true;
      setToast(emailSent ? "Employee created and welcome email sent." : "Employee created (email failed).");
      setTimeout(() => router.push("/employees"), 1500);
    } catch (err: any) {
      if (err?.errors) {
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) fe[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(fe);
      } else {
        setErrors({ name: err?.message ?? "Failed to create employee." });
      }
      setSaving(false);
    }
  }

  function field(key: string, label: string, type = "text", placeholder = "") {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-700">{label}</label>
        <input type={type} value={(form as any)[key]} placeholder={placeholder}
          onChange={(e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setErrors((p) => ({ ...p, [key]: "" })); }}
          className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none" />
        {errors[key] && <p className="text-xs text-red-600">{errors[key]}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="mx-auto max-w-2xl rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {toast}
        </div>
      )}

      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Link href="/employees" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5e9f2] bg-white text-[#8094ae] hover:bg-[#f5f6fa]">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#1a2035]">Add Employee</h1>
          <p className="text-sm text-[#8094ae]">Register a new team member</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
        {/* Info banner */}
        <div className="flex items-start gap-3 border-b border-[#e5e9f2] bg-blue-50/60 px-5 py-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0971fe]" />
          <p className="text-xs text-[#1a2035]">
            A random password will be generated and sent to the employee&apos;s email automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5 p-6">
          {field("name",  "Full Name *",  "text",  "e.g. Suresh Kumar")}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("email", "Email *",   "email", "employee@company.com")}
            {field("phone", "Phone",     "tel",   "10-digit (optional)")}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700">Role *</label>
            <select value={form.role}
              onChange={(e) => { setForm((p) => ({ ...p, role: e.target.value })); setErrors((p) => ({ ...p, role: "" })); }}
              className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none">
              <option value="">Select role</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.role && <p className="text-xs text-red-600">{errors.role}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-700">Monthly Target (₹)</label>
            <input type="number" min="0" value={form.target} placeholder="e.g. 200000"
              onChange={(e) => { setForm((p) => ({ ...p, target: e.target.value })); setErrors((p) => ({ ...p, target: "" })); }}
              className="h-10 w-full rounded-lg border border-[#e5e9f2] px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none" />
            <p className="text-xs text-[#8094ae]">Set initial target for current month</p>
            {errors.target && <p className="text-xs text-red-600">{errors.target}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[#0971fe] px-5 py-2 text-sm font-medium text-white hover:bg-[#0558d4] disabled:opacity-50">
              {saving ? "Creating…" : "Create Employee"}
            </button>
            <Link href="/employees"
              className="rounded-lg border border-[#e5e9f2] px-4 py-2 text-sm text-gray-500 hover:bg-[#f5f6fa]">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
