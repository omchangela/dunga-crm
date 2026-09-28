import 'dotenv/config'
import { sendAdvancePaymentRequest } from '../lib/whatsapp'

async function run() {
    console.log('\n📤 Testing advancepaymentrequest template (ID: 1790635345737589)...\n')

    const result = await sendAdvancePaymentRequest({
        clientPhone:  '9723554357',
        clientName:   'Om Changela',
        amount:       40000,
        paymentLink:  'https://rzp.io/l/dunga-advance',
        projectName:  'Dunga CRM & Mobile Automation Platform',
        projectId:    'test-project-001'
    })

    console.log(result.success
        ? '✅ SUCCESS — Check WhatsApp!'
        : '❌ FAILED: ' + result.error
    )
}

run().catch(console.error)
