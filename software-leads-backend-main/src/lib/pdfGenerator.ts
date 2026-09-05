import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Locate letterhead background image
function getLetterheadPath(): string | null {
  const candidates = [
    path.join(__dirname, '../../assets/dunga_letterhead.jpg'),
    'C:/xampp/htdocs/dunga_tech/WhatsApp Image 2026-09-05 at 8.58.31 PM.jpeg',
    path.join(process.cwd(), 'assets/dunga_letterhead.jpg'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const LETTERHEAD_PATH = getLetterheadPath();

function drawLetterheadBackground(doc: any) {
  if (LETTERHEAD_PATH) {
    try {
      doc.image(LETTERHEAD_PATH, 0, 0, { width: 595.28, height: 841.89 });
    } catch (e) {
      console.error('Failed to render letterhead background:', e);
    }
  }
}

function formatINR(val: number | string): string {
  const num = parseFloat(String(val || 0));
  return '₹' + num.toLocaleString('en-IN');
}

function formatDate(val: any): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return String(val);
  }
}

function addFooterToAllPages(doc: any) {
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
       .text(`Page ${i + 1} of ${pageCount}`, 45, 785, { align: 'left', lineBreak: false });
  }
}

// ── 1. ESTIMATION & PROPOSAL PDF (AGREEMENT VER. 1.0) ─────────────────────────
export async function buildEstimationPdfBuffer(project: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      renderAgreementPdf(doc, project, 'PROJECT ESTIMATION & PROPOSAL', 'EST');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── 2. MASTER PROJECT CONTRACT PDF (AGREEMENT VER. 1.0) ──────────────────────
export async function buildProjectContractPdfBuffer(project: any, developers: any[] = []): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      renderAgreementPdf(doc, project, 'PROJECT DEVELOPMENT AGREEMENT', 'DNG-PRJ', developers);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Core function to render the 19-Section Dunga Technologies Agreement
function renderAgreementPdf(
  doc: any,
  project: any,
  documentTitle: string,
  prefixCode: string,
  developers: any[] = []
) {
  // Brand color scheme matching Dunga letterhead
  const primaryTeal = '#007a87';
  const accentOrange = '#e05a10';
  const darkText = '#1e293b';
  const mutedText = '#64748b';

  // Draw background letterhead on first page
  drawLetterheadBackground(doc);

  // Document Title & Metadata block aligned neatly on top right (x=140..465)
  doc.fillColor(primaryTeal).fontSize(11).font('Helvetica-Bold').text(documentTitle, 140, 48, { width: 325, align: 'right', lineBreak: false });
  doc.fillColor(accentOrange).fontSize(8.5).font('Helvetica-Bold').text('Version: 1.0', 140, 64, { width: 325, align: 'right', lineBreak: false });
  doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(`Ref ID: ${prefixCode}-${(project.id || '').substring(0, 8).toUpperCase()}  |  Date: ${formatDate(new Date())}`, 140, 76, { width: 325, align: 'right', lineBreak: false });

  let y = 160; // Spacious 50pt margin below letterhead header logo & cut line

  // Helper function to maintain page breaks gracefully within letterhead bounds
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > 670) {
      doc.addPage();
      drawLetterheadBackground(doc);
      // Mini Header on subsequent pages
      doc.fillColor(primaryTeal).fontSize(9).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES — PROJECT DEVELOPMENT AGREEMENT', 140, 48, { width: 325, align: 'right', lineBreak: false });
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(`Ref: ${prefixCode}-${(project.id || '').substring(0, 8).toUpperCase()}`, 140, 60, { width: 325, align: 'right', lineBreak: false });
      y = 160;
    }
  };

  const renderSectionHeader = (title: string) => {
    doc.rect(45, y, 450, 16).fill(primaryTeal);
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text(title, 53, y + 4, { lineBreak: false });
    y += 20;
  };

  // 1. AGREEMENT OVERVIEW
  ensureSpace(60);
  renderSectionHeader('1. AGREEMENT OVERVIEW');
  doc.fillColor(darkText).fontSize(8).font('Helvetica');
  const overviewText = 'This Project Development Agreement ("Agreement") is entered into between Dunga Technologies ("Service Provider") and the Client identified in this document.\n\nThis Agreement governs software development, website development, mobile application development, ERP, CRM, digital marketing, branding, SEO, hosting, maintenance, and related services provided by Dunga Technologies.';
  doc.text(overviewText, 45, y, { width: 450 });
  y += doc.heightOfString(overviewText, { width: 450 }) + 8;

  // 2. CLIENT INFORMATION
  ensureSpace(85);
  renderSectionHeader('2. CLIENT INFORMATION');
  doc.rect(45, y, 450, 60).fillAndStroke('#f0fdfa', '#a7f3d0');

  const customerName = project.customer?.fullName || project.clientName || '—';
  const companyName = project.customer?.companyName || '—';
  const phone = project.customer?.phone || project.phone || '—';
  const email = project.customer?.email || project.email || '—';
  const projectNo = `${prefixCode}-${(project.id || '').substring(0, 8).toUpperCase()}`;
  const address = [project.customer?.city, project.customer?.state].filter(Boolean).join(', ') || '—';

  doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold').text('Customer Name:', 53, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(customerName, 135, y + 6, { width: 145, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Company Name:', 53, y + 19, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(companyName, 135, y + 19, { width: 145, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Phone Number:', 53, y + 32, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(phone, 135, y + 32, { width: 145, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Email Address:', 53, y + 45, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(email, 135, y + 45, { width: 145, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Number:', 285, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(projectNo, 365, y + 6, { width: 125, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Name:', 285, y + 19, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(project.projectName || '—', 365, y + 19, { width: 125, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Address:', 285, y + 32, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(address, 365, y + 32, { width: 125, height: 12, ellipsis: true, lineBreak: false });

  y += 68;

  // 3. PROJECT INFORMATION
  ensureSpace(95);
  renderSectionHeader('3. PROJECT INFORMATION');

  const payments = project.payments || [];
  const baseBudget = Number(project.budget) || 0;
  const history = project.costHistory || [];
  const featTotal = history.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const totalBudget = baseBudget + featTotal;

  const advancePayment = payments.length > 0 ? Number(payments[0].amount || 0) : Math.round(totalBudget * 0.4);
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const balanceAmount = Math.max(0, totalBudget - totalPaid);

  const timelines = project.timelines || [];
  const totalDays = timelines.reduce((s: number, t: any) => s + Number(t.workingDays || 0), 0);
  const deliveryTimeStr = totalDays > 0 ? `${totalDays} Working Days` : (project.deadline ? formatDate(project.deadline) : 'As per Milestone Schedule');

  doc.rect(45, y, 450, 60).fillAndStroke('#fff7ed', '#ffedd5');

  doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold').text('Project Name:', 53, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(project.projectName || '—', 140, y + 6, { width: 140, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Category:', 53, y + 19, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(project.serviceType || project.projectType || 'Software Development', 140, y + 19, { width: 140, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Estimated Delivery:', 53, y + 32, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(deliveryTimeStr, 140, y + 32, { width: 140, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Support Period:', 53, y + 45, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(project.supportPeriod || 'Standard Support', 140, y + 45, { width: 140, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Cost:', 295, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(formatINR(totalBudget), 385, y + 6, { width: 105, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Advance Payment:', 295, y + 19, { lineBreak: false });
  doc.fillColor(primaryTeal).font('Helvetica-Bold').text(formatINR(advancePayment), 385, y + 19, { width: 105, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Balance Amount:', 295, y + 32, { lineBreak: false });
  doc.fillColor(accentOrange).font('Helvetica-Bold').text(formatINR(balanceAmount), 385, y + 32, { width: 105, height: 12, ellipsis: true, lineBreak: false });

  y += 68;

  // Project Description & Scope
  if (project.description) {
    ensureSpace(25);
    doc.fillColor(accentOrange).fontSize(8.5).font('Helvetica-Bold').text('Project Description:', 45, y, { lineBreak: false });
    y += 10;
    doc.fillColor(darkText).fontSize(8).font('Helvetica').text(project.description, 45, y, { width: 450 });
    y += doc.heightOfString(project.description, { width: 450 }) + 6;
  }

  // Web/App/Admin features or deliverables
  const webList = project.webOverview || project.overview?.web || [];
  const appList = project.appOverview || project.overview?.app || [];
  const adminList = project.adminOverview || project.overview?.admin || [];

  if (webList.length || appList.length || adminList.length || timelines.length) {
    ensureSpace(20);
    doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold').text('Scope of Work & Key Deliverables:', 45, y, { lineBreak: false });
    y += 10;

    const renderList = (catTitle: string, items: string[]) => {
      if (!items.length) return;
      ensureSpace(12);
      doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text(catTitle, 50, y, { lineBreak: false });
      y += 9;
      items.forEach((it: string) => {
        const textStr = `• ${it}`;
        const lineH = doc.heightOfString(textStr, { width: 440 }) + 1;
        ensureSpace(lineH);
        doc.fillColor(darkText).fontSize(8).font('Helvetica').text(textStr, 60, y, { width: 440 });
        y += lineH;
      });
      y += 2;
    };

    renderList('Web Platform Features:', webList);
    renderList('Mobile Application Features:', appList);
    renderList('Admin Dashboard & Backend:', adminList);

    if (timelines.length > 0) {
      ensureSpace(12);
      doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text('Milestone Deliverables Schedule:', 50, y, { lineBreak: false });
      y += 9;
      timelines.forEach((t: any) => {
        const textStr = `• ${t.description || 'Milestone Phase'} (${t.workingDays || 0} Working Days)`;
        const lineH = doc.heightOfString(textStr, { width: 440 }) + 1;
        ensureSpace(lineH);
        doc.fillColor(darkText).fontSize(8).font('Helvetica').text(textStr, 60, y, { width: 440 });
        y += lineH;
      });
      y += 3;
    }
  }

  y += 4;

  // 4. SERVICES OFFERED
  ensureSpace(95);
  renderSectionHeader('4. SERVICES OFFERED');
  const services = [
    '• Website Design & Development',
    '• Mobile App Development',
    '• Software Development',
    '• ERP Solutions',
    '• CRM Solutions',
    '• E-Commerce Development',
    '• Digital Marketing',
    '• SEO Services',
    '• Social Media Marketing',
    '• Google Ads Management',
    '• Meta Ads Management',
    '• Branding & Creative Design',
    '• Hosting & Domain Services',
    '• Technical Support & Maintenance',
  ];

  for (let i = 0; i < services.length; i += 2) {
    doc.fillColor(darkText).fontSize(8).font('Helvetica').text(services[i], 53, y, { lineBreak: false });
    if (services[i + 1]) {
      doc.text(services[i + 1], 280, y, { lineBreak: false });
    }
    y += 10;
  }
  y += 6;

  // Helper for legal sections
  const renderLegalSection = (secNum: string, title: string, points: string[]) => {
    const estHeight = 22 + points.length * 14;
    ensureSpace(estHeight);
    renderSectionHeader(`${secNum}. ${title}`);
    points.forEach((p, idx) => {
      const textLine = `${idx + 1}. ${p}`;
      const lineH = doc.heightOfString(textLine, { width: 440 }) + 2;
      doc.fillColor(darkText).fontSize(8).font('Helvetica').text(textLine, 50, y, { width: 440 });
      y += lineH;
    });
    y += 3;
  };

  // 5. PAYMENT TERMS
  renderLegalSection('5', 'PAYMENT TERMS', [
    'Minimum advance payment is required before project commencement.',
    'Development begins only after receipt of advance payment.',
    'Remaining payment shall be made according to agreed milestones.',
    'Final delivery will be provided only after full payment clearance.',
    'Delayed payments may result in project suspension.',
  ]);

  // 6. LATE PAYMENT POLICY
  renderLegalSection('6', 'LATE PAYMENT POLICY', [
    'Dunga Technologies reserves the right to suspend services for overdue payments.',
    'Any delay caused due to non-payment shall not be considered a breach by Dunga Technologies.',
    'Hosting, domains, cloud services, APIs, SMS services, WhatsApp services, and third-party subscriptions may be suspended for unpaid invoices.',
    'Dunga Technologies shall not be responsible for losses caused by payment delays from the client.',
  ]);

  // 7. CHANGE REQUEST POLICY
  renderLegalSection('7', 'CHANGE REQUEST POLICY', [
    'Additional features requested after approval are chargeable.',
    'Scope changes may impact project timelines.',
    'New requirements shall be treated as separate work orders.',
    'Extra work amount will be charged separately.',
  ]);

  // 8. DELIVERY TIMELINE
  renderLegalSection('8', 'DELIVERY TIMELINE', [
    'Project duration starts from: (a) Advance payment date, (b) Receipt of required project materials.',
    'Client delays may affect timelines.',
    'Force majeure events may extend delivery dates.',
  ]);

  // 9. MAINTENANCE & SUPPORT
  renderLegalSection('9', 'MAINTENANCE & SUPPORT', [
    'Basic support will be provided as agreed.',
    'Additional maintenance shall be chargeable.',
    'Database growth, server upgrades, and storage expansion are chargeable.',
    'Annual maintenance contracts may be required.',
  ]);

  // 10. INTELLECTUAL PROPERTY
  renderLegalSection('10', 'INTELLECTUAL PROPERTY', [
    'Source code remains property of Dunga Technologies until full payment is received.',
    'Unauthorized use, copying, resale, or modification is prohibited.',
    'Ownership transfer occurs only after final settlement.',
  ]);

  // 11. CONFIDENTIALITY
  renderLegalSection('11', 'CONFIDENTIALITY', [
    'Both parties agree to keep confidential information private and not disclose it to third parties without written consent.',
  ]);

  // 12. DIGITAL MARKETING DISCLAIMER
  renderLegalSection('12', 'DIGITAL MARKETING DISCLAIMER', [
    'Marketing results depend on market conditions.',
    'Rankings and lead generation cannot be guaranteed.',
    'Ad budgets are separate from service fees.',
    'Platform policies may affect campaign performance.',
  ]);

  // 13. WEBSITE & SOFTWARE DISCLAIMER
  renderLegalSection('13', 'WEBSITE & SOFTWARE DISCLAIMER', [
    'Dunga Technologies is not responsible for third-party outages.',
    'Hosting provider failures are beyond company control.',
    'Third-party integrations may change without notice.',
  ]);

  // 14. CANCELLATION & REFUND POLICY
  renderLegalSection('14', 'CANCELLATION & REFUND POLICY', [
    'Advance payments are non-refundable.',
    'Completed work remains billable.',
    'Cancellation by client does not waive payment obligations.',
    'Domain, hosting, and third-party expenses are non-refundable.',
  ]);

  // 15. LIMITATION OF LIABILITY
  renderLegalSection('15', 'LIMITATION OF LIABILITY', [
    'Dunga Technologies shall not be liable for indirect damages.',
    'Loss of profits, business interruption, or consequential losses are excluded.',
    'Maximum liability shall not exceed the amount paid by the client.',
  ]);

  // 16. LEGAL COMPLIANCE
  renderLegalSection('16', 'LEGAL COMPLIANCE', [
    'Client is responsible for ensuring that all supplied content complies with applicable laws and regulations.',
  ]);

  // 17. DISPUTE RESOLUTION
  renderLegalSection('17', 'DISPUTE RESOLUTION', [
    'Any dispute shall first be resolved through negotiation. If unresolved, jurisdiction shall lie within the competent courts having authority over Dunga Technologies\' place of business.',
  ]);

  // 18. TERMINATION
  renderLegalSection('18', 'TERMINATION', [
    'Either party may terminate the agreement through written notice subject to settlement of all outstanding obligations.',
  ]);

  // 19. ACCEPTANCE & SIGNATURES
  ensureSpace(105);
  renderSectionHeader('19. ACCEPTANCE');
  doc.fillColor(darkText).fontSize(8).font('Helvetica')
     .text('By signing below, the Client confirms acceptance of all terms and conditions contained in this Agreement.', 45, y, { lineBreak: false });
  y += 14;

  const sigY = y;
  // Client Signature Box
  doc.rect(45, sigY, 215, 75).strokeColor('#cbd5e1').stroke();
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold').text('CLIENT SIGNATURE', 53, sigY + 6, { lineBreak: false });
  doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`Name: ${customerName}`, 53, sigY + 22, { lineBreak: false });
  doc.text(`Date: ________________________`, 53, sigY + 36, { lineBreak: false });
  doc.text(`Signature: ____________________`, 53, sigY + 54, { lineBreak: false });

  // Dunga Technologies Signature Box
  doc.rect(280, sigY, 215, 75).strokeColor('#cbd5e1').stroke();
  doc.fillColor(primaryTeal).fontSize(8.5).font('Helvetica-Bold').text('AUTHORIZED SIGNATORY', 288, sigY + 6, { lineBreak: false });
  doc.fillColor(accentOrange).fontSize(8).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 288, sigY + 18, { lineBreak: false });
  doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`Name: ________________________`, 288, sigY + 32, { lineBreak: false });
  doc.text(`Designation: __________________`, 288, sigY + 44, { lineBreak: false });
  doc.text(`Date: ________________________`, 288, sigY + 56, { lineBreak: false });
  doc.fillColor(mutedText).fontSize(7.5).font('Helvetica-Oblique').text('(Company Seal)', 425, sigY + 62, { lineBreak: false });

  // Add footers on all generated pages
  addFooterToAllPages(doc);
}

// ── 3. PAYMENT RECEIPT PDF ───────────────────────────────────────────────────
export async function buildPaymentReceiptPdfBuffer(receiptData: {
  receiptNo: string;
  date: any;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  applicationNumber?: string;
  projectName: string;
  paymentDescription: string;
  amountPaid: number;
  totalBudget: number;
  totalPaid: number;
  remainingBalance: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const primaryTeal = '#007a87';
      const accentOrange = '#e05a10';
      const darkText = '#1e293b';
      const mutedText = '#64748b';

      drawLetterheadBackground(doc);

      doc.fillColor(primaryTeal).fontSize(15).font('Helvetica-Bold').text('PAYMENT RECEIPT', 140, 48, { width: 325, align: 'right', lineBreak: false });
      doc.fillColor(accentOrange).fontSize(8.5).font('Helvetica-Bold').text(`Receipt Date: ${formatDate(receiptData.date || new Date())}`, 140, 66, { width: 325, align: 'right', lineBreak: false });
      doc.fillColor(mutedText).fontSize(8.5).font('Helvetica').text(`Receipt No: ${receiptData.receiptNo}`, 140, 78, { width: 325, align: 'right', lineBreak: false });

      let y = 160;

      // PAID BADGE & CUSTOMER DETAILS
      doc.rect(45, y, 450, 75).fillAndStroke('#f0fdfa', '#cbd5e1');

      doc.rect(400, y + 10, 80, 22).fill('#10b981');
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('PAID', 400, y + 15, { align: 'center', width: 80, lineBreak: false });

      doc.fillColor(primaryTeal).fontSize(10).font('Helvetica-Bold').text('RECEIVED FROM', 57, y + 10, { lineBreak: false });
      doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold').text(receiptData.customerName, 57, y + 23, { lineBreak: false });
      doc.fillColor(mutedText).fontSize(8.5).font('Helvetica').text(`Phone: ${receiptData.customerPhone || '—'}  |  Email: ${receiptData.customerEmail || '—'}`, 57, y + 39, { lineBreak: false });
      if (receiptData.applicationNumber) {
        doc.text(`App No: ${receiptData.applicationNumber}`, 57, y + 53, { lineBreak: false });
      }

      y += 90;

      // PAYMENT BREAKDOWN TABLE
      doc.fillColor(primaryTeal).fontSize(10).font('Helvetica-Bold').text('PAYMENT TRANSACTION DETAILS', 45, y, { lineBreak: false });
      y += 14;

      doc.rect(45, y, 450, 20).fill(primaryTeal);
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('Project / Milestone Description', 55, y + 5, { lineBreak: false });
      doc.text('Amount Received (INR)', 350, y + 5, { align: 'right', width: 135, lineBreak: false });
      y += 20;

      doc.rect(45, y, 450, 26).fillAndStroke('#ffffff', '#cbd5e1');
      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(receiptData.projectName, 55, y + 5, { lineBreak: false });
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(receiptData.paymentDescription || 'Installment Payment', 55, y + 15, { lineBreak: false });
      doc.fillColor(primaryTeal).fontSize(11).font('Helvetica-Bold').text(formatINR(receiptData.amountPaid), 350, y + 7, { align: 'right', width: 135, lineBreak: false });
      y += 34;

      // ACCOUNT FINANCIAL SUMMARY
      doc.rect(45, y, 450, 55).fillAndStroke('#fff7ed', '#ffedd5');
      doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold').text('Total Project Cost:', 57, y + 12, { lineBreak: false });
      doc.text(formatINR(receiptData.totalBudget), 165, y + 12, { lineBreak: false });

      doc.fillColor(darkText).font('Helvetica-Bold').text('Total Paid to Date:', 57, y + 26, { lineBreak: false });
      doc.fillColor(primaryTeal).text(formatINR(receiptData.totalPaid), 165, y + 26, { lineBreak: false });

      doc.fillColor(darkText).font('Helvetica-Bold').text('Remaining Balance:', 57, y + 40, { lineBreak: false });
      doc.fillColor(receiptData.remainingBalance > 0 ? accentOrange : primaryTeal).text(formatINR(receiptData.remainingBalance), 165, y + 40, { lineBreak: false });

      y += 70;

      // STAMP / FOOTER STATEMENT
      doc.rect(45, y, 450, 45).fillAndStroke('#f0fdfa', '#a7f3d0');
      doc.fillColor(primaryTeal).fontSize(9).font('Helvetica-Bold').text('Official Computer Generated Receipt', 57, y + 10, { lineBreak: false });
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text('This receipt serves as proof of payment received by Dunga Technologies. No physical signature required.', 57, y + 24);

      addFooterToAllPages(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
