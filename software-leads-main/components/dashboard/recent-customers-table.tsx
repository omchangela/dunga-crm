"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockCustomers } from "@/lib/mock-data";
import { LOAN_TYPES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CustomerStatus, LoanType } from "@/types";

const statusVariantMap: Record<CustomerStatus, "active" | "closed" | "defaulted"> = {
  Active: "active",
  Closed: "closed",
  Defaulted: "defaulted",
};

export function RecentCustomersTable() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>("");

  const filtered = mockCustomers.filter((c) => {
    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchLoan = !loanTypeFilter || c.loanType === loanTypeFilter;
    return matchStatus && matchLoan;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Recent Customers</CardTitle>
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-36 text-xs"
            >
              <option value="">All Statuses</option>
              {(["Active", "Closed", "Defaulted"] as CustomerStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Select
              value={loanTypeFilter}
              onChange={(e) => setLoanTypeFilter(e.target.value)}
              className="w-40 text-xs"
            >
              <option value="">All Loan Types</option>
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
              <TableHead>Loan Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 5).map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.loanType}</TableCell>
                  <TableCell>{formatCurrency(customer.loanAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariantMap[customer.status as CustomerStatus] ?? "active"}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(customer.createdAt)}
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
