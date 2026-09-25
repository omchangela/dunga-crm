import prisma from './prisma'

// ─── TYPES ────────────────────────────────────────────────────────

export interface SendWhatsAppMessageOptions {
    recipientPhone: string
    recipientName?: string
    message: string
    mediaUrl?: string
    type: 'QUOTATION' | 'PAYMENT_RECEIPT' | 'PROJECT_DEADLINE' | 'SUBSCRIPTION_15D' | 'SUBSCRIPTION_7D' | 'DISCUSSION_COMPLETED' | 'ONBOARDING' | 'CEO_WELCOME' | 'WORK_STARTED' | 'DAILY_UPDATE' | 'PAYMENT_REMINDER' | 'FINAL_PAYMENT_REQUEST' | 'PROJECT_COMPLETED' | 'SERVICES' | 'CUSTOM'
    referenceId?: string
    template?: {
        name: string
        language: string
        headerDocumentUrl?: string
        headerParams?: Array<{
            type: 'document' | 'image' | 'video'
            url: string
            filename?: string
        }>
        bodyParams?: string[]
    }
}

// ─── PHONE NUMBER NORMALIZATION ──────────────────────────────────

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

    console.log(`[WhatsApp] Dispatching ${options.type} message to ${cleanPhone} (Enabled: ${isEnabled}, PhoneID: ${phoneNoId})`)

    // ─── ANTI-DUPLICATION GUARD ──────────────────────────────────────
    try {
        const cooldownSeconds = 10
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
            console.log(`\n───────────────── WHATSAPP NOTIFICATION (DRY RUN / DEV) ─────────────────`)
            console.log(`To: ${cleanPhone} (${options.recipientName || 'Client'})`)
            console.log(`Type: ${options.type}`)
            console.log(`Message:\n${options.message}`)
            if (options.mediaUrl) console.log(`Attachment: ${options.mediaUrl}`)
            console.log(`─────────────────────────────────────────────────────────────────────────\n`)
            dispatchStatus = 'DRY_RUN'
        } else {
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
                if (options.template.headerParams && options.template.headerParams.length > 0) {
                    payload.headerParams = options.template.headerParams
                } else if (options.template.headerDocumentUrl) {
                    payload.headerParams = [{
                        type: 'document',
                        url: options.template.headerDocumentUrl,
                        filename: 'document.pdf'
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

// ─── 14 OFFICIAL META TEMPLATES SUITE ────────────────────────────

const DEFAULT_SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
const DEFAULT_SERVICES_IMAGE = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'

/**
 * 1. ONBOARDING WELCOME ALERT
 *    Template: onbording (en_GB) — Text
 *    Params: {{1}}=clientName
 *    Trigger: When lead converts to customer / onboarding begins.
 */
export const sendOnboardingAlert = async (data: { clientPhone: string; clientName: string; customerId?: string }) => {
    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Welcome to Dunga Technologies Onboarding, ${data.clientName}! Your unique Customer ID has been generated.`,
        type: 'ONBOARDING',
        referenceId: data.customerId,
        template: {
            name: 'onbording',
            language: 'en_GB',
            bodyParams: [data.clientName]
        }
    })
}

/**
 * 2. CEO WELCOME MESSAGE
 *    Template: ceomessage (en) — Text
 *    Params: {{1}}=clientName
 *    Trigger: Welcome note from Founder & CEO to client.
 */
export const sendCeoWelcomeMessage = async (data: { clientPhone: string; clientName: string; customerId?: string }) => {
    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Welcome from Harikrishna Prasad Dunga (Founder & CEO, Dunga Technologies) to ${data.clientName}!`,
        type: 'CEO_WELCOME',
        referenceId: data.customerId,
        template: {
            name: 'ceomessage',
            language: 'en',
            bodyParams: [data.clientName]
        }
    })
}

/**
 * 3. SERVICES OVERVIEW
 *    Template: services (en_GB) — Image Header
 *    Params: 0 body params
 *    Trigger: Sent to prospective clients showcasing technical solutions.
 */
export const sendServicesOverview = async (data: { clientPhone: string; clientName?: string; imageUrl?: string }) => {
    const imgUrl = data.imageUrl || DEFAULT_SERVICES_IMAGE
    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: 'Explore Dunga Technologies range of digital solutions, app & web development, and cloud services.',
        type: 'SERVICES',
        template: {
            name: 'services',
            language: 'en_GB',
            headerParams: [{ type: 'image', url: imgUrl }],
            bodyParams: []
        }
    })
}

