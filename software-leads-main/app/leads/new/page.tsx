import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AddLeadForm } from "@/components/leads/add-lead-form";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Clean Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/leads"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">New Lead Registration</h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Register a prospective client inquiry into the CRM pipeline</p>
        </div>
      </div>

      {/* Form Component */}
      <AddLeadForm />
    </div>
  );
}
