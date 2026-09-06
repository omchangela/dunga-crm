import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

// ── Letterhead background (same as estimation/contract PDF) ──────────────────
function getLetterheadPath(): string | null {
  const candidates = [
    path.join(__dirname, '../../assets/dunga_letterhead.jpg'),
    'C:/xampp/htdocs/dunga_tech/WhatsApp Image 2026-09-05 at 8.58.31 PM.jpeg',
    path.join(process.cwd(), 'assets/dunga_letterhead.jpg'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

const LETTERHEAD_PATH = getLetterheadPath()

function drawLetterheadBackground(doc: any) {
  if (LETTERHEAD_PATH) {
    try { doc.image(LETTERHEAD_PATH, 0, 0, { width: 595.28, height: 841.89 }) }
    catch (e) { console.error('Letterhead load failed:', e) }
  }
}

function formatINR(n: number): string {
  return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | Date): string {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return String(d) }
}

function fmtDateLong(d: string | Date): string {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return String(d) }
}

// ── Receipt Data interface ───────────────────────────────────────────────────
export interface ReceiptData {
  receiptNo:     string
  paymentDate:   string | Date
  amount:        number
  paymentMethod: string
  transactionId?: string | null
  note?:          string | null
  // Milestone/chunk this payment is for
  milestoneDescription?: string | null
  project: {
    projectName: string
    serviceType?: string | null
    id:           string
    totalAmount?: number | null
    paidSoFar?:   number | null
    schedules?:   Array<{ description: string; payment: number; paid: number; status: string }>
  }
  customer?: {
    fullName?: string | null
    phone?:    string | null
    email?:    string | null
  } | null
}

// ── Main PDF builder (pdfkit — matches Dunga letterhead style) ───────────────
export function buildReceiptPdfBuffer(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true })
      const buffers: Buffer[] = []
      doc.on('data', (c) => buffers.push(c))
      doc.on('end', () => resolve(Buffer.concat(buffers)))

      renderReceipt(doc, data)
      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

