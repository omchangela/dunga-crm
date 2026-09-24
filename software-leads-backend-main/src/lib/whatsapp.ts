import prisma from './prisma'

// ─── TYPES ────────────────────────────────────────────────────────

export interface SendWhatsAppMessageOptions {
    recipientPhone: string
    recipientName?: string
    message: string
    mediaUrl?: string
    type: 'QUOTATION' | 'PAYMENT_RECEIPT' | 'PROJECT_DEADLINE' | 'SUBSCRIPTION_15D' | 'SUBSCRIPTION_7D' | 'DISCUSSION_COMPLETED' | 'CUSTOM'
    referenceId?: string
    template?: {
        name: string
        language: string
        headerDocumentUrl?: string
        bodyParams?: string[]
    }
}

export interface QuotationAlertPayload {
    clientPhone: string
    clientName: string
    projectName: string
    budget: number
    serviceType?: string
    pdfUrl?: string | null
    projectId?: string
}

export interface PaymentReceiptPayload {
    clientPhone: string
    clientName: string
    projectName: string
    amount: number
    paymentMethod: string
    transactionId?: string | null
    remainingBalance?: number
    receiptPdfUrl?: string | null
    projectId?: string
}

export interface DeadlineReminderPayload {
    clientPhone: string
    clientName: string
    projectName: string
    deadlineDate: Date
    daysRemaining: number
    projectId?: string
}

export interface SubscriptionReminderPayload {
    clientPhone: string
    clientName: string
    subscriptionName: string
    amount: number
    renewalDate: Date
    daysRemaining: number
    category?: string
    subscriptionId?: string
}

// ─── PHONE NUMBER NORMALIZATION ──────────────────────────────────

/**
 * Standardizes phone number to international E.164 without '+'
 * e.g., "9876543210" -> "919876543210"
 *       "+91 98765 43210" -> "919876543210"
 *       "09876543210" -> "919876543210"
 */
export const sanitizePhoneNumber = (phone: string): string => {
    if (!phone) return ''
    let cleaned = phone.replace(/[^0-9]/g, '')

    // Remove leading zeros
    if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = '91' + cleaned.substring(1)
    }

    // Default 10 digit Indian number -> prepend 91
    if (cleaned.length === 10) {
        cleaned = '91' + cleaned
    }

    return cleaned
}

// ─── CORE DISPATCH SERVICE ───────────────────────────────────────

/**
 * Sends a WhatsApp message via WoxAPI or configured WhatsApp Gateway.
 * Safe non-blocking execution with complete logging in database.
 */
