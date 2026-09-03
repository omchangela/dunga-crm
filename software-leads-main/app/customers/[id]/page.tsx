"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, User, Pencil, Plus, Trash2,
  CalendarDays, X, Briefcase, MapPin,
  Layers, Wallet, Clock, CheckCircle2, AlertCircle, Check,
  ChevronDown, FileText, Code2, Package, ExternalLink, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchCustomer, projectsApi, buildCreateProjectBody, docsApi, subscriptionsApi,
} from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

const PROJECT_STATUS_VIEW: Record<string, { label: string; accent: string; badge: string }> = {
  Pending:   { label: "Pending",   accent: "bg-amber-400",   badge: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300" },
  Rejected:  { label: "Rejected",  accent: "bg-rose-500",    badge: "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"        },
  Converted: { label: "Active",    accent: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" },
  Active:    { label: "Active",    accent: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300" },
  Completed: { label: "Completed", accent: "bg-blue-500",    badge: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"        },
  "On Hold": { label: "On Hold",   accent: "bg-amber-400",   badge: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300" },
  Cancelled: { label: "Cancelled", accent: "bg-rose-500",    badge: "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"        },
};

interface PaymentItem  { description: string; amount: string; }
interface TimelineItem { description: string; workingDays: string; }
interface ScheduleItem { description: string; payment: string; }

interface ProjFormState {
  projectName:        string;
  projectDescription: string;
  projectType:        string;
  status:             string;
  overviewWeb:        string[];
  overviewApp:        string[];
  overviewAdmin:      string[];
  payments:           PaymentItem[];
  timelines:          TimelineItem[];
  schedules:          ScheduleItem[];
}

const emptyProjForm: ProjFormState = {
  projectName:        "",
  projectDescription: "",
  projectType:        "",
  status:             "Pending",
  overviewWeb:        [],
  overviewApp:        [],
  overviewAdmin:      [],
  payments:           [],
  timelines:          [],
  schedules:          [],
};

type OverviewKey = "overviewWeb" | "overviewApp" | "overviewAdmin";

function cycleSuffix(cycle: string): string {
  if (cycle === "Monthly")   return "/mo";
  if (cycle === "Quarterly") return "/qtr";
  if (cycle === "Yearly")    return "/year";
  return "";
}

function isExpiringSoon(sub: any): boolean {
  if (sub.status !== "Active" || !sub.renewalDate) return false;
  const days = (new Date(sub.renewalDate).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 30;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Expandable({ children, lines = 2 }: { children: React.ReactNode; lines?: number }) {
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight - el.clientHeight > 2);
  }, [children]);

  return (
    <div>
      <div
        ref={ref}
        className={open ? "" : "overflow-hidden"}
        style={open ? undefined : { maxHeight: `${lines * 1.45}em` }}
      >
        {children}
      </div>
      {(overflowing || open) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="mt-0.5 text-[10px] font-bold text-blue-600 hover:underline"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ProjSection({
  title, icon, count, open, onToggle, children,
}: {
  title: string; icon: React.ReactNode; count?: number;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition"
      >
        <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          {icon}
          {title}
          {count != null && (
            <span className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:text-slate-300">{count}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-2 bg-white dark:bg-slate-900 px-4 py-3">{children}</div>}
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [customer, setCustomer] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProj, setShowAddProj] = useState(false);
  const [projForm, setProjForm] = useState<ProjFormState>(emptyProjForm);
  const [projError, setProjError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [convertModal, setConvertModal] = useState<{ project: any } | null>(null);
  const [finalPayments, setFinalPayments] = useState<PaymentItem[]>([]);
  const [converting, setConverting] = useState(false);

  const [documents, setDocuments]     = useState<any[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [openProjSection, setOpenProjSection] = useState<Record<string, boolean>>({});

  const [payingSubId, setPayingSubId] = useState<string | null>(null);

  const toggleProject = (key: string) =>
    setExpandedProjects((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleProjSection = (key: string) =>
    setOpenProjSection((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  async function load() {
    setLoading(true);
    try {
      const found = await fetchCustomer(id);
      setCustomer(found);
      setProjects(found?.projects ?? []);

      const docsRes = await docsApi.list(id).catch(() => null);
      setDocuments(docsRes?.data ?? []);
    } catch {
      setCustomer(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (id) load(); }, [id]);

  const totalPayment = projForm.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalWorkingDays = projForm.timelines.reduce((sum, t) => sum + (Number(t.workingDays) || 0), 0);

  const updateForm = (patch: Partial<ProjFormState>) => {
    setProjForm((prev) => ({ ...prev, ...patch }));
    if (projError) setProjError("");
  };

  const addOverviewItem = (key: OverviewKey) =>
    setProjForm((prev) => ({ ...prev, [key]: [...prev[key], ""] }));

  const updateOverviewItem = (key: OverviewKey, index: number, value: string) =>
    setProjForm((prev) => {
      const arr = [...prev[key]];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });

  const removeOverviewItem = (key: OverviewKey, index: number) =>
    setProjForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));

  const addPayment = () =>
    setProjForm((prev) => ({ ...prev, payments: [...prev.payments, { description: "", amount: "" }] }));
  const updatePayment = (index: number, field: keyof PaymentItem, value: string) =>
    setProjForm((prev) => {
      const arr = [...prev.payments];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, payments: arr };
    });
  const removePayment = (index: number) =>
    setProjForm((prev) => ({ ...prev, payments: prev.payments.filter((_, i) => i !== index) }));

  const addTimeline = () =>
    setProjForm((prev) => ({ ...prev, timelines: [...prev.timelines, { description: "", workingDays: "" }] }));
  const updateTimeline = (index: number, field: keyof TimelineItem, value: string) =>
    setProjForm((prev) => {
      const arr = [...prev.timelines];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, timelines: arr };
    });
  const removeTimeline = (index: number) =>
    setProjForm((prev) => ({ ...prev, timelines: prev.timelines.filter((_, i) => i !== index) }));

  const addSchedule = () =>
    setProjForm((prev) => ({ ...prev, schedules: [...prev.schedules, { description: "", payment: "" }] }));
  const updateSchedule = (index: number, field: keyof ScheduleItem, value: string) =>
    setProjForm((prev) => {
      const arr = [...prev.schedules];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, schedules: arr };
    });
  const removeSchedule = (index: number) =>
    setProjForm((prev) => ({ ...prev, schedules: prev.schedules.filter((_, i) => i !== index) }));

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function viewDoc(docId: string) {
    try {
      const res = await docsApi.getSignedUrl(docId);
      const url = res?.data?.signedUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else showToast("Document not available.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to open document.");
    }
  }

  async function viewProjectPdf(kind: "estimation" | "project", projectId: string) {
    try {
      const res = kind === "estimation"
        ? await projectsApi.getPdf(projectId)
        : await projectsApi.getProjectPdf(projectId);
      const url = res?.data?.downloadUrl ?? res?.data?.signedUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else showToast("PDF not available.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to open PDF.");
    }
  }

  async function handleUpdateProjectStatus(projectId: string, newStatus: string) {
    try {
      await projectsApi.update(projectId, { status: toEnum.status(newStatus) });
      await load();
      showToast(
        newStatus === "Rejected"
          ? "Project marked as Rejected — visible in Estimation."
          : "Project status updated."
      );
    } catch (err: any) {
      showToast(err?.message ?? "Failed to update status.");
    }
  }

  const finalTotal = finalPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const updateFinalPayment = (index: number, field: keyof PaymentItem, value: string) =>
    setFinalPayments((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [field]: value };
      return arr;
    });
  const addFinalPayment = () =>
    setFinalPayments((prev) => [...prev, { description: "", amount: "" }]);
  const removeFinalPayment = (index: number) =>
    setFinalPayments((prev) => prev.filter((_, i) => i !== index));

  function openConvertModal(proj: any) {
    const existing: PaymentItem[] =
      Array.isArray(proj.payments) && proj.payments.length > 0
        ? proj.payments.map((p: any) => ({ description: p.description ?? "", amount: String(p.amount ?? "") }))
        : [{ description: "", amount: String(proj.budget ?? "") }];
    setFinalPayments(existing);
    setConvertModal({ project: proj });
  }

  async function handleConfirmConvert() {
    if (!convertModal || converting) return;
    const cleaned = finalPayments.filter((p) => p.description.trim() || String(p.amount).trim());
    setConverting(true);
    try {
      await projectsApi.update(convertModal.project.id, { status: "CONVERTED", payments: cleaned });
      setConvertModal(null);
      await load();
      showToast("Project converted and moved to Projects module.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to convert project.");
    } finally {
      setConverting(false);
    }
  }

  async function handleAddProject() {
    if (!projForm.projectName.trim()) {
      setProjError("Project Name field is required.");
      return;
    }
    setProjError("");

    try {
      await projectsApi.create(customer.id, buildCreateProjectBody({
        projectName:        projForm.projectName,
        projectDescription: projForm.projectDescription,
        projectType:        projForm.projectType,
        status:             projForm.status,
        overviewWeb:        projForm.overviewWeb,
        overviewApp:        projForm.overviewApp,
        overviewAdmin:      projForm.overviewAdmin,
        payments:           projForm.payments,
        timelines:          projForm.timelines,
        schedules:          projForm.schedules,
      }));
      setProjForm(emptyProjForm);
      setShowAddProj(false);
      await load();
      showToast("Project added.");
    } catch (err: any) {
      setProjError(err?.message ?? "Failed to add project.");
    }
  }

  if (loading) return <div className="max-w-5xl mx-auto p-4"><DetailSkeleton /></div>;
  if (!customer) return <div className="flex items-center justify-center py-20 text-xs font-bold text-slate-400">Customer profile data missing.</div>;

  return (
    <div className="space-y-8 pb-10">

      {/* Convert Modal */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Final Estimation</p>
                <p className="text-xs text-slate-400 mt-0.5">{convertModal.project.projectName || convertModal.project.headline}</p>
              </div>
              <button onClick={() => setConvertModal(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Review and update each payment before confirming conversion.</p>
                <button
                  type="button"
                  onClick={addFinalPayment}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition shadow-sm"
                  title="Add payment row"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {finalPayments.map((row, index) => (
                  <div key={`final-pay-${index}`} className="flex items-center gap-2">
                    <Input
                      placeholder="Description (e.g. Frontend)"
                      value={row.description}
                      onChange={(e) => updateFinalPayment(index, "description", e.target.value)}
                      className="h-10 text-xs font-semibold rounded-xl"
                    />
                    <Input
                      type="number"
                      placeholder="Amount (₹)"
                      value={row.amount}
                      onChange={(e) => updateFinalPayment(index, "amount", e.target.value)}
                      className="h-10 text-xs font-semibold rounded-xl"
                    />
                    {finalPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFinalPayment(index)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-purple-50 border border-purple-200 px-4 py-3 flex items-center justify-between dark:bg-purple-950/40 dark:border-purple-800">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Total Project Cost</span>
                <span className="text-sm font-black text-purple-800 dark:text-purple-200">
                  ₹{finalTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 px-6 py-4">
              <button
                onClick={handleConfirmConvert}
                disabled={converting}
                className="flex-1 rounded-xl bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-purple-700 transition disabled:opacity-60 shadow-md"
              >
                {converting ? "Converting..." : "Confirm & Convert"}
              </button>
              <button
                onClick={() => setConvertModal(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO BANNER ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md border border-white/15 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Customers
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  {customer.fullName}
                </h1>
                <span className="inline-flex text-xs font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-full backdrop-blur-md">
                  {customer.applicationNumber || "Customer Account"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">
                {customer.phone} • {customer.email} • {customer.projectType || "Software Client"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => setShowAddProj(true)} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition hover:brightness-110">
                <Plus className="h-4 w-4 mr-1.5" /> Add Project Record
              </Button>
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

      {/* Customer Information Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" /> Customer Account Details
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <User className="h-4 w-4 text-blue-500" />,         label: "Client Name",       value: customer.fullName },
            { icon: <Phone className="h-4 w-4 text-emerald-500" />,        label: "Phone",             value: customer.phone },
            { icon: <Mail className="h-4 w-4 text-indigo-500" />,         label: "Email",             value: customer.email },
            { icon: <Briefcase className="h-4 w-4 text-purple-500" />,    label: "Service Category",  value: customer.projectType },
            { icon: <Layers className="h-4 w-4 text-amber-500" />,       label: "Application No.",   value: customer.applicationNumber },
            { icon: <CalendarDays className="h-4 w-4 text-slate-400" />, label: "Customer Since",    value: customer.createdAt ? formatDate(customer.createdAt) : "" },
            { icon: <MapPin className="h-4 w-4 text-rose-500" />,       label: "State",             value: customer.state },
            { icon: <MapPin className="h-4 w-4 text-rose-500" />,       label: "City",              value: customer.city },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                {f.icon}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{f.label}</p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">{f.value || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Section */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" /> Client Projects Directory
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{projects.length} Projects associated with this account</p>
          </div>
          {!showAddProj && (
            <Button size="sm" onClick={() => setShowAddProj(true)} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
              <Plus className="h-4 w-4 mr-1" /> Add Project Record
            </Button>
          )}
        </div>

        {/* Add Project Form */}
        {showAddProj && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20 space-y-4">
            <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-3">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">Add New Project Record</p>
              <button
                type="button"
                onClick={() => { setShowAddProj(false); setProjForm(emptyProjForm); setProjError(""); }}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-200/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Project Name *</label>
                <input
                  placeholder="e.g. ERP Platform, E-Commerce App"
                  value={projForm.projectName}
                  onChange={(e) => updateForm({ projectName: e.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Project Scope Description</label>
                <textarea
                  placeholder="Describe scope details..."
                  value={projForm.projectDescription}
                  onChange={(e) => updateForm({ projectDescription: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {projError && <p className="text-xs font-bold text-rose-600">{projError}</p>}

            <div className="flex gap-2 pt-2">
              <Button type="button" size="sm" onClick={handleAddProject} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                Save Project Record
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddProj(false); setProjForm(emptyProjForm); setProjError(""); }} className="rounded-xl border border-slate-200 bg-white text-xs font-bold">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Project Cards List */}
        <div className="space-y-4">
          {projects.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">
              No project records created for this customer yet.
            </div>
          ) : (
            projects.map((p, index) => {
              const status = p.status || "Pending";
              const view = PROJECT_STATUS_VIEW[status] ?? PROJECT_STATUS_VIEW["Pending"];
              const pid = p.id || `proj-${index}`;
              const expanded = !!expandedProjects[pid];

              return (
                <div
                  key={pid}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleProject(pid)}
                    className="flex w-full cursor-pointer items-start justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition hover:bg-slate-100/70 dark:hover:bg-slate-800/80"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{p.projectName || p.headline}</h4>
                        <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider border px-2.5 py-0.5 rounded-full ${view.badge}`}>
                          {view.label}
                        </span>
                      </div>
                      {p.projectType && <p className="text-xs font-semibold text-slate-400">{p.projectType}</p>}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Budget</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          ₹{Number(p.budget || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>

                  {expanded && (
                    <div className="p-5 space-y-4 border-t border-slate-100 dark:border-slate-800">
                      {p.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{p.description}</p>
                      )}

                      {/* Documents link */}
                      {p.estimationPdfUrl && (
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Estimation Proposal PDF</span>
                          <button
                            onClick={() => viewProjectPdf("estimation", p.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />View PDF
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}