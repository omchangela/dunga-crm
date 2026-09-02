export const SERVICE_TYPES = [
    'WEB_DEVELOPMENT',
    'APP_DEVELOPMENT',
    'APP_WEB_DEVELOPMENT',
    'DIGITAL_MARKETING',
    'DESIGN_SERVICES',
    'OTHERS'
] as const

export const LEAD_SOURCES = [
    'ADVERTISEMENT',
    'CLIENT_REFERENCE',
    'SALES_EXECUTIVE',
    'OTHER'
] as const

export const LEAD_STATUSES = [
    'PENDING',
    'CONVERTED',
    'REJECTED'
] as const

export const REMINDER_STATUSES = [
    'PENDING',
    'DONE'
] as const

export type ServiceType     = typeof SERVICE_TYPES[number]
export type LeadSource      = typeof LEAD_SOURCES[number]
export type LeadStatus      = typeof LEAD_STATUSES[number]
export type ReminderStatus  = typeof REMINDER_STATUSES[number]