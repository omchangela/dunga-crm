"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info, CheckCircle2 } from "lucide-react";
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
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
        <input type={type} value={(form as any)[key]} placeholder={placeholder}
          onChange={(e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setErrors((p) => ({ ...p, [key]: "" })); }}
          className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
        {errors[key] && <p className="text-xs font-bold text-rose-600">{errors[key]}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Clean Header */}
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Link
          href="/employees"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Register New Employee</h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Add a sales executive or manager to handle pipeline leads and monthly targets</p>
        </div>
      </div>

      {toast && (
        <div className="mx-auto max-w-2xl flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {toast}
        </div>
      )}

      {/* Form Container */}
      <div className="max-w-2xl mx-auto overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            A temporary password will be generated and dispatched to the employee's email address automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {field("name",  "Full Name *",  "text",  "e.g. Suresh Kumar")}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("email", "Email Address *", "email", "employee@company.com")}
            {field("phone", "Phone Number",     "tel",   "10-digit number")}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Sales Role *</label>
            <select value={form.role}
              onChange={(e) => { setForm((p) => ({ ...p, role: e.target.value })); setErrors((p) => ({ ...p, role: "" })); }}
              className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
              <option value="">Select role</option>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.role && <p className="text-xs font-bold text-rose-600">{errors.role}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Initial Monthly Target (₹)</label>
            <input type="number" min="0" value={form.target} placeholder="e.g. 200000"
              onChange={(e) => { setForm((p) => ({ ...p, target: e.target.value })); setErrors((p) => ({ ...p, target: "" })); }}
              className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
            {errors.target && <p className="text-xs font-bold text-rose-600">{errors.target}</p>}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={saving} className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Creating..." : "Create Employee Record"}
            </button>
            <Link href="/employees" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
