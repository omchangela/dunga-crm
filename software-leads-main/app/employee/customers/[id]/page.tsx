"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, User, Pencil, Plus,
  CalendarDays, X, Briefcase, MapPin,
  Layers, Wallet, Clock, CheckCircle2, AlertCircle,
  ChevronDown, FileText, Code2, ExternalLink,
  Globe, Server, Shield, Wrench, Package, CreditCard, IndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { employeePortalApi, buildCreateProjectBody } from "@/lib/api";
import { e as toEnum } from "@/lib/enum-maps";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";

const STATUS_NORMALIZE: Record<string, string> = {
  PENDING: "Pending", CONVERTED: "Converted", REJECTED: "Rejected",
  ACTIVE: "Active", COMPLETED: "Completed", ON_HOLD: "On Hold", CANCELLED: "Cancelled",
};

const SUB_CATEGORY_META: Record<string, { icon: React.ElementType; badge: string }> = {
  "Domain":                { icon: Globe,    badge: "bg-purple-50 text-purple-700 border-purple-200" },
  "Hosting":               { icon: Server,   badge: "bg-blue-50 text-blue-700 border-blue-200"      },
  "SSL":                   { icon: Shield,   badge: "bg-green-50 text-green-700 border-green-200"   },
  "Maintenance":           { icon: Wrench,   badge: "bg-orange-50 text-orange-700 border-orange-200"},
  "Software Subscription": { icon: Package,  badge: "bg-teal-50 text-teal-700 border-teal-200"      },
};
const SUB_STATUS_BADGE: Record<string, string> = {
  Active:    "bg-green-50 text-green-700 border-green-200",
  Expired:   "bg-red-50 text-red-600 border-red-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};
const BILLING_SUFFIX: Record<string, string> = {
  Monthly: "/mo", Quarterly: "/qtr", Yearly: "/yr",
};

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
  projectName: string; projectDescription: string; projectType: string; status: string;
  overviewWeb: string[]; overviewApp: string[]; overviewAdmin: string[];
  payments: PaymentItem[]; timelines: TimelineItem[]; schedules: ScheduleItem[];
}

const emptyProjForm: ProjFormState = {
  projectName: "", projectDescription: "", projectType: "", status: "Pending",
  overviewWeb: [], overviewApp: [], overviewAdmin: [],
  payments: [], timelines: [], schedules: [],
};

