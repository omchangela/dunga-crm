import prisma from './prisma'

// ─── TYPES ────────────────────────────────────────────────────────

export interface SendWhatsAppMessageOptions {
    recipientPhone: string
    recipientName?: string
    message: string
    mediaUrl?: string
    type: 'QUOTATION' | 'PAYMENT_RECEIPT' | 'PROJECT_DEADLINE' | 'SUBSCRIPTION_15D' | 'SUBSCRIPTION_7D' | 'CUSTOM'
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
    const apiKey = process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_TOKEN || ''
    const phoneNoId = process.env.WHATSAPP_PHONE_NO_ID || '1345340821990898'
    const isEnabled = process.env.WHATSAPP_ENABLED === 'true' || (Boolean(apiKey) && process.env.WHATSAPP_ENABLED !== 'false')

    console.log(`[WhatsApp] Dispatching ${options.type} message to ${cleanPhone} (Enabled: ${isEnabled})`)

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

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errText = await response.text().catch(() => response.statusText)
                throw new Error(`WoxAPI returned HTTP ${response.status}: ${errText}`)
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
 */
export const sendQuotationAlert = async (data: QuotationAlertPayload) => {
    const formattedBudget = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(data.budget)
    const serviceName = data.serviceType ? data.serviceType.replace(/_/g, ' ') : 'Software Solution'

    const message = 
`📄 *DUNGA TECHNOLOGIES — Project Quotation*

Dear *${data.clientName}*,

Thank you for choosing *Dunga Technologies*! We have generated your formal Estimation Proposal for:

🚀 *Project:* ${data.projectName}
🛠 *Service:* ${serviceName}
💰 *Estimated Budget:* ${formattedBudget}

${data.pdfUrl ? `📥 *View / Download Proposal PDF:*\n${data.pdfUrl}\n` : ''}
Our technical team is ready to commence work upon your approval. Please feel free to reply to this message if you have any questions or customization requests.

Warm Regards,  
*Dunga Technologies Support Team*  
🌐 www.dungatechnologies.com`

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 15)
    const validUntilFormatted = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(validUntil)
    const estNo = `EST-${Date.now().toString().slice(-6)}`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName: data.clientName,
        message,
        mediaUrl: data.pdfUrl || undefined,
        type: 'QUOTATION',
        referenceId: data.projectId,
        template: {
            name: 'estimation',
            language: 'en',
            headerDocumentUrl: data.pdfUrl || undefined,
            bodyParams: [
                data.clientName,
                data.projectName,
                estNo,
                data.budget.toLocaleString('en-IN'),
                validUntilFormatted
            ]
        }
    })
}

/**
 * 2. PAYMENT RECEIPT ALERT
 */
export const sendPaymentReceiptAlert = async (data: PaymentReceiptPayload) => {
    const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(data.amount)
    const formattedBalance = data.remainingBalance !== undefined
        ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(data.remainingBalance)
        : null

    const message = 
`✅ *PAYMENT CONFIRMATION — Dunga Technologies*

Dear *${data.clientName}*,

We have successfully received your payment. Here are the details:

📁 *Project:* ${data.projectName}
💵 *Amount Paid:* *${formattedAmount}*
💳 *Payment Mode:* ${data.paymentMethod}
${data.transactionId ? `🔖 *Transaction ID:* ${data.transactionId}\n` : ''}${formattedBalance ? `📊 *Remaining Project Balance:* ${formattedBalance}\n` : ''}
${data.receiptPdfUrl ? `🧾 *Download Official Receipt PDF:*\n${data.receiptPdfUrl}\n` : ''}
Thank you for your business!

Best Regards,  
*Accounts & Billing Desk*  
*Dunga Technologies*`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName: data.clientName,
        message,
        mediaUrl: data.receiptPdfUrl || undefined,
        type: 'PAYMENT_RECEIPT',
        referenceId: data.projectId
    })
}

/**
 * 3. PROJECT DEADLINE NOTICE
 */
export const sendProjectDeadlineReminder = async (data: DeadlineReminderPayload) => {
    const formattedDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(data.deadlineDate))

    const message = 
`⏰ *PROJECT MILESTONE & DEADLINE UPDATE*

Hello *${data.clientName}*,

This is a milestone update regarding your ongoing project with *Dunga Technologies*:

🚀 *Project:* ${data.projectName}
📅 *Target Delivery Date:* *${formattedDate}*
⏳ *Time Remaining:* *${data.daysRemaining} days*

Our engineering team is actively finalizing the milestones for deployment and quality assurance.

If you have any feedback or upcoming launch schedules to align, please contact your project manager.

Best Regards,  
*Project Delivery Team*  
*Dunga Technologies*`

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName: data.clientName,
        message,
        type: 'PROJECT_DEADLINE',
        referenceId: data.projectId
    })
}

/**
 * 4. SUBSCRIPTION EXPIRY REMINDER (15-Day & 7-Day Alert)
 */
export const sendSubscriptionRenewalReminder = async (data: SubscriptionReminderPayload) => {
    const formattedDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(data.renewalDate))
    const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(data.amount)

    const urgencyEmoji = data.daysRemaining <= 7 ? '🚨' : '⚠️'
    const reminderTier = data.daysRemaining <= 7 ? '7-Day Renewal Notice' : '15-Day Renewal Notice'

    const message = 
`${urgencyEmoji} *SUBSCRIPTION RENEWAL REMINDER (${reminderTier})*

Dear *${data.clientName}*,

Your subscription service with *Dunga Technologies* is due for upcoming renewal:

📦 *Subscription Plan:* ${data.subscriptionName}
${data.category ? `🏷 *Category:* ${data.category}\n` : ''}💳 *Renewal Fee:* *${formattedAmount}*
📅 *Renewal Date:* *${formattedDate}* (*${data.daysRemaining} days remaining*)

To ensure uninterrupted uptime, maintenance, and cloud services, kindly process your renewal prior to the due date.

Need assistance or an updated invoice? Reply to this message directly.

Sincerely,  
*Subscription Services Team*  
*Dunga Technologies*`

    const notifType = data.daysRemaining <= 7 ? 'SUBSCRIPTION_7D' : 'SUBSCRIPTION_15D'

    return sendWhatsAppMessage({
        recipientPhone: data.clientPhone,
        recipientName: data.clientName,
        message,
        type: notifType,
        referenceId: data.subscriptionId
    })
}
