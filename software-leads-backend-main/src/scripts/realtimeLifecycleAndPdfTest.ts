import prisma from '../lib/prisma'
import fs from 'fs'
import path from 'path'
import {
    buildEstimationPdfBuffer,
    buildPaymentReceiptPdfBuffer
} from '../lib/pdfGenerator'
import {
    uploadPdfBufferToLiveHost,
    sendAdvancePaymentReceived,
    sendPartPaymentUpdate,
    sendFinalEstimation,
    sendQuotationAlert,
    sendAdvancePaymentRequest,
    sendWorkStartAlert,
    sendDailyUpdate,
    sendPaymentReminder,
    sendFinalPaymentRequest,
    sendProjectCompleted,
    sendProjectDiscussionSummary,
    sendOnboardingAlert,
    sendCeoWelcomeMessage,
    sendServicesOverview
} from '../lib/whatsapp'

async function runRealtimeTest() {
    const targetPhone = '9723554357' // +91 9723554357
    console.log(`\n========================================================================`)
    console.log(`🚀 STARTING REAL-TIME CRM ENTRY & OFFICIAL PDF WHATSAPP TEST`)
    console.log(`Target Phone: +91 ${targetPhone}`)
    console.log(`========================================================================\n`)

    // ─── STEP 1: FETCH / UPDATE REAL CUSTOMER ENTRY ─────────────────────
    console.log('1. Ensuring real Customer entry in database...')
    let customer = await prisma.customer.findFirst({
        where: { phone: targetPhone }
    })

    if (!customer) {
        // Find existing customer or first lead
        const lead = await prisma.lead.findFirst()
        customer = await prisma.customer.create({
            data: {
                fullName: 'Om Changela',
                phone: targetPhone,
                email: 'changelaom@gmail.com',
                applicationNumber: 'APP-693529',
                serviceType: 'APP_WEB_DEVELOPMENT',
                status: 'ACTIVE',
                leadId: lead ? lead.id : 'f2416c3a-8848-47e7-9ad7-b046b92ac5de'
            }
        })
        console.log(`   ✓ Created customer: ${customer.fullName} (${customer.id})`)
    } else {
        customer = await prisma.customer.update({
            where: { id: customer.id },
            data: {
                fullName: 'Om Changela',
                applicationNumber: 'APP-693529',
                status: 'ACTIVE'
            }
        })
        console.log(`   ✓ Found & updated customer: ${customer.fullName} (${customer.id})`)
    }

    // ─── STEP 2: UPSERT REAL PROJECT ENTRY ──────────────────────────────
    console.log('2. Ensuring real Project entry in database...')
    const projectName = 'Dunga CRM & Mobile Portal Platform'
    const totalBudget = 185000

    const payments = [
        { amount: 46250, description: 'Advance Booking Token (25%)' },
        { amount: 55500, description: 'Milestone 2 - Design & Core Architecture (30%)' },
        { amount: 46250, description: 'Milestone 3 - Web Portal & Integration (25%)' },
        { amount: 37000, description: 'Final Delivery & Store Deployment (20%)' }
    ]

    const schedules = [
        { id: 'sch-adv', description: 'Advance Booking Token (25%)', payment: 46250, paid: 46250, status: 'completed' },
        { id: 'sch-m2', description: 'Milestone 2 - Design & Core Architecture (30%)', payment: 55500, paid: 55500, status: 'completed' },
        { id: 'sch-m3', description: 'Milestone 3 - Web Portal & Integration (25%)', payment: 46250, paid: 0, status: 'pending' },
        { id: 'sch-m4', description: 'Final Delivery & Store Deployment (20%)', payment: 37000, paid: 0, status: 'pending' }
    ]

    const timelines = [
        { description: 'UI/UX Design & Requirement Sign-off', workingDays: 7 },
        { description: 'Backend & Database Architecture', workingDays: 14 },
        { description: 'Frontend Web & Admin Portal', workingDays: 14 },
        { description: 'Mobile App Development & Beta Testing', workingDays: 10 },
        { description: 'UAT & Production Deployment', workingDays: 5 }
    ]

    let project = await prisma.project.findFirst({
        where: { customerId: customer.id }
    })

    if (!project) {
        project = await prisma.project.create({
            data: {
                customerId: customer.id,
                projectName,
                serviceType: 'APP_WEB_DEVELOPMENT',
                status: 'ACTIVE',
                budget: totalBudget,
                description: 'Custom Enterprise Multi-Role Software Solution with Next.js, Node.js, WhatsApp Automation, and Mobile App.',
                webOverview: [
                    'Next.js 16 App Router Portal with Tailwind CSS v4',
                    'Super Admin, Telecaller, and Developer Portal Dashboards',
                    'Dynamic PDF Quotation, Contract, and Receipt Generation Engine',
                    'WoxAPI WhatsApp Business Automation Integration'
                ],
                payments,
                schedules,
                timelines
            }
        })
        console.log(`   ✓ Created project: "${project.projectName}" (${project.id})`)
    } else {
        project = await prisma.project.update({
            where: { id: project.id },
            data: {
                projectName,
                budget: totalBudget,
                payments,
                schedules,
                timelines,
                status: 'ACTIVE'
            }
        })
        console.log(`   ✓ Found & updated project: "${project.projectName}" (${project.id})`)
    }

    // ─── STEP 3: UPSERT REAL PAYMENT TRANSACTIONS ────────────────────────
    console.log('3. Ensuring real FinanceTransaction entries in database...')
    const existingTxns = await prisma.financeTransaction.findMany({
        where: { projectId: project.id }
    })

    let advTxn = existingTxns.find(t => t.note?.includes('Advance'))
    if (!advTxn) {
        advTxn = await prisma.financeTransaction.create({
            data: {
                projectId: project.id,
                amount: 46250,
                paymentMethod: 'UPI',
                paymentDate: new Date('2026-09-24T10:30:00Z'),
                transactionId: 'UPI-DT-9823412093',
                note: 'Advance Token Payment Received',
                allocations: [{ id: 'sch-adv', description: 'Advance Booking Token (25%)', amount: 46250 }]
            }
        })
        console.log(`   ✓ Created Advance Transaction: REC-${advTxn.id.split('-')[0].toUpperCase()} (₹46,250)`)
    } else {
        console.log(`   ✓ Existing Advance Transaction: REC-${advTxn.id.split('-')[0].toUpperCase()} (₹${advTxn.amount})`)
    }

    let partTxn = existingTxns.find(t => t.note?.includes('Milestone 2'))
    if (!partTxn) {
        partTxn = await prisma.financeTransaction.create({
            data: {
                projectId: project.id,
                amount: 55500,
                paymentMethod: 'BANK_TRANSFER',
                paymentDate: new Date('2026-09-25T11:00:00Z'),
                transactionId: 'NEFT-HDFC-09823411',
                note: 'Milestone 2 Payment Received',
                allocations: [{ id: 'sch-m2', description: 'Milestone 2 - Design & Core Architecture (30%)', amount: 55500 }]
            }
        })
        console.log(`   ✓ Created Part Payment Transaction: REC-${partTxn.id.split('-')[0].toUpperCase()} (₹55,500)`)
    } else {
        console.log(`   ✓ Existing Part Payment Transaction: REC-${partTxn.id.split('-')[0].toUpperCase()} (₹${partTxn.amount})`)
    }

    // ─── STEP 4: GENERATE OFFICIAL REAL DUNGA TECHNOLOGIES PDFs ──────────
    console.log('\n4. Generating Real PDFs in official Dunga Technologies formats...')
    const outputDir = path.join(__dirname, '../../test_output_pdfs')
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    // A) Official Estimation Proposal PDF
    console.log('   Generating Estimation Proposal PDF (buildEstimationPdfBuffer)...')
    const estimationPdfBuffer = await buildEstimationPdfBuffer(project)
    const estimationFileName = `Estimation_${customer.fullName.replace(/\s+/g, '_')}_${Date.now()}.pdf`
    fs.writeFileSync(path.join(outputDir, estimationFileName), estimationPdfBuffer)
    console.log(`   ✓ Saved: ${estimationFileName} (${estimationPdfBuffer.length} bytes)`)

    // B) Official Advance Payment Receipt PDF
    console.log('   Generating Advance Payment Receipt PDF (buildPaymentReceiptPdfBuffer)...')
    const advReceiptNo = 'REC-' + advTxn.id.split('-')[0].toUpperCase()
    const advanceReceiptPdfBuffer = await buildPaymentReceiptPdfBuffer({
        receiptNo: advReceiptNo,
        date: advTxn.paymentDate,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerEmail: customer.email || undefined,
        applicationNumber: customer.applicationNumber || undefined,
        projectName: project.projectName,
        paymentDescription: 'Advance Booking Token (25%)',
        amountPaid: 46250,
        totalBudget,
        totalPaid: 46250,
        remainingBalance: 138750,
        paymentMethod: 'UPI',
        transactionId: advTxn.transactionId || undefined,
        note: advTxn.note || undefined,
        schedules
    })
    const advReceiptFileName = `Receipt_Advance_${advReceiptNo}.pdf`
    fs.writeFileSync(path.join(outputDir, advReceiptFileName), advanceReceiptPdfBuffer)
    console.log(`   ✓ Saved: ${advReceiptFileName} (${advanceReceiptPdfBuffer.length} bytes)`)

    // C) Official Part Payment Receipt PDF
    console.log('   Generating Part Payment Receipt PDF (buildPaymentReceiptPdfBuffer)...')
    const partReceiptNo = 'REC-' + partTxn.id.split('-')[0].toUpperCase()
    const partReceiptPdfBuffer = await buildPaymentReceiptPdfBuffer({
        receiptNo: partReceiptNo,
        date: partTxn.paymentDate,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerEmail: customer.email || undefined,
        applicationNumber: customer.applicationNumber || undefined,
        projectName: project.projectName,
        paymentDescription: 'Milestone 2 - Design & Core Architecture (30%)',
        amountPaid: 55500,
        totalBudget,
        totalPaid: 101750,
        remainingBalance: 83250,
        paymentMethod: 'Bank Transfer (NEFT)',
        transactionId: partTxn.transactionId || undefined,
        note: partTxn.note || undefined,
        schedules
    })
    const partReceiptFileName = `Receipt_PartPayment_${partReceiptNo}.pdf`
    fs.writeFileSync(path.join(outputDir, partReceiptFileName), partReceiptPdfBuffer)
    console.log(`   ✓ Saved: ${partReceiptFileName} (${partReceiptPdfBuffer.length} bytes)`)

    // ─── STEP 5: UPLOAD REAL PDFs TO HOST ────────────────────────────────
    console.log('\n5. Uploading Real PDFs to obtain public HTTPS download URLs for WhatsApp Cloud API...')
    const estimationUrl = await uploadPdfBufferToLiveHost(estimationPdfBuffer, estimationFileName)
    console.log(`   ✓ Estimation PDF Live URL : ${estimationUrl}`)

    const advanceReceiptUrl = await uploadPdfBufferToLiveHost(advanceReceiptPdfBuffer, advReceiptFileName)
    console.log(`   ✓ Advance Receipt Live URL: ${advanceReceiptUrl}`)

    const partReceiptUrl = await uploadPdfBufferToLiveHost(partReceiptPdfBuffer, partReceiptFileName)
    console.log(`   ✓ Part Receipt Live URL   : ${partReceiptUrl}`)

    // ─── STEP 6: DISPATCH REAL WHATSAPP TEMPLATES WITH REAL PDFs ─────────
    console.log('\n========================================================================')
    console.log('6. DISPATCHING OFFICIAL WHATSAPP TEMPLATES WITH REAL DATA & ATTACHMENTS')
    console.log('========================================================================\n')

    const results: Array<{ name: string; template: string; status: string; info: string }> = []

    // 1. Initial Estimation (Template: estimation, en, Document Header with Real PDF)
    console.log('👉 [1/6] Sending "estimation" with Real Project Estimation Proposal PDF...')
    const r1 = await sendQuotationAlert({
        clientPhone: targetPhone,
        clientName:  customer.fullName,
        projectName: project.projectName,
        budget:      totalBudget,
        pdfUrl:      estimationUrl,
        projectId:   project.id
    })
    results.push({ name: 'Estimation Proposal', template: 'estimation (1435652518531910)', status: r1.success ? '✅ SUCCESS' : '❌ FAILED', info: estimationUrl })
    await new Promise(r => setTimeout(r, 6000))

    // 2. Advance Payment Request (Template: advancepaymentrequest, en_GB, Text)
    console.log('👉 [2/6] Sending "advancepaymentrequest" with Real Project Amount ₹46,250...')
    const r2 = await sendAdvancePaymentRequest({
        clientPhone: targetPhone,
        clientName:  customer.fullName,
        amount:      46250,
        paymentLink: `https://dunga-crm.vercel.app/pay/${customer.applicationNumber}`,
        projectName: project.projectName,
        projectId:   project.id
    })
    results.push({ name: 'Advance Payment Request', template: 'advancepaymentrequest (1790635345737589)', status: r2.success ? '✅ SUCCESS' : '❌ FAILED', info: 'Amount: ₹46,250' })
    await new Promise(r => setTimeout(r, 6000))

    // 3. Advance Payment Received & Verified (Template: advancepaymentreceived, en, Document Header with Real Receipt PDF)
    console.log('👉 [3/6] Sending "advancepaymentreceived" with Real Advance Payment Receipt PDF...')
    const r3 = await sendAdvancePaymentReceived({
        clientPhone:   targetPhone,
        clientName:    customer.fullName,
        amount:        46250,
        projectName:   project.projectName,
        receiptPdfUrl: advanceReceiptUrl,
        projectId:     project.id
    })
    results.push({ name: 'Advance Payment Confirmed', template: 'advancepaymentreceived (2332140994285886)', status: r3.success ? '✅ SUCCESS' : '❌ FAILED', info: advanceReceiptUrl })
    await new Promise(r => setTimeout(r, 6000))

    // 4. Final Estimation (Template: final_estimation, en, Document Header with Real Final Estimation PDF)
    console.log('👉 [4/6] Sending "final_estimation" with Real Final Estimation PDF...')
    const r4 = await sendFinalEstimation({
        clientPhone:  targetPhone,
        clientName:   customer.fullName,
        projectName:  project.projectName,
        estimationNo: customer.applicationNumber || 'EST-693529',
        finalAmount:  totalBudget,
        deliveryDate: '45 Working Days',
        pdfUrl:       estimationUrl,
        projectId:    project.id
    })
    results.push({ name: 'Final Estimation PDF', template: 'final_estimation (1810100450167250)', status: r4.success ? '✅ SUCCESS' : '❌ FAILED', info: estimationUrl })
    await new Promise(r => setTimeout(r, 6000))

    // 5. Part Payment / Milestone Payment Update (Template: partpayment / fallback, en, Document Header with Real Part Receipt PDF)
    console.log('👉 [5/6] Sending "partpayment" with Real Milestone Payment Receipt PDF...')
    const r5 = await sendPartPaymentUpdate({
        clientPhone:      targetPhone,
        clientName:       customer.fullName,
        projectName:      project.projectName,
        totalAmount:      totalBudget,
        previousPaid:     46250,
        currentReceived:  55500,
        totalPaid:        101750,
        pendingAmount:    83250,
        paymentStatus:    'Partially Paid (55% Cleared)',
        remainingBalance: 83250,
        receiptPdfUrl:    partReceiptUrl,
        projectId:        project.id
    })
    results.push({ name: 'Part Payment Update', template: 'partpayment (1769963584332662)', status: r5.success ? '✅ SUCCESS' : '❌ FAILED', info: partReceiptUrl })
    await new Promise(r => setTimeout(r, 6000))

    // 6. Daily Project Update (Template: dailyupdate, en_GB, Text)
    console.log('👉 [6/6] Sending "dailyupdate" with Real Project Activities...')
    const r6 = await sendDailyUpdate({
        clientPhone:   targetPhone,
        clientName:    customer.fullName,
        projectName:   project.projectName,
        activity1:     'Architecture & Database Schema Optimization Completed',
        activity2:     'Real-time WhatsApp Meta Cloud API Integration Deployed',
        activity3:     'Payment Ledger & PDF Receipt Engine Synchronized',
        currentStatus: 'Active Development (Sprint 2 - 55% Progress)',
        projectId:     project.id
    })
    results.push({ name: 'Daily Progress Update', template: 'dailyupdate (1435173415154144)', status: r6.success ? '✅ SUCCESS' : '❌ FAILED', info: 'Activities 1, 2, 3' })

    // ─── SUMMARY TABLE ──────────────────────────────────────────────────
    console.log('\n========================================================================')
    console.log('📊 REAL-TIME PDF DISPATCH TEST REPORT')
    console.log('========================================================================')
    console.table(results)
    console.log('========================================================================\n')
}

runRealtimeTest()
    .then(() => prisma.$disconnect())
    .catch(err => {
        console.error('Fatal error during realtime test:', err)
        prisma.$disconnect()
        process.exit(1)
    })