export const sendWhatsAppMessage = async (options: SendWhatsAppMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const rawPhone = options.recipientPhone
    const cleanPhone = sanitizePhoneNumber(rawPhone)

    if (!cleanPhone || cleanPhone.length < 10) {
        console.warn(`[WhatsApp] Skipping message dispatch: Invalid phone number '${rawPhone}'`)
        return { success: false, error: `Invalid phone number: ${rawPhone}` }
    }

    const apiUrl = process.env.WHATSAPP_API_URL || 'https://crm.woxapi.in/api/v2/whatsapp-business/messages'
    const apiKey = process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_TOKEN || 'fb291bf29374e66ed0237db0d57fc1658e7a2cd2201ef6068f9d0f7e24ba9bca'
    const phoneNoId = process.env.WHATSAPP_PHONE_NO_ID || '1381643891694755'
    const isEnabled = process.env.WHATSAPP_ENABLED === 'true' || Boolean(apiKey)

    console.log(`[WhatsApp] Dispatching ${options.type} message to ${cleanPhone} (Enabled: ${isEnabled})`)

    // ─── ANTI-DUPLICATION GUARD ──────────────────────────────────────
    // Check if the exact same notification type was already sent to this recipient in the last 120 seconds
    try {
        const cooldownSeconds = 120
        const recentDuplicate = await prisma.whatsAppNotificationLog.findFirst({
            where: {
                recipientPhone: cleanPhone,
                type: options.type,
                status: 'SENT',
                sentAt: {
                    gte: new Date(Date.now() - cooldownSeconds * 1000)
                }
            },
            orderBy: { sentAt: 'desc' }
        })

        if (recentDuplicate) {
            console.warn(`[WhatsApp Deduplication] Suppressed duplicate '${options.type}' to ${cleanPhone}. Already sent ${Math.round((Date.now() - recentDuplicate.sentAt.getTime()) / 1000)}s ago.`)
            return { success: true, messageId: recentDuplicate.id }
        }
    } catch (dedupErr) {
        console.warn('[WhatsApp Deduplication Check Notice]:', dedupErr)
    }

    let dispatchStatus: 'SENT' | 'FAILED' | 'DRY_RUN' = 'SENT'
    let dispatchError: string | null = null

    try {
        if (!isEnabled || !apiKey) {
            // Dry run / local development mode
            console.log(`\n───────────────── WHATSAPP NOTIFICATION (DRY RUN / DEV) ─────────────────`)
            console.log(`To: ${cleanPhone} (${options.recipientName || 'Client'})`)
            console.log(`Type: ${options.type}`)
            console.log(`Message:\n${options.message}`)
            if (options.mediaUrl) console.log(`Attachment: ${options.mediaUrl}`)
            console.log(`─────────────────────────────────────────────────────────────────────────\n`)
            dispatchStatus = 'DRY_RUN'
        } else {
            // Live API call to WoxAPI WhatsApp Business Messages endpoint
            let payload: Record<string, any>

            if (options.template) {
                payload = {
                    to: cleanPhone,
                    phoneNoId,
                    type: 'template',
                    name: options.template.name,
                    language: options.template.language || 'en',
                    bodyParams: options.template.bodyParams || []
                }
                if (options.template.headerDocumentUrl) {
                    payload.headerParams = [{
                        type: 'document',
                        url: options.template.headerDocumentUrl,
                        filename: 'estimation_proposal.pdf'
                    }]
                }
            } else {
                payload = {
                    to: cleanPhone,
                    phoneNoId,
                    type: 'text',
                    text: options.message
                }
            }

            console.log(`[WhatsApp Payload] Sending to WoxAPI:`, JSON.stringify(payload))

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            })

            const responseText = await response.text()
            if (!response.ok) {
                throw new Error(`WoxAPI returned HTTP ${response.status}: ${responseText}`)
            } else {
                console.log(`[WhatsApp Response] Success:`, responseText)
            }
        }
    } catch (err: any) {
        dispatchStatus = 'FAILED'
        dispatchError = err?.message || 'Unknown WhatsApp dispatch error'
        console.error(`[WhatsApp Error] Failed to send message to ${cleanPhone}:`, dispatchError)
    }

    // Record in database log for audit trail & anti-duplication
    try {
        await prisma.whatsAppNotificationLog.create({
            data: {
                type: options.type,
                recipientPhone: cleanPhone,
                recipientName: options.recipientName || null,
                message: options.message,
                referenceId: options.referenceId || null,
                status: dispatchStatus,
                error: dispatchError
            }
        })
    } catch (logErr) {
        console.error('[WhatsApp] Failed to save notification log in DB:', logErr)
    }

    return {
        success: dispatchStatus !== 'FAILED',
        error: dispatchError || undefined
    }
}

// ─── HIGH-LEVEL NOTIFICATION TEMPLATES ───────────────────────────

/**
 * 1. QUOTATION / ESTIMATION PROPOSAL ALERT
 *    Template: estimation (en) — Document header
 *    Params: No body params (static template)
 */
export const sendQuotationAlert = async (data: QuotationAlertPayload) => {
    const formattedBudget = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(data.budget)
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 15)
    const validUntilFormatted = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(validUntil)
    const estNo = `EST-${Date.now().toString().slice(-6)}`

    const sampleDocFallback = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    const docUrl = (data.pdfUrl && !data.pdfUrl.startsWith('data:')) ? data.pdfUrl : sampleDocFallback

    const message = `Quotation for ${data.projectName} — Est. ${formattedBudget}. Valid until ${validUntilFormatted}. — Dunga Technologies`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message,
        mediaUrl: docUrl,
        type: 'QUOTATION',
        referenceId: data.projectId,
        template: {
            name: 'estimation',
            language: 'en',
            headerDocumentUrl: docUrl,
            bodyParams: []
        }
    })
}

/**
 * 2. PAYMENT RECEIPT ALERT
 *    Template: final_estimation (en_GB) — Document header
 *    Params: {{1}}=name, {{2}}=project, {{3}}=receiptNo,
 *            {{4}}=amount, {{5}}=date
 */