/**
 * 4. PROJECT DISCUSSION SUMMARY
 *    Template: project_discussion_summary (en_GB) — Text
 *    Params: {{1}}=clientName, {{2}}=projectSummary
 *    Trigger: Sent after requirement discussion is documented.
 */
export interface ProjectDiscussionSummaryPayload {
    clientPhone: string
    clientName: string
    projectSummary: string
    projectId?: string
}
export const sendProjectDiscussionSummary = async (data: ProjectDiscussionSummaryPayload) => {
    const flatSummary = data.projectSummary.replace(/\n/g, ' | ')
    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Discussion summary for ${data.clientName}: ${flatSummary}`,
        type: 'DISCUSSION_COMPLETED',
        referenceId: data.projectId,
        template: {
            name: 'project_discussion_summary',
            language: 'en_GB',
            bodyParams: [data.clientName, flatSummary]
        }
    })
}

/**
 * Backward-compatible alias for sendProjectDiscussionSummary
 */
export interface DiscussionCompletedAlertPayload {
    leadPhone: string
    leadName: string
    serviceType?: string | null
    leadId?: string
    summaryNote?: string
}
export const sendDiscussionCompletedAlert = async (data: DiscussionCompletedAlertPayload) => {
    const service = data.serviceType ? data.serviceType.replace(/_/g, ' ') : 'Software Solution'
    const summary = data.summaryNote
        ? `Service: ${service} | Note: ${data.summaryNote}`
        : `Service: ${service} | Discussion completed. Our team will proceed with the next steps.`

    return sendProjectDiscussionSummary({
        clientPhone:    data.leadPhone,
        clientName:     data.leadName,
        projectSummary: summary,
        projectId:      data.leadId
    })
}

/**
 * 5. ADVANCE PAYMENT REQUEST
 *    Template: advancepaymentrequest (en_GB) — Text
 *    Params: {{1}}=clientName, {{2}}=amount, {{3}}=paymentLink, {{4}}=projectName
 *    Trigger: Sent to request initial advance payment before project commencement.
 */
export interface AdvancePaymentRequestPayload {
    clientPhone: string
    clientName: string
    amount: number | string
    paymentLink: string
    projectName: string
    projectId?: string
}
export const sendAdvancePaymentRequest = async (data: AdvancePaymentRequestPayload) => {
    const formattedAmount = typeof data.amount === 'number'
        ? data.amount.toLocaleString('en-IN')
        : String(data.amount)

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Advance payment request for ${data.projectName}: ₹${formattedAmount}. Pay here: ${data.paymentLink}`,
        type: 'QUOTATION',
        referenceId: data.projectId,
        template: {
            name: 'advancepaymentrequest',
            language: 'en_GB',
            bodyParams: [
                data.clientName,
                formattedAmount,
                data.paymentLink,
                data.projectName
            ]
        }
    })
}

/**
 * 6. ADVANCE PAYMENT RECEIVED & VERIFIED
 *    Template: advancepaymentreceived (en) — Document Header
 *    Params: {{1}}=clientName, {{2}}=amount, {{3}}=projectName
 *    Trigger: Sent upon receipt of advance payment with PDF receipt attachment.
 */
