export const LOAN_TYPE_DISPLAY: Record<string, string> = {
  PERSONAL_LOAN:  "Personal Loan",
  HOME_LOAN:      "Home Loan",
  MORTGAGE_LOAN:  "Mortgage Loan",
  BUSINESS_LOAN:  "Business Loan",
  SCHOOL_LOAN:    "School Loan",
  HOSPITAL_LOAN:  "Hospital Loan",
  CAR_LOAN:       "Car Loan",
  COMMERCIAL_LOAN:"Commercial Loan",
};

export const SOURCE_DISPLAY: Record<string, string> = {
  ADVERTISEMENT:    "Advertisement",
  CLIENT_REFERENCE: "Client Reference",
  SALES_EXECUTIVE:  "Sales Executive",
  OTHER:            "Other",
};

export const STATUS_DISPLAY: Record<string, string> = {
  PENDING:   "Pending",
  CONVERTED: "Converted",
  REJECTED:  "Rejected",
};

export const EMPLOYMENT_DISPLAY: Record<string, string> = {
  SALARIED:      "Salaried",
  SELF_EMPLOYED: "Self Employed",
  BUSINESS:      "Business",
  UNEMPLOYED:    "Unemployed",
};

export const CUSTOMER_STATUS_DISPLAY: Record<string, string> = {
  ACTIVE:   "Active",
  INACTIVE: "Inactive",
};

// ── Service type (project type) ────────────────────────────────────────────────
export const SERVICE_TYPE_DISPLAY: Record<string, string> = {
  WEB_DEVELOPMENT:     "Web Development",
  APP_DEVELOPMENT:     "App Development",
  APP_WEB_DEVELOPMENT: "App + Web Development",
  DIGITAL_MARKETING:   "Digital Marketing",
  DESIGN_SERVICES:     "Design Services",
  OTHERS:              "Others",
};

// ── Full project/customer status set ───────────────────────────────────────────
export const PROJECT_STATUS_DISPLAY: Record<string, string> = {
  ACTIVE:    "Active",
  INACTIVE:  "Inactive",
  PENDING:   "Pending",
  CONVERTED: "Converted",
  REJECTED:  "Rejected",
  COMPLETED: "Completed",
  ON_HOLD:   "On Hold",
  CANCELLED: "Cancelled",
};

function invert(m: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
}

export const SERVICE_TYPE_ENUM    = invert(SERVICE_TYPE_DISPLAY);
export const PROJECT_STATUS_ENUM  = invert(PROJECT_STATUS_DISPLAY);

export const d = {
  loan:           (v: string) => LOAN_TYPE_DISPLAY[v]        ?? v,
  source:         (v: string) => SOURCE_DISPLAY[v]            ?? v,
  status:         (v: string) => STATUS_DISPLAY[v]            ?? v,
  employment:     (v: string) => EMPLOYMENT_DISPLAY[v]        ?? v,
  customerStatus: (v: string) => CUSTOMER_STATUS_DISPLAY[v]   ?? v,
  service:        (v: string) => SERVICE_TYPE_DISPLAY[v]      ?? v,
  projStatus:     (v: string) => PROJECT_STATUS_DISPLAY[v]    ?? v,
};

// Reverse: display label -> backend enum (for write payloads)
export const e = {
  service: (v: string) => SERVICE_TYPE_ENUM[v]   ?? v,
  status:  (v: string) => PROJECT_STATUS_ENUM[v] ?? v,
};
