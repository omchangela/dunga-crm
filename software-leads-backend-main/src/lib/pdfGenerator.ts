import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Locate logo file
function getLogoPath(): string | null {
  const candidates = [
    path.join(__dirname, '../../assets/dunga_logo.png'),
    'C:/xampp/htdocs/dunga_tech/DUNGA TECH LOGO-01.png',
    path.join(process.cwd(), 'assets/dunga_logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const LOGO_PATH = getLogoPath();

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
    doc.moveTo(40, 785).lineTo(555, 785).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
       .text('Dunga Technologies • Phone: +91 8121923831 • Email: Sales@dungatechnologies.com • www.dungatechnologies.com', 40, 790, { align: 'left', lineBreak: false });
    doc.text(`Page ${i + 1} of ${pageCount}`, 450, 790, { align: 'right', width: 105, lineBreak: false });
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
  const primaryColor = '#0f2b5c';
  const secondaryColor = '#0971fe';
  const darkText = '#1e293b';
  const mutedText = '#64748b';

  let y = 35;

  // --- HEADER ---
  if (LOGO_PATH) {
    try {
      doc.image(LOGO_PATH, 40, y, { fit: [180, 50] });
    } catch {
      doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, y, { lineBreak: false });
    }
  } else {
    doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, y, { lineBreak: false });
  }

  doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold').text(documentTitle, 230, y + 4, { align: 'right', lineBreak: false });
  doc.fillColor(mutedText).fontSize(8.5).font('Helvetica').text('Version: 1.0', 230, y + 20, { align: 'right', lineBreak: false });
  doc.text(`Email: Sales@dungatechnologies.com  |  Phone: +91 8121923831`, 230, y + 32, { align: 'right', lineBreak: false });
  doc.text(`Ref ID: ${prefixCode}-${(project.id || '').substring(0, 8).toUpperCase()}  |  Date: ${formatDate(new Date())}`, 230, y + 44, { align: 'right', lineBreak: false });

  y += 60;
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#0f2b5c').lineWidth(1.5).stroke();
  y += 10;

  // Helper function to maintain page breaks gracefully
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > 760) {
      doc.addPage();
      y = 35;
      // Mini Header on subsequent pages
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES — PROJECT DEVELOPMENT AGREEMENT', 40, y, { lineBreak: false });
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(`Ref: ${prefixCode}-${(project.id || '').substring(0, 8).toUpperCase()}`, 400, y, { align: 'right', lineBreak: false });
      y += 14;
      doc.moveTo(40, y).lineTo(555, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      y += 10;
    }
  };

  const renderSectionHeader = (title: string) => {
    doc.rect(40, y, 515, 16).fill('#0f2b5c');
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text(title, 48, y + 4, { lineBreak: false });
    y += 20;
  };

  // 1. AGREEMENT OVERVIEW
  ensureSpace(60);
  renderSectionHeader('1. AGREEMENT OVERVIEW');
  doc.fillColor(darkText).fontSize(8).font('Helvetica');
  const overviewText = 'This Project Development Agreement ("Agreement") is entered into between Dunga Technologies ("Service Provider") and the Client identified in this document.\n\nThis Agreement governs software development, website development, mobile application development, ERP, CRM, digital marketing, branding, SEO, hosting, maintenance, and related services provided by Dunga Technologies.';
  doc.text(overviewText, 40, y, { width: 515 });
  y += doc.heightOfString(overviewText, { width: 515 }) + 8;

  // 2. CLIENT INFORMATION
  ensureSpace(90);
  renderSectionHeader('2. CLIENT INFORMATION');
  doc.rect(40, y, 515, 60).fillAndStroke('#f8fafc', '#cbd5e1');

  const customerName = project.customer?.fullName || project.clientName || '—';
  const companyName = project.customer?.companyName || '—';
  const phone = project.customer?.phone || project.phone || '—';
  const email = project.customer?.email || project.email || '—';
  const projectNo = `${prefixCode}-${(project.id || '').substring(0, 8).toUpperCase()}`;
  const address = [project.customer?.city, project.customer?.state].filter(Boolean).join(', ') || '—';

  doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold').text('Customer Name:', 48, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(customerName, 130, y + 6, { width: 170, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Company Name:', 48, y + 19, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(companyName, 130, y + 19, { width: 170, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Phone Number:', 48, y + 32, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(phone, 130, y + 32, { width: 170, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Email Address:', 48, y + 45, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(email, 130, y + 45, { width: 170, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Number:', 310, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(projectNo, 395, y + 6, { width: 155, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Name:', 310, y + 19, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(project.projectName || '—', 395, y + 19, { width: 155, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Address:', 310, y + 32, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(address, 395, y + 32, { width: 155, height: 12, ellipsis: true, lineBreak: false });

  y += 68;

  // 3. PROJECT INFORMATION
  ensureSpace(100);
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

  doc.rect(40, y, 515, 60).fillAndStroke('#f8fafc', '#cbd5e1');

  doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold').text('Project Name:', 48, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(project.projectName || '—', 140, y + 6, { width: 165, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Category:', 48, y + 19, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(project.serviceType || project.projectType || 'Software Development', 140, y + 19, { width: 165, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Estimated Delivery:', 48, y + 32, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(deliveryTimeStr, 140, y + 32, { width: 165, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Support Period:', 48, y + 45, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica').text(project.supportPeriod || 'Standard Support', 140, y + 45, { width: 165, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Cost:', 320, y + 6, { lineBreak: false });
  doc.fillColor(darkText).font('Helvetica-Bold').text(formatINR(totalBudget), 415, y + 6, { width: 130, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Advance Payment:', 320, y + 19, { lineBreak: false });
  doc.fillColor('#059669').font('Helvetica-Bold').text(formatINR(advancePayment), 415, y + 19, { width: 130, height: 12, ellipsis: true, lineBreak: false });

  doc.fillColor(mutedText).font('Helvetica-Bold').text('Balance Amount:', 320, y + 32, { lineBreak: false });
  doc.fillColor('#d97706').font('Helvetica-Bold').text(formatINR(balanceAmount), 415, y + 32, { width: 130, height: 12, ellipsis: true, lineBreak: false });

  y += 68;

  // Project Description & Scope
  if (project.description) {
    ensureSpace(25);
    doc.fillColor(secondaryColor).fontSize(8.5).font('Helvetica-Bold').text('Project Description:', 40, y, { lineBreak: false });
    y += 10;
    doc.fillColor(darkText).fontSize(8).font('Helvetica').text(project.description, 40, y, { width: 515 });
    y += doc.heightOfString(project.description, { width: 515 }) + 6;
  }

  // Web/App/Admin features or deliverables
  const webList = project.webOverview || project.overview?.web || [];
  const appList = project.appOverview || project.overview?.app || [];
  const adminList = project.adminOverview || project.overview?.admin || [];

  if (webList.length || appList.length || adminList.length || timelines.length) {
    ensureSpace(20);
    doc.fillColor(secondaryColor).fontSize(8.5).font('Helvetica-Bold').text('Scope of Work & Key Deliverables:', 40, y, { lineBreak: false });
    y += 10;

    const renderList = (catTitle: string, items: string[]) => {
      if (!items.length) return;
      ensureSpace(12);
      doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text(catTitle, 45, y, { lineBreak: false });
      y += 9;
      items.forEach((it: string) => {
        const textStr = `• ${it}`;
        const lineH = doc.heightOfString(textStr, { width: 495 }) + 1;
        ensureSpace(lineH);
        doc.fillColor(darkText).fontSize(8).font('Helvetica').text(textStr, 55, y, { width: 495 });
        y += lineH;
      });
      y += 2;
    };

    renderList('Web Platform Features:', webList);
    renderList('Mobile Application Features:', appList);
    renderList('Admin Dashboard & Backend:', adminList);

    if (timelines.length > 0) {
      ensureSpace(12);
      doc.fillColor(darkText).fontSize(8).font('Helvetica-Bold').text('Milestone Deliverables Schedule:', 45, y, { lineBreak: false });
      y += 9;
      timelines.forEach((t: any) => {
        const textStr = `• ${t.description || 'Milestone Phase'} (${t.workingDays || 0} Working Days)`;
        const lineH = doc.heightOfString(textStr, { width: 495 }) + 1;
        ensureSpace(lineH);
        doc.fillColor(darkText).fontSize(8).font('Helvetica').text(textStr, 55, y, { width: 495 });
        y += lineH;
      });
      y += 3;
    }
  }

  y += 4;

  // 4. SERVICES OFFERED
  ensureSpace(90);
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
    doc.fillColor(darkText).fontSize(8).font('Helvetica').text(services[i], 48, y, { lineBreak: false });
    if (services[i + 1]) {
      doc.text(services[i + 1], 300, y, { lineBreak: false });
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
      const lineH = doc.heightOfString(textLine, { width: 505 }) + 2;
      doc.fillColor(darkText).fontSize(8).font('Helvetica').text(textLine, 45, y, { width: 505 });
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
  ensureSpace(110);
  renderSectionHeader('19. ACCEPTANCE');
  doc.fillColor(darkText).fontSize(8).font('Helvetica')
     .text('By signing below, the Client confirms acceptance of all terms and conditions contained in this Agreement.', 40, y, { lineBreak: false });
  y += 14;

  const sigY = y;
  // Client Signature Box
  doc.rect(40, sigY, 240, 80).strokeColor('#cbd5e1').stroke();
  doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('CLIENT SIGNATURE', 48, sigY + 6, { lineBreak: false });
  doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`Name: ${customerName}`, 48, sigY + 22, { lineBreak: false });
  doc.text(`Date: ________________________`, 48, sigY + 38, { lineBreak: false });
  doc.text(`Signature: ____________________`, 48, sigY + 58, { lineBreak: false });

  // Dunga Technologies Signature Box
  doc.rect(315, sigY, 240, 80).strokeColor('#cbd5e1').stroke();
  doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('AUTHORIZED SIGNATORY', 323, sigY + 6, { lineBreak: false });
  doc.fillColor(secondaryColor).fontSize(8).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 323, sigY + 18, { lineBreak: false });
  doc.fillColor(darkText).fontSize(8).font('Helvetica').text(`Name: ________________________`, 323, sigY + 32, { lineBreak: false });
  doc.text(`Designation: __________________`, 323, sigY + 46, { lineBreak: false });
  doc.text(`Date: ________________________`, 323, sigY + 60, { lineBreak: false });
  doc.fillColor(mutedText).fontSize(7.5).font('Helvetica-Oblique').text('(Company Seal)', 465, sigY + 68, { lineBreak: false });

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

      const primaryColor = '#0f2b5c';
      const secondaryColor = '#0971fe';
      const accentGreen = '#059669';
      const darkText = '#1e293b';
      const mutedText = '#64748b';

      let topY = 35;
      if (LOGO_PATH) {
        try {
          doc.image(LOGO_PATH, 40, topY, { fit: [180, 50] });
        } catch {
          doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY, { lineBreak: false });
        }
      } else {
        doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY, { lineBreak: false });
      }

      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', 250, topY + 5, { align: 'right', lineBreak: false });
      doc.fillColor(mutedText).fontSize(8.5).font('Helvetica').text(`Receipt Date: ${formatDate(receiptData.date || new Date())}`, 250, topY + 26, { align: 'right', lineBreak: false });
      doc.text(`Receipt No: ${receiptData.receiptNo}`, 250, topY + 38, { align: 'right', lineBreak: false });

      doc.moveTo(40, topY + 58).lineTo(555, topY + 58).strokeColor('#0f2b5c').lineWidth(1.5).stroke();

      let y = topY + 70;

      // PAID BADGE & CUSTOMER DETAILS
      doc.rect(40, y, 515, 80).fillAndStroke('#f8fafc', '#cbd5e1');

      doc.rect(460, y + 10, 80, 22).fill('#10b981');
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('PAID', 460, y + 15, { align: 'center', width: 80, lineBreak: false });

      doc.fillColor(secondaryColor).fontSize(10).font('Helvetica-Bold').text('RECEIVED FROM', 52, y + 10, { lineBreak: false });
      doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold').text(receiptData.customerName, 52, y + 25, { lineBreak: false });
      doc.fillColor(mutedText).fontSize(8.5).font('Helvetica').text(`Phone: ${receiptData.customerPhone || '—'}  |  Email: ${receiptData.customerEmail || '—'}`, 52, y + 42, { lineBreak: false });
      if (receiptData.applicationNumber) {
        doc.text(`App No: ${receiptData.applicationNumber}`, 52, y + 56, { lineBreak: false });
      }

      y += 95;

      // PAYMENT BREAKDOWN TABLE
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('PAYMENT TRANSACTION DETAILS', 40, y, { lineBreak: false });
      y += 14;

      doc.rect(40, y, 515, 20).fill('#0f2b5c');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('Project / Milestone Description', 50, y + 5, { lineBreak: false });
      doc.text('Amount Received (INR)', 400, y + 5, { align: 'right', width: 145, lineBreak: false });
      y += 20;

      doc.rect(40, y, 515, 26).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(receiptData.projectName, 50, y + 5, { lineBreak: false });
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(receiptData.paymentDescription || 'Installment Payment', 50, y + 15, { lineBreak: false });
      doc.fillColor(accentGreen).fontSize(11).font('Helvetica-Bold').text(formatINR(receiptData.amountPaid), 400, y + 7, { align: 'right', width: 145, lineBreak: false });
      y += 34;

      // ACCOUNT FINANCIAL SUMMARY
      doc.rect(40, y, 515, 55).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold').text('Total Project Cost:', 52, y + 12, { lineBreak: false });
      doc.text(formatINR(receiptData.totalBudget), 160, y + 12, { lineBreak: false });

      doc.fillColor(darkText).font('Helvetica-Bold').text('Total Paid to Date:', 52, y + 26, { lineBreak: false });
      doc.fillColor(accentGreen).text(formatINR(receiptData.totalPaid), 160, y + 26, { lineBreak: false });

      doc.fillColor(darkText).font('Helvetica-Bold').text('Remaining Balance:', 52, y + 40, { lineBreak: false });
      doc.fillColor(receiptData.remainingBalance > 0 ? '#d97706' : accentGreen).text(formatINR(receiptData.remainingBalance), 160, y + 40, { lineBreak: false });

      y += 75;

      // STAMP / FOOTER STATEMENT
      doc.rect(40, y, 515, 50).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc.fillColor(accentGreen).fontSize(9).font('Helvetica-Bold').text('Official Computer Generated Receipt', 52, y + 12, { lineBreak: false });
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text('This receipt serves as proof of payment received by Dunga Technologies. No physical signature required.', 52, y + 26);

      addFooterToAllPages(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