export interface AdvancePaymentReceivedPayload {
    clientPhone: string
    clientName: string
    amount: number | string
    projectName: string
    receiptPdfUrl?: string | null
    projectId?: string
}
export const sendAdvancePaymentReceived = async (data: AdvancePaymentReceivedPayload) => {
    const formattedAmount = typeof data.amount === 'number'
        ? data.amount.toLocaleString('en-IN')
        : String(data.amount)
    const docUrl = (data.receiptPdfUrl && !data.receiptPdfUrl.startsWith('data:')) ? data.receiptPdfUrl : DEFAULT_SAMPLE_PDF

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Advance payment of ₹${formattedAmount} for ${data.projectName} verified and confirmed!`,
        mediaUrl: docUrl,
        type: 'PAYMENT_RECEIPT',
        referenceId: data.projectId,
        template: {
            name: 'advancepaymentreceived',
            language: 'en',
            headerParams: [{
                type: 'document',
                url: docUrl,
                filename: 'Advance_Payment_Receipt.pdf'
            }],
            bodyParams: [
                data.clientName,
                formattedAmount,
                data.projectName
            ]
        }
    })
}

/**
 * 7. WORK START NOTIFICATION
 *    Template: workstart (en_GB) — Text
 *    Params: {{1}}=clientName, {{2}}=projectName
 *    Trigger: Sent when project status updates to ACTIVE / development commences.
 */
export const sendWorkStartAlert = async (data: { clientPhone: string; clientName: string; projectName: string; projectId?: string }) => {
    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Work officially started for ${data.projectName}! Our team has commenced development.`,
        type: 'WORK_STARTED',
        referenceId: data.projectId,
        template: {
            name: 'workstart',
            language: 'en_GB',
            bodyParams: [data.clientName, data.projectName]
        }
    })
}

/**
 * 8. DAILY PROJECT PROGRESS UPDATE
 *    Template: dailyupdate (en_GB) — Text
 *    Params: {{1}}=clientName, {{2}}=projectName, {{3}}=act1, {{4}}=act2, {{5}}=act3, {{6}}=status
 *    Trigger: Daily activity breakdown sent to client.
 */
export interface DailyUpdatePayload {
    clientPhone: string
    clientName: string
    projectName: string
    activity1: string
    activity2: string
    activity3: string
    currentStatus: string
    projectId?: string
}
export const sendDailyUpdate = async (data: DailyUpdatePayload) => {
    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Daily update for ${data.projectName}: ${data.currentStatus}`,
        type: 'DAILY_UPDATE',
        referenceId: data.projectId,
        template: {
            name: 'dailyupdate',
            language: 'en_GB',
            bodyParams: [
                data.clientName,
                data.projectName,
                data.activity1,
                data.activity2,
                data.activity3,
                data.currentStatus
            ]
        }
    })
}

/**
 * 9. PAYMENT REMINDER
 *    Template: paymentreminder (en) — Text
 *    Params: {{1}}=clientName, {{2}}=pendingAmount, {{3}}=paymentLink
 *    Trigger: Scheduled or manual pending payment reminder.
 */
export interface PaymentReminderPayload {
    clientPhone: string
    clientName: string
    pendingAmount: number | string
    paymentLink: string
    projectId?: string
}
export const sendPaymentReminder = async (data: PaymentReminderPayload) => {
    const formattedAmount = typeof data.pendingAmount === 'number'
        ? data.pendingAmount.toLocaleString('en-IN')
        : String(data.pendingAmount)

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Payment reminder: ₹${formattedAmount} pending. Secure payment link: ${data.paymentLink}`,
        type: 'PAYMENT_REMINDER',
        referenceId: data.projectId,
        template: {
            name: 'paymentreminder',
            language: 'en',
            bodyParams: [
                data.clientName,
                formattedAmount,
                data.paymentLink
            ]
        }
    })
}

/**
 * 10. FINAL PAYMENT REQUEST
 *     Template: finalpayment (en_GB) — Text
 *     Params: {{1}}=clientName, {{2}}=finalDueAmount, {{3}}=paymentLink
 *     Trigger: Project approaching completion; requests final milestone settlement.
 */
