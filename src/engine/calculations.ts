import { BusinessEvent, DailySummary, CalculationExplanation, CustomerMemory, ReportPeriod, BusinessReportData } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTodayDateStr } from '../utils/dateUtils';

/**
 * Format currency nicely for Nigerian Naira (₦)
 * Handles compact formats like 150k or full formats like ₦150,000
 */
export function formatNaira(amount: number, compact = false): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₦0';
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  if (compact) {
    if (absAmount >= 1_000_000) {
      const val = (absAmount / 1_000_000).toFixed(1).replace(/\.0$/, '');
      return `${isNegative ? '-' : ''}₦${val}M`;
    }
    if (absAmount >= 1_000) {
      const val = (absAmount / 1_000).toFixed(absAmount % 1000 === 0 ? 0 : 1).replace(/\.0$/, '');
      return `${isNegative ? '-' : ''}₦${val}k`;
    }
    return `${isNegative ? '-' : ''}₦${absAmount.toLocaleString()}`;
  }

  return `${isNegative ? '-' : ''}₦${absAmount.toLocaleString('en-NG', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

/**
 * Format compact badge with sign: +₦42k or -₦8k or ₦0
 */
export function formatSignedNaira(amount: number): string {
  if (amount > 0) {
    return `+${formatNaira(amount, true)}`;
  }
  if (amount < 0) {
    return formatNaira(amount, true);
  }
  return '₦0';
}

/**
 * Deterministic calculation for a single sale event
 */
export interface SaleComputationInput {
  quantity: number;
  totalRevenue: number;
  cashReceived?: number;
  unitCostAtTime?: number;
  normalSellingPrice?: number;
  costIsEstimate?: boolean;
  costEstimateBasis?: string;
  isPromotion?: boolean;
}

export function computeSaleMetrics(input: SaleComputationInput) {
  const quantity = Math.max(1, input.quantity || 1);
  const totalRevenue = Math.max(0, input.totalRevenue || 0);
  const cashReceived = input.cashReceived !== undefined ? Math.min(totalRevenue, Math.max(0, input.cashReceived)) : totalRevenue;
  const receivableAdded = Math.max(0, totalRevenue - cashReceived);
  
  const hasCost = input.unitCostAtTime !== undefined && input.unitCostAtTime > 0;
  const totalCostAtTime = hasCost ? (input.unitCostAtTime! * quantity) : undefined;
  const grossProfit = totalCostAtTime !== undefined ? (totalRevenue - totalCostAtTime) : undefined;
  const isLoss = grossProfit !== undefined ? grossProfit < 0 : false;

  const normalSellingPrice = input.normalSellingPrice;
  const normalPotentialRevenue = normalSellingPrice ? normalSellingPrice * quantity : undefined;
  const discountGiven = (normalPotentialRevenue && normalPotentialRevenue > totalRevenue)
    ? (normalPotentialRevenue - totalRevenue)
    : undefined;

  return {
    quantity,
    totalRevenue,
    cashReceived,
    receivableAdded,
    unitCostAtTime: input.unitCostAtTime,
    totalCostAtTime,
    grossProfit,
    isLoss,
    costIsEstimate: Boolean(input.costIsEstimate),
    costEstimateBasis: input.costEstimateBasis,
    isPromotion: Boolean(input.isPromotion || (discountGiven && discountGiven > 0)),
    normalPotentialRevenue,
    discountGiven,
  };
}

/**
 * Strict, unit-testable formula for multi-item transactions.
 * Handles varying item price points, quantities, unit wholesale costs,
 * proportional payment allocations, individual margins, and aggregate totals.
 */
export interface MultiItemTransactionItemInput {
  productName: string;
  quantity: number;
  unitSellingPrice: number;
  unitCostAtTime?: number;
  category?: string;
  unit?: string;
  costIsEstimate?: boolean;
  costEstimateBasis?: string;
  normalSellingPrice?: number;
}

export interface MultiItemTransactionInput {
  items: MultiItemTransactionItemInput[];
  cashPaid?: number; // Optional global cash paid for the multi-item transaction basket
  customerName?: string;
}

export interface ComputedMultiItemDetail {
  productName: string;
  quantity: number;
  unitSellingPrice: number;
  totalRevenue: number;
  unitCostAtTime: number;
  totalCostAtTime: number;
  grossProfit: number;
  grossMarginPercent: number; // e.g. 15.5 for 15.5%
  isLoss: boolean;
  cashReceived: number;
  receivableAdded: number;
  costIsEstimate: boolean;
  costEstimateBasis?: string;
  category?: string;
  unit?: string;
  normalSellingPrice?: number;
  discountGiven?: number;
}

export interface MultiItemTransactionComputation {
  items: ComputedMultiItemDetail[];
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalGrossProfit: number;
  overallGrossMarginPercent: number;
  totalCashReceived: number;
  totalReceivableAdded: number;
  hasLossItems: boolean;
  hasEstimates: boolean;
}

/**
 * Strict, unit-testable deterministic calculation for multi-item transactions.
 * Correctly computes individual item revenue, wholesale costs, and gross profit even when items have varying price points.
 * Allocates partial multi-item cash payments strictly and proportionally without rounding discrepancies.
 */
export function computeMultiItemTransaction(input: MultiItemTransactionInput): MultiItemTransactionComputation {
  const rawItems = Array.isArray(input.items) ? input.items : [];

  if (rawItems.length === 0) {
    return {
      items: [],
      totalQuantity: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalGrossProfit: 0,
      overallGrossMarginPercent: 0,
      totalCashReceived: 0,
      totalReceivableAdded: 0,
      hasLossItems: false,
      hasEstimates: false,
    };
  }

  // 1. Calculate base revenue, cost, and profit for each individual item
  let runningTotalRevenue = 0;
  let runningTotalCost = 0;
  let runningTotalQty = 0;
  let hasLossItems = false;
  let hasEstimates = false;

  const preComputed = rawItems.map((item) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
    const unitSellingPrice = Math.max(0, Number(item.unitSellingPrice) || 0);
    const totalRevenue = quantity * unitSellingPrice;

    const unitCost = Math.max(0, Number(item.unitCostAtTime) || 0);
    const totalCostAtTime = quantity * unitCost;
    const grossProfit = totalRevenue - totalCostAtTime;
    const isLoss = grossProfit < 0;

    const grossMarginPercent = totalRevenue > 0
      ? Number(((grossProfit / totalRevenue) * 100).toFixed(2))
      : 0;

    const normalSellingPrice = item.normalSellingPrice ? Math.max(0, Number(item.normalSellingPrice)) : undefined;
    const normalPotentialRevenue = normalSellingPrice ? normalSellingPrice * quantity : undefined;
    const discountGiven = (normalPotentialRevenue && normalPotentialRevenue > totalRevenue)
      ? (normalPotentialRevenue - totalRevenue)
      : undefined;

    if (isLoss) hasLossItems = true;
    if (item.costIsEstimate) hasEstimates = true;

    runningTotalRevenue += totalRevenue;
    runningTotalCost += totalCostAtTime;
    runningTotalQty += quantity;

    return {
      productName: item.productName || 'Item',
      quantity,
      unitSellingPrice,
      totalRevenue,
      unitCostAtTime: unitCost,
      totalCostAtTime,
      grossProfit,
      grossMarginPercent,
      isLoss,
      costIsEstimate: Boolean(item.costIsEstimate),
      costEstimateBasis: item.costEstimateBasis,
      category: item.category,
      unit: item.unit,
      normalSellingPrice,
      discountGiven,
    };
  });

  const totalRevenue = runningTotalRevenue;
  const totalCost = runningTotalCost;
  const totalGrossProfit = totalRevenue - totalCost;
  const overallGrossMarginPercent = totalRevenue > 0
    ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(2))
    : 0;

  // 2. Strict cash allocation across items
  // If cashPaid is undefined, assume full payment by default.
  // If cashPaid is specified, allocate proportionally across items based on their revenue contribution.
  const targetTotalCash = input.cashPaid !== undefined
    ? Math.min(totalRevenue, Math.max(0, Number(input.cashPaid) || 0))
    : totalRevenue;

  let allocatedCashSum = 0;
  const computedItems: ComputedMultiItemDetail[] = preComputed.map((item, index) => {
    let itemCash = 0;
    if (totalRevenue === 0) {
      itemCash = 0;
    } else if (input.cashPaid === undefined) {
      itemCash = item.totalRevenue;
    } else if (index === preComputed.length - 1) {
      // Allocate the remaining exact balance to the last item to prevent 1-naira rounding discrepancies
      itemCash = Math.min(item.totalRevenue, Math.max(0, targetTotalCash - allocatedCashSum));
    } else {
      const share = item.totalRevenue / totalRevenue;
      itemCash = Math.min(item.totalRevenue, Math.round(targetTotalCash * share));
      allocatedCashSum += itemCash;
    }

    const itemReceivable = Math.max(0, item.totalRevenue - itemCash);

    return {
      ...item,
      cashReceived: itemCash,
      receivableAdded: itemReceivable,
    };
  });

  const totalCashReceived = computedItems.reduce((acc, it) => acc + it.cashReceived, 0);
  const totalReceivableAdded = computedItems.reduce((acc, it) => acc + it.receivableAdded, 0);

  return {
    items: computedItems,
    totalQuantity: runningTotalQty,
    totalRevenue,
    totalCost,
    totalGrossProfit,
    overallGrossMarginPercent,
    totalCashReceived,
    totalReceivableAdded,
    hasLossItems,
    hasEstimates,
  };
}

/**
 * Calculate Daily Business Summary for any given date
 */
export function calculateDailySummary(events: BusinessEvent[], targetDate: string): DailySummary {
  const dayEvents = events.filter((e) => e.date === targetDate && !e.isCorrected);

  let sales = 0;
  let cashReceived = 0;
  let outstandingReceivables = 0;
  let expenses = 0;
  let costOfGoods = 0;
  let itemsSoldCount = 0;
  let hasEstimates = false;
  const debtorsToday: { customer: string; amount: number }[] = [];
  const expensesByCategory: Record<string, number> = {};

  for (const ev of dayEvents) {
    if (ev.type === 'SALE') {
      sales += ev.totalRevenue || 0;
      cashReceived += ev.cashReceived !== undefined ? ev.cashReceived : (ev.totalRevenue || 0);
      if (ev.receivableAdded && ev.receivableAdded > 0) {
        outstandingReceivables += ev.receivableAdded;
        if (ev.customerName) {
          debtorsToday.push({ customer: ev.customerName, amount: ev.receivableAdded });
        }
      }
      if (ev.totalCostAtTime !== undefined) {
        costOfGoods += ev.totalCostAtTime;
      }
      if (ev.costIsEstimate) {
        hasEstimates = true;
      }
      itemsSoldCount += ev.quantity || 1;
    } else if (ev.type === 'CUSTOMER_DEBT') {
      outstandingReceivables += ev.receivableAdded || ev.totalRevenue || 0;
    } else if (ev.type === 'DEBT_PAYMENT') {
      cashReceived += ev.cashReceived || ev.totalRevenue || 0;
    } else if (ev.type === 'EXPENSE' || ev.type === 'PURCHASE_STOCK') {
      const expAmt = ev.expenseAmount || ev.totalCostAtTime || 0;
      expenses += expAmt;
      const cat = ev.expenseCategory || 'Procurement';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expAmt;
    } else if (ev.type === 'RETURN_REFUND') {
      const refAmt = ev.refundAmount || ev.totalRevenue || 0;
      cashReceived = Math.max(0, cashReceived - refAmt);
      sales = Math.max(0, sales - refAmt);
    } else if (ev.type === 'OWNER_DRAWING') {
      const drawAmt = ev.totalRevenue || ev.expenseAmount || 0;
      cashReceived = Math.max(0, cashReceived - drawAmt);
    } else if (ev.type === 'OWNER_INJECTION') {
      const injectAmt = ev.totalRevenue || 0;
      cashReceived += injectAmt;
    }
  }

  const estimatedGrossProfit = sales - costOfGoods;
  const netOperatingResult = estimatedGrossProfit - expenses;

  let status: 'PROFIT' | 'LOSS' | 'BREAKEVEN' = 'BREAKEVEN';
  if (dayEvents.length === 0 || (sales === 0 && expenses === 0)) {
    status = 'BREAKEVEN';
  } else if (netOperatingResult > 0) {
    status = 'PROFIT';
  } else if (netOperatingResult < 0) {
    status = 'LOSS';
  }

  // Build plain-language human summary
  let plainSummary = '';
  if (dayEvents.length === 0) {
    plainSummary = 'No business activity was recorded on this day.';
  } else {
    const profitStr = formatNaira(netOperatingResult);
    const salesStr = formatNaira(sales);
    const expStr = formatNaira(expenses);

    // Find top expense category
    let topExpense = '';
    let topExpAmt = 0;
    for (const [cat, amt] of Object.entries(expensesByCategory)) {
      if (amt > topExpAmt) {
        topExpAmt = amt;
        topExpense = cat.toLowerCase();
      }
    }

    if (netOperatingResult > 0) {
      plainSummary = `Today was a profitable day. You made an estimated ${profitStr} take-home from ${salesStr} in sales.`;
    } else if (netOperatingResult < 0) {
      plainSummary = `Today ran at a net operating loss of ${profitStr}. Expenses (${expStr}) exceeded gross profit.`;
    } else {
      plainSummary = `Today broke even with ${salesStr} in sales matching your costs and expenses.`;
    }

    if (debtorsToday.length > 0) {
      const names = debtorsToday.map((d) => d.customer).join(' and ');
      const totalOwing = formatNaira(outstandingReceivables);
      plainSummary += ` ${names} still owe you ${totalOwing} from today's orders.`;
    }

    if (topExpense) {
      plainSummary += ` Your main expense was ${topExpense} (${formatNaira(topExpAmt)}).`;
    }
  }

  // Format date display
  const dateObj = new Date(targetDate + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return {
    date: targetDate,
    formattedDate,
    sales,
    cashReceived,
    outstandingReceivables,
    expenses,
    costOfGoods,
    estimatedGrossProfit,
    netOperatingResult,
    itemsSoldCount,
    eventsCount: dayEvents.length,
    hasEstimates,
    status,
    plainSummary,
  };
}

