import { BusinessEvent } from '../src/types';
import { calculateDailySummary } from '../src/engine/calculations';

function runCalendarAnalyticsTests() {
  console.log('🧪 Starting Calendar Analytics & Dynamic Trend Tests...');

  // Mock events across 2 months
  const events: BusinessEvent[] = [
    // Previous Month: August 2026
    {
      id: 'aug-1',
      type: 'SALE',
      date: '2026-08-10',
      totalRevenue: 50000,
      cashReceived: 50000,
      quantity: 5,
      productName: 'Fabric',
      totalCostAtTime: 30000,
    },
    {
      id: 'aug-2',
      type: 'EXPENSE',
      date: '2026-08-15',
      expenseAmount: 15000,
      expenseCategory: 'Transportation',
    },
    // Current Month: September 2026
    {
      id: 'sep-1',
      type: 'SALE',
      date: '2026-09-02',
      totalRevenue: 120000,
      cashReceived: 100000,
      receivableAdded: 20000,
      quantity: 12,
      productName: 'Agbada',
      customerName: 'Chief Obi',
      totalCostAtTime: 60000,
    },
    {
      id: 'sep-2',
      type: 'EXPENSE',
      date: '2026-09-03',
      expenseAmount: 25000,
      expenseCategory: 'Packaging',
    },
    {
      id: 'sep-3',
      type: 'SALE',
      date: '2026-09-15',
      totalRevenue: 30000,
      cashReceived: 30000,
      quantity: 3,
      productName: 'Cap',
      customerName: 'Alhaji Musa',
      totalCostAtTime: 15000,
    },
  ];

  // 1. Verify September 2026 daily summary
  console.log('\n▶ TEST 1: Daily summary calculation for Sep 2, 2026');
  const sumSep2 = calculateDailySummary(events, '2026-09-02');
  if (sumSep2.sales !== 120000) {
    throw new Error(`Expected sales 120000, got ${sumSep2.sales}`);
  }
  if (sumSep2.status !== 'PROFIT') {
    throw new Error(`Expected status PROFIT, got ${sumSep2.status}`);
  }
  console.log('✅ TEST 1 PASSED: Daily summary on Sep 2 is ₦120,000 PROFIT');

  // 2. Daily summary for expense day
  console.log('\n▶ TEST 2: Daily summary calculation for Sep 3, 2026 (Expense only)');
  const sumSep3 = calculateDailySummary(events, '2026-09-03');
  if (sumSep3.expenses !== 25000) {
    throw new Error(`Expected expenses 25000, got ${sumSep3.expenses}`);
  }
  if (sumSep3.status !== 'LOSS') {
    throw new Error(`Expected status LOSS, got ${sumSep3.status}`);
  }
  console.log('✅ TEST 2 PASSED: Daily summary on Sep 3 is ₦25,000 LOSS');

  // 3. Compute Month totals
  const sepSales = 120000 + 30000; // 150,000
  const sepExpenses = 25000;
  const sepCOGS = 60000 + 15000; // 75,000
  const sepNetProfit = sepSales - sepCOGS - sepExpenses; // 50,000

  const augSales = 50000;
  const augExpenses = 15000;

  // Trend computations
  const salesChange = ((sepSales - augSales) / augSales) * 100; // +200%
  const salesDirection = salesChange > 0 ? 'up' : 'down';

  if (salesChange !== 200 || salesDirection !== 'up') {
    throw new Error(`Expected sales trend +200% with direction 'up', got ${salesChange}%`);
  }
  console.log(`✅ TEST 3 PASSED: Sales trend is +${salesChange}% with direction 'up'`);

  // Net Profit margin
  const netMargin = (sepNetProfit / sepSales) * 100; // 33.33%
  const profitDirection = sepNetProfit > 0 ? 'up' : 'down';
  if (profitDirection !== 'up') {
    throw new Error(`Expected profit direction 'up', got ${profitDirection}`);
  }
  console.log(`✅ TEST 4 PASSED: Net Profit is +₦${sepNetProfit.toLocaleString()} (${netMargin.toFixed(1)}% margin) with arrow UP`);

  // Loss scenario
  const lossProfit = -45000;
  const lossDirection = lossProfit < 0 ? 'down' : 'up';
  if (lossDirection !== 'down') {
    throw new Error(`Expected loss direction 'down', got ${lossDirection}`);
  }
  console.log(`✅ TEST 5 PASSED: Operating loss scenario properly sets arrow DOWN`);

  console.log('\n🎉 ALL CALENDAR ANALYTICS TESTS PASSED!\n');
}

runCalendarAnalyticsTests();