export interface FinalPaymentRequestPayload {
    clientPhone: string
    clientName: string
    finalDueAmount: number | string
    paymentLink: string
    projectId?: string
}
export const sendFinalPaymentRequest = async (data: FinalPaymentRequestPayload) => {
    const formattedAmount = typeof data.finalDueAmount === 'number'
        ? data.finalDueAmount.toLocaleString('en-IN')
        : String(data.finalDueAmount)

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Final payment request: ₹${formattedAmount} due before final project handover. Link: ${data.paymentLink}`,
        type: 'FINAL_PAYMENT_REQUEST',
        referenceId: data.projectId,
        template: {
            name: 'finalpayment',
            language: 'en_GB',
            bodyParams: [
                data.clientName,
                formattedAmount,
                data.paymentLink
            ]
        }
    })
}

/**
 * 11. FINAL ESTIMATION WITH PDF ATTACHMENT
 *     Template: final_estimation (en) — Document Header
 *     Params: {{1}}=clientName, {{2}}=projectName, {{3}}=estimationNo, {{4}}=finalAmount, {{5}}=deliveryDate
 *     Trigger: Sent when finalized estimation PDF is ready for client review.
 */
export interface FinalEstimationPayload {
    clientPhone: string
    clientName: string
    projectName: string
    estimationNo: string
    finalAmount: number | string
    deliveryDate: string
    pdfUrl?: string | null
    projectId?: string
}
export const sendFinalEstimation = async (data: FinalEstimationPayload) => {
    const formattedAmount = typeof data.finalAmount === 'number'
        ? data.finalAmount.toLocaleString('en-IN')
        : String(data.finalAmount)
    const docUrl = (data.pdfUrl && !data.pdfUrl.startsWith('data:')) ? data.pdfUrl : DEFAULT_SAMPLE_PDF

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Final estimation for ${data.projectName}: ₹${formattedAmount}. Target delivery: ${data.deliveryDate}.`,
        mediaUrl: docUrl,
        type: 'QUOTATION',
        referenceId: data.projectId,
        template: {
            name: 'final_estimation',
            language: 'en',
            headerParams: [{
                type: 'document',
                url: docUrl,
                filename: 'Final_Estimation.pdf'
            }],
            bodyParams: [
                data.clientName,
                data.projectName,
                data.estimationNo,
                formattedAmount,
                data.deliveryDate
            ]
        }
    })
}

/**
 * 12. PROJECT COMPLETED & HANDOVER
 *     Template: projectcomlated (en) — Text
 *     Params: {{1}}=clientName, {{2}}=projectName
 *     Trigger: Sent when project status changes to COMPLETED.
 */
export const sendProjectCompleted = async (data: { clientPhone: string; clientName: string; projectName: string; projectId?: string }) => {
    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Project ${data.projectName} has been successfully completed and moved to Handover & Closure Stage!`,
        type: 'PROJECT_COMPLETED',
        referenceId: data.projectId,
        template: {
            name: 'projectcomlated',
            language: 'en',
            bodyParams: [data.clientName, data.projectName]
        }
    })
}

/**
 * 13. INITIAL QUOTATION / ESTIMATION PROPOSAL
 *     Template: estimation (en) — Document Header
 *     Params: 0 body params
 *     Trigger: Sent with preliminary quotation proposal PDF.
 */
export interface QuotationAlertPayload {
    clientPhone: string
    clientName: string
    projectName: string
    budget: number
    serviceType?: string
    pdfUrl?: string | null
    projectId?: string
}
export const sendQuotationAlert = async (data: QuotationAlertPayload) => {
    const docUrl = (data.pdfUrl && !data.pdfUrl.startsWith('data:')) ? data.pdfUrl : DEFAULT_SAMPLE_PDF

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Estimation proposal for ${data.projectName} from Dunga Technologies.`,
        mediaUrl: docUrl,
        type: 'QUOTATION',
        referenceId: data.projectId,
        template: {
            name: 'estimation',
            language: 'en',
            headerParams: [{
                type: 'document',
                url: docUrl,
                filename: 'Project_Estimation.pdf'
            }],
            bodyParams: []
        }
    })
}

/**
 * 14. PART PAYMENT / MILESTONE PAYMENT CONFIRMATION
 *     Template: partpayment (en) — Document Header (or fallback to advancepaymentreceived if pending)
 */
