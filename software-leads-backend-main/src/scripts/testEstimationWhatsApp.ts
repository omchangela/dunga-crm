import 'dotenv/config'
import { sendQuotationAlert } from '../lib/whatsapp'
import prisma from '../lib/prisma'

async function run() {
    const phone = process.argv[2] || '9723554357'
    console.log(`\n📱 Testing estimation WhatsApp → template: "estimation" (ID: 969016959557925)`)
    console.log(`   To: +91 ${phone}\n`)

    const result = await sendQuotationAlert({
        clientPhone:  phone,
        clientName:   'Dunga Test Client',
        projectName:  'CRM Software Development',
        budget:       75000,
        serviceType:  'WEB_APPLICATION',
        pdfUrl:       null,           // no PDF attachment for this test
        projectId:    'test-estimation-001'
    })

    console.log('Result:', result)
    if (result.success) {
        console.log('✅ WhatsApp sent successfully!')
    } else {
        console.error('❌ Failed:', result.error)
    }
}

run()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
