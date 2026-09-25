/**
 * testAllTemplates.ts
 * ─────────────────────────────────────────────────────────────────
 * Comprehensive test script that validates and sends ALL 14 Meta
 * approved WhatsApp templates to the specified phone number.
 *
 * Run:
 *   cd software-leads-backend-main && npx ts-node -r dotenv/config src/scripts/testAllTemplates.ts 9723554357
 */

import 'dotenv/config'
import prisma from '../lib/prisma'
import {
    sendOnboardingAlert,
    sendCeoWelcomeMessage,
    sendServicesOverview,
    sendProjectDiscussionSummary,
    sendAdvancePaymentRequest,
    sendAdvancePaymentReceived,
    sendWorkStartAlert,
    sendDailyUpdate,
    sendPaymentReminder,
    sendFinalPaymentRequest,
    sendFinalEstimation,
    sendProjectCompleted,
    sendQuotationAlert,
    sendPartPaymentUpdate
} from '../lib/whatsapp'

const TEST_PHONE = process.argv[2] || '9723554357' // +91 9723554357
const TEST_NAME  = 'Om Changela'
const PROJECT_NAME = 'E-Commerce Marketplace & Web Platform'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const logResult = (num: number, name: string, templateId: string, result: { success: boolean; error?: string }) => {
    const icon = result.success ? '✅' : '❌'
    const status = result.success ? 'ACCEPTED (Delivered)' : `FAILED: ${result.error}`
    console.log(`[${num}/14] ${icon} Template: ${name.padEnd(28)} (ID: ${templateId}) -> ${status}`)
}

