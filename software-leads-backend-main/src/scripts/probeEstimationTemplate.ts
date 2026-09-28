import 'dotenv/config'
import prisma from '../lib/prisma'
import { sendWhatsAppMessage } from '../lib/whatsapp'

const TARGET_PHONE = '9723554357'
const CLIENT_NAME  = 'om patel'
const PROJECT_NAME = 'Dunga CRM Platform'
const EST_NO       = 'DT/EST/2026/TEST1'
const AMOUNT       = '1,60,000'
const VALID_UNTIL  = '13/10/2026'

async function probe(label: string, payload: any) {
    await new Promise(r => setTimeout(r, 3500))
    const res = await sendWhatsAppMessage({
        recipientPhone: TARGET_PHONE,
        recipientName: CLIENT_NAME,
        message: `Probe: ${label}`,
        type: 'QUOTATION',
        template: payload
    })
    const ok  = res.success ? '✅ SUCCESS' : '❌'
    const err = res.success ? '' : res.error?.substring(0, 100)
    console.log(`  ${ok}  ${label}`)
    if (!res.success) console.log(`       └─ ${err}`)
    return res.success
}

async function run() {
    const customer = await prisma.customer.findFirst({ where: { phone: TARGET_PHONE } })
    if (!customer) { console.error('No customer'); process.exit(1) }
    const project = await prisma.project.findFirst({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, include: { customer: true } })
    if (!project) { console.error('No project'); process.exit(1) }

    const { buildEstimationPdfBuffer } = await import('../lib/pdfGenerator')
    const { uploadPdfBufferToLiveHost } = await import('../lib/whatsapp')
    const pdfBuf = await buildEstimationPdfBuffer(project)
    const pdfUrl = await uploadPdfBufferToLiveHost(pdfBuf, 'Probe2_Estimation.pdf')
    console.log(`\n✓ PDF: ${pdfUrl}\n`)

    console.log('── Targeted combos not yet tried ──')

    // The KEY combo we missed: 0 body params + document header
    if (await probe('0p + document header', {
        name: 'estimation', language: 'en', bodyParams: [],
        headerParams: [{ type: 'document', url: pdfUrl, filename: 'Estimation.pdf' }]
    })) return

    // Try with en_US language
    if (await probe('4p en_US [proj,est,amt,valid]', {
        name: 'estimation', language: 'en_US', bodyParams: [PROJECT_NAME, EST_NO, AMOUNT, VALID_UNTIL],
        headerParams: [{ type: 'document', url: pdfUrl, filename: 'Estimation.pdf' }]
    })) return

    if (await probe('4p en_US text-only [proj,est,amt,valid]', {
        name: 'estimation', language: 'en_US', bodyParams: [PROJECT_NAME, EST_NO, AMOUNT, VALID_UNTIL]
    })) return

    if (await probe('5p en_US [client,proj,est,amt,valid]', {
        name: 'estimation', language: 'en_US', bodyParams: [CLIENT_NAME, PROJECT_NAME, EST_NO, AMOUNT, VALID_UNTIL],
        headerParams: [{ type: 'document', url: pdfUrl, filename: 'Estimation.pdf' }]
    })) return

    if (await probe('5p en_US text-only', {
        name: 'estimation', language: 'en_US', bodyParams: [CLIENT_NAME, PROJECT_NAME, EST_NO, AMOUNT, VALID_UNTIL]
    })) return

    // Maybe image type header?
    if (await probe('4p + image header', {
        name: 'estimation', language: 'en', bodyParams: [PROJECT_NAME, EST_NO, AMOUNT, VALID_UNTIL],
        headerParams: [{ type: 'image', url: pdfUrl }]
    })) return

    // Try template name variations (maybe it's registered differently)
    for (const name of ['project_estimation', 'estimation_pdf', 'quotation', 'estimation_proposal']) {
        if (await probe(`name="${name}" 5p`, {
            name, language: 'en', bodyParams: [CLIENT_NAME, PROJECT_NAME, EST_NO, AMOUNT, VALID_UNTIL],
            headerParams: [{ type: 'document', url: pdfUrl, filename: 'Estimation.pdf' }]
        })) return
    }

    console.log('\n❌ Still not found. The "estimation" template in WoxAPI may have a non-standard setup.')
    console.log('   → Recommendation: Open WoxAPI dashboard → Templates and check the exact template body text and variable count.')
}

run()
    .catch(err => { console.error('Fatal:', err); process.exit(1) })
    .finally(() => prisma.$disconnect())
