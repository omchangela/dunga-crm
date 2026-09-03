"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { developersApi, fetchDeveloperEnums } from "@/lib/api";

const SKILL_COLORS: Record<string, string> = {
  "Frontend Development":  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  "Backend Development":   "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  "Database Management":   "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  "Server Maintenance":    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  "Mobile Development":    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  "DevOps / CI/CD":        "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300",
  "UI/UX Design":          "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:border-pink-800 dark:text-pink-300",
  "QA / Testing":          "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300",
  "Cloud Services":        "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300",
  "API Development":       "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300",
  "Cybersecurity":         "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  "Machine Learning / AI": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
};

export function skillClass(s: string) {
  return SKILL_COLORS[s] ?? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
}

export default function NewDeveloperPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    role: "", experience: "", status: "Active",
  });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [roleOptions, setRoleOptions]             = useState<string[]>([]);
  const [experienceOptions, setExperienceOptions] = useState<string[]>([]);
  const [skillOptions, setSkillOptions]           = useState<string[]>([]);

  useEffect(() => {
    fetchDeveloperEnums()
      .then((en) => {
        setRoleOptions(en.roles);
        setExperienceOptions(en.experienceLevels);
        setSkillOptions(en.skills);
      })
      .catch(() => {});
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
    setErrors((p) => ({ ...p, skills: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())       e.name       = "Name is required.";
    if (!form.phone.trim())      e.phone      = "Phone is required.";
    else if (!/^\d{10}$/.test(form.phone)) e.phone = "Enter a valid 10-digit number.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email.";
    if (!form.role)              e.role       = "Role is required.";
    if (!form.experience)        e.experience = "Experience level is required.";
    if (selectedSkills.length === 0) e.skills = "Select at least one skill.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await developersApi.create({
        name:       form.name.trim(),
        phone:      form.phone.trim(),
        email:      form.email.trim() || undefined,
        role:       form.role,
        experience: form.experience,
        skills:     selectedSkills,
        status:     form.status,
      });
      router.push("/developers");
    } catch (err: any) {
      if (err?.errors && typeof err.errors === "object") {
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) fieldErrors[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(fieldErrors);
      } else {
        setErrors({ name: err?.message ?? "Failed to add developer." });
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Clean Header */}
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Link
          href="/developers"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Register New Developer</h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Add a new engineering team member to the developer directory</p>
        </div>
      </div>

      {/* Form Container */}
      <div className="max-w-2xl mx-auto overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</label>
            <input id="name" name="name" placeholder="e.g. Arun Sharma"
              value={form.name} onChange={handleChange}
              className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
            {errors.name && <p className="text-xs font-bold text-rose-600">{errors.name}</p>}
          </div>

          {/* Phone + Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Phone *</label>
              <input id="phone" name="phone" type="tel" placeholder="10-digit number"
                value={form.phone} onChange={handleChange} maxLength={10}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
              {errors.phone && <p className="text-xs font-bold text-rose-600">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Email Address</label>
              <input id="email" name="email" type="email" placeholder="optional"
                value={form.email} onChange={handleChange}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none" />
              {errors.email && <p className="text-xs font-bold text-rose-600">{errors.email}</p>}
            </div>
          </div>

          {/* Role + Experience */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="role" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Engineering Role *</label>
              <select id="role" name="role" value={form.role} onChange={handleChange}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                <option value="">Select role</option>
                {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.role && <p className="text-xs font-bold text-rose-600">{errors.role}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="experience" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Experience Level *</label>
              <select id="experience" name="experience" value={form.experience} onChange={handleChange}
                className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
                <option value="">Select experience</option>
                {experienceOptions.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              {errors.experience && <p className="text-xs font-bold text-rose-600">{errors.experience}</p>}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label htmlFor="status" className="block text-xs font-bold text-slate-700 dark:text-slate-300">Status</label>
            <select id="status" name="status" value={form.status} onChange={handleChange}
              className="h-11 w-full rounded-2xl border border-slate-200/80 bg-slate-50 px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Skills */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Skills Matrix *</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {skillOptions.map((skill) => {
                const checked = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                      checked
                        ? `${skillClass(skill)} ring-1 ring-blue-500/30`
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    <span className={`h-4 w-4 shrink-0 rounded-lg border ${
                      checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    } flex items-center justify-center`}>
                      {checked && <Check className="h-3 w-3 stroke-[3]" />}
                    </span>
                    {skill}
                  </button>
                );
              })}
            </div>
            {errors.skills && <p className="text-xs font-bold text-rose-600">{errors.skills}</p>}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Add Developer Record"}
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
