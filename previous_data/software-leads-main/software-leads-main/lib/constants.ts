import type { LoanType, LeadStatus } from "@/types";

export const LOAN_TYPES: LoanType[] = [
  "Personal Loan",
  "Home Loan",
  "Mortgage Loan",
  "Business Loan",
  "School Loan",
  "Hospital Loan",
  "Car Loan",
  "Commercial Loan",
];

export const LEAD_STATUSES: LeadStatus[] = [
  "Pending",
  "Under Review",
  "Rejected",
  "Converted",
];

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Leads", href: "/leads", icon: "UserPlus" },
  { label: "Customers", href: "/customers", icon: "Users" },
  { label: "Reminders", href: "/reminders", icon: "Bell" },
  { label: "Bank Employees", href: "/bank-employees", icon: "Building2" },
  { label: "DSA", href: "/dsa", icon: "Briefcase" },
] as const;