/**
 * Transparent breakdown for "How did you get this number?"
 */
export function explainDailyCalculation(
  events: BusinessEvent[],
  targetDate: string
): CalculationExplanation {
  const dayEvents = events.filter((e) => e.date === targetDate && !e.isCorrected);
  const summary = calculateDailySummary(events, targetDate);

  const breakdownRows = [
    {
      label: 'Total Sales Revenue',
      amount: summary.sales,
      isDeduction: false,
      note: `${summary.itemsSoldCount} items sold`,
    },
    {
      label: 'Cost of Goods Sold (COGS)',
      amount: summary.costOfGoods,
      isDeduction: true,
      note: summary.hasEstimates ? 'Includes estimated unit yields' : 'Based on remembered supplier purchase costs',
    },
    {
      label: 'Operating Expenses',
      amount: summary.expenses,
      isDeduction: true,
      note: 'Transportation, utilities, packaging, rent, etc.',
    },
  ];

  return {
    title: `How we calculated ${formatNaira(summary.netOperatingResult)} for ${summary.formattedDate}`,
    targetMetric: 'Net Operating Result',
    totalValue: summary.netOperatingResult,
    formula: 'Sales Revenue (₦) − Cost of Goods (₦) − Operating Expenses (₦) = Result',
    breakdownRows,
    contributingEvents: dayEvents,
    isEstimate: summary.hasEstimates,
    estimateReason: summary.hasEstimates
      ? 'Some product costs rely on unit conversions (e.g., estimated yield of bowls per bag).'
      : undefined,
  };
}

