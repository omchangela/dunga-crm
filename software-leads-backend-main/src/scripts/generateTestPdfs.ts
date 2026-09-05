import fs from 'fs';
import path from 'path';
import {
  buildEstimationPdfBuffer,
  buildProjectContractPdfBuffer,
  buildPaymentReceiptPdfBuffer,
} from '../lib/pdfGenerator';

async function runPdfTestScript() {
  console.log('🚀 Starting Dunga Technologies PDF Generator Test Script...\n');

  const dummyProject = {
    id: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
    projectName: 'Enterprise Omnichannel CRM & ERP System',
    serviceType: 'Enterprise Software & Custom ERP',
    status: 'CONVERTED',
    budget: 450000,
    supportPeriod: '12 Months Premium Maintenance & 24/7 Technical Support Included',
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2026-08-15'),
    updatedAt: new Date('2026-09-05'),
    description:
      'Development of a full-scale Enterprise CRM and ERP system for Apex Global Solutions, including automated lead capture, omnichannel sales pipeline tracking, multi-tier user role management, custom invoice generation, real-time inventory tracking, and executive analytics dashboards.',
    customer: {
      id: 'cust-998877',
      fullName: 'Rajesh Sharma',
      companyName: 'Apex Global Solutions Pvt Ltd',
      phone: '+91 98765 43210',
      email: 'rajesh.sharma@apexglobal.in',
      city: 'Hyderabad',
      state: 'Telangana',
      applicationNumber: 'APP-DNG-2026-0982',
    },
    webOverview: [
      'Responsive Admin Dashboard with real-time analytics widgets and KPI graphs',
      'Lead Management Pipeline with automated status transitions & email triggers',
      'Customer Relationship Manager with activity logging and interaction history',
      'Financial Accounting & Invoicing module with GST compliance & auto calculation',
      'Role-based Access Control (Super Admin, Sales Manager, Developer, Finance)',
    ],
    appOverview: [
      'iOS & Android Field Agent Mobile App built with React Native',
      'Offline-first data synchronization for remote field staff with auto sync',
      'Push notifications for urgent task assignments and lead updates',
      'GPS location check-ins and client meeting route tracking',
    ],
    adminOverview: [
      'System-wide audit logs and security access controls with IP restriction',
      'Custom report builder with PDF/Excel export options',
      'API Gateway with rate limiting & secure webhook integrations',
    ],
    timelines: [
      { description: 'Phase 1: Requirements Gathering, UI/UX Wireframing & Database Schema Design', workingDays: 10 },
      { description: 'Phase 2: Core Frontend Dashboard & Mobile App Layout Development', workingDays: 15 },
      { description: 'Phase 3: Backend API Integration, CRM Logic & Inventory Engine', workingDays: 20 },
      { description: 'Phase 4: Security Audit, Load Testing, QA & Final Production Deployment', workingDays: 10 },
    ],
    costHistory: [
      { id: 'ch-1', label: 'WhatsApp Business API & Automated Notification Integration', amount: 25000 },
      { id: 'ch-2', label: 'Custom Multi-Currency Payment Gateway Module', amount: 25000 },
    ],
    payments: [
      { description: 'Phase 1 Advance Payment (Booking & Architecture design)', amount: 150000, date: '2026-08-16' },
      { description: 'Phase 2 Milestone Payment (Frontend & Mobile App UI delivery)', amount: 150000, date: '2026-08-28' },
      { description: 'Phase 3 Milestone Payment (Backend Integration & Testing)', amount: 100000, date: '2026-09-05' },
      { description: 'Final Phase Delivery & Deployment Settlement', amount: 100000, date: 'Pending' },
    ],
  };

  const dummyDevelopers = [
    { id: 'dev-1', name: 'Vikram Mehta', role: 'Lead Full Stack Architect', experience: '8+ Years Exp' },
    { id: 'dev-2', name: 'Ananya Reddy', role: 'Senior Mobile Developer (React Native)', experience: '5+ Years Exp' },
    { id: 'dev-3', name: 'Rahul Verma', role: 'Backend & Database Specialist', experience: '6+ Years Exp' },
  ];

  const dummyReceiptData = {
    receiptNo: 'RCPT-2026-0042',
    date: new Date('2026-09-05'),
    customerName: dummyProject.customer.fullName,
    customerPhone: dummyProject.customer.phone,
    customerEmail: dummyProject.customer.email,
    applicationNumber: dummyProject.customer.applicationNumber,
    projectName: dummyProject.projectName,
    paymentDescription: 'Phase 3 Milestone Payment (Backend Integration & Testing)',
    amountPaid: 100000,
    totalBudget: 500000,
    totalPaid: 400000,
    remainingBalance: 100000,
  };

  const outputDir = path.join(__dirname, '../../test_output_pdfs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Generate Estimation PDF
  console.log('📄 1. Generating Estimation & Proposal PDF...');
  const estBuf = await buildEstimationPdfBuffer(dummyProject);
  const estPath = path.join(outputDir, '1_estimation_proposal_sample.pdf');
  fs.writeFileSync(estPath, estBuf);
  console.log(`   ✅ Saved: ${estPath} (${(estBuf.length / 1024).toFixed(1)} KB)`);

  // 2. Generate Master Project Contract PDF
  console.log('📄 2. Generating Master Project Development Agreement PDF...');
  const contractBuf = await buildProjectContractPdfBuffer(dummyProject, dummyDevelopers);
  const contractPath = path.join(outputDir, '2_project_contract_agreement_sample.pdf');
  fs.writeFileSync(contractPath, contractBuf);
  console.log(`   ✅ Saved: ${contractPath} (${(contractBuf.length / 1024).toFixed(1)} KB)`);

  // 3. Generate Payment Receipt PDF
  console.log('📄 3. Generating Payment Receipt PDF...');
  const receiptBuf = await buildPaymentReceiptPdfBuffer(dummyReceiptData);
  const receiptPath = path.join(outputDir, '3_payment_receipt_sample.pdf');
  fs.writeFileSync(receiptPath, receiptBuf);
  console.log(`   ✅ Saved: ${receiptPath} (${(receiptBuf.length / 1024).toFixed(1)} KB)`);

  console.log('\n🎉 All 3 PDF Test Files Generated Successfully!');
}

runPdfTestScript().catch((err) => {
  console.error('❌ Test script failed:', err);
  process.exit(1);
});
