import 'dotenv/config'
import prisma from '../lib/prisma'
import { buildEstimationPdfBuffer } from '../lib/pdfGenerator'
import { sendQuotationAlert } from '../lib/whatsapp'
import fs from 'fs'
import path from 'path'

async function createAndSendProposal() {
    console.log('🚀 Creating and Sending Estimation Proposal via WhatsApp...\n')

    const targetPhone = '9723554357' // +91 9723554357
    const clientName = 'Om Changela'
    const clientEmail = 'changelaom@gmail.com'

    // 1. Create or Find Lead & Customer
    console.log(`1. Ensuring Customer record exists for ${clientName} (${targetPhone})...`)
    
    let lead = await prisma.lead.findFirst({
        where: { phone: targetPhone }
    })

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
        console.log(`   ✓ Created Lead: ${lead.id}`)
    }

    let customer = await prisma.customer.findFirst({
        where: { phone: targetPhone }
    })

    if (!customer) {
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
        console.log(`   ✓ Created Customer: ${customer.id} (${customer.applicationNumber})`)
    }

    // 2. Create Project with detailed specifications
    console.log('2. Creating Project with comprehensive estimation breakdown...')
    
    const projectName = 'Dunga CRM & Mobile Portal Platform'
    const budget = 185000

    const payments = [
        { description: 'Initial Architecture & UI/UX Figma Design', amount: 45000 },
        { description: 'Backend API, Authentication & Database Development', amount: 55000 },
        { description: 'Web Frontend & Portal Dashboard', amount: 50000 },
        { description: 'Mobile App Build, Store Deployment & QA', amount: 35000 }
    ]

    const timelines = [
        { description: 'UI/UX Design & Requirement Sign-off', workingDays: 7 },
        { description: 'Backend & Database Architecture', workingDays: 14 },
        { description: 'Frontend Web & Admin Portal', workingDays: 14 },
        { description: 'Mobile App Development & Beta Testing', workingDays: 10 },
        { description: 'UAT & Production Deployment', workingDays: 5 }
    ]

    const schedules = [
        { description: 'Advance Booking Token (25%)', payment: 46250, paid: 0, status: 'pending' },
        { description: 'Milestone 2 - Design & Core Architecture (30%)', payment: 55500, paid: 0, status: 'pending' },
        { description: 'Milestone 3 - Web Portal & Integration (25%)', payment: 46250, paid: 0, status: 'pending' },
        { description: 'Final Delivery & Store Deployment (20%)', payment: 37000, paid: 0, status: 'pending' }
    ]

    const project = await prisma.project.create({
        data: {
            customerId: customer.id,
            projectName,
            description: 'Custom Enterprise Multi-Role Software Solution with Next.js, Node.js, WhatsApp Automation, and Mobile App.',
            serviceType: 'APP_WEB_DEVELOPMENT',
            status: 'ACTIVE',
            budget,
            webOverview: [
                'Next.js 16 App Router Portal with Tailwind CSS v4',
                'Super Admin, Telecaller, and Developer Portal Dashboards',
                'Dynamic PDF Quotation, Contract, and Receipt Generation Engine',
                'WoxAPI WhatsApp Business Automation Integration'
            ],
            appOverview: [
                'Cross-platform Flutter / React Native Mobile Application',
                'Push Notifications for Tasks & Reminders',
                'Offline Lead Management and Call Logging'
            ],
            adminOverview: [
                'Comprehensive Financial Ledger and Payment Breakdown',
                'Staff Performance and Target Commission Engine',
                'Automated 15-Day and 7-Day Subscription Expiry Alerts'
            ],
            payments,
            timelines,
            schedules
        },
        include: {
            customer: true
        }
    })

    console.log(`   ✓ Created Project: ${project.id} ("${project.projectName}")`)

    // 3. Generate Estimation Proposal PDF
    console.log('3. Generating Official Estimation Proposal PDF...')
    const pdfBuffer = await buildEstimationPdfBuffer(project)
    
    const outputDir = path.join(__dirname, '../../test_output_pdfs')
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    const pdfFileName = `Estimation_${project.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`
    const localPdfPath = path.join(outputDir, pdfFileName)
    fs.writeFileSync(localPdfPath, pdfBuffer)
    console.log(`   ✓ Saved PDF locally to: ${localPdfPath} (${pdfBuffer.length} bytes)`)

    const proposalUrl = `https://dunga-crm-api.onrender.com/api/projects/${project.id}/estimation-pdf`

    await prisma.project.update({
        where: { id: project.id },
        data: {
            estimationPdfUrl: proposalUrl,
            estimationPdfAt: new Date()
        }
    })

    // 4. Send WhatsApp Notification
    console.log(`4. Sending WhatsApp Quotation Alert to +91 ${targetPhone}...`)
    
    const dispatchResult = await sendQuotationAlert({
        clientPhone: targetPhone,
        clientName: clientName,
        projectName: project.projectName,
        budget: project.budget,
        serviceType: project.serviceType,
        pdfUrl: proposalUrl,
        projectId: project.id
    })

    console.log('\n======================================================')
    console.log('🎉 ESTIMATION PROPOSAL DISPATCH SUMMARY:')
    console.log(`- Recipient Name  : ${clientName}`)
    console.log(`- Recipient Phone : +91 ${targetPhone}`)
    console.log(`- Project Title   : ${project.projectName}`)
    console.log(`- Estimated Budget: ₹${project.budget.toLocaleString('en-IN')}`)
    console.log(`- PDF Proposal    : ${localPdfPath}`)
    console.log(`- WhatsApp Status : ${dispatchResult.success ? 'SUCCESS / DISPATCHED' : 'LOGGED'}`)
    if (dispatchResult.error) console.log(`- Notice          : ${dispatchResult.error}`)
    console.log('======================================================\n')
}

createAndSendProposal()
    .catch(err => {
        console.error('Execution error:', err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