/**
 * Transparent breakdown for a single sale event
 */
export function explainEventCalculation(event: BusinessEvent): CalculationExplanation {
  const breakdownRows: Array<{ label: string; amount: number; isDeduction?: boolean; note?: string }> = [];

  breakdownRows.push({
    label: `Sale Revenue (${event.quantity || 1} × ${formatNaira(event.unitSellingPrice || 0)})`,
    amount: event.totalRevenue || 0,
    isDeduction: false,
  });

  if (event.totalCostAtTime !== undefined && event.totalCostAtTime > 0) {
    breakdownRows.push({
      label: `Product Cost (${event.quantity || 1} × ${formatNaira(event.unitCostAtTime || 0)})`,
      amount: event.totalCostAtTime,
      isDeduction: true,
      note: event.costIsEstimate ? 'Derived from unit conversion ratio' : 'Saved from supplier purchase price',
    });
  }

  if (event.discountGiven && event.discountGiven > 0) {
    breakdownRows.push({
      label: 'Discount Given (Promo)',
      amount: event.discountGiven,
      isDeduction: false,
      note: `Regular potential was ${formatNaira(event.normalPotentialRevenue || 0)}`,
    });
  }

  return {
    title: `Calculation for ${event.productName || 'Sale'}`,
    targetMetric: 'Gross Profit',
    totalValue: event.grossProfit ?? (event.totalRevenue || 0),
    formula: 'Total Revenue − Total Cost = Estimated Gross Profit',
    breakdownRows,
    contributingEvents: [event],
    isEstimate: Boolean(event.costIsEstimate),
    estimateReason: event.costEstimateBasis,
  };
}

/**
 * Reconcile customer balances accurately from ledger
 */
