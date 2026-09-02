"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { updateLeadStatus } from "@/lib/store";
import type { LeadStatus } from "@/types";

const STATUSES: { value: LeadStatus; label: string; dot: string }[] = [
  { value: "Pending",      label: "Pending",      dot: "bg-yellow-400" },
  { value: "Under Review", label: "Under Review", dot: "bg-blue-400"   },
  { value: "Rejected",     label: "Rejected",     dot: "bg-red-400"    },
  { value: "Converted",    label: "Converted",    dot: "bg-purple-400" },
];

interface Props {
  lead: any;
  onUpdated: () => void;
}

export function LeadStatusUpdate({ lead, onUpdated }: Props) {
  const [selected, setSelected]   = useState<LeadStatus>(lead.status as LeadStatus);
  const [reason, setReason]       = useState(lead.rejectionReason ?? "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const isDirty = selected !== lead.status || (selected === "Rejected" && reason !== (lead.rejectionReason ?? ""));

  function handleSave() {
    if (!isDirty) return;
    setSaving(true);
    updateLeadStatus(lead.id, selected, selected === "Rejected" ? reason : undefined);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      onUpdated();
      setTimeout(() => setSaved(false), 2000);
    }, 300);
  }

  return (
    <div className="rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
      <div className="border-b border-[#e5e9f2] px-5 py-4">
        <h3 className="text-sm font-semibold text-[#1a2035]">Update Status</h3>
        <p className="mt-0.5 text-xs text-[#8094ae]">Change this lead's pipeline stage</p>
      </div>

      <div className="space-y-2 p-4">
        {STATUSES.map((s) => (
          <label
            key={s.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
              selected === s.value
                ? "border-[#0971fe] bg-[#0971fe]/5"
                : "border-[#e5e9f2] hover:bg-[#f9fafc]"
            }`}
          >
            <input
              type="radio"
              name="status"
              value={s.value}
              checked={selected === s.value}
              onChange={() => setSelected(s.value)}
              className="sr-only"
            />
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            <span className={`text-sm font-medium ${selected === s.value ? "text-[#0971fe]" : "text-[#1a2035]"}`}>
              {s.label}
            </span>
            {selected === s.value && (
              <CheckCircle2 className="ml-auto h-4 w-4 text-[#0971fe]" />
            )}
          </label>
        ))}
      </div>

      {selected === "Rejected" && (
        <div className="px-4 pb-2">
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Low CIBIL score — 580"
            className="w-full rounded-lg border border-[#e5e9f2] px-3 py-2 text-sm text-[#1a2035] placeholder:text-[#8094ae] focus:border-[#0971fe] focus:outline-none focus:ring-2 focus:ring-[#0971fe]/20"
          />
        </div>
      )}

      <div className="border-t border-[#e5e9f2] p-4">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving || (selected === "Rejected" && !reason.trim())}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            saved
              ? "bg-green-500 text-white"
              : "bg-[#0971fe] text-white hover:bg-[#0558d4]"
          }`}
        >
          {saving ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 className="h-4 w-4" /> Saved!</>
          ) : (
            "Save Status"
          )}
        </button>

        {lead.status === "Converted" && (
          <p className="mt-2 flex items-center gap-1 text-xs text-purple-600">
            <CheckCircle2 className="h-3 w-3" />
            This lead has been converted to a customer
          </p>
        )}
      </div>
    </div>
  );
}
