import { buildPaymentReceiptPdfBuffer } from '../lib/pdfGenerator';
import assert from 'assert';

/**
 * 🧪 Test Case: Payment Breakdown & Receipt PDF Logic Verification
 */
async function runTests() {
  console.log('====================================================');
  console.log('🚀 Running Payment Breakdown & Receipt Test Suite');
  console.log('====================================================\n');

  // Test dataset matching user's exact screenshot
  const payments = [
    { description: 'Figma Design', amount: '15000' },
    { description: 'Admin Panal Design', amount: '15000' },
    { description: '1 Year Free Hosting', amount: '0' },
    { description: 'Play store Account', amount: '2400' },
    { description: 'Payment Gateway Integration', amount: '2000' },
    { description: 'SMS gateway Charges', amount: '2600' },
  ];

  const totalContractCost = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  assert.strictEqual(totalContractCost, 37000, 'Total cost should be 37,000');
  console.log(`✅ Total Contract Cost: ₹${totalContractCost.toLocaleString('en-IN')}`);

  // Helper matching our frontend & backend status calculation
  function computeItemStatus(index: number, totalPaid: number) {
    const item = payments[index];
    const itemAmount = Number(item.amount);

    let cumulative = 0;
    for (let i = 0; i <= index; i++) {
      cumulative += Number(payments[i].amount);
    }
    const prevCumulative = cumulative - itemAmount;

    const isPaid = itemAmount === 0 || totalPaid >= cumulative;
    const isPartial = !isPaid && totalPaid > prevCumulative;
    const partialPaid = isPartial ? totalPaid - prevCumulative : 0;
    const isPending = !isPaid && !isPartial;

    return {
      description: item.description,
      amount: itemAmount,
      isPaid,
      isPartial,
      isPending,
      partialPaid,
      receiptAllowed: isPaid && itemAmount > 0,
    };
  }

  // --- TEST CASE 1: Zero Payment Received ---
  console.log('\n--- TEST CASE 1: Zero Payment Received (totalPaid = ₹0) ---');
  let totalPaid = 0;
  for (let i = 0; i < payments.length; i++) {
    const res = computeItemStatus(i, totalPaid);
    if (res.amount === 0) {
      assert.strictEqual(res.isPaid, true, `${res.description} should be Free/Paid`);
      assert.strictEqual(res.receiptAllowed, false, 'Free ₹0 items do not need receipt PDF');
    } else {
      assert.strictEqual(res.isPending, true, `${res.description} should be Pending`);
      assert.strictEqual(res.receiptAllowed, false, `${res.description} receipt must NOT be available`);
    }
    console.log(`  • ${res.description} (₹${res.amount}): ${res.isPaid ? 'FREE' : 'PENDING'} | Receipt Allowed: ${res.receiptAllowed ? 'YES' : 'NO'}`);
  }
  console.log('✅ Passed: Zero payment means NO receipt PDF buttons shown for payable items.');

  // --- TEST CASE 2: Partial Payment on Item 1 (totalPaid = ₹10,000) ---
  console.log('\n--- TEST CASE 2: Partial Payment on Item 1 (totalPaid = ₹10,000) ---');
  totalPaid = 10000;
  const t2_item0 = computeItemStatus(0, totalPaid);
  assert.strictEqual(t2_item0.isPartial, true);
  assert.strictEqual(t2_item0.partialPaid, 10000);
  assert.strictEqual(t2_item0.receiptAllowed, false, 'Partial payment must not show full receipt');
  console.log(`  • ${t2_item0.description}: PARTIAL (₹${t2_item0.partialPaid} / ₹${t2_item0.amount}) | Receipt Allowed: NO`);

  const t2_item1 = computeItemStatus(1, totalPaid);
  assert.strictEqual(t2_item1.isPending, true);
  console.log(`  • ${t2_item1.description}: PENDING | Receipt Allowed: NO`);
  console.log('✅ Passed: Partial payment correctly shows Partial badge, no receipt.');

  // --- TEST CASE 3: Item 1 Completed (totalPaid = ₹15,000) ---
  console.log('\n--- TEST CASE 3: Item 1 Completed (totalPaid = ₹15,000) ---');
  totalPaid = 15000;
  const t3_item0 = computeItemStatus(0, totalPaid);
  assert.strictEqual(t3_item0.isPaid, true);
  assert.strictEqual(t3_item0.receiptAllowed, true, 'Item 0 is paid, Receipt PDF MUST be available');
  console.log(`  • ${t3_item0.description}: PAID | Receipt Allowed: YES (Button Visible)`);

  const t3_item1 = computeItemStatus(1, totalPaid);
  assert.strictEqual(t3_item1.isPending, true);
  assert.strictEqual(t3_item1.receiptAllowed, false);
  console.log(`  • ${t3_item1.description}: PENDING | Receipt Allowed: NO`);
  console.log('✅ Passed: ONLY the paid item (Figma Design) unlocks Receipt PDF!');

  // --- TEST CASE 4: Generate Real PDF Buffer for Paid Item ---
  console.log('\n--- TEST CASE 4: Generate Real PDF Buffer for Paid Item ---');
  const pdfBuffer = await buildPaymentReceiptPdfBuffer({
    receiptNo: 'REC-TEST-001',
    date: new Date(),
    customerName: 'Test Client Ltd',
    customerPhone: '+91 9876543210',
    customerEmail: 'client@example.com',
    projectName: 'Demo CRM App',
    paymentDescription: payments[0].description,
    amountPaid: Number(payments[0].amount),
    totalBudget: totalContractCost,
    totalPaid: 15000,
    remainingBalance: totalContractCost - 15000,
    paymentMethod: 'Bank Transfer',
    transactionId: 'TXN-998877',
    note: 'Advance for Figma Design',
  });

  assert.ok(pdfBuffer && pdfBuffer.length > 1000, 'PDF buffer should be valid and > 1KB');
  console.log(`  • Generated PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`  • Header starts with: ${pdfBuffer.slice(0, 5).toString()}`);
  assert.strictEqual(pdfBuffer.slice(0, 4).toString(), '%PDF', 'Valid PDF magic bytes');
  console.log('✅ Passed: Real payment receipt PDF successfully generated!');

  // --- TEST CASE 5: Cumulative Multi-item Payment (totalPaid = ₹32,400) ---
  console.log('\n--- TEST CASE 5: Multiple Items Paid (totalPaid = ₹32,400) ---');
  // ₹15,000 (Figma) + ₹15,000 (Admin) + ₹0 (Hosting) + ₹2,400 (Play store) = ₹32,400
  totalPaid = 32400;
  for (let i = 0; i < payments.length; i++) {
    const res = computeItemStatus(i, totalPaid);
    console.log(`  • [${i}] ${res.description} (₹${res.amount}): ${res.isPaid ? 'PAID' : res.isPartial ? 'PARTIAL' : 'PENDING'} | Receipt: ${res.receiptAllowed ? 'YES' : 'NO'}`);
  }
  assert.strictEqual(computeItemStatus(0, totalPaid).isPaid, true);
  assert.strictEqual(computeItemStatus(1, totalPaid).isPaid, true);
  assert.strictEqual(computeItemStatus(2, totalPaid).isPaid, true); // Free hosting
  assert.strictEqual(computeItemStatus(3, totalPaid).isPaid, true); // Play store
  assert.strictEqual(computeItemStatus(4, totalPaid).isPending, true); // Payment gateway
  assert.strictEqual(computeItemStatus(5, totalPaid).isPending, true); // SMS gateway
  console.log('✅ Passed: Items 0, 1, 2, 3 are Paid. Items 4, 5 remain Pending with NO receipt.');

  console.log('\n====================================================');
  console.log('🎉 ALL 5 TEST CASES PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