async function run() {
    console.log('\n╔══════════════════════════════════════════════════════════════════════════╗')
    console.log('║        🧪  DUNGA TECHNOLOGIES — 14 WHATSAPP TEMPLATES TEST SUITE          ║')
    console.log('╚══════════════════════════════════════════════════════════════════════════╝')
    console.log(`📱 Recipient Number : +91 ${TEST_PHONE}`)
    console.log(`👤 Client Name      : ${TEST_NAME}`)
    console.log(`🏢 Phone Number ID  : ${process.env.WHATSAPP_PHONE_NO_ID || '1381643891694755'}\n`)

    const results: { name: string; success: boolean }[] = []

    // 1. ONBOARDING WELCOME
    const r1 = await sendOnboardingAlert({
        clientPhone: TEST_PHONE,
        clientName:  TEST_NAME,
        customerId:  'test-cust-001'
    })
    logResult(1, 'onbording', '986552707801702', r1)
    results.push({ name: 'onbording', success: r1.success })
    await sleep(750)

    // 2. CEO WELCOME MESSAGE
    const r2 = await sendCeoWelcomeMessage({
        clientPhone: TEST_PHONE,
        clientName:  TEST_NAME,
        customerId:  'test-cust-001'
    })
    logResult(2, 'ceomessage', '835823276255523', r2)
    results.push({ name: 'ceomessage', success: r2.success })
    await sleep(750)

    // 3. SERVICES OVERVIEW
    const r3 = await sendServicesOverview({
        clientPhone: TEST_PHONE,
        clientName:  TEST_NAME
    })
    logResult(3, 'services', '27878092548536327', r3)
    results.push({ name: 'services', success: r3.success })
    await sleep(750)

    // 4. PROJECT DISCUSSION SUMMARY
    const r4 = await sendProjectDiscussionSummary({
        clientPhone:    TEST_PHONE,
        clientName:     TEST_NAME,
        projectSummary: 'Full-stack Web and Mobile CRM application with automated WhatsApp client triggers and billing.',
        projectId:      'test-proj-001'
    })
    logResult(4, 'project_discussion_summary', '1058678607001419', r4)
    results.push({ name: 'project_discussion_summary', success: r4.success })
    await sleep(750)

    // 5. ADVANCE PAYMENT REQUEST
    const r5 = await sendAdvancePaymentRequest({
        clientPhone: TEST_PHONE,
        clientName:  TEST_NAME,
        amount:      35000,
        paymentLink: 'https://rzp.io/l/dunga-advance',
        projectName: PROJECT_NAME,
        projectId:   'test-proj-001'
    })
    logResult(5, 'advancepaymentrequest', '1790635345737589', r5)
    results.push({ name: 'advancepaymentrequest', success: r5.success })
    await sleep(750)

    // 6. ADVANCE PAYMENT RECEIVED & VERIFIED (PDF)
    const r6 = await sendAdvancePaymentReceived({
        clientPhone:   TEST_PHONE,
        clientName:    TEST_NAME,
        amount:        35000,
        projectName:   PROJECT_NAME,
        receiptPdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        projectId:     'test-proj-001'
    })
    logResult(6, 'advancepaymentreceived', '2332140994285886', r6)
    results.push({ name: 'advancepaymentreceived', success: r6.success })
    await sleep(750)

    // 7. WORK START NOTIFICATION
    const r7 = await sendWorkStartAlert({
        clientPhone: TEST_PHONE,
        clientName:  TEST_NAME,
        projectName: PROJECT_NAME,
        projectId:   'test-proj-001'
    })
    logResult(7, 'workstart', '2188927028356940', r7)
    results.push({ name: 'workstart', success: r7.success })
    await sleep(750)

    // 8. DAILY PROGRESS UPDATE
    const r8 = await sendDailyUpdate({
        clientPhone:   TEST_PHONE,
        clientName:    TEST_NAME,
        projectName:   PROJECT_NAME,
        activity1:     'Frontend UI/UX Architecture & Responsive Dashboard',
        activity2:     'User Auth, OTP Verification & Database Models',
        activity3:     'Product Catalog API Endpoints & State Management',
        currentStatus: 'In Progress (50% Milestones Completed)',
        projectId:     'test-proj-001'
    })
    logResult(8, 'dailyupdate', '1435173415154144', r8)
    results.push({ name: 'dailyupdate', success: r8.success })
    await sleep(750)

    // 9. PAYMENT REMINDER
    const r9 = await sendPaymentReminder({
        clientPhone:   TEST_PHONE,
        clientName:    TEST_NAME,
        pendingAmount: 35000,
        paymentLink:   'https://rzp.io/l/dunga-pending',
        projectId:     'test-proj-001'
    })
    logResult(9, 'paymentreminder', '2367183174020523', r9)
    results.push({ name: 'paymentreminder', success: r9.success })
    await sleep(750)

    // 10. FINAL PAYMENT REQUEST
    const r10 = await sendFinalPaymentRequest({
        clientPhone:    TEST_PHONE,
        clientName:     TEST_NAME,
        finalDueAmount: 35000,
        paymentLink:    'https://rzp.io/l/dunga-final',
        projectId:      'test-proj-001'
    })
    logResult(10, 'finalpayment', '1609866433967195', r10)
    results.push({ name: 'finalpayment', success: r10.success })
    await sleep(750)

    // 11. FINAL ESTIMATION (PDF)
    const r11 = await sendFinalEstimation({
        clientPhone:  TEST_PHONE,
        clientName:   TEST_NAME,
        projectName:  PROJECT_NAME,
        estimationNo: 'EST-2026-9021',
        finalAmount:  70000,
        deliveryDate: '20 Oct 2026',
        pdfUrl:       'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        projectId:    'test-proj-001'
    })
    logResult(11, 'final_estimation', '1810100450167250', r11)
    results.push({ name: 'final_estimation', success: r11.success })
    await sleep(750)

    // 12. PROJECT COMPLETED
    const r12 = await sendProjectCompleted({
        clientPhone: TEST_PHONE,
        clientName:  TEST_NAME,
        projectName: PROJECT_NAME,
        projectId:   'test-proj-001'
    })
    logResult(12, 'projectcomlated', '950715120843668', r12)
    results.push({ name: 'projectcomlated', success: r12.success })
    await sleep(750)

    // 13. INITIAL ESTIMATION QUOTATION (PDF)
    const r13 = await sendQuotationAlert({
        clientPhone: TEST_PHONE,
        clientName:  TEST_NAME,
        projectName: PROJECT_NAME,
        budget:      70000,
        pdfUrl:      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        projectId:   'test-proj-001'
    })
    logResult(13, 'estimation', '1435652518531910', r13)
    results.push({ name: 'estimation', success: r13.success })
    await sleep(750)

    // 14. PART PAYMENT CONFIRMATION (PDF)
    const r14 = await sendPartPaymentUpdate({
        clientPhone:      TEST_PHONE,
        clientName:       TEST_NAME,
        projectName:      PROJECT_NAME,
        totalAmount:      70000,
        previousPaid:     35000,
        currentReceived:  17500,
        totalPaid:        52500,
        pendingAmount:    17500,
        paymentStatus:    'Partially Paid',
        remainingBalance: 17500,
        receiptPdfUrl:    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        projectId:        'test-proj-001'
    })
    logResult(14, 'partpayment', '1769963584332662', r14)
    results.push({ name: 'partpayment', success: r14.success })

    // Summary
    const successful = results.filter(r => r.success).length
    console.log('\n══════════════════════════════════════════════════════════════════════════')
    console.log(`🏁 Full Suite Test Completed: ${successful} / 14 Templates Succeeded`)
    console.log('══════════════════════════════════════════════════════════════════════════\n')
}

run()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
