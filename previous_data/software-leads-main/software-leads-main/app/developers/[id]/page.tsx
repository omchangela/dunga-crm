"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, Briefcase,
  Star, Pencil, Trash2, CalendarDays, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { fetchDeveloper, developersApi } from "@/lib/api";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

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

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
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
  if (!dev)    return <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">Developer not found.</div>;

  const isActive = dev.status === "Active";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/developers"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <PageHeader title={dev.name} subtitle={dev.role} />
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/developers/${id}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa]">
            <Pencil className="h-4 w-4" />Edit
          </Link>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <span className="text-xs text-red-600">Delete?</span>
              <button onClick={handleDelete}
                className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600">Yes</button>
              <button onClick={() => setConfirmDelete(false)}
                className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-500 hover:bg-red-100">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-2 text-sm font-medium text-red-500 shadow-sm hover:border-red-200 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />Delete
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${isActive ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarBg(dev.name)}`}>
          {initials(dev.name)}
        </div>
        <div>
          <p className="font-semibold text-[#1a2035]">{dev.name}</p>
          <p className="text-sm text-[#8094ae]">{dev.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isActive ? "bg-green-400" : "bg-gray-400"}`} />
          <span className={`text-sm font-medium ${isActive ? "text-green-700" : "text-gray-500"}`}>{dev.status}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<User className="h-4 w-4" />}         label="Full Name"   value={dev.name} />
              <InfoRow icon={<Phone className="h-4 w-4" />}        label="Phone"       value={dev.phone} />
              <InfoRow icon={<Mail className="h-4 w-4" />}         label="Email"       value={dev.email} />
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Joined"      value={dev.joinedAt ? formatDate(dev.joinedAt) : "—"} />
              <InfoRow icon={<Briefcase className="h-4 w-4" />}    label="Role"        value={dev.role} />
              <InfoRow icon={<Star className="h-4 w-4" />}         label="Experience"  value={dev.experience} />
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills & Expertise</CardTitle>
          </CardHeader>
          <CardContent>
            {(dev.skills ?? []).length === 0 ? (
              <p className="text-sm text-[#8094ae]">No skills added.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(dev.skills as string[]).map((skill) => (
                  <span key={skill}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${skillClass(skill)}`}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
