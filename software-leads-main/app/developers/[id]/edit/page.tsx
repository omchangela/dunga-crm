"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button }  from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import { Select }  from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { fetchDeveloper, developersApi, fetchDeveloperEnums } from "@/lib/api";

const SKILL_COLORS: Record<string, string> = {
  "Frontend Development":  "bg-blue-50 text-blue-700 border-blue-200",
  "Backend Development":   "bg-purple-50 text-purple-700 border-purple-200",
  "Database Management":   "bg-orange-50 text-orange-700 border-orange-200",
  "Server Maintenance":    "bg-red-50 text-red-700 border-red-200",
  "Mobile Development":    "bg-green-50 text-green-700 border-green-200",
  "DevOps / CI/CD":        "bg-yellow-50 text-yellow-700 border-yellow-200",
  "UI/UX Design":          "bg-pink-50 text-pink-700 border-pink-200",
  "QA / Testing":          "bg-teal-50 text-teal-700 border-teal-200",
  "Cloud Services":        "bg-sky-50 text-sky-700 border-sky-200",
  "API Development":       "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Cybersecurity":         "bg-rose-50 text-rose-700 border-rose-200",
  "Machine Learning / AI": "bg-emerald-50 text-emerald-700 border-emerald-200",
};
function skillClass(s: string) {
  return SKILL_COLORS[s] ?? "bg-gray-50 text-gray-700 border-gray-200";
}

export default function EditDeveloperPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [dev, setDev]               = useState<any>(null);
  const [form, setForm]             = useState({ name: "", phone: "", email: "", role: "", experience: "", status: "Active" });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleOptions, setRoleOptions]             = useState<string[]>([]);
  const [experienceOptions, setExperienceOptions] = useState<string[]>([]);
  const [skillOptions, setSkillOptions]           = useState<string[]>([]);

  useEffect(() => {
    fetchDeveloperEnums()
      .then((en) => { setRoleOptions(en.roles); setExperienceOptions(en.experienceLevels); setSkillOptions(en.skills); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchDeveloper(id)
      .then((found) => {
        if (found) {
          setDev(found);
          setForm({
            name:       found.name       ?? "",
            phone:      found.phone      ?? "",
            email:      found.email      ?? "",
            role:       found.role       ?? "",
            experience: found.experience ?? "",
            status:     found.status     ?? "Active",
          });
          setSelectedSkills(found.skills ?? []);
        }
      })
      .catch(() => setDev(null));
  }, [id]);

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
      await developersApi.update(id, {
        name:       form.name.trim(),
        phone:      form.phone.trim(),
        email:      form.email.trim(),
        role:       form.role,
        experience: form.experience,
        skills:     selectedSkills,
        status:     form.status,
      });
      router.push(`/developers/${id}`);
      return;
    } catch (err: any) {
      if (err?.errors && typeof err.errors === "object") {
        const fieldErrors: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.errors)) fieldErrors[k] = Array.isArray(v) ? String(v[0]) : String(v);
        setErrors(fieldErrors);
      } else {
        setErrors({ name: err?.message ?? "Failed to save changes." });
      }
      setIsSubmitting(false);
      return;
    }
  }

  if (!dev) return <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/developers/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title="Edit Developer" subtitle={dev.name} />
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle>Edit Developer Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
              <Input id="name" name="name" value={form.name} onChange={handleChange} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Phone + Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
                <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={10} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="optional" value={form.email} onChange={handleChange} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>

            {/* Role + Experience */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="role">Role <span className="text-destructive">*</span></Label>
                <Select id="role" name="role" value={form.role} onChange={handleChange}>
                  <option value="">Select role</option>
                  {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
                {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="experience">Experience <span className="text-destructive">*</span></Label>
                <Select id="experience" name="experience" value={form.experience} onChange={handleChange}>
                  <option value="">Select experience</option>
                  {experienceOptions.map((e) => <option key={e} value={e}>{e}</option>)}
                </Select>
                {errors.experience && <p className="text-xs text-destructive">{errors.experience}</p>}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" value={form.status} onChange={handleChange}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <Label>Skills <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {skillOptions.map((skill) => {
                  const checked = selectedSkills.includes(skill);
                  return (
                    <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                        checked
                          ? `${skillClass(skill)} ring-1 ring-current/30`
                          : "border-[#e5e9f2] bg-white text-gray-500 hover:border-[#0971fe]/30 hover:text-gray-700"
                      }`}>
                      <span className={`h-3.5 w-3.5 shrink-0 rounded border ${checked ? "border-current bg-current" : "border-gray-300"} flex items-center justify-center`}>
                        {checked && (
                          <svg viewBox="0 0 8 6" fill="none" className="h-2 w-2">
                            <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      {skill}
                    </button>
                  );
                })}
              </div>
              {errors.skills && <p className="text-xs text-destructive">{errors.skills}</p>}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
