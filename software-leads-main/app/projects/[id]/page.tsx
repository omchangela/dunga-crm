"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, FolderKanban, Layers,
  Hash, CalendarDays, DollarSign, Tag, Pencil, X, Code2, Check, CheckSquare,
  Plus, Trash2, IndianRupee, FileText, Loader2, Eye, ExternalLink, ArrowRight, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { fetchProject, projectsApi, fetchDevelopers } from "@/lib/api";
import { PdfViewerModal } from "@/components/shared/pdf-viewer-modal";
import { e as toEnum } from "@/lib/enum-maps";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_OPTIONS = ["Active", "Completed", "On Hold", "Cancelled"];

const STATUS_CFG: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  Active:    { dot: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800" },
  Completed: { dot: "bg-blue-400",    text: "text-blue-700 dark:text-blue-300",       bg: "bg-blue-50 dark:bg-blue-950/40",    border: "border-blue-200 dark:border-blue-800"     },
  "On Hold": { dot: "bg-amber-400",   text: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-50 dark:bg-amber-950/40",   border: "border-amber-200 dark:border-amber-800" },
  Cancelled: { dot: "bg-rose-400",    text: "text-rose-700 dark:text-rose-300",       bg: "bg-rose-50 dark:bg-rose-950/40",    border: "border-rose-200 dark:border-rose-800"       },
};

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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
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

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [project, setProject]               = useState<any>(null);
  const [allDevs, setAllDevs]               = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editStatus, setEditStatus]         = useState(false);
  const [newStatus, setNewStatus]           = useState("");
  const [editDeadline, setEditDeadline]     = useState(false);
  const [newDeadline, setNewDeadline]       = useState("");
  const [editDevs, setEditDevs]             = useState(false);
  const [selectedDevIds, setSelectedDevIds] = useState<string[]>([]);
  const [featureItems, setFeatureItems]       = useState<{id:string;name:string;price:string}[]>([]);
  const [newFeatureName, setNewFeatureName]   = useState("");
  const [newFeaturePrice, setNewFeaturePrice] = useState("");
  const [editTimeline, setEditTimeline]       = useState(false);
  const [timelineDraft, setTimelineDraft]     = useState<{ description: string; workingDays: string }[]>([]);
  const [toast, setToast]                   = useState<string | null>(null);
  const [pdfBusy, setPdfBusy]   = useState(false);
  const [projectPdfJob, setProjectPdfJob] = useState<{
    jobId: string; state: string; progress: number; message: string; result: any;
  } | null>(null);
  const projectPdfIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [viewer, setViewer]   = useState<{ url: string; title: string } | null>(null);

  useEffect(() => () => {
    if (projectPdfIntervalRef.current) clearInterval(projectPdfIntervalRef.current);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const found = await fetchProject(id);
      setProject(found);
      if (found) {
        setNewStatus(found.status);
        setNewDeadline(found.deadline ?? "");
        setSelectedDevIds(found.developers ?? []);
        setFeatureItems(found.featureItems ?? []);
      }
    } catch {
      setProject(null);
    } finally {
      fetchDevelopers().then(setAllDevs).catch(() => setAllDevs([]));
      setLoading(false);
    }
  }

  useEffect(() => { if (id) load(); }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleStatusSave() {
    if (!project || newStatus === project.status) { setEditStatus(false); return; }
    try {
      await projectsApi.update(project.id, { status: toEnum.status(newStatus) });
      await load();
      setEditStatus(false);
      showToast("Project status updated.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to update status.");
    }
  }

  async function handleDeadlineSave() {
    if (!project) return;
    try {
      await projectsApi.setDeadline(project.id, newDeadline || null);
      await load();
      setEditDeadline(false);
      showToast("Deadline saved.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to save deadline.");
    }
  }

  async function handleDevsSave() {
    if (!project) return;
    try {
      await projectsApi.setDevelopers(project.id, selectedDevIds, newDeadline || null);
      await load();
      setEditDevs(false);
      showToast("Developers and deadline saved.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to save developers.");
    }
  }

  async function handleAddFeature() {
    if (!newFeatureName.trim() || !project) return;
    try {
      await projectsApi.addFeature(project.id, newFeatureName.trim(), newFeaturePrice.trim());
      setNewFeatureName("");
      setNewFeaturePrice("");
      await load();
      showToast("Feature added.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to add feature.");
    }
  }

  async function handleDeleteFeature(featId: string) {
    if (!project) return;
    try {
      await projectsApi.removeFeature(project.id, featId);
      await load();
      showToast("Feature removed.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to remove feature.");
    }
  }

  function toggleDev(devId: string) {
    setSelectedDevIds((prev) =>
      prev.includes(devId) ? prev.filter((d) => d !== devId) : [...prev, devId]
    );
  }

  function startEditTimeline() {
    setTimelineDraft(
      (project.timelines ?? []).map((t: any) => ({
        description: t.description ?? "",
        workingDays: String(t.workingDays ?? ""),
      }))
    );
    setEditTimeline(true);
  }
  const addTimelineRow = () =>
    setTimelineDraft((prev) => [...prev, { description: "", workingDays: "" }]);
  const updateTimelineRow = (index: number, field: "description" | "workingDays", value: string) =>
    setTimelineDraft((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [field]: value };
      return arr;
    });
  const removeTimelineRow = (index: number) =>
    setTimelineDraft((prev) => prev.filter((_, i) => i !== index));

  async function handleTimelineSave() {
    if (!project) return;
    const cleaned = timelineDraft.filter((t) => t.description.trim() || String(t.workingDays).trim());
    try {
      await projectsApi.update(project.id, { timelines: cleaned });
      await load();
      setEditTimeline(false);
      showToast("Project timeline updated.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to update timeline.");
    }
  }

  async function handleEstimationPdf() {
    if (!project || pdfBusy || !project.estimationPdfUrl) return;
    setPdfBusy(true);
    try {
      const dl = await projectsApi.getPdf(project.id);
      const downloadUrl = dl?.data?.downloadUrl ?? dl?.data?.signedUrl;
      if (downloadUrl) {
        setViewer({ url: downloadUrl, title: `${project.projectName || "Project"} — Estimation PDF` });
      } else {
        showToast("Estimation PDF not available.");
      }
    } catch (err: any) {
      if (err?.status === 404) showToast("Estimation PDF not available.");
      else showToast(err?.message ?? "Failed to open PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleProjectPdf() {
    if (!project) return;
    const busy = projectPdfJob?.state === "queued" || projectPdfJob?.state === "active" || projectPdfJob?.state === "waiting";
    if (busy) return;
    try {
      const res = await projectsApi.generateProjectPdf(project.id);
      const jobId = res?.data?.jobId;
      if (!jobId) { showToast("Failed to queue PDF generation."); return; }
      setProjectPdfJob({ jobId, state: "queued", progress: 0, message: "Queued…", result: null });
      if (projectPdfIntervalRef.current) clearInterval(projectPdfIntervalRef.current);
      projectPdfIntervalRef.current = setInterval(async () => {
        try {
          const status = await projectsApi.getProjectPdfStatus(project.id, jobId);
          const d = status?.data ?? status;
          setProjectPdfJob({ jobId, state: d.state, progress: d.progress ?? 0, message: d.message ?? "", result: d.result ?? null });
          if (d.state === "completed") {
            clearInterval(projectPdfIntervalRef.current!);
            projectPdfIntervalRef.current = null;
            showToast("Project PDF generated");
            await load();
            const signedUrl = d.result?.signedUrl ?? d.result?.downloadUrl;
            if (signedUrl) setViewer({ url: signedUrl, title: `${project.projectName || "Project"} — Project PDF` });
            setProjectPdfJob(null);
          }
          if (d.state === "failed") {
            clearInterval(projectPdfIntervalRef.current!);
            projectPdfIntervalRef.current = null;
            showToast(d.error || "PDF generation failed");
            setProjectPdfJob((prev) => prev ? { ...prev, state: "failed" } : null);
          }
        } catch {}
      }, 2000);
    } catch (err: any) {
      showToast(err?.message ?? "Failed to generate project PDF.");
    }
  }

  async function handleViewProjectPdf() {
    if (!project || !project.projectPdfUrl) return;
    try {
      const dl = await projectsApi.getProjectPdf(project.id);
      const downloadUrl = dl?.data?.downloadUrl ?? dl?.data?.signedUrl;
      if (downloadUrl) {
        setViewer({ url: downloadUrl, title: `${project.projectName || "Project"} — Project PDF` });
      } else {
        showToast("Project PDF not available.");
      }
    } catch (err: any) {
      if (err?.status === 404) showToast("Project PDF not available.");
      else showToast(err?.message ?? "Failed to open PDF.");
    }
  }

  if (loading) return <DetailSkeleton />;
  if (!project) return <div className="flex items-center justify-center py-20 text-xs font-bold text-slate-400">Project record not found.</div>;

  const cfg          = STATUS_CFG[project.status] ?? STATUS_CFG["Active"];
  const assignedDevs = allDevs.filter((d) => (project.developers ?? []).includes(d.id));

  return (
    <div className="space-y-8 pb-10">

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md border border-white/15 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Active Projects
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  {project.projectName || project.headline}
                </h1>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {project.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Client: {project.clientName} • Service: {project.projectType || "Software Project"} • Cost: ₹{Number(project.budget || 0).toLocaleString("en-IN")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {projectPdfJob && (projectPdfJob.state === "queued" || projectPdfJob.state === "waiting" || projectPdfJob.state === "active") ? (
                <div className="flex min-w-[180px] flex-col gap-1 rounded-2xl bg-white/10 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />
                    <span>{projectPdfJob.message || "Generating..."}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                    <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.max(projectPdfJob.progress || 0, 5)}%` }} />
                  </div>
                </div>
              ) : (
                <button onClick={handleProjectPdf}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110">
                  <FileText className="h-4 w-4" />
                  {project.projectPdfUrl ? "Regenerate Contract PDF" : "Generate Contract PDF"}
                </button>
              )}

              {project.customerId && (
                <Link href={`/customers/${project.customerId}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition hover:bg-white/20">
                  <User className="h-4 w-4" />Customer Profile
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {toast}
        </div>
      )}

      {/* Project Status Management Bar */}
      <div className="flex flex-wrap items-center justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Current Pipeline Status:</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {project.status}
          </span>
        </div>

        {editStatus ? (
          <div className="flex items-center gap-2">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleStatusSave} className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
              Save Status
            </button>
            <button onClick={() => { setEditStatus(false); setNewStatus(project.status); }} className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setEditStatus(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
            <Pencil className="h-3.5 w-3.5" />Update Project Status
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Project Information */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-600" /> Project Specifications
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <InfoRow label="Project Name" value={project.projectName} />
            <InfoRow icon={<Tag className="h-4 w-4 text-purple-500" />} label="Service Type" value={project.projectType} />
            <InfoRow icon={<IndianRupee className="h-4 w-4 text-emerald-500" />} label="Budget" value={project.budget ? formatCurrency(project.budget) : "—"} />
            <InfoRow icon={<CalendarDays className="h-4 w-4 text-amber-500" />} label="Target Deadline" value={project.deadline ? formatDate(project.deadline) : "Not Set"} />
          </div>
        </div>

        {/* Client Profile */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" /> Client Contact Information
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <InfoRow icon={<User className="h-4 w-4 text-blue-500" />} label="Client Name" value={project.clientName} />
            <InfoRow icon={<Phone className="h-4 w-4 text-emerald-500" />} label="Phone" value={project.phone} />
            <InfoRow icon={<Mail className="h-4 w-4 text-indigo-500" />} label="Email" value={project.email} />
            <InfoRow icon={<CalendarDays className="h-4 w-4 text-slate-400" />} label="Project Created" value={formatDate(project.createdAt)} />
          </div>
        </div>

      </div>

      {/* ══ PROJECT OVERVIEW & SCOPE BREAKDOWN CARD ══ */}
      {project.overview && (project.overview.web?.length || project.overview.app?.length || project.overview.admin?.length) ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-600" /> Project Overview & Scope Breakdown
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Categorized module features (Web, App, Admin)</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {([
              { items: project.overview.web,   label: "Web Features",   dot: "bg-blue-500",    border: "border-blue-100 dark:border-blue-900/50",    bg: "bg-blue-50/40 dark:bg-blue-950/20" },
              { items: project.overview.app,   label: "App Features",   dot: "bg-emerald-500", border: "border-emerald-100 dark:border-emerald-900/50", bg: "bg-emerald-50/40 dark:bg-emerald-950/20" },
              { items: project.overview.admin, label: "Admin Features", dot: "bg-purple-500",  border: "border-purple-100 dark:border-purple-900/50", bg: "bg-purple-50/40 dark:bg-purple-950/20" },
            ] as const).map((cat) => (
              <div key={cat.label} className={`rounded-2xl border ${cat.border} ${cat.bg} p-4 space-y-3`}>
                <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">{cat.label}</span>
                  <span className="ml-auto rounded-full bg-white dark:bg-slate-900 border px-2 py-0.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                    {cat.items?.length || 0}
                  </span>
                </div>
                {cat.items && cat.items.length > 0 ? (
                  <div className="space-y-2">
                    {cat.items.map((item: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-medium">No items specified.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Assigned Engineering Team Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Code2 className="h-5 w-5 text-blue-600" /> Assigned Engineering Team
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{assignedDevs.length} Engineers assigned to delivery</p>
          </div>

          {!editDevs && (
            <button
              onClick={() => { setSelectedDevIds(project.developers ?? []); setEditDevs(true); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            >
              <Pencil className="h-3.5 w-3.5" />
              {assignedDevs.length > 0 ? "Edit Team Roster" : "Assign Developers"}
            </button>
          )}
        </div>

        {editDevs ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {allDevs.map((dev) => {
                const checked = selectedDevIds.includes(dev.id);
                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => toggleDev(dev.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      checked
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-800"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(dev.name)}`}>
                      {initials(dev.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{dev.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium truncate">{dev.role}</p>
                    </div>
                    {checked && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button onClick={handleDevsSave} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                Save Roster
              </button>
              <button onClick={() => setEditDevs(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        ) : assignedDevs.length === 0 ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">
            No developers assigned to this project yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assignedDevs.map((dev) => (
              <div key={dev.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ${avatarBg(dev.name)}`}>
                  {initials(dev.name)}
                </div>
                <div className="min-w-0">
                  <Link href={`/developers/${dev.id}`} className="font-extrabold text-slate-900 dark:text-white text-sm hover:text-blue-600 truncate block">
                    {dev.name}
                  </Link>
                  <p className="text-xs text-slate-400 font-semibold truncate">{dev.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ COST SUMMARY & BUDGET BREAKDOWN CARD ══ */}
      {(() => {
        const base      = Number(project.budget) || 0;
        const history   = project.costHistory ?? [];
        const featTotal = history.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const total     = base + featTotal;
        return (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-emerald-600" /> Cost Summary & Financial Breakdown
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Overview of project cost, feature additions, and payments</p>
              </div>
            </div>

            <div className="space-y-4">
              {project.payments && project.payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment Breakdown</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {project.payments.map((pay: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{pay.description || "Payment"}</span>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{formatCurrency(Number(pay.amount || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 px-5 py-3.5">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Base Project Cost</span>
                <span className="text-sm font-extrabold text-indigo-900 dark:text-indigo-100">{formatCurrency(base)}</span>
              </div>

              {history.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Feature Cost Additions</p>
                  <div className="space-y-2">
                    {history.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-900 px-4 py-3">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.label}</span>
                        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">+ {formatCurrency(Number(c.amount || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white shadow-md">
                <span className="text-xs font-extrabold uppercase tracking-wider">Total Contract Project Cost</span>
                <span className="text-lg font-black">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ PROJECT TIMELINE & SCHEDULE MILESTONES ══ */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Project Timeline — editable */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" /> Project Timeline & Milestones
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Working days breakdown per delivery phase</p>
            </div>

            {!editTimeline && (
              <button
                onClick={startEditTimeline}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                <Pencil className="h-3.5 w-3.5" />
                {project.timelines && project.timelines.length > 0 ? "Edit Timeline" : "Add Timeline"}
              </button>
            )}
          </div>

          {editTimeline ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {timelineDraft.length === 0 && (
                  <p className="text-xs font-bold text-slate-400">No timeline stages yet. Click "+ Add Phase" to begin.</p>
                )}
                {timelineDraft.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Phase / Description (e.g., UI Design & Wireframing)"
                      value={row.description}
                      onChange={(e) => updateTimelineRow(index, "description", e.target.value)}
                      className="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Working days"
                      value={row.workingDays}
                      onChange={(e) => updateTimelineRow(index, "workingDays", e.target.value)}
                      className="h-9 w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeTimelineRow(index)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addTimelineRow}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 px-3.5 py-2 text-xs font-bold text-blue-600 hover:bg-blue-100/60 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Phase
              </button>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button onClick={handleTimelineSave} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                  Save Timeline
                </button>
                <button onClick={() => setEditTimeline(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : project.timelines && project.timelines.length > 0 ? (
            <div className="space-y-3">
              {project.timelines.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">{t.description || "—"}</span>
                  <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400">{t.workingDays || 0} Working Days</span>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <span className="text-xs font-extrabold text-slate-400">
                  Total Duration: {project.timelines.reduce((sum: number, t: any) => sum + Number(t.workingDays || 0), 0)} Working Days
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-bold text-slate-400">
              No project timeline milestones set yet. Click "Add Timeline" to configure stages.
            </div>
          )}
        </div>

        {/* Scheduled Payment Installments */}
        {project.schedules && project.schedules.length > 0 && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-indigo-600" /> Payment Schedule Milestones
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Agreed payment terms & milestone triggers</p>
              </div>
            </div>

            <div className="space-y-3">
              {project.schedules.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">{s.description || "—"}</span>
                  <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400">{formatCurrency(Number(s.payment || 0))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ══ PROJECT FEATURES & SCOPE ADDITIONS CARD ══ */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-600" /> Project Scope & Features
              {featureItems.length > 0 && (
                <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2.5 py-0.5 text-xs font-extrabold text-blue-700 dark:text-blue-300">
                  {featureItems.length}
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Feature deliverables and additional scope item pricing</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Add feature row */}
          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <input
              type="text"
              placeholder="Enter feature title (e.g., Payment Gateway Integration)…"
              value={newFeatureName}
              onChange={(e) => setNewFeatureName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddFeature(); }}
              className="h-10 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
            <div className="relative w-full sm:w-44">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
              <input
                type="number"
                placeholder="Price (Optional)"
                value={newFeaturePrice}
                onChange={(e) => setNewFeaturePrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddFeature(); }}
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-7 pr-3 text-xs font-bold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleAddFeature}
              disabled={!newFeatureName.trim()}
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-blue-600 px-5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Add Feature
            </button>
          </div>

          {/* Feature items list */}
          {featureItems.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400 space-y-1">
              <CheckSquare className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p>No extra features added yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {featureItems.map((f) => (
                <div key={f.id} className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50 transition hover:border-blue-300">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.price && Number(f.price) > 0 ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        + {formatCurrency(Number(f.price))}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400">Included</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteFeature(f.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* In-app PDF viewer */}
      {viewer && (
        <PdfViewerModal url={viewer.url} title={viewer.title} onClose={() => setViewer(null)} />
      )}

    </div>
  );
}
