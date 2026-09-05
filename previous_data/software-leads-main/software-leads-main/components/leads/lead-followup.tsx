"use client";

import { useState } from "react";
import {
  Plus, Trash2, CheckCircle2, Clock, CalendarDays, X,
} from "lucide-react";
import { getFollowUps, saveFollowUp, deleteFollowUp } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import type { MockFollowUp } from "@/types";

interface Props {
  leadId: string;
}

export function LeadFollowup({ leadId }: Props) {
  const [followUps, setFollowUps] = useState<MockFollowUp[]>(() => getFollowUps(leadId));
  const [showForm, setShowForm]   = useState(false);
  const [note, setNote]           = useState("");
  const [date, setDate]           = useState("");
  const [markId, setMarkId]       = useState<string | null>(null);
  const [completion, setCompletion] = useState("");

  const refresh = () => setFollowUps(getFollowUps(leadId));

  function handleAdd() {
    if (!note.trim() || !date) return;
    const fu: MockFollowUp = {
      id:            `fu-${crypto.randomUUID().slice(0, 8)}`,
      leadId,
      scheduledDate: new Date(date).toISOString(),
      note:          note.trim(),
      followedUp:    false,
      createdAt:     new Date().toISOString(),
    };
    saveFollowUp(leadId, fu);
    refresh();
    setNote("");
    setDate("");
    setShowForm(false);
  }

  function handleMarkDone(fu: MockFollowUp) {
    const updated: MockFollowUp = {
      ...fu,
      followedUp:    true,
      followedUpAt:  new Date().toISOString(),
      completionNote: completion.trim() || undefined,
    };
    saveFollowUp(leadId, updated);
    refresh();
    setMarkId(null);
    setCompletion("");
  }

  function handleDelete(fuId: string) {
    deleteFollowUp(leadId, fuId);
    refresh();
  }

  const pending   = followUps.filter((f) => !f.followedUp);
  const completed = followUps.filter((f) =>  f.followedUp);

  return (
    <div className="rounded-2xl border border-[#e5e9f2] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e5e9f2] px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1a2035]">Follow-ups</h3>
          <p className="mt-0.5 text-xs text-[#8094ae]">{pending.length} pending</p>
        </div>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="flex items-center gap-1.5 rounded-lg bg-[#0971fe] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0558d4]"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border-b border-[#e5e9f2] p-4 space-y-3 bg-[#f9fafc]">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Scheduled Date</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[#e5e9f2] px-3 py-2 text-sm focus:border-[#0971fe] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-[#e5e9f2] px-3 py-2 text-sm focus:border-[#0971fe] focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!note.trim() || !date}
              className="rounded-lg bg-[#0971fe] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-[#0558d4]"
            >
              Save
            </button>
            <button
              onClick={() => { setShowForm(false); setNote(""); setDate(""); }}
              className="rounded-lg border border-[#e5e9f2] px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#f5f6fa]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="divide-y divide-[#f5f6fa]">
          {pending.map((fu) => (
            <div key={fu.id} className="p-4">
              {markId === fu.id ? (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={completion}
                    onChange={(e) => setCompletion(e.target.value)}
                    placeholder="Completion note (optional)"
                    className="w-full rounded-lg border border-[#e5e9f2] px-3 py-2 text-sm focus:border-[#0971fe] focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleMarkDone(fu)} className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">
                      Mark Done
                    </button>
                    <button onClick={() => { setMarkId(null); setCompletion(""); }} className="rounded-lg border border-[#e5e9f2] px-3 py-1.5 text-xs font-medium text-gray-600">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#1a2035]">{fu.note}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#8094ae]">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(fu.scheduledDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setMarkId(fu.id)}
                      title="Mark done"
                      className="rounded-lg p-1.5 text-[#8094ae] hover:bg-green-50 hover:text-green-600"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(fu.id)}
                      title="Delete"
                      className="rounded-lg p-1.5 text-[#8094ae] hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="border-t border-[#e5e9f2]">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-[#8094ae]">
            Completed
          </p>
          <div className="divide-y divide-[#f5f6fa]">
            {completed.map((fu) => (
              <div key={fu.id} className="flex items-start gap-3 p-4 opacity-60">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1a2035] line-through">{fu.note}</p>
                  {fu.completionNote && (
                    <p className="mt-0.5 text-xs text-[#8094ae]">{fu.completionNote}</p>
                  )}
                  <p className="mt-0.5 text-xs text-[#8094ae]">
                    Done {fu.followedUpAt ? formatDate(fu.followedUpAt) : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(fu.id)}
                  className="rounded-lg p-1.5 text-[#8094ae] hover:bg-red-50 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {followUps.length === 0 && !showForm && (
        <div className="py-8 text-center text-sm text-[#8094ae]">
          No follow-ups yet. Click Add to schedule one.
        </div>
      )}
    </div>
  );
}
