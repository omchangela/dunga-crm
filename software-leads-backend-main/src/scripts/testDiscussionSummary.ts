import 'dotenv/config'
import { sendProjectDiscussionSummary } from '../lib/whatsapp'
import prisma from '../lib/prisma'

async function run() {
    console.log('Sending Project Discussion Summary WhatsApp notification...')
    
    // User requested number: +91 9723554357
    const recipientPhone = process.argv[2] || '9723554357'
    const recipientName = 'Dunga Technologies Client'
    const projectSummary = 'Website and CRM integration with automated WhatsApp notifications and payment reminders.'

    const result = await sendProjectDiscussionSummary({
        clientPhone: recipientPhone,
        clientName: recipientName,
        projectSummary: projectSummary
    })

    console.log('Dispatch Result:', result)
}

run()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
