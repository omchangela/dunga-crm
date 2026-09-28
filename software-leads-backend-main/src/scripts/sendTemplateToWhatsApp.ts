import 'dotenv/config'
import { sendWhatsAppMessage } from '../lib/whatsapp'

async function run() {
    const templateText =
`━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *estimation* Template Body
━━━━━━━━━━━━━━━━━━━━━━━━━━

Copy & paste this in WoxAPI:

Hello {{1}},

Greetings from Dunga Technologies.

We are pleased to share the project estimation for {{2}}.

📄 Estimation No: {{3}}
💰 Estimated Investment: ₹{{4}}
📅 Valid Until: {{5}}

Please find the project estimation attached for your review. It includes the proposed project scope, deliverables, pricing, and applicable terms.

If you have any questions or would like to discuss the project requirements, pricing, deliverables, or development timeline, our team will be happy to assist you.

We look forward to partnering with you.

Best Regards,
Dunga Technologies
Technology Solutions & Developer Services

━━━━━━━━━━━━━━━━━━━━━━━━━━
Steps:
1️⃣ Open WoxAPI Dashboard
2️⃣ Go to Templates → estimation
3️⃣ Edit → replace body with above
4️⃣ Save & submit for Meta approval
━━━━━━━━━━━━━━━━━━━━━━━━━━`

    const result = await sendWhatsAppMessage({
        recipientPhone: '9723554357',
        recipientName: 'Om',
        message: templateText,
        type: 'CUSTOM'
    })

    console.log(result.success ? '✅ Sent!' : '❌ Failed: ' + result.error)
}

run().catch(console.error)
