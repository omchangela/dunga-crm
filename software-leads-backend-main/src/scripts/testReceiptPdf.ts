import { buildReceiptPdfBuffer } from '../lib/generateReceiptPdf'
import * as fs from 'fs'
import * as path from 'path'

const OUT = './test_output_pdfs'
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

function save(name: string, buf: Buffer) {
  const p = path.join(OUT, name)
  fs.writeFileSync(p, buf)
  console.log(`  SAVED: ${p} (${(buf.length / 1024).toFixed(0)} KB)`)
}

async function run() {

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 1 — WEB DEVELOPMENT: Advance chunk payment
  // Project: E-Commerce Website, Rs. 50,000 total
  // Chunks: Advance 5000 | After Figma Design 10000 | After Frontend 10000 |
  //         After Backend 15000 | Final Launch 10000
  // THIS PAYMENT: Rs. 5,000 advance
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n=== TEST 1: Web Dev — Advance Payment (Chunk 1/5) ===')
  const webSchedules = [
    { description: 'Advance Payment (Project Kickoff)', payment: 5000,  paid: 5000,  status: 'paid'    },
    { description: 'After Figma UI/UX Design Delivery', payment: 10000, paid: 0,     status: 'pending' },
    { description: 'After Frontend Development',        payment: 10000, paid: 0,     status: 'pending' },
    { description: 'After Backend API Integration',     payment: 15000, paid: 0,     status: 'pending' },
    { description: 'Final Launch & Deployment',         payment: 10000, paid: 0,     status: 'pending' },
  ]
  const buf1 = await buildReceiptPdfBuffer({
    receiptNo:            'REC-WEB-001',
    paymentDate:          new Date('2026-09-01'),
    amount:               5000,
    paymentMethod:        'UPI',
    transactionId:        'UPI-GPAY-20260901-55123',
    milestoneDescription: 'Advance Payment (Project Kickoff)',
    note:                 'Advance payment received. Project development begins from today.',
    project: {
      id:          'proj-web-001',
      projectName: 'E-Commerce Website Development',
      serviceType: 'Web Development',
      totalAmount: 50000,
      paidSoFar:   5000,
      schedules:   webSchedules
    },
    customer: { fullName: 'Ramesh Verma', phone: '+91 98001 23456', email: 'ramesh@shopify.in' }
  })
  save('receipt_web_chunk1_advance.pdf', buf1)

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 2 — WEB DEVELOPMENT: After Figma Design payment (Chunk 2/5)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n=== TEST 2: Web Dev — After Figma Design (Chunk 2/5) ===')
  const webSchedules2 = [
    { description: 'Advance Payment (Project Kickoff)', payment: 5000,  paid: 5000,  status: 'paid'    },
    { description: 'After Figma UI/UX Design Delivery', payment: 10000, paid: 10000, status: 'paid'    },
    { description: 'After Frontend Development',        payment: 10000, paid: 0,     status: 'pending' },
    { description: 'After Backend API Integration',     payment: 15000, paid: 0,     status: 'pending' },
    { description: 'Final Launch & Deployment',         payment: 10000, paid: 0,     status: 'pending' },
  ]
  const buf2 = await buildReceiptPdfBuffer({
    receiptNo:            'REC-WEB-002',
    paymentDate:          new Date('2026-09-08'),
    amount:               10000,
    paymentMethod:        'BANK_TRANSFER',
    transactionId:        'NEFT-HDFC-20260908-887723',
    milestoneDescription: 'After Figma UI/UX Design Delivery',
    project: {
      id:          'proj-web-001',
      projectName: 'E-Commerce Website Development',
      serviceType: 'Web Development',
      totalAmount: 50000,
      paidSoFar:   15000,
      schedules:   webSchedules2
    },
    customer: { fullName: 'Ramesh Verma', phone: '+91 98001 23456', email: 'ramesh@shopify.in' }
  })
  save('receipt_web_chunk2_figma.pdf', buf2)

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 3 — APP DEVELOPMENT: Partial payment on first milestone
  // Project: Delivery Tracking Mobile App, Rs. 1,20,000 total
  // Chunks: 5 milestones
  // THIS PAYMENT: partial advance Rs. 20,000 (chunk is 30,000 — partial)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n=== TEST 3: App Dev — Partial Advance (partial chunk) ===')
  const appSchedules = [
    { description: 'Advance (Design & Architecture)',     payment: 30000, paid: 20000, status: 'partial' },
    { description: 'After React Native UI Screens',       payment: 25000, paid: 0,     status: 'pending' },
    { description: 'After API & Backend Integration',     payment: 30000, paid: 0,     status: 'pending' },
    { description: 'After QA Testing & Bug Fixing',       payment: 20000, paid: 0,     status: 'pending' },
    { description: 'Final App Store Submission & Launch', payment: 15000, paid: 0,     status: 'pending' },
  ]
  const buf3 = await buildReceiptPdfBuffer({
    receiptNo:            'REC-APP-001',
    paymentDate:          new Date('2026-09-03'),
    amount:               20000,
    paymentMethod:        'CHEQUE',
    transactionId:        'CHQ-0045123',
    milestoneDescription: 'Advance (Design & Architecture) — partial',
    note:                 'Partial advance payment. Remaining Rs. 10,000 to be paid by 10 Sept 2026.',
    project: {
      id:          'proj-app-001',
      projectName: 'Delivery Tracking Mobile App (iOS + Android)',
      serviceType: 'Mobile App Development',
      totalAmount: 120000,
      paidSoFar:   20000,
      schedules:   appSchedules
    },
    customer: { fullName: 'Priya Logistics Pvt Ltd', phone: '+91 90000 11223', email: 'accounts@priyalogistics.com' }
  })
  save('receipt_app_chunk1_partial.pdf', buf3)

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 4 — FULL-STACK WEB+APP: Multiple milestones all paid (FULLY PAID)
  // Project: Hospital Management System, Rs. 2,50,000
  // All 4 chunks paid
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n=== TEST 4: Hospital System — Final Payment (FULLY PAID) ===')
  const hmsSchedules = [
    { description: 'Phase 1: Advance & System Design',   payment: 75000,  paid: 75000,  status: 'paid' },
    { description: 'Phase 2: Web Module Delivery',       payment: 75000,  paid: 75000,  status: 'paid' },
    { description: 'Phase 3: App & Integration Testing', payment: 62500,  paid: 62500,  status: 'paid' },
    { description: 'Phase 4: Final Launch & Support',    payment: 37500,  paid: 37500,  status: 'paid' },
  ]
  const buf4 = await buildReceiptPdfBuffer({
    receiptNo:            'REC-HMS-004',
    paymentDate:          new Date('2026-09-05'),
    amount:               37500,
    paymentMethod:        'BANK_TRANSFER',
    transactionId:        'RTGS-ICICI-20260905-FNL9923',
    milestoneDescription: 'Phase 4: Final Launch & Support',
    note:                 'Final payment received. Project completed and handed over. Support period begins.',
    project: {
      id:          'proj-hms-001',
      projectName: 'Hospital Management System (Web + Mobile)',
      serviceType: 'Enterprise Software',
      totalAmount: 250000,
      paidSoFar:   250000,
      schedules:   hmsSchedules
    },
    customer: { fullName: 'Dr. Anil Mehta', phone: '+91 77001 55678', email: 'admin@cityhospital.org' }
  })
  save('receipt_hms_final_fullypaid.pdf', buf4)

  // ────────────────────────────────────────────────────────────────────────────
  // TEST 5 — MINIMAL: Cash payment, no customer, no schedules
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n=== TEST 5: Minimal — Cash, no schedule, no customer ===')
  const buf5 = await buildReceiptPdfBuffer({
    receiptNo:     'REC-CASH-005',
    paymentDate:   new Date('2026-09-06'),
    amount:        8000,
    paymentMethod: 'CASH',
    project: {
      id:          'proj-logo-001',
      projectName: 'Logo Design & Branding Package',
      serviceType: 'Design',
      totalAmount: 8000,
      paidSoFar:   8000,
    },
    customer: null
  })
  save('receipt_minimal_cash.pdf', buf5)

  console.log('\n══════════════════════════════════════════')
  console.log(' All 5 tests PASSED. PDFs saved to ./test_output_pdfs/')
  console.log('══════════════════════════════════════════\n')
}

run().catch(e => { console.error('FAILED:', e); process.exit(1) })
