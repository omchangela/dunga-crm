import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const fmt = (n: number) =>
    String.fromCharCode(8377) + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

export interface ReceiptData {
    receiptNo:     string
    paymentDate:   string | Date
    amount:        number
    paymentMethod: string
    transactionId?: string | null
    note?:          string | null
    project: {
        projectName: string
        serviceType?: string | null
        id: string
    }
    customer?: {
        fullName?: string | null
        phone?:    string | null
        email?:    string | null
    } | null
}

export const generateReceiptPdf = async (data: ReceiptData): Promise<Buffer> => {
    const rupee = String.fromCharCode(8377)
    const amtFormatted = rupee + data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const dateFormatted = fmtDate(data.paymentDate)

    const transactionRow = data.transactionId ? `
      <div class="info-item">
        <div class="info-label">Transaction Ref.</div>
        <div class="info-value mono">${data.transactionId}</div>
      </div>` : ''

    const serviceRow = data.project.serviceType ? `
      <div class="info-item">
        <div class="info-label">Service Type</div>
        <div class="info-value">${data.project.serviceType}</div>
      </div>` : ''

    const customerSection = data.customer?.fullName ? `
    <div class="section-title">Client Information</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Client Name</div>
        <div class="info-value">${data.customer.fullName}</div>
      </div>
      ${data.customer.phone ? `<div class="info-item"><div class="info-label">Phone</div><div class="info-value">${data.customer.phone}</div></div>` : ''}
      ${data.customer.email ? `<div class="info-item" style="grid-column:1/-1"><div class="info-label">Email</div><div class="info-value">${data.customer.email}</div></div>` : ''}
    </div>` : ''

    const noteSection = data.note ? `
    <div class="note-box">
      <div class="note-label">Note</div>
      ${data.note}
    </div>` : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f4f6fb;color:#1a2035;font-size:13px}
.page{background:#fff;max-width:680px;margin:32px auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(9,113,254,.10);position:relative}
.header{background:linear-gradient(135deg,#0971fe 0%,#1a2035 100%);padding:36px 48px 28px;color:#fff;position:relative;overflow:hidden}
.header::before{content:'';position:absolute;right:-60px;top:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.07)}
.header-inner{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start}
.company-name{font-size:22px;font-weight:800;letter-spacing:-.5px}
.company-sub{font-size:11px;color:rgba(255,255,255,.65);margin-top:3px}
.receipt-badge{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:10px 18px;text-align:right}
.receipt-badge .label{font-size:10px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:1px}
.receipt-badge .value{font-size:18px;font-weight:800;margin-top:2px}
.paid-strip{background:#10b981;color:#fff;text-align:center;padding:10px 0;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase}
.body{padding:36px 48px}
.amount-hero{text-align:center;padding:28px 0 24px;border-bottom:1px solid #edf0f7;margin-bottom:28px}
.amount-label{font-size:11px;font-weight:600;color:#8094ae;text-transform:uppercase;letter-spacing:1px}
.amount-value{font-size:42px;font-weight:800;color:#0971fe;letter-spacing:-1px;margin-top:6px}
.amount-date{font-size:12px;color:#8094ae;margin-top:6px}
.section-title{font-size:11px;font-weight:700;color:#0971fe;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e9f1ff}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;margin-bottom:28px}
.info-item .info-label{font-size:10px;font-weight:600;color:#8094ae;text-transform:uppercase;letter-spacing:.8px}
.info-item .info-value{font-size:13px;font-weight:600;color:#1a2035;margin-top:3px}
.info-item .info-value.mono{font-family:monospace;font-size:12px;color:#4a5568}
.method-chip{display:inline-flex;align-items:center;background:#e9f1ff;color:#0971fe;border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700}
.note-box{background:#f8fafc;border:1px solid #e9edf5;border-radius:10px;padding:14px 18px;margin-bottom:28px;font-size:12px;color:#4a5568}
.note-box .note-label{font-size:10px;font-weight:700;color:#8094ae;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
.footer{border-top:1px solid #edf0f7;padding:20px 48px;display:flex;justify-content:space-between;align-items:center;background:#f8fafc}
.footer-contact{font-size:10px;color:#8094ae;line-height:1.8}
.footer-thanks{font-size:11px;font-weight:700;color:#0971fe}
.watermark{position:absolute;bottom:80px;right:48px;opacity:.04;font-size:120px;font-weight:900;color:#0971fe;pointer-events:none;transform:rotate(-20deg)}
</style>
</head>
<body>
<div class="page">
  <div class="watermark">PAID</div>
  <div class="header">
    <div class="header-inner">
      <div>
        <div class="company-name">Dunga Technologies</div>
        <div class="company-sub">www.dungatechnologies.com &middot; +91 8013902831</div>
        <div class="company-sub" style="margin-top:2px">sales@dungatechnologies.com</div>
      </div>
      <div class="receipt-badge">
        <div class="label">Payment Receipt</div>
        <div class="value">#${data.receiptNo}</div>
      </div>
    </div>
  </div>
  <div class="paid-strip">&#10003; &nbsp; Payment Received</div>
  <div class="body">
    <div class="amount-hero">
      <div class="amount-label">Amount Paid</div>
      <div class="amount-value">${amtFormatted}</div>
      <div class="amount-date">Received on ${dateFormatted}</div>
    </div>
    <div class="section-title">Payment Details</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Receipt No.</div>
        <div class="info-value mono">#${data.receiptNo}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Payment Date</div>
        <div class="info-value">${dateFormatted}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Payment Mode</div>
        <div class="info-value"><span class="method-chip">${data.paymentMethod}</span></div>
      </div>
      ${transactionRow}
    </div>
    <div class="section-title">Project Information</div>
    <div class="info-grid">
      <div class="info-item" style="grid-column:1/-1">
        <div class="info-label">Project Name</div>
        <div class="info-value" style="font-size:15px">${data.project.projectName}</div>
      </div>
      ${serviceRow}
    </div>
    ${customerSection}
    ${noteSection}
  </div>
  <div class="footer">
    <div class="footer-contact">
      Dunga Technologies Pvt. Ltd.<br/>
      +91 8013902831 &middot; sales@dungatechnologies.com<br/>
      www.dungatechnologies.com
    </div>
    <div class="footer-thanks">Thank you for your business!</div>
  </div>
</div>
</body>
</html>`

    const isProduction = process.env.NODE_ENV === 'production'
    const browser = isProduction
        ? await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true })
        : await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        })
    try {
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'load' })
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } })
        return Buffer.from(pdfBuffer)
    } finally {
        await browser.close()
    }
}
