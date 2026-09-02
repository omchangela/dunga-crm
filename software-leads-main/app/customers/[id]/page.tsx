"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, User, Pencil, Plus, Trash2,
  CalendarDays, X, Briefcase, MapPin,
  Layers, Wallet, Clock, CheckCircle2, AlertCircle, Check,
  ChevronDown, FileText, Code2, Package, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import {
  fetchCustomer, projectsApi, buildCreateProjectBody, docsApi, subscriptionsApi,
} from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  Active:    "bg-green-400",
  Inactive:  "bg-gray-400",
  Converted: "bg-purple-400",
  Pending:   "bg-yellow-400",
  Rejected:  "bg-red-400",
};

const STATUS_TEXT: Record<string, string> = {
  Active:    "text-green-700",
  Inactive:  "text-gray-600",
  Converted: "text-purple-700",
  Pending:   "text-yellow-700",
  Rejected:  "text-red-700",
};

const STATUS_BG: Record<string, string> = {
  Active:    "bg-green-50 border-green-200",
  Inactive:  "bg-gray-50 border-gray-200",
  Converted: "bg-purple-50 border-purple-200",
  Pending:   "bg-yellow-50 border-yellow-200",
  Rejected:  "bg-red-50 border-red-200",
};

// How a project status renders in the customer's project section.
// A converted project is now an Active project, so it shows as "Active".
const PROJECT_STATUS_VIEW: Record<string, { label: string; accent: string; badge: string }> = {
  Pending:   { label: "Pending",   accent: "bg-yellow-400",  badge: "bg-yellow-50 border-yellow-200 text-yellow-700" },
  Rejected:  { label: "Rejected",  accent: "bg-red-400",     badge: "bg-red-50 border-red-200 text-red-600"        },
  Converted: { label: "Active",    accent: "bg-green-500",   badge: "bg-green-50 border-green-200 text-green-700"  },
  Active:    { label: "Active",    accent: "bg-green-500",   badge: "bg-green-50 border-green-200 text-green-700"  },
  Completed: { label: "Completed", accent: "bg-blue-500",    badge: "bg-blue-50 border-blue-200 text-blue-700"     },
  "On Hold": { label: "On Hold",   accent: "bg-yellow-400",  badge: "bg-yellow-50 border-yellow-200 text-yellow-700" },
  Cancelled: { label: "Cancelled", accent: "bg-red-400",     badge: "bg-red-50 border-red-200 text-red-600"        },
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

// True when an active subscription renews within the next 30 days.
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

// Clamps its content to a couple of lines, with a Show more / less toggle
// that only appears when the content actually overflows.
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
          className="mt-0.5 text-[10px] font-semibold text-blue-600 hover:underline"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// Highlighted, collapsible sub-section shown inside a project container.
function ProjSection({
  title, icon, count, open, onToggle, children,
}: {
  title: string; icon: React.ReactNode; count?: number;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e9f2]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 bg-[#f1f4f9] px-3 py-2 text-left hover:bg-[#e8edf5]"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          {icon}
          {title}
          {count != null && (
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500">{count}</span>
          )}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-2 bg-white px-3 py-2.5">{children}</div>}
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

  // Documents are still customer-level; everything else is nested per project.
  const [documents, setDocuments]     = useState<any[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [openProjSection, setOpenProjSection] = useState<Record<string, boolean>>({});

  const [payingSubId, setPayingSubId] = useState<string | null>(null);

  const toggleProject = (key: string) =>
    setExpandedProjects((prev) => ({ ...prev, [key]: !prev[key] }));
  // Inner project sections default to open; toggling stores the flipped value.
  const toggleProjSection = (key: string) =>
    setOpenProjSection((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  async function load() {
    setLoading(true);
    try {
      const found = await fetchCustomer(id);
      setCustomer(found);
      setProjects(found?.projects ?? []);

      // Documents are fetched separately (best-effort, never blocks the page).
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

  // Clear the inline error as soon as the user starts fixing the form.
  const updateForm = (patch: Partial<ProjFormState>) => {
    setProjForm((prev) => ({ ...prev, ...patch }));
    if (projError) setProjError("");
  };

  // ----- Project Overview (Web / App / Admin description rows) -----
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

  // ----- Payment rows -----
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

  // ----- Project Timeline rows -----
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

  // ----- Payment Scheduled rows -----
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

  // Open a document via a fresh signed URL (view only).
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

  // Mark a subscription's current renewal as paid, then refresh the customer.
  async function handleMarkSubPaid(sub: any) {
    if (payingSubId) return;
    setPayingSubId(sub.id);
    try {
      const res = await subscriptionsApi.markPaid(sub.id, {});
      const nextRenewal = res?.data?.subscription?.renewalDate;
      showToast(nextRenewal ? `Payment recorded. Renewal advanced to ${formatDate(nextRenewal)}.` : "Payment recorded.");
      await load();
    } catch (err: any) {
      showToast(err?.message ?? "Failed to mark as paid.");
    } finally {
      setPayingSubId(null);
    }
  }

  // Open a project's estimation or project (contract) PDF via a fresh signed URL.
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
  if (!customer) return <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">Customer profile data missing.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">

      {/* Convert Modal */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="font-semibold text-[#1a2035]">Final Estimation</p>
                <p className="text-xs text-gray-400 mt-0.5">{convertModal.project.projectName || convertModal.project.headline}</p>
              </div>
              <button onClick={() => setConvertModal(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Review and update each payment before confirming conversion.</p>
                <button
                  type="button"
                  onClick={addFinalPayment}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm"
                  title="Add payment row"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {finalPayments.map((row, index) => (
                  <div key={`final-pay-${index}`} className="flex items-center gap-2">
                    <Input
                      placeholder="Description (e.g. Frontend)"
                      value={row.description}
                      onChange={(e) => updateFinalPayment(index, "description", e.target.value)}
                      className="h-9 text-sm flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Amount (₹)"
                      value={row.amount}
                      onChange={(e) => updateFinalPayment(index, "amount", e.target.value)}
                      className="h-9 text-sm flex-1"
                    />
                    {finalPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFinalPayment(index)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Total summary */}
              <div className="rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-600">Total Project Cost</span>
                <span className="text-base font-bold text-purple-700">
                  ₹{finalTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
              <button
                onClick={handleConfirmConvert}
                disabled={converting}
                className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                {converting ? "Converting…" : "Confirm & Convert"}
              </button>
              <button
                onClick={() => setConvertModal(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          {toast}
        </div>
      )}

      {/* Header View */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/customers"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title={customer.fullName} subtitle="Customer Dashboard File Management Instance" />
      </div>


      {/* Customer Information */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" /> Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: <User className="h-4 w-4" />,         label: "Client Name",       value: customer.fullName },
            { icon: <Phone className="h-4 w-4" />,        label: "Phone",             value: customer.phone },
            { icon: <Mail className="h-4 w-4" />,         label: "Email",             value: customer.email },
            { icon: <Briefcase className="h-4 w-4" />,    label: "Service Type",      value: customer.projectType },
            { icon: <Layers className="h-4 w-4" />,       label: "Application No.",   value: customer.applicationNumber },
            { icon: <CalendarDays className="h-4 w-4" />, label: "Customer Since",    value: customer.createdAt ? formatDate(customer.createdAt) : "" },
            { icon: <MapPin className="h-4 w-4" />,       label: "State",             value: customer.state },
            { icon: <MapPin className="h-4 w-4" />,       label: "City",              value: customer.city },
          ].map((f) => (
            <div key={f.label}>
              <p className="mb-0.5 text-xs text-[#8094ae]">{f.label}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[#8094ae]">{f.icon}</span>
                <p className="text-sm font-medium text-[#1a2035]">{f.value || "—"}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Project Tracking Section
                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full font-bold">
                  {projects.length} Active
                </span>
              </CardTitle>
              {!showAddProj && (
                <Button size="sm" onClick={() => setShowAddProj(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-1" /> Add Project Section
                </Button>
              )}
            </CardHeader>

            {showAddProj && (
              <CardContent className="pt-0 space-y-5 bg-slate-50/50">
                {/* Form header banner */}
                <div className="-mx-6 mb-1 flex items-center gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1a2035]">New Project Record</p>
                    <p className="text-[11px] text-gray-500">Capture scope, estimation and timeline for {customer.fullName}.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowAddProj(false); setProjForm(emptyProjForm); setProjError(""); }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/70 hover:text-gray-600"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Project Name field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">
                    Project Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g., Fact-Ops Platform, Weewa System"
                    value={projForm.projectName}
                    onChange={(e) => updateForm({ projectName: e.target.value })}
                    className="bg-white"
                  />
                </div>

                {/* Project Description field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Project Description</Label>
                  <textarea
                    placeholder="Describe the project scope and goals..."
                    value={projForm.projectDescription}
                    onChange={(e) => updateForm({ projectDescription: e.target.value })}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                {/* Type of Project field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Type of Project</Label>
                  <select
                    value={projForm.projectType}
                    onChange={(e) => updateForm({ projectType: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select Domain Category...</option>
                    <option value="Web Development">Web Development</option>
                    <option value="App Development">App Development</option>
                    <option value="App + Web Development">App + Web Development</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Design Services">Design Services</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                {/* Status Toggle Management fields */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700">Pipeline Status</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Pending", "Converted", "Rejected"].map((statusOption) => (
                      <button
                        key={statusOption}
                        type="button"
                        onClick={() => updateForm({ status: statusOption })}
                        className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                          projForm.status === statusOption
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {statusOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Overview — Web / App / Admin description rows */}
                <div className="space-y-3 border-t pt-4">
                  <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide">Project Overview</Label>

                  {([
                    { key: "overviewWeb"   as OverviewKey, label: "Web",   dot: "bg-blue-400" },
                    { key: "overviewApp"   as OverviewKey, label: "App",   dot: "bg-emerald-400" },
                    { key: "overviewAdmin" as OverviewKey, label: "Admin", dot: "bg-purple-400" },
                  ]).map((cat) => (
                    <div key={cat.key} className="rounded-xl border border-[#e5e9f2] bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${cat.dot}`} /> {cat.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => addOverviewItem(cat.key)}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                          title={`Add ${cat.label} description`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {projForm[cat.key].length > 0 && (
                        <div className="space-y-2">
                          {projForm[cat.key].map((desc, index) => (
                            <div key={`${cat.key}-${index}`} className="flex items-center gap-2">
                              <Input
                                placeholder={`${cat.label} description ${index + 1}`}
                                value={desc}
                                onChange={(e) => updateOverviewItem(cat.key, index, e.target.value)}
                                className="bg-white text-xs flex-1 focus-visible:ring-blue-500"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOverviewItem(cat.key, index)}
                                className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Payment — description + amount rows */}
                <div className="space-y-2.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-emerald-500" /> Payment
                    </Label>
                    <button
                      type="button"
                      onClick={addPayment}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                      title="Add payment row"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {projForm.payments.length > 0 && (
                    <div className="space-y-2">
                      {projForm.payments.map((row, index) => (
                        <div key={`payment-${index}`} className="flex items-center gap-2">
                          <Input
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) => updatePayment(index, "description", e.target.value)}
                            className="bg-white text-xs flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Amount (₹)"
                            value={row.amount}
                            onChange={(e) => updatePayment(index, "amount", e.target.value)}
                            className="bg-white text-xs flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePayment(index)}
                            className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Project Cost = sum of all payment amounts */}
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5">
                    <span className="text-xs font-semibold text-emerald-600">Project Cost</span>
                    <span className="text-base font-bold text-emerald-700">
                      ₹{totalPayment.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Project Timeline — description + working days rows */}
                <div className="space-y-2.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-orange-500" /> Project Timeline
                    </Label>
                    <button
                      type="button"
                      onClick={addTimeline}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                      title="Add timeline row"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {projForm.timelines.length > 0 && (
                    <div className="space-y-2">
                      {projForm.timelines.map((row, index) => (
                        <div key={`timeline-${index}`} className="flex items-center gap-2">
                          <Input
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) => updateTimeline(index, "description", e.target.value)}
                            className="bg-white text-xs flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Working days"
                            value={row.workingDays}
                            onChange={(e) => updateTimeline(index, "workingDays", e.target.value)}
                            className="bg-white text-xs flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTimeline(index)}
                            className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total working days = sum of all timeline rows */}
                  <div className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 px-4 py-2.5">
                    <span className="text-xs font-semibold text-orange-600">Total Working Days</span>
                    <span className="text-base font-bold text-orange-700">
                      {totalWorkingDays} {totalWorkingDays === 1 ? "day" : "days"}
                    </span>
                  </div>
                </div>

                {/* Payment Scheduled — description + payment rows */}
                <div className="space-y-2.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-indigo-500" /> Payment Scheduled
                    </Label>
                    <button
                      type="button"
                      onClick={addSchedule}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                      title="Add payment schedule row"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {projForm.schedules.length > 0 && (
                    <div className="space-y-2">
                      {projForm.schedules.map((row, index) => (
                        <div key={`schedule-${index}`} className="flex items-center gap-2">
                          <Input
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) => updateSchedule(index, "description", e.target.value)}
                            className="bg-white text-xs flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Payment (₹)"
                            value={row.payment}
                            onChange={(e) => updateSchedule(index, "payment", e.target.value)}
                            className="bg-white text-xs flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSchedule(index)}
                            className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {projError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{projError}</span>
                  </div>
                )}

                {/* Live summary */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mr-1">Summary</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Wallet className="h-3 w-3" /> ₹{totalPayment.toLocaleString("en-IN")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    <Layers className="h-3 w-3" />
                    {projForm.overviewWeb.filter((p) => p.trim()).length +
                      projForm.overviewApp.filter((p) => p.trim()).length +
                      projForm.overviewAdmin.filter((p) => p.trim()).length} overview
                  </span>
                  {projForm.timelines.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                      <Clock className="h-3 w-3" /> {projForm.timelines.length} timeline{projForm.timelines.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-dashed">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddProj(false); setProjForm(emptyProjForm); setProjError(""); }}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleAddProject} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Save Structural Record
                  </Button>
                </div>
              </CardContent>
            )}

            {/* Project Cards */}
            <CardContent className="p-4 space-y-3">
              {projects.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-400 font-medium">
                  No projects added yet.
                </div>
              ) : (
                projects.map((p, index) => {
                  const status = p.status || "Pending";
                  const view = PROJECT_STATUS_VIEW[status] ?? PROJECT_STATUS_VIEW["Pending"];
                  const accentBar = view.accent;
                  const statusBadge = view.badge;
                  const isEstimationStage = status === "Pending" || status === "Rejected";
                  const pid = p.id || `proj-${index}`;
                  const expanded = !!expandedProjects[pid];
                  // Per-section collapse state (default open) for this project.
                  const sec = (name: string) => ({
                    open: openProjSection[`${pid}:${name}`] ?? true,
                    onToggle: () => toggleProjSection(`${pid}:${name}`),
                  });

                  return (
                    <div
                      key={pid}
                      className="flex overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm"
                    >
                      {/* Left accent bar */}
                      <div className={`w-1.5 shrink-0 ${accentBar}`} />

                      {/* One self-contained project container */}
                      <div className="min-w-0 flex-1">

                        {/* Header — click to expand/collapse all details */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleProject(pid)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleProject(pid); } }}
                          className={`flex w-full cursor-pointer select-none items-start justify-between gap-3 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-100/70 ${expanded ? "border-b border-gray-100" : ""}`}
                        >
                          <div className="min-w-0 space-y-1.5">
                            <h4 className="text-sm font-bold text-[#1a2035]">{p.projectName || p.headline}</h4>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${statusBadge}`}>
                                {view.label}
                              </span>
                              {p.projectType && (
                                <span className="inline-flex text-[10px] font-medium bg-blue-50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                  {p.projectType}
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <Expandable lines={2}>
                                <p className="text-xs text-gray-400">{p.description}</p>
                              </Expandable>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 block">Project Cost</span>
                              <span className="text-sm font-bold text-[#1a2035]">
                                ₹{Number(p.budget || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        {/* Body — all project details (shown when expanded) */}
                        {expanded && (
                        <div className="p-4 space-y-3">

                        {/* Project Overview — Web / App / Admin */}
                        {p.overview && (p.overview.web?.length || p.overview.app?.length || p.overview.admin?.length) ? (
                          <ProjSection title="Project Overview" icon={<Layers className="h-3 w-3 text-blue-500" />} {...sec("overview")}>
                            <Expandable lines={2}>
                              <div className="space-y-2">
                                {([
                                  { items: p.overview.web,   label: "Web",   dot: "bg-blue-400" },
                                  { items: p.overview.app,   label: "App",   dot: "bg-emerald-400" },
                                  { items: p.overview.admin, label: "Admin", dot: "bg-purple-400" },
                                ] as const).map((cat) =>
                                  cat.items && cat.items.length > 0 ? (
                                    <div key={cat.label} className="space-y-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                                        <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} /> {cat.label}
                                      </span>
                                      {cat.items.map((pt: string, ptIdx: number) => (
                                        <div key={ptIdx} className="flex items-center gap-2 text-xs text-gray-600 pl-3">
                                          <span className="h-1 w-1 rounded-full bg-gray-300 shrink-0" />
                                          {pt}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null
                                )}
                              </div>
                            </Expandable>
                          </ProjSection>
                        ) : null}

                        {/* Payments */}
                        {p.payments && p.payments.length > 0 && (
                          <ProjSection title="Payment" icon={<Wallet className="h-3 w-3 text-emerald-500" />} count={p.payments.length} {...sec("payments")}>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {p.payments.map((row: PaymentItem, i: number) => (
                                <div key={i} className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-emerald-700 truncate">{row.description || "—"}</span>
                                  <span className="text-xs font-bold text-emerald-700 shrink-0">₹{Number(row.amount || 0).toLocaleString("en-IN")}</span>
                                </div>
                              ))}
                            </div>
                          </ProjSection>
                        )}

                        {/* Project Timeline */}
                        {p.timelines && p.timelines.length > 0 && (
                          <ProjSection title="Project Timeline" icon={<Clock className="h-3 w-3 text-orange-500" />} count={p.timelines.length} {...sec("timeline")}>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {p.timelines.map((row: TimelineItem, i: number) => (
                                <div key={i} className="rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-orange-700 truncate">{row.description || "—"}</span>
                                  <span className="text-xs font-bold text-orange-700 shrink-0">{row.workingDays || 0} days</span>
                                </div>
                              ))}
                            </div>
                          </ProjSection>
                        )}

                        {/* Payment Scheduled */}
                        {p.schedules && p.schedules.length > 0 && (
                          <ProjSection title="Payment Scheduled" icon={<CalendarDays className="h-3 w-3 text-indigo-500" />} count={p.schedules.length} {...sec("schedule")}>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {p.schedules.map((row: ScheduleItem, i: number) => (
                                <div key={i} className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 flex items-center justify-between gap-2">
                                  <span className="text-[11px] text-indigo-700 truncate">{row.description || "—"}</span>
                                  <span className="text-xs font-bold text-indigo-700 shrink-0">₹{Number(row.payment || 0).toLocaleString("en-IN")}</span>
                                </div>
                              ))}
                            </div>
                          </ProjSection>
                        )}

                        {/* Team — developers assigned to this project */}
                        {p.developers && p.developers.length > 0 && (
                          <ProjSection title="Team" icon={<Code2 className="h-3 w-3 text-blue-500" />} count={p.developers.length} {...sec("team")}>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {p.developers.map((d: any) => (
                                <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                                  <div className="min-w-0">
                                    <span className="block truncate text-xs font-semibold text-[#1a2035]">{d.name}</span>
                                    <span className="block truncate text-[10px] text-[#8094ae]">
                                      {[d.role, d.experience].filter(Boolean).join(", ")}
                                    </span>
                                  </div>
                                  <Link href={`/developers/${d.id}`} className="shrink-0 text-[10px] font-semibold text-blue-600 hover:underline">
                                    View
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </ProjSection>
                        )}

                        {/* Subscriptions linked to this project */}
                        {p.subscriptions && p.subscriptions.length > 0 && (
                          <ProjSection title="Subscriptions" icon={<Package className="h-3 w-3 text-indigo-500" />} count={p.subscriptions.length} {...sec("subscriptions")}>
                            <div className="space-y-2">
                              {p.subscriptions.map((s: any) => {
                                const expiring = isExpiringSoon(s);
                                return (
                                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                      <span className="inline-flex rounded-full bg-white border border-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                                        {s.category}
                                      </span>
                                      {s.name && <span className="truncate text-xs text-indigo-700">{s.name}</span>}
                                      <span className="text-xs font-semibold text-indigo-700">
                                        {Number(s.amount) === 0 ? "Free" : `₹${Number(s.amount).toLocaleString("en-IN")}${cycleSuffix(s.billingCycle)}`}
                                      </span>
                                      {s.lastPaidAt && (
                                        <span className="flex items-center gap-1 text-[10px] text-green-600">
                                          <CheckCircle2 className="h-3 w-3" />Paid {formatDate(s.lastPaidAt)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                        expiring
                                          ? "bg-orange-50 border-orange-200 text-orange-600"
                                          : "bg-white border-indigo-100 text-indigo-500"
                                      }`}>
                                        {expiring ? "Expiring soon" : s.status}
                                      </span>

                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </ProjSection>
                        )}

                        {/* Finance — budget / paid / remaining with progress */}
                        {p.finance && (() => {
                          const budget    = Number(p.finance.totalBudget ?? 0);
                          const paid      = Number(p.finance.totalPaid ?? 0);
                          const remaining = Number(p.finance.remainingBalance ?? (budget - paid));
                          const pct       = budget > 0 ? Math.min(100, Math.round((paid / budget) * 100)) : 0;
                          return (
                            <ProjSection title="Finance" icon={<Wallet className="h-3 w-3 text-emerald-500" />} {...sec("finance")}>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-[#8094ae]">Budget</p>
                                  <p className="text-xs font-bold text-[#1a2035]">₹{budget.toLocaleString("en-IN")}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-emerald-600">Paid</p>
                                  <p className="text-xs font-bold text-emerald-700">₹{paid.toLocaleString("en-IN")}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-orange-600">Remaining</p>
                                  <p className="text-xs font-bold text-orange-700">₹{remaining.toLocaleString("en-IN")}</p>
                                </div>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-right text-[10px] font-semibold text-emerald-600">{pct}% paid</p>
                            </ProjSection>
                          );
                        })()}

                        {/* Documents — estimation PDF, project PDF, and uploaded files */}
                        {(() => {
                          const projDocs = p.documents ?? documents.filter((d: any) => d.projectId === pid);
                          const count = (p.estimationPdfUrl ? 1 : 0) + (p.projectPdfUrl ? 1 : 0) + projDocs.length;
                          return (
                            <ProjSection title="Documents" icon={<FileText className="h-3 w-3 text-blue-500" />} count={count} {...sec("documents")}>
                              {count === 0 ? (
                                <p className="py-2 text-center text-[11px] text-gray-400">No documents.</p>
                              ) : (
                                <>
                                  {/* Estimation PDF */}
                                  {p.estimationPdfUrl && (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-medium text-[#1a2035]">Estimation PDF</p>
                                          {p.estimationPdfAt && (
                                            <p className="text-[10px] text-[#8094ae]">{formatDate(p.estimationPdfAt)}</p>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => viewProjectPdf("estimation", p.id)}
                                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-[#f0f6ff] hover:text-blue-600"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />View
                                      </button>
                                    </div>
                                  )}

                                  {/* Project (contract) PDF */}
                                  {p.projectPdfUrl && (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-medium text-[#1a2035]">Project PDF</p>
                                          {p.projectPdfAt && (
                                            <p className="text-[10px] text-[#8094ae]">{formatDate(p.projectPdfAt)}</p>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => viewProjectPdf("project", p.id)}
                                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-[#f0f6ff] hover:text-blue-600"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />View
                                      </button>
                                    </div>
                                  )}

                                  {/* Uploaded documents */}
                                  {projDocs.map((doc: any) => (
                                    <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-medium text-[#1a2035]">{doc.fileName}</p>
                                          <p className="text-[10px] text-[#8094ae]">
                                            {formatFileSize(doc.fileSize)}{doc.createdAt ? ` · ${formatDate(doc.createdAt)}` : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => viewDoc(doc.id)}
                                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-[#f0f6ff] hover:text-blue-600"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />View
                                      </button>
                                    </div>
                                  ))}
                                </>
                              )}
                            </ProjSection>
                          );
                        })()}

                        {/* Status toggle — only while the project is still in estimation */}
                        {isEstimationStage ? (
                          <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                            <span className="text-[10px] text-gray-400 mr-1">Change status:</span>
                            {(["Pending", "Converted", "Rejected"] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={status === s}
                                onClick={() =>
                                  s === "Converted"
                                    ? openConvertModal(p)
                                    : handleUpdateProjectStatus(p.id, s)
                                }
                                className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all ${
                                  status === s
                                    ? s === "Rejected"  ? "bg-red-100 border-red-300 text-red-600 cursor-default scale-105 shadow-sm"
                                    :                     "bg-yellow-100 border-yellow-300 text-yellow-700 cursor-default scale-105 shadow-sm"
                                    : s === "Converted" ? "bg-white border-green-200 text-green-600 hover:border-green-300 hover:bg-green-50"
                                    :                     "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                {s === "Converted" ? "Convert" : s}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-[10px] text-gray-400">
                              Converted — managed in{" "}
                              <Link href={`/projects/${p.id}`} className="font-semibold text-blue-600 hover:underline">
                                Projects
                              </Link>
                            </span>
                          </div>
                        )}

                        </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}