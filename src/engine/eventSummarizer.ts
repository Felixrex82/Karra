import { BusinessEvent, MemoryUpdateItem } from '../types';
import { formatNaira } from './calculations';

/**
 * Intelligent headline and summary generator for any business transaction/event.
 * Ensures every transaction recorded on the platform has a concise, structured headline
 * and an executive summary reflecting clearly across the app pages.
 */
export function generateEventHeadlineAndSummary(event: Partial<BusinessEvent>): {
  headline: string;
  summary: string;
} {
  const type = event.type || 'SALE';
  const prod = event.productName ? event.productName.trim() : '';
  const cust = event.customerName ? event.customerName.trim() : '';
  const supp = event.supplierName ? event.supplierName.trim() : '';
  const qty = event.quantity;
  const unit = event.unit ? event.unit.trim().toLowerCase() : '';
  const unitLabel = unit ? `${unit}${qty && qty > 1 && !unit.endsWith('s') ? 's' : ''}` : qty && qty > 1 ? 'items' : 'item';

  switch (type) {
    case 'SALE': {
      // Formulate Headline
      let headline = 'Sale';
      if (qty && prod) {
        headline = `Sale • ${qty} ${unitLabel} ${prod}`;
      } else if (prod) {
        headline = `Sale • ${prod}`;
      } else if (event.totalRevenue) {
        headline = `Sale • ${formatNaira(event.totalRevenue)}`;
      }
      if (cust) {
        headline += ` to ${cust}`;
      }

      // Formulate Summary
      const revText = event.totalRevenue !== undefined ? `Sold for ${formatNaira(event.totalRevenue)}` : 'Recorded sale';
      const unitPriceText = event.unitSellingPrice && qty && qty > 1 ? ` (${formatNaira(event.unitSellingPrice)} each)` : '';
      
      let paymentPart = '';
      if (event.cashReceived !== undefined && event.receivableAdded && event.receivableAdded > 0) {
        paymentPart = ` Received ${formatNaira(event.cashReceived)} cash, with ${formatNaira(event.receivableAdded)} recorded as customer credit balance.`;
      } else if (event.receivableAdded && event.receivableAdded > 0 && (!event.cashReceived || event.cashReceived === 0)) {
        paymentPart = ` Full amount of ${formatNaira(event.receivableAdded)} recorded as customer debt on credit.`;
      } else if (event.cashReceived !== undefined && event.cashReceived > 0) {
        paymentPart = ` Paid in full with ${formatNaira(event.cashReceived)} cash.`;
      }

      let profitPart = '';
      if (event.grossProfit !== undefined) {
        if (event.grossProfit >= 0) {
          profitPart = ` Generated ${formatNaira(event.grossProfit)} gross margin.`;
        } else {
          profitPart = ` Resulted in a ${formatNaira(Math.abs(event.grossProfit))} gross loss.`;
        }
      }

      let promoPart = '';
      if (event.isPromotion) {
        promoPart = event.discountGiven ? ` Promotional discount of ${formatNaira(event.discountGiven)} applied.` : ' Special promotion applied.';
      }

      const summary = `${revText}${unitPriceText}.${paymentPart}${profitPart}${promoPart}`.trim();
      return { headline, summary };
    }

    case 'EXPENSE': {
      const cat = event.expenseCategory || 'Operational';
      const amount = event.expenseAmount || 0;
      const headline = `Expense • ${cat} (${formatNaira(amount)})`;
      
      // Clean up raw statement if present for clear summary
      let cleanDesc = event.rawUserText ? event.rawUserText.replace(/^spent\s+/i, '').replace(/^paid\s+/i, '').replace(/^bought\s+/i, '').trim() : '';
      if (cleanDesc) {
        cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);
      }
      const descPart = cleanDesc ? ` for "${cleanDesc}"` : '';
      const summary = `Paid ${formatNaira(amount)} from cash float${descPart}. Categorized under ${cat}.`;
      return { headline, summary };
    }

    case 'CUSTOMER_DEBT': {
      const owed = event.receivableAdded || event.totalRevenue || 0;
      const name = cust || 'Customer';
      const headline = `Customer Debt • ${name} (${formatNaira(owed)})`;
      const prodPart = prod ? ` for purchase of ${qty ? `${qty} ${unitLabel} ` : ''}${prod}` : '';
      const summary = `Recorded ${formatNaira(owed)} credit balance against ${name}${prodPart}. Added to active debtors ledger.`;
      return { headline, summary };
    }

    case 'DEBT_PAYMENT': {
      const paid = event.cashReceived || event.totalRevenue || 0;
      const name = cust || 'Customer';
      const headline = `Debt Recovery • ${name} (${formatNaira(paid)})`;
      const summary = `Collected ${formatNaira(paid)} cash settlement from ${name} towards their outstanding credit balance.`;
      return { headline, summary };
    }

    case 'PURCHASE_STOCK': {
      const cost = event.totalCostAtTime || event.totalRevenue || 0;
      const itemText = prod ? `${qty ? `${qty} ${unitLabel} ` : ''}${prod}` : 'inventory';
      const headline = `Restock • ${prod || 'Inventory'} (${formatNaira(cost)})`;
      const suppPart = supp ? ` from supplier ${supp}` : '';
      const unitCostPart = event.unitCostAtTime ? ` at ${formatNaira(event.unitCostAtTime)} per unit` : '';
      const summary = `Purchased ${itemText}${suppPart} for ${formatNaira(cost)}${unitCostPart}. Wholesale cost locked in inventory memory.`;
      return { headline, summary };
    }

    case 'OWNER_DRAWING': {
      const amount = event.ownerAmount || 0;
      const headline = `Owner Drawing • Cash Withdrawal (${formatNaira(amount)})`;
      const summary = `Withdrew ${formatNaira(amount)} cash for personal usage. Excluded from operational expenses to protect true business profit calculation.`;
      return { headline, summary };
    }

    case 'OWNER_INJECTION': {
      const amount = event.ownerAmount || 0;
      const headline = `Capital Injection • Owner Equity (${formatNaira(amount)})`;
      const summary = `Injected ${formatNaira(amount)} personal cash into business working capital. Not counted as revenue.`;
      return { headline, summary };
    }

    case 'RETURN_REFUND': {
      const refund = event.refundAmount || 0;
      const headline = `Return & Refund • ${prod || 'Goods'} (${formatNaira(refund)})`;
      const custPart = cust ? ` to customer ${cust}` : '';
      const summary = `Issued ${formatNaira(refund)} refund${custPart}${prod ? ` for returned ${prod}` : ''}. Recorded in audit trail.`;
      return { headline, summary };
    }

    case 'PRICE_CHANGE': {
      const headline = `Price Update • ${prod || 'Product'}`;
      const priceText = event.unitSellingPrice ? ` to ${formatNaira(event.unitSellingPrice)}` : '';
      const summary = `Adjusted selling price for ${prod || 'product'}${priceText} per ${unit || 'item'}.`;
      return { headline, summary };
    }

    case 'UNIT_DEF': {
      const headline = `Unit Conversion • ${prod || 'Product'}`;
      const summary = `Configured packaging ratio and cost yield economics for ${prod || 'product'}.`;
      return { headline, summary };
    }

    default: {
      const typeStr = String(type || 'RECORD');
      const headline = `Business Record • ${typeStr.replace('_', ' ')}`;
      const summary = event.systemResponseText || event.rawUserText || 'Recorded in business ledger.';
      return { headline, summary };
    }
  }
}

