import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@/types";

interface LeadStatusBadgeProps {
  status: LeadStatus;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const variantMap: Record<LeadStatus, string> = {
    Pending:        "pending",
    "Under Review": "default",
    Rejected:       "rejected",
    Converted:      "default",
  };

  return <Badge variant={variantMap[status] as any}>{status}</Badge>;
}
