import 'dotenv/config'
import {
    sanitizePhoneNumber,
    sendQuotationAlert,
    sendPaymentReceiptAlert,
    sendProjectDeadlineReminder,
    sendSubscriptionRenewalReminder
} from '../lib/whatsapp'
import prisma from '../lib/prisma'

async function runTest() {
    console.log('🧪 Starting WhatsApp Notification System Tests...\n')

    // 1. Phone number normalization test
    console.log('--- Test 1: Phone Sanitization ---')
    const phoneTests = [
        { input: '9876543210', expected: '919876543210' },
        { input: '+91 98765 43210', expected: '919876543210' },
        { input: '09876543210', expected: '919876543210' },
        { input: '+91-9876-543-210', expected: '919876543210' }
    ]

    for (const test of phoneTests) {
        const cleaned = sanitizePhoneNumber(test.input)
        const pass = cleaned === test.expected
        console.log(`${pass ? '✓' : '✗'} Input: "${test.input}" -> "${cleaned}" (Expected: "${test.expected}")`)
    }

    const testPhone = '9876543210'
    const testClient = 'Harikrishna Dunga'

    // 2. Quotation Alert Test
    console.log('\n--- Test 2: Quotation Created Alert ---')
    const res1 = await sendQuotationAlert({
        clientPhone: testPhone,
        clientName: testClient,
        projectName: 'Enterprise ERP & Mobile App Suite',
        budget: 150000,
        serviceType: 'APP_WEB_DEVELOPMENT',
        pdfUrl: 'https://dungatechnologies.com/sample_quotation.pdf'
    })
    console.log('Quotation Alert Result:', res1)

    // 3. Payment Receipt Alert Test
    console.log('\n--- Test 3: Payment Receipt Alert ---')
    const res2 = await sendPaymentReceiptAlert({
        clientPhone: testPhone,
        clientName: testClient,
        projectName: 'Enterprise ERP & Mobile App Suite',
        amount: 50000,
        paymentMethod: 'UPI',
        transactionId: 'UPI-20260912-984721',
        remainingBalance: 100000,
        receiptPdfUrl: 'https://dungatechnologies.com/sample_receipt.pdf'
    })
    console.log('Payment Receipt Alert Result:', res2)

    // 4. Project Deadline Reminder Test
    console.log('\n--- Test 4: Project Deadline Reminder ---')
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 7)
    const res3 = await sendProjectDeadlineReminder({
        clientPhone: testPhone,
        clientName: testClient,
        projectName: 'Enterprise ERP & Mobile App Suite',
        deadlineDate: targetDate,
        daysRemaining: 7
    })
    console.log('Deadline Reminder Result:', res3)

    // 5. Subscription Renewal 15-Day Reminder Test
    console.log('\n--- Test 5: Subscription 15-Day Renewal Reminder ---')
    const subDate15 = new Date()
    subDate15.setDate(subDate15.getDate() + 15)
    const res4 = await sendSubscriptionRenewalReminder({
        clientPhone: testPhone,
        clientName: testClient,
        subscriptionName: 'Cloud Server Hosting & Maintenance Pro',
        amount: 4999,
        renewalDate: subDate15,
        daysRemaining: 15,
        category: 'Server Maintenance'
    })
    console.log('Subscription 15d Reminder Result:', res4)

    // 6. Subscription Renewal 7-Day Reminder Test
    console.log('\n--- Test 6: Subscription 7-Day Renewal Reminder ---')
    const subDate7 = new Date()
    subDate7.setDate(subDate7.getDate() + 7)
    const res5 = await sendSubscriptionRenewalReminder({
        clientPhone: testPhone,
        clientName: testClient,
        subscriptionName: 'CRM Software Annual License & Support',
        amount: 14999,
        renewalDate: subDate7,
        daysRemaining: 7,
        category: 'Software License'
    })
    console.log('Subscription 7d Reminder Result:', res5)

    // 7. Verify Database Audit Logs
    console.log('\n--- Test 7: Database Audit Logs in WhatsAppNotificationLog ---')
    const logs = await prisma.whatsAppNotificationLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    })
    console.log(`Found ${logs.length} logged WhatsApp dispatch records:`)
    for (const log of logs) {
        console.log(`- [${log.type}] To: ${log.recipientPhone} | Status: ${log.status} | Time: ${log.sentAt.toISOString()}`)
    }

    console.log('\n🎉 All WhatsApp tests executed successfully!')
}

runTest()
    .catch(e => {
        console.error('Test failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
