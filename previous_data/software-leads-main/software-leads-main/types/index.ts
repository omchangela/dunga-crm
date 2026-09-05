export type LoanType =
  | "Personal Loan"
  | "Home Loan"
  | "Mortgage Loan"
  | "Business Loan"
  | "School Loan"
  | "Hospital Loan"
  | "Car Loan"
  | "Commercial Loan";

export type LeadStatus = "Pending" | "Under Review" | "Rejected" | "Converted";

export type CustomerStatus = "Active" | "Closed" | "Defaulted";

export type ReminderType = "Follow-up" | "Payment" | "Document" | "Meeting";

export type ReminderPriority = "Low" | "Medium" | "High";

export type ReminderStatus = "Pending" | "Done";

export type StaffRole = "Admin" | "Loan Officer" | "Manager";

export type ActiveStatus = "Active" | "Inactive";

export interface Lead {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  loanType: LoanType;
  loanAmount: number;
  employmentType?: string;
  monthlyIncome?: number;
  status: LeadStatus;
  rejectionReason?: string;
  bankName?: string;
  assignedDSAId?: string;
  assignedDSAName?: string;
  sourceOfLead?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  loanType: LoanType;
  loanAmount: number;
  status: CustomerStatus;
  createdAt: string;
}

export interface DSA {
  id: string;
  name: string;
  phone: string;
  email: string;
  region: string;
  totalLeads: number;
  activeLeads: number;
  status: ActiveStatus;
}

export interface BankEmployee {
  id: string;
  name: string;
  phone: string;
  email: string;
  bankName: string;
  branch: string;
  designation: string;
  status: ActiveStatus;
}

export interface SystemStaff {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: StaffRole;
  status: ActiveStatus;
  joinedAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  relatedTo: string;
  type: ReminderType;
  status: ReminderStatus;
  priority: ReminderPriority;
  parentReminderId?: string;
  isReReminder?: boolean;
  parentReminder?: {
    id: string;
    reminderAt: string;
    note: string;
  };
}

export interface MockDocument {
  id: string;
  docType: string;
  status: "pending" | "uploaded" | "verified" | "rejected";
  fileName: string | null;
  fileSize: string | null;
  fileUrl?: string;
  mimeType?: string;
  uploadedAt?: string;
}

export interface MockFollowUp {
  id: string;
  leadId: string;
  scheduledDate: string;
  note: string;
  followedUp: boolean;
  followedUpAt?: string;
  completionNote?: string;
  createdAt: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
