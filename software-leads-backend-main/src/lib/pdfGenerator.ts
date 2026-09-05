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

// ── 1. ESTIMATION PDF ────────────────────────────────────────────────────────
export async function buildEstimationPdfBuffer(project: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const primaryColor = '#0f2b5c';
      const secondaryColor = '#0971fe';
      const accentGreen = '#059669';
      const darkText = '#1e293b';
      const mutedText = '#64748b';

      // --- HEADER ---
      let topY = 40;
      if (LOGO_PATH) {
        try {
          doc.image(LOGO_PATH, 40, topY, { fit: [180, 50] });
        } catch {
          doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY);
        }
      } else {
        doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY);
      }

      doc.fillColor(primaryColor).fontSize(15).font('Helvetica-Bold').text('PROJECT ESTIMATION & PROPOSAL', 250, topY + 5, { align: 'right' });
      doc.fillColor(mutedText).fontSize(9).font('Helvetica').text(`Proposal Date: ${formatDate(project.createdAt || new Date())}`, 250, topY + 26, { align: 'right' });
      doc.text(`Ref ID: EST-${(project.id || '').substring(0, 8).toUpperCase()}`, 250, topY + 38, { align: 'right' });

      doc.moveTo(40, topY + 60).lineTo(555, topY + 60).strokeColor('#cbd5e1').lineWidth(1).stroke();

      let y = topY + 72;

      // --- CLIENT & PROJECT DETAILS GRID ---
      doc.rect(40, y, 515, 75).fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fillColor(secondaryColor).fontSize(10).font('Helvetica-Bold').text('CLIENT & PROJECT INFORMATION', 52, y + 10);
      
      const clientName = project.customer?.fullName || project.clientName || '—';
      const clientPhone = project.customer?.phone || project.phone || '—';
      const clientEmail = project.customer?.email || project.email || '—';

      doc.fillColor(mutedText).fontSize(8.5).font('Helvetica-Bold').text('Client Name:', 52, y + 28);
      doc.fillColor(darkText).font('Helvetica').text(clientName, 115, y + 28);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Phone:', 52, y + 42);
      doc.fillColor(darkText).font('Helvetica').text(clientPhone, 115, y + 42);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Email:', 52, y + 56);
      doc.fillColor(darkText).font('Helvetica').text(clientEmail, 115, y + 56);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Name:', 300, y + 28);
      doc.fillColor(darkText).font('Helvetica-Bold').text(project.projectName || '—', 375, y + 28);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Service Type:', 300, y + 42);
      doc.fillColor(darkText).font('Helvetica').text(project.serviceType || project.projectType || 'Software Development', 375, y + 42);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Status:', 300, y + 56);
      doc.fillColor(secondaryColor).font('Helvetica-Bold').text(project.status || 'PENDING', 375, y + 56);

      y += 90;

      // --- DESCRIPTION ---
      if (project.description) {
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('PROJECT OVERVIEW & SCOPE', 40, y);
        y += 14;
        doc.fillColor(darkText).fontSize(8.5).font('Helvetica').text(project.description, 40, y, { width: 515 });
        y += doc.heightOfString(project.description, { width: 515 }) + 15;
      }

      // --- CATEGORIZED SCOPE (WEB / APP / ADMIN) ---
      const webList = project.webOverview || project.overview?.web || [];
      const appList = project.appOverview || project.overview?.app || [];
      const adminList = project.adminOverview || project.overview?.admin || [];

      if (webList.length || appList.length || adminList.length) {
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('MODULE SCOPE BREAKDOWN', 40, y);
        y += 14;

        const renderCat = (title: string, items: string[], color: string) => {
          if (!items.length) return;
          doc.fillColor(color).fontSize(9).font('Helvetica-Bold').text(title, 45, y);
          y += 12;
          items.forEach((item: string) => {
            doc.fillColor(darkText).fontSize(8.5).font('Helvetica').text(`•  ${item}`, 55, y, { width: 500 });
            y += 12;
          });
          y += 4;
        };

        renderCat('Web Features:', webList, '#2563eb');
        renderCat('Mobile App Features:', appList, '#059669');
        renderCat('Admin Dashboard Features:', adminList, '#9333ea');
        y += 10;
      }

      // Check remaining page space
      if (y > 650) {
        doc.addPage();
        y = 40;
      }

      // --- PAYMENTS BREAKDOWN TABLE ---
      const payments = project.payments || [];
      if (payments.length > 0) {
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('ESTIMATED FINANCIAL BREAKDOWN', 40, y);
        y += 14;

        // Table Header
        doc.rect(40, y, 515, 20).fill('#0f2b5c');
        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('Component Description', 50, y + 5);
        doc.text('Amount (INR)', 430, y + 5, { align: 'right', width: 115 });
        y += 20;

        let totalPayment = 0;
        payments.forEach((p: any, i: number) => {
          const amt = parseFloat(p.amount || 0);
          totalPayment += amt;
          const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, y, 515, 18).fillAndStroke(bg, '#f1f5f9');
          doc.fillColor(darkText).fontSize(8.5).font('Helvetica').text(p.description || `Phase ${i + 1}`, 50, y + 4);
          doc.fillColor(darkText).font('Helvetica-Bold').text(formatINR(amt), 430, y + 4, { align: 'right', width: 115 });
          y += 18;
        });

        // Total Row
        doc.rect(40, y, 515, 22).fillAndStroke('#ecfdf5', '#10b981');
        doc.fillColor(accentGreen).fontSize(9.5).font('Helvetica-Bold').text('Total Estimated Project Budget', 50, y + 5);
        doc.text(formatINR(totalPayment || project.budget), 430, y + 5, { align: 'right', width: 115 });
        y += 32;
      }

      // --- TIMELINE PHASES TABLE ---
      const timelines = project.timelines || [];
      if (timelines.length > 0) {
        if (y > 660) { doc.addPage(); y = 40; }

        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('PROJECT TIMELINE PHASES', 40, y);
        y += 14;

        doc.rect(40, y, 515, 20).fill('#0f2b5c');
        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('Phase / Milestone Description', 50, y + 5);
        doc.text('Working Days', 430, y + 5, { align: 'right', width: 115 });
        y += 20;

        let totalDays = 0;
        timelines.forEach((t: any, i: number) => {
          const days = parseInt(t.workingDays || 0);
          totalDays += days;
          const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, y, 515, 18).fillAndStroke(bg, '#f1f5f9');
          doc.fillColor(darkText).fontSize(8.5).font('Helvetica').text(t.description || `Milestone ${i + 1}`, 50, y + 4);
          doc.fillColor(darkText).font('Helvetica-Bold').text(`${days} Days`, 430, y + 4, { align: 'right', width: 115 });
          y += 18;
        });

        doc.rect(40, y, 515, 20).fillAndStroke('#eff6ff', '#3b82f6');
        doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Bold').text('Total Working Days Duration', 50, y + 5);
        doc.text(`${totalDays} Working Days`, 430, y + 5, { align: 'right', width: 115 });
        y += 30;
      }

      // --- TERMS & FOOTER ---
      if (y > 680) { doc.addPage(); y = 40; }

      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('TERMS & CONDITIONS', 40, y);
      y += 12;
      const terms = [
        '1. This estimation proposal is valid for 30 calendar days from issuance.',
        '2. Final delivery timelines are calculated based on regular business working days.',
        '3. Scope additions beyond this document will be billed under standard feature addition rates.',
      ];
      terms.forEach((term) => {
        doc.fillColor(mutedText).fontSize(7.5).font('Helvetica').text(term, 40, y);
        y += 10;
      });

      // --- FOOTER ON ALL PAGES ---
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, 780).lineTo(555, 780).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.fillColor(mutedText).fontSize(8).font('Helvetica')
           .text('Dunga Technologies • +91 8013902831 • sales@dungatechnologies.com • www.dungatechnologies.com', 40, 788, { align: 'left' });
        doc.text(`Page ${i + 1} of ${pageCount}`, 450, 788, { align: 'right', width: 105 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── 2. PROJECT CONTRACT PDF ──────────────────────────────────────────────────
export async function buildProjectContractPdfBuffer(project: any, developers: any[] = []): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const primaryColor = '#0f2b5c';
      const secondaryColor = '#0971fe';
      const accentGreen = '#059669';
      const darkText = '#1e293b';
      const mutedText = '#64748b';

      let topY = 40;
      if (LOGO_PATH) {
        try {
          doc.image(LOGO_PATH, 40, topY, { fit: [180, 50] });
        } catch {
          doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY);
        }
      } else {
        doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY);
      }

      doc.fillColor(primaryColor).fontSize(15).font('Helvetica-Bold').text('MASTER PROJECT CONTRACT', 250, topY + 5, { align: 'right' });
      doc.fillColor(mutedText).fontSize(9).font('Helvetica').text(`Contract Date: ${formatDate(new Date())}`, 250, topY + 24, { align: 'right' });
      doc.text(`Contract No: DNG-PRJ-${(project.id || '').substring(0, 8).toUpperCase()}`, 250, topY + 36, { align: 'right' });

      doc.moveTo(40, topY + 58).lineTo(555, topY + 58).strokeColor('#cbd5e1').lineWidth(1).stroke();

      let y = topY + 70;

      // CLIENT & CONTRACT SPECIFICATIONS
      doc.rect(40, y, 515, 80).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor(secondaryColor).fontSize(10).font('Helvetica-Bold').text('PROJECT CONTRACT AGREEMENT', 52, y + 10);

      const clientName = project.customer?.fullName || project.clientName || '—';
      const clientPhone = project.customer?.phone || project.phone || '—';
      const clientEmail = project.customer?.email || project.email || '—';

      doc.fillColor(mutedText).fontSize(8.5).font('Helvetica-Bold').text('Client Name:', 52, y + 28);
      doc.fillColor(darkText).font('Helvetica').text(clientName, 120, y + 28);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Phone:', 52, y + 42);
      doc.fillColor(darkText).font('Helvetica').text(clientPhone, 120, y + 42);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Email:', 52, y + 56);
      doc.fillColor(darkText).font('Helvetica').text(clientEmail, 120, y + 56);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Title:', 300, y + 28);
      doc.fillColor(darkText).font('Helvetica-Bold').text(project.projectName || '—', 380, y + 28);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Target Deadline:', 300, y + 42);
      doc.fillColor(darkText).font('Helvetica').text(formatDate(project.deadline), 380, y + 42);

      doc.fillColor(mutedText).font('Helvetica-Bold').text('Project Status:', 300, y + 56);
      doc.fillColor(accentGreen).font('Helvetica-Bold').text(project.status || 'ACTIVE', 380, y + 56);

      y += 95;

      // MILESTONE PAYMENT SCHEDULE TABLE
      const schedules = project.schedules || project.payments || [];
      if (schedules.length > 0) {
        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('MILESTONE PAYMENT SCHEDULE', 40, y);
        y += 14;

        doc.rect(40, y, 515, 20).fill('#0f2b5c');
        doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('Milestone Trigger / Phase', 50, y + 5);
        doc.text('Payment Amount (INR)', 410, y + 5, { align: 'right', width: 135 });
        y += 20;

        let totalContract = 0;
        schedules.forEach((s: any, i: number) => {
          const amt = parseFloat(s.payment || s.amount || 0);
          totalContract += amt;
          const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(40, y, 515, 18).fillAndStroke(bg, '#f1f5f9');
          doc.fillColor(darkText).fontSize(8.5).font('Helvetica').text(s.description || `Milestone ${i + 1}`, 50, y + 4);
          doc.fillColor(darkText).font('Helvetica-Bold').text(formatINR(amt), 410, y + 4, { align: 'right', width: 135 });
          y += 18;
        });

        doc.rect(40, y, 515, 22).fillAndStroke('#ecfdf5', '#10b981');
        doc.fillColor(accentGreen).fontSize(9.5).font('Helvetica-Bold').text('Total Contract Value', 50, y + 5);
        doc.text(formatINR(totalContract || project.budget), 410, y + 5, { align: 'right', width: 135 });
        y += 32;
      }

      // ASSIGNED ENGINEERING TEAM
      if (developers.length > 0) {
        if (y > 660) { doc.addPage(); y = 40; }

        doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('ASSIGNED ENGINEERING TEAM', 40, y);
        y += 14;

        developers.forEach((d: any) => {
          doc.rect(40, y, 515, 22).fillAndStroke('#f1f5f9', '#cbd5e1');
          doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(d.name || 'Developer', 50, y + 6);
          doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(`${d.role || 'Software Engineer'} • ${d.experience || 'Engineer'}`, 250, y + 6);
          y += 26;
        });
        y += 10;
      }

      // SIGNATURE BLOCK
      if (y > 640) { doc.addPage(); y = 40; }

      y += 10;
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('AUTHORIZATION & ACCEPTANCE', 40, y);
      y += 20;

      const sigBoxY = y;
      doc.rect(40, sigBoxY, 240, 70).strokeColor('#cbd5e1').stroke();
      doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold').text('Client Authorized Signature:', 48, sigBoxY + 8);
      doc.text('Date: ________________________', 48, sigBoxY + 54);

      doc.rect(315, sigBoxY, 240, 70).strokeColor('#cbd5e1').stroke();
      doc.fillColor(mutedText).fontSize(8).font('Helvetica-Bold').text('Dunga Technologies Authorized Signatory:', 323, sigBoxY + 8);
      doc.text('Date: ________________________', 323, sigBoxY + 54);

      // FOOTER ON ALL PAGES
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.moveTo(40, 780).lineTo(555, 780).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.fillColor(mutedText).fontSize(8).font('Helvetica')
           .text('Dunga Technologies • +91 8013902831 • sales@dungatechnologies.com • www.dungatechnologies.com', 40, 788, { align: 'left' });
        doc.text(`Page ${i + 1} of ${pageCount}`, 450, 788, { align: 'right', width: 105 });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
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
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const primaryColor = '#0f2b5c';
      const secondaryColor = '#0971fe';
      const accentGreen = '#059669';
      const darkText = '#1e293b';
      const mutedText = '#64748b';

      let topY = 40;
      if (LOGO_PATH) {
        try {
          doc.image(LOGO_PATH, 40, topY, { fit: [180, 50] });
        } catch {
          doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY);
        }
      } else {
        doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('DUNGA TECHNOLOGIES', 40, topY);
      }

      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', 250, topY + 5, { align: 'right' });
      doc.fillColor(mutedText).fontSize(9).font('Helvetica').text(`Receipt Date: ${formatDate(receiptData.date || new Date())}`, 250, topY + 26, { align: 'right' });
      doc.text(`Receipt No: ${receiptData.receiptNo}`, 250, topY + 38, { align: 'right' });

      doc.moveTo(40, topY + 58).lineTo(555, topY + 58).strokeColor('#cbd5e1').lineWidth(1).stroke();

      let y = topY + 70;

      // PAID BADGE & CUSTOMER DETAILS
      doc.rect(40, y, 515, 80).fillAndStroke('#f8fafc', '#e2e8f0');

      doc.rect(460, y + 10, 80, 22).fill('#10b981');
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('PAID', 460, y + 15, { align: 'center', width: 80 });

      doc.fillColor(secondaryColor).fontSize(10).font('Helvetica-Bold').text('RECEIVED FROM', 52, y + 10);
      doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold').text(receiptData.customerName, 52, y + 25);
      doc.fillColor(mutedText).fontSize(8.5).font('Helvetica').text(`Phone: ${receiptData.customerPhone || '—'}  |  Email: ${receiptData.customerEmail || '—'}`, 52, y + 42);
      if (receiptData.applicationNumber) {
        doc.text(`App No: ${receiptData.applicationNumber}`, 52, y + 56);
      }

      y += 95;

      // PAYMENT BREAKDOWN TABLE
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('PAYMENT TRANSACTION DETAILS', 40, y);
      y += 14;

      doc.rect(40, y, 515, 20).fill('#0f2b5c');
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold').text('Project / Milestone Description', 50, y + 5);
      doc.text('Amount Received (INR)', 400, y + 5, { align: 'right', width: 145 });
      y += 20;

      doc.rect(40, y, 515, 26).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(receiptData.projectName, 50, y + 5);
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(receiptData.paymentDescription || 'Installment Payment', 50, y + 15);
      doc.fillColor(accentGreen).fontSize(11).font('Helvetica-Bold').text(formatINR(receiptData.amountPaid), 400, y + 7, { align: 'right', width: 145 });
      y += 34;

      // ACCOUNT FINANCIAL SUMMARY
      doc.rect(40, y, 515, 55).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fillColor(darkText).fontSize(8.5).font('Helvetica-Bold').text('Total Project Cost:', 52, y + 12);
      doc.text(formatINR(receiptData.totalBudget), 160, y + 12);

      doc.fillColor(darkText).font('Helvetica-Bold').text('Total Paid to Date:', 52, y + 26);
      doc.fillColor(accentGreen).text(formatINR(receiptData.totalPaid), 160, y + 26);

      doc.fillColor(darkText).font('Helvetica-Bold').text('Remaining Balance:', 52, y + 40);
      doc.fillColor(receiptData.remainingBalance > 0 ? '#d97706' : accentGreen).text(formatINR(receiptData.remainingBalance), 160, y + 40);

      y += 75;

      // STAMP / FOOTER STATEMENT
      doc.rect(40, y, 515, 50).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc.fillColor(accentGreen).fontSize(9).font('Helvetica-Bold').text('Official Computer Generated Receipt', 52, y + 12);
      doc.fillColor(mutedText).fontSize(8).font('Helvetica').text('This receipt serves as proof of payment received by Dunga Technologies. No physical signature required.', 52, y + 26);

      // FOOTER ON PAGE
      doc.moveTo(40, 780).lineTo(555, 780).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fillColor(mutedText).fontSize(8).font('Helvetica')
         .text('Dunga Technologies • +91 8013902831 • sales@dungatechnologies.com • www.dungatechnologies.com', 40, 788, { align: 'left' });
      doc.text('Page 1 of 1', 450, 788, { align: 'right', width: 105 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
