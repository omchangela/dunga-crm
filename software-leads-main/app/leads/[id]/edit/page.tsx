"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchLead, leadsApi } from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import citiesData from "@/app/Indian_Cities_In_States.json";

const SOURCES = [
  { value: "ADVERTISEMENT",    label: "Advertisement"    },
  { value: "CLIENT_REFERENCE", label: "Client Reference" },
  { value: "SALES_EXECUTIVE",  label: "Sales Executive"  },
  { value: "OTHER",            label: "Other"            },
];

const STATUSES = [
  { value: "PENDING",  label: "Pending"  },
  { value: "REJECTED", label: "Rejected" },
];

const PROJECT_TYPES = [
  "Web Development",
  "App Development",
  "App + Web Development",
  "Digital Marketing",
  "Design Services",
  "Others",
];

const STATE_CITIES = citiesData as Record<string, string[]>;
const STATES = Object.keys(STATE_CITIES).sort();

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [lead, setLead] = useState<any>(null);
  const [form, setForm] = useState({
    fullName:    "",
    phone:       "",
    email:       "",
    state:       "",
    city:        "",
    projectType: "",
    status:      "PENDING",
    source:      "",
  });
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cities = useMemo(() => (form.state ? STATE_CITIES[form.state] ?? [] : []), [form.state]);

  useEffect(() => {
    if (!id) return;
    fetchLead(id)
      .then((found) => {
        if (found) {
          setLead(found);
          setForm({
            fullName:    found.fullName    ?? "",
            phone:       found.phone       ?? "",
            email:       found.email       ?? "",
            state:       found.state       ?? "",
            city:        found.city        ?? "",
            projectType: found.projectType ?? "",
            status:      found.status      ?? "PENDING",
            source:      found.source      ?? "",
          });
        }
      })
      .catch(() => setLead(null));
  }, [id]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim())    e.fullName    = "Client name is required.";
    if (!form.phone.trim())       e.phone       = "Phone number is required.";
    else if (!/^\d{10}$/.test(form.phone)) e.phone = "Enter a valid 10-digit phone number.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email.";
    if (!form.projectType) e.projectType = "Type of Services is required.";
    if (!form.source)      e.source      = "Source of lead is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    if (isSubmitting) return;
    const { name, value } = e.target;
    if (name === "state") {
      setForm((p) => ({ ...p, state: value, city: "" }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
    setErrors((p) => ({ ...p, [name]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);

    try {
      await leadsApi.update(id, {
        fullName:    form.fullName.trim(),
        phone:       form.phone.trim(),
        email:       form.email.trim(),
        state:       form.state,
        city:        form.city,
        serviceType: toEnum.service(form.projectType),
        source:      form.source,
        status:      form.status,
      });
      router.push(`/leads/${id}`);
    } catch (err: any) {
      if (err?.errors && typeof err.errors === "object") {
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) {
          fieldErrors[k === "serviceType" ? "projectType" : k] = Array.isArray(v) ? String(v[0]) : String(v);
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ phone: err?.message ?? "Failed to save changes." });
      }
      setIsSubmitting(false);
    }
  }

  if (!lead) {
    return <div className="flex items-center justify-center py-20 text-xs font-bold text-slate-400">Loading lead profile...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Clean Header */}
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Link
          href={`/leads/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Edit Lead Details</h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{lead.fullName} • {lead.phone}</p>
        </div>
      </div>

      {/* Form Container */}
      <div className="max-w-2xl mx-auto overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Client Name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Client Name *</label>
            <input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} disabled={isSubmitting}
              className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
            {errors.fullName && <p className="text-xs font-bold text-rose-600">{errors.fullName}</p>}
          </div>

          {/* Phone + Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Phone Number *</label>
              <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={10} disabled={isSubmitting}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
              {errors.phone && <p className="text-xs font-bold text-rose-600">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Email Address</label>
              <input id="email" name="email" type="email" placeholder="optional" value={form.email} onChange={handleChange} disabled={isSubmitting}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
              {errors.email && <p className="text-xs font-bold text-rose-600">{errors.email}</p>}
            </div>
          </div>

          {/* State + City */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="state" className="block text-xs font-bold text-slate-700 dark:text-slate-300">State</label>
              <select id="state" name="state" value={form.state} onChange={handleChange} disabled={isSubmitting}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                <option value="">Select state</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="city" className="block text-xs font-bold text-slate-700 dark:text-slate-300">City</label>
              <select id="city" name="city" value={form.city} onChange={handleChange} disabled={!form.state || isSubmitting}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none disabled:opacity-50">
                <option value="">Select city</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Type of Services + Status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="projectType" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Type of Services *</label>
              <select id="projectType" name="projectType" value={form.projectType} onChange={handleChange} disabled={isSubmitting}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                <option value="">Select type</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {errors.projectType && <p className="text-xs font-bold text-rose-600">{errors.projectType}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="status" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Status *</label>
              <select id="status" name="status" value={form.status} onChange={handleChange} disabled={isSubmitting}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <label htmlFor="source" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Source of Lead *</label>
            <select id="source" name="source" value={form.source} onChange={handleChange} disabled={isSubmitting}
              className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
              <option value="">Select source</option>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {errors.source && <p className="text-xs font-bold text-rose-600">{errors.source}</p>}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={() => router.back()} disabled={isSubmitting} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}