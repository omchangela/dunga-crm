import 'dotenv/config'
import { sendDiscussionCompletedAlert } from '../lib/whatsapp'
import prisma from '../lib/prisma'

async function main() {
    console.log('Sending Discussion Completed test WhatsApp alert to +919723554357...')
    const result = await sendDiscussionCompletedAlert({
        leadPhone: '9723554357',
        leadName: 'Om Changela',
        serviceType: 'APP_WEB_DEVELOPMENT',
        summaryNote: 'Requirement Review & Project Estimation'
    })
    console.log('Result:', result)

    const latestLog = await prisma.whatsAppNotificationLog.findFirst({
        where: { type: 'DISCUSSION_COMPLETED' },
        orderBy: { createdAt: 'desc' }
    })
    console.log('Database Notification Log Entry:', latestLog)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
