"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe, Server, Shield, Wrench, Package } from "lucide-react";
import { employeePortalApi } from "@/lib/api";
import { CardGridSkeleton } from "@/components/ui/skeleton";

type Category = "Domain" | "Hosting" | "SSL" | "Maintenance" | "Software Subscription";

const CATEGORIES: {
  key: Category; label: string; slug: string; icon: React.ElementType;
  color: string; bg: string; border: string; barColor: string; desc: string;
}[] = [
  { key: "Domain",                slug: "domain",      label: "Domain",                icon: Globe,   color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   barColor: "bg-blue-500",   desc: "Manage your domain registrations & renewals"    },
  { key: "Hosting",               slug: "hosting",     label: "Hosting",               icon: Server,  color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", barColor: "bg-purple-500", desc: "Web hosting & server subscription plans"         },
  { key: "SSL",                   slug: "ssl",         label: "SSL",                   icon: Shield,  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  barColor: "bg-green-500",  desc: "SSL certificates & security subscriptions"       },
  { key: "Maintenance",           slug: "maintenance", label: "Maintenance",           icon: Wrench,  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", barColor: "bg-orange-500", desc: "Website maintenance & support contracts"         },
  { key: "Software Subscription", slug: "software",    label: "Software Subscription", icon: Package, color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", barColor: "bg-indigo-500", desc: "SaaS tools & software license subscriptions"     },
];

export default function EmployeeSubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeePortalApi.listSubscriptions()
      .then((res: any) => {
        const list: any[] = Array.isArray(res?.subscriptions) ? res.subscriptions
          : Array.isArray(res?.data?.subscriptions) ? res.data.subscriptions
          : Array.isArray(res) ? res : [];
        setSubs(list);
      })
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a2035]">Subscriptions</h1>
        <p className="mt-0.5 text-sm text-[#8094ae]">Select a category to view and manage subscriptions</p>
      </div>

      {loading ? (
        <CardGridSkeleton count={5} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map(({ key, slug, label, icon: Icon, color, bg, border, barColor, desc }) => {
            const catSubs      = subs.filter((s) => s.category === key);
            const activeCount  = catSubs.filter((s) => s.status === "Active").length;
            const expiredCount = catSubs.filter((s) => s.status === "Expired").length;
            const renewingSoon = catSubs.filter((s) => {
              if (s.status !== "Active") return false;
              const days = (new Date(s.renewalDate).getTime() - Date.now()) / 86400000;
              return days >= 0 && days <= 30;
            }).length;

            return (
              <button
                key={key}
                onClick={() => router.push(`/employee/subscriptions/${slug}`)}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#e5e9f2] bg-white text-left shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className={`h-1.5 w-full ${barColor}`} />
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${bg} ${border}`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#1a2035] group-hover:text-[#0971fe] transition-colors">{label}</p>
                      <p className="text-[11px] text-[#8094ae]">{desc}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className={`rounded-lg border px-3 py-2 ${bg} ${border}`}>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-[#8094ae]">Total</p>
                      <p className={`mt-0.5 text-lg font-bold ${color}`}>{catSubs.length}</p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-green-600">Active</p>
                      <p className="mt-0.5 text-lg font-bold text-green-700">{activeCount}</p>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${expiredCount > 0 ? "border-red-200 bg-red-50" : "border-[#e5e9f2] bg-[#f8f9fc]"}`}>
                      <p className={`text-[10px] font-medium uppercase tracking-wide ${expiredCount > 0 ? "text-red-500" : "text-[#8094ae]"}`}>Expired</p>
                      <p className={`mt-0.5 text-lg font-bold ${expiredCount > 0 ? "text-red-600" : "text-[#8094ae]"}`}>{expiredCount}</p>
                    </div>
                  </div>

                  {renewingSoon > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-400 text-[10px] font-bold text-white">{renewingSoon}</span>
                      <p className="text-[11px] font-medium text-orange-700">renewing within 30 days</p>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