export interface PartPaymentUpdatePayload {
    clientPhone: string
    clientName: string
    projectName: string
    totalAmount: number | string
    previousPaid: number | string
    currentReceived: number | string
    totalPaid: number | string
    pendingAmount: number | string
    paymentStatus: string
    remainingBalance: number | string
    receiptPdfUrl?: string | null
    projectId?: string
}
export const sendPartPaymentUpdate = async (data: PartPaymentUpdatePayload) => {
    const fmt = (v: number | string) => typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)
    const docUrl = (data.receiptPdfUrl && !data.receiptPdfUrl.startsWith('data:')) ? data.receiptPdfUrl : DEFAULT_SAMPLE_PDF

    const attempt = await sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Payment received for ${data.projectName}: ₹${fmt(data.currentReceived)}. Total paid: ₹${fmt(data.totalPaid)}, Pending: ₹${fmt(data.pendingAmount)}.`,
        mediaUrl: docUrl,
        type: 'PAYMENT_RECEIPT',
        referenceId: data.projectId,
        template: {
            name: 'partpayment',
            language: 'en',
            headerParams: [{
                type: 'document',
                url: docUrl,
                filename: 'Payment_Receipt.pdf'
            }],
            bodyParams: [
                data.clientName,
                data.projectName,
                fmt(data.totalAmount),
                fmt(data.previousPaid),
                fmt(data.currentReceived),
                fmt(data.totalPaid),
                fmt(data.pendingAmount),
                data.paymentStatus,
                fmt(data.remainingBalance)
            ]
        }
    })

    // If partpayment is still pending Meta review, fallback to advancepaymentreceived
    if (!attempt.success) {
        return sendAdvancePaymentReceived({
            clientPhone:   data.clientPhone,
            clientName:    data.clientName,
            amount:        data.currentReceived,
            projectName:   data.projectName,
            receiptPdfUrl: data.receiptPdfUrl,
            projectId:     data.projectId
        })
    }

    return attempt
}

/**
 * General Payment Receipt Alert helper
 */
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
export const sendPaymentReceiptAlert = async (data: PaymentReceiptPayload) => {
    return sendAdvancePaymentReceived({
        clientPhone:   data.clientPhone,
        clientName:    data.clientName,
        amount:        data.amount,
        projectName:   data.projectName,
        receiptPdfUrl: data.receiptPdfUrl,
        projectId:     data.projectId
    })
}

/**
 * Project Deadline Notice helper
 */
export interface DeadlineReminderPayload {
    clientPhone: string
    clientName: string
    projectName: string
    deadlineDate: Date
    daysRemaining: number
    projectId?: string
}
export const sendProjectDeadlineReminder = async (data: DeadlineReminderPayload) => {
    const formattedDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(data.deadlineDate))
    const summary = `Project: ${data.projectName} | Target Delivery: ${formattedDate} | Days Remaining: ${data.daysRemaining} days. Our engineering team is finalizing deployment milestones.`

    return sendProjectDiscussionSummary({
        clientPhone:    data.clientPhone,
        clientName:     data.clientName,
        projectSummary: summary,
        projectId:      data.projectId
    })
}

/**
 * Subscription Renewal Reminder helper
 */
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
export const sendSubscriptionRenewalReminder = async (data: SubscriptionReminderPayload) => {
    const formattedDate   = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(data.renewalDate))
    const formattedAmount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(data.amount)
    const reminderTier    = data.daysRemaining <= 7 ? '7-Day Renewal Notice' : '15-Day Renewal Notice'
    const notifType       = data.daysRemaining <= 7 ? 'SUBSCRIPTION_7D' : 'SUBSCRIPTION_15D'

    const summary = `${reminderTier} | Plan: ${data.subscriptionName}${data.category ? ` | Category: ${data.category}` : ''} | Renewal Fee: Rs.${formattedAmount} | Due Date: ${formattedDate} (${data.daysRemaining} days remaining). Kindly renew to avoid service interruption.`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName:  data.clientName,
        message: `Subscription renewal (${reminderTier}): ${data.subscriptionName} — Rs.${formattedAmount} due on ${formattedDate}.`,
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
