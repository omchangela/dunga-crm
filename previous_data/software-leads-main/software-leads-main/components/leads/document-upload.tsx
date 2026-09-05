"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  UploadCloud, Download, FileText, ImageIcon,
  X, CheckCircle2, AlertCircle, Clock, Paperclip, Eye,
} from "lucide-react";
import { getDocuments, saveDocument, deleteDocument } from "@/lib/store";
import type { LoanType, MockDocument } from "@/types";

// ── Doc type map ──────────────────────────────────────────────────────────────
const LOAN_DOCS: Record<LoanType, string[]> = {
  "Personal Loan":   ["Aadhaar Card", "PAN Card", "Salary Slip (3 months)", "Bank Statement (6 months)", "Photo"],
  "Home Loan":       ["Aadhaar Card", "PAN Card", "Salary Slip (3 months)", "Bank Statement (6 months)", "Property Papers", "Sale Agreement", "Photo"],
  "Car Loan":        ["Aadhaar Card", "PAN Card", "Salary Slip (3 months)", "Bank Statement (6 months)", "RC Book", "Insurance Copy", "Photo"],
  "Business Loan":   ["Aadhaar Card", "PAN Card", "GST Certificate", "ITR (2 years)", "Business Proof", "Bank Statement (12 months)", "Photo"],
  "Mortgage Loan":   ["Aadhaar Card", "PAN Card", "Property Papers", "Valuation Report", "Bank Statement (12 months)", "ITR (2 years)", "Photo"],
  "School Loan":     ["Aadhaar Card", "PAN Card", "Admission Letter", "Fee Structure", "Parent Salary Slip", "Bank Statement (3 months)", "Photo"],
  "Hospital Loan":   ["Aadhaar Card", "PAN Card", "Hospital Bill / Estimate", "Doctor Letter", "Salary Slip", "Bank Statement (3 months)", "Photo"],
  "Commercial Loan": ["Aadhaar Card", "PAN Card", "GST Certificate", "ITR (2 years)", "Business Proof", "Property Papers", "Bank Statement (12 months)", "Photo"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(name: string | null) {
  return !!name && /\.(jpg|jpeg|png)$/i.test(name);
}

function matchDocType(filename: string, available: string[]): string | null {
  const f = filename.toLowerCase();
  const try_ = (kw: string, part: string) =>
    f.includes(kw) ? available.find((d) => d.toLowerCase().includes(part)) ?? null : null;
  return (
    try_("aadhaar", "aadhaar") ?? try_("pan", "pan card") ??
    try_("salary", "salary")   ?? try_("bank", "bank statement") ??
    try_("statement", "bank statement") ?? try_("itr", "itr") ??
    try_("gst", "gst") ?? try_("property", "property") ??
    try_("photo", "photo") ?? try_("selfie", "photo") ?? null
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: MockDocument["status"] }) {
  const map = {
    pending:  { cls: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: <Clock className="h-3 w-3" />,        label: "Pending"  },
    uploaded: { cls: "bg-blue-50 text-blue-600 border-blue-200",       icon: <Paperclip className="h-3 w-3" />,    label: "Uploaded" },
    verified: { cls: "bg-green-50 text-green-600 border-green-200",    icon: <CheckCircle2 className="h-3 w-3" />, label: "Verified" },
    rejected: { cls: "bg-red-50 text-red-500 border-red-200",          icon: <AlertCircle className="h-3 w-3" />,  label: "Rejected" },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {icon}{label}
    </span>
  );
}

// ── Viewer modal ──────────────────────────────────────────────────────────────
function DocViewer({ doc, onClose }: { doc: MockDocument; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
          <p className="text-sm font-semibold text-[#1a2035]">{doc.docType}</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-[#f5f6fa]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          {doc.fileUrl && isImage(doc.fileName) ? (
            <img src={doc.fileUrl} alt={doc.fileName ?? ""} className="w-full h-auto rounded-lg" />
          ) : doc.fileUrl && doc.mimeType === "application/pdf" ? (
            <iframe src={doc.fileUrl} className="w-full h-[500px] rounded-lg border" title={doc.fileName ?? ""} />
          ) : doc.fileUrl ? (
            <div className="py-10 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12 text-[#8094ae]" />
              <p className="text-sm text-[#8094ae]">Preview not available</p>
              <a href={doc.fileUrl} download={doc.fileName ?? undefined}
                 className="mt-2 block text-sm text-[#0971fe] underline">
                Download file
              </a>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-[#8094ae]">No file attached</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Unmatched file type ───────────────────────────────────────────────────────
interface UnmatchedFile { id: string; fileName: string; fileSize: string; file: File; assignedDocType: string }

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  leadId: string;
  loanType: LoanType;
}

export function DocumentUpload({ leadId, loanType }: Props) {
  const docTypes = LOAN_DOCS[loanType] ?? LOAN_DOCS["Personal Loan"];

  const buildDocs = useCallback((): MockDocument[] => {
    const stored = getDocuments(leadId);
    return docTypes.map((docType) => {
      const existing = stored.find((d) => d.docType === docType);
      return existing ?? { id: `doc-${crypto.randomUUID().slice(0, 8)}`, docType, status: "pending", fileName: null, fileSize: null };
    });
  }, [leadId, docTypes]);

  const [docs, setDocs]           = useState<MockDocument[]>(buildDocs);
  const [isDragOver, setIsDragOver] = useState(false);
  const [unmatched, setUnmatched] = useState<UnmatchedFile[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [viewDoc, setViewDoc]     = useState<MockDocument | null>(null);
  const [progress, setProgress]   = useState<Record<string, number>>({});

  const bulkRef   = useRef<HTMLInputElement>(null);
  const singleRef = useRef<HTMLInputElement>(null);
  const docsRef   = useRef(docs);
  useEffect(() => { docsRef.current = docs; }, [docs]);

  // ── Upload a real file ───────────────────────────────────────────────────────
  const uploadFile = useCallback((docId: string, file: File) => {
    const fileUrl  = URL.createObjectURL(file);
    const partial: MockDocument = {
      id: docId, docType: docsRef.current.find((d) => d.id === docId)?.docType ?? "",
      status: "uploaded", fileName: file.name,
      fileSize: fmtSize(file.size), fileUrl, mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };

    setProgress((p) => ({ ...p, [docId]: 5 }));
    let pct = 5;
    const tick = setInterval(() => {
      pct = Math.min(pct + Math.floor(Math.random() * 18 + 8), 100);
      if (pct >= 100) {
        clearInterval(tick);
        setProgress((p) => { const n = { ...p }; delete n[docId]; return n; });
        saveDocument(leadId, partial);
        setDocs(buildDocs());
      } else {
        setProgress((p) => ({ ...p, [docId]: pct }));
      }
    }, 150);
  }, [leadId, buildDocs]);

  // ── Process dropped / bulk files ─────────────────────────────────────────────
  const processFiles = useCallback((files: FileList) => {
    const arr = Array.from(files);
    const newUnmatched: UnmatchedFile[] = [];
    const used = new Set<string>();
    let matched = 0;

    arr.forEach((file) => {
      const docType = matchDocType(file.name, docTypes);
      if (docType && !used.has(docType)) {
        const target = docsRef.current.find((d) => d.docType === docType && d.status === "pending");
        if (target) { used.add(docType); uploadFile(target.id, file); matched++; return; }
      }
      newUnmatched.push({ id: crypto.randomUUID(), fileName: file.name, fileSize: fmtSize(file.size), file, assignedDocType: docTypes[0] });
    });

    if (newUnmatched.length) setUnmatched((p) => [...p, ...newUnmatched]);
    if (matched) { setSuccessMsg(`${matched} file${matched > 1 ? "s" : ""} uploaded`); setTimeout(() => setSuccessMsg(""), 3000); }
  }, [docTypes, uploadFile]);

  function attachUnmatched(um: UnmatchedFile) {
    const target = docsRef.current.find((d) => d.docType === um.assignedDocType && d.status === "pending");
    if (target) uploadFile(target.id, um.file);
    setUnmatched((p) => p.filter((u) => u.id !== um.id));
  }

  function removeDoc(docId: string) {
    deleteDocument(leadId, docId);
    setDocs(buildDocs());
  }

  const total    = docs.length;
  const uploaded = docs.filter((d) => d.status !== "pending").length;
  const verified = docs.filter((d) => d.status === "verified").length;
  const rejected = docs.filter((d) => d.status === "rejected").length;

  return (
    <section>
      {viewDoc && <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2035]">Documents</h2>
          <p className="mt-0.5 text-sm text-[#8094ae]">{uploaded}/{total} documents uploaded</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-[#e5e9f2] bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-[#f5f6fa]">
          <Download className="h-4 w-4" />Download All
        </button>
      </div>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total",    value: total,    cls: "text-[#1a2035]" },
          { label: "Uploaded", value: uploaded, cls: "text-[#0971fe]" },
          { label: "Verified", value: verified, cls: "text-green-600"  },
          { label: "Rejected", value: rejected, cls: "text-[#e85347]" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-xl bg-[#f5f6fa] px-4 py-3 text-center">
            <p className={`text-lg font-bold ${cls}`}>{value}</p>
            <p className="text-xs text-[#8094ae]">{label}</p>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); }}
        className={`mt-5 flex flex-col items-center rounded-xl border-2 border-dashed p-8 text-center transition-colors sm:p-10 ${
          isDragOver ? "border-[#0971fe] bg-blue-50" : "border-[#e5e9f2] bg-white hover:border-[#0971fe]/40"
        }`}
      >
        <UploadCloud className={`mb-3 h-10 w-10 ${isDragOver ? "text-[#0971fe]" : "text-[#8094ae]"}`} />
        <p className="text-base font-medium text-[#1a2035]">Drag &amp; drop files here</p>
        <p className="mt-1 text-sm text-[#8094ae]">or click to browse — PDF, JPG, PNG up to 10 MB</p>
        <button onClick={() => bulkRef.current?.click()} className="mt-4 rounded-lg bg-[#0971fe] px-5 py-2 text-sm font-medium text-white hover:bg-[#0558d4]">
          Browse Files
        </button>
        <input ref={bulkRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={(e) => { if (e.target.files?.length) { processFiles(e.target.files); e.target.value = ""; } }} />
      </div>

      <input ref={singleRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f && activeDocId) uploadFile(activeDocId, f); e.target.value = ""; }} />

      {successMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{successMsg}
        </div>
      )}

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-yellow-200 bg-yellow-50">
          <div className="border-b border-yellow-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-yellow-700">Unmatched Files — assign manually</p>
          </div>
          <div className="divide-y divide-yellow-100">
            {unmatched.map((um) => (
              <div key={um.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-yellow-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1a2035]">{um.fileName}</p>
                  <p className="text-xs text-[#8094ae]">{um.fileSize}</p>
                </div>
                <select value={um.assignedDocType}
                  onChange={(e) => setUnmatched((p) => p.map((u) => u.id === um.id ? { ...u, assignedDocType: e.target.value } : u))}
                  className="h-8 rounded-lg border border-yellow-200 bg-white px-2 text-xs text-gray-700 focus:outline-none"
                >
                  {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => attachUnmatched(um)} className="rounded-lg bg-[#0971fe] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0558d4]">Attach</button>
                <button onClick={() => setUnmatched((p) => p.filter((u) => u.id !== um.id))} className="rounded-lg p-1.5 text-[#8094ae] hover:bg-yellow-100"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doc grid */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {docs.map((doc) => {
          const pct      = progress[doc.id];
          const uploading = pct !== undefined;
          const done      = doc.status !== "pending" && !uploading;

          return (
            <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-[#e5e9f2] bg-white p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f5f6fa]">
                {isImage(doc.fileName)
                  ? <ImageIcon className="h-5 w-5 text-[#0971fe]" />
                  : <FileText className="h-5 w-5 text-[#8094ae]" />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1a2035]">{doc.docType}</p>
                {doc.fileName
                  ? <p className="truncate text-xs text-[#8094ae]">{doc.fileName} · {doc.fileSize}</p>
                  : <p className="text-xs text-[#8094ae]">PDF or JPG, max 10 MB</p>}
                {uploading && (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#f5f6fa]">
                    <div className="h-full rounded-full bg-[#0971fe] transition-all duration-150" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>

              <div className="shrink-0">
                {uploading ? (
                  <span className="text-xs font-medium text-[#0971fe]">{pct}%</span>
                ) : done ? (
                  <div className="flex items-center gap-1">
                    {doc.fileUrl && (
                      <button onClick={() => setViewDoc(doc)} title="Preview"
                        className="rounded-md p-1 text-[#8094ae] hover:bg-blue-50 hover:text-[#0971fe]">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <StatusBadge status={doc.status} />
                    <button onClick={() => removeDoc(doc.id)} title="Remove"
                      className="rounded-md p-1 text-[#8094ae] hover:bg-red-50 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setActiveDocId(doc.id); singleRef.current?.click(); }}
                    className="rounded-lg border border-[#e5e9f2] bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-[#0971fe] hover:text-[#0971fe]">
                    Upload
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
