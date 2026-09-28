import 'dotenv/config'
import prisma from '../lib/prisma'
import { buildEstimationPdfBuffer } from '../lib/pdfGenerator'
import { sendQuotationAlert, sendFinalEstimation } from '../lib/whatsapp'

const TARGET_PHONE  = '9723554357'
const CLIENT_NAME   = 'Om Changela'
const PROJECT_NAME  = 'Dunga CRM & Mobile Automation Platform'

async function run() {
    console.log('\n══════════════════════════════════════════════════════════')
    console.log('🧪 TEST: Both Estimation Templates to +91 ' + TARGET_PHONE)
    console.log('══════════════════════════════════════════════════════════')

    // ── Get or find customer ──
    let customer = await prisma.customer.findFirst({ where: { phone: TARGET_PHONE } })
    if (!customer) {
        console.error('❌ Customer not found for phone:', TARGET_PHONE)
        process.exit(1)
    }
    console.log(`✓ Customer: ${customer.fullName} (${customer.id})`)

    // ── Get latest project for this customer ──
    let project = await prisma.project.findFirst({
        where:   { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        include: { customer: true }
    })

    if (!project) {
        // Create a temporary mock project for testing
        project = await prisma.project.create({
            data: {
                customerId:   customer.id,
                projectName:  PROJECT_NAME,
                description:  'Dunga CRM test project for template verification.',
                serviceType:  'APP_WEB_DEVELOPMENT',
                status:       'PENDING',
                budget:       160000,
                payments: [
                    { description: 'Architecture & UI/UX Figma Design', amount: 40000 },
                    { description: 'Backend API & Database',             amount: 55000 },
                    { description: 'Web Frontend & Mobile App Build',    amount: 65000 }
                ] as any,
                timelines: [] as any,
                schedules: [] as any
            },
            include: { customer: true }
        }) as any
        console.log(`✓ Test project created: ${project!.id}`)
    } else {
        console.log(`✓ Using existing project: ${project.projectName} (₹${project.budget?.toLocaleString('en-IN')})`)
    }

    // ── Build PDF ──
    console.log('\n[1/3] Generating Estimation PDF...')
    const pdfBuffer = await buildEstimationPdfBuffer(project)
    console.log(`✓ PDF: ${pdfBuffer.length} bytes`)

    const estNumber   = `DT/EST/${new Date().getFullYear()}/${(project!.id).replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()}`
    const vDate       = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    const validUntil  = `${String(vDate.getDate()).padStart(2,'0')}/${String(vDate.getMonth()+1).padStart(2,'0')}/${vDate.getFullYear()}`
    const dDate       = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    const deliveryDate = `${String(dDate.getDate()).padStart(2,'0')}/${String(dDate.getMonth()+1).padStart(2,'0')}/${dDate.getFullYear()}`

    // ══════════════════════════════════════════
    // SEND 1: Initial Project Estimation
    // Template: estimation (ID: 1435652518531910)
    // Triggered when: New Project is created
    // ══════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────')
    console.log('📤 SEND 1 — Initial Project Estimation')
    console.log('   Template : estimation (ID: 1435652518531910)')
    console.log('   Trigger  : When "Project Tracking Section" form is submitted')
    console.log('──────────────────────────────────────────────────────────')

    const result1 = await sendQuotationAlert({
        clientPhone:  customer.phone,
        clientName:   customer.fullName,
        projectName:  project!.projectName,
        budget:       project!.budget,
        estimationNo: estNumber,
        validUntil:   validUntil,
        serviceType:  project!.serviceType,
        pdfBuffer,
        projectId:    project!.id
    })
    console.log(`Result 1: ${result1.success ? '✅ SUCCESS' : '❌ FAILED — ' + result1.error}`)

    // Wait 8 seconds between sends to avoid deduplication
    console.log('\n⏳ Waiting 10s before sending 2nd template (deduplication window)...')
    await new Promise(r => setTimeout(r, 10000))

    // ══════════════════════════════════════════
    // SEND 2: Final Estimation
    // Template: final_estimation (ID: 1810100450167250)
    // Triggered when: "Convert Project" → "Confirm & Convert"
    // ══════════════════════════════════════════
    console.log('\n──────────────────────────────────────────────────────────')
    console.log('📤 SEND 2 — Final Estimation (on Convert Project)')
    console.log('   Template : final_estimation (ID: 1810100450167250)')
    console.log('   Trigger  : When "Confirm & Convert" is clicked with updated prices')
    console.log('──────────────────────────────────────────────────────────')

    const result2 = await sendFinalEstimation({
        clientPhone:  customer.phone,
        clientName:   customer.fullName,
        projectName:  project!.projectName,
        estimationNo: estNumber,
        finalAmount:  project!.budget,
        deliveryDate: deliveryDate,
        pdfBuffer,
        projectId:    project!.id
    })
    console.log(`Result 2: ${result2.success ? '✅ SUCCESS' : '❌ FAILED — ' + result2.error}`)

    console.log('\n══════════════════════════════════════════════════════════')
    console.log('✅ Test complete — check WhatsApp for 2 different messages:')
    console.log('   1️⃣  estimation    → "We are pleased to share the project estimation..."')
    console.log('   2️⃣  final_estimation → "Hello {{1}}, Following our discussions..."')
    console.log('══════════════════════════════════════════════════════════\n')
}

run()
    .catch(err => { console.error('Fatal:', err); process.exit(1) })
    .finally(() => prisma.$disconnect())
