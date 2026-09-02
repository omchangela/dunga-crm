import { Users, UserPlus, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { mockLeads, mockCustomers } from "@/lib/mock-data";

const stats = [
  {
    label: "Total Leads",
    value: mockLeads.length,
    icon: UserPlus,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    label: "Total Customers",
    value: mockCustomers.length,
    icon: Users,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    label: "Converted Leads",
    value: mockLeads.filter((l) => l.status === "Converted").length,
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