export const sendPaymentReceiptAlert = async (data: PaymentReceiptPayload) => {
    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
    const receiptNo = `RCP-${Date.now().toString().slice(-6)}`
    const today = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date())

    const message = `Payment received for ${data.projectName}. Amount: ₹${fmt(data.amount)}. Remaining: ₹${fmt(data.remainingBalance ?? 0)}. Thank you!`

    const sampleDocFallback = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    const docUrl = (data.receiptPdfUrl && !data.receiptPdfUrl.startsWith('data:')) ? data.receiptPdfUrl : sampleDocFallback

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message,
        mediaUrl: docUrl,
        type: 'PAYMENT_RECEIPT',
        referenceId: data.projectId,
        template: {
            name: 'final_estimation',
            language: 'en',
            headerDocumentUrl: docUrl,
            bodyParams: [
                data.clientName,
                data.projectName,
                receiptNo,
                fmt(data.amount),
                today
            ]
        }
    })
}

/**
 * 3. PROJECT DEADLINE NOTICE
 *    Template: project_discussion_summary (en_GB)
 *    Params: {{1}}=name, {{2}}=summary (single-line, no newlines)
 */
export const sendProjectDeadlineReminder = async (data: DeadlineReminderPayload) => {
    const formattedDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(data.deadlineDate))
    const summary = `Project: ${data.projectName} | Target Delivery: ${formattedDate} | Days Remaining: ${data.daysRemaining} days | Our team is on track for timely delivery.`

    const message = `Deadline reminder for ${data.projectName}. Target: ${formattedDate} (${data.daysRemaining} days remaining).`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message,
        type: 'PROJECT_DEADLINE',
        referenceId: data.projectId,
        template: {
            name: 'project_discussion_summary',
            language: 'en_GB',
            bodyParams: [
                data.clientName,
                summary
            ]
        }
    })
}

/**
 * 4. SUBSCRIPTION EXPIRY REMINDER (15-Day & 7-Day Alert)
 *    Template: project_discussion_summary (en_GB)
 *    Params: {{1}}=name, {{2}}=summary (single-line, no newlines)
 */
export const sendSubscriptionRenewalReminder = async (data: SubscriptionReminderPayload) => {
    const formattedDate   = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(data.renewalDate))
    const formattedAmount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(data.amount)
    const reminderTier    = data.daysRemaining <= 7 ? '7-Day Renewal Notice' : '15-Day Renewal Notice'
    const notifType       = data.daysRemaining <= 7 ? 'SUBSCRIPTION_7D' : 'SUBSCRIPTION_15D'

    const summary = `${reminderTier} | Plan: ${data.subscriptionName}${data.category ? ` | Category: ${data.category}` : ''} | Renewal Fee: Rs.${formattedAmount} | Due Date: ${formattedDate} (${data.daysRemaining} days remaining). Kindly renew to avoid service interruption.`

    const message = `Subscription renewal (${reminderTier}): ${data.subscriptionName} — Rs.${formattedAmount} due on ${formattedDate}.`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message,
        type: notifType,
        referenceId: data.subscriptionId,
        template: {
            name: 'project_discussion_summary',
            language: 'en_GB',
            bodyParams: [
                data.clientName,
                summary
            ]
        }
    })
}

// ─── INTERFACE ────────────────────────────────────────────────────

export interface ProjectDiscussionSummaryPayload {
    clientPhone: string
    clientName: string
    projectSummary: string
    projectId?: string
}

/**
 * 5. PROJECT DISCUSSION SUMMARY
 *    Template: project_discussion_summary (en_GB)
 *    Params: {{1}}=name, {{2}}=projectSummary (single-line)
 */
export const sendProjectDiscussionSummary = async (data: ProjectDiscussionSummaryPayload) => {
    // Flatten any newlines in summary to avoid #132018 param error
    const flatSummary = data.projectSummary.replace(/\n/g, ' | ')

    const message =
`Project discussion summary for ${data.clientName}: ${data.projectSummary.substring(0, 100)}...`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName: data.clientName,
        message,
        type: 'DISCUSSION_COMPLETED',
        referenceId: data.projectId,
        template: {
            name: 'project_discussion_summary',
            language: 'en_GB',
            bodyParams: [
                data.clientName,
                flatSummary
            ]
        }
    })
}
