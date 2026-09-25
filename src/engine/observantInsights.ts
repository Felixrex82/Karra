import { BusinessState, BusinessPulseItem } from '../types';
import { formatNaira } from './calculations';

/**
 * Generates highly intelligent, 100% grounded Observant Insights and Business Pulse items.
 * STRICT RULE: Only reacts to and calculates from data actually fed into the platform.
 * NEVER fabricates facts, numbers, or customer names.
 */
export function generateObservantInsights(state: BusinessState): BusinessPulseItem[] {
  const insights: BusinessPulseItem[] = [];

  // ==========================================
  // 1. REVENUE & SALES PERFORMANCE (Real Events)
  // ==========================================
  const validSaleEvents = (state.events || []).filter(
    (e) => !e.isCorrected && e.type === 'SALE'
  );

  const totalSalesRevenue = validSaleEvents.reduce(
    (sum, e) => sum + (e.totalRevenue || 0),
    0
  );
  const totalGrossProfit = validSaleEvents.reduce(
    (sum, e) => sum + (e.grossProfit !== undefined ? e.grossProfit : (e.totalRevenue || 0) - (e.totalCostAtTime || 0)),
    0
  );

  if (validSaleEvents.length === 0) {
    insights.push({
      id: 'pulse-sales',
      type: 'NEUTRAL',
      title: 'No sales recorded yet',
      message: 'Enter sales using voice or text on the dashboard to track daily revenue, locked costs, and gross margins.',
      metric: '₦0',
      actionable: true,
      actionLabel: 'View Report',
      actionType: 'WEEKLY_REPORT',
    });
  } else {
    // Group sales by date to evaluate recent performance trend
    const salesByDate: Record<string, number> = {};
    validSaleEvents.forEach((e) => {
      const d = e.date || 'Undated';
      salesByDate[d] = (salesByDate[d] || 0) + (e.totalRevenue || 0);
    });

    const distinctDates = Object.keys(salesByDate).sort();

    if (distinctDates.length >= 4) {
      // Split into recent half and earlier half
      const mid = Math.floor(distinctDates.length / 2);
      const earlierDates = distinctDates.slice(0, mid);
      const recentDates = distinctDates.slice(mid);

      const earlierTotal = earlierDates.reduce((s, d) => s + salesByDate[d], 0);
      const recentTotal = recentDates.reduce((s, d) => s + salesByDate[d], 0);

      const earlierAvg = earlierTotal / earlierDates.length;
      const recentAvg = recentTotal / recentDates.length;

      if (earlierAvg > 0) {
        const pctDiff = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100);
        if (pctDiff > 0) {
          insights.push({
            id: 'pulse-sales',
            type: 'POSITIVE',
            title: `Sales velocity is up ${pctDiff}%`,
            message: `Recent daily sales average ${formatNaira(recentAvg)}, up from ${formatNaira(earlierAvg)} across ${validSaleEvents.length} recorded transaction(s).`,
            metric: `+${pctDiff}%`,
            actionable: true,
            actionLabel: 'View Sales Report',
            actionType: 'WEEKLY_REPORT',
          });
        } else if (pctDiff < 0) {
          insights.push({
            id: 'pulse-sales',
            type: 'WARNING',
            title: `Sales slowed by ${Math.abs(pctDiff)}%`,
            message: `Recent daily sales average ${formatNaira(recentAvg)} compared to ${formatNaira(earlierAvg)} previously across ${validSaleEvents.length} transactions.`,
            metric: `${pctDiff}%`,
            actionable: true,
            actionLabel: 'View Sales Report',
            actionType: 'WEEKLY_REPORT',
          });
        } else {
          insights.push({
            id: 'pulse-sales',
            type: 'POSITIVE',
            title: `${formatNaira(totalSalesRevenue)} generated in sales`,
            message: `Total revenue stands at ${formatNaira(totalSalesRevenue)} across ${validSaleEvents.length} transaction(s) with ${formatNaira(totalGrossProfit)} gross profit.`,
            metric: formatNaira(totalSalesRevenue, true),
            actionable: true,
            actionLabel: 'View Sales Report',
            actionType: 'WEEKLY_REPORT',
          });
        }
      } else {
        insights.push({
          id: 'pulse-sales',
          type: 'POSITIVE',
          title: `${formatNaira(totalSalesRevenue)} recorded in sales`,
          message: `Your ledger records ${formatNaira(totalSalesRevenue)} in total revenue across ${validSaleEvents.length} sale(s) with ${formatNaira(totalGrossProfit)} gross profit.`,
          metric: formatNaira(totalSalesRevenue, true),
          actionable: true,
          actionLabel: 'View Sales Report',
          actionType: 'WEEKLY_REPORT',
        });
      }
    } else {
      insights.push({
        id: 'pulse-sales',
        type: 'POSITIVE',
        title: `${formatNaira(totalSalesRevenue)} recorded in sales`,
        message: `Your ledger records ${formatNaira(totalSalesRevenue)} in total sales revenue with ${formatNaira(totalGrossProfit)} gross profit across ${validSaleEvents.length} sale(s).`,
        metric: formatNaira(totalSalesRevenue, true),
        actionable: true,
        actionLabel: 'View Sales Report',
        actionType: 'WEEKLY_REPORT',
      });
    }
  }

  // ==========================================
  // 2. OPERATIONAL EXPENSES (Real Events)
  // ==========================================
  const validExpenseEvents = (state.events || []).filter(
    (e) => !e.isCorrected && e.type === 'EXPENSE'
  );

  const totalExpenses = validExpenseEvents.reduce(
    (sum, e) => sum + (e.expenseAmount || e.totalRevenue || 0),
    0
  );

  if (validExpenseEvents.length === 0) {
    insights.push({
      id: 'pulse-expenses',
      type: 'NEUTRAL',
      title: 'No business expenses logged',
      message: 'Log operating costs (transport, utilities, fuel, maintenance) so your true net profit is accurately calculated.',
      metric: '₦0',
      actionable: true,
      actionLabel: 'Audit Expenses',
      actionType: 'AUDIT_EXPENSES',
    });
  } else {
    // Categorize actual expenses
    const categoryTotals: Record<string, number> = {};
    validExpenseEvents.forEach((e) => {
      const cat = (e.expenseCategory || e.category || 'General Operations').trim();
      const amt = e.expenseAmount || e.totalRevenue || 0;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const [topCatName, topCatAmount] = sortedCategories[0];
    const catPercent = totalExpenses > 0 ? Math.round((topCatAmount / totalExpenses) * 100) : 0;

    if (catPercent >= 40 && topCatAmount > 0) {
      insights.push({
        id: 'pulse-expenses',
        type: 'WARNING',
        title: `${topCatName} is your largest expense (${catPercent}%)`,
        message: `You have spent ${formatNaira(topCatAmount)} on ${topCatName} out of ${formatNaira(totalExpenses)} total operational costs.`,
        metric: formatNaira(topCatAmount, true),
        actionable: true,
        actionLabel: 'Audit Expenses',
        actionType: 'AUDIT_EXPENSES',
      });
    } else {
      insights.push({
        id: 'pulse-expenses',
        type: 'NEUTRAL',
        title: `${formatNaira(totalExpenses)} in total operating expenses`,
        message: `Largest operational overhead is ${topCatName} at ${formatNaira(topCatAmount)} (${catPercent}% of total expenses).`,
        metric: formatNaira(totalExpenses, true),
        actionable: true,
        actionLabel: 'Audit Expenses',
        actionType: 'AUDIT_EXPENSES',
      });
    }
  }

  // ==========================================
  // 3. CUSTOMER DEBTS & RECEIVABLES (Real Balances)
  // ==========================================
  const activeDebtors = (state.customers || []).filter(
    (c) => (c.outstandingBalance || 0) > 0
  );
  const totalDebt = activeDebtors.reduce(
    (sum, c) => sum + (c.outstandingBalance || 0),
    0
  );

  if (activeDebtors.length > 0) {
    // Sort debtors with highest balance first
    const sortedDebtors = [...activeDebtors].sort(
      (a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0)
    );

    const topDebtorsSummary = sortedDebtors
      .slice(0, 2)
      .map((d) => `${d.name} (${formatNaira(d.outstandingBalance)})`)
      .join(' and ');
    const othersCount = sortedDebtors.length - 2;

    insights.push({
      id: 'pulse-debts',
      type: 'WARNING',
      title: `${formatNaira(totalDebt)} in outstanding customer credit`,
      message: `${topDebtorsSummary}${othersCount > 0 ? ` plus ${othersCount} other customer(s)` : ''} have unpaid credit. Collecting outstanding balances will boost your liquid cash.`,
      metric: formatNaira(totalDebt, true),
      actionable: true,
      actionLabel: 'Collect Debts',
      actionType: 'COLLECT_DEBTS',
    });
  } else {
    insights.push({
      id: 'pulse-debts',
      type: 'POSITIVE',
      title: 'Zero outstanding customer debts',
      message: 'All customer accounts are 100% settled with no open credit. 100% of recorded revenue is in hand.',
      metric: '₦0 Debt',
      actionable: true,
      actionLabel: 'Customer Balances',
      actionType: 'COLLECT_DEBTS',
    });
  }

  // ==========================================
  // 4. PRODUCT MARGINS & YIELD ECONOMICS (Real Products)
  // ==========================================
  const products = (state.products || []).filter(
    (p) => p.name && (p.normalSellingPrice > 0 || p.currentCost > 0)
  );

  if (products.length === 0) {
    insights.push({
      id: 'pulse-products',
      type: 'NEUTRAL',
      title: 'No inventory items in memory',
      message: 'Save goods and wholesale purchase costs in the Memory tab so Karra can automatically monitor your unit profit margins.',
      metric: '0 Items',
      actionable: true,
      actionLabel: 'Add Goods to Memory',
      actionType: 'PRODUCT_OPPORTUNITY',
    });
  } else {
    // Check if any product has yield breakdown (e.g. bulk bag into retail bowls)
    const productWithYield = products.find(
      (p) => p.yieldInfo && p.yieldInfo.yieldCount > 1
    );

    if (productWithYield && productWithYield.yieldInfo) {
      const y = productWithYield.yieldInfo;
      const profitPerChild = productWithYield.normalSellingPrice - productWithYield.currentCost;
      const totalBagProfit = (productWithYield.normalSellingPrice * y.yieldCount) - y.parentCost;

      insights.push({
        id: 'pulse-products',
        type: 'OPPORTUNITY',
        title: `${productWithYield.name} yield delivers strong margins`,
        message: `Yield of ~${y.yieldCount} ${y.childUnit}s per ${y.parentUnit} yields ${formatNaira(profitPerChild)} margin per ${y.childUnit} (${formatNaira(totalBagProfit)} profit per ${y.parentUnit}).`,
        metric: formatNaira(totalBagProfit, true),
        actionable: true,
        actionLabel: 'View Yield Economics',
        actionType: 'PRODUCT_OPPORTUNITY',
      });
    } else {
      // Find product with highest gross margin percentage
      const validMarginProducts = products
        .filter((p) => p.normalSellingPrice > 0 && p.currentCost >= 0)
        .map((p) => {
          const unitProfit = p.normalSellingPrice - p.currentCost;
          const marginPct = Math.round((unitProfit / p.normalSellingPrice) * 100);
          return { product: p, unitProfit, marginPct };
        })
        .sort((a, b) => b.marginPct - a.marginPct);

      if (validMarginProducts.length > 0) {
        const top = validMarginProducts[0];
        insights.push({
          id: 'pulse-products',
          type: 'OPPORTUNITY',
          title: `${top.product.name} has your highest profit margin (${top.marginPct}%)`,
          message: `Selling at ${formatNaira(top.product.normalSellingPrice)} against ${formatNaira(top.product.currentCost)} cost generates ${formatNaira(top.unitProfit)} gross profit per ${top.product.unit || 'unit'}.`,
          metric: `${top.marginPct}% margin`,
          actionable: true,
          actionLabel: 'Product Economics',
          actionType: 'PRODUCT_OPPORTUNITY',
        });
      } else {
        const firstProd = products[0];
        insights.push({
          id: 'pulse-products',
          type: 'NEUTRAL',
          title: `Active inventory: ${firstProd.name}`,
          message: `Current retail price is ${formatNaira(firstProd.normalSellingPrice)} with wholesale cost of ${formatNaira(firstProd.currentCost)} per ${firstProd.unit || 'unit'}.`,
          metric: formatNaira(firstProd.normalSellingPrice),
          actionable: true,
          actionLabel: 'View Product Memory',
          actionType: 'PRODUCT_OPPORTUNITY',
        });
      }
    }
  }

  return insights;
}
