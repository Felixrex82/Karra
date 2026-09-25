import { computeMultiItemTransaction } from './calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTests() {
  console.log('Running computeMultiItemTransaction unit tests...');

  // Test Case 1: Empty transaction
  const emptyRes = computeMultiItemTransaction({ items: [] });
  assert(emptyRes.totalRevenue === 0, 'Empty transaction totalRevenue must be 0');
  assert(emptyRes.totalCost === 0, 'Empty transaction totalCost must be 0');
  assert(emptyRes.totalGrossProfit === 0, 'Empty transaction totalGrossProfit must be 0');
  assert(emptyRes.items.length === 0, 'Empty items length must be 0');

  // Test Case 2: Multi-item transaction with dramatically varying price points and wholesale costs
  // E.g. Rice bag (₦59,300, cost ₦58,000) and Coke bottle (₦420, cost ₦250)
  const tx1 = computeMultiItemTransaction({
    items: [
      {
        productName: 'Rice',
        quantity: 3,
        unitSellingPrice: 59300,
        unitCostAtTime: 58000,
        category: 'Food & Grains',
      },
      {
        productName: 'Coke',
        quantity: 2,
        unitSellingPrice: 420,
        unitCostAtTime: 250,
        category: 'Beverages',
      },
    ],
  });

  // Verify Rice individual calculations
  const rice = tx1.items[0];
  assert(rice.productName === 'Rice', 'First item is Rice');
  assert(rice.quantity === 3, 'Rice qty is 3');
  assert(rice.unitSellingPrice === 59300, 'Rice unit selling price is 59300');
  assert(rice.totalRevenue === 177900, `Rice revenue expected 177900, got ${rice.totalRevenue}`);
  assert(rice.totalCostAtTime === 174000, `Rice cost expected 174000, got ${rice.totalCostAtTime}`);
  assert(rice.grossProfit === 3900, `Rice gross profit expected 3900, got ${rice.grossProfit}`);
  assert(!rice.isLoss, 'Rice is not a loss');
  assert(rice.cashReceived === 177900, 'Rice cashReceived is full when cashPaid not restricted');
  assert(rice.receivableAdded === 0, 'Rice receivableAdded is 0');

  // Verify Coke individual calculations
  const coke = tx1.items[1];
  assert(coke.productName === 'Coke', 'Second item is Coke');
  assert(coke.quantity === 2, 'Coke qty is 2');
  assert(coke.unitSellingPrice === 420, 'Coke unit price is 420');
  assert(coke.totalRevenue === 840, `Coke revenue expected 840, got ${coke.totalRevenue}`);
  assert(coke.totalCostAtTime === 500, `Coke cost expected 500, got ${coke.totalCostAtTime}`);
  assert(coke.grossProfit === 340, `Coke gross profit expected 340, got ${coke.grossProfit}`);
  assert(!coke.isLoss, 'Coke is not a loss');

  // Verify Total Event Aggregates
  const expectedTotalRev = 177900 + 840; // 178,740
  const expectedTotalCost = 174000 + 500; // 174,500
  const expectedTotalProfit = 3900 + 340; // 4,240

  assert(tx1.totalRevenue === expectedTotalRev, `Total revenue expected ${expectedTotalRev}, got ${tx1.totalRevenue}`);
  assert(tx1.totalCost === expectedTotalCost, `Total cost expected ${expectedTotalCost}, got ${tx1.totalCost}`);
  assert(tx1.totalGrossProfit === expectedTotalProfit, `Total gross profit expected ${expectedTotalProfit}, got ${tx1.totalGrossProfit}`);
  assert(tx1.totalQuantity === 5, 'Total quantity is 5');
  assert(!tx1.hasLossItems, 'No loss items in tx1');

  // Test Case 3: Partial payment allocation across varying price points without rounding leakage
  // Customer buys ₦178,740 worth of goods and pays ₦100,000 cash, leaving the rest on credit
  const txPartial = computeMultiItemTransaction({
    items: [
      {
        productName: 'Rice',
        quantity: 3,
        unitSellingPrice: 59300,
        unitCostAtTime: 58000,
      },
      {
        productName: 'Coke',
        quantity: 2,
        unitSellingPrice: 420,
        unitCostAtTime: 250,
      },
    ],
    cashPaid: 100000,
  });

  const sumCashAllocated = txPartial.items.reduce((s, it) => s + it.cashReceived, 0);
  const sumReceivable = txPartial.items.reduce((s, it) => s + it.receivableAdded, 0);

  assert(sumCashAllocated === 100000, `Allocated cash must strictly sum to 100000, got ${sumCashAllocated}`);
  assert(txPartial.totalCashReceived === 100000, `Total cash received must be 100000, got ${txPartial.totalCashReceived}`);
  assert(sumReceivable === txPartial.totalRevenue - 100000, `Receivables must equal remaining balance`);
  assert(txPartial.totalReceivableAdded === txPartial.totalRevenue - 100000, `Total receivable added matches remaining`);

  // Test Case 4: Item sold at a loss alongside a high-margin item
  const txLoss = computeMultiItemTransaction({
    items: [
      {
        productName: 'Discounted Soap',
        quantity: 5,
        unitSellingPrice: 200,
        unitCostAtTime: 300, // Sold below wholesale cost
      },
      {
        productName: 'Premium Perfume',
        quantity: 1,
        unitSellingPrice: 25000,
        unitCostAtTime: 12000,
      },
    ],
  });

  assert(txLoss.items[0].isLoss === true, 'Discounted Soap must be flagged as loss');
  assert(txLoss.items[0].grossProfit === -500, `Soap gross profit expected -500, got ${txLoss.items[0].grossProfit}`);
  assert(txLoss.items[1].isLoss === false, 'Perfume is not a loss');
  assert(txLoss.items[1].grossProfit === 13000, `Perfume gross profit expected 13000, got ${txLoss.items[1].grossProfit}`);
  assert(txLoss.hasLossItems === true, 'hasLossItems must be true');
  assert(txLoss.totalGrossProfit === 12500, `Total gross profit expected 12500, got ${txLoss.totalGrossProfit}`);

  console.log('✅ ALL UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests();
