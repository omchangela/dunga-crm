/**
 * testAllTemplates.ts
 * ─────────────────────────────────────────────────────────────────
 * Sends ALL WhatsApp notification templates to the test number.
 * Templates tested:
 *   1. QUOTATION         → sendQuotationAlert          (template: estimation)
 *   2. PAYMENT_RECEIPT   → sendPaymentReceiptAlert      (text message)
 *   3. PROJECT_DEADLINE  → sendProjectDeadlineReminder  (text message)
 *   4. SUBSCRIPTION_15D  → sendSubscriptionRenewalReminder (15 days)
 *   5. SUBSCRIPTION_7D   → sendSubscriptionRenewalReminder (7 days)
 *   6. DISCUSSION        → sendProjectDiscussionSummary (template: project_discussion_summary)
 *
 * Run: npx ts-node src/scripts/testAllTemplates.ts
 */

import {
    sendQuotationAlert,
    sendPaymentReceiptAlert,
    sendProjectDeadlineReminder,
    sendSubscriptionRenewalReminder,
    sendProjectDiscussionSummary
} from '../lib/whatsapp'

const TEST_PHONE = '9723554357'   // +91 9723554357
const TEST_NAME  = 'Om Changela'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const log = (label: string, result: { success: boolean; error?: string }) => {
    const status = result.success ? '✅ SUCCESS' : `❌ FAILED — ${result.error}`
    console.log(`  ${label}: ${status}`)
}

async function runAllTests() {
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║   🧪  DUNGA CRM — WhatsApp Template Full Test Suite      ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log(`📱 Sending all templates to: +91 ${TEST_PHONE}\n`)

    // ─── 1. QUOTATION / ESTIMATION PROPOSAL ────────────────────────
    console.log('━━━ [1/6] QUOTATION — estimation template ━━━')
    const r1 = await sendQuotationAlert({
        clientPhone:  TEST_PHONE,
        clientName:   TEST_NAME,
        projectName:  'Dunga CRM — Full Stack SaaS Platform',
        budget:       250000,
        serviceType:  'WEB_DEVELOPMENT',
        pdfUrl:       'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        projectId:    'test-proj-001'
    })
    log('Template: estimation', r1)
    await sleep(3000)

    // ─── 2. PAYMENT RECEIPT ─────────────────────────────────────────
    console.log('\n━━━ [2/6] PAYMENT RECEIPT — text message ━━━')
    const r2 = await sendPaymentReceiptAlert({
        clientPhone:      TEST_PHONE,
        clientName:       TEST_NAME,
        projectName:      'Dunga CRM — Full Stack SaaS Platform',
        amount:           75000,
        paymentMethod:    'UPI',
        transactionId:    'TXN20260924001',
        remainingBalance: 175000,
        receiptPdfUrl:    null,
        projectId:        'test-proj-001'
    })
    log('Payment Receipt', r2)
    await sleep(3000)

    // ─── 3. PROJECT DEADLINE REMINDER ──────────────────────────────
    console.log('\n━━━ [3/6] PROJECT DEADLINE REMINDER — text message ━━━')
    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 14)
    const r3 = await sendProjectDeadlineReminder({
        clientPhone:   TEST_PHONE,
        clientName:    TEST_NAME,
        projectName:   'Dunga CRM — Full Stack SaaS Platform',
        deadlineDate:  deadline,
        daysRemaining: 14,
        projectId:     'test-proj-001'
    })
    log('Project Deadline Reminder', r3)
    await sleep(3000)

    // ─── 4. SUBSCRIPTION RENEWAL — 15-Day ──────────────────────────
    console.log('\n━━━ [4/6] SUBSCRIPTION RENEWAL (15-Day) — text message ━━━')
    const renewal15 = new Date()
    renewal15.setDate(renewal15.getDate() + 15)
    const r4 = await sendSubscriptionRenewalReminder({
        clientPhone:      TEST_PHONE,
        clientName:       TEST_NAME,
        subscriptionName: 'Premium Hosting & Maintenance Plan',
        amount:           12000,
        renewalDate:      renewal15,
        daysRemaining:    15,
        category:         'Hosting',
        subscriptionId:   'sub-test-001'
    })
    log('Subscription Renewal (15-Day)', r4)
    await sleep(3000)

    // ─── 5. SUBSCRIPTION RENEWAL — 7-Day ───────────────────────────
    console.log('\n━━━ [5/6] SUBSCRIPTION RENEWAL (7-Day) — text message ━━━')
    const renewal7 = new Date()
    renewal7.setDate(renewal7.getDate() + 7)
    const r5 = await sendSubscriptionRenewalReminder({
        clientPhone:      TEST_PHONE,
        clientName:       TEST_NAME,
        subscriptionName: 'Premium Hosting & Maintenance Plan',
        amount:           12000,
        renewalDate:      renewal7,
        daysRemaining:    7,
        category:         'Hosting',
        subscriptionId:   'sub-test-002'
    })
    log('Subscription Renewal (7-Day)', r5)
    await sleep(3000)

    // ─── 6. PROJECT DISCUSSION SUMMARY ─────────────────────────────
    console.log('\n━━━ [6/6] DISCUSSION SUMMARY — project_discussion_summary template ━━━')
    const r6 = await sendProjectDiscussionSummary({
        clientPhone:    TEST_PHONE,
        clientName:     TEST_NAME,
        projectSummary: 'Dunga CRM — Full-stack SaaS with Next.js frontend, Node.js + Prisma backend, WhatsApp Business API automation, lead tracking, project management, employee roles, estimation PDF generation, and payment tracking.',
        projectId:      'test-proj-001'
    })
    log('Template: project_discussion_summary', r6)

    // ─── SUMMARY ────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════════════════╗')
    console.log('║                   🏁  TEST COMPLETE                      ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    const allResults = [r1, r2, r3, r4, r5, r6]
    const passed = allResults.filter(r => r.success).length
    console.log(`Result: ${passed} / ${allResults.length} templates sent successfully`)
    if (passed < allResults.length) {
        console.log('❌ Some templates failed — check the logs above for details.')
        process.exit(1)
    }
}

runAllTests().catch(err => {
    console.error('💥 Unexpected fatal error:', err)
    process.exit(1)
})