export function reconcileCustomerBalances(
  events: BusinessEvent[],
  existingCustomers: CustomerMemory[]
): CustomerMemory[] {
  const customerMap: Record<
    string,
    {
      name: string;
      totalPurchased: number;
      totalPaid: number;
      lastDate: string;
      history: any[];
      existingRecord?: CustomerMemory;
    }
  > = {};

  // Initialize from existing
  for (const c of existingCustomers) {
    customerMap[c.name.toLowerCase()] = {
      name: c.name,
      totalPurchased: 0,
      totalPaid: 0,
      lastDate: c.lastActivityDate,
      history: [],
      existingRecord: c,
    };
  }

  for (const ev of events) {
    if (ev.isCorrected || !ev.customerName) continue;
    const nameKey = ev.customerName.toLowerCase();
    if (!customerMap[nameKey]) {
      customerMap[nameKey] = {
        name: ev.customerName,
        totalPurchased: 0,
        totalPaid: 0,
        lastDate: ev.date,
        history: [],
      };
    }

    const rec = customerMap[nameKey];
    rec.lastDate = ev.date;

    if (ev.type === 'SALE') {
      const rev = ev.totalRevenue || 0;
      const paid = ev.cashReceived !== undefined ? ev.cashReceived : rev;
      rec.totalPurchased += rev;
      rec.totalPaid += paid;
      rec.history.push({
        eventId: ev.id,
        date: ev.date,
        type: 'PURCHASE',
        amount: rev,
        description: `Bought ${ev.quantity || 1} ${ev.productName || 'item(s)'} for ${formatNaira(rev)} (Paid ${formatNaira(paid)})`,
      });
    } else if (ev.type === 'CUSTOMER_DEBT') {
      const debt = ev.receivableAdded || ev.totalRevenue || 0;
      rec.totalPurchased += debt;
      rec.history.push({
        eventId: ev.id,
        date: ev.date,
        type: 'PURCHASE',
        amount: debt,
        description: `Recorded debt of ${formatNaira(debt)}`,
      });
    } else if (ev.type === 'DEBT_PAYMENT') {
      const payment = ev.cashReceived || ev.totalRevenue || 0;
      rec.totalPaid += payment;
      rec.history.push({
        eventId: ev.id,
        date: ev.date,
        type: 'PAYMENT',
        amount: payment,
        description: `Payment received of ${formatNaira(payment)}`,
      });
    } else if (ev.type === 'RETURN_REFUND') {
      const refund = ev.refundAmount || 0;
      rec.totalPaid -= refund;
      rec.history.push({
        eventId: ev.id,
        date: ev.date,
        type: 'RETURN',
        amount: refund,
        description: `Refund of ${formatNaira(refund)} issued`,
      });
    }
  }

  // Return ALL reconciled customers (both existing and newly added from transactions)
  return Object.values(customerMap).map((data) => {
    const outstanding = Math.max(0, data.totalPurchased - data.totalPaid);
    const existing = data.existingRecord;

    if (existing) {
      return {
        ...existing,
        totalPurchased: data.totalPurchased,
        totalPaid: data.totalPaid,
        outstandingBalance: outstanding,
        lastActivityDate: data.lastDate || existing.lastActivityDate,
        history: data.history.length > 0 ? data.history : existing.history,
      };
    }

    // Newly discovered customer from transactions
    return {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name,
      outstandingBalance: outstanding,
      totalPurchased: data.totalPurchased,
      totalPaid: data.totalPaid,
      lastActivityDate: data.lastDate || getTodayDateStr(),
      paymentReliability: 'Medium' as const,
      history: data.history,
      notes: 'Discovered from recorded customer transactions',
    };
  });
}

/**
 * Generate Comprehensive Business Report for Weekly, Monthly, or Yearly period
 */
