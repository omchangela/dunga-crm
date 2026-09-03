"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, Briefcase,
  Star, Pencil, Trash2, CalendarDays, Code2, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchDeveloper, developersApi } from "@/lib/api";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

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

function skillClass(s: string) {
  return SKILL_COLORS[s] ?? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
}

const AVATAR_COLORS = [
  "bg-gradient-to-br from-blue-600 to-indigo-700",
  "bg-gradient-to-br from-violet-600 to-purple-700",
  "bg-gradient-to-br from-emerald-600 to-teal-700",
  "bg-gradient-to-br from-amber-600 to-orange-700",
  "bg-gradient-to-br from-rose-600 to-pink-700",
  "bg-gradient-to-br from-cyan-600 to-blue-700",
];

function avatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  if (!name) return "DV";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-xs font-extrabold text-slate-900 dark:text-white">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function DeveloperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [dev, setDev]               = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchDeveloper(id)
      .then((found) => setDev(found ?? null))
      .catch(() => setDev(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    try {
      await developersApi.delete(id);
    } catch (err) {
      console.error("Failed to delete developer:", err);
    }
    router.push("/developers");
  }

  if (loading) return <DetailSkeleton />;
  if (!dev)    return <div className="flex items-center justify-center py-20 text-xs font-bold text-slate-400">Developer record not found.</div>;

  const isActive = dev.status === "Active";

  return (
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md border border-white/15 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Engineering Team
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-lg ${avatarBg(dev.name)}`}>
                {initials(dev.name)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                    {dev.name}
                  </h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${
                    isActive ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" : "bg-white/10 text-slate-300 border-white/15"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-400"}`} />
                    {dev.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  {dev.role} • {dev.experience} • {dev.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/developers/${id}/edit`}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20">
                <Pencil className="h-4 w-4" />Edit Details
              </Link>
              {confirmDelete ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 px-3 py-1.5">
                  <span className="text-xs font-bold text-rose-200">Delete?</span>
                  <button onClick={handleDelete}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700">Yes</button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-rose-400/40 px-2.5 py-1 text-xs font-bold text-rose-200 hover:bg-white/10">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500/20 px-4 py-2.5 text-xs font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-500/30">
                  <Trash2 className="h-4 w-4" />Delete Profile
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Personal Info Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" /> Developer Profile Details
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <InfoRow icon={<User className="h-4 w-4 text-blue-500" />}         label="Full Name"   value={dev.name} />
            <InfoRow icon={<Phone className="h-4 w-4 text-emerald-500" />}        label="Phone"       value={dev.phone} />
            <InfoRow icon={<Mail className="h-4 w-4 text-indigo-500" />}         label="Email"       value={dev.email} />
            <InfoRow icon={<Briefcase className="h-4 w-4 text-purple-500" />}    label="Role"        value={dev.role} />
            <InfoRow icon={<Star className="h-4 w-4 text-amber-500" />}         label="Experience"  value={dev.experience} />
            <InfoRow icon={<CalendarDays className="h-4 w-4 text-slate-400" />} label="Joined Date"  value={dev.joinedAt ? formatDate(dev.joinedAt) : "—"} />
          </div>
        </div>

        {/* Skills Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" /> Technical Skills & Matrix
            </h2>
          </div>

          {(dev.skills ?? []).length === 0 ? (
            <p className="text-xs font-bold text-slate-400 py-6 text-center">No skills configured on developer profile.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(dev.skills as string[]).map((skill) => (
                <span key={skill}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${skillClass(skill)}`}>
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
