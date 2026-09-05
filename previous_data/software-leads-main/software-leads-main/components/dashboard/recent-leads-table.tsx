"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { mockLeads } from "@/lib/mock-data";
import { LOAN_TYPES, LEAD_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

export function RecentLeadsTable() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>("");

  const filtered = mockLeads.filter((l) => {
    const matchStatus = !statusFilter || l.status === statusFilter;
    const matchLoan = !loanTypeFilter || l.loanType === loanTypeFilter;
    return matchStatus && matchLoan;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Recent Leads</CardTitle>
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-36 text-xs"
            >
              <option value="">All Statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Select
              value={loanTypeFilter}
              onChange={(e) => setLoanTypeFilter(e.target.value)}
              className="w-40 text-xs"
            >
              <option value="">All Project Types</option>
              {LOAN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Project Name</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>DSA</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 5).map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.loanType || "—"}</TableCell>
                  <TableCell>{lead.loanAmount ? formatCurrency(lead.loanAmount) : "—"}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.assignedDSAName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(lead.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
