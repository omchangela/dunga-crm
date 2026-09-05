"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, FolderKanban,
  Hash, CalendarDays, DollarSign, Tag, Pencil, X, Code2, Check, CheckSquare,
  Plus, Trash2, IndianRupee, FileText, Loader2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { fetchProject, projectsApi, fetchDevelopers } from "@/lib/api";
import { PdfViewerModal } from "@/components/shared/pdf-viewer-modal";
import { e as toEnum } from "@/lib/enum-maps";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_OPTIONS = ["Active", "Completed", "On Hold", "Cancelled"];

const STATUS_CFG: Record<string, { dot: string; text: string; bg: string }> = {
  Active:    { dot: "bg-green-400",  text: "text-green-700",  bg: "bg-green-50 border-green-200"   },
  Completed: { dot: "bg-blue-400",   text: "text-blue-700",   bg: "bg-blue-50 border-blue-200"     },
  "On Hold": { dot: "bg-yellow-400", text: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  Cancelled: { dot: "bg-red-400",    text: "text-red-600",    bg: "bg-red-50 border-red-200"       },
};

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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
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

  // View-only estimation PDF: generated from the Estimation module, just viewed here.
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

  // Generate the project (contract) PDF via async job, poll until done, then view it.
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
        } catch { /* keep polling on transient errors */ }
      }, 2000);
    } catch (err: any) {
      showToast(err?.message ?? "Failed to generate project PDF.");
    }
  }

  // View-only project PDF: open the already-generated contract PDF.
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
  if (!project) return <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">Project not found.</div>;

  const cfg          = STATUS_CFG[project.status] ?? STATUS_CFG["Active"];
  const assignedDevs = allDevs.filter((d) => (project.developers ?? []).includes(d.id));

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {toast}
          <button onClick={() => setToast(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <PageHeader title={project.projectName || project.headline} subtitle={project.headline && project.projectName ? project.headline : "Project details from converted lead."} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Project PDF — generate (or regenerate) a fresh contract PDF; view it in the bar below */}
          {projectPdfJob && (projectPdfJob.state === "queued" || projectPdfJob.state === "waiting" || projectPdfJob.state === "active") ? (
            <div className="flex min-w-[200px] flex-col gap-1">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin text-[#0971fe]" />
                <span>{projectPdfJob.message || "Generating…"}{projectPdfJob.progress > 0 ? ` ${projectPdfJob.progress}%` : ""}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-1.5 rounded-full bg-[#0971fe] transition-all duration-300"
                  style={{ width: `${Math.max(projectPdfJob.progress || 0, 5)}%` }} />
              </div>
            </div>
          ) : projectPdfJob?.state === "failed" ? (
            <button onClick={handleProjectPdf}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">
              <FileText className="h-4 w-4" />Retry PDF
            </button>
          ) : (
            <button onClick={handleProjectPdf}
              className="flex items-center gap-1.5 rounded-lg bg-[#0971fe] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0558d4]">
              <FileText className="h-4 w-4" />
              {project.projectPdfUrl ? "Regenerate Project PDF" : "Generate Project PDF"}
            </button>
          )}

          {project.customerId && (
            <Link href={`/customers/${project.customerId}`}
              className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa]">
              <User className="h-4 w-4" />View Customer
            </Link>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${cfg.bg}`}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
        <span className={`text-sm font-medium ${cfg.text}`}>{project.status}</span>
        {editStatus ? (
          <div className="ml-auto flex items-center gap-2">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="h-8 rounded-lg border border-[#e5e9f2] bg-white px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleStatusSave}
              className="rounded-lg bg-[#0971fe] px-3 py-1 text-xs font-medium text-white hover:bg-[#0558d4]">
              Save
            </button>
            <button onClick={() => { setEditStatus(false); setNewStatus(project.status); }}
              className="rounded-lg border border-[#e5e9f2] px-3 py-1 text-xs text-gray-500 hover:bg-white">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setEditStatus(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-current/20 px-3 py-1 text-xs font-medium hover:bg-white/60">
            <Pencil className="h-3 w-3" />Change Status
          </button>
        )}
        <span className="text-xs text-[#8094ae]">
          Created {formatDate(project.createdAt)}
        </span>
      </div>

      {/* Generated documents — view each PDF from here */}
      {(project.estimationPdfUrl || project.projectPdfUrl) && (
        <div className="space-y-2 rounded-xl border border-[#e5e9f2] bg-white px-4 py-3 shadow-sm">
          {project.estimationPdfUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-[#1a2035]">
                <FileText className="h-4 w-4 text-[#0971fe]" />
                <span className="font-medium">Estimation PDF</span>
                {project.estimationPdfAt && (
                  <span className="text-xs text-[#8094ae]">· Last generated: {formatDateTime(project.estimationPdfAt)}</span>
                )}
              </span>
              <button
                onClick={handleEstimationPdf}
                disabled={pdfBusy}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa] disabled:opacity-60"
              >
                {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                {pdfBusy ? "Opening…" : "View"}
              </button>
            </div>
          )}
          {project.projectPdfUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-[#1a2035]">
                <FileText className="h-4 w-4 text-[#0971fe]" />
                <span className="font-medium">Project PDF</span>
                {project.projectPdfAt && (
                  <span className="text-xs text-[#8094ae]">· Last generated: {formatDateTime(project.projectPdfAt)}</span>
                )}
              </span>
              <button
                onClick={handleViewProjectPdf}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
              >
                <Eye className="h-3.5 w-3.5" />View
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* Project info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-[#0971fe]" />
              <CardTitle className="text-base">Project Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow label="Project Name" value={project.projectName} />
              {project.headline && (
                <InfoRow label="Headline" value={project.headline} />
              )}
              <InfoRow icon={<Tag className="h-4 w-4" />} label="Type of Services" value={project.projectType} />
              <InfoRow  label="Project Budget"
                value={project.budget ? formatCurrency(project.budget) : "—"} />
              {/* <InfoRow icon={<Hash className="h-4 w-4" />} label="Contract Number" value={project.contractNumber} /> */}
            </div>

            {/* Deadline */}
            <div className="flex items-start justify-between rounded-xl bg-[#f5f6fa] px-4 py-3">
              <div className="flex-1">
                <p className="mb-1 text-xs font-medium text-[#8094ae]">
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5" />Deadline
                </p>
                {editDeadline ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="h-8 rounded-lg border border-[#e5e9f2] bg-white px-2 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none"
                    />
                    <button onClick={handleDeadlineSave}
                      className="rounded-lg bg-[#0971fe] px-3 py-1 text-xs font-medium text-white hover:bg-[#0558d4]">
                      Save
                    </button>
                    <button onClick={() => { setEditDeadline(false); setNewDeadline(project.deadline ?? ""); }}
                      className="rounded-lg border border-[#e5e9f2] bg-white px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                ) : project.deadline ? (() => {
                  const due = new Date(project.deadline);
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const overdue = due < today;
                  return (
                    <p className={`flex items-center gap-2 text-sm font-semibold ${overdue ? "text-red-600" : "text-green-600"}`}>
                      {formatDate(project.deadline)}
                      {overdue && (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                          Overdue
                        </span>
                      )}
                    </p>
                  );
                })() : (
                  <p className="text-sm font-medium text-[#1a2035]">
                    <span className="text-[#8094ae] italic">Not set</span>
                  </p>
                )}
              </div>
              {!editDeadline && (
                <button onClick={() => setEditDeadline(true)}
                  className="ml-3 flex shrink-0 items-center gap-1 text-xs text-[#8094ae] hover:text-[#0971fe]">
                  <Pencil className="h-3 w-3" />
                  {project.deadline ? "Edit" : "Set deadline"}
                </button>
              )}
            </div>

            {project.description && (
              <div className="rounded-xl bg-[#f5f6fa] px-4 py-3">
                <p className="mb-1 text-xs font-medium text-[#8094ae]">Project Description</p>
                <p className="text-sm text-[#1a2035]">{project.description}</p>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Client info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#0971fe]" />
              <CardTitle className="text-base">Client Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<User className="h-4 w-4" />}         label="Client Name" value={project.clientName} />
              <InfoRow icon={<Phone className="h-4 w-4" />}        label="Phone"       value={project.phone} />
              <InfoRow icon={<Mail className="h-4 w-4" />}         label="Email"       value={project.email} />
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Since"       value={formatDate(project.createdAt)} />
            </div>
            {project.customerId && (
              <div className="mt-2">
                <Link href={`/customers/${project.customerId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] px-3 py-2 text-xs font-medium text-[#0971fe] hover:bg-[#f0f6ff]">
                  <User className="h-3.5 w-3.5" />Open Customer Profile
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Project Overview — separate tile (from customers/estimation) */}
      {project.overview && (project.overview.web?.length || project.overview.app?.length || project.overview.admin?.length) ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-[#0971fe]" />
              <CardTitle className="text-base">Project Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {([
                { items: project.overview.web,   label: "Web",   dot: "bg-blue-400",    bg: "bg-blue-50 border-blue-100" },
                { items: project.overview.app,   label: "App",   dot: "bg-emerald-400", bg: "bg-emerald-50 border-emerald-100" },
                { items: project.overview.admin, label: "Admin", dot: "bg-purple-400",  bg: "bg-purple-50 border-purple-100" },
              ] as const).map((cat) =>
                cat.items && cat.items.length > 0 ? (
                  <div key={cat.label} className={`rounded-xl border px-4 py-3 space-y-1.5 ${cat.bg}`}>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#8094ae]">
                      <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} /> {cat.label}
                    </span>
                    {cat.items.map((pt: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-[#1a2035]">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                        {pt}
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          </CardContent>
        </Card>
      ) : project.points && project.points.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-[#0971fe]" />
              <CardTitle className="text-base">Project Points</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {project.points.map((pt: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-[#1a2035]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0971fe]" />
                  {pt}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Assigned Developers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#0971fe]" />
              <CardTitle className="text-base">Assigned Developers</CardTitle>
              {assignedDevs.length > 0 && !editDevs && (
                <span className="rounded-full bg-[#0971fe]/10 px-2 py-0.5 text-xs font-medium text-[#0971fe]">
                  {assignedDevs.length}
                </span>
              )}
            </div>
            {!editDevs && (
              <button
                onClick={() => { setSelectedDevIds(project.developers ?? []); setEditDevs(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
              >
                <Pencil className="h-3 w-3" />
                {assignedDevs.length > 0 ? "Edit Assignment" : "Assign Developers"}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editDevs ? (
            <div className="space-y-4">
              {allDevs.length === 0 ? (
                <p className="text-sm text-[#8094ae]">
                  No developers added yet.{" "}
                  <Link href="/developers/new" className="text-[#0971fe] hover:underline">Add a developer</Link>
                </p>
              ) : (
                <>
                  <p className="text-xs text-[#8094ae]">
                    Select developers to assign to this project ({selectedDevIds.length} selected)
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {allDevs.map((dev) => {
                      const checked = selectedDevIds.includes(dev.id);
                      return (
                        <button
                          key={dev.id}
                          type="button"
                          onClick={() => toggleDev(dev.id)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                            checked
                              ? "border-[#0971fe] bg-[#f0f6ff] ring-1 ring-[#0971fe]/20"
                              : "border-[#e5e9f2] bg-white hover:border-[#0971fe]/30 hover:bg-[#f9fafc]"
                          }`}
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(dev.name)}`}>
                            {initials(dev.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-medium ${checked ? "text-[#0971fe]" : "text-gray-800"}`}>
                              {dev.name}
                            </p>
                            <p className="truncate text-xs text-[#8094ae]">{dev.role}</p>
                          </div>
                          {checked && <Check className="h-4 w-4 shrink-0 text-[#0971fe]" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {/* Deadline inside assignment panel */}
              <div className="rounded-xl border border-[#e5e9f2] bg-[#f9fafc] px-4 py-3">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  <CalendarDays className="mr-1 inline h-3.5 w-3.5 text-[#8094ae]" />
                  Project Deadline <span className="font-normal text-[#8094ae]">(optional)</span>
                </label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="h-9 rounded-lg border border-[#e5e9f2] bg-white px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none"
                />
                {newDeadline && (
                  <button onClick={() => setNewDeadline("")}
                    className="ml-2 text-xs text-[#8094ae] hover:text-red-500">
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-[#e5e9f2] pt-3">
                <button onClick={handleDevsSave}
                  className="rounded-lg bg-[#0971fe] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0558d4]">
                  Save
                </button>
                <button onClick={() => { setEditDevs(false); setSelectedDevIds(project.developers ?? []); setNewDeadline(project.deadline ?? ""); }}
                  className="rounded-lg border border-[#e5e9f2] px-4 py-1.5 text-sm text-gray-500 hover:bg-[#f5f6fa]">
                  Cancel
                </button>
              </div>
            </div>
          ) : assignedDevs.length === 0 ? (
            <p className="text-sm text-[#8094ae]">No developers assigned yet. Click "Assign Developers" to add team members.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignedDevs.map((dev) => (
                <div key={dev.id} className="flex items-center gap-3 rounded-xl border border-[#e5e9f2] bg-[#f9fafc] px-3 py-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarBg(dev.name)}`}>
                    {initials(dev.name)}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/developers/${dev.id}`}
                      className="truncate block text-sm font-medium text-gray-800 hover:text-[#0971fe]">
                      {dev.name}
                    </Link>
                    <p className="truncate text-xs text-[#8094ae]">{dev.role}</p>
                    <p className="truncate text-xs text-[#8094ae]">{dev.experience}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      {(() => {
        const base     = Number(project.budget) || 0;
        const history  = project.costHistory ?? [];
        const featTotal = history.reduce((s: number, c: any) => s + Number(c.amount), 0);
        const total    = base + featTotal;
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-[#0971fe]" />
                <CardTitle className="text-base">Add Payments</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* Payment breakdown (base cost components from customers/estimation) */}
              {project.payments && project.payments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Payments</p>
                  {project.payments.map((pay: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-[#f5f6fa] px-4 py-2.5">
                      <span className="text-sm text-gray-700">{pay.description || "Payment"}</span>
                      <span className="text-sm font-semibold text-gray-800">₹{Number(pay.amount || 0).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Base */}
              <div className="flex items-center justify-between rounded-lg bg-[#eef2ff] border border-indigo-100 px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Base Project Cost</span>
                <span className="text-sm font-bold text-gray-800">₹{base.toLocaleString("en-IN")}</span>
              </div>

              {/* Feature additions */}
              {history.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Feature Additions</p>
                  {history.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-blue-50 bg-blue-50/50 px-4 py-2.5">
                      <span className="text-sm text-gray-700">{c.label}</span>
                      <span className="text-sm font-semibold text-blue-700">+₹{Number(c.amount).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl bg-[#0971fe] px-4 py-3">
                <span className="text-sm font-semibold text-white">Total Project Cost</span>
                <span className="text-base font-bold text-white">₹{total.toLocaleString("en-IN")}</span>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Timeline & Payment Schedule (from customers/estimation) */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Project Timeline — editable */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#0971fe]" />
                <CardTitle className="text-base">Project Timeline</CardTitle>
              </div>
              {!editTimeline && (
                <button
                  onClick={startEditTimeline}
                  className="flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
                >
                  <Pencil className="h-3 w-3" />
                  {project.timelines && project.timelines.length > 0 ? "Edit" : "Add Timeline"}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {editTimeline ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  {timelineDraft.length === 0 && (
                    <p className="text-sm text-[#8094ae]">No timeline rows. Click "Add row" to create one.</p>
                  )}
                  {timelineDraft.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Description"
                        value={row.description}
                        onChange={(e) => updateTimelineRow(index, "description", e.target.value)}
                        className="h-9 flex-1 rounded-lg border border-[#e5e9f2] bg-white px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Working days"
                        value={row.workingDays}
                        onChange={(e) => updateTimelineRow(index, "workingDays", e.target.value)}
                        className="h-9 w-32 rounded-lg border border-[#e5e9f2] bg-white px-3 text-sm text-gray-700 focus:border-[#0971fe] focus:outline-none"
                      />
                      <button
                        onClick={() => removeTimelineRow(index)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addTimelineRow}
                  className="flex items-center gap-1 rounded-lg border border-dashed border-[#e5e9f2] px-3 py-1.5 text-xs font-medium text-[#0971fe] hover:bg-[#f0f6ff]"
                >
                  <Plus className="h-3.5 w-3.5" />Add row
                </button>
                <div className="flex items-center gap-2 border-t border-[#e5e9f2] pt-3">
                  <button onClick={handleTimelineSave}
                    className="rounded-lg bg-[#0971fe] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0558d4]">
                    Save
                  </button>
                  <button onClick={() => setEditTimeline(false)}
                    className="rounded-lg border border-[#e5e9f2] px-4 py-1.5 text-sm text-gray-500 hover:bg-[#f5f6fa]">
                    Cancel
                  </button>
                </div>
              </div>
            ) : project.timelines && project.timelines.length > 0 ? (
              project.timelines.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 px-4 py-2.5">
                  <span className="text-sm text-orange-700">{t.description || "—"}</span>
                  <span className="text-sm font-semibold text-orange-700">{t.workingDays || 0} days</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#8094ae]">No timeline added yet. Click "Add Timeline" to set milestones.</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Scheduled */}
        {project.schedules && project.schedules.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-[#0971fe]" />
                <CardTitle className="text-base">Payment Scheduled</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.schedules.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2.5">
                  <span className="text-sm text-indigo-700">{s.description || "—"}</span>
                  <span className="text-sm font-semibold text-indigo-700">₹{Number(s.payment || 0).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Project Features */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0971fe]" />
            <CardTitle className="text-base">Project Features</CardTitle>
            {featureItems.length > 0 && (
              <span className="rounded-full bg-[#0971fe]/10 px-2 py-0.5 text-xs font-medium text-[#0971fe]">
                {featureItems.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Add feature row */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Feature name…"
              value={newFeatureName}
              onChange={(e) => setNewFeatureName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddFeature(); }}
              className="h-9 flex-1 rounded-lg border border-[#e5e9f2] bg-[#f9fafc] px-3 text-sm text-gray-700 placeholder:text-[#b0bac9] focus:border-[#0971fe] focus:bg-white focus:outline-none"
            />
            <div className="relative w-36">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
              <input
                type="number"
                placeholder="Price (opt.)"
                value={newFeaturePrice}
                onChange={(e) => setNewFeaturePrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddFeature(); }}
                className="h-9 w-full rounded-lg border border-[#e5e9f2] bg-[#f9fafc] pl-6 pr-3 text-sm text-gray-700 placeholder:text-[#b0bac9] focus:border-[#0971fe] focus:bg-white focus:outline-none"
              />
            </div>
            <button
              onClick={handleAddFeature}
              disabled={!newFeatureName.trim()}
              className="flex h-9 items-center gap-1 rounded-lg bg-[#0971fe] px-3 text-xs font-medium text-white hover:bg-[#0558d4] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />Add
            </button>
          </div>

          {/* Feature list */}
          {featureItems.length === 0 ? (
            <div className="py-6 text-center">
              <CheckSquare className="mx-auto mb-2 h-8 w-8 text-[#8094ae]" />
              <p className="text-sm text-[#8094ae]">No features added yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {featureItems.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-[#e5e9f2] bg-[#f9fafc] px-4 py-2.5 group">
                  <div className="flex items-center gap-2.5">
                    <Check className="h-3.5 w-3.5 text-[#0971fe] shrink-0" />
                    <span className="text-sm text-gray-800">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {f.price && Number(f.price) > 0 ? (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                        +₹{Number(f.price).toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No price</span>
                    )}
                    <button
                      onClick={() => handleDeleteFeature(f.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* In-app PDF viewer */}
      {viewer && (
        <PdfViewerModal url={viewer.url} title={viewer.title} onClose={() => setViewer(null)} />
      )}

    </div>
  );
}
