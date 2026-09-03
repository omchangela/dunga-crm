import Link from "next/link";
import { ArrowLeft, UserPlus, Sparkles } from "lucide-react";
import { AddLeadForm } from "@/components/leads/add-lead-form";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Page Hero Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 space-y-4">
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md border border-white/15 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Leads
          </Link>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              New Lead Registration
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Register a prospective client inquiry into the CRM pipeline.
            </p>
          </div>
        </div>
      </section>

      {/* Form Component */}
      <AddLeadForm />
    </div>
  );
}