export function generateBusinessReport(
  events: BusinessEvent[],
  customers: CustomerMemory[],
  period: ReportPeriod,
  referenceDate = getTodayDateStr()
): BusinessReportData {
  const refParts = referenceDate.split('-').map(Number);
  const refYear = refParts[0];
  const refMonth = refParts[1];
  const refDay = refParts[2];

  let startDate = '';
  let endDate = '';
  let title = '';
  let subtitle = '';
  let dateRangeLabel = '';

  const trendIntervals: Array<{ key: string; label: string; dateStart: string; dateEnd: string }> = [];

  if (period === 'weekly') {
    // 7 days ending on referenceDate
    const endD = new Date(refYear, refMonth - 1, refDay);
    const startD = new Date(endD);
    startD.setDate(endD.getDate() - 6);

    const pad = (n: number) => String(n).padStart(2, '0');
    startDate = `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`;
    endDate = referenceDate;

    title = 'Weekly Business Performance Report';
    subtitle = '7-day operational ledger, cash position, and inventory yields';
    dateRangeLabel = `${startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Generate intervals for all 7 days
    const cur = new Date(startD);
    while (cur <= endD) {
      const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const dayLabel = cur.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      trendIntervals.push({ key: dStr, label: dayLabel, dateStart: dStr, dateEnd: dStr });
      cur.setDate(cur.getDate() + 1);
    }
  } else if (period === 'monthly') {
    const pad = (n: number) => String(n).padStart(2, '0');
    startDate = `${refYear}-${pad(refMonth)}-01`;
    // Last day of current month
    const endOfMonth = new Date(refYear, refMonth, 0);
    endDate = `${refYear}-${pad(refMonth)}-${pad(endOfMonth.getDate())}`;

    const monthName = new Date(refYear, refMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    title = `${monthName} Monthly Financial Statement`;
    subtitle = 'Full month operating cash flow, product margins, and debtor positions';
    dateRangeLabel = monthName;

    // Group by 4 calendar weeks (1-7, 8-14, 15-21, 22-end)
    trendIntervals.push(
      { key: 'w1', label: 'Sep 1–7', dateStart: `${refYear}-${pad(refMonth)}-01`, dateEnd: `${refYear}-${pad(refMonth)}-07` },
      { key: 'w2', label: 'Sep 8–14', dateStart: `${refYear}-${pad(refMonth)}-08`, dateEnd: `${refYear}-${pad(refMonth)}-14` },
      { key: 'w3', label: 'Sep 15–21', dateStart: `${refYear}-${pad(refMonth)}-15`, dateEnd: `${refYear}-${pad(refMonth)}-21` },
      { key: 'w4', label: 'Sep 22–30', dateStart: `${refYear}-${pad(refMonth)}-22`, dateEnd: endDate }
    );
  } else {
    // Yearly
    startDate = `${refYear}-01-01`;
    endDate = `${refYear}-12-31`;
    title = `${refYear} Annual Business Audit & Growth Report`;
    subtitle = 'Comprehensive annual profit & loss, inventory margins, and capital metrics';
    dateRangeLabel = `Full Year ${refYear}`;

    // Group by months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 1; m <= 12; m++) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const startM = `${refYear}-${pad(m)}-01`;
      const endM = `${refYear}-${pad(m)}-${pad(new Date(refYear, m, 0).getDate())}`;
      trendIntervals.push({ key: `m${m}`, label: monthNames[m - 1], dateStart: startM, dateEnd: endM });
    }
  }

  // Filter events strictly within range
  const periodEvents = events.filter((ev) => !ev.isCorrected && ev.date >= startDate && ev.date <= endDate);

  let totalSales = 0;
  let totalCostOfGoods = 0;
  let totalExpenses = 0;
  let cashReceived = 0;
  let creditGiven = 0;
  let debtRecovered = 0;
  let totalItemsSold = 0;
  let totalTransactions = 0;

  const expensesByCatMap: Record<string, number> = {};
  const productPerformanceMap: Record<string, { revenue: number; quantity: number; cost: number; profit: number }> = {};

  for (const ev of periodEvents) {
    totalTransactions++;

    if (ev.type === 'SALE') {
      const rev = ev.totalRevenue || 0;
      totalSales += rev;
      const cash = ev.cashReceived !== undefined ? ev.cashReceived : rev;
      cashReceived += cash;

      if (ev.receivableAdded && ev.receivableAdded > 0) {
        creditGiven += ev.receivableAdded;
      }

      const cost = ev.totalCostAtTime || 0;
      totalCostOfGoods += cost;

      const qty = ev.quantity || 1;
      totalItemsSold += qty;

      const pName = ev.productName || 'Unspecified Item';
      if (!productPerformanceMap[pName]) {
        productPerformanceMap[pName] = { revenue: 0, quantity: 0, cost: 0, profit: 0 };
      }
      productPerformanceMap[pName].revenue += rev;
      productPerformanceMap[pName].quantity += qty;
      productPerformanceMap[pName].cost += cost;
      productPerformanceMap[pName].profit += (ev.grossProfit ?? (rev - cost));
    } else if (ev.type === 'CUSTOMER_DEBT') {
      const debt = ev.receivableAdded || ev.totalRevenue || 0;
      creditGiven += debt;
      totalSales += debt;
    } else if (ev.type === 'DEBT_PAYMENT') {
      const paid = ev.cashReceived || ev.totalRevenue || 0;
      cashReceived += paid;
      debtRecovered += paid;
    } else if (ev.type === 'EXPENSE' || ev.type === 'PURCHASE_STOCK') {
      const amt = ev.expenseAmount || ev.totalCostAtTime || 0;
      totalExpenses += amt;
      const cat = ev.expenseCategory || 'Procurement';
      expensesByCatMap[cat] = (expensesByCatMap[cat] || 0) + amt;
    } else if (ev.type === 'RETURN_REFUND') {
      const ref = ev.refundAmount || 0;
      cashReceived -= ref;
      totalSales -= ref;
    } else if (ev.type === 'OWNER_DRAWING') {
      const draw = ev.totalRevenue || ev.expenseAmount || 0;
      cashReceived -= draw;
    } else if (ev.type === 'OWNER_INJECTION') {
      const inject = ev.totalRevenue || 0;
      cashReceived += inject;
    }
  }

  const grossProfit = totalSales - totalCostOfGoods;
  const grossMarginPercent = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  const netProfit = grossProfit - totalExpenses;
  const netMarginPercent = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
  const cashCollectionRate = totalSales > 0 ? Math.min(100, Math.round((cashReceived / totalSales) * 100)) : 100;

  // Build trend data for the visual chart
  const dailyTrend = trendIntervals.map((interval) => {
    const intEvents = periodEvents.filter((ev) => ev.date >= interval.dateStart && ev.date <= interval.dateEnd);
    let intSales = 0;
    let intCost = 0;
    let intExp = 0;
    let intCash = 0;

    for (const ev of intEvents) {
      if (ev.type === 'SALE') {
        intSales += ev.totalRevenue || 0;
        intCost += ev.totalCostAtTime || 0;
        intCash += ev.cashReceived !== undefined ? ev.cashReceived : (ev.totalRevenue || 0);
      } else if (ev.type === 'CUSTOMER_DEBT') {
        intSales += ev.receivableAdded || ev.totalRevenue || 0;
      } else if (ev.type === 'DEBT_PAYMENT') {
        intCash += ev.cashReceived || ev.totalRevenue || 0;
      } else if (ev.type === 'EXPENSE' || ev.type === 'PURCHASE_STOCK') {
        intExp += ev.expenseAmount || ev.totalCostAtTime || 0;
      } else if (ev.type === 'RETURN_REFUND') {
        intCash -= ev.refundAmount || 0;
        intSales -= ev.refundAmount || 0;
      }
    }

    const intProfit = intSales - intCost - intExp;
    return {
      date: interval.key,
      label: interval.label,
      sales: intSales,
      profit: intProfit,
      expenses: intExp,
      cash: intCash,
    };
  });

  // Expenses by category list
  const expensesByCategory = Object.entries(expensesByCatMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Top products ranked by revenue
  const topProducts = Object.entries(productPerformanceMap)
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      quantity: data.quantity,
      cost: data.cost,
      profit: data.profit,
      marginPercent: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Active debtors
  const activeDebtors = customers
    .filter((c) => c.outstandingBalance > 0)
    .map((c) => ({
      customerName: c.name,
      phone: c.phone,
      outstandingBalance: c.outstandingBalance,
      totalPurchased: c.totalPurchased,
      totalPaid: c.totalPaid,
      lastActivityDate: c.lastActivityDate,
    }))
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  // Plain summary text for merchant
  let summaryExecutiveText = '';
  if (totalSales === 0 && totalExpenses === 0) {
    summaryExecutiveText = `No transactions recorded during this ${period} timeframe (${dateRangeLabel}).`;
  } else {
    const profitStatus = netProfit >= 0 ? 'a net profit' : 'a net loss';
    summaryExecutiveText = `During this ${period} period (${dateRangeLabel}), your business recorded ${formatNaira(totalSales)} in gross sales across ${totalTransactions} transactions. After deducting ${formatNaira(totalCostOfGoods)} in product costs and ${formatNaira(totalExpenses)} in operating expenses, you realized ${profitStatus} of ${formatNaira(Math.abs(netProfit))} (${netMarginPercent.toFixed(1)}% net margin). You collected ${formatNaira(cashReceived)} in liquid cash and extended ${formatNaira(creditGiven)} in customer credit.`;
  }

  return {
    period,
    title,
    subtitle,
    startDate,
    endDate,
    dateRangeLabel,
    totalSales,
    totalCostOfGoods,
    grossProfit,
    grossMarginPercent,
    totalExpenses,
    netProfit,
    netMarginPercent,
    cashReceived,
    creditGiven,
    cashCollectionRate,
    debtRecovered,
    totalTransactions,
    totalItemsSold,
    dailyTrend,
    expensesByCategory,
    topProducts,
    activeDebtors,
    summaryExecutiveText,
  };
}

/**
 * Export report to formatted CSV
 */
export function exportReportToCSV(report: BusinessReportData, businessName: string): void {
  const rows: string[] = [];

  // Header Section
  rows.push(`"Karra BUSINESS FINANCIAL REPORT"`);
  rows.push(`"Business Name:","${businessName}"`);
  rows.push(`"Report Type:","${report.title}"`);
  rows.push(`"Period:","${report.dateRangeLabel}"`);
  rows.push(`"Date Range:","${report.startDate} to ${report.endDate}"`);
  rows.push(`"Generated On:","${new Date().toLocaleString()}"`);
  rows.push('');

  // Executive KPI Summary
  rows.push(`"KEY METRIC","VALUE (NGN)","NOTE"`);
  rows.push(`"Gross Sales Revenue","${report.totalSales}","Total value of sales & credit recorded"`);
  rows.push(`"Cost of Goods Sold (COGS)","${report.totalCostOfGoods}","Includes locked historical costs & yield estimates"`);
  rows.push(`"Estimated Gross Profit","${report.grossProfit}","Margin: ${report.grossMarginPercent.toFixed(1)}%"`);
  rows.push(`"Operating Expenses","${report.totalExpenses}","Transport, rent, utilities, etc."`);
  rows.push(`"Net Operating Profit","${report.netProfit}","Net Margin: ${report.netMarginPercent.toFixed(1)}%"`);
  rows.push(`"Cash Received","${report.cashReceived}","Liquid cash collected"`);
  rows.push(`"Customer Credit Extended","${report.creditGiven}","Receivables added"`);
  rows.push(`"Customer Debt Recovered","${report.debtRecovered}","Cash from previous credit"`);
  rows.push(`"Total Transactions","${report.totalTransactions}","Count of logged entries"`);
  rows.push(`"Total Items Sold","${report.totalItemsSold}","Units moved"`);
  rows.push('');

  // Trend Breakdown
  rows.push(`"PERIOD TREND BREAKDOWN"`);
  rows.push(`"Period Label","Sales (NGN)","Net Profit (NGN)","Expenses (NGN)","Cash Collected (NGN)"`);
  for (const t of report.dailyTrend) {
    rows.push(`"${t.label}","${t.sales}","${t.profit}","${t.expenses}","${t.cash}"`);
  }
  rows.push('');

  // Top Products Breakdown
  rows.push(`"TOP SELLING PRODUCTS"`);
  rows.push(`"Product Name","Units Sold","Total Revenue (NGN)","Estimated Cost (NGN)","Gross Profit (NGN)","Gross Margin %"`);
  for (const p of report.topProducts) {
    rows.push(`"${p.name}","${p.quantity}","${p.revenue}","${p.cost}","${p.profit}","${p.marginPercent}%"`);
  }
  rows.push('');

  // Operating Expenses Breakdown
  rows.push(`"OPERATING EXPENSES BY CATEGORY"`);
  rows.push(`"Expense Category","Amount (NGN)","Share of Total Expenses %"`);
  for (const exp of report.expensesByCategory) {
    rows.push(`"${exp.category}","${exp.amount}","${exp.percentage}%"`);
  }
  rows.push('');

  // Debtors Schedule
  rows.push(`"OUTSTANDING CUSTOMER DEBTORS"`);
  rows.push(`"Customer Name","Phone Number","Outstanding Debt (NGN)","Total Purchased (NGN)","Total Paid (NGN)","Last Activity"`);
  for (const d of report.activeDebtors) {
    rows.push(`"${d.customerName}","${d.phone || 'N/A'}","${d.outstandingBalance}","${d.totalPurchased}","${d.totalPaid}","${d.lastActivityDate}"`);
  }
  rows.push('');

  rows.push(`"VERIFICATION"`);
  rows.push(`"Calculations generated deterministically by Karra - AI Operating System for Informal Merchants."`);

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Karra_${report.period}_report_${report.startDate}_to_${report.endDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format currency nicely for PDF document export (using standard NGN prefix to guarantee universal font rendering)
 */
export function formatPDFCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'NGN 0';
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return isNegative ? `-NGN ${formatted}` : `NGN ${formatted}`;
}

/**
 * Export report to an actual downloadable PDF document file using jsPDF and jspdf-autotable.
 * This directly generates and downloads a true .pdf file to the user's computer.
 */
export function exportReportToPDF(report: BusinessReportData, businessName: string): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const leftMargin = 14;
  const rightMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 182mm

  // Clean palette for accounting documents
  const darkColor = [15, 23, 42]; // #0f172a (Slate 900)
  const emeraldColor = [5, 150, 105]; // #059669 (Emerald 600)
  const emeraldBg = [240, 253, 244]; // #f0fdf4
  const slate600 = [71, 85, 105]; // #475569
  const slate400 = [148, 163, 184]; // #94a3b8
  const lightBg = [248, 250, 252]; // #f8fafc
  const borderColor = [226, 232, 240]; // #e2e8f0

  // 1. Header Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(businessName || 'Karra Business', leftMargin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.text('Karra Verified Financial & Operational Statement', leftMargin, 23);

  // Right side badges
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`${report.period.toUpperCase()} FINANCIAL STATEMENT`, pageWidth - rightMargin, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);
  doc.text(report.dateRangeLabel, pageWidth - rightMargin, 21, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, pageWidth - rightMargin, 25, { align: 'right' });

  // Divider line
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, 28, pageWidth - rightMargin, 28);

  // 2. Executive Summary Box
  let currentY = 32;
  const cleanSummary = (report.summaryExecutiveText || '')
    .replace(/₦/g, 'NGN ')
    .replace(/—/g, '-')
    .replace(/[^\x00-\x7F]/g, ''); // Ensure pure Latin-1 characters for crisp Helvetica typography

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setLineHeightFactor(1.4);

  const textPaddingX = 8;
  const maxTextWidth = contentWidth - textPaddingX * 2;
  const summaryLines: string[] = doc.splitTextToSize(cleanSummary, maxTextWidth);
  const lineHeightMm = (8.5 * 0.352778) * 1.4; // ~4.2mm per line
  const textBlockHeight = summaryLines.length * lineHeightMm;
  const boxPaddingY = 6;
  const headerTitleHeight = 5;
  const summaryBoxHeight = headerTitleHeight + textBlockHeight + boxPaddingY * 2 + 2;

  // Background card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, currentY, contentWidth, summaryBoxHeight, 2, 2, 'FD');
  
  // Left border accent
  doc.setFillColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.rect(leftMargin, currentY, 2.5, summaryBoxHeight, 'F');

  // Executive summary title & text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Executive Operational Summary', leftMargin + textPaddingX, currentY + boxPaddingY + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);
  doc.text(summaryLines, leftMargin + textPaddingX, currentY + boxPaddingY + headerTitleHeight + 4);

  currentY += summaryBoxHeight + 6;

  // 3. Four Core Financial KPI Cards
  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 22;

  const kpiData = [
    {
      label: 'Gross Sales',
      val: formatPDFCurrency(report.totalSales),
      sub: `${report.totalTransactions} transactions`,
      highlight: false,
    },
    {
      label: 'Cost of Goods',
      val: formatPDFCurrency(report.totalCostOfGoods),
      sub: `${report.totalItemsSold} items moved`,
      highlight: false,
    },
    {
      label: 'Operating Expenses',
      val: formatPDFCurrency(report.totalExpenses),
      sub: `${report.expensesByCategory.length} categories`,
      highlight: false,
    },
    {
      label: 'Net Operating Profit',
      val: formatPDFCurrency(report.netProfit),
      sub: `${report.netMarginPercent.toFixed(1)}% margin`,
      highlight: true,
    },
  ];

  kpiData.forEach((kpi, index) => {
    const cardX = leftMargin + index * (cardWidth + 3);
    
    if (kpi.highlight) {
      doc.setFillColor(emeraldBg[0], emeraldBg[1], emeraldBg[2]);
      doc.setDrawColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    } else {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    }
    
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    const innerX = cardX + 4;

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(kpi.highlight ? emeraldColor[0] : slate600[0], kpi.highlight ? emeraldColor[1] : slate600[1], kpi.highlight ? emeraldColor[2] : slate600[2]);
    doc.text(kpi.label.toUpperCase(), innerX, currentY + 6);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(kpi.highlight ? emeraldColor[0] : darkColor[0], kpi.highlight ? emeraldColor[1] : darkColor[1], kpi.highlight ? emeraldColor[2] : darkColor[2]);
    doc.text(kpi.val, innerX, currentY + 12.5);

    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(slate600[0], slate600[1], slate600[2]);
    doc.text(kpi.sub, innerX, currentY + 17.5);
  });

  currentY += cardHeight + 6;

  // 4. Cash Flow & Velocity Strip
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, currentY, contentWidth, 8, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('LIQUID CASH FLOW:', leftMargin + 4, currentY + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);
  doc.text(
    `Cash Collected: ${formatPDFCurrency(report.cashReceived)}   |   Credit Extended: ${formatPDFCurrency(report.creditGiven)}   |   Debt Recovered: ${formatPDFCurrency(report.debtRecovered)}   |   Velocity: ${report.cashCollectionRate}%`,
    leftMargin + 37,
    currentY + 5.2
  );

  currentY += 13;

  // 5. Table 1: Top Selling Inventory & Yield Margins
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Top Selling Inventory & Yield Margins', leftMargin, currentY);

  const productRows = report.topProducts.length > 0
    ? report.topProducts.map((p) => [
        p.name,
        String(p.quantity),
        formatPDFCurrency(p.revenue),
        formatPDFCurrency(p.cost),
        formatPDFCurrency(p.profit),
        `${p.marginPercent}%`,
      ])
    : [['No product sales recorded in this period', '-', '-', '-', '-', '-']];

  autoTable(doc, {
    startY: currentY + 2,
    head: [['Product Item', 'Units Sold', 'Total Revenue', 'Est. Cost', 'Gross Profit', 'Margin %']],
    body: productRows,
    theme: 'striped',
    margin: { left: leftMargin, right: rightMargin },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 1) {
        data.cell.styles.halign = 'right';
      }
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 6. Table 2: Operating Expenses Breakdown
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Operating Expenses Breakdown', leftMargin, currentY);

  const expenseRows = report.expensesByCategory.length > 0
    ? report.expensesByCategory.map((exp) => [
        exp.category,
        formatPDFCurrency(exp.amount),
        `${exp.percentage}% of total expenses`,
      ])
    : [['No operating expenses logged', '-', '-']];

  autoTable(doc, {
    startY: currentY + 2,
    head: [['Expense Category', 'Total Amount', 'Distribution Share']],
    body: expenseRows,
    theme: 'striped',
    margin: { left: leftMargin, right: rightMargin },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 1) {
        data.cell.styles.halign = 'right';
      }
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 7. Table 3: Performance Trajectory (Daily/Weekly/Monthly Trend)
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`Financial Trajectory & Velocity (${report.dailyTrend.length} intervals)`, leftMargin, currentY);

  const trendRows = report.dailyTrend.map((t) => [
    t.label,
    formatPDFCurrency(t.sales),
    formatPDFCurrency(t.profit),
    formatPDFCurrency(t.expenses),
    formatPDFCurrency(t.cash),
  ]);

  autoTable(doc, {
    startY: currentY + 2,
    head: [['Interval', 'Gross Sales', 'Net Profit', 'Expenses', 'Cash Collected']],
    body: trendRows,
    theme: 'striped',
    margin: { left: leftMargin, right: rightMargin },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 1) {
        data.cell.styles.halign = 'right';
      }
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 8. Table 4: Outstanding Customer Debtors (if any)
  if (report.activeDebtors.length > 0) {
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`Outstanding Customer Debtors Schedule (${report.activeDebtors.length} accounts)`, leftMargin, currentY);

    const debtorRows = report.activeDebtors.map((d) => [
      d.customerName,
      d.phone || 'N/A',
      formatPDFCurrency(d.totalPurchased),
      formatPDFCurrency(d.totalPaid),
      formatPDFCurrency(d.outstandingBalance),
    ]);

    autoTable(doc, {
      startY: currentY + 2,
      head: [['Customer Name', 'Phone Number', 'Total Purchased', 'Total Paid', 'Outstanding Balance Due']],
      body: debtorRows,
      theme: 'striped',
      margin: { left: leftMargin, right: rightMargin },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'left' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index >= 2) {
          data.cell.styles.halign = 'right';
        }
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
      },
    });
  }

  // 9. Footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, 284, pageWidth - rightMargin, 284);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slate400[0], slate400[1], slate400[2]);
    doc.text('Karra Autonomous Operating System for Informal Merchants • Deterministic Calculations', leftMargin, 288);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - rightMargin, 288, { align: 'right' });
  }

  // 10. Actual file download trigger
  const filename = `Karra_${report.period}_financial_report_${report.startDate}_to_${report.endDate}.pdf`;
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Export report to a printable HTML page with iframe fallback if popups are blocked in iframes
 */
export function exportReportToPrintableHTML(report: BusinessReportData, businessName: string): void {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.title} - ${businessName}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 12px;
      color: #059669;
      font-weight: 600;
      margin-top: 2px;
    }
    .report-meta {
      text-align: right;
    }
    .report-badge {
      display: inline-block;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .report-dates {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 4px;
    }
    .executive-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #059669;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #334155;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .kpi-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .kpi-value {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 4px 0 2px;
    }
    .kpi-sub {
      font-size: 11px;
      color: #059669;
      font-weight: 600;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin: 20px 0 10px;
      display: flex;
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      font-size: 11px;
      text-transform: uppercase;
    }
    td {
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    tr:nth-child(even) {
      background: #fafafa;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }
    .print-actions {
      margin-bottom: 20px;
      text-align: right;
    }
    .btn-print {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
    }
    @media print {
      .print-actions {
        display: none;
      }
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="brand-title">${businessName}</div>
      <div class="brand-sub">Karra Verified Financial Report & Operational Statement</div>
    </div>
    <div class="report-meta">
      <span class="report-badge">${report.period.toUpperCase()} REPORT</span>
      <div class="report-dates">${report.dateRangeLabel}</div>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="executive-box">
    <strong>Executive Performance Summary:</strong><br>
    ${report.summaryExecutiveText}
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Sales Revenue</div>
      <div class="kpi-value">${formatNaira(report.totalSales)}</div>
      <div class="kpi-sub">${report.totalTransactions} transactions</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Cost of Goods</div>
      <div class="kpi-value">${formatNaira(report.totalCostOfGoods)}</div>
      <div class="kpi-sub">${report.totalItemsSold} items moved</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Operating Expenses</div>
      <div class="kpi-value">${formatNaira(report.totalExpenses)}</div>
      <div class="kpi-sub">${report.expensesByCategory.length} categories</div>
    </div>
    <div class="kpi-card" style="border-color: #a7f3d0; background: #f0fdf4;">
      <div class="kpi-label" style="color: #047857;">Net Profit Result</div>
      <div class="kpi-value" style="color: #047857;">${formatNaira(report.netProfit)}</div>
      <div class="kpi-sub" style="color: #047857;">${report.netMarginPercent.toFixed(1)}% margin</div>
    </div>
  </div>

  <div class="section-title">
    <span>Top Selling Inventory & Yield Margins</span>
    <span style="font-size: 11px; color: #64748b; font-weight: normal;">Ranked by revenue</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th class="num">Units Sold</th>
        <th class="num">Revenue</th>
        <th class="num">Total Cost</th>
        <th class="num">Gross Profit</th>
        <th class="num">Margin %</th>
      </tr>
    </thead>
    <tbody>
      ${
        report.topProducts.length > 0
          ? report.topProducts
              .map(
                (p) => `
        <tr>
          <td style="font-weight: 600;">${p.name}</td>
          <td class="num">${p.quantity}</td>
          <td class="num">${formatNaira(p.revenue)}</td>
          <td class="num">${formatNaira(p.cost)}</td>
          <td class="num" style="color: #047857;">${formatNaira(p.profit)}</td>
          <td class="num">${p.marginPercent}%</td>
        </tr>
      `
              )
              .join('')
          : `<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No products sold in this period</td></tr>`
      }
    </tbody>
  </table>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
    <div>
      <div class="section-title">Operating Expenses Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="num">Amount</th>
            <th class="num">% Share</th>
          </tr>
        </thead>
        <tbody>
          ${
            report.expensesByCategory.length > 0
              ? report.expensesByCategory
                  .map(
                    (exp) => `
            <tr>
              <td>${exp.category}</td>
              <td class="num">${formatNaira(exp.amount)}</td>
              <td class="num">${exp.percentage}%</td>
            </tr>
          `
                  )
                  .join('')
              : `<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No expenses recorded</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <div>
      <div class="section-title">Liquid Cash vs Credit Position</div>
      <table>
        <thead>
          <tr>
            <th>Position Metric</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cash Collected in Hand</td>
            <td class="num" style="color: #047857;">${formatNaira(report.cashReceived)}</td>
          </tr>
          <tr>
            <td>Customer Credit Given</td>
            <td class="num" style="color: #b45309;">${formatNaira(report.creditGiven)}</td>
          </tr>
          <tr>
            <td>Debt Collected from Past Credit</td>
            <td class="num" style="color: #047857;">${formatNaira(report.debtRecovered)}</td>
          </tr>
          <tr>
            <td>Cash Collection Rate</td>
            <td class="num">${report.cashCollectionRate}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  ${
    report.activeDebtors.length > 0
      ? `
    <div class="section-title">Outstanding Customer Debtors Schedule</div>
    <table>
      <thead>
        <tr>
          <th>Customer Name</th>
          <th>Phone</th>
          <th class="num">Total Purchased</th>
          <th class="num">Total Paid</th>
          <th class="num">Current Balance Due</th>
        </tr>
      </thead>
      <tbody>
        ${report.activeDebtors
          .map(
            (d) => `
          <tr>
            <td style="font-weight: 600;">${d.customerName}</td>
            <td>${d.phone || 'N/A'}</td>
            <td class="num">${formatNaira(d.totalPurchased)}</td>
            <td class="num">${formatNaira(d.totalPaid)}</td>
            <td class="num" style="color: #dc2626; font-weight: 700;">${formatNaira(d.outstandingBalance)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `
      : ''
  }

  <div class="footer">
    <div>Karra - Autonomous Business OS for Informal Merchants</div>
    <div>Strict deterministic calculations. No hallucinations.</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
  } catch (e) {
    console.warn('Popup window blocked, falling back to hidden iframe for printing:', e);
  }

  // Fallback: Use hidden iframe in the document so it prints even when popup blockers block window.open
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 3000);
    }, 600);
  }
}
