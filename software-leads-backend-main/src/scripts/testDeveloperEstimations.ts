import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { buildEstimationPdfBuffer } from '../lib/pdfGenerator'

async function run() {
  console.log('\n--- 1. Testing Web Developer Estimation PDF ---')
  const webProject = {
    id: 'test-web-101',
    projectName: 'E-Commerce Marketplace',
    serviceType: 'WEB_DEVELOPMENT',
    budget: 85000,
    description: 'Modern full-featured online store with payment gateway and product catalogue.',
    customer: {
      fullName: 'Om Changela',
      companyName: 'Dunga Tech',
      phone: '+91 9723554357',
      email: 'om@example.com',
      city: 'Ahmedabad',
      state: 'Gujarat',
      applicationNumber: 'DT/EST/2026/WEB01'
    },
    webOverview: [
      'Customer Authentication and OTP Verification',
      'Interactive Product Catalog with Dynamic Filters',
      'Shopping Cart & Checkout Flow',
      'Payment Gateway Integration (Razorpay/Stripe)',
      'Order Tracking and Client Notification Engine',
      'Responsive Mobile & Tablet Viewport Design'
    ],
    appOverview: [],
    adminOverview: []
  }

  const webBuffer = await buildEstimationPdfBuffer(webProject)
  const webPath = path.join(__dirname, '../../test_web_estimation.pdf')
  fs.writeFileSync(webPath, webBuffer)
  console.log(`✅ Web Developer PDF generated successfully (${webBuffer.length} bytes): ${webPath}`)

  console.log('\n--- 2. Testing Software Developer Estimation PDF ---')
  const softwareProject = {
    id: 'test-soft-202',
    projectName: 'Enterprise ERP Suite',
    serviceType: 'OTHERS', // or software development
    budget: 150000,
    description: 'Custom Enterprise Resource Planning system for inventory, invoicing and HR management.',
    customer: {
      fullName: 'Om Changela',
      companyName: 'Dunga Tech',
      phone: '+91 9723554357',
      email: 'om@example.com',
      city: 'Surat',
      state: 'Gujarat',
      applicationNumber: 'DT/EST/2026/SOFT01'
    },
    webOverview: [
      'Database Architecture and Scalable Schema Design',
      'REST API Endpoints for Multi-Branch Synchronisation',
      'Role-based Access Control (RBAC) & Audit Logging',
      'Automated Invoicing & GST Reconciliation Engine'
    ],
    appOverview: [],
    adminOverview: []
  }

  const softBuffer = await buildEstimationPdfBuffer(softwareProject)
  const softPath = path.join(__dirname, '../../test_software_estimation.pdf')
  fs.writeFileSync(softPath, softBuffer)
  console.log(`✅ Software Developer PDF generated successfully (${softBuffer.length} bytes): ${softPath}`)
}

run().catch(console.error)
