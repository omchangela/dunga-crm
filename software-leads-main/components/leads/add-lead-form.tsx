"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Layers,
  Share2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  Sparkles,
  Building,
} from "lucide-react";
import { leadsApi } from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import citiesData from "@/app/Indian_Cities_In_States.json";

export const PROJECT_TYPES = [
  "Web Development",
  "App Development",
  "App + Web Development",
  "Digital Marketing",
  "Design Services",
  "Others",
];

const SOURCES = [
  { value: "ADVERTISEMENT", label: "Advertisement" },
  { value: "CLIENT_REFERENCE", label: "Client Reference" },
  { value: "SALES_EXECUTIVE", label: "Sales Executive" },
  { value: "OTHER", label: "Other" },
];

const STATE_CITIES = citiesData as Record<string, string[]>;
const STATES = Object.keys(STATE_CITIES).sort();

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  projectType: string;
  source: string;
  state: string;
  city: string;
}

const empty: FormState = {
  fullName: "",
  phone: "",
  email: "",
  projectType: "",
  source: "",
  state: "",
  city: "",
};

export function AddLeadForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cities = useMemo(
    () => (form.state ? STATE_CITIES[form.state] ?? [] : []),
    [form.state]
  );

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    if (name === "state") {
      setForm((p) => ({ ...p, state: value, city: "" }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
    setErrors((p) => ({ ...p, [name]: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Client name is required.";
    if (!form.phone.trim()) e.phone = "Phone number is required.";
    else if (!/^\d{10}$/.test(form.phone))
      e.phone = "Enter a valid 10-digit phone number.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    if (!form.projectType) e.projectType = "Service type is required.";
    if (!form.source) e.source = "Source of lead is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    try {
      await leadsApi.create({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        serviceType: toEnum.service(form.projectType),
        source: form.source,
      });
      router.push("/leads");
    } catch (err: any) {
      if (err?.errors && typeof err.errors === "object") {
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          fieldErrors[k === "serviceType" ? "projectType" : k] = Array.isArray(v)
            ? String(v[0])
            : String(v);
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ phone: err?.message ?? "Failed to create lead." });
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Form Section */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8"
      >
        {/* Section 1: Contact Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <User className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Contact Information
            </h2>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Client Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={form.fullName}
                onChange={handleChange}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
            {errors.fullName && (
              <p className="flex items-center gap-1 text-xs font-bold text-rose-600 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Phone & Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={handleChange}
                  maxLength={10}
                  className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
              {errors.phone && (
                <p className="flex items-center gap-1 text-xs font-bold text-rose-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.phone}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email Address <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="client@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 pl-10 pr-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
              {errors.email && (
                <p className="flex items-center gap-1 text-xs font-bold text-rose-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Location Details */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Location & Address
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="state" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                State
              </label>
              <select
                id="state"
                name="state"
                value={form.state}
                onChange={handleChange}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              >
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="city" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                City
              </label>
              <select
                id="city"
                name="city"
                value={form.city}
                onChange={handleChange}
                disabled={!form.state}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none disabled:opacity-50"
              >
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Service & Source Classification */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Layers className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Service Classification
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="projectType" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Type of Service <span className="text-rose-500">*</span>
              </label>
              <select
                id="projectType"
                name="projectType"
                value={form.projectType}
                onChange={handleChange}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              >
                <option value="">Select service category</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.projectType && (
                <p className="flex items-center gap-1 text-xs font-bold text-rose-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.projectType}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="source" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Lead Channel Source <span className="text-rose-500">*</span>
              </label>
              <select
                id="source"
                name="source"
                value={form.source}
                onChange={handleChange}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
              >
                <option value="">Select source</option>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.source && (
                <p className="flex items-center gap-1 text-xs font-bold text-rose-600 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.source}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Lead Entry...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Submit Lead Entry
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Live Summary Preview Sidebar */}
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              Live Entry Card Preview
            </h3>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm">
                {form.fullName ? form.fullName.slice(0, 2).toUpperCase() : "LD"}
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                  {form.fullName || "Client Name"}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  {form.phone || "10-digit Phone"}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Service:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {form.projectType || "Not Selected"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Source:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {form.source ? SOURCES.find((s) => s.value === form.source)?.label : "Not Selected"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {form.city ? `${form.city}, ${form.state}` : form.state || "Not Selected"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Initial Status:</span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full text-[11px]">
                  ● Pending Evaluation
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
            Submitting this record will add it directly into your live leads database for immediate team assignment and follow-up scheduling.
          </p>
        </div>
      </div>
    </div>
  );
}