type OverviewKey = "overviewWeb" | "overviewApp" | "overviewAdmin";

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
      <div ref={ref} className={open ? "" : "overflow-hidden"} style={open ? undefined : { maxHeight: `${lines * 1.45}em` }}>
        {children}
      </div>
      {(overflowing || open) && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="mt-0.5 text-[10px] font-semibold text-blue-600 hover:underline">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ProjSection({ title, icon, count, open, onToggle, children }: {
  title: string; icon: React.ReactNode; count?: number;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e5e9f2]">
      <button type="button" onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 bg-[#f1f4f9] px-3 py-2 text-left hover:bg-[#e8edf5]">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          {icon}{title}
          {count != null && <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500">{count}</span>}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-2 bg-white px-3 py-2.5">{children}</div>}
    </div>
  );
}

export default function EmployeeCustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [customer, setCustomer]   = useState<any>(null);
  const [projects, setProjects]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAddProj, setShowAddProj] = useState(false);
  const [projForm, setProjForm]   = useState<ProjFormState>(emptyProjForm);
  const [projError, setProjError] = useState("");
  const [toast, setToast]         = useState<string | null>(null);
  const [convertModal, setConvertModal] = useState<{ project: any } | null>(null);
  const [finalPayments, setFinalPayments] = useState<PaymentItem[]>([]);
  const [converting, setConverting]       = useState(false);

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [openProjSection, setOpenProjSection]   = useState<Record<string, boolean>>({});

  const toggleProject = (key: string) =>
    setExpandedProjects((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleProjSection = (key: string) =>
    setOpenProjSection((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  async function load() {
    setLoading(true);
    try {
      const data = await employeePortalApi.getCustomerDetail(id);
      setCustomer(data);
      setProjects(data?.projects ?? []);
    } catch {
      setCustomer(null); setProjects([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (id) load(); }, [id]);

  const totalPayment     = projForm.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalWorkingDays = projForm.timelines.reduce((sum, t) => sum + (Number(t.workingDays) || 0), 0);

  const updateForm = (patch: Partial<ProjFormState>) => {
    setProjForm((prev) => ({ ...prev, ...patch }));
    if (projError) setProjError("");
  };

  const addOverviewItem = (key: OverviewKey) =>
    setProjForm((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  const updateOverviewItem = (key: OverviewKey, index: number, value: string) =>
    setProjForm((prev) => { const arr = [...prev[key]]; arr[index] = value; return { ...prev, [key]: arr }; });
  const removeOverviewItem = (key: OverviewKey, index: number) =>
    setProjForm((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));

  const addPayment = () =>
    setProjForm((prev) => ({ ...prev, payments: [...prev.payments, { description: "", amount: "" }] }));
  const updatePayment = (index: number, field: keyof PaymentItem, value: string) =>
    setProjForm((prev) => { const arr = [...prev.payments]; arr[index] = { ...arr[index], [field]: value }; return { ...prev, payments: arr }; });
  const removePayment = (index: number) =>
    setProjForm((prev) => ({ ...prev, payments: prev.payments.filter((_, i) => i !== index) }));

  const addTimeline = () =>
    setProjForm((prev) => ({ ...prev, timelines: [...prev.timelines, { description: "", workingDays: "" }] }));
  const updateTimeline = (index: number, field: keyof TimelineItem, value: string) =>
    setProjForm((prev) => { const arr = [...prev.timelines]; arr[index] = { ...arr[index], [field]: value }; return { ...prev, timelines: arr }; });
  const removeTimeline = (index: number) =>
    setProjForm((prev) => ({ ...prev, timelines: prev.timelines.filter((_, i) => i !== index) }));

  const addSchedule = () =>
    setProjForm((prev) => ({ ...prev, schedules: [...prev.schedules, { description: "", payment: "" }] }));
  const updateSchedule = (index: number, field: keyof ScheduleItem, value: string) =>
    setProjForm((prev) => { const arr = [...prev.schedules]; arr[index] = { ...arr[index], [field]: value }; return { ...prev, schedules: arr }; });
  const removeSchedule = (index: number) =>
    setProjForm((prev) => ({ ...prev, schedules: prev.schedules.filter((_, i) => i !== index) }));

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000);
  }

  async function viewProjectPdf(kind: "estimation" | "project", projectId: string) {
    try {
      const res = kind === "estimation"
        ? await employeePortalApi.getEstimationPdf(projectId)
        : await employeePortalApi.getProjectPdf(projectId);
      const url = res?.data?.downloadUrl ?? res?.data?.signedUrl ?? res?.downloadUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else showToast("PDF not available.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to open PDF.");
    }
  }

  async function handleUpdateProjectStatus(projectId: string, newStatus: string) {
    try {
      await employeePortalApi.updateProjectStatus(projectId, { status: toEnum.status(newStatus) });
      await load();
      showToast(newStatus === "Rejected"
        ? "Project marked as Rejected — visible in Estimation."
        : "Project status updated.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to update status.");
    }
  }

  const finalTotal = finalPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const updateFinalPayment = (index: number, field: keyof PaymentItem, value: string) =>
    setFinalPayments((prev) => { const arr = [...prev]; arr[index] = { ...arr[index], [field]: value }; return arr; });
  const addFinalPayment    = () => setFinalPayments((prev) => [...prev, { description: "", amount: "" }]);
  const removeFinalPayment = (index: number) => setFinalPayments((prev) => prev.filter((_, i) => i !== index));

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
      await employeePortalApi.updateProjectStatus(convertModal.project.id, { status: "CONVERTED", payments: cleaned });
      setConvertModal(null); await load();
      showToast("Project converted and moved to Projects module.");
    } catch (err: any) {
      showToast(err?.message ?? "Failed to convert project.");
    } finally { setConverting(false); }
  }

  async function handleAddProject() {
    if (!projForm.projectName.trim()) { setProjError("Project Name field is required."); return; }
    setProjError("");
    try {
      await employeePortalApi.createProject(customer.id, buildCreateProjectBody({
        projectName: projForm.projectName, projectDescription: projForm.projectDescription,
        projectType: projForm.projectType, status: projForm.status,
        overviewWeb: projForm.overviewWeb, overviewApp: projForm.overviewApp,
        overviewAdmin: projForm.overviewAdmin,
        payments: projForm.payments, timelines: projForm.timelines, schedules: projForm.schedules,
      }));
      setProjForm(emptyProjForm); setShowAddProj(false); await load();
      showToast("Project added.");
    } catch (err: any) {
      setProjError(err?.message ?? "Failed to add project.");
    }
  }

  if (loading) return <div className="max-w-5xl mx-auto p-4"><DetailSkeleton /></div>;
  if (!customer) return <div className="flex items-center justify-center py-20 text-sm text-[#8094ae]">Customer not found.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">

      {/* Convert Modal */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="font-semibold text-[#1a2035]">Final Estimation</p>
                <p className="text-xs text-gray-400 mt-0.5">{convertModal.project.projectName || convertModal.project.headline}</p>
              </div>
              <button onClick={() => setConvertModal(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Review and update each payment before confirming conversion.</p>
                <button type="button" onClick={addFinalPayment}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {finalPayments.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input placeholder="Description (e.g. Frontend)" value={row.description}
                      onChange={(e) => updateFinalPayment(index, "description", e.target.value)} className="h-9 text-sm flex-1" />
                    <Input type="number" placeholder="Amount (₹)" value={row.amount}
                      onChange={(e) => updateFinalPayment(index, "amount", e.target.value)} className="h-9 text-sm flex-1" />
                    {finalPayments.length > 1 && (
                      <button type="button" onClick={() => removeFinalPayment(index)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-purple-50 border border-purple-100 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-600">Total Project Cost</span>
                <span className="text-base font-bold text-purple-700">₹{finalTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
              <button onClick={handleConfirmConvert} disabled={converting}
                className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                {converting ? "Converting…" : "Confirm & Convert"}
              </button>
              <button onClick={() => setConvertModal(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />{toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/employee/customers"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title={customer.fullName} subtitle="Customer Dashboard File Management Instance" />
        <Link href={`/employee/customers/${id}/edit`}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa]">
          <Pencil className="h-4 w-4" />Edit
        </Link>
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
            { icon: <User className="h-4 w-4" />,         label: "Client Name",     value: customer.fullName },
            { icon: <Phone className="h-4 w-4" />,        label: "Phone",           value: customer.phone },
            { icon: <Mail className="h-4 w-4" />,         label: "Email",           value: customer.email },
            { icon: <Briefcase className="h-4 w-4" />,    label: "Service Type",    value: customer.projectType },
            { icon: <Layers className="h-4 w-4" />,       label: "Application No.", value: customer.applicationNumber },
            { icon: <CalendarDays className="h-4 w-4" />, label: "Customer Since",  value: customer.createdAt ? formatDate(customer.createdAt) : "" },
            { icon: <MapPin className="h-4 w-4" />,       label: "State",           value: customer.state },
            { icon: <MapPin className="h-4 w-4" />,       label: "City",            value: customer.city },
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

      {/* Project Tracking */}
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
              <div className="-mx-6 mb-1 flex items-center gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                  <Briefcase className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1a2035]">New Project Record</p>
                  <p className="text-[11px] text-gray-500">Capture scope, estimation and timeline for {customer.fullName}.</p>
                </div>
                <button type="button"
                  onClick={() => { setShowAddProj(false); setProjForm(emptyProjForm); setProjError(""); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white/70 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Project Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g., Fact-Ops Platform" value={projForm.projectName}
                  onChange={(e) => updateForm({ projectName: e.target.value })} className="bg-white" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Project Description</Label>
                <textarea placeholder="Describe the project scope and goals..." value={projForm.projectDescription}
                  onChange={(e) => updateForm({ projectDescription: e.target.value })} rows={3}
                  className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Type of Project</Label>
                <select value={projForm.projectType} onChange={(e) => updateForm({ projectType: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">Select Domain Category...</option>
                  <option value="Web Development">Web Development</option>
                  <option value="App Development">App Development</option>
                  <option value="App + Web Development">App + Web Development</option>
                  <option value="Digital Marketing">Digital Marketing</option>
                  <option value="Design Services">Design Services</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Pipeline Status</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["Pending", "Converted", "Rejected"].map((s) => (
                    <button key={s} type="button" onClick={() => updateForm({ status: s })}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                        projForm.status === s ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Overview */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide">Project Overview</Label>
                {([
                  { key: "overviewWeb" as OverviewKey, label: "Web",   dot: "bg-blue-400" },
                  { key: "overviewApp" as OverviewKey, label: "App",   dot: "bg-emerald-400" },
                  { key: "overviewAdmin" as OverviewKey, label: "Admin", dot: "bg-purple-400" },
                ]).map((cat) => (
                  <div key={cat.key} className="rounded-xl border border-[#e5e9f2] bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${cat.dot}`} /> {cat.label}
                      </span>
                      <button type="button" onClick={() => addOverviewItem(cat.key)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {projForm[cat.key].length > 0 && (
                      <div className="space-y-2">
                        {projForm[cat.key].map((desc, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input placeholder={`${cat.label} description ${index + 1}`} value={desc}
                              onChange={(e) => updateOverviewItem(cat.key, index, e.target.value)}
                              className="bg-white text-xs flex-1 focus-visible:ring-blue-500" />
                            <Button type="button" variant="ghost" size="icon"
                              onClick={() => removeOverviewItem(cat.key, index)}
                              className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Payment */}
              <div className="space-y-2.5 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" /> Payment
                  </Label>
                  <button type="button" onClick={addPayment}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {projForm.payments.length > 0 && (
                  <div className="space-y-2">
                    {projForm.payments.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input placeholder="Description" value={row.description}
                          onChange={(e) => updatePayment(index, "description", e.target.value)} className="bg-white text-xs flex-1" />
                        <Input type="number" placeholder="Amount (₹)" value={row.amount}
                          onChange={(e) => updatePayment(index, "amount", e.target.value)} className="bg-white text-xs flex-1" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePayment(index)}
                          className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5">
                  <span className="text-xs font-semibold text-emerald-600">Project Cost</span>
                  <span className="text-base font-bold text-emerald-700">₹{totalPayment.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2.5 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-orange-500" /> Project Timeline
                  </Label>
                  <button type="button" onClick={addTimeline}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {projForm.timelines.length > 0 && (
                  <div className="space-y-2">
                    {projForm.timelines.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input placeholder="Description" value={row.description}
                          onChange={(e) => updateTimeline(index, "description", e.target.value)} className="bg-white text-xs flex-1" />
                        <Input type="number" placeholder="Working days" value={row.workingDays}
                          onChange={(e) => updateTimeline(index, "workingDays", e.target.value)} className="bg-white text-xs flex-1" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTimeline(index)}
                          className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 px-4 py-2.5">
                  <span className="text-xs font-semibold text-orange-600">Total Working Days</span>
                  <span className="text-base font-bold text-orange-700">{totalWorkingDays} {totalWorkingDays === 1 ? "day" : "days"}</span>
                </div>
              </div>

              {/* Payment Scheduled */}
              <div className="space-y-2.5 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-gray-500 tracking-wide flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-indigo-500" /> Payment Scheduled
                  </Label>
                  <button type="button" onClick={addSchedule}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {projForm.schedules.length > 0 && (
                  <div className="space-y-2">
                    {projForm.schedules.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input placeholder="Description" value={row.description}
                          onChange={(e) => updateSchedule(index, "description", e.target.value)} className="bg-white text-xs flex-1" />
                        <Input type="number" placeholder="Payment (₹)" value={row.payment}
                          onChange={(e) => updateSchedule(index, "payment", e.target.value)} className="bg-white text-xs flex-1" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSchedule(index)}
                          className="h-9 w-9 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {projError && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">
                  <AlertCircle className="h-4 w-4 shrink-0" /><span className="font-medium">{projError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-dashed">
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => { setShowAddProj(false); setProjForm(emptyProjForm); setProjError(""); }}>
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
              <div className="py-10 text-center text-xs text-gray-400 font-medium">No projects added yet.</div>
            ) : (
              projects.map((p, index) => {
                const raw = p.status || "Pending";
                const status = STATUS_NORMALIZE[raw.toUpperCase()] ?? raw;
                const view   = PROJECT_STATUS_VIEW[status] ?? PROJECT_STATUS_VIEW["Pending"];
                const isEstimationStage = status === "Pending" || status === "Rejected";
                const pid    = p.id || `proj-${index}`;
                const expanded = !!expandedProjects[pid];
                const sec = (name: string) => ({
                  open: openProjSection[`${pid}:${name}`] ?? true,
                  onToggle: () => toggleProjSection(`${pid}:${name}`),
                });

                return (
                  <div key={pid} className="flex overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
                    <div className={`w-1.5 shrink-0 ${view.accent}`} />
                    <div className="min-w-0 flex-1">
                      <div role="button" tabIndex={0} onClick={() => toggleProject(pid)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleProject(pid); } }}
                        className={`flex w-full cursor-pointer select-none items-start justify-between gap-3 bg-slate-50/70 px-4 py-3 text-left transition-colors hover:bg-slate-100/70 ${expanded ? "border-b border-gray-100" : ""}`}>
                        <div className="min-w-0 space-y-1.5">
                          <h4 className="text-sm font-bold text-[#1a2035]">{p.projectName || p.headline}</h4>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${view.badge}`}>
                              {view.label}
                            </span>
                            {p.projectType && (
                              <span className="inline-flex text-[10px] font-medium bg-blue-50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                {p.projectType}
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <Expandable lines={2}><p className="text-xs text-gray-400">{p.description}</p></Expandable>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 block">Project Cost</span>
                            <span className="text-sm font-bold text-[#1a2035]">₹{Number(p.budget || 0).toLocaleString("en-IN")}</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>

                      {expanded && (
                        <div className="p-4 space-y-3">

                          {/* Overview */}
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
                                        {cat.items.map((pt: string, i: number) => (
                                          <div key={i} className="flex items-center gap-2 text-xs text-gray-600 pl-3">
                                            <span className="h-1 w-1 rounded-full bg-gray-300 shrink-0" />{pt}
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

                          {/* Timelines */}
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

                          {/* Schedules */}
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

                          {/* Team */}
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
                                  </div>
                                ))}
                              </div>
                            </ProjSection>
                          )}

                          {/* Subscriptions */}
                          {(() => {
                            const subs: any[] = Array.isArray(p.subscriptions) ? p.subscriptions : [];
                            return (
                              <ProjSection title="Subscriptions" icon={<CreditCard className="h-3 w-3 text-purple-500" />} count={subs.length} {...sec("subscriptions")}>
                                {subs.length === 0 ? (
                                  <p className="text-xs text-[#8094ae]">No subscriptions for this project.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {subs.map((sub: any) => {
                                      const meta = SUB_CATEGORY_META[sub.category] ?? { icon: Package, badge: "bg-gray-50 text-gray-600 border-gray-200" };
                                      const CatIcon = meta.icon;
                                      const now = Date.now();
                                      const renewalMs = sub.renewalDate ? new Date(sub.renewalDate).getTime() : 0;
                                      const daysLeft = renewalMs ? Math.ceil((renewalMs - now) / 86400000) : null;
                                      const isExpiring = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
                                      const isOverdue  = daysLeft !== null && daysLeft < 0;
                                      const suffix = BILLING_SUFFIX[sub.billingCycle] ?? "";
                                      const statusBadge = SUB_STATUS_BADGE[sub.status] ?? "bg-gray-100 text-gray-500 border-gray-200";
                                      return (
                                        <div key={sub.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
                                              <CatIcon className="h-2.5 w-2.5" />{sub.category}
                                            </span>
                                            <span className="truncate text-xs font-medium text-[#1a2035]">{sub.name}</span>
                                            {sub.amount && (
                                              <span className="flex items-center gap-0.5 text-xs text-[#8094ae]">
                                                <IndianRupee className="h-2.5 w-2.5" />{Number(sub.amount).toLocaleString("en-IN")}{suffix}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {isOverdue && (
                                              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Overdue</span>
                                            )}
                                            {isExpiring && !isOverdue && (
                                              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">Expiring soon</span>
                                            )}
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge}`}>{sub.status}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </ProjSection>
                            );
                          })()}

                          {/* Finance */}
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

                          {/* Documents (PDF only — no upload for employees) */}
                          {(() => {
                            const count = (p.estimationPdfUrl ? 1 : 0) + (p.projectPdfUrl ? 1 : 0);
                            return (
                              <ProjSection title="Documents" icon={<FileText className="h-3 w-3 text-blue-500" />} count={count} {...sec("documents")}>
                                {count === 0 && (
                                  <p className="text-xs text-[#8094ae]">No documents.</p>
                                )}
                                {p.estimationPdfUrl && (
                                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-[#1a2035]">Estimation PDF</p>
                                        {p.estimationPdfAt && <p className="text-[10px] text-[#8094ae]">{formatDate(p.estimationPdfAt)}</p>}
                                      </div>
                                    </div>
                                    <button onClick={() => viewProjectPdf("estimation", p.id)}
                                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-[#f0f6ff] hover:text-blue-600">
                                      <ExternalLink className="h-3.5 w-3.5" />View
                                    </button>
                                  </div>
                                )}
                                {p.projectPdfUrl && (
                                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e9f2] bg-[#f8f9fc] px-3 py-2">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-[#1a2035]">Project PDF</p>
                                        {p.projectPdfAt && <p className="text-[10px] text-[#8094ae]">{formatDate(p.projectPdfAt)}</p>}
                                      </div>
                                    </div>
                                    <button onClick={() => viewProjectPdf("project", p.id)}
                                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 hover:bg-[#f0f6ff] hover:text-blue-600">
                                      <ExternalLink className="h-3.5 w-3.5" />View
                                    </button>
                                  </div>
                                )}
                              </ProjSection>
                            );
                          })()}

                          {/* Status toggle */}
                          {isEstimationStage ? (
                            <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                              <span className="text-[10px] text-gray-400 mr-1">Change status:</span>
                              {(["Pending", "Converted", "Rejected"] as const).map((s) => (
                                <button key={s} type="button" disabled={status === s}
                                  onClick={() => s === "Converted" ? openConvertModal(p) : handleUpdateProjectStatus(p.id, s)}
                                  className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all ${
                                    status === s
                                      ? s === "Rejected" ? "bg-red-100 border-red-300 text-red-600 cursor-default scale-105 shadow-sm"
                                      : "bg-yellow-100 border-yellow-300 text-yellow-700 cursor-default scale-105 shadow-sm"
                                      : s === "Converted" ? "bg-white border-green-200 text-green-600 hover:border-green-300 hover:bg-green-50"
                                      : "bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50"
                                  }`}>
                                  {s === "Converted" ? "Convert" : s}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-[10px] text-gray-400">
                                Converted — managed in{" "}
                                <Link href={`/employee/projects/${p.id}`} className="font-semibold text-blue-600 hover:underline">
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
  );
}
