import 'dotenv/config'
import prisma from '../lib/prisma'
import { buildEstimationPdfBuffer } from '../lib/pdfGenerator'
import { sendQuotationAlert } from '../lib/whatsapp'
import fs from 'fs'
import path from 'path'

async function run() {
    const targetPhone = '9723554357'
    const clientName = 'Om Changela'
    const clientEmail = 'changelaom@gmail.com'

    console.log('\n======================================================================')
    console.log('🧪 TESTING "PROJECT TRACKING SECTION" -> ESTIMATION PDF VIA WHATSAPP')
    console.log(`📱 Recipient Phone: +91 ${targetPhone}`)
    console.log(`👤 Client Name    : ${clientName}`)
    console.log(`📑 Meta Template  : estimation (ID: 1435652518531910)`)
    console.log('======================================================================\n')

    // 1. Ensure Customer exists
    let customer = await prisma.customer.findFirst({
        where: { phone: targetPhone }
    })

    if (!customer) {
        let lead = await prisma.lead.findFirst({ where: { phone: targetPhone } })
        if (!lead) {
            lead = await prisma.lead.create({
                data: {
                    fullName: clientName,
                    phone: targetPhone,
                    email: clientEmail,
                    serviceType: 'APP_WEB_DEVELOPMENT',
                    source: 'CLIENT_REFERENCE',
                    status: 'CONVERTED'
                }
            })
        }
        const appNo = `APP-${Date.now().toString().slice(-6)}`
        customer = await prisma.customer.create({
            data: {
                leadId: lead.id,
                fullName: clientName,
                phone: targetPhone,
                email: clientEmail,
                serviceType: 'APP_WEB_DEVELOPMENT',
                applicationNumber: appNo,
                status: 'ACTIVE'
            }
        })
        console.log(`✓ Customer created: ${customer.id}`)
    } else {
        console.log(`✓ Existing customer found: ${customer.id} (${customer.fullName})`)
    }

    // 2. Simulate filling "Project Tracking Section" form
    const projectName = 'Dunga CRM & Mobile Automation Platform'
    const payments = [
        { description: 'Architecture & UI/UX Figma Design', amount: 40000 },
        { description: 'Backend API & Database Development', amount: 55000 },
        { description: 'Web Frontend & Mobile App Build', amount: 65000 }
    ]
    const timelines = [
        { description: 'UI/UX & Architecture Sign-off', workingDays: 7 },
        { description: 'Backend & Core Business Modules', workingDays: 14 },
        { description: 'Web Frontend & Mobile App Testing', workingDays: 14 }
    ]
    const schedules = [
        { description: 'Advance Booking Token (25%)', payment: 40000, paid: 0, status: 'pending' },
        { description: 'Milestone 2 - Core Engine (35%)', payment: 56000, paid: 0, status: 'pending' },
        { description: 'Final Delivery & Handover (40%)', payment: 64000, paid: 0, status: 'pending' }
    ]
    const budget = payments.reduce((sum, p) => sum + p.amount, 0)

    const project = await prisma.project.create({
        data: {
            customerId: customer.id,
            projectName,
            description: 'Custom Enterprise Multi-Role Software Solution with Next.js, Node.js, and WhatsApp Meta Cloud Automation.',
            serviceType: 'APP_WEB_DEVELOPMENT',
            status: 'PENDING',
            budget,
            webOverview: [
                'Next.js 16 App Router Portal with Tailwind CSS v4',
                'Super Admin, Telecaller, and Developer Portal Dashboards',
                'Dynamic PDF Quotation, Contract, and Receipt Generation Engine'
            ],
            appOverview: [
                'Cross-platform Flutter / React Native Mobile Application',
                'Real-time Push Notifications for Tasks & Follow-ups'
            ],
            adminOverview: [
                'Automated WhatsApp 14-Template Communication Suite',
                'Comprehensive Financial Ledger and Payment Milestone Breakdown'
            ],
            payments: payments as any,
            timelines: timelines as any,
            schedules: schedules as any
        },
        include: {
            customer: true
        }
    })

    console.log(`✓ Project created in database: ${project.id} ("${project.projectName}")`)
    console.log(`  Budget: ₹${budget.toLocaleString('en-IN')}`)

    // 3. Build the official Estimation Proposal PDF buffer
    console.log('\n[1/3] Generating official Estimation Proposal PDF buffer...')
    const pdfBuffer = await buildEstimationPdfBuffer(project)
    console.log(`✓ PDF buffer generated successfully (${pdfBuffer.length} bytes)`)

    // Save a copy locally in test_output_pdfs for verification
    const outDir = path.join(__dirname, '../../test_output_pdfs')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const localPdfPath = path.join(outDir, `Estimation_Test_${targetPhone}.pdf`)
    fs.writeFileSync(localPdfPath, pdfBuffer)
    console.log(`✓ Local PDF preview saved at: ${localPdfPath}`)

    // 4. Dispatch WhatsApp template 'estimation' (ID: 1435652518531910)
    console.log('\n[2/3] Dispatching WhatsApp quotation alert with PDF attachment...')
    console.log(`  Target: +91 ${customer.phone}`)
    console.log(`  Template Name: estimation`)
    console.log(`  Template ID  : 1435652518531910`)

    const result = await sendQuotationAlert({
        clientPhone: customer.phone,
        clientName: customer.fullName,
        projectName: project.projectName,
        budget: project.budget,
        serviceType: project.serviceType,
        pdfBuffer,
        projectId: project.id
    })

    console.log('\n[3/3] WhatsApp Dispatch Result:')
    console.log(JSON.stringify(result, null, 2))

    if (result.success) {
        console.log('\n🎉 SUCCESS! WhatsApp message with Estimation PDF has been accepted and dispatched to +91 ' + targetPhone)
    } else {
        console.error('\n❌ ERROR: WhatsApp dispatch failed: ' + result.error)
    }

    // Check latest log from database
    const latestLog = await prisma.whatsAppNotificationLog.findFirst({
        where: { recipientPhone: { contains: targetPhone } },
        orderBy: { sentAt: 'desc' }
    })

    if (latestLog) {
        console.log('\n📋 Latest DB WhatsAppNotificationLog:')
        console.log({
            id: latestLog.id,
            type: latestLog.type,
            recipientPhone: latestLog.recipientPhone,
            status: latestLog.status,
            error: latestLog.error,
            sentAt: latestLog.sentAt
        })
    }
}

run()
    .catch(err => {
        console.error('Fatal execution error:', err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