/**
 * Ensures an event has both headline and summary properties populated.
 */
export function ensureEventHeadlineAndSummary(event: BusinessEvent): BusinessEvent {
  if (event.headline && event.summary) {
    return event;
  }
  const { headline, summary } = generateEventHeadlineAndSummary(event);
  return {
    ...event,
    headline: event.headline || headline,
    summary: event.summary || summary,
  };
}

/**
 * Intelligent headline and summary generator for memory bank updates.
 */
export function generateMemoryHeadlineAndSummary(mem: MemoryUpdateItem): {
  headline: string;
  summary: string;
} {
  const target = mem.targetName || mem.data?.productName || mem.data?.customerName || mem.data?.supplierName || '';

  switch (mem.type) {
    case 'PRODUCT_COST': {
      const cost = mem.data?.cost || 0;
      return {
        headline: `Wholesale Cost • ${target || 'Product'}`,
        summary: `Stored wholesale cost of ${formatNaira(cost)} per unit in inventory memory bank.`,
      };
    }
    case 'PRODUCT_PRICE': {
      const price = mem.data?.price || 0;
      return {
        headline: `Selling Price • ${target || 'Product'}`,
        summary: `Configured standard selling price of ${formatNaira(price)} per unit.`,
      };
    }
    case 'CUSTOMER_DEBT': {
      const balance = mem.data?.balanceAdded || mem.data?.amount || 0;
      return {
        headline: `Credit Logged • ${target || 'Customer'}`,
        summary: `Recorded ${formatNaira(balance)} receivable debt on customer credit account.`,
      };
    }
    case 'CUSTOMER_PAYMENT': {
      const paid = mem.data?.amountPaid || mem.data?.amount || 0;
      return {
        headline: `Debt Payment • ${target || 'Customer'}`,
        summary: `Credited ${formatNaira(paid)} cash payment against customer outstanding balance.`,
      };
    }
    case 'CUSTOMER_NOTE': {
      return {
        headline: `Customer Note • ${target || 'Customer'}`,
        summary: mem.data?.note || mem.summary || 'Customer profile preference noted.',
      };
    }
    case 'CUSTOMER_PHONE': {
      return {
        headline: `Contact Number • ${target || 'Customer'}`,
        summary: `Saved phone number: ${mem.data?.phone || mem.summary}.`,
      };
    }
    case 'BUSINESS_RULE': {
      const cat = mem.data?.category || 'Policy';
      return {
        headline: `Business Rule • ${cat}`,
        summary: mem.data?.rule || mem.summary || 'Operating guardrail registered.',
      };
    }
    case 'SUPPLIER_INFO': {
      return {
        headline: `Supplier Contact • ${target || 'Supplier'}`,
        summary: mem.data?.phone ? `Contact: ${mem.data.phone}. ${mem.summary}` : mem.summary,
      };
    }
    case 'UNIT_CONVERSION': {
      return {
        headline: `Unit Conversion • ${target || 'Inventory'}`,
        summary: mem.summary || 'Packaging yield ratio and unit cost relationship defined.',
      };
    }
    case 'EVENT_CORRECTION': {
      return {
        headline: `Ledger Correction • ${target || 'Transaction'}`,
        summary: mem.summary || 'Updated transaction details and recalculated ledger numbers.',
      };
    }
    case 'CALENDAR_UPDATE': {
      return {
        headline: `Calendar Synced • ${mem.data?.date || 'Date'}`,
        summary: mem.summary || 'Synchronized date selection and daily ledger entries.',
      };
    }
    default: {
      return {
        headline: `Learned Fact • ${target || 'Business Fact'}`,
        summary: mem.summary || 'Saved in business memory bank.',
      };
    }
  }
}

/**
 * Ensures a memory item has both headline and summary properties populated.
 */
export function ensureMemoryHeadlineAndSummary(mem: MemoryUpdateItem): MemoryUpdateItem {
  if (mem.headline && mem.summary) {
    return mem;
  }
  const { headline, summary } = generateMemoryHeadlineAndSummary(mem);
  return {
    ...mem,
    headline: mem.headline || headline,
    summary: mem.summary || summary,
  };
}