function renderReceipt(doc: any, data: ReceiptData) {
  const primaryTeal  = '#007a87'
  const accentOrange = '#e05a10'
  const darkText     = '#1e293b'
  const mutedText    = '#64748b'
  const green        = '#15803d'

  drawLetterheadBackground(doc)

  let y = 145

  const ensureSpace = (h: number) => {
    if (y + h > 635) {
      doc.addPage()
      drawLetterheadBackground(doc)
      y = 145
    }
  }

  // ── Document Title Row (parallel: title left, receipt no right) ───────────
  doc.fillColor(primaryTeal).fontSize(15).font('Helvetica-Bold')
     .text('PAYMENT RECEIPT', 45, y, { lineBreak: false })

  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('RECEIPT No.  :', 270, y + 2, { width: 110, align: 'right' })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold')
     .text(data.receiptNo, 385, y + 2, { width: 110, align: 'left' })

  doc.fillColor(darkText).fontSize(9.5).font('Helvetica-Bold')
     .text('OFFICIAL PAYMENT ACKNOWLEDGEMENT', 45, y + 18, { width: 220, lineBreak: false })

  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('DATE  :', 270, y + 18, { width: 110, align: 'right' })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
     .text(fmtDate(data.paymentDate), 385, y + 18, { width: 110, align: 'left' })

  y += 34

  // Orange underline accent bar (same as estimation)
  doc.rect(45, y, 220, 2.5).fill(accentOrange)
  y += 12

  // ── PAYMENT RECEIVED GREEN BADGE STRIP ────────────────────────────────────
  doc.rect(45, y, 450, 22).fill(green)
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
     .text('✓   PAYMENT RECEIVED', 45, y + 5, { width: 450, align: 'center', lineBreak: false })
  y += 30

  // ── AMOUNT HERO CARD ──────────────────────────────────────────────────────
  ensureSpace(60)
  doc.rect(45, y, 450, 54).fillAndStroke('#f0fdfa', '#007a87')
  doc.fillColor(primaryTeal).fontSize(9).font('Helvetica-Bold')
     .text('AMOUNT PAID', 45, y + 7, { width: 450, align: 'center' })
  doc.fillColor(accentOrange).fontSize(24).font('Helvetica-Bold')
     .text(formatINR(data.amount), 45, y + 19, { width: 450, align: 'center', lineBreak: false })
  y += 54 + 10

  // ── CLIENT INFORMATION CARD ──────────────────────────────────────────────
  ensureSpace(70)
  const customerName = data.customer?.fullName || 'Valued Client'
  const phone        = data.customer?.phone    || '—'
  const email        = data.customer?.email    || '—'
  const serviceType  = data.project.serviceType || 'Software Development'

  doc.rect(45, y, 450, 58).fillAndStroke('#f8fafc', '#cbd5e1')

  // Left column
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('CLIENT NAME', 55, y + 8, { width: 75 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold')
     .text(`:  ${customerName}`, 130, y + 8, { width: 115, height: 12, lineBreak: false, ellipsis: true })

  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('PHONE NUMBER', 55, y + 24, { width: 75 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
     .text(`:  ${phone}`, 130, y + 24, { width: 115, height: 12, lineBreak: false, ellipsis: true })

  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('EMAIL', 55, y + 40, { width: 75 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
     .text(`:  ${email}`, 130, y + 40, { width: 115, height: 12, lineBreak: false, ellipsis: true })

  // Right column
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('PROJECT NAME', 255, y + 8, { width: 80 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold')
     .text(`:  ${data.project.projectName}`, 338, y + 8, { width: 152, height: 12, lineBreak: false, ellipsis: true })

  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('SERVICE TYPE', 255, y + 24, { width: 80 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
     .text(`:  ${serviceType}`, 338, y + 24, { width: 152, height: 12, lineBreak: false, ellipsis: true })

  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('PAYMENT DATE', 255, y + 40, { width: 80 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
     .text(`:  ${fmtDateLong(data.paymentDate)}`, 338, y + 40, { width: 152, height: 12, lineBreak: false, ellipsis: true })

  y += 58 + 10

  // ── PAYMENT DETAILS CARD ──────────────────────────────────────────────────
  ensureSpace(70)
  const hasTransactionId = !!data.transactionId
  const hasMilestone     = !!data.milestoneDescription
  const detailRows = 2 + (hasTransactionId ? 1 : 0) + (hasMilestone ? 1 : 0)
  const detailCardH = 16 + detailRows * 18 + 10

  doc.rect(45, y, 450, detailCardH).fillAndStroke('#f0fdfa', '#cbd5e1')
  doc.fillColor(primaryTeal).fontSize(9).font('Helvetica-Bold')
     .text('PAYMENT DETAILS', 55, y + 7)

  let dy = y + 22

  // Receipt No.
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('Receipt No.', 55, dy, { width: 100 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold')
     .text(`:  ${data.receiptNo}`, 155, dy, { width: 150 })

  // Payment Mode
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('Payment Mode', 265, dy, { width: 100 })
  doc.fillColor(accentOrange).fontSize(8.5).font('Helvetica-Bold')
     .text(`:  ${data.paymentMethod}`, 365, dy, { width: 125 })
  dy += 18

  // Amount
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('Amount Paid', 55, dy, { width: 100 })
  doc.fillColor(green).fontSize(8.5).font('Helvetica-Bold')
     .text(`:  ${formatINR(data.amount)}`, 155, dy, { width: 150 })

  // Payment Time / Date
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('Payment Time', 265, dy, { width: 100 })
  doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
     .text(`:  ${fmtDateLong(data.paymentDate)}`, 365, dy, { width: 125 })
  dy += 18

  if (hasTransactionId) {
    doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
       .text('Transaction Ref.', 55, dy, { width: 100 })
    doc.fillColor(darkText).fontSize(8).font('Helvetica')
       .text(`:  ${data.transactionId}`, 155, dy, { width: 335, height: 12, lineBreak: false, ellipsis: true })
    dy += 18
  }

  if (hasMilestone) {
    doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
       .text('For Milestone', 55, dy, { width: 100 })
    doc.fillColor(darkText).fontSize(8.5).font('Helvetica')
       .text(`:  ${data.milestoneDescription}`, 155, dy, { width: 335, height: 12, lineBreak: false, ellipsis: true })
    dy += 18
  }

  y += detailCardH + 10

  // ── PAYMENT SCHEDULE PROGRESS (IF SCHEDULES PROVIDED) ────────────────────
  const schedules = data.project.schedules || []
  if (schedules.length > 0) {
    ensureSpace(30 + schedules.length * 20 + 20)

    const schCardH = 22 + schedules.length * 20 + 10
    doc.rect(45, y, 450, schCardH).fillAndStroke('#f8fafc', '#cbd5e1')

    doc.fillColor(primaryTeal).fontSize(9).font('Helvetica-Bold')
       .text('PAYMENT MILESTONE SCHEDULE', 55, y + 7)

    // Table header row  — columns: Milestone(180) | Total(65) | Paid(65) | Balance(65) | Status(55)
    const hY = y + 20
    doc.rect(45, hY, 450, 14).fill('#e2e8f0')
    doc.fillColor(darkText).fontSize(7.5).font('Helvetica-Bold')
       .text('Milestone / Phase', 55, hY + 3, { width: 185 })
    doc.text('Total',   242, hY + 3, { width: 60, align: 'right' })
    doc.text('Paid',    307, hY + 3, { width: 60, align: 'right' })
    doc.text('Balance', 372, hY + 3, { width: 60, align: 'right' })
    doc.text('Status',  435, hY + 3, { width: 55, align: 'center' })

    let sY = hY + 14
    schedules.forEach((sch, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      doc.rect(45, sY, 450, 18).fillAndStroke(bg, '#e2e8f0')

      const total   = Number(sch.payment || 0)
      const paid    = Number(sch.paid    || 0)
      const balance = Math.max(0, total - paid)
      const status  = sch.status || (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending')

      const statusColor =
        status === 'paid'    ? green :
        status === 'partial' ? accentOrange :
        mutedText

      const statusLabel =
        status === 'paid'    ? 'PAID' :
        status === 'partial' ? 'PARTIAL' :
        'PENDING'

      doc.fillColor(darkText).fontSize(7.5).font('Helvetica')
         .text(sch.description || `Phase ${idx + 1}`, 55, sY + 4, { width: 185, height: 12, lineBreak: false, ellipsis: true })
      doc.text(`Rs. ${total.toLocaleString('en-IN')}`,   242, sY + 4, { width: 60, align: 'right' })
      doc.fillColor(green)
         .text(`Rs. ${paid.toLocaleString('en-IN')}`,    307, sY + 4, { width: 60, align: 'right' })
      doc.fillColor(status === 'paid' ? mutedText : accentOrange)
         .text(`Rs. ${balance.toLocaleString('en-IN')}`, 372, sY + 4, { width: 60, align: 'right' })
      doc.fillColor(statusColor).font('Helvetica-Bold')
         .text(statusLabel, 435, sY + 4, { width: 55, align: 'center' })

      sY += 18
    })

    y += schCardH + 10
  }

  // ── PROJECT TOTALS SUMMARY ────────────────────────────────────────────────
  const totalAmt = data.project.totalAmount
  const paidAmt  = data.project.paidSoFar
  if (totalAmt && paidAmt !== undefined && paidAmt !== null) {
    ensureSpace(45)
    const balance = Math.max(0, totalAmt - paidAmt)

    doc.rect(45, y, 450, 40).fillAndStroke('#fff7ed', '#fed7aa')
    doc.fillColor(accentOrange).fontSize(9).font('Helvetica-Bold')
       .text('ACCOUNT SUMMARY', 55, y + 7)

    // Col 1: Project Total
    doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
       .text('Project Total', 55, y + 22, { width: 62 })
    doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold')
       .text(`:  ${formatINR(totalAmt)}`, 117, y + 22, { width: 88, lineBreak: false })

    // Col 2: Total Paid
    doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
       .text('Total Paid', 210, y + 22, { width: 52 })
    doc.fillColor(green).fontSize(8.5).font('Helvetica-Bold')
       .text(`:  ${formatINR(paidAmt)}`, 262, y + 22, { width: 88, lineBreak: false })

    // Col 3: Balance Due
    if (balance > 0) {
      doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
         .text('Balance Due', 355, y + 22, { width: 62 })
      doc.fillColor(accentOrange).fontSize(8.5).font('Helvetica-Bold')
         .text(`:  ${formatINR(balance)}`, 417, y + 22, { width: 75, lineBreak: false })
    } else {
      doc.rect(410, y + 17, 75, 17).fill(green)
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
         .text('FULLY PAID', 410, y + 21, { width: 75, align: 'center', lineBreak: false })
    }

    y += 40 + 10
  }

  // ── NOTE ──────────────────────────────────────────────────────────────────
  if (data.note) {
    ensureSpace(35)
    const noteH = doc.heightOfString(data.note, { width: 390 }) + 20
    doc.rect(45, y, 450, noteH).fillAndStroke('#f0fdfa', '#007a87')
    doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
       .text('NOTE:', 55, y + 8)
    doc.fillColor(darkText).fontSize(8).font('Helvetica')
       .text(data.note, 90, y + 8, { width: 395 })
    y += noteH + 10
  }

  // ── ACCEPTED PAYMENT MODES ────────────────────────────────────────────────
  ensureSpace(50)
  doc.rect(45, y, 450, 44).fillAndStroke('#f8fafc', '#cbd5e1')
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('ACCEPTED PAYMENT MODES', 55, y + 8, { width: 135 })
  doc.fillColor(darkText).fontSize(8).font('Helvetica')
     .text(':  Bank Transfer (NEFT/RTGS), UPI (GPay/PhonePe/Paytm) & Net Banking', 190, y + 8, { width: 300, height: 12, lineBreak: false })

  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('CONTACT FOR INVOICING', 55, y + 26, { width: 135 })
  doc.fillColor(mutedText).fontSize(8).font('Helvetica')
     .text(':  Sales@dungatechnologies.com  |  Phone: +91 8121923831', 190, y + 26, { width: 300, height: 12, lineBreak: false })
  y += 44 + 12

  // ── THANK YOU FOOTER NOTE ─────────────────────────────────────────────────
  ensureSpace(48)
  doc.rect(45, y, 450, 44).fillAndStroke('#f0fdfa', '#007a87')
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold')
     .text('NOTE:', 55, y + 8)
  doc.fillColor(darkText).fontSize(8).font('Helvetica')
     .text('This is a computer-generated receipt and is valid without a physical signature.', 90, y + 8, { width: 395, height: 12, lineBreak: false })
  doc.fillColor(accentOrange).fontSize(11).font('Helvetica-Bold')
     .text('Thank You! We look forward to a successful partnership.', 55, y + 25, { width: 430, align: 'center', lineBreak: false })

  // ── PAGE NUMBER FOOTER ────────────────────────────────────────────────────
  const pageCount = doc.bufferedPageRange().count
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i)
    doc.fillColor(mutedText).fontSize(8).font('Helvetica')
       .text(`Page ${i + 1} of ${pageCount}`, 45, 785, { align: 'left', lineBreak: false })
  }
}

// ── Backwards-compat async wrapper (used by finance controller) ──────────────
export const generateReceiptPdf = async (data: ReceiptData): Promise<Buffer> => {
  return buildReceiptPdfBuffer(data)
}
