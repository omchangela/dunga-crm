const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function renderPdfs() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    console.error('Edge browser not found at:', edgePath);
    return;
  }

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pdfDir = path.join(__dirname, '../../test_output_pdfs');
  const outputDir = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\33eeeffa-0c6c-420a-a357-60a431a0bdb3\\pdf_previews';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pdfs = [
    { file: '1_estimation_proposal_sample.pdf', name: '1_estimation_proposal.png' },
    { file: '2_project_contract_agreement_sample.pdf', name: '2_project_contract.png' },
    { file: '3_payment_receipt_sample.pdf', name: '3_payment_receipt.png' }
  ];

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1.5 });

  for (const pdf of pdfs) {
    const pdfPath = path.join(pdfDir, pdf.file);
    const fileUrl = `file:///${pdfPath.replace(/\\/g, '/')}`;
    console.log(`Rendering ${pdf.file}...`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    const savePath = path.join(outputDir, pdf.name);
    await page.screenshot({ path: savePath, fullPage: false });
    console.log(`  Saved screenshot: ${savePath}`);
  }

  await browser.close();
  console.log('Done rendering PDF screenshots with Puppeteer!');
}

renderPdfs().catch(err => console.error(err));
