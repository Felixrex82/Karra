import {
  BusinessEvent,
  BusinessState,
  FollowUpQuestion,
  ExpenseCategory,
  MemoryUpdateItem,
  ProductMemory,
} from '../types';
import { computeSaleMetrics, computeMultiItemTransaction, formatNaira } from './calculations';
import { getTodayDateStr, extractDateFromText, formatDateShort } from '../utils/dateUtils';
import { ensureEventHeadlineAndSummary } from './eventSummarizer';

/**
 * Parses numeric strings like "6000", "80k", "1.5k", "150k", "₦59,000", "#58,000", "2m"
 */
export function parseNairaAmount(text: string): number | null {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase().replace(/[₦#,]/g, '');
  
  // 80k or 1.5k
  const kMatch = cleaned.match(/^([0-9.]+)\s*k$/);
  if (kMatch) {
    const num = parseFloat(kMatch[1]);
    return isNaN(num) ? null : num * 1000;
  }

  // 2m or 1.2m
  const mMatch = cleaned.match(/^([0-9.]+)\s*m$/);
  if (mMatch) {
    const num = parseFloat(mMatch[1]);
    return isNaN(num) ? null : num * 1000000;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export interface ParseResult {
  isQuestion: boolean;
  questionAnswer?: string;
  createdEvent?: BusinessEvent;
  createdEvents?: BusinessEvent[];
  correctedEvent?: BusinessEvent;
  deletedEventId?: string;
  isCorrection?: boolean;
  targetDate?: string;
  targetCalendarDate?: string;
  shouldNavigateToCalendar?: boolean;
  followUpRequired?: FollowUpQuestion;
  memoryUpdate?: {
    type: 'PRODUCT_COST' | 'PRODUCT_PRICE' | 'UNIT_CONVERSION' | 'CUSTOMER_PAYMENT' | 'CUSTOMER_DEBT' | 'EVENT_CORRECTION' | 'CALENDAR_UPDATE';
    data: any;
  };
  memoryUpdates?: MemoryUpdateItem[];
  plainResponseText: string;
}

/**
 * Resolves the unit cost for a product based on the unit of sale mentioned.
 * If merchant mentions a bulk/parent unit (e.g. "bag", "carton"), returns the parent wholesale cost.
 * If merchant mentions a child unit (e.g. "bowl", "bottle"), returns the yield-derived unit cost.
 */
export function resolveProductCostForUnit(
  product: ProductMemory | undefined,
  unitMentioned: string | undefined,
  state: BusinessState
): { unitCost: number; costBasis?: string; isEstimate?: boolean } {
  if (!product) return { unitCost: 0 };

  const normUnit = (unitMentioned || '').toLowerCase().trim();

  // Check product's own yieldInfo
  if (product.yieldInfo) {
    const parent = product.yieldInfo.parentUnit.toLowerCase();
    const child = product.yieldInfo.childUnit.toLowerCase();

    // Check if bulk parent unit was sold (e.g. "bag", "bags", "carton", "cartons")
    if (normUnit.startsWith(parent) || normUnit.includes(parent) || (parent === 'bag' && normUnit.includes('bag'))) {
      const parentCost = product.yieldInfo.parentCost || (product.currentCost * product.yieldInfo.yieldCount);
      return {
        unitCost: parentCost,
        costBasis: `Wholesale ${product.yieldInfo.parentUnit} cost: ₦${parentCost.toLocaleString()}`,
        isEstimate: false,
      };
    }

    // Check if child unit was sold (e.g. "bowl", "bowls", "bottle", "bottles")
    if (normUnit.startsWith(child) || normUnit.includes(child)) {
      return {
        unitCost: product.currentCost,
        costBasis: `Yield estimate: 1 ${product.yieldInfo.parentUnit} (${product.yieldInfo.yieldCount} ${product.yieldInfo.childUnit}s) at ₦${product.yieldInfo.parentCost.toLocaleString()}`,
        isEstimate: product.yieldInfo.isEstimate,
      };
    }
  }

  // Check state.unitRelationships
  const rel = (state.unitRelationships || []).find(
    (r) => r.productName && r.productName.toLowerCase() === product.name.toLowerCase()
  );
  if (rel) {
    const pUnit = rel.parentUnit.toLowerCase();
    if (normUnit.startsWith(pUnit) || normUnit.includes(pUnit)) {
      const parentCost = rel.parentCost || (product.currentCost * (rel.yieldCount || rel.ratio || 1));
      return {
        unitCost: parentCost,
        costBasis: `Wholesale ${rel.parentUnit} cost: ₦${parentCost.toLocaleString()}`,
        isEstimate: false,
      };
    }
  }

  return {
    unitCost: product.currentCost,
    costBasis: undefined,
    isEstimate: product.yieldInfo?.isEstimate || false,
  };
}

/**
 * Handles explicit natural language corrections and platform data updates:
 * - Event corrections in ledger & calendar
 * - Product price / wholesale cost corrections
 * - Customer debt / balance corrections
 * - Voiding / deleting mistaken entries
 */
export function handleCorrectionInput(input: string, state: BusinessState): ParseResult | null {
  const lower = input.toLowerCase();
  const isCorrection =
    lower.includes('correct') ||
    lower.includes('change') ||
    lower.includes('update') ||
    lower.includes('actually') ||
    lower.includes('wrong') ||
    lower.includes('fix') ||
    lower.includes('adjust') ||
    lower.includes('delete') ||
    lower.includes('remove') ||
    lower.includes('void') ||
    lower.includes('input in my calendar') ||
    lower.includes('in my calendar');

  if (!isCorrection) return null;

  const todayStr = getTodayDateStr();
  const targetDate = extractDateFromText(input) || todayStr;

  // A) DELETION / VOID INTENT
  // e.g. "Delete that last sale", "Remove the duplicate transaction", "Void the 10k expense", "Delete rice sale"
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('void')) {
    if (lower.includes('sale') || lower.includes('transaction') || lower.includes('event') || lower.includes('expense') || lower.includes('entry') || lower.includes('rice') || lower.includes('shirt')) {
      const activeEvents = state.events.filter((e) => !e.isCorrected);
      // If user specified a product name (e.g. "delete the rice sale")
      const matchedProd = matchKnownProduct(lower, state.products);
      let targetEvent = matchedProd
        ? activeEvents.find((e) => e.productName?.toLowerCase() === matchedProd.name.toLowerCase()) || null
        : null;

      if (!targetEvent && activeEvents.length > 0) {
        targetEvent = activeEvents[0];
      }

      if (targetEvent) {
        return {
          isQuestion: false,
          isCorrection: true,
          deletedEventId: targetEvent.id,
          targetDate: targetEvent.date,
          targetCalendarDate: targetEvent.date,
          shouldNavigateToCalendar: true,
          plainResponseText: `Deleted permanently: The ${targetEvent.productName || targetEvent.type} entry of ${formatNaira(targetEvent.totalRevenue || targetEvent.expenseAmount || 0)} on ${formatDateShort(targetEvent.date)} has been permanently deleted from your calendar, ledger, and all pages. Your totals now match up.`,
          memoryUpdates: [
            {
              type: 'EVENT_CORRECTION',
              summary: `Permanently deleted ${targetEvent.type} entry (${formatNaira(targetEvent.totalRevenue || targetEvent.expenseAmount || 0)})`,
              data: { eventId: targetEvent.id, deletedEventId: targetEvent.id, action: 'VOIDED' },
            },
            {
              type: 'CALENDAR_UPDATE',
              summary: `Calendar updated for ${formatDateShort(targetEvent.date)}`,
              data: { date: targetEvent.date },
            },
          ],
        };
      }
    }
  }

  // B) PRODUCT COST OR PRICE CORRECTION
  // e.g. "Change the cost of rice to 55,000", "Correct the price of rice to 2,500"
  const prodMatch = matchKnownProduct(lower, state.products);
  if (prodMatch && (lower.includes('cost') || lower.includes('price'))) {
    const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : null;
    if (amt && amt > 0) {
      if (lower.includes('cost') || lower.includes('wholesale')) {
        return {
          isQuestion: false,
          isCorrection: true,
          plainResponseText: `Corrected: The wholesale cost for ${prodMatch.name} has been updated to ${formatNaira(amt)}. Previous cost was ${formatNaira(prodMatch.currentCost)}. Future calculations and calendar logs will reflect this.`,
          memoryUpdate: {
            type: 'PRODUCT_COST',
            data: { productName: prodMatch.name, cost: amt, date: todayStr, note: `Owner correction: ${input}` },
          },
          memoryUpdates: [
            {
              type: 'PRODUCT_COST',
              targetName: prodMatch.name,
              summary: `Corrected ${prodMatch.name} cost to ${formatNaira(amt)}`,
              data: { productName: prodMatch.name, cost: amt },
            },
          ],
        };
      } else if (lower.includes('price') || lower.includes('sell for')) {
        return {
          isQuestion: false,
          isCorrection: true,
          plainResponseText: `Corrected: The normal selling price for ${prodMatch.name} has been updated to ${formatNaira(amt)}. Previous price was ${formatNaira(prodMatch.normalSellingPrice)}.`,
          memoryUpdate: {
            type: 'PRODUCT_PRICE',
            data: { productName: prodMatch.name, price: amt, date: todayStr, note: `Owner correction: ${input}` },
          },
          memoryUpdates: [
            {
              type: 'PRODUCT_PRICE',
              targetName: prodMatch.name,
              summary: `Corrected ${prodMatch.name} selling price to ${formatNaira(amt)}`,
              data: { productName: prodMatch.name, price: amt },
            },
          ],
        };
      }
    }
  }

  // C) CUSTOMER BALANCE / DEBT CORRECTION
  // e.g. "Correct Chuks balance to 60k", "Change David's debt to 30,000"
  const custMatch = matchKnownCustomer(lower, state.customers);
  if (custMatch && (lower.includes('balance') || lower.includes('debt') || lower.includes('owes') || lower.includes('owing'))) {
    const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : null;
    if (amt !== null) {
      return {
        isQuestion: false,
        isCorrection: true,
        plainResponseText: `Corrected: ${custMatch.name}'s outstanding balance has been adjusted to ${formatNaira(amt)} (Previous: ${formatNaira(custMatch.outstandingBalance)}).`,
        memoryUpdate: {
          type: 'CUSTOMER_DEBT',
          data: { customerName: custMatch.name, amount: amt, date: todayStr, note: `Owner correction: ${input}` },
        },
        memoryUpdates: [
          {
            type: 'CUSTOMER_DEBT',
            targetName: custMatch.name,
            summary: `Corrected ${custMatch.name} balance to ${formatNaira(amt)}`,
            data: { customerName: custMatch.name, amount: amt },
          },
        ],
      };
    }
  }

  // D) TRANSACTION / CALENDAR INPUT CORRECTION
  // e.g. "I sold 2 bags of rice for #58,000 each and then change the input in my calendar to match this"
  // or "Change the input in my calendar to 2 bags of rice for #58,000 each"
  // or "Change the rice sale to 2 bags for #58,000 each"
  // or "Correct yesterday's rice sale to 2 bags for #58,000 each"
  const hasSaleTerms =
    lower.includes('sold') ||
    lower.includes('sale') ||
    lower.includes('bags of') ||
    lower.includes('bowls of') ||
    lower.includes('rice') ||
    lower.includes('shirts') ||
    lower.includes('shoes') ||
    lower.includes('for #') ||
    lower.includes('each') ||
    lower.includes('input in my calendar');

  if (hasSaleTerms) {
    // Extract quantity
    let quantity = 1;
    const qtyMatch = input.match(/([0-9]+)\s*(?:bags?|bowls?|cartons?|shirts?|shoes?|units?|pieces?|items?)/i) ||
      input.match(/(?:sold|bought|change|to|into)\s+([0-9]+)/i);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
    }

    // Extract unit
    let unitMentioned = '';
    const unitMatch = input.match(/[0-9]+\s+([a-zA-Z]+)\s+(?:of\s+)?([a-zA-Z]+)/i) ||
      input.match(/([0-9]+)\s+([a-zA-Z]+)/i);
    if (unitMatch && !['naira', 'k', 'm'].includes(unitMatch[1].toLowerCase())) {
      unitMentioned = unitMatch[1].toLowerCase();
    }

    // Extract product
    const product = matchKnownProduct(lower, state.products);
    const prodName = product ? product.name : (extractProductName(input) || 'Rice');

    // Extract price or revenue
    let unitPrice = 0;
    let totalRevenue = 0;
    const eachMatch = input.match(/(?:for|at)\s+(?:[₦#]?\s*([0-9.,]+[km]?))\s+each/i);
    if (eachMatch) {
      unitPrice = parseNairaAmount(eachMatch[1]) || 0;
      totalRevenue = unitPrice * quantity;
    } else {
      const forMatch = input.match(/(?:for|to|at)\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
      if (forMatch) {
        totalRevenue = parseNairaAmount(forMatch[1]) || 0;
        unitPrice = quantity > 0 ? totalRevenue / quantity : totalRevenue;
      }
    }

    // Resolve unit cost
    const costResolution = resolveProductCostForUnit(product, unitMentioned, state);
    const unitCost = costResolution.unitCost;
    const totalCost = unitCost * quantity;
    const grossProfit = totalRevenue - totalCost;

    // Search for existing matching event in state.events
    // Priority: matching product on targetDate -> matching product in general -> most recent sale
    const matchingOnDate = state.events.find(
      (e) => !e.isCorrected && e.date === targetDate && product && e.productName?.toLowerCase() === product.name.toLowerCase()
    );
    const matchingAnywhere = state.events.find(
      (e) => !e.isCorrected && product && e.productName?.toLowerCase() === product.name.toLowerCase()
    );
    const existingEvent = matchingOnDate || (lower.includes('yesterday') || lower.includes('today') ? undefined : matchingAnywhere);

    if (existingEvent) {
      const relogId = `ev-relog-${Date.now()}`;
      const timeStr = existingEvent.timeStr || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const correctedEvent: BusinessEvent = {
        ...existingEvent,
        id: relogId,
        date: targetDate || existingEvent.date,
        timeStr,
        productName: prodName,
        quantity,
        unitSellingPrice: unitPrice,
        totalRevenue,
        cashReceived: totalRevenue,
        receivableAdded: 0,
        unitCostAtTime: unitCost,
        totalCostAtTime: totalCost,
        grossProfit,
        costIsEstimate: costResolution.isEstimate,
        costEstimateBasis: costResolution.costBasis,
        isCorrected: false, // Active, permanent relogged entry
        correctionOfId: existingEvent.id,
        auditTrail: [
          ...(existingEvent.auditTrail || []),
          {
            timestamp: new Date().toISOString(),
            action: 'CORRECTION',
            previousValue: `${existingEvent.quantity || 1} ${existingEvent.productName} for ${formatNaira(existingEvent.totalRevenue || 0)}`,
            newValue: `${quantity} ${unitMentioned || 'units'} ${prodName} for ${formatNaira(totalRevenue)}`,
            note: `Permanently replaced previous record and relogged via AI Assistant: ${input}`,
            performedBy: 'AI Assistant / Owner',
          },
        ],
      };

      const profitDesc = grossProfit >= 0 ? `estimated gross profit of ${formatNaira(grossProfit)}` : `gross deficit of ${formatNaira(Math.abs(grossProfit))}`;
      const responseText = `Deleted previous entry and relogged in your calendar: Sold ${quantity} ${unitMentioned || 'units'} of ${prodName} for ${formatNaira(totalRevenue)} (${formatNaira(unitPrice)} each). Cost for this batch is ${formatNaira(totalCost)}, resulting in a ${profitDesc}. The old record was permanently removed and the new details relogged into your calendar and ledger to ensure calculations match up cleanly.`;

      return {
        isQuestion: false,
        isCorrection: true,
        deletedEventId: existingEvent.id,
        correctedEvent,
        targetDate: correctedEvent.date,
        targetCalendarDate: correctedEvent.date,
        shouldNavigateToCalendar: true,
        plainResponseText: responseText,
        memoryUpdates: [
          {
            type: 'EVENT_CORRECTION',
            targetName: prodName,
            summary: `Deleted previous entry and relogged ${quantity} ${unitMentioned || ''} ${prodName} (${formatNaira(totalRevenue)})`,
            data: {
              eventId: existingEvent.id,
              deletedEventId: existingEvent.id,
              action: 'PERMANENT_DELETE_AND_RELOG',
              quantity,
              totalRevenue,
              date: correctedEvent.date,
            },
          },
          {
            type: 'CALENDAR_UPDATE',
            summary: `Calendar input updated for ${formatDateShort(correctedEvent.date)}`,
            data: { date: correctedEvent.date },
          },
        ],
      };
    } else {
      // No prior event found to edit: Log it as a fresh transaction and update calendar input
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const profitDesc = grossProfit >= 0 ? `estimated gross profit of ${formatNaira(grossProfit)}` : `gross deficit of ${formatNaira(Math.abs(grossProfit))}`;
      const responseText = `Recorded: Sold ${quantity} ${unitMentioned || 'units'} of ${prodName} for ${formatNaira(totalRevenue)} (${formatNaira(unitPrice)} each). Cost of ${quantity} ${unitMentioned || 'units'} was ${formatNaira(totalCost)}, making a ${profitDesc}. Your calendar input and daily ledger for ${formatDateShort(targetDate)} have been updated to match this.`;

      const newEvent: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: targetDate,
        timeStr,
        type: 'SALE',
        rawUserText: input,
        systemResponseText: responseText,
        productName: prodName,
        quantity,
        unitSellingPrice: unitPrice,
        totalRevenue,
        cashReceived: totalRevenue,
        receivableAdded: 0,
        unitCostAtTime: unitCost,
        totalCostAtTime: totalCost,
        costIsEstimate: costResolution.isEstimate,
        costEstimateBasis: costResolution.costBasis,
        grossProfit,
      };

      return {
        isQuestion: false,
        isCorrection: false,
        createdEvent: newEvent,
        targetDate,
        targetCalendarDate: targetDate,
        shouldNavigateToCalendar: true,
        plainResponseText: responseText,
        memoryUpdates: [
          {
            type: 'CALENDAR_UPDATE',
            summary: `Calendar input updated for ${formatDateShort(targetDate)}: Sold ${quantity} ${unitMentioned || ''} ${prodName}`,
            data: { date: targetDate },
          },
        ],
      };
    }
  }

  return null;
}

/**
 * Main Interpreter: Orchestrates parsing natural language against current business memory and ledger.
 */
export async function processNaturalInput(
  rawInput: string,
  state: BusinessState
): Promise<ParseResult> {
  const input = rawInput.trim();
  const lower = input.toLowerCase();
  const todayStr = getTodayDateStr(); // Reference date matching system date
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // 0. Check for Corrections / Modifications across ANY platform data (Events, Calendar input, Prices, Costs, Debts):
  const correctionResult = handleCorrectionInput(input, state);
  if (correctionResult) {
    return correctionResult;
  }

  // 1. Check if this is answering a pending follow-up question
  if (state.pendingFollowUp) {
    const followUp = state.pendingFollowUp;
    const answeredCost = parseNairaAmount(input);

    if (followUp.missingField === 'COST_PER_UNIT' && answeredCost !== null && answeredCost > 0) {
      const pending = followUp.pendingEvent;
      const productName = followUp.productName || pending.productName || 'Item';
      const qty = pending.quantity || 1;
      const totalRev = pending.totalRevenue || 0;
      const totalCost = answeredCost * qty;
      const grossProfit = totalRev - totalCost;

      // Check if user also provided normal selling price
      const normalPriceMatch = input.match(/(?:sell|selling|normal|price)\s*(?:is|at|for)?\s*([₦#]?[0-9.,km]+)/i);
      const normalPrice = normalPriceMatch ? parseNairaAmount(normalPriceMatch[1]) : undefined;

      const singularName = productName.replace(/s$/i, '');

      const completedEvent: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'SALE',
        rawUserText: pending.rawUserText || input,
        systemResponseText: `Got it. You sold the ${qty} ${productName.toLowerCase()} for ${formatNaira(totalRev)}. They cost you about ${formatNaira(totalCost)} in total, so you made an estimated ${formatNaira(grossProfit)} gross profit. I'll remember ${formatNaira(answeredCost)} as the current cost of one ${singularName.toLowerCase()}. If your supplier price changes, just tell me.`,
        productName,
        customerName: pending.customerName,
        quantity: qty,
        unitSellingPrice: pending.unitSellingPrice || (totalRev / qty),
        totalRevenue: totalRev,
        cashReceived: pending.cashReceived !== undefined ? pending.cashReceived : totalRev,
        receivableAdded: pending.receivableAdded || 0,
        unitCostAtTime: answeredCost,
        totalCostAtTime: totalCost,
        grossProfit,
        costIsEstimate: false,
      };

      const memoryUpdates: MemoryUpdateItem[] = [
        {
          type: 'PRODUCT_COST',
          summary: `Cost of ${productName} recorded as ${formatNaira(answeredCost)}`,
          data: {
            productName,
            cost: answeredCost,
            normalSellingPrice: normalPrice || pending.unitSellingPrice,
            date: todayStr,
            note: 'Learned from owner answer during sale',
          },
        },
      ];

      return {
        isQuestion: false,
        createdEvent: completedEvent,
        memoryUpdates,
        memoryUpdate: memoryUpdates[0] as any,
        plainResponseText: completedEvent.systemResponseText,
      };
    }
  }

  // 2. Primary: High-Precision Natural Language Understanding via Gemini API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second client timeout ensures responses comfortably under 15s

    const response = await fetch('/api/gemini/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        userInput: input,
        memoryContext: {
          products: state.products.map((p) => ({
            name: p.name,
            cost: p.currentCost,
            price: p.normalSellingPrice,
            unit: p.unit,
            yieldInfo: p.yieldInfo,
          })),
          customers: state.customers.map((c) => ({
            name: c.name,
            owes: c.outstandingBalance,
          })),
          unitRules: state.unitRelationships,
        },
        recentEventsContext: state.events.slice(0, 5).map((e) => ({
          date: e.date,
          type: e.type,
          productName: e.productName,
          customerName: e.customerName,
          totalRevenue: e.totalRevenue,
          cashReceived: e.cashReceived,
          expenseAmount: e.expenseAmount,
          rawUserText: e.rawUserText,
        })),
      }),
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    if (data.success && data.data) {
      const intent = data.data.intent;
      const interpretation = data.data.interpretationSummary;

      if (intent === 'BUSINESS_QUESTION') {
        const directAnswer = answerBusinessQuestion(input, state);
        return {
          isQuestion: true,
          questionAnswer: directAnswer,
          plainResponseText: directAnswer,
        };
      }

      // Multi-item sale from AI
      if (intent === 'RECORD_SALE' && Array.isArray(data.data.items) && data.data.items.length > 1) {
        const events: BusinessEvent[] = data.data.items.map((it: any, idx: number) => {
          const prod = matchKnownProduct(it.productName || '', state.products) || {
            name: it.productName || 'Items',
            currentCost: 0,
            normalSellingPrice: it.unitPrice || (it.totalAmount / (it.quantity || 1)),
          };
          const itQty = it.quantity || 1;
          const itTotal = it.totalAmount || (it.unitPrice ? it.unitPrice * itQty : 0);
          const itCash = it.cashPaid !== undefined ? it.cashPaid : itTotal;
          const itRec = Math.max(0, itTotal - itCash);
          const costRes = resolveProductCostForUnit(prod, it.unit, state);
          const itCost = costRes.unitCost || prod.currentCost || 0;
          const itTotalCost = itCost * itQty;
          const itGross = itTotal - itTotalCost;
          const rawEv: BusinessEvent = {
            id: `ev-ai-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            date: todayStr,
            timeStr,
            type: 'SALE' as const,
            rawUserText: input,
            systemResponseText: `Got it. Sold ${itQty} ${it.unit ? `${it.unit} ` : ''}${prod.name} for ${formatNaira(itTotal)}.`,
            productName: prod.name,
            customerName: data.data.customerName,
            quantity: itQty,
            unit: it.unit,
            unitSellingPrice: itTotal / itQty,
            totalRevenue: itTotal,
            cashReceived: itCash,
            receivableAdded: itRec,
            unitCostAtTime: itCost,
            totalCostAtTime: itTotalCost,
            grossProfit: itGross,
          };
          return ensureEventHeadlineAndSummary(rawEv);
        });
        const allRev = events.reduce((s, e) => s + (e.totalRevenue || 0), 0);
        const allCost = events.reduce((s, e) => s + (e.totalCostAtTime || 0), 0);
        const allGross = events.reduce((s, e) => s + (e.grossProfit || 0), 0);
        const totalReceivable = events.reduce((s, e) => s + (e.receivableAdded || 0), 0);
        const summaries = events.map(e => `• ${e.quantity} ${e.unit ? `${e.unit} ` : ''}${e.productName}: ${formatNaira(e.totalRevenue || 0)}`).join('\n');
        const plainText = `Recorded ${events.length} sales:\n${summaries}\n\nTotal Revenue: ${formatNaira(allRev)} | Total Cost: ${formatNaira(allCost)} | Net Gross Profit: ${formatNaira(allGross)}.${totalReceivable > 0 && data.data.customerName ? ` Added ${formatNaira(totalReceivable)} to ${data.data.customerName}'s balance.` : ''}`;
        
        const memoryUpdates: MemoryUpdateItem[] = [];
        if (totalReceivable > 0 && data.data.customerName) {
          memoryUpdates.push({
            type: 'CUSTOMER_DEBT',
            summary: `${data.data.customerName} debt balance increased by ${formatNaira(totalReceivable)}`,
            data: {
              customerName: data.data.customerName,
              balanceAdded: totalReceivable,
              date: todayStr,
              note: `Debt from purchase: ${input}`,
            },
          });
        }

        return {
          isQuestion: false,
          createdEvent: events[0],
          createdEvents: events,
          memoryUpdates: memoryUpdates.length > 0 ? memoryUpdates : undefined,
          memoryUpdate: memoryUpdates[0] ? (memoryUpdates[0] as any) : undefined,
          plainResponseText: plainText,
        };
      }

      // Single sale from AI (e.g. "David bought 2 bags of rice for #130k but paid #78k")
      if (intent === 'RECORD_SALE' && (data.data.totalAmount || (Array.isArray(data.data.items) && data.data.items[0]?.totalAmount))) {
        const itemObj = Array.isArray(data.data.items) && data.data.items.length > 0 ? data.data.items[0] : null;
        const pName = itemObj?.productName || data.data.productName || 'Items';
        const prod = matchKnownProduct(pName, state.products) || {
          name: pName,
          currentCost: 0,
          normalSellingPrice: itemObj?.unitPrice || data.data.unitPrice || 0,
        };

        const qty = itemObj?.quantity || data.data.quantity || 1;
        const totalRev = itemObj?.totalAmount || data.data.totalAmount || ((itemObj?.unitPrice || data.data.unitPrice || 0) * qty);
        const cash = data.data.cashPaid !== undefined ? data.data.cashPaid : (totalRev - (data.data.outstandingDebt || 0));
        const receivable = data.data.outstandingDebt !== undefined ? data.data.outstandingDebt : Math.max(0, totalRev - cash);
        const unit = itemObj?.unit || data.data.unit || '';
        const custName = data.data.customerName || extractCustomerName(input);

        // Resolve unit cost accurately (wholesale bag vs retail bowl)
        const costRes = resolveProductCostForUnit(prod, unit, state);
        const unitCost = costRes.unitCost > 0 ? costRes.unitCost : (prod.currentCost || 0);

        // If product cost is unknown for a named product (e.g. "I sold 3 shirts for 6000"), ask intelligent follow-up
        const prodDisplayName = (prod && prod.name && prod.name.toLowerCase() !== 'items') ? prod.name : pName;
        const singularName = prodDisplayName.replace(/s$/i, '');
        const isGenericItem = prodDisplayName.toLowerCase() === 'item' || prodDisplayName.toLowerCase() === 'items';

        if (unitCost === 0 && !isGenericItem) {
          const pendingEvent: Partial<BusinessEvent> = {
            rawUserText: input,
            productName: prodDisplayName,
            customerName: custName,
            quantity: qty,
            unitSellingPrice: totalRev / qty,
            totalRevenue: totalRev,
            cashReceived: cash,
            receivableAdded: receivable,
          };

          const followUp: FollowUpQuestion = {
            id: `fu-${Date.now()}`,
            prompt: `How much does one ${singularName.toLowerCase()} normally cost you?`,
            missingField: 'COST_PER_UNIT',
            productName: prodDisplayName,
            pendingEvent,
            helperText: `Tell me how much one ${singularName.toLowerCase()} costs you (or how much you normally sell it for), and I'll calculate your exact profit and remember it for future sales.`,
          };

          return {
            isQuestion: false,
            followUpRequired: followUp,
            plainResponseText: `How much does one ${singularName.toLowerCase()} normally cost you?`,
          };
        }

        const metrics = computeSaleMetrics({
          quantity: qty,
          totalRevenue: totalRev,
          cashReceived: cash,
          unitCostAtTime: unitCost > 0 ? unitCost : undefined,
          costIsEstimate: costRes.isEstimate,
          costEstimateBasis: costRes.costBasis,
        });

        const ev: BusinessEvent = {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayStr,
          timeStr,
          type: 'SALE',
          rawUserText: input,
          systemResponseText: `Got it. Sold ${qty} ${unit ? `${unit} ` : ''}${prod.name} for ${formatNaira(totalRev)}. Paid: ${formatNaira(cash)}.${receivable > 0 ? ` ${custName ? custName : 'Customer'} still owes ${formatNaira(receivable)}.` : ''}`,
          productName: prod.name,
          customerName: custName,
          quantity: qty,
          unit: unit || undefined,
          unitSellingPrice: totalRev / qty,
          totalRevenue: totalRev,
          cashReceived: cash,
          receivableAdded: receivable,
          unitCostAtTime: metrics.unitCostAtTime,
          totalCostAtTime: metrics.totalCostAtTime,
          costIsEstimate: metrics.costIsEstimate,
          costEstimateBasis: metrics.costEstimateBasis,
          grossProfit: metrics.grossProfit,
          headline: data.data.headline,
          summary: data.data.summary,
        };

        const finalEv = ensureEventHeadlineAndSummary(ev);

        const memoryUpdates: MemoryUpdateItem[] = [];
        if (receivable > 0 && custName) {
          memoryUpdates.push({
            type: 'CUSTOMER_DEBT',
            summary: `${custName} debt balance increased by ${formatNaira(receivable)}`,
            data: {
              customerName: custName,
              balanceAdded: receivable,
              date: todayStr,
              note: `Debt from purchase of ${qty} ${unit ? `${unit} ` : ''}${prod.name}`,
            },
          });
        }

        return {
          isQuestion: false,
          createdEvent: finalEv,
          memoryUpdates: memoryUpdates.length > 0 ? memoryUpdates : undefined,
          memoryUpdate: memoryUpdates[0] ? (memoryUpdates[0] as any) : undefined,
          plainResponseText: finalEv.systemResponseText,
        };
      }

      // Expense from AI
      if (intent === 'RECORD_EXPENSE') {
        const expCat = data.data.expenseCategory || detectExpenseCategory(input);
        const expAmt = data.data.expenseAmount || data.data.totalAmount || parseNairaAmount(input) || 0;
        if (expAmt > 0) {
          const ev: BusinessEvent = {
            id: `ev-${Date.now()}`,
            timestamp: new Date().toISOString(),
            date: todayStr,
            timeStr,
            type: 'EXPENSE',
            rawUserText: input,
            systemResponseText: `Recorded: Spent ${formatNaira(expAmt)} on ${expCat}. Deducted from net operating cash.`,
            expenseCategory: expCat,
            expenseAmount: expAmt,
            headline: data.data.headline || `Expense • ${expCat}`,
            summary: data.data.summary || `Spent ${formatNaira(expAmt)} on ${expCat}.`,
          };
          const finalEv = ensureEventHeadlineAndSummary(ev);
          return {
            isQuestion: false,
            createdEvent: finalEv,
            plainResponseText: finalEv.systemResponseText,
          };
        }
      }

      // Customer Payment from AI
      if (intent === 'RECORD_CUSTOMER_PAYMENT') {
        const custName = data.data.customerName || extractCustomerName(input) || 'Customer';
        const payAmt = data.data.cashPaid || data.data.totalAmount || parseNairaAmount(input) || 0;
        if (payAmt > 0) {
          const ev: BusinessEvent = {
            id: `ev-${Date.now()}`,
            timestamp: new Date().toISOString(),
            date: todayStr,
            timeStr,
            type: 'DEBT_PAYMENT',
            rawUserText: input,
            systemResponseText: `Recorded: Received ${formatNaira(payAmt)} payment from ${custName}. Credited their customer account.`,
            customerName: custName,
            cashReceived: payAmt,
            totalRevenue: payAmt,
            headline: data.data.headline || `Payment • ${custName} Paid ${formatNaira(payAmt)}`,
            summary: data.data.summary || `Received ${formatNaira(payAmt)} from ${custName}.`,
          };
          const finalEv = ensureEventHeadlineAndSummary(ev);
          return {
            isQuestion: false,
            createdEvent: finalEv,
            memoryUpdate: {
              type: 'CUSTOMER_PAYMENT',
              data: { customerName: custName, amountPaid: payAmt, date: todayStr },
            },
            plainResponseText: finalEv.systemResponseText,
          };
        }
      }

      // Customer Debt from AI
      if (intent === 'RECORD_DEBT_OWED') {
        const custName = data.data.customerName || extractCustomerName(input) || 'Customer';
        const owedAmt = data.data.outstandingDebt || data.data.totalAmount || parseNairaAmount(input) || 0;
        if (owedAmt > 0) {
          const ev: BusinessEvent = {
            id: `ev-${Date.now()}`,
            timestamp: new Date().toISOString(),
            date: todayStr,
            timeStr,
            type: 'CUSTOMER_DEBT',
            rawUserText: input,
            systemResponseText: `Recorded: ${custName} is owing ${formatNaira(owedAmt)}. Added to customer debt ledger.`,
            customerName: custName,
            receivableAdded: owedAmt,
            totalRevenue: owedAmt,
            headline: data.data.headline || `Debt • ${custName} Owes ${formatNaira(owedAmt)}`,
            summary: data.data.summary || `${custName} is owing ${formatNaira(owedAmt)}.`,
          };
          const finalEv = ensureEventHeadlineAndSummary(ev);
          return {
            isQuestion: false,
            createdEvent: finalEv,
            memoryUpdate: {
              type: 'CUSTOMER_DEBT',
              data: { customerName: custName, balanceAdded: owedAmt, date: todayStr },
            },
            plainResponseText: finalEv.systemResponseText,
          };
        }
      }

      // Stock Purchase from AI (e.g. "I bought 30 cartons from Musa at 12k each")
      if (intent === 'RECORD_PURCHASE_STOCK') {
        const qty = data.data.quantity || 1;
        const totalAmt = data.data.totalAmount || 0;
        const supName = data.data.supplierName || 'Supplier';
        const prodName = data.data.productName || 'Stock';
        const ev: BusinessEvent = {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayStr,
          timeStr,
          type: 'EXPENSE',
          expenseCategory: 'Procurement',
          expenseAmount: totalAmt,
          rawUserText: input,
          systemResponseText: `Recorded: Bought ${qty} ${prodName} from ${supName} for ${formatNaira(totalAmt)} (Procurement Expense). Inventory and supplier records updated.`,
          supplierName: supName,
          productName: prodName,
          quantity: qty,
          totalCostAtTime: totalAmt,
          totalRevenue: 0,
          cashReceived: 0,
          headline: data.data.headline || `Restocked • ${qty} ${prodName}`,
          summary: data.data.summary || `Purchased ${qty} ${prodName} from ${supName} for ${formatNaira(totalAmt)}.`,
        };
        const finalEv = ensureEventHeadlineAndSummary(ev);
        const unitCost = Math.round(totalAmt / qty);
        const memoryUpdates: MemoryUpdateItem[] = [
          {
            type: 'SUPPLIER_INFO',
            summary: `Supplier ${supName} record updated for ${prodName}`,
            data: {
              supplierName: supName,
              note: `Supplied ${qty} ${prodName} for ${formatNaira(totalAmt)} on ${todayStr}`,
            },
          },
          {
            type: 'PRODUCT_COST',
            summary: `Cost of ${prodName} recorded at ${formatNaira(unitCost)} each`,
            data: {
              productName: prodName,
              cost: unitCost,
              date: todayStr,
              note: `Stock purchase from ${supName}`,
            },
          },
        ];
        return {
          isQuestion: false,
          createdEvent: finalEv,
          memoryUpdates,
          memoryUpdate: memoryUpdates[0] as any,
          plainResponseText: finalEv.systemResponseText,
        };
      }

      // Return/Refund from AI
      if (intent === 'RECORD_RETURN_REFUND') {
        const custName = data.data.customerName || 'Customer';
        const refAmt = data.data.totalAmount || 0;
        const ev: BusinessEvent = {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayStr,
          timeStr,
          type: 'RETURN_REFUND',
          rawUserText: input,
          systemResponseText: `Recorded: Refunded ${formatNaira(refAmt)} to ${custName}. Ledger updated.`,
          customerName: custName,
          refundAmount: refAmt,
          headline: data.data.headline || `Refund • ${formatNaira(refAmt)} to ${custName}`,
          summary: data.data.summary || `Refunded ${formatNaira(refAmt)} to ${custName}.`,
        };
        const finalEv = ensureEventHeadlineAndSummary(ev);
        return {
          isQuestion: false,
          createdEvent: finalEv,
          plainResponseText: finalEv.systemResponseText,
        };
      }

      // Owner drawings or injections from AI
      if (intent === 'RECORD_OWNER_DRAWING') {
        const amt = data.data.totalAmount || 50000;
        const ev: BusinessEvent = {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayStr,
          timeStr,
          type: 'OWNER_DRAWING',
          rawUserText: input,
          systemResponseText: `Recorded: You took ${formatNaira(amt)} from the business for personal use. Tracked as Owner Drawings.`,
          ownerAmount: amt,
          isOwnerDrawing: true,
          headline: `Owner Drawing • ${formatNaira(amt)}`,
          summary: `Took ${formatNaira(amt)} for personal use.`,
        };
        const finalEv = ensureEventHeadlineAndSummary(ev);
        return {
          isQuestion: false,
          createdEvent: finalEv,
          plainResponseText: finalEv.systemResponseText,
        };
      }

      if (intent === 'RECORD_OWNER_INJECTION') {
        const amt = data.data.totalAmount || 200000;
        const ev: BusinessEvent = {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayStr,
          timeStr,
          type: 'OWNER_INJECTION',
          rawUserText: input,
          systemResponseText: `Recorded: You put ${formatNaira(amt)} personal money into the business. Tracked as Owner Capital Injection.`,
          ownerAmount: amt,
          isOwnerInjection: true,
          headline: `Owner Capital • +${formatNaira(amt)}`,
          summary: `Put ${formatNaira(amt)} personal capital into the business.`,
        };
        const finalEv = ensureEventHeadlineAndSummary(ev);
        return {
          isQuestion: false,
          createdEvent: finalEv,
          plainResponseText: finalEv.systemResponseText,
        };
      }

      // Other intents from AI
      if (interpretation) {
        return {
          isQuestion: false,
          plainResponseText: interpretation,
        };
      }
    }
  } catch (err) {
    console.warn('[NLP Interpreter] Gemini interpretation fallback active:', err);
  }

  // 3. Robust Deterministic Fallback Engine
  return parseDeterministicFallback(input, state);
}

/**
 * Robust deterministic fallback engine:
 * Ensures the business operating system remains 100% functional even when
 * offline or during external AI service high-demand capacity spikes.
 */
function parseDeterministicFallback(input: string, state: BusinessState): ParseResult {
  const lower = input.toLowerCase();
  const todayStr = getTodayDateStr();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // 1. Business Questions
  if (
    isBusinessQuestion(lower) ||
    lower.includes('?') ||
    lower.startsWith('what') ||
    lower.startsWith('how') ||
    lower.startsWith('who') ||
    lower.startsWith('which') ||
    lower.startsWith('is there') ||
    lower.startsWith('can i')
  ) {
    const answer = answerBusinessQuestion(input, state);
    return {
      isQuestion: true,
      questionAnswer: answer,
      plainResponseText: answer,
    };
  }

  // 2. Unit Economics / Relationship Definition ("One bag of rice costs 59,000 and yields 45 bowls")
  const unitDefRegex = /(?:one|1)\s+([a-zA-Z]+)\s+of\s+([a-zA-Z]+)\s+costs?\s+(?:[₦#]?\s*([0-9.,km]+))\s+and\s+(?:i\s+(?:normally\s+)?get\s+(?:about\s+)?([0-9]+)\s+([a-zA-Z]+))/i;
  const unitMatch = input.match(unitDefRegex);
  if (unitMatch) {
    const parentUnit = unitMatch[1];
    const productName = unitMatch[2];
    const costRaw = parseNairaAmount(unitMatch[3]) || 0;
    const count = parseInt(unitMatch[4], 10) || 1;
    const childUnit = unitMatch[5];
    const estCostPerChild = costRaw / count;

    return {
      isQuestion: false,
      plainResponseText: `Saved in Business Memory: 1 ${parentUnit} of ${productName} costs ${formatNaira(costRaw)} and yields approximately ${count} ${childUnit}s. Estimated cost per ${childUnit} is ${formatNaira(estCostPerChild)}. When you record sales of ${childUnit}s, I will use this to estimate your profit.`,
      memoryUpdate: {
        type: 'UNIT_CONVERSION',
        data: {
          productName,
          parentUnit,
          childUnit,
          ratio: count,
          parentCost: costRaw,
          estimatedCostPerChild: estCostPerChild,
          isEstimate: true,
        },
      },
    };
  }

  // 3. Owner Money vs Business Money
  if (lower.includes('took') && (lower.includes('myself') || lower.includes('personal') || lower.includes('for me'))) {
    const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 50000;
    const validAmt = amt || 50000;
    const ev: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      timeStr,
      type: 'OWNER_DRAWING',
      rawUserText: input,
      systemResponseText: `Recorded: You took ${formatNaira(validAmt)} from the business for personal use. Tracked as Owner Drawings, NOT operating expense.`,
      ownerAmount: validAmt,
      isOwnerDrawing: true,
      headline: `Owner Drawing • ${formatNaira(validAmt)}`,
      summary: `Took ${formatNaira(validAmt)} for personal use.`,
    };
    const finalEv = ensureEventHeadlineAndSummary(ev);
    return {
      isQuestion: false,
      createdEvent: finalEv,
      plainResponseText: finalEv.systemResponseText,
    };
  }

  if ((lower.includes('put') || lower.includes('invested') || lower.includes('added')) && (lower.includes('own money') || lower.includes('personal') || lower.includes('capital'))) {
    const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 200000;
    const validAmt = amt || 200000;
    const ev: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      timeStr,
      type: 'OWNER_INJECTION',
      rawUserText: input,
      systemResponseText: `Recorded: You put ${formatNaira(validAmt)} personal money into the business. Tracked as Owner Capital Injection.`,
      ownerAmount: validAmt,
      isOwnerInjection: true,
      headline: `Owner Capital • +${formatNaira(validAmt)}`,
      summary: `Put ${formatNaira(validAmt)} personal capital into the business.`,
    };
    const finalEv = ensureEventHeadlineAndSummary(ev);
    return {
      isQuestion: false,
      createdEvent: finalEv,
      plainResponseText: finalEv.systemResponseText,
    };
  }

  // 4. Returns / Refunds
  if (lower.includes('refunded') || lower.includes('refund')) {
    const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const customerMatch = matchKnownCustomer(lower, state.customers);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 20000;
    const validAmt = amt || 20000;
    const custName = customerMatch ? customerMatch.name : (extractCustomerName(input) || 'Customer');
    const ev: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      timeStr,
      type: 'RETURN_REFUND',
      rawUserText: input,
      systemResponseText: `Recorded: Refunded ${formatNaira(validAmt)} to ${custName}. Ledger updated.`,
      customerName: custName,
      refundAmount: validAmt,
      headline: `Refund • ${formatNaira(validAmt)} to ${custName}`,
      summary: `Refunded ${formatNaira(validAmt)} to ${custName}.`,
    };
    const finalEv = ensureEventHeadlineAndSummary(ev);
    return {
      isQuestion: false,
      createdEvent: finalEv,
      plainResponseText: finalEv.systemResponseText,
    };
  }

  if (lower.includes('returned')) {
    const customerMatch = matchKnownCustomer(lower, state.customers);
    const prodMatch = matchKnownProduct(lower, state.products);
    const qtyMatch = input.match(/returned\s+([0-9]+)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const custName = customerMatch ? customerMatch.name : (extractCustomerName(input) || 'Customer');
    const prodName = prodMatch ? prodMatch.name : 'items';
    const ev: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      timeStr,
      type: 'RETURN_REFUND',
      rawUserText: input,
      systemResponseText: `Recorded: ${custName} returned ${qty} ${prodName}. Restocked into inventory.`,
      customerName: custName,
      productName: prodName,
      returnedQuantity: qty,
      headline: `Return • ${qty} ${prodName} from ${custName}`,
      summary: `${custName} returned ${qty} ${prodName}.`,
    };
    const finalEv = ensureEventHeadlineAndSummary(ev);
    return {
      isQuestion: false,
      createdEvent: finalEv,
      plainResponseText: finalEv.systemResponseText,
    };
  }

  // 5. Customer Debt Payment ("Ada paid me 40k today", "Chuks paid 50k" - ONLY when not a product sale)
  const isSaleContext = lower.includes('bought') || lower.includes('sold') || lower.includes('purchase') || matchKnownProduct(lower, state.products);
  if (!isSaleContext && (lower.includes('paid me') || lower.includes('brought money') || lower.includes('cleared debt') || lower.includes('paid debt'))) {
    const custMatch = matchKnownCustomer(lower, state.customers) || extractCustomerName(input);
    const custName = typeof custMatch === 'object' && custMatch !== null ? custMatch.name : (custMatch || 'Customer');
    const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 0;
    if (amt && amt > 0) {
      const ev: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'DEBT_PAYMENT',
        rawUserText: input,
        systemResponseText: `Recorded: Received ${formatNaira(amt)} payment from ${custName}. Credited their account.`,
        customerName: custName,
        cashReceived: amt,
        totalRevenue: amt,
        headline: `Payment • ${custName} Paid ${formatNaira(amt)}`,
        summary: `Received ${formatNaira(amt)} from ${custName}.`,
      };
      const finalEv = ensureEventHeadlineAndSummary(ev);
      return {
        isQuestion: false,
        createdEvent: finalEv,
        memoryUpdate: {
          type: 'CUSTOMER_PAYMENT',
          data: { customerName: custName, amountPaid: amt },
        },
        plainResponseText: finalEv.systemResponseText,
      };
    }
  }

  // 6. Customer Debt Owed ("Chuks is owing me 80k" - ONLY when not a product sale)
  if (!isSaleContext && (lower.includes('owing') || lower.includes('owes') || lower.includes('debt'))) {
    const custMatch = matchKnownCustomer(lower, state.customers) || extractCustomerName(input);
    const custName = typeof custMatch === 'object' && custMatch !== null ? custMatch.name : (custMatch || 'Customer');
    const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 0;
    if (amt && amt > 0) {
      const ev: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'CUSTOMER_DEBT',
        rawUserText: input,
        systemResponseText: `Recorded: ${custName} is owing ${formatNaira(amt)}. Added to customer debt ledger.`,
        customerName: custName,
        totalRevenue: amt,
        cashReceived: 0,
        receivableAdded: amt,
        headline: `Debt • ${custName} Owes ${formatNaira(amt)}`,
        summary: `${custName} is owing ${formatNaira(amt)}.`,
      };
      const finalEv = ensureEventHeadlineAndSummary(ev);
      return {
        isQuestion: false,
        createdEvent: finalEv,
        memoryUpdate: {
          type: 'CUSTOMER_DEBT',
          data: { customerName: custName, balanceAdded: amt },
        },
        plainResponseText: finalEv.systemResponseText,
      };
    }
  }

  // 7. Supplier Purchase / Stock ("I bought 30 cartons from Musa at 12k each" - ONLY merchant buying from supplier)
  if (
    (lower.startsWith('i bought') || lower.includes('bought from') || lower.includes('from supplier') || matchKnownSupplier(lower, state.suppliers)) &&
    !lower.includes('paid me') &&
    !matchKnownCustomer(lower, state.customers)
  ) {
    const qtyMatch = input.match(/bought\s+([0-9]+)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const supplierMatch = matchKnownSupplier(lower, state.suppliers);
    const prodMatch = matchKnownProduct(lower, state.products);
    let totalAmt = 0;
    const atEachMatch = input.match(/at\s+(?:[₦#]?\s*([0-9.,]+[km]?))\s+each/i);
    if (atEachMatch) {
      const unitAmt = parseNairaAmount(atEachMatch[1]) || 0;
      totalAmt = unitAmt * qty;
    } else {
      const forMatch = input.match(/for\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
      if (forMatch) {
        totalAmt = parseNairaAmount(forMatch[1]) || 0;
      }
    }

    const prodTextMatch = input.match(/bought\s+[0-9]+\s+([a-zA-Z]+)/i);
    const supTextMatch = input.match(/from\s+([A-Za-z]+)/i);

    const supName = supplierMatch
      ? supplierMatch.name
      : supTextMatch
      ? supTextMatch[1].charAt(0).toUpperCase() + supTextMatch[1].slice(1)
      : 'Supplier';
    const prodName = prodMatch
      ? prodMatch.name
      : prodTextMatch
      ? prodTextMatch[1].charAt(0).toUpperCase() + prodTextMatch[1].slice(1)
      : 'Stock';

    const ev: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      timeStr,
      type: 'EXPENSE',
      expenseCategory: 'Procurement',
      expenseAmount: totalAmt,
      rawUserText: input,
      systemResponseText: `Recorded: Bought ${qty} ${prodName} from ${supName} for ${formatNaira(totalAmt)} (Procurement Expense). Inventory and supplier records updated.`,
      supplierName: supName,
      productName: prodName,
      quantity: qty,
      totalCostAtTime: totalAmt,
      totalRevenue: 0,
      cashReceived: 0,
      headline: `Restocked • ${qty} ${prodName}`,
      summary: `Purchased ${qty} ${prodName} from ${supName} for ${formatNaira(totalAmt)}.`,
    };
    const finalEv = ensureEventHeadlineAndSummary(ev);
    const unitCost = Math.round(totalAmt / qty);
    const memoryUpdates: MemoryUpdateItem[] = [
      {
        type: 'SUPPLIER_INFO',
        summary: `Supplier ${supName} record updated for ${prodName}`,
        data: {
          supplierName: supName,
          note: `Supplied ${qty} ${prodName} for ${formatNaira(totalAmt)} on ${todayStr}`,
        },
      },
      {
        type: 'PRODUCT_COST',
        summary: `Cost of ${prodName} recorded at ${formatNaira(unitCost)} each`,
        data: {
          productName: prodName,
          cost: unitCost,
          date: todayStr,
          note: `Stock purchase from ${supName}`,
        },
      },
    ];
    return {
      isQuestion: false,
      createdEvent: finalEv,
      memoryUpdates,
      memoryUpdate: memoryUpdates[0] as any,
      plainResponseText: finalEv.systemResponseText,
    };
  }

  // 8. SALES (Multi-item AND Single-item) - Evaluated BEFORE expenses!
  // Any phrasing where customer purchases, or merchant sells, or mentions products/quantities/prices:
  // e.g. "David bought 2 bags of rice for #130k but paid #78k", "I sold 2 bags...", "Sold 3 shirts for 6000"
  const multiFallback = detectAndParseMultiItemSale(input, state);
  if (multiFallback) return multiFallback;

  const isSaleStatement =
    lower.includes('sold') ||
    lower.includes('bought') ||
    lower.includes('purchase') ||
    lower.includes('paid for') ||
    lower.includes('took') ||
    lower.includes('collected') ||
    lower.includes('each') ||
    lower.includes('at #') ||
    lower.includes('@') ||
    matchKnownProduct(lower, state.products) !== null ||
    matchKnownCustomer(lower, state.customers) !== null ||
    /^[0-9]+\s*(?:bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?)/i.test(input);

  if (isSaleStatement) {
    const saleResult = parseSaleStatement(input, state);
    return saleResult;
  }

  // 9. EXPENSES (Operating overheads ONLY - strictly evaluated when NOT a sale)
  const isExplicitExpense =
    (lower.includes('spent') ||
      lower.startsWith('paid') ||
      lower.includes('paid for rent') ||
      lower.includes('shop rent') ||
      lower.includes('stall rent') ||
      lower.includes('fuel') ||
      lower.includes('transport') ||
      lower.includes('dispatch') ||
      lower.includes('light bill') ||
      lower.includes('electric') ||
      lower.includes('generator') ||
      lower.includes('cleaner') ||
      lower.includes('salary') ||
      lower.includes('salaries') ||
      lower.includes('packaging nylon') ||
      lower.includes('levy') ||
      lower.includes('repair')) &&
    !lower.includes('bought') &&
    !lower.includes('sold') &&
    !lower.includes('paid me') &&
    matchKnownProduct(lower, state.products) === null &&
    matchKnownCustomer(lower, state.customers) === null;

  if (isExplicitExpense) {
    const cat = detectExpenseCategory(lower);
    // Specifically search for monetary amounts (#5k, ₦5,000, 15k, or following spent/paid)
    const amtMatch =
      input.match(/(?:[₦#]\s*([0-9.,]+[km]?))/i) ||
      input.match(/([0-9.,]+[km])\b/i) ||
      input.match(/(?:spent|paid)\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 0;
    if (amt && amt > 0) {
      const ev: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'EXPENSE',
        rawUserText: input,
        systemResponseText: `Recorded: Spent ${formatNaira(amt)} on ${cat}. Deducted from today's net operating cash.`,
        expenseCategory: cat,
        expenseAmount: amt,
        headline: `Expense • ${cat}`,
        summary: `Spent ${formatNaira(amt)} on ${cat}.`,
      };
      const finalEv = ensureEventHeadlineAndSummary(ev);
      return {
        isQuestion: false,
        createdEvent: finalEv,
        plainResponseText: finalEv.systemResponseText,
      };
    }
  }

  return {
    isQuestion: false,
    plainResponseText: `I didn't quite catch how that translates to a sale, expense, or customer debt. You can say things like "David bought 2 bags of rice for #130k but paid #78k", "I sold 3 shirts for 6000", or "Spent 15k on transport".`,
  };
}

/**
 * Parses Sale Statements with full support for:
 * - Missing cost -> triggers follow-up
 * - Split payments -> "paid 100k, owes 50k" or "bought 5 but only paid for 3"
 * - Promotional discounts -> "3 for 35k instead of 50k"
 * - Unit yields -> "8 bowls of rice for 2k each"
 */
function parseSaleStatement(input: string, state: BusinessState): ParseResult {
  const todayStr = getTodayDateStr();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const lower = input.toLowerCase();

  // 1. Identify product
  const product = matchKnownProduct(lower, state.products);
  const customer = matchKnownCustomer(lower, state.customers);
  const customerName = customer ? customer.name : extractCustomerName(input);

  // Extract target date from text or default to today
  const targetDate = extractDateFromText(input) || todayStr;
  const shouldNavigateToCalendar =
    lower.includes('calendar') || lower.includes('in my calendar') || lower.includes('change the input');

  // 2. Extract Quantity & Unit
  let quantity = 1;
  const qtyMatch = input.match(/([0-9]+)\s*(?:bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?)/i) ||
    input.match(/(?:sold|bought)\s+([0-9]+)/i);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
  }

  let unitMentioned = '';
  const unitMatch = input.match(/[0-9]+\s+([a-zA-Z]+)\s+(?:of\s+)?([a-zA-Z]+)/i) ||
    input.match(/([0-9]+)\s+([a-zA-Z]+)/i);
  if (unitMatch && !['naira', 'k', 'm'].includes(unitMatch[1].toLowerCase())) {
    unitMentioned = unitMatch[1].toLowerCase();
  }

  // 3. Extract Total Revenue / Sale Value
  let totalRevenue = 0;
  let unitPrice = 0;
  let isRateMultiplied = false;

  // Check unit rate multiplication: e.g. "at #100 each", "for #100 each", "@ 500", "500 each"
  const rateVal = extractUnitRate(input);
  if (rateVal && rateVal > 0) {
    unitPrice = rateVal;
    totalRevenue = unitPrice * quantity;
    isRateMultiplied = true;
  } else {
    // Check "for 35k instead of 50k" (Promo)
    const promoMatch = input.match(/for\s+(?:[₦#]?\s*([0-9.,]+[km]?))\s+instead\s+of\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    if (promoMatch) {
      const actualRev = parseNairaAmount(promoMatch[1]) || 0;
      const normalRev = parseNairaAmount(promoMatch[2]) || 0;
      totalRevenue = actualRev;
      unitPrice = actualRev / quantity;

      const costRes = resolveProductCostForUnit(product, unitMentioned, state);
      const unitCost = costRes.unitCost;
      const metrics = computeSaleMetrics({
        quantity,
        totalRevenue: actualRev,
        cashReceived: actualRev,
        unitCostAtTime: unitCost > 0 ? unitCost : undefined,
        normalSellingPrice: normalRev / quantity,
        isPromotion: true,
      });

      let promoResponse = `Got it. Recorded promotional sale: Sold ${quantity} ${product?.name || 'items'} for ${formatNaira(actualRev)} instead of normal ${formatNaira(normalRev)} (Discount: ${formatNaira(metrics.discountGiven || 0)}). Estimated cost ${formatNaira(metrics.totalCostAtTime || 0)}, making estimated gross profit of ${formatNaira(metrics.grossProfit || 0)}.`;
      if (shouldNavigateToCalendar || targetDate !== todayStr) {
        promoResponse += ` Your calendar input and daily ledger for ${formatDateShort(targetDate)} have been updated to match this.`;
      }

      const promoEvent: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: targetDate,
        timeStr,
        type: 'SALE',
        rawUserText: input,
        systemResponseText: promoResponse,
        productName: product?.name || 'Items',
        category: product?.category || inferProductCategory(product?.name || 'Items'),
        productCategory: product?.category || inferProductCategory(product?.name || 'Items'),
        customerName,
        quantity,
        unitSellingPrice: unitPrice,
        totalRevenue: actualRev,
        cashReceived: actualRev,
        receivableAdded: 0,
        unitCostAtTime: unitCost,
        totalCostAtTime: metrics.totalCostAtTime,
        grossProfit: metrics.grossProfit,
        isPromotion: true,
        normalPotentialRevenue: normalRev,
        discountGiven: metrics.discountGiven,
      };

      return {
        isQuestion: false,
        createdEvent: promoEvent,
        targetDate,
        targetCalendarDate: targetDate,
        shouldNavigateToCalendar,
        plainResponseText: promoResponse,
      };
    }

    // Standard "for 6000" or "for 150k"
    const forMatch = input.match(/for\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    if (forMatch) {
      totalRevenue = parseNairaAmount(forMatch[1]) || 0;
      unitPrice = totalRevenue / quantity;
    } else {
      // Look for standalone amount
      const amtMatch = input.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
      if (amtMatch) {
        totalRevenue = parseNairaAmount(amtMatch[1]) || 0;
        unitPrice = totalRevenue / quantity;
      }
    }
  }

  // 4. Extract Cash Paid vs Debt:
  // "he paid 100k" / "paid 90k" / "paid for 3"
  let cashReceived = totalRevenue;
  let receivableAdded = 0;

  const paidPartialMatch = input.match(/paid\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
  if (paidPartialMatch) {
    const paidAmt = parseNairaAmount(paidPartialMatch[1]);
    if (paidAmt !== null) {
      cashReceived = paidAmt;
      receivableAdded = Math.max(0, totalRevenue - cashReceived);
    }
  } else {
    // "bought 5 but only paid for 3"
    const paidForQtyMatch = input.match(/paid\s+for\s+([0-9]+)/i);
    if (paidForQtyMatch) {
      const paidQty = parseInt(paidForQtyMatch[1], 10);
      cashReceived = paidQty * unitPrice;
      receivableAdded = Math.max(0, totalRevenue - cashReceived);
    }
  }

  // 5. Check if Cost is known in Business Memory (with Unit Yield awareness):
  const costResolution = resolveProductCostForUnit(product, unitMentioned, state);
  const unitCost = costResolution.unitCost;

  if (product && unitCost > 0) {
    const metrics = computeSaleMetrics({
      quantity,
      totalRevenue,
      cashReceived,
      unitCostAtTime: unitCost,
      costIsEstimate: costResolution.isEstimate,
      costEstimateBasis: costResolution.costBasis,
    });

    let plainResponse = '';
    const unitStr = unitMentioned ? `${unitMentioned} of ` : '';
    const grossVal = metrics.grossProfit ?? 0;
    const profitStr = grossVal >= 0
      ? `making estimated ${formatNaira(grossVal)} gross profit`
      : `resulting in an estimated gross deficit of ${formatNaira(Math.abs(grossVal))}`;

    if (customerName && receivableAdded > 0) {
      plainResponse = `Got it. ${customerName} bought ${quantity} ${unitStr}${product.name.toLowerCase()} for ${formatNaira(totalRevenue)} and paid ${formatNaira(cashReceived)}. He still owes you ${formatNaira(receivableAdded)}.`;
    } else {
      plainResponse = `Got it. You sold ${quantity} ${unitStr}${product.name.toLowerCase()} for ${formatNaira(totalRevenue)} (${formatNaira(unitPrice)} each). Cost was ${formatNaira(metrics.totalCostAtTime || 0)}, ${profitStr}.`;
    }

    if (shouldNavigateToCalendar || targetDate !== todayStr) {
      plainResponse += ` Your calendar input and daily ledger for ${formatDateShort(targetDate)} have been updated to match this.`;
    }

    const event: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: targetDate,
      timeStr,
      type: 'SALE',
      rawUserText: input,
      systemResponseText: plainResponse,
      productName: product.name,
      category: product.category || inferProductCategory(product.name),
      productCategory: product.category || inferProductCategory(product.name),
      customerName,
      quantity,
      unit: unitMentioned || undefined,
      unitSellingPrice: unitPrice,
      totalRevenue,
      cashReceived,
      receivableAdded,
      unitCostAtTime: unitCost,
      totalCostAtTime: metrics.totalCostAtTime,
      costIsEstimate: costResolution.isEstimate,
      costEstimateBasis: metrics.costEstimateBasis,
      grossProfit: metrics.grossProfit,
    };

    const finalEvent = ensureEventHeadlineAndSummary(event);

    const memoryUpdates: MemoryUpdateItem[] = [
      {
        type: 'CALENDAR_UPDATE',
        summary: `Calendar updated for ${formatDateShort(targetDate)}: Sold ${quantity} ${unitMentioned || ''} ${product.name}`,
        data: { date: targetDate },
      },
    ];

    if (receivableAdded > 0 && customerName) {
      memoryUpdates.push({
        type: 'CUSTOMER_DEBT',
        summary: `${customerName} debt balance increased by ${formatNaira(receivableAdded)}`,
        data: {
          customerName,
          balanceAdded: receivableAdded,
          date: targetDate,
          note: `Debt from purchase of ${quantity} ${unitMentioned || ''} ${product.name}`,
        },
      });
    }

    return {
      isQuestion: false,
      createdEvent: finalEvent,
      targetDate,
      targetCalendarDate: targetDate,
      shouldNavigateToCalendar,
      plainResponseText: plainResponse,
      memoryUpdates,
      memoryUpdate: memoryUpdates.find((u) => u.type === 'CUSTOMER_DEBT') as any,
    };
  }

  // 6. IF COST IS UNKNOWN: Check if generic rate multiplication was specified (e.g. "I sold 3 items at #100 each")
  const prodDisplayName = product ? product.name : (extractProductName(input) || 'Items');
  const singularName = prodDisplayName.replace(/s$/, '');

  if (
    prodDisplayName.toLowerCase() === 'item' ||
    prodDisplayName.toLowerCase() === 'items' ||
    (isRateMultiplied && !product)
  ) {
    const rateText = isRateMultiplied
      ? ` (${quantity} × ${formatNaira(unitPrice)} = ${formatNaira(totalRevenue)} total revenue)`
      : '';
    const plainResponse = `Got it. Recorded sale of ${quantity} ${prodDisplayName.toLowerCase()} at ${formatNaira(unitPrice)} each${rateText}. Added to your daily ledger and calendar.`;
    const event: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: targetDate,
      timeStr,
      type: 'SALE',
      rawUserText: input,
      systemResponseText: plainResponse,
      productName: prodDisplayName.charAt(0).toUpperCase() + prodDisplayName.slice(1),
      category: inferProductCategory(prodDisplayName),
      productCategory: inferProductCategory(prodDisplayName),
      customerName,
      quantity,
      unitSellingPrice: unitPrice,
      totalRevenue,
      cashReceived,
      receivableAdded,
      unitCostAtTime: 0,
      totalCostAtTime: 0,
      grossProfit: totalRevenue,
    };
    return {
      isQuestion: false,
      createdEvent: event,
      targetDate,
      targetCalendarDate: targetDate,
      shouldNavigateToCalendar,
      plainResponseText: plainResponse,
      memoryUpdates: [
        {
          type: 'CALENDAR_UPDATE',
          summary: `Calendar updated for ${formatDateShort(targetDate)}: Sold ${quantity} ${prodDisplayName} for ${formatNaira(totalRevenue)}`,
          data: { date: targetDate },
        },
      ],
    };
  }

  // Otherwise, if cost is unknown for a named product, ask intelligent follow-up
  const pendingEvent: Partial<BusinessEvent> = {
    rawUserText: input,
    productName: prodDisplayName,
    customerName,
    quantity,
    unitSellingPrice: unitPrice,
    totalRevenue,
    cashReceived,
    receivableAdded,
  };

  const followUp: FollowUpQuestion = {
    id: `fu-${Date.now()}`,
    prompt: `How much does one ${singularName.toLowerCase()} normally cost you?`,
    missingField: 'COST_PER_UNIT',
    productName: prodDisplayName,
    pendingEvent,
    helperText: `Tell me the cost (e.g. ₦1,500 or 1.5k), and I'll calculate your exact profit and remember it for future sales.`,
  };

  return {
    isQuestion: false,
    followUpRequired: followUp,
    plainResponseText: `How much does one ${singularName.toLowerCase()} normally cost you?`,
  };
}

function matchKnownProduct(text: string, products: any[]) {
  const lower = text.toLowerCase();
  for (const p of products) {
    const pName = p.name ? p.name.toLowerCase() : '';
    const pUnit = p.unit ? p.unit.toLowerCase() : '';
    if ((pName && lower.includes(pName)) || (pUnit && lower.includes(pUnit))) {
      return p;
    }
  }

  // Common Nigerian merchant product synonyms & aliases
  if (
    lower.includes('coke') ||
    lower.includes('coca-cola') ||
    lower.includes('fanta') ||
    lower.includes('sprite') ||
    lower.includes('pepsi') ||
    lower.includes('malt') ||
    lower.includes('soda') ||
    lower.includes('soft drink') ||
    lower.includes('drinks') ||
    lower.includes('beverage') ||
    lower.includes('water')
  ) {
    return products.find((p) => p.name.toLowerCase().includes('drink')) || null;
  }

  if (
    lower.includes('rice') ||
    lower.includes('jollof') ||
    lower.includes('grain')
  ) {
    return products.find((p) => p.name.toLowerCase().includes('rice')) || null;
  }

  if (
    lower.includes('shirt') ||
    lower.includes('t-shirt') ||
    lower.includes('polo') ||
    lower.includes('top') ||
    lower.includes('clothes')
  ) {
    return products.find((p) => p.name.toLowerCase().includes('shirt')) || null;
  }

  if (
    lower.includes('shoe') ||
    lower.includes('sneaker') ||
    lower.includes('slipper') ||
    lower.includes('sandal') ||
    lower.includes('footwear')
  ) {
    return products.find((p) => p.name.toLowerCase().includes('shoe')) || null;
  }

  return null;
}

/**
 * Extracts unit rate and determines whether it represents a rate multiplication.
 * Supports:
 * - "at #100 each", "at 100 each", "for #100 each", "for 100 each"
 * - "@ #100 each", "@ 100 each", "@ #100", "@ 100", "at #100", "at 100"
 * - "#100 each", "100 each", "100 naira each"
 * - "at #100 per unit", "at #100 per piece", "at #100 per bottle", "at #100 a piece"
 */
export function extractUnitRate(text: string): number | null {
  // 1. "for #100 each", "for 100 each", "for #100 per unit"
  const forEachMatch = text.match(/for\s+(?:[₦#]?\s*([0-9.,]+[km]?))\s*(?:each|per\s*(?:unit|piece|item|bottle|bowl|bag|pair|shirt|carton)|a\s*piece)/i);
  if (forEachMatch) {
    return parseNairaAmount(forEachMatch[1]);
  }

  // 2. "at #100 each", "at 100 each", "at #100", "at 100 per unit", "@ #100 each", "@ #100", "@ 100"
  const atMatch = text.match(/(?:at|@)\s*(?:[₦#]?\s*([0-9.,]+[km]?))\s*(?:each|per\s*(?:unit|piece|item|bottle|bowl|bag|pair|shirt|carton)|a\s*piece)?/i);
  if (atMatch) {
    return parseNairaAmount(atMatch[1]);
  }

  // 3. "#100 each", "100 naira each", "100 each", "100k each"
  const standaloneEach = text.match(/(?:[₦#]?\s*([0-9.,]+[km]?))\s*(?:naira\s*)?each/i);
  if (standaloneEach) {
    return parseNairaAmount(standaloneEach[1]);
  }

  // 4. "each for #100", "each at #100"
  const eachForMatch = text.match(/each\s+(?:for|at)\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
  if (eachForMatch) {
    return parseNairaAmount(eachForMatch[1]);
  }

  return null;
}

/**
 * Extracts product name from a clause:
 * e.g. "3 bottles of coke" -> "Coke"
 * "1 bag of rice" -> "Rice"
 * "3 shirts" -> "Shirts"
 */
function extractProductNameFromClause(clause: string): string {
  const ofMatch = clause.match(/(?:bags?|bowls?|cartons?|bottles?|packs?|tins?|cups?|plates?)\s+of\s+([a-zA-Z\s]+?)(?:\s+(?:for|at|@|[₦#]|costing)|$)/i);
  if (ofMatch) {
    return ofMatch[1].trim();
  }
  const clean = clause
    .replace(/^(?:[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i, '')
    .replace(/(?:bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?)\s+/i, '')
    .replace(/\s+(?:for|at|@|[₦#]|costing|each).*$/i, '')
    .trim();
  return clean || 'Items';
}

/**
 * Intelligent categorization of product names based on commerce keywords
 */
export function inferProductCategory(nameOrText: string): string {
  const lower = nameOrText.toLowerCase();
  if (
    lower.includes('rice') || lower.includes('bean') || lower.includes('garri') ||
    lower.includes('yam') || lower.includes('grain') || lower.includes('flour') ||
    lower.includes('semo') || lower.includes('wheat') || lower.includes('bread') ||
    lower.includes('egg') || lower.includes('meat') || lower.includes('fish') ||
    lower.includes('chicken') || lower.includes('food') || lower.includes('soup') ||
    lower.includes('pepper') || lower.includes('oil') || lower.includes('palm oil')
  ) {
    return 'Food & Grains';
  }
  if (
    lower.includes('drink') || lower.includes('coke') || lower.includes('fanta') ||
    lower.includes('sprite') || lower.includes('pepsi') || lower.includes('malt') ||
    lower.includes('soda') || lower.includes('water') || lower.includes('juice') ||
    lower.includes('beverage') || lower.includes('beer') || lower.includes('wine') ||
    lower.includes('energy drink') || lower.includes('tea') || lower.includes('coffee')
  ) {
    return 'Beverages';
  }
  if (
    lower.includes('shirt') || lower.includes('cloth') || lower.includes('jean') ||
    lower.includes('trouser') || lower.includes('shoe') || lower.includes('boot') ||
    lower.includes('slipper') || lower.includes('sandal') || lower.includes('dress') ||
    lower.includes('gown') || lower.includes('apparel') || lower.includes('wear') ||
    lower.includes('cap') || lower.includes('hat') || lower.includes('sock') ||
    lower.includes('sneaker') || lower.includes('suit')
  ) {
    return 'Apparel & Footwear';
  }
  if (
    lower.includes('soap') || lower.includes('detergent') || lower.includes('sponge') ||
    lower.includes('paste') || lower.includes('cream') || lower.includes('lotion') ||
    lower.includes('perfume') || lower.includes('toilet') || lower.includes('tissue') ||
    lower.includes('sanitary') || lower.includes('provision') || lower.includes('biscuit') ||
    lower.includes('milk') || lower.includes('sugar') || lower.includes('noodle') ||
    lower.includes('pasta') || lower.includes('spaghetti') || lower.includes('tin')
  ) {
    return 'Provisions & Toiletries';
  }
  if (
    lower.includes('phone') || lower.includes('charger') || lower.includes('cable') ||
    lower.includes('laptop') || lower.includes('battery') || lower.includes('electronic') ||
    lower.includes('gadget') || lower.includes('headphone') || lower.includes('earphone')
  ) {
    return 'Electronics & Accessories';
  }
  return 'General Merchandise';
}

/**
 * Multi-item natural language sale detection and parser:
 * Understands statements like:
 * - "I sold 1 bag of rice, 3 bottles of coke"
 * - "I sold 1 bag of rice and 3 bottles of coke"
 * - "I sold 1 bag of rice for #65,000, 3 bottles of coke for #1,200"
 * - "I sold 2 bags of rice at #58,000 each and 3 bottles of coke at #400 each"
 * - "1 bag of rice, 3 bottles of coke"
 * Generates distinct BusinessEvent entries for each product with proper calculations,
 * unit costs, profit estimates, and a clean combined summary.
 */
export function detectAndParseMultiItemSale(input: string, state: BusinessState): ParseResult | null {
  const lower = input.toLowerCase();

  // Exclude questions, expenses, pure debt payments, unit conversions, owner equity
  if (
    isBusinessQuestion(lower) ||
    lower.includes('?') ||
    lower.includes('spent') ||
    lower.includes('refund') ||
    lower.includes('light bill') ||
    lower.includes('generator') ||
    lower.includes('bought from')
  ) {
    return null;
  }

  // Must contain clause separators: comma or "and" or "&" or "+" or "plus" or ";"
  if (
    !input.includes(',') &&
    !lower.includes(' and ') &&
    !lower.includes(' & ') &&
    !lower.includes(' + ') &&
    !lower.includes(' plus ') &&
    !input.includes(';')
  ) {
    return null;
  }

  const todayStr = getTodayDateStr();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const targetDate = extractDateFromText(input) || todayStr;
  const shouldNavigateToCalendar =
    lower.includes('calendar') || lower.includes('in my calendar') || lower.includes('change the input');

  // Strip leading sale prefix
  const cleanBody = input
    .replace(/^(?:i\s+sold|we\s+sold|sold|i\s+have\s+sold|recorded?\s+sale:?|i\s+made\s+a\s+sale\s+of)\s+/i, '')
    .trim();

  // Protect thousands separators in numbers (e.g. 59,300 or 1,000,000) so commas inside amounts don't split clauses
  let protectedBody = cleanBody;
  while (/(\d+),(\d{3})/.test(protectedBody)) {
    protectedBody = protectedBody.replace(/(\d+),(\d{3})/g, '$1__COMMA__$2');
  }

  // Extract customer name if mentioned globally
  const cust = matchKnownCustomer(input, state.customers) || extractCustomerName(input);
  const customerName = typeof cust === 'object' && cust !== null ? cust.name : cust;

  // Split into raw candidate clauses using protected separators
  const rawParts = protectedBody
    .split(/(?:,\s*and\s+|\s+and\s+|,\s*|\s*;\s*|\s*\+\s*|\s+plus\s+)/i)
    .map((p) => p.replace(/__COMMA__/g, ',').trim())
    .filter(Boolean);

  const candidateClauses: string[] = [];
  let cashPaidOverride: number | null = null;

  for (const part of rawParts) {
    const pTrim = part.trim();
    if (!pTrim) continue;
    const pLower = pTrim.toLowerCase();

    // Check if this part is payment info (e.g. "he paid 50k", "David paid 100k", "paid cash")
    if (
      pLower.startsWith('paid') ||
      pLower.startsWith('he paid') ||
      pLower.startsWith('she paid') ||
      pLower.startsWith('they paid') ||
      pLower.startsWith('cash paid')
    ) {
      const amtMatch = pTrim.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
      if (amtMatch) {
        cashPaidOverride = parseNairaAmount(amtMatch[1]);
      }
      continue;
    }
    if (pLower.startsWith('owing') || pLower.startsWith('owes') || pLower.startsWith('balance later')) {
      continue;
    }
    if (
      pLower.includes('calendar') ||
      pLower.includes('change the input') ||
      pLower.includes('match this') ||
      pLower.includes('update my calendar') ||
      pLower.includes('set my calendar')
    ) {
      continue;
    }
    candidateClauses.push(pTrim);
  }

  if (candidateClauses.length < 2) {
    return null;
  }

  interface ParsedItem {
    productName: string;
    product?: any;
    category: string;
    quantity: number;
    unit: string;
    unitSellingPrice: number;
    totalRevenue: number;
    isRateMultiplied: boolean;
    unitCost: number;
    totalCost: number;
    grossProfit: number;
    costIsEstimate: boolean;
  }

  const numberWordMap: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, twenty: 20,
  };

  const parsedItems: ParsedItem[] = [];

  for (const clause of candidateClauses) {
    const cLower = clause.toLowerCase();

    // 1. Quantity
    let qty = 1;
    const numMatch = clause.match(/^([0-9]+)\s+/i) ||
      clause.match(/\b([0-9]+)\s*(?:bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?)\b/i);
    if (numMatch) {
      qty = parseInt(numMatch[1], 10);
    } else {
      const wordMatch = clause.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty)\b/i);
      if (wordMatch) {
        qty = numberWordMap[wordMatch[1].toLowerCase()] || 1;
      }
    }

    // 2. Unit
    let unit = '';
    const unitMatch = clause.match(/\b(bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?|tins?|sachets?|cups?|plates?)\b/i);
    if (unitMatch) {
      unit = unitMatch[1].toLowerCase();
    }

    // 3. Product match or extraction & Category classification
    const matchedProd = matchKnownProduct(clause, state.products);
    let displayName = '';
    let itemCategory = '';
    if (matchedProd) {
      displayName = matchedProd.name;
      itemCategory = matchedProd.category || inferProductCategory(matchedProd.name);
      if (cLower.includes('coke') && matchedProd.name.toLowerCase().includes('drink')) {
        displayName = 'Drinks (Coke)';
      } else if (cLower.includes('fanta') && matchedProd.name.toLowerCase().includes('drink')) {
        displayName = 'Drinks (Fanta)';
      } else if (cLower.includes('pepsi') && matchedProd.name.toLowerCase().includes('drink')) {
        displayName = 'Drinks (Pepsi)';
      }
    } else {
      const extracted = extractProductNameFromClause(clause);
      displayName = extracted || (unit ? `${unit} items` : 'Items');
      itemCategory = inferProductCategory(displayName);
    }

    // 4. Pricing / Rate Multiplication
    let unitPrice = 0;
    let totalRev = 0;
    let isRateMultiplied = false;

    const rate = extractUnitRate(clause);
    if (rate && rate > 0) {
      unitPrice = rate;
      totalRev = qty * unitPrice;
      isRateMultiplied = true;
    } else {
      const forMatch = clause.match(/for\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i) || clause.match(/(?:[₦#]\s*([0-9.,]+[km]?))/i);
      if (forMatch) {
        totalRev = parseNairaAmount(forMatch[1]) || 0;
        unitPrice = totalRev / (qty || 1);
      } else {
        // Look up known selling price from Business Memory
        if (matchedProd) {
          if (matchedProd.name.toLowerCase().includes('rice')) {
            if (unit.startsWith('bag')) {
              unitPrice = 65000; // Standard wholesale bag selling price in merchant rules
              totalRev = qty * unitPrice;
            } else {
              unitPrice = matchedProd.normalSellingPrice || 2000;
              totalRev = qty * unitPrice;
            }
          } else if (matchedProd.name.toLowerCase().includes('drink')) {
            unitPrice = matchedProd.normalSellingPrice || 400;
            totalRev = qty * unitPrice;
            isRateMultiplied = true;
          } else if (matchedProd.name.toLowerCase().includes('shirt')) {
            unitPrice = matchedProd.normalSellingPrice || 3000;
            totalRev = qty * unitPrice;
          } else if (matchedProd.name.toLowerCase().includes('shoe')) {
            unitPrice = matchedProd.normalSellingPrice || 14000;
            totalRev = qty * unitPrice;
          } else {
            unitPrice = matchedProd.normalSellingPrice || 0;
            totalRev = qty * unitPrice;
          }
        }
      }
    }

    // 5. Cost & Gross Profit
    let unitCost = 0;
    let totalCost = 0;
    let grossProfit = 0;
    let costIsEstimate = false;

    if (matchedProd) {
      const costRes = resolveProductCostForUnit(matchedProd, unit, state);
      unitCost = costRes.unitCost;
      totalCost = unitCost * qty;
      grossProfit = totalRev - totalCost;
      costIsEstimate = costRes.isEstimate || false;
    } else {
      unitCost = 0;
      totalCost = 0;
      grossProfit = totalRev;
    }

    parsedItems.push({
      productName: displayName,
      product: matchedProd,
      category: itemCategory,
      quantity: qty,
      unit,
      unitSellingPrice: unitPrice,
      totalRevenue: totalRev,
      isRateMultiplied,
      unitCost,
      totalCost,
      grossProfit,
      costIsEstimate,
    });
  }

  // Must have at least 2 parsed items
  if (parsedItems.length < 2) {
    return null;
  }

  // Calculate multi-item transaction via strict, unit-testable deterministic calculations formula
  const multiComputation = computeMultiItemTransaction({
    items: parsedItems.map((it) => ({
      productName: it.productName,
      quantity: it.quantity,
      unitSellingPrice: it.unitSellingPrice,
      unitCostAtTime: it.unitCost,
      category: it.category,
      unit: it.unit,
      costIsEstimate: it.costIsEstimate,
    })),
    cashPaid: cashPaidOverride !== null ? cashPaidOverride : undefined,
    customerName: customerName || undefined,
  });

  const createdEvents: BusinessEvent[] = multiComputation.items.map((item, idx) => {
    const origParsed = parsedItems[idx];
    const rateText = (origParsed && origParsed.isRateMultiplied)
      ? ` (${item.quantity} × ${formatNaira(item.unitSellingPrice)} each)`
      : '';
    const costText = item.totalCostAtTime > 0
      ? `, Wholesale cost ${formatNaira(item.totalCostAtTime)}, estimated gross profit ${formatNaira(item.grossProfit)}`
      : '';
    const catText = item.category ? ` [${item.category}]` : '';

    const singleEventResponse = `Got it. Sold ${item.quantity} ${item.unit ? `${item.unit} ` : ''}${item.productName}${catText} for ${formatNaira(item.totalRevenue)}${rateText}${costText}.`;

    return {
      id: `ev-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      date: targetDate,
      timeStr,
      type: 'SALE',
      rawUserText: input,
      systemResponseText: singleEventResponse,
      productName: item.productName,
      category: item.category,
      productCategory: item.category,
      customerName,
      quantity: item.quantity,
      unit: item.unit,
      unitSellingPrice: item.unitSellingPrice,
      totalRevenue: item.totalRevenue,
      cashReceived: item.cashReceived,
      receivableAdded: item.receivableAdded,
      unitCostAtTime: item.unitCostAtTime,
      totalCostAtTime: item.totalCostAtTime,
      costIsEstimate: item.costIsEstimate,
      grossProfit: item.grossProfit,
    };
  });

  const itemSummaries = multiComputation.items.map((item, idx) => {
    const origParsed = parsedItems[idx];
    const rateDetail = (origParsed && origParsed.isRateMultiplied)
      ? ` (${item.quantity} × ${formatNaira(item.unitSellingPrice)} each)`
      : '';
    const costDetail = item.totalCostAtTime > 0
      ? `, Wholesale cost ${formatNaira(item.totalCostAtTime)}, estimated gross profit ${formatNaira(item.grossProfit)}`
      : '';
    const catDetail = item.category ? ` [${item.category}]` : '';
    return `• ${item.quantity} ${item.unit ? `${item.unit} ` : ''}${item.productName}${catDetail}: ${formatNaira(item.totalRevenue)}${rateDetail}${costDetail}`;
  }).join('\n');

  let plainResponseText = `Recorded ${multiComputation.items.length} sales:\n${itemSummaries}\n\nTotal Revenue: ${formatNaira(multiComputation.totalRevenue)} | Total Cost: ${formatNaira(multiComputation.totalCost)} | Net Gross Profit: ${formatNaira(multiComputation.totalGrossProfit)}. Added to your daily ledger and calendar.`;

  if (shouldNavigateToCalendar || targetDate !== todayStr) {
    plainResponseText += ` Your calendar input and daily ledger for ${formatDateShort(targetDate)} have been updated to match this.`;
  }

  const memoryUpdates: MemoryUpdateItem[] = [
    {
      type: 'CALENDAR_UPDATE',
      summary: `Calendar updated for ${formatDateShort(targetDate)}: Recorded ${parsedItems.length} sales (${parsedItems.map(p => `${p.quantity} ${p.productName}`).join(', ')})`,
      data: { date: targetDate },
    },
  ];

  return {
    isQuestion: false,
    createdEvent: createdEvents[0],
    createdEvents,
    targetDate,
    targetCalendarDate: targetDate,
    shouldNavigateToCalendar,
    plainResponseText,
    memoryUpdates,
  };
}

function matchKnownCustomer(text: string, customers: any[]) {
  for (const c of customers) {
    if (text.includes(c.name.toLowerCase())) {
      return c;
    }
  }
  return null;
}

function matchKnownSupplier(text: string, suppliers: any[]) {
  for (const s of suppliers) {
    if (text.includes(s.name.toLowerCase()) || text.includes(s.name.split(' ')[0].toLowerCase())) {
      return s;
    }
  }
  return null;
}

function extractCustomerName(text: string): string | undefined {
  const startMatch = text.match(/^([A-Za-z]+)\s+(?:bought|paid|is|took|purchased|collected|ordered|requested)/i);
  if (startMatch) {
    const name = startMatch[1].trim();
    const invalid = ['i', 'we', 'he', 'she', 'they', 'you', 'it', 'my', 'the', 'a', 'an', 'today', 'yesterday', 'someone', 'customer', 'supplier', 'who', 'how', 'what', 'one', 'two', 'three'];
    if (!invalid.includes(name.toLowerCase())) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  const match = text.match(/(?:to|from|for|with)\s+([A-Za-z]+)/i);
  if (match) {
    const name = match[1].trim();
    const invalid = ['i', 'we', 'he', 'she', 'they', 'you', 'it', 'my', 'the', 'a', 'an', 'today', 'yesterday', 'someone', 'customer', 'supplier', 'who', 'how', 'what', 'one', 'two', 'three'];
    if (!invalid.includes(name.toLowerCase())) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  return undefined;
}

function extractProductName(text: string): string | undefined {
  const match = text.match(/[0-9]+\s+([a-zA-Z]+)/);
  if (match) {
    const word = match[1];
    const units = ['bowls', 'pieces', 'pairs', 'cartons', 'bottles', 'bags', 'carton', 'bag', 'bottle', 'piece', 'bowl'];
    if (!units.includes(word.toLowerCase())) {
      return word;
    }
    // Check if there is an item noun right after, e.g. "30 cartons of drinks" or "2 bags of rice"
    const ofMatch = text.match(new RegExp(`[0-9]+\\s+${word}\\s+(?:of\\s+)?([a-zA-Z]+)`, 'i'));
    if (ofMatch && !['from', 'to', 'at', 'for', 'each'].includes(ofMatch[1].toLowerCase())) {
      return ofMatch[1];
    }
    return word;
  }
  return undefined;
}

function detectExpenseCategory(text: string): ExpenseCategory {
  const lower = text.toLowerCase();
  if (
    lower.includes('bought from') ||
    lower.includes('from supplier') ||
    (lower.startsWith('i bought') && (lower.includes('at') || lower.includes('each') || lower.includes('carton') || lower.includes('bag')))
  ) {
    return 'Procurement';
  }
  if (lower.includes('transport') || lower.includes('fuel') || lower.includes('bus') || lower.includes('moving') || lower.includes('dispatch') || lower.includes('rider') || lower.includes('fare') || lower.includes('okada') || lower.includes('keke') || lower.includes('logistics')) {
    return 'Transportation';
  }
  if (lower.includes('shop rent') || lower.includes('stall rent') || lower.includes('space rent') || /\brent\b/.test(lower)) {
    return 'Rent';
  }
  if (lower.includes('light') || lower.includes('electric') || lower.includes('nepa') || lower.includes('power') || lower.includes('generator') || lower.includes('bill') || lower.includes('water')) {
    return 'Utilities';
  }
  if (lower.includes('packaging') || lower.includes('carton box') || lower.includes('nylon') || /(?:packaging|nylon|leather|carrier|shopping|plastic)\s*bags?/i.test(lower)) {
    return 'Packaging';
  }
  if (lower.includes('staff') || lower.includes('salary') || lower.includes('salaries') || lower.includes('wages') || lower.includes('shop boy') || lower.includes('apprentice') || lower.includes('cleaner') || lower.includes('labour')) {
    return 'Staff/Labour';
  }
  if (lower.includes('market') || lower.includes('ad') || lower.includes('advert') || lower.includes('flyer')) {
    return 'Marketing';
  }
  if (lower.includes('repair') || lower.includes('fix') || lower.includes('carpenter') || lower.includes('maintenance')) {
    return 'Repairs';
  }
  return 'Other';
}

function isBusinessQuestion(lower: string): boolean {
  return (
    lower.startsWith('how much') ||
    lower.startsWith('who owes') ||
    lower.startsWith('what did i') ||
    lower.startsWith('which product') ||
    lower.startsWith('did my promo') ||
    lower.startsWith('did i make') ||
    lower.startsWith('can i afford') ||
    lower.startsWith('why was') ||
    lower.includes('profit today') ||
    lower.includes('who is owing') ||
    lower.includes('?')
  );
}

export interface ConversationalResponse {
  answer: string;
  memoryUpdates?: MemoryUpdateItem[];
  createdEvent?: BusinessEvent;
  createdEvents?: BusinessEvent[];
  correctedEvent?: BusinessEvent;
  deletedEventId?: string;
  targetCalendarDate?: string;
}

/**
 * Finds the most recently referenced customer from previous chat messages and memory updates
 */
function resolveContextualCustomer(chatHistory: any[], customers: any[]): any | null {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) return null;

  // Search in reverse order (most recent first)
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const msg = chatHistory[i];
    if (!msg) continue;

    // Check if memory was saved with a targetName
    if (Array.isArray(msg.memorySaved)) {
      for (const mem of msg.memorySaved) {
        if (mem.targetName) {
          const match = customers.find((c) => c.name.toLowerCase() === mem.targetName.toLowerCase());
          if (match) return match;
          return {
            id: `c-ctx-${mem.targetName.toLowerCase()}`,
            name: mem.targetName,
            outstandingBalance: 0,
            totalPurchased: 0,
            totalPaid: 0,
            lastActivityDate: getTodayDateStr(),
            notes: '',
            history: [],
          };
        }
      }
    }

    const text = (msg.text || '').toLowerCase();
    // Check known customers
    for (const c of customers) {
      if (text.includes(c.name.toLowerCase())) {
        return c;
      }
    }

    // Check capitalized customer names mentioned in recent user or assistant turns
    const nameMatch = (msg.text || '').match(/\b([A-Z][a-z]{2,15})\b/);
    if (nameMatch) {
      const candidate = nameMatch[1];
      const excludedWords = ['Hello', 'Today', 'Rule', 'Cost', 'What', 'How', 'Which', 'Why', 'When', 'Who', 'Yes', 'No', 'Naira', 'Shirts', 'Shoes', 'Rice', 'Fabric', 'Owner', 'Assistant'];
      if (!excludedWords.includes(candidate)) {
        const match = customers.find((c) => c.name.toLowerCase() === candidate.toLowerCase());
        if (match) return match;
        return {
          id: `c-cand-${candidate.toLowerCase()}`,
          name: candidate,
          outstandingBalance: 0,
          totalPurchased: 0,
          totalPaid: 0,
          lastActivityDate: getTodayDateStr(),
          notes: '',
          history: [],
        };
      }
    }
  }
  return null;
}

/**
 * Finds the most recently referenced product from previous chat messages
 */
function resolveContextualProduct(chatHistory: any[], products: any[]): any | null {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) return null;
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const text = (chatHistory[i]?.text || '').toLowerCase();
    for (const p of products) {
      if (text.includes(p.name.toLowerCase()) || text.includes(p.name.slice(0, -1).toLowerCase())) {
        return p;
      }
    }
  }
  return null;
}

/**
 * Deterministically answers business questions using stored ledger and memory,
 * with full conversational context resolution, pronoun resolution, and memory extraction.
 */
export function answerBusinessQuestionWithMemory(
  question: string,
  state: BusinessState,
  chatHistory?: any[]
): ConversationalResponse {
  const lower = question.toLowerCase();
  const todayStr = getTodayDateStr();
  const todayEvents = state.events.filter((e) => e.date === todayStr && !e.isCorrected);

  // 0. CHECK FOR CORRECTIONS & INPUT MODIFICATIONS:
  // e.g. "I sold 2 bags of rice for #58,000 each and then change the input in my calendar to match this",
  // "Change the input in my calendar to 2 bags of rice for #58,000 each",
  // "Change the rice sale to 2 bags for #58,000 each",
  // "Correct yesterday's rice sale to 2 bags for #58,000 each"
  const correction = handleCorrectionInput(question, state);
  if (correction) {
    return {
      answer: correction.plainResponseText,
      createdEvent: correction.createdEvent,
      correctedEvent: correction.correctedEvent,
      deletedEventId: correction.deletedEventId,
      targetCalendarDate: correction.targetCalendarDate,
      memoryUpdates: correction.memoryUpdates,
    };
  }

  // 0b. CHECK FOR MULTI-ITEM SALES OR SALE STATEMENTS IN CHAT:
  // e.g. "I sold 1 bag of rice, 3 bottles of coke", "2 bags of rice at #58,000 each and 3 bottles of coke at #400 each"
  const multiSale = detectAndParseMultiItemSale(question, state);
  if (multiSale && multiSale.createdEvents && multiSale.createdEvents.length > 0) {
    return {
      answer: multiSale.plainResponseText,
      createdEvents: multiSale.createdEvents,
      createdEvent: multiSale.createdEvents[0],
      targetCalendarDate: multiSale.targetCalendarDate,
      memoryUpdates: multiSale.memoryUpdates,
    };
  }

  // 0c. CHECK FOR SINGLE SALE STATEMENTS IN CHAT:
  // e.g. "I sold 3 items at #100 each", "I sold 2 bags of rice for #58,000 each", "Sold 3 shirts for 6000"
  if (
    lower.includes('sold') ||
    lower.includes('bags of') ||
    lower.includes('bowls of') ||
    lower.includes('at #') ||
    lower.includes('@') ||
    lower.includes('each') ||
    (lower.includes('bought') && !lower.includes('bought from'))
  ) {
    const saleRes = parseSaleStatement(question, state);
    if (saleRes.createdEvents && saleRes.createdEvents.length > 0) {
      return {
        answer: saleRes.plainResponseText,
        createdEvents: saleRes.createdEvents,
        createdEvent: saleRes.createdEvents[0],
        targetCalendarDate: saleRes.targetCalendarDate,
        memoryUpdates: saleRes.memoryUpdates,
      };
    }
    if (saleRes.createdEvent) {
      return {
        answer: saleRes.plainResponseText,
        createdEvent: saleRes.createdEvent,
        targetCalendarDate: saleRes.targetCalendarDate,
        memoryUpdates: [
          {
            type: 'CALENDAR_UPDATE',
            summary: `Calendar updated for ${formatDateShort(saleRes.createdEvent.date)}: Sold ${saleRes.createdEvent.quantity} ${saleRes.createdEvent.productName}`,
            data: { date: saleRes.createdEvent.date },
          },
        ],
      };
    }
  }

  // Attempt to resolve customer from current input or earlier context turns
  const directCustomer = matchKnownCustomer(lower, state.customers);
  const contextualCustomer = directCustomer || resolveContextualCustomer(chatHistory || [], state.customers);

  // Attempt to resolve product from current input or earlier context turns
  const directProduct = matchKnownProduct(lower, state.products);
  const contextualProduct = directProduct || resolveContextualProduct(chatHistory || [], state.products);

  // Helper to extract explicit customer name from statement
  const explicitCustName = extractCustomerName(question);
  const activeCustomer = directCustomer || (explicitCustName ? {
    id: `cust-${Date.now()}`,
    name: explicitCustName,
    outstandingBalance: 0,
    totalPurchased: 0,
    totalPaid: 0,
    lastActivityDate: todayStr,
    notes: '',
    history: [],
  } : contextualCustomer);

  // 1. CHAT MEMORY: Customer Debt statement in chat
  // e.g. "Chuks owes me 80k", "He owes me 50k", "David is owing 30,000", "Chuks debt of 80k"
  const isDebtStatement = (lower.includes('owes') || lower.includes('is owing') || lower.includes('owing me') || lower.includes('debt of')) &&
    !lower.startsWith('who owes') && !lower.startsWith('how much does') && !lower.startsWith('what does');
  if (isDebtStatement && activeCustomer) {
    const amtMatch = question.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 0;
    if (amt && amt > 0) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const debtEvent: BusinessEvent = {
        id: `ev-chat-debt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'CUSTOMER_DEBT',
        rawUserText: question,
        systemResponseText: `Recorded: ${activeCustomer.name} owes you ${formatNaira(amt)}. Added to your customer debt ledger.`,
        customerName: activeCustomer.name,
        receivableAdded: amt,
      };

      return {
        answer: `Recorded: ${activeCustomer.name} is owing you ${formatNaira(amt)}. I have added this to customer memory and your accounts receivable ledger.`,
        memoryUpdates: [
          {
            type: 'CUSTOMER_DEBT',
            targetName: activeCustomer.name,
            summary: `${activeCustomer.name} debt of ${formatNaira(amt)}`,
            data: { customerName: activeCustomer.name, amount: amt },
          },
        ],
        createdEvent: debtEvent,
      };
    }
  }

  // 2. CHAT MEMORY: Customer Debt Payment in chat
  // e.g. "He paid 30k", "Chuks paid me 40k", "He just paid 20,000", "David paid 50k today"
  const isPaymentStatement = (lower.includes('paid') || lower.includes('brought')) &&
    (lower.includes('me') || lower.includes('today') || lower.includes('just') || Boolean(contextualCustomer)) &&
    !lower.includes('bought') && !lower.includes('sold') && !lower.startsWith('how much did');
  if (isPaymentStatement && activeCustomer) {
    const amtMatch = question.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 0;
    if (amt && amt > 0) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const currentDebt = activeCustomer.outstandingBalance || 0;
      const remainingDebt = Math.max(0, currentDebt - amt);

      const payEvent: BusinessEvent = {
        id: `ev-chat-pay-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'DEBT_PAYMENT',
        rawUserText: question,
        systemResponseText: `Recorded: Received ${formatNaira(amt)} from ${activeCustomer.name}. Remaining debt is ${formatNaira(remainingDebt)}.`,
        customerName: activeCustomer.name,
        cashReceived: amt,
      };

      return {
        answer: `Recorded: ${activeCustomer.name} paid ${formatNaira(amt)} in cash! Remaining debt is ${formatNaira(remainingDebt)}. Cash flow and customer ledger updated.`,
        memoryUpdates: [
          {
            type: 'CUSTOMER_PAYMENT',
            targetName: activeCustomer.name,
            summary: `${activeCustomer.name} paid ${formatNaira(amt)} (Remaining: ${formatNaira(remainingDebt)})`,
            data: { customerName: activeCustomer.name, amountPaid: amt },
          },
        ],
        createdEvent: payEvent,
      };
    }
  }

  // 3. CHAT MEMORY: Customer Phone Number update
  // e.g. "David's phone number is 08031112233" or "His phone number is 080..." or "Phone: 08012345678"
  const phoneMatch = question.match(/(?:phone|number|mobile|call|contact)\s*(?:is|to)?\s*([+0-9\s-]{10,16})/i) ||
    question.match(/([0-9]{11})/);
  if (phoneMatch && (activeCustomer || lower.includes('phone') || lower.includes('number'))) {
    const cust = activeCustomer || state.customers[0];
    const newPhone = phoneMatch[1].trim();
    return {
      answer: `I've updated ${cust.name}'s phone number to ${newPhone} in customer memory.`,
      memoryUpdates: [
        {
          type: 'CUSTOMER_PHONE',
          targetName: cust.name,
          summary: `Updated ${cust.name}'s phone to ${newPhone}`,
          data: { customerName: cust.name, phone: newPhone },
        },
      ],
    };
  }

  // 4. CHAT MEMORY: Customer Promises & Future Payment Dates
  // e.g. "Chuks promised to pay 40k on Friday" or "He said he will bring 30k next week" or "Remember that David will pay..."
  if (
    lower.includes('promised') ||
    lower.includes('said he will') ||
    lower.includes('said she will') ||
    lower.includes('will pay on') ||
    lower.includes('will bring the money') ||
    lower.includes('promised to') ||
    (lower.startsWith('remember that') && activeCustomer) ||
    (lower.startsWith('note that') && activeCustomer)
  ) {
    const cust = activeCustomer || { name: 'Customer' };
    const cleanNote = question
      .replace(/^(remember that|note that|please note that|save this:?)\s*/i, '')
      .trim();
    return {
      answer: `I've noted that down for ${cust.name}: "${cleanNote}". It is safely stored in your business memory and can be recalled anytime.`,
      memoryUpdates: [
        {
          type: 'CUSTOMER_NOTE',
          targetName: cust.name,
          summary: `Promise from ${cust.name}: "${cleanNote}"`,
          data: { customerName: cust.name, note: cleanNote },
        },
      ],
    };
  }

  // 5. CHAT MEMORY: Business Rules
  // e.g. "Rule: never give credit above 10k" or "Always collect 50% deposit" or "Remember rule: ..."
  if (
    lower.startsWith('rule:') ||
    lower.startsWith('remember rule:') ||
    lower.startsWith('add rule:') ||
    lower.includes('never sell on credit') ||
    lower.includes('never give credit') ||
    lower.includes('always charge') ||
    lower.includes('no credit for') ||
    lower.includes('always collect')
  ) {
    const ruleText = question
      .replace(/^(rule:|remember rule:|add rule:|save rule:)\s*/i, '')
      .trim();
    return {
      answer: `I have saved this business rule: "${ruleText}". It is now stored in your Business Memory rules ledger and guides future transaction alerts.`,
      memoryUpdates: [
        {
          type: 'BUSINESS_RULE',
          summary: `Saved Rule: "${ruleText}"`,
          data: { rule: ruleText, category: 'GENERAL' },
        },
      ],
    };
  }

  // 6. CHAT MEMORY: Product Cost update
  // e.g. "Cost of shoes is now 9000" or "Shoes wholesale cost increased to 9500" or "Cost is now 9k"
  if (
    (lower.includes('cost of') || lower.includes('cost is') || lower.includes('wholesale cost') || lower.includes('costs now')) &&
    contextualProduct
  ) {
    const amtMatch = question.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : null;
    if (amt && amt > 0) {
      return {
        answer: `I have updated the wholesale cost of ${contextualProduct.name} to ${formatNaira(amt)}. All future sales will use this cost to calculate your gross profit.`,
        memoryUpdates: [
          {
            type: 'PRODUCT_COST',
            targetName: contextualProduct.name,
            summary: `Updated ${contextualProduct.name} wholesale cost to ${formatNaira(amt)}`,
            data: { productName: contextualProduct.name, cost: amt },
          },
        ],
      };
    }
  }

  // 7. CONTEXTUAL RECALL: "What do you remember about him/her/Chuks?"
  // e.g. "What do you know about Chuks?", "Tell me about him", "What memories do you have of him?"
  if (
    (lower.includes('remember about') ||
      lower.includes('know about') ||
      lower.includes('tell me about') ||
      lower.includes('memories of')) &&
    activeCustomer
  ) {
    const debt = formatNaira(activeCustomer.outstandingBalance || 0);
    const totalPurch = formatNaira(activeCustomer.totalPurchased || 0);
    const totalPd = formatNaira(activeCustomer.totalPaid || 0);
    const phone = activeCustomer.phone || 'No phone on file';
    const notes = activeCustomer.notes ? `\n• Notes & Promises: "${activeCustomer.notes}"` : '\n• Notes: No special notes recorded yet.';

    return {
      answer: `Here is what I remember about ${activeCustomer.name}:\n• Phone: ${phone}\n• Outstanding Debt: ${debt}\n• Total Purchased: ${totalPurch}\n• Total Paid: ${totalPd}${notes}\n• Payment Reliability: ${activeCustomer.paymentReliability || 'Normal'}`,
    };
  }

  // 8. CONTEXTUAL QUERY: "How much is left?" / "What is his balance now?" / "How much does he owe?"
  // e.g. "How much is left?", "What does he owe?", "How much is he owing now?"
  if (
    (lower.includes('is left') ||
      lower.includes('balance now') ||
      lower.includes('does he owe') ||
      lower.includes('does she owe') ||
      lower.includes('how much is he owing') ||
      (lower.includes('owe') && activeCustomer)) &&
    activeCustomer
  ) {
    return {
      answer: `${activeCustomer.name} currently owes you ${formatNaira(
        activeCustomer.outstandingBalance || 0
      )} (Total purchases: ${formatNaira(activeCustomer.totalPurchased || 0)}, Total paid: ${formatNaira(
        activeCustomer.totalPaid || 0
      )}).`,
    };
  }

  // 9. CONTEXTUAL QUERY: Customer phone lookup
  // e.g. "What is his phone number?" or "What's Chuks phone number?"
  if (
    (lower.includes('phone') || lower.includes('number') || lower.includes('contact')) &&
    activeCustomer
  ) {
    const phone = activeCustomer.phone || 'no phone number recorded yet';
    return {
      answer: `${activeCustomer.name}'s phone number is ${phone}.`,
    };
  }

  // 10. CONTEXTUAL QUERY: Customer purchases / history lookup
  // e.g. "What did he buy?" or "What did Chuks buy?"
  if (
    (lower.includes('what did he buy') ||
      lower.includes('what did she buy') ||
      lower.includes('what did they buy') ||
      lower.includes('purchases') ||
      (lower.includes('buy') && activeCustomer)) &&
    activeCustomer
  ) {
    const custEvents = state.events.filter(
      (e) => (e.customerName || '').toLowerCase() === activeCustomer.name.toLowerCase()
    );
    if (custEvents.length === 0) {
      return {
        answer: `${activeCustomer.name} has recorded total purchases of ${formatNaira(
          activeCustomer.totalPurchased || 0
        )}, but no individual items are listed in today's active session.`,
      };
    }
    const items = custEvents
      .map((e) => `${e.quantity || 1} ${e.productName || 'item'} for ${formatNaira(e.totalRevenue || 0)}`)
      .join(', ');
    return {
      answer: `${activeCustomer.name} bought: ${items}. Outstanding balance is ${formatNaira(
        activeCustomer.outstandingBalance || 0
      )}.`,
    };
  }

  // 11. INSPECT STORED MEMORIES & RULES:
  // e.g. "What rules do I have?", "Show my rules", "What are my business rules?"
  if (lower.includes('what rules') || lower.includes('show rules') || lower.includes('my rules')) {
    const allRules = state.businessRules || state.rules || [];
    if (allRules.length === 0) {
      return {
        answer: "You haven't set any custom business rules yet. You can teach me one right now, for example: 'Rule: never give credit above ₦10,000'.",
      };
    }
    const ruleList = allRules.map((r, i) => `${i + 1}. ${r.description}`).join('\n');
    return {
      answer: `Here are your stored Business Rules:\n${ruleList}`,
    };
  }

  // 12. INSPECT ALL BUSINESS MEMORIES:
  // e.g. "What memories do you have?", "What have you remembered?", "What is in my memory?"
  if (lower.includes('what memories') || lower.includes('what have you saved') || lower.includes('what do you remember')) {
    const notesCount = state.customers.filter((c) => c.notes).length;
    const rulesCount = (state.businessRules || state.rules || []).length;
    const unitsCount = state.unitRelationships.length;
    const customersWithDebt = state.customers.filter((c) => c.outstandingBalance > 0);

    return {
      answer: `Your Business Memory holds:\n• ${notesCount} customer promise/contact notes\n• ${rulesCount} business policy rules\n• ${unitsCount} unit conversion models (e.g. rice bag yield)\n• ${customersWithDebt.length} active debtor accounts\n\nAsk me about any customer, rule, or product anytime!`,
    };
  }

  // 13. "How much did I make today?"
  if (lower.includes('make today') || lower.includes('profit today')) {
    let sales = 0;
    let cost = 0;
    let exp = 0;
    for (const e of todayEvents) {
      if (e.type === 'SALE') {
        sales += e.totalRevenue || 0;
        cost += e.totalCostAtTime || 0;
      } else if (e.type === 'EXPENSE') {
        exp += e.expenseAmount || 0;
      }
    }
    const gross = sales - cost;
    const net = gross - exp;
    return {
      answer: `Today you made an estimated ${formatNaira(gross)} gross profit from ${formatNaira(
        sales
      )} in sales. After deducting ${formatNaira(exp)} in operating expenses, your net take-home for today is ${formatNaira(
        net
      )}.`,
    };
  }

  // 14. "Who owes me money?" or "Who owes me the most?"
  if (lower.includes('who owes') || lower.includes('owing me')) {
    const debtors = state.customers
      .filter((c) => c.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    if (debtors.length === 0) {
      return {
        answer: 'Nobody is currently owing you money! All customer accounts are fully paid.',
      };
    }

    const totalOwing = debtors.reduce((sum, d) => sum + d.outstandingBalance, 0);
    const breakdown = debtors.map((d) => `${d.name} owes ${formatNaira(d.outstandingBalance)}`).join(', ');

    if (lower.includes('the most')) {
      const top = debtors[0];
      return {
        answer: `${top.name} owes you the most at ${formatNaira(
          top.outstandingBalance
        )}. In total, customers owe you ${formatNaira(totalOwing)} (${breakdown}).`,
      };
    }

    return {
      answer: `You have ${formatNaira(totalOwing)} in outstanding customer payments. Here is who owes you: ${breakdown}.`,
    };
  }

  // 15. "What did I spend the most money on?"
  if (lower.includes('spend the most') || lower.includes('biggest expense')) {
    const expMap: Record<string, number> = {};
    for (const e of state.events) {
      if (e.type === 'EXPENSE' && e.expenseAmount) {
        const cat = e.expenseCategory || 'Other';
        expMap[cat] = (expMap[cat] || 0) + e.expenseAmount;
      }
    }
    let topCat = 'None';
    let topAmt = 0;
    for (const [cat, amt] of Object.entries(expMap)) {
      if (amt > topAmt) {
        topAmt = amt;
        topCat = cat;
      }
    }
    return {
      answer: `Your biggest expense overall has been ${topCat} totaling ${formatNaira(topAmt)}.`,
    };
  }

  // 16. "Which product makes me the most profit?"
  if (lower.includes('most profit') || lower.includes('highest profit')) {
    const profitMap: Record<string, number> = {};
    for (const e of state.events) {
      if (e.type === 'SALE' && e.productName && e.grossProfit) {
        profitMap[e.productName] = (profitMap[e.productName] || 0) + e.grossProfit;
      }
    }
    let topProd = 'Shirts';
    let topProfit = 0;
    for (const [p, amt] of Object.entries(profitMap)) {
      if (amt > topProfit) {
        topProfit = amt;
        topProd = p;
      }
    }
    return {
      answer: `${topProd} has generated the most gross profit for your business, totaling approximately ${formatNaira(
        topProfit
      )}.`,
    };
  }

  // 17. "Did my promo make money?"
  if (lower.includes('promo')) {
    const promoEvents = state.events.filter((e) => e.isPromotion);
    let promoSales = 0;
    let promoDiscount = 0;
    let promoCost = 0;
    let promoProfit = 0;

    for (const e of promoEvents) {
      promoSales += e.totalRevenue || 0;
      promoDiscount += e.discountGiven || 0;
      promoCost += e.totalCostAtTime || 0;
      promoProfit += e.grossProfit || 0;
    }

    return {
      answer: `Yes, your promotion generated ${formatNaira(promoProfit)} in gross profit from ${formatNaira(
        promoSales
      )} in revenue (with ${formatNaira(
        promoDiscount
      )} given in customer discounts). However, I can't tell whether the promo increased your total profit compared to regular days because I don't have enough pre-promo baseline data to compare with.`,
    };
  }

  // 18. "Can I afford to buy another freezer?"
  if (lower.includes('freezer') || lower.includes('afford')) {
    let netCash = 0;
    for (const e of state.events) {
      if (e.cashReceived) netCash += e.cashReceived;
      if (e.expenseAmount) netCash -= e.expenseAmount;
      if (e.ownerAmount && e.isOwnerDrawing) netCash -= e.ownerAmount;
      if (e.ownerAmount && e.isOwnerInjection) netCash += e.ownerAmount;
    }
    const debtors = state.customers.filter((c) => c.outstandingBalance > 0);
    const totalOwing = debtors.reduce((sum, d) => sum + d.outstandingBalance, 0);

    return {
      answer: `Your net cash flow balance across recorded operations is around ${formatNaira(
        netCash
      )}, with ${formatNaira(totalOwing)} still uncollected from customers. If a new freezer costs ₦250k–₦350k, collecting outstanding debt from ${debtors
        .map((d) => d.name)
        .join(' and ')} will ensure your working capital stays safe without stalling daily stock purchases.`,
    };
  }

  // 19. Try interpreting as an event if it sounds like a transaction
  if (lower.includes('spent')) {
    const amtMatch = question.match(/(?:spent\s+)?(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 0;
    if (amt && amt > 0) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const expEvent: BusinessEvent = {
        id: `ev-chat-exp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'EXPENSE',
        rawUserText: question,
        systemResponseText: `Recorded expense of ${formatNaira(amt)}. Deducted from daily net profit.`,
        expenseAmount: amt,
        expenseCategory: 'Other',
      };
      return {
        answer: `Recorded: You spent ${formatNaira(amt)}. I have added this operational expense to your business ledger.`,
        createdEvent: expEvent,
      };
    }
  }

  if (lower.includes('sold')) {
    const prod = matchKnownProduct(lower, state.products) || contextualProduct;
    const amtMatch = question.match(/(?:for\s+)?(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = amtMatch ? parseNairaAmount(amtMatch[1]) : 0;
    if (amt && amt > 0) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const pName = prod ? prod.name : 'Goods';
      const cost = prod ? prod.currentCost : 0;
      const gross = Math.max(0, amt - cost);
      const saleEvent: BusinessEvent = {
        id: `ev-chat-sale-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'SALE',
        rawUserText: question,
        systemResponseText: `Recorded sale of ${pName} for ${formatNaira(amt)}.`,
        productName: pName,
        totalRevenue: amt,
        cashReceived: amt,
        unitCostAtTime: cost,
        totalCostAtTime: cost,
        grossProfit: gross,
      };
      return {
        answer: `Recorded: Sold ${pName} for ${formatNaira(amt)}. Estimated gross profit is ${formatNaira(gross)}.`,
        createdEvent: saleEvent,
      };
    }
  }

  // 20. Generic fallback with contextual cue
  const contextNote = activeCustomer ? ` (active customer context: ${activeCustomer.name})` : '';
  return {
    answer: `Based on your business ledger: Today's sales are ${formatNaira(
      todayEvents.reduce((acc, e) => acc + (e.totalRevenue || 0), 0)
    )}${contextNote}. You can teach me notes (e.g. '${activeCustomer ? activeCustomer.name : 'Chuks'} promised to pay Friday'), debt updates, or ask any question about your profits.`,
  };
}

/**
 * Deterministically answers business questions using stored ledger and memory (string wrapper)
 */
export function answerBusinessQuestion(question: string, state: BusinessState, chatHistory?: any[]): string {
  const res = answerBusinessQuestionWithMemory(question, state, chatHistory);
  return res.answer;
}
