import {
  BusinessEvent,
  BusinessState,
  FollowUpQuestion,
  ExpenseCategory,
  MemoryUpdateItem,
  ProductMemory,
  CustomerMemory,
  ConversationState,
} from '../types';
import { computeSaleMetrics, computeMultiItemTransaction, formatNaira } from './calculations';
import { getTodayDateStr, extractDateFromText, formatDateShort } from '../utils/dateUtils';
import { ensureEventHeadlineAndSummary } from './eventSummarizer';
import { matchCustomerFuzzy, matchProductFuzzy, findTargetEvent } from './businessEngine';

export function parseWordNumber(word: string): number | null {
  const map: Record<string, number> = {
    one: 1, a: 1, an: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    fifteen: 15,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    hundred: 100,
  };
  return map[word.toLowerCase()] || null;
}

/**
 * Extracts sale quantity and unit with high precision across all merchant phrasing:
 * - "Delivered 2 native outfits to Alhaji for 40k" -> quantity: 2, unit: "native outfits"
 * - "Sold 5 dresses", "Supplied 4 cartons", "Tailored 3 kaftans"
 * - "Delivered two outfits", "Sold three shirts"
 * - "2 native outfits for 40k"
 */
export function extractSaleQuantity(
  input: string,
  knownProducts?: ProductMemory[]
): { quantity: number; unit?: string } {
  // 1. Verb + number pattern: e.g. "delivered 2", "sold 2", "supplied 5", "made 3", "sewed 2", "tailored 4", "sent 6", "gave 2"
  const verbNumMatch = input.match(
    /\b(?:delivered|sold|supplied|made|sewed|tailored|sent|dispatched|gave|provided|issued|change\s+to|into)\s+([0-9]+)\b/i
  );
  if (verbNumMatch) {
    const qty = parseInt(verbNumMatch[1], 10);
    if (qty > 0) {
      const afterMatch = input.substring(verbNumMatch.index! + verbNumMatch[0].length).trim();
      const unitMatch = afterMatch.match(/^([a-zA-Z]+)(?:\s+([a-zA-Z]+))?/);
      let unit = '';
      if (unitMatch && !['to', 'for', 'from', 'at', 'with', 'yesterday', 'today', 'on'].includes(unitMatch[1].toLowerCase())) {
        unit = unitMatch[2] && !['to', 'for', 'from', 'at', 'with'].includes(unitMatch[2].toLowerCase())
          ? `${unitMatch[1]} ${unitMatch[2]}`
          : unitMatch[1];
      }
      return { quantity: qty, unit: unit || undefined };
    }
  }

  // 2. Verb + word number pattern: e.g. "delivered two", "sold three", "supplied four"
  const wordVerbMatch = input.match(
    /\b(?:delivered|sold|supplied|made|sewed|tailored|sent|dispatched|gave|bought)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/i
  );
  if (wordVerbMatch) {
    const val = parseWordNumber(wordVerbMatch[1]);
    if (val && val > 0) {
      return { quantity: val };
    }
  }

  // 3. Known product match: e.g. "2 native outfits", "5 dresses" where product exists in Business Memory
  if (knownProducts && knownProducts.length > 0) {
    for (const p of knownProducts) {
      if (!p.name) continue;
      const pEsc = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pMatch = input.match(new RegExp(`\\b([0-9]+)\\s+(?:[a-zA-Z]+\\s+)?${pEsc}\\b`, 'i'));
      if (pMatch) {
        const qty = parseInt(pMatch[1], 10);
        if (qty > 0) return { quantity: qty, unit: p.unit || undefined };
      }
    }
  }

  // 4. Standalone number followed by item/merchandise nouns:
  // e.g. "2 native outfits", "2 outfits", "3 dresses", "2 bags of rice", "5 shirts", "3 power banks"
  const nounQtyMatch = input.match(
    /\b([0-9]+)\s*(?:bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?|outfits?|wears?|dresses?|gowns?|kaftans?|suits?|wigs?|fabrics?|clothes?|cloths?|caps?|hats?|trouser|trousers|jeans|skirt|skirts|cups?|tins?|plates?|power\s*banks?|chargers?|phones?|batteries?|cables?|braids?|attachments?|rolls?|creams?|oils?|soaps?)\b/i
  );
  if (nounQtyMatch) {
    const qty = parseInt(nounQtyMatch[1], 10);
    if (qty > 0) return { quantity: qty };
  }

  // 5. General number preceding a word (excluding currency, time, prepositions, and price markers)
  const allNumWordMatches = [...input.matchAll(/\b([0-9]+)\s+([a-zA-Z]+)(?:\s+([a-zA-Z]+))?\b/g)];
  for (const m of allNumWordMatches) {
    const num = parseInt(m[1], 10);
    if (isNaN(num) || num <= 0) continue;
    const w1 = m[2].toLowerCase();
    // Skip currency suffixes, time of day, percentages, prepositions, and transaction terms
    if ([
      'k', 'm', 'naira', 'pm', 'am', 'percent', 'pct', 'for', 'at', 'to', 'from',
      'each', 'per', 'on', 'in', 'cash', 'debt', 'debts', 'balance', 'tonight',
      'today', 'tomorrow', 'yesterday', 'naira'
    ].includes(w1)) {
      continue;
    }
    // Skip if preceded by "for", "at", "@", "₦", "#" or comma thousands separator
    const prefixIndex = m.index || 0;
    const prefix = input.substring(Math.max(0, prefixIndex - 10), prefixIndex).trim();
    if (/(?:for|at|@|[₦#]|,)$/i.test(prefix)) {
      continue;
    }
    return { quantity: num, unit: w1 };
  }

  // 6. Word number preceding noun: e.g. "two outfits", "three native wears"
  const wordNounMatch = input.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s+(?:[a-zA-Z]+\s+)?(?:bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?|outfits?|wears?|dresses?|gowns?|kaftans?|suits?|wigs?|fabrics?|clothes?|cloths?|caps?)\b/i
  );
  if (wordNounMatch) {
    const val = parseWordNumber(wordNounMatch[1]);
    if (val && val > 0) return { quantity: val };
  }

  return { quantity: 1 };
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Parses numeric strings like "6000", "80k", "1.5k", "150k", "₦59,000", "#58,000", "2m",
 * or natural language sentences containing an amount like "Spent 12k on shop generator fuel"
 * or "Recorded an expense of 12,000 for shop generator fuel".
 */
export function parseNairaAmount(text: string): number | null {
  if (!text) return null;
  const raw = text.trim();

  // 1. Direct standalone clean parse
  const cleaned = raw.toLowerCase().replace(/[₦#,]/g, '').trim();
  const kDirect = cleaned.match(/^([0-9.]+)\s*k$/);
  if (kDirect) {
    const num = parseFloat(kDirect[1]);
    return isNaN(num) ? null : num * 1000;
  }
  const mDirect = cleaned.match(/^([0-9.]+)\s*m$/);
  if (mDirect) {
    const num = parseFloat(mDirect[1]);
    return isNaN(num) ? null : num * 1000000;
  }
  if (/^[0-9.]+$/.test(cleaned)) {
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  // 2. Pattern extraction from natural phrase or sentence
  // A. Currency prefixed: ₦12,000 or #12k or ₦12k
  const currMatch = raw.match(/[₦#]\s*([0-9.,]+)\s*([km]?)\b/i);
  if (currMatch) {
    const val = parseFloat(currMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) {
      const suffix = currMatch[2].toLowerCase();
      if (suffix === 'k') return val * 1000;
      if (suffix === 'm') return val * 1000000;
      return val;
    }
  }

  // B. Suffix amount: 12k, 1.5k, 2m
  const suffixMatch = raw.match(/\b([0-9.]+)\s*([km])\b/i);
  if (suffixMatch) {
    const val = parseFloat(suffixMatch[1]);
    if (!isNaN(val)) {
      const suffix = suffixMatch[2].toLowerCase();
      if (suffix === 'k') return val * 1000;
      if (suffix === 'm') return val * 1000000;
      return val;
    }
  }

  // C. Standalone comma formatted numbers (e.g. 12,000 or 350,000)
  const commaMatch = raw.match(/\b([0-9]{1,3}(?:,[0-9]{3})+)\b/);
  if (commaMatch) {
    const val = parseFloat(commaMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) return val;
  }

  // D. Number after preposition/verb: "expense of 12000", "spent 12000", "for 6000", "at 1500"
  const prepNumMatch = raw.match(/\b(?:spent|paid|for|at|of|cost|worth|giving|gives|amount)?\s*([0-9]{3,8})\b/i);
  if (prepNumMatch) {
    const val = parseFloat(prepNumMatch[1]);
    if (!isNaN(val)) return val;
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
  conversationState?: ConversationState | null;
  plainResponseText: string;
}

/**
 * Resolves the unit cost for a product based on the unit of sale mentioned.
 * If merchant mentions a bulk/parent unit (e.g. "bag", "carton"), returns the parent wholesale cost.
 * If merchant mentions a child unit (e.g. "bowl", "bottle"), returns the yield-derived unit cost.
 */
export function resolveProductCostForUnit(
  product: ProductMemory | Partial<ProductMemory> | { name?: string; currentCost?: number; yieldInfo?: any } | null | undefined,
  unitMentioned: string | undefined,
  state: BusinessState
): { unitCost: number; costBasis?: string; isEstimate?: boolean } {
  if (!product) return { unitCost: 0 };
  const currentCost = product.currentCost || 0;
  const prodName = product.name || '';

  const normUnit = (unitMentioned || '').toLowerCase().trim();

  // Check product's own yieldInfo
  if (product.yieldInfo) {
    const parent = (product.yieldInfo.parentUnit || '').toLowerCase();
    const child = (product.yieldInfo.childUnit || '').toLowerCase();

    // Check if bulk parent unit was sold (e.g. "bag", "bags", "carton", "cartons")
    if (parent && (normUnit.startsWith(parent) || normUnit.includes(parent) || (parent === 'bag' && normUnit.includes('bag')))) {
      const parentCost = product.yieldInfo.parentCost || (currentCost * (product.yieldInfo.yieldCount || 1));
      return {
        unitCost: parentCost,
        costBasis: `Wholesale ${product.yieldInfo.parentUnit} cost: ₦${parentCost.toLocaleString()}`,
        isEstimate: false,
      };
    }

    // Check if child unit was sold (e.g. "bowl", "bowls", "bottle", "bottles")
    if (child && (normUnit.startsWith(child) || normUnit.includes(child))) {
      return {
        unitCost: currentCost,
        costBasis: `Yield estimate: 1 ${product.yieldInfo.parentUnit} (${product.yieldInfo.yieldCount} ${product.yieldInfo.childUnit}s) at ₦${(product.yieldInfo.parentCost || 0).toLocaleString()}`,
        isEstimate: product.yieldInfo.isEstimate,
      };
    }
  }

  // Check state.unitRelationships
  if (prodName) {
    const rel = (state.unitRelationships || []).find(
      (r) => r.productName && r.productName.toLowerCase() === prodName.toLowerCase()
    );
    if (rel) {
      const pUnit = rel.parentUnit.toLowerCase();
      if (normUnit.startsWith(pUnit) || normUnit.includes(pUnit)) {
        const parentCost = rel.parentCost || (currentCost * (rel.yieldCount || rel.ratio || 1));
        return {
          unitCost: parentCost,
          costBasis: `Wholesale ${rel.parentUnit} cost: ₦${parentCost.toLocaleString()}`,
          isEstimate: false,
        };
      }
    }
  }

  return {
    unitCost: currentCost,
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
  // e.g. "Delete product rice", "Delete that transaction", "Remove customer Musa", "Delete the 10k expense"
  if (lower.includes('delete') || lower.includes('remove') || lower.includes('void')) {
    // 1. Check if deleting a PRODUCT from memory
    const cleanProdText = input
      .replace(/^(?:please\s+)?(?:delete|remove|void|clear)\s+(?:the\s+)?(?:product\s+|good\s+|item\s+)?/i, '')
      .replace(/\s+(?:from\s+memory|from\s+business\s+memory|from\s+my\s+store)$/i, '')
      .trim();

    const matchedProd = matchKnownProduct(cleanProdText || lower, state.products);
    if (
      lower.includes('product') ||
      lower.includes('from memory') ||
      (matchedProd && !lower.includes('transaction') && !lower.includes('sale') && !lower.includes('expense') && !lower.includes('log'))
    ) {
      if (matchedProd) {
        return {
          isQuestion: false,
          isCorrection: true,
          plainResponseText: `Permanently deleted product "${matchedProd.name}" from your Business Memory and removed any linked conversion rules.`,
          memoryUpdates: [
            {
              type: 'PRODUCT_DELETE' as any,
              targetName: matchedProd.name,
              summary: `Deleted product ${matchedProd.name} from Business Memory`,
              data: { productId: matchedProd.id, productName: matchedProd.name },
            },
          ],
        };
      } else {
        return {
          isQuestion: false,
          isCorrection: true,
          plainResponseText: `I couldn't find "${cleanProdText || 'that product'}" in your Business Memory to delete. Your store records remain unchanged.`,
        };
      }
    }

    // 2. Check if deleting a CUSTOMER profile
    if (lower.includes('customer') || lower.includes('debtor')) {
      const cleanCustText = input
        .replace(/^(?:please\s+)?(?:delete|remove|void|clear)\s+(?:the\s+)?(?:customer\s+|debtor\s+)?/i, '')
        .trim();
      const matchedCust = matchKnownCustomer(cleanCustText || lower, state.customers);
      if (matchedCust) {
        return {
          isQuestion: false,
          isCorrection: true,
          plainResponseText: `Deleted customer profile for "${matchedCust.name}" from your Customer Memory bank.`,
          memoryUpdates: [
            {
              type: 'CUSTOMER_DELETE' as any,
              targetName: matchedCust.name,
              summary: `Deleted customer profile ${matchedCust.name}`,
              data: { customerId: matchedCust.id, customerName: matchedCust.name },
            },
          ],
        };
      } else {
        return {
          isQuestion: false,
          isCorrection: true,
          plainResponseText: `I couldn't find customer "${cleanCustText || 'profile'}" in your records to delete.`,
        };
      }
    }

    // 3. Deleting a TRANSACTION / EVENT
    const targetEvent = findTargetEvent(state, input);

    if (targetEvent) {
      return {
        isQuestion: false,
        isCorrection: true,
        deletedEventId: targetEvent.id,
        targetDate: targetEvent.date,
        targetCalendarDate: targetEvent.date,
        shouldNavigateToCalendar: true,
        plainResponseText: `Deleted: The ${targetEvent.productName || targetEvent.type.toLowerCase()} record of ${formatNaira(targetEvent.totalRevenue || targetEvent.expenseAmount || 0)} has been permanently removed from your ledger and calendar. Your totals and balances have been updated.`,
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
    } else {
      return {
        isQuestion: false,
        isCorrection: true,
        plainResponseText: `I couldn't find that transaction to delete. Your business records remain unchanged.`,
      };
    }
  }

  // A2) NUMERICAL CORRECTION TO RECENT TRANSACTION:
  // e.g. "Actually, he paid 12k", "Actually that was 25k", "Actually it wasn't five. It was eight."
  if (lower.startsWith('actually') || lower.includes('was actually') || lower.includes('make that') || lower.includes('it wasn\'t') || lower.includes('it was')) {
    const activeEvents = state.events.filter((e) => !e.isCorrected);
    const targetEvent = activeEvents[0];
    if (targetEvent) {
      // Partial payment correction: e.g. "Actually, he paid 12k" or "He paid 12k"
      const paidMatch = input.match(/(?:paid|he paid|she paid|gave me)\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i) ||
                        input.match(/(?:actually|no,)\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
      const qtyWordMatch = input.match(/(?:was|make that|quantity was|it was)\s+([a-zA-Z0-9]+)/i);
      const parsedWordQty = qtyWordMatch ? (parseInt(qtyWordMatch[1], 10) || parseWordNumber(qtyWordMatch[1])) : null;

      if (paidMatch && !parsedWordQty) {
        const newPaid = parseNairaAmount(paidMatch[1]);
        if (newPaid !== null) {
          const totalRev = targetEvent.totalRevenue || 0;
          const newCash = newPaid;
          const newReceivable = Math.max(0, totalRev - newCash);

          const corrected: BusinessEvent = ensureEventHeadlineAndSummary({
            ...targetEvent,
            id: `ev-corr-${Date.now()}`,
            cashReceived: newCash,
            receivableAdded: newReceivable,
            correctionOfId: targetEvent.id,
            auditTrail: [
              ...(targetEvent.auditTrail || []),
              { timestamp: new Date().toISOString(), action: 'PAYMENT_CORRECTION', note: `Corrected cash paid to ${formatNaira(newCash)}` },
            ],
          });

          return {
            isQuestion: false,
            isCorrection: true,
            correctedEvent: corrected,
            targetCalendarDate: targetEvent.date,
            plainResponseText: `Corrected: Updated cash received to ${formatNaira(newCash)}.${newReceivable > 0 && targetEvent.customerName ? ` ${targetEvent.customerName} now owes ${formatNaira(newReceivable)}.` : ''} Your records and customer balance have been updated.`,
          };
        }
      } else if (parsedWordQty && parsedWordQty > 0) {
        const newQty = parsedWordQty;
        const oldQty = targetEvent.quantity || 1;
        const unitPrice = targetEvent.unitSellingPrice || (targetEvent.totalRevenue ? targetEvent.totalRevenue / oldQty : 0);
        const unitCost = targetEvent.unitCostAtTime || 0;
        const newTotalRev = unitPrice * newQty;
        const newTotalCost = unitCost * newQty;
        const newGross = newTotalRev - newTotalCost;
        const newCash = targetEvent.receivableAdded && targetEvent.receivableAdded > 0 ? (targetEvent.cashReceived || 0) : newTotalRev;
        const newReceivable = Math.max(0, newTotalRev - newCash);

        const corrected: BusinessEvent = ensureEventHeadlineAndSummary({
          ...targetEvent,
          id: `ev-corr-${Date.now()}`,
          quantity: newQty,
          totalRevenue: newTotalRev,
          cashReceived: newCash,
          receivableAdded: newReceivable,
          totalCostAtTime: newTotalCost,
          grossProfit: newGross,
          correctionOfId: targetEvent.id,
          auditTrail: [
            ...(targetEvent.auditTrail || []),
            { timestamp: new Date().toISOString(), action: 'QUANTITY_CORRECTION', note: `Corrected quantity to ${newQty}` },
          ],
        });

        return {
          isQuestion: false,
          isCorrection: true,
          correctedEvent: corrected,
          targetCalendarDate: targetEvent.date,
          plainResponseText: `Corrected: Updated quantity to ${newQty} ${targetEvent.unit || 'units'} of ${targetEvent.productName || 'item'} for ${formatNaira(newTotalRev)}.`,
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
    // Extract quantity & unit
    const parsedQty = extractSaleQuantity(input, state.products);
    const quantity = parsedQty.quantity;
    const unitMentioned = parsedQty.unit || '';

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
 * Distinguishes customer purchase statements ("David bought 2 shirts", "A customer bought 3 bottles") from merchant expense/purchase statements ("I bought so and so")
 */
export function isCustomerBuyingStatement(text: string, customers: CustomerMemory[]): boolean {
  const lower = text.toLowerCase().trim();
  if (
    lower.startsWith('i bought') ||
    lower.startsWith('we bought') ||
    lower.startsWith('bought ') ||
    lower.startsWith('i purchase') ||
    lower.startsWith('i paid') ||
    lower.startsWith('i spent') ||
    lower.startsWith('spent ')
  ) {
    return false;
  }

  // Check if a known customer name is at the start or precedes bought/took
  const startCust = matchCustomerFuzzy(lower, customers);
  if (startCust.customer && (lower.includes('bought') || lower.includes('took') || lower.includes('collected'))) {
    return true;
  }

  if (
    /^(?:customer|someone|a customer|a lady|a man|a guy|a boy|a girl)\s+(?:bought|took|collected|purchased)/i.test(lower)
  ) {
    return true;
  }

  const nameMatch = text.match(/^([A-Za-z]+)\s+(?:bought|took|collected|purchased)/i);
  if (nameMatch) {
    const word = nameMatch[1].toLowerCase();
    if (!['i', 'we', 'they', 'who', 'he', 'she', 'just', 'today', 'yesterday'].includes(word)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the statement describes custom production spending AND charging a client (e.g. "I spent #64000 to make a dress and charged the client #79000")
 */
export function isCompositeProductionSale(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const hasProductionSpend =
    /(?:i\s+)?(?:spent|used|bought|paid)\s+[₦#]?[0-9.,]+[km]?\s+(?:to\s+(?:make|sew|produce|bake|build|repair|fix|design|craft)|on\s+(?:materials|fabrics?|parts|ingredients?\s+for|making|producing))/i.test(lower) ||
    /(?:cost|spent)\s+(?:me\s+)?[₦#]?[0-9.,]+[km]?\s+(?:to\s+(?:make|sew|produce|bake|build|repair|fix))/i.test(lower);

  const hasChargeOrSell = /\b(?:charged|billed|sold\s+(?:it\s+)?(?:to|for)|collected\s+from)\b/i.test(lower);
  if (!hasProductionSpend || !hasChargeOrSell) return false;

  const amountMatches = [...text.matchAll(/(?:[₦#]\s*[0-9.,]+[km]?|[0-9.,]+[km]\b|\b[0-9]{3,8}\b)/gi)];
  return amountMatches.length >= 2;
}

/**
 * Parses composite production-and-sale transactions:
 * Merchant spent money to produce/make an item AND charged a client.
 * Produces BOTH the Production Expense event and the Sale event.
 */
export function parseCompositeProductionSale(input: string, state: BusinessState): ParseResult | null {
  if (!isCompositeProductionSale(input)) return null;

  const amountMatches = [...input.matchAll(/(?:[₦#]\s*[0-9.,]+[km]?|[0-9.,]+[km]\b|\b[0-9]{3,8}\b)/gi)];
  if (amountMatches.length < 2) return null;

  const rawSpent = amountMatches[0][0];
  const rawCharged = amountMatches[amountMatches.length - 1][0];

  const spentAmt = parseNairaAmount(rawSpent);
  const chargedAmt = parseNairaAmount(rawCharged);

  if (!spentAmt || !chargedAmt || spentAmt <= 0 || chargedAmt <= 0) return null;

  // Extract product & customer & quantity
  let prodName = 'Dress';
  let custName = 'Client';
  let qty = 1;

  const prodMatch =
    input.match(/(?:to\s+(?:make|sew|produce|bake|build|repair|fix|design|craft)\s+(?:a\s+|an\s+|the\s+)?([0-9]+\s+)?([a-zA-Z\s]+?)(?:\s+and|\s*,|\s+for|\s+at|\s+charged|\s+billed|\s+sold|\s+collected))/i) ||
    input.match(/(?:on\s+(?:materials|fabrics?|parts|ingredients?\s+for)\s+(?:a\s+|an\s+|the\s+)?([0-9]+\s+)?([a-zA-Z\s]+?)(?:\s+and|\s*,|\s+charged|\s+billed|\s+sold|\s+collected))/i);
  if (prodMatch) {
    if (prodMatch[1]) {
      const q = parseInt(prodMatch[1].trim(), 10);
      if (!isNaN(q) && q > 0) qty = q;
    }
    const rawProd = prodMatch[2].trim();
    if (rawProd && rawProd.length > 1) {
      prodName = rawProd.charAt(0).toUpperCase() + rawProd.slice(1);
    }
  }

  const custMatch = input.match(/(?:charged|billed|sold\s+(?:it\s+)?to|collected\s+from)\s+(?:the\s+)?([a-zA-Z]+)/i);
  if (custMatch) {
    const rawCust = custMatch[1].trim();
    if (rawCust && !['for', 'at', 'sum', 'a', 'the', 'my'].includes(rawCust.toLowerCase())) {
      custName = rawCust.charAt(0).toUpperCase() + rawCust.slice(1);
    }
  }

  const todayStr = getTodayDateStr();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const profit = chargedAmt - spentAmt;

  const expenseEv: BusinessEvent = ensureEventHeadlineAndSummary({
    id: `ev-exp-${Date.now()}-1`,
    timestamp: new Date().toISOString(),
    date: todayStr,
    timeStr,
    type: 'EXPENSE',
    rawUserText: input,
    systemResponseText: `Spent ${formatNaira(spentAmt)} to make ${prodName} (Materials & Production Expense).`,
    expenseCategory: 'Procurement',
    expenseAmount: spentAmt,
    productName: prodName,
    quantity: qty,
    totalCostAtTime: spentAmt,
    totalRevenue: 0,
    cashReceived: 0,
    headline: `Expense • Procurement`,
    summary: `Spent ${formatNaira(spentAmt)} to make ${prodName}.`,
  });

  const saleEv: BusinessEvent = ensureEventHeadlineAndSummary({
    id: `ev-sale-${Date.now()}-2`,
    timestamp: new Date().toISOString(),
    date: todayStr,
    timeStr,
    type: 'SALE',
    rawUserText: input,
    systemResponseText: `Charged ${custName} ${formatNaira(chargedAmt)} for ${qty} ${prodName}.`,
    productName: prodName,
    customerName: custName,
    quantity: qty,
    unit: 'piece',
    unitSellingPrice: chargedAmt / qty,
    totalRevenue: chargedAmt,
    cashReceived: chargedAmt,
    receivableAdded: 0,
    unitCostAtTime: 0,
    totalCostAtTime: 0,
    costIsEstimate: false,
    costEstimateBasis: 'exact',
    grossProfit: chargedAmt,
    headline: `Sale • ${qty} ${prodName}`,
    summary: `Charged ${custName} ${formatNaira(chargedAmt)} for ${prodName}.`,
  });

  const summaryText = `Got it. Recorded 2 transactions: Spent ${formatNaira(spentAmt)} on ${prodName} production (Materials & Production Expense) and charged ${custName} ${formatNaira(chargedAmt)} (Sale). Net Profit: ${formatNaira(profit)}.`;

  return {
    isQuestion: false,
    createdEvent: saleEv,
    createdEvents: [expenseEv, saleEv],
    plainResponseText: summaryText,
  };
}

/**
 * Checks if the statement represents merchant expenditure/purchase (outflow), never a sale.
 */
export function isMerchantSpendingStatement(text: string, customers: CustomerMemory[]): boolean {
  if (isCompositeProductionSale(text)) {
    return false;
  }
  const lower = text.toLowerCase().trim();
  if (
    lower.startsWith('i bought') ||
    lower.startsWith('we bought') ||
    lower.startsWith('bought ') ||
    lower.startsWith('i purchase') ||
    lower.startsWith('i spent') ||
    lower.startsWith('spent ') ||
    lower.startsWith('i paid') ||
    (lower.includes('bought') && !isCustomerBuyingStatement(text, customers) && !lower.includes('paid me'))
  ) {
    return true;
  }
  return false;
}

/**
 * Parses merchant spending/purchases ("I bought so and so", "Bought fuel 5k", "I bought 30 cartons from Musa at 12k each")
 * Always an OUTFLOW (Expense or Procurement Stock Purchase), NEVER A SALE!
 */
export function parseMerchantExpenseOrPurchase(input: string, state: BusinessState): ParseResult | null {
  const lower = input.toLowerCase().trim();
  const todayStr = getTodayDateStr();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const isMerchantBuying = isMerchantSpendingStatement(input, state.customers);
  if (!isMerchantBuying) return null;

  const atEachMatch = input.match(/at\s+(?:[₦#]?\s*([0-9.,]+[km]?))\s+each/i);
  const qtyMatch = input.match(/bought\s+([0-9]+)/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  let totalAmt = 0;

  if (atEachMatch) {
    const unitAmt = parseNairaAmount(atEachMatch[1]) || 0;
    totalAmt = unitAmt * qty;
  } else {
    const amtMatch =
      input.match(/(?:for|at|spent|paid)\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i) ||
      input.match(/(?:[₦#]\s*([0-9.,]+[km]?))/i) ||
      input.match(/([0-9.,]+[km])\b/i) ||
      input.match(/\b([0-9]{3,}[0-9.,]*)\b/) ||
      input.match(/\s+([0-9]+)\s*$/);
    if (amtMatch) {
      totalAmt = parseNairaAmount(amtMatch[1]) || 0;
    }
  }

  // Extract item description
  const itemMatch = input.match(
    /(?:i\s+bought|we\s+bought|bought|i\s+spent|spent|i\s+paid|paid)\s+(?:[0-9]+\s+)?([^#₦0-9]+?)(?:\s+(?:for|at|from|with)\s+|\s+[₦#]|\s+[0-9]|$)/i
  );
  let itemDesc = itemMatch ? itemMatch[1].trim() : '';
  if (itemDesc) {
    itemDesc = itemDesc.charAt(0).toUpperCase() + itemDesc.slice(1);
  }
  if (!itemDesc || itemDesc.length < 2) {
    const prodMatch = matchKnownProduct(lower, state.products);
    itemDesc = prodMatch ? prodMatch.name : 'Goods & Supplies';
  }

  const cat = detectExpenseCategory(lower + ' ' + itemDesc);

  if (totalAmt > 0) {
    const supplierMatch = matchKnownSupplier(lower, state.suppliers);
    const supTextMatch = input.match(/from\s+([A-Za-z]+)/i);
    const supName = supplierMatch
      ? supplierMatch.name
      : supTextMatch
      ? supTextMatch[1].charAt(0).toUpperCase() + supTextMatch[1].slice(1)
      : undefined;

    const ev: BusinessEvent = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      timeStr,
      type: 'EXPENSE',
      expenseCategory: supName ? 'Procurement' : cat,
      expenseAmount: totalAmt,
      rawUserText: input,
      systemResponseText: supName
        ? `Recorded: Bought ${qty > 1 ? qty + ' ' : ''}${itemDesc} from ${supName} for ${formatNaira(totalAmt)} (Procurement Expense). Deducted from today's cash.`
        : `Recorded: Spent ${formatNaira(totalAmt)} on ${itemDesc} (${cat}). Deducted from today's net operating cash.`,
      supplierName: supName,
      productName: itemDesc,
      quantity: qty,
      totalCostAtTime: totalAmt,
      totalRevenue: 0,
      cashReceived: 0,
      headline: supName ? `Restocked • ${itemDesc}` : `Expense • ${cat}`,
      summary: supName
        ? `Purchased ${itemDesc} from ${supName} for ${formatNaira(totalAmt)}.`
        : `Spent ${formatNaira(totalAmt)} on ${itemDesc}.`,
    };

    const finalEv = ensureEventHeadlineAndSummary(ev);
    const memoryUpdates: MemoryUpdateItem[] = [];

    if (supName) {
      memoryUpdates.push({
        type: 'SUPPLIER_INFO',
        summary: `Supplier ${supName} supplied ${itemDesc} for ${formatNaira(totalAmt)}`,
        data: { supplierName: supName, note: `Supplied ${itemDesc} for ${formatNaira(totalAmt)} on ${todayStr}` },
      });
    }

    return {
      isQuestion: false,
      createdEvent: finalEv,
      memoryUpdates: memoryUpdates.length > 0 ? memoryUpdates : undefined,
      plainResponseText: finalEv.systemResponseText,
    };
  } else {
    // Amount was not provided (e.g. "I bought so and so")
    return {
      isQuestion: false,
      followUpRequired: {
        id: `fu-${Date.now()}`,
        prompt: `How much did you spend on ${itemDesc}?`,
        missingField: 'EXPENSE_AMOUNT',
        pendingEvent: {
          rawUserText: input,
          type: 'EXPENSE',
          productName: itemDesc,
          expenseCategory: cat,
        },
      },
      plainResponseText: `I noted that you bought ${itemDesc}. How much did you spend on this?`,
    };
  }
}

/**
 * Detects if the user is establishing or teaching reusable business knowledge
 * (e.g. "I now sell this dress for 35k", "My normal delivery charge is 5k", "One bag of rice costs me 59k")
 */
export function detectAndLearnBusinessMemory(
  input: string,
  state: BusinessState
): ParseResult | null {
  const todayStr = getTodayDateStr();

  // 1. Selling price teaching: "I now sell this dress for 35k" / "Normal selling price for kaftan is 35k"
  const sellMatch = input.match(/(?:i now sell|normal selling price of|selling price for|we now sell|we sell)\s+([a-zA-Z\s]+?)\s+(?:for|at|is)\s+([₦#]?[0-9.,]+[km]?)/i);
  if (sellMatch) {
    const prodName = sellMatch[1].replace(/^(?:this|the|our|my)\s+/i, '').trim();
    const price = parseNairaAmount(sellMatch[2]);
    if (price && price > 0) {
      const memUpdate: MemoryUpdateItem = {
        type: 'PRODUCT_PRICE',
        summary: `Established normal price of ${prodName}: ${formatNaira(price)}`,
        data: {
          productName: prodName,
          price,
          normalSellingPrice: price,
          date: todayStr,
          note: 'Owner established new selling price rule',
        },
      };
      return {
        isQuestion: false,
        memoryUpdates: [memUpdate],
        memoryUpdate: memUpdate as any,
        plainResponseText: `Understood. I have updated Business Memory: normal selling price for ${prodName} is now ${formatNaira(price)}.`,
      };
    }
  }

  // 2. Cost teaching: "One bag of rice costs me 59k" / "Cost of rice is 59k"
  const costMatch = input.match(/(?:one bag of|bag of|cost of|costs me)\s+([a-zA-Z\s]+?)\s+(?:costs me|costs|is)\s+([₦#]?[0-9.,]+[km]?)/i);
  if (costMatch) {
    const prodName = costMatch[1].replace(/^(?:this|the|our|my)\s+/i, '').trim();
    const cost = parseNairaAmount(costMatch[2]);
    if (cost && cost > 0) {
      const memUpdate: MemoryUpdateItem = {
        type: 'PRODUCT_COST',
        summary: `Recorded wholesale cost of ${prodName}: ${formatNaira(cost)}`,
        data: {
          productName: prodName,
          cost,
          date: todayStr,
          note: 'Owner established new cost rule',
        },
      };
      return {
        isQuestion: false,
        memoryUpdates: [memUpdate],
        memoryUpdate: memUpdate as any,
        plainResponseText: `Understood. Saved to Business Memory: cost of ${prodName} is now ${formatNaira(cost)}.`,
      };
    }
  }

  // 3. Operational rule: "My normal delivery charge is 5k"
  const ruleMatch = input.match(/(?:my normal|our normal|normal)\s+([a-zA-Z\s]+?)\s+(?:charge\s+)?(?:is|costs)\s+([₦#]?[0-9.,]+[km]?)/i);
  if (ruleMatch) {
    const ruleSubject = ruleMatch[1].trim();
    const ruleAmt = parseNairaAmount(ruleMatch[2]);
    if (ruleAmt && ruleAmt > 0) {
      const memUpdate: MemoryUpdateItem = {
        type: 'BUSINESS_RULE',
        summary: `Normal ${ruleSubject} established as ${formatNaira(ruleAmt)}`,
        data: {
          rule: `Normal ${ruleSubject} is ${formatNaira(ruleAmt)}`,
          category: 'Operations',
        },
      };
      return {
        isQuestion: false,
        memoryUpdates: [memUpdate],
        memoryUpdate: memUpdate as any,
        plainResponseText: `Noted in Business Rules: normal ${ruleSubject} is set to ${formatNaira(ruleAmt)}.`,
      };
    }
  }

  // 4. Supplier: "Musa is my fabric supplier"
  const supMatch = input.match(/([a-zA-Z]+)\s+is\s+(?:my|our)\s+([a-zA-Z\s]+?)\s*supplier/i);
  if (supMatch) {
    const supName = supMatch[1].trim();
    const supCategory = supMatch[2].trim();
    const memUpdate: MemoryUpdateItem = {
      type: 'SUPPLIER_INFO',
      summary: `Supplier ${supName} recorded (${supCategory})`,
      data: {
        supplierName: supName,
        note: `${supCategory} supplier`,
      },
    };
    return {
      isQuestion: false,
      memoryUpdates: [memUpdate],
      memoryUpdate: memUpdate as any,
      plainResponseText: `Saved ${supName} as your ${supCategory} supplier in Business Memory.`,
    };
  }

  // 5. Customer: "John is a regular customer"
  const custMatch = input.match(/([a-zA-Z]+)\s+is\s+(?:a|my|our)?\s*(?:regular|vip|new)?\s*customer/i);
  if (custMatch) {
    const custName = custMatch[1].trim();
    const memUpdate: MemoryUpdateItem = {
      type: 'CUSTOMER_NOTE',
      summary: `Customer ${custName} recorded in memory`,
      data: {
        customerName: custName,
        note: 'Regular customer',
      },
    };
    return {
      isQuestion: false,
      memoryUpdates: [memUpdate],
      memoryUpdate: memUpdate as any,
      plainResponseText: `Saved ${custName} as a customer in Business Memory.`,
    };
  }

  return null;
}

/**
 * Helper to determine if an input text represents a brand-new transaction, inquiry, or cancellation
 * rather than an answer to an existing pending follow-up question.
 */
function isNewTransactionOrIntent(input: string): boolean {
  const lower = input.toLowerCase().trim();
  // Cancellation commands
  if (/^(?:cancel|nevermind|never mind|forget it|stop|ignore|clear|no|leave it|skip)\b/i.test(lower)) {
    return true;
  }
  // Business questions
  if (
    lower.includes('?') ||
    isBusinessQuestion(lower) ||
    /^(?:what|how|who|which|where|is there|can i|tell me)\b/i.test(lower)
  ) {
    return true;
  }
  // Fulfillment / delivery verbs with quantity or details (e.g. "delivered 2 outfits to Alhaji for 40k")
  if (
    /\b(?:delivered|dispatched|supplied|sent|sewed|tailored|made|gave)\s+([0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|[a-zA-Z]+)/i.test(
      lower
    )
  ) {
    return true;
  }
  // Sale and service execution
  if (
    /\b(?:i sold|we sold|sold\s+[0-9]+|sold\s+some|sold\s+a\s+|selling)\b/i.test(lower) ||
    /\b(?:did|done|rendered|styled|fixed|repaired|installed|washed|cleaned|barbed|cut|tailored|sewed)\s+[a-zA-Z]+/i.test(lower) ||
    isServiceSemantic('', lower) ||
    /\b(?:power\s*banks?)\b/i.test(lower)
  ) {
    return true;
  }
  // Spending / purchase / expense verbs
  if (
    /\b(?:bought|i bought|we bought|spent|i spent|paid for|shop rent|stall rent|fuel|transport|salary|generator)\b/i.test(
      lower
    )
  ) {
    return true;
  }
  // Multiple distinct entities: e.g. quantity + product + recipient/customer + price ("2 outfits to Alhaji for 40k")
  if (/[0-9]+\s+[a-zA-Z]+\s+(?:to|for)\s+[a-zA-Z]+/i.test(lower)) {
    return true;
  }
  return false;
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

  // 0b. Check if owner is establishing new reusable business knowledge/memory:
  const learningResult = detectAndLearnBusinessMemory(input, state);
  if (learningResult) {
    return learningResult;
  }

  // 0c. Check for composite custom production sales ("I spent #64000 to make a dress and charged the client #79000"):
  const immediateComposite = parseCompositeProductionSale(input, state);
  if (immediateComposite) {
    return immediateComposite;
  }

  // 1. Check if this is answering a pending follow-up question
  if (state.pendingFollowUp) {
    const followUp = state.pendingFollowUp;

    // A. User explicitly cancels the pending follow-up
    if (/^(?:cancel|nevermind|never mind|forget it|stop|ignore|clear|no|leave it|skip)\b/i.test(lower)) {
      return {
        isQuestion: false,
        conversationState: null,
        plainResponseText: 'Cancelled previous prompt. What transaction or sale would you like to record?',
      };
    }

    // B. User typed a brand-new transaction, inquiry, or statement -> DISCARD follow-up and process as fresh input!
    if (isNewTransactionOrIntent(input)) {
      // Intentionally bypass follow-up resolution; proceed directly to standard evaluation
    } else {
      const answeredCost = parseNairaAmount(input);

      // Resolving ambiguous choice (e.g. "Ankara" or "Corporate Dress")
      if (followUp.missingField === 'AMBIGUOUS_CHOICE' && followUp.options) {
        const picked = followUp.options.find((opt) =>
          lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower)
        );
        if (picked) {
          const pending = followUp.pendingEvent || {};
          const combined = `I sold ${pending.quantity || 1} ${picked}`;
          return parseSaleStatement(combined, state);
        }
      }

      // Resolving missing selling price (e.g. "I sold 3 kaftans" followed by "35,000")
      if (followUp.missingField === 'SELLING_PRICE') {
        // Only re-specify if user provided a pure quantity + price like "2 bags for 120k" or "2 for 60k"
        const isReSpecifiedQuantityAndPrice =
          /^[0-9]+\s*(?:bags?|bowls?|cartons?|items?|pieces?|shirts?|dresses?|units?|packs?)\s+(?:for|at)\s+[₦#]?[0-9]+/i.test(input) ||
          /^[0-9]+\s+(?:for|at)\s+[₦#]?[0-9]+/i.test(input);

        if (isReSpecifiedQuantityAndPrice) {
          const combined = `${followUp.pendingEvent?.rawUserText || followUp.productName || 'Sale'} ${input}`;
          return parseSaleStatement(combined, state);
        }

        if (answeredCost !== null && answeredCost > 0) {
          const pending = followUp.pendingEvent || {};
          const prodName = followUp.productName || pending.productName || 'Items';
          const qty = pending.quantity || 1;
          const totalRev = answeredCost * qty;
          const custName = followUp.customerName || pending.customerName;

          // Check if product has cost in memory
          const matchedProd = state.products.find((p) => p.name.toLowerCase() === prodName.toLowerCase());
          const costRes = resolveProductCostForUnit(matchedProd, undefined, state);
          const unitCost = costRes.unitCost || 0;
          const totalCost = unitCost * qty;
          const hasCost = unitCost > 0;
          const grossProfit = hasCost ? totalRev - totalCost : 0;

          const completedEvent: BusinessEvent = ensureEventHeadlineAndSummary({
            id: `ev-${Date.now()}`,
            timestamp: new Date().toISOString(),
            date: todayStr,
            timeStr,
            type: 'SALE',
            rawUserText: pending.rawUserText ? `${pending.rawUserText} -> ${input}` : input,
            systemResponseText: `Got it. Recorded sale of ${qty} ${prodName.toLowerCase()} for ${formatNaira(totalRev)} (${formatNaira(answeredCost)} each). I've saved ${formatNaira(answeredCost)} as your normal selling price in Business Memory.`,
            productName: prodName,
            customerName: custName,
            quantity: qty,
            unitSellingPrice: answeredCost,
            totalRevenue: totalRev,
            cashReceived: totalRev,
            receivableAdded: 0,
            unitCostAtTime: unitCost,
            totalCostAtTime: totalCost,
            grossProfit: hasCost ? grossProfit : 0,
            costIsEstimate: costRes.isEstimate,
          });

          const memoryUpdates: MemoryUpdateItem[] = [
            {
              type: 'PRODUCT_PRICE',
              summary: `Normal selling price of ${prodName} recorded as ${formatNaira(answeredCost)}`,
              data: {
                productName: prodName,
                price: answeredCost,
                normalSellingPrice: answeredCost,
                date: todayStr,
                note: 'Learned normal selling price from owner answer during sale',
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

    // Resolving missing payment amount (e.g. "John paid me" followed by "5000" or "40k")
    if (followUp.missingField === 'PAYMENT_AMOUNT' && answeredCost !== null && answeredCost > 0) {
      const pending = followUp.pendingEvent || {};
      const custName = followUp.customerName || pending.customerName || 'Customer';
      const payEv: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'DEBT_PAYMENT',
        rawUserText: pending.rawUserText ? `${pending.rawUserText} -> ${input}` : input,
        systemResponseText: `Recorded debt payment of ${formatNaira(answeredCost)} from ${custName}. Their debt balance has been updated.`,
        customerName: custName,
        cashReceived: answeredCost,
        receivableAdded: -answeredCost,
        totalRevenue: 0,
        grossProfit: 0,
      };
      return {
        isQuestion: false,
        createdEvent: payEv,
        plainResponseText: payEv.systemResponseText,
      };
    }

    // Resolving missing debt amount (e.g. "David owes me" followed by "80k")
    if (followUp.missingField === 'DEBT_AMOUNT' && answeredCost !== null && answeredCost > 0) {
      const pending = followUp.pendingEvent || {};
      const custName = followUp.customerName || pending.customerName || 'Customer';
      const debtEv: BusinessEvent = {
        id: `ev-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: todayStr,
        timeStr,
        type: 'CUSTOMER_DEBT',
        rawUserText: pending.rawUserText ? `${pending.rawUserText} -> ${input}` : input,
        systemResponseText: `Recorded debt of ${formatNaira(answeredCost)} owed by ${custName}.`,
        customerName: custName,
        receivableAdded: answeredCost,
        totalRevenue: 0,
        cashReceived: 0,
        grossProfit: 0,
      };
      return {
        isQuestion: false,
        createdEvent: debtEv,
        plainResponseText: debtEv.systemResponseText,
      };
    }

    // Resolving missing quantity or price (e.g. "I sold some rice" followed by "2 bags for 120k")
    if (followUp.missingField === 'QUANTITY_AND_PRICE') {
      const combined = `${followUp.pendingEvent?.rawUserText || followUp.productName || 'Sale'} ${input}`;
      const resolvedSale = parseSaleStatement(combined, state);
      return resolvedSale;
    }
  }
}

  // 2. Primary: High-Precision Natural Language Understanding via Gemini API
  if (typeof window !== 'undefined' || process.env.TEST_API_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second client timeout ensures resilient AI responses

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

      // Normalize entities from Gemini conversation layer
      const entities = data.data.entities || {};
      const aiProductName = entities.productReference || data.data.productName;
      const aiIsService = Boolean(
        entities.isService ||
        data.data.isService ||
        (data.data.category && /service|salon|beauty|barbing|repair|cleaning|labor|tailoring/i.test(data.data.category))
      );
      const aiCategory = entities.category || data.data.category;
      const aiQuantity = entities.quantity !== undefined && entities.quantity !== null ? entities.quantity : (data.data.quantity || 1);
      const aiUnitPrice = entities.explicitUnitPrice !== undefined && entities.explicitUnitPrice !== null ? entities.explicitUnitPrice : data.data.unitPrice;
      const aiTotalAmount = entities.explicitTotalAmount !== undefined && entities.explicitTotalAmount !== null ? entities.explicitTotalAmount : data.data.totalAmount;
      const aiCustomerName = entities.customerReference || data.data.customerName;
      const aiCashPaid = entities.cashPaid !== undefined && entities.cashPaid !== null ? entities.cashPaid : data.data.cashPaid;
      const aiOutstandingDebt = entities.outstandingDebt !== undefined && entities.outstandingDebt !== null ? entities.outstandingDebt : data.data.outstandingDebt;
      const aiSupplierName = entities.supplierReference || data.data.supplierName;
      const aiExpenseAmount = entities.expenseAmount !== undefined && entities.expenseAmount !== null ? entities.expenseAmount : (aiTotalAmount || data.data.expenseAmount);
      const aiExpenseCategory = entities.expenseCategory || data.data.expenseCategory;
      const aiUnitCost = entities.explicitUnitCost || entities.productionCost || data.data.explicitUnitCost || data.data.productionCost;

      // Handle detected ambiguity from conversation understanding layer
      if (data.data.isAmbiguous && data.data.ambiguityQuestion) {
        return {
          isQuestion: false,
          followUpRequired: {
            id: `fu-${Date.now()}`,
            prompt: data.data.ambiguityQuestion,
            missingField: 'AMBIGUOUS_CHOICE',
            options: data.data.ambiguityOptions || [],
            pendingEvent: {
              rawUserText: input,
              quantity: aiQuantity || 1,
              type: 'SALE',
            },
            helperText: 'Select or reply with the exact product name.',
          },
          plainResponseText: data.data.ambiguityQuestion,
        };
      }

      // Handle explicit clarification requests from AI (e.g. missing amount or quantity)
      if (data.data.requiresClarification && data.data.clarificationPrompt) {
        return {
          isQuestion: false,
          followUpRequired: {
            id: `fu-${Date.now()}`,
            prompt: data.data.clarificationPrompt,
            missingField: 'REQUIRED_TRANSACTION_INFO',
            productName: aiProductName || undefined,
            customerName: aiCustomerName || undefined,
            pendingEvent: {
              rawUserText: input,
              productName: aiProductName || undefined,
              customerName: aiCustomerName || undefined,
            },
            helperText: 'Please provide the missing details to record this transaction accurately.',
          },
          plainResponseText: data.data.clarificationPrompt,
        };
      }

      // Safeguard: If AI classified as RECORD_SALE but no explicit price was stated (e.g. "I sold 3 clothes", "I sold 2 dresses", "I sold some rice")
      if (
        intent === 'RECORD_SALE' &&
        (!aiTotalAmount || aiTotalAmount <= 0) &&
        (!aiUnitPrice || aiUnitPrice <= 0) &&
        (!data.data.items || data.data.items.length <= 1)
      ) {
        const pName = aiProductName || extractProductName(input) || 'items';
        const matchedProd = matchKnownProduct(pName, state.products);
        if (matchedProd && matchedProd.normalSellingPrice && matchedProd.normalSellingPrice > 0) {
          // ACTIVE BUSINESS MEMORY AUTOMATICALLY RESOLVES PRICE!
          const qty = aiQuantity || 1;
          const uPrice = matchedProd.normalSellingPrice;
          const totRev = uPrice * qty;
          data.data.totalAmount = totRev;
          data.data.unitPrice = uPrice;
          data.data.productName = matchedProd.name;
          data.data.quantity = qty;
        } else {
          // Price is genuinely unknown in both message and memory -> ask intelligent follow-up
          let singularProd = (matchedProd ? matchedProd.name : pName).replace(/s$/i, '');
          if (pName.toLowerCase() === 'clothes') singularProd = 'cloth';
          const isKnownNoun = pName.toLowerCase() !== 'items' && pName.toLowerCase() !== 'item';
          const promptMsg = isKnownNoun
            ? `How much do you normally sell one ${singularProd.toLowerCase()} for?`
            : `How many ${pName.toLowerCase()} did you sell, and for how much?`;
          return {
            isQuestion: false,
            followUpRequired: {
              id: `fu-${Date.now()}`,
              prompt: promptMsg,
              missingField: isKnownNoun ? 'SELLING_PRICE' : 'QUANTITY_AND_PRICE',
              productName: matchedProd ? matchedProd.name : pName,
              customerName: aiCustomerName || undefined,
              pendingEvent: {
                rawUserText: input,
                productName: matchedProd ? matchedProd.name : pName,
                customerName: aiCustomerName || undefined,
                quantity: aiQuantity || 1,
                type: 'SALE',
              },
              helperText: isKnownNoun
                ? `Tell me the normal selling price. I'll calculate your total and remember it for future sales.`
                : 'Specify quantity and total amount or unit price to record this sale.',
            },
            plainResponseText: promptMsg,
          };
        }
      }

      // Safeguard: If AI classified as RECORD_CUSTOMER_PAYMENT but no amount was provided (e.g. "John paid me")
      if (
        intent === 'RECORD_CUSTOMER_PAYMENT' &&
        (!aiCashPaid || aiCashPaid <= 0) &&
        (!aiTotalAmount || aiTotalAmount <= 0)
      ) {
        const cName = aiCustomerName || extractCustomerName(input) || 'the customer';
        const promptMsg = `How much did ${cName} pay you?`;
        return {
          isQuestion: false,
          followUpRequired: {
            id: `fu-${Date.now()}`,
            prompt: promptMsg,
            missingField: 'PAYMENT_AMOUNT',
            customerName: cName,
            pendingEvent: {
              rawUserText: input,
              customerName: cName,
              type: 'DEBT_PAYMENT',
            },
            helperText: `Enter the payment amount received from ${cName} to credit their balance.`,
          },
          plainResponseText: promptMsg,
        };
      }

      if (intent === 'BUSINESS_QUESTION' || intent === 'GREETING_OR_HELP') {
        const directAnswer =
          data.data.conversationalAnswer ||
          data.data.clarificationPrompt ||
          (data.data.interpretationSummary && !data.data.interpretationSummary.toLowerCase().startsWith('the user is asking') ? data.data.interpretationSummary : null) ||
          answerBusinessQuestion(input, state);
        return {
          isQuestion: true,
          questionAnswer: directAnswer,
          plainResponseText: directAnswer,
        };
      }

      if ((intent === 'UNKNOWN' || intent === 'CLARIFICATION_NEEDED') && (data.data.conversationalAnswer || data.data.clarificationPrompt)) {
        const directAnswer = data.data.conversationalAnswer || data.data.clarificationPrompt;
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

      // Single sale from AI (e.g. "David bought 2 bags of rice for #130k but paid #78k" or "sold 3 power banks to emeka for 45k, he paid 30k remaining 15k as debts")
      if (
        intent === 'RECORD_SALE' &&
        (aiTotalAmount ||
          data.data.totalAmount ||
          (Array.isArray(data.data.items) && data.data.items[0]?.totalAmount) ||
          aiCashPaid !== undefined ||
          aiOutstandingDebt !== undefined)
      ) {
        const itemObj = Array.isArray(data.data.items) && data.data.items.length > 0 ? data.data.items[0] : null;
        const pName = itemObj?.productName || aiProductName || data.data.productName || 'Items';
        const prod = matchKnownProduct(pName, state.products) || {
          name: pName,
          currentCost: 0,
          normalSellingPrice: itemObj?.unitPrice || aiUnitPrice || data.data.unitPrice || 0,
        };

        const qty = itemObj?.quantity || aiQuantity || data.data.quantity || 1;
        let totalRev =
          itemObj?.totalAmount ||
          aiTotalAmount ||
          data.data.totalAmount ||
          ((itemObj?.unitPrice || aiUnitPrice || data.data.unitPrice || 0) * qty);

        const rawCash = itemObj?.cashPaid !== undefined ? itemObj.cashPaid : (aiCashPaid !== undefined ? aiCashPaid : data.data.cashPaid);
        const rawDebt = itemObj?.outstandingDebt !== undefined ? itemObj.outstandingDebt : (aiOutstandingDebt !== undefined ? aiOutstandingDebt : data.data.outstandingDebt);

        let cash = rawCash;
        let receivable = rawDebt;

        if (cash !== undefined && cash !== null && receivable !== undefined && receivable !== null && cash > 0 && receivable > 0) {
          totalRev = Math.max(totalRev || 0, cash + receivable);
        } else if (totalRev > 0 && cash !== undefined && cash !== null && (receivable === undefined || receivable === null)) {
          receivable = Math.max(0, totalRev - cash);
        } else if (totalRev > 0 && receivable !== undefined && receivable !== null && (cash === undefined || cash === null)) {
          cash = Math.max(0, totalRev - receivable);
        } else if ((!totalRev || totalRev <= 0) && cash !== undefined && cash !== null && receivable !== undefined && receivable !== null) {
          totalRev = cash + receivable;
        } else if (cash === undefined || cash === null) {
          cash = receivable !== undefined && receivable !== null ? Math.max(0, totalRev - receivable) : totalRev;
          receivable = receivable !== undefined && receivable !== null ? receivable : 0;
        } else if (receivable === undefined || receivable === null) {
          receivable = Math.max(0, totalRev - cash);
        }

        const unit = itemObj?.unit || data.data.unit || '';
        const custName = aiCustomerName || data.data.customerName || extractCustomerName(input);

        // Resolve unit cost accurately (wholesale bag vs retail bowl)
        const costRes = resolveProductCostForUnit(prod, unit, state);
        const unitCost = costRes.unitCost > 0 ? costRes.unitCost : (prod.currentCost || 0);

        // If product cost is unknown for an anonymous retail sale (e.g. "I sold 3 shirts for 6000"), ask intelligent follow-up
        const prodDisplayName = (prod && prod.name && prod.name.toLowerCase() !== 'items') ? prod.name : pName;
        const singularName = prodDisplayName.replace(/s$/i, '');
        const isGenericItem = prodDisplayName.toLowerCase() === 'item' || prodDisplayName.toLowerCase() === 'items';
        const isCustomerOrDeliverySale = Boolean(custName) || /\b(?:delivered|supplied|sent|dispatched|sewed|tailored|gave)\b/i.test(input);
        const isService = Boolean(
          aiIsService ||
          itemObj?.isService ||
          isServiceSemantic(prodDisplayName, input)
        );

        if (unitCost === 0 && !isGenericItem && !isCustomerOrDeliverySale && !isService) {
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

        const effectiveUnitCost = (aiUnitCost && aiUnitCost > 0)
          ? Math.round(aiUnitCost / qty)
          : (unitCost > 0 ? unitCost : 0);

        const effectiveTotalCost = effectiveUnitCost * qty;
        const effectiveGrossProfit = effectiveUnitCost > 0 ? (totalRev - effectiveTotalCost) : (isService ? totalRev : 0);

        const metrics = computeSaleMetrics({
          quantity: qty,
          totalRevenue: totalRev,
          cashReceived: cash,
          unitCostAtTime: effectiveUnitCost > 0 ? effectiveUnitCost : (isService ? 0 : (unitCost > 0 ? unitCost : undefined)),
          costIsEstimate: effectiveUnitCost > 0 ? false : (isService ? false : costRes.isEstimate),
          costEstimateBasis: effectiveUnitCost > 0 ? 'exact' : (isService ? 'service' : costRes.costBasis),
        });

        const memoryUpdates: MemoryUpdateItem[] = [];
        if (!state.products.some(p => p.name.toLowerCase() === prodDisplayName.toLowerCase())) {
          memoryUpdates.push({
            type: 'BUSINESS_RULE',
            summary: `Registered ${isService ? 'service' : 'product'}: ${prodDisplayName} (Normal rate: ${formatNaira(totalRev / qty)})`,
            data: {
              name: prodDisplayName,
              isService,
              defaultPrice: totalRev / qty,
            },
          });
        }
        if (receivable > 0 && custName) {
          memoryUpdates.push({
            type: 'CUSTOMER_DEBT',
            summary: `${custName} debt balance increased by ${formatNaira(receivable)}`,
            data: {
              customerName: custName,
              balanceAdded: receivable,
              date: todayStr,
              note: `Debt from ${isService ? 'service' : 'purchase'} of ${qty} ${unit ? `${unit} ` : ''}${prod.name}`,
            },
          });
        }

        // Check if this is a composite production sale (merchant spent money on materials/production to make an item and charged client)
        const isCompositeProdSale =
          intent === 'RECORD_COMPOSITE_PRODUCTION_SALE' ||
          (effectiveTotalCost > 0 && /\b(?:spent|used|cost|make|sew|produce|parts|materials|bake)\b/i.test(input));

        if (isCompositeProdSale && effectiveTotalCost > 0) {
          const expenseEv: BusinessEvent = ensureEventHeadlineAndSummary({
            id: `ev-exp-${Date.now()}-1`,
            timestamp: new Date().toISOString(),
            date: todayStr,
            timeStr,
            type: 'EXPENSE',
            rawUserText: input,
            systemResponseText: `Spent ${formatNaira(effectiveTotalCost)} to make ${prod.name} (Materials & Production Expense).`,
            expenseCategory: 'Procurement',
            expenseAmount: effectiveTotalCost,
            productName: prod.name,
            quantity: qty,
            totalCostAtTime: effectiveTotalCost,
            totalRevenue: 0,
            cashReceived: 0,
            headline: `Expense • Procurement`,
            summary: `Spent ${formatNaira(effectiveTotalCost)} to make ${prod.name}.`,
          });

          const saleEv: BusinessEvent = ensureEventHeadlineAndSummary({
            id: `ev-sale-${Date.now()}-2`,
            timestamp: new Date().toISOString(),
            date: todayStr,
            timeStr,
            type: 'SALE',
            rawUserText: input,
            systemResponseText: `Charged ${custName || 'Client'} ${formatNaira(totalRev)} for ${qty} ${prod.name}.`,
            productName: prod.name,
            customerName: custName || 'Client',
            quantity: qty,
            unit: unit || 'piece',
            unitSellingPrice: totalRev / qty,
            totalRevenue: totalRev,
            cashReceived: cash,
            receivableAdded: receivable,
            unitCostAtTime: 0,
            totalCostAtTime: 0,
            costIsEstimate: false,
            costEstimateBasis: 'exact',
            grossProfit: totalRev,
            headline: data.data.headline || `Sale • ${qty} ${prod.name}`,
            summary: data.data.summary || `Charged ${custName || 'Client'} ${formatNaira(totalRev)} for ${prod.name}.`,
          });

          const summaryText = `Got it. Recorded 2 transactions: Spent ${formatNaira(effectiveTotalCost)} on ${prod.name} production (Materials & Production Expense) and charged ${custName || 'Client'} ${formatNaira(totalRev)} (Sale). Net Profit: ${formatNaira(effectiveGrossProfit)}.`;

          return {
            isQuestion: false,
            createdEvent: saleEv,
            createdEvents: [expenseEv, saleEv],
            memoryUpdates: memoryUpdates.length > 0 ? memoryUpdates : undefined,
            memoryUpdate: memoryUpdates[0] ? (memoryUpdates[0] as any) : undefined,
            plainResponseText: summaryText,
          };
        }

        const ev: BusinessEvent = {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          date: todayStr,
          timeStr,
          type: 'SALE',
          rawUserText: input,
          systemResponseText: effectiveUnitCost > 0
            ? `Got it. Recorded sale of ${qty} ${prod.name} for ${formatNaira(totalRev)}. Production cost: ${formatNaira(effectiveTotalCost)}. Gross profit: ${formatNaira(effectiveGrossProfit)}.${cash < totalRev ? ` Paid: ${formatNaira(cash)}.${receivable > 0 ? ` ${custName ? custName : 'Customer'} still owes ${formatNaira(receivable)}.` : ''}` : ''}`
            : isService
            ? `Got it. Recorded ${prod.name} service for ${formatNaira(totalRev)}.${cash < totalRev ? ` Paid: ${formatNaira(cash)}.${receivable > 0 ? ` ${custName ? custName : 'Customer'} still owes ${formatNaira(receivable)}.` : ''}` : ''}`
            : `Got it. Sold ${qty} ${unit ? `${unit} ` : ''}${prod.name} for ${formatNaira(totalRev)}. Paid: ${formatNaira(cash)}.${receivable > 0 ? ` ${custName ? custName : 'Customer'} still owes ${formatNaira(receivable)}.` : ''}`,
          productName: prod.name,
          customerName: custName,
          quantity: qty,
          unit: unit || (isService ? 'service' : undefined),
          unitSellingPrice: totalRev / qty,
          totalRevenue: totalRev,
          cashReceived: cash,
          receivableAdded: receivable,
          unitCostAtTime: effectiveUnitCost > 0 ? effectiveUnitCost : (isService ? 0 : metrics.unitCostAtTime),
          totalCostAtTime: effectiveUnitCost > 0 ? effectiveTotalCost : (isService ? 0 : metrics.totalCostAtTime),
          costIsEstimate: effectiveUnitCost > 0 ? false : (isService ? false : metrics.costIsEstimate),
          costEstimateBasis: effectiveUnitCost > 0 ? 'exact' : (isService ? 'service' : metrics.costEstimateBasis),
          grossProfit: effectiveUnitCost > 0 ? effectiveGrossProfit : (isService ? totalRev : metrics.grossProfit),
          headline: data.data.headline || `Sale • ${qty} ${prod.name}`,
          summary: data.data.summary || (effectiveUnitCost > 0 ? `Sold for ${formatNaira(totalRev)}. Production cost: ${formatNaira(effectiveTotalCost)}. Gross profit: ${formatNaira(effectiveGrossProfit)}.` : undefined),
        };

        const finalEv = ensureEventHeadlineAndSummary(ev);

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
        const expCat = aiExpenseCategory || data.data.expenseCategory || detectExpenseCategory(input);
        const expAmt = aiExpenseAmount || data.data.expenseAmount || data.data.totalAmount || parseNairaAmount(input) || 0;
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
        const custName = aiCustomerName || data.data.customerName || extractCustomerName(input) || 'Customer';
        const payAmt = aiCashPaid || aiTotalAmount || data.data.cashPaid || data.data.totalAmount || parseNairaAmount(input) || 0;
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
        const custName = aiCustomerName || data.data.customerName || extractCustomerName(input) || 'Customer';
        const owedAmt = entities.outstandingDebt || aiTotalAmount || data.data.outstandingDebt || data.data.totalAmount || parseNairaAmount(input) || 0;
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
        const qty = aiQuantity || data.data.quantity || 1;
        const totalAmt = aiTotalAmount || aiExpenseAmount || data.data.totalAmount || parseNairaAmount(input) || 0;
        const supName = aiSupplierName || data.data.supplierName || 'Supplier';
        const prodName = aiProductName || data.data.productName || 'Stock';
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

      // Other conversational or informational intents from AI
      if (interpretation && !intent.startsWith('RECORD_')) {
        return {
          isQuestion: false,
          plainResponseText: interpretation,
        };
      }
    }
  } catch (err) {
    console.warn('[NLP Interpreter] Gemini interpretation fallback active:', err);
  }
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

  // 5. Customer Debt Payment ("Ada paid me 40k today", "Chuks paid 50k", "John paid me" - ONLY when not a product sale)
  const isSaleContext =
    lower.includes('bought') ||
    lower.includes('sold') ||
    lower.includes('purchase') ||
    lower.includes('supplied') ||
    lower.includes('delivered') ||
    lower.includes('installed') ||
    lower.includes('tailored') ||
    lower.includes('sewed') ||
    lower.includes('repaired') ||
    lower.includes('washed') ||
    lower.includes('charged') ||
    isServiceSemantic('', input) ||
    matchKnownProduct(lower, state.products) !== null;

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
    } else {
      // Amount is missing (e.g. "John paid me") - ask for it rather than guessing or ignoring
      const promptText = `How much did ${custName} pay you?`;
      return {
        isQuestion: false,
        followUpRequired: {
          id: `fu-${Date.now()}`,
          prompt: promptText,
          missingField: 'PAYMENT_AMOUNT',
          customerName: custName,
          pendingEvent: {
            rawUserText: input,
            type: 'DEBT_PAYMENT',
            customerName: custName,
          },
          helperText: `Enter the amount paid by ${custName} to credit their balance.`,
        },
        plainResponseText: promptText,
      };
    }
  }

  // 6. Customer Debt Owed ("Chuks is owing me 80k", "David owes me" - ONLY when not a product sale or partial payment)
  const isStandaloneDebt =
    !isSaleContext &&
    !lower.includes('remaining') &&
    !lower.includes('as debts') &&
    !lower.includes('as debt') &&
    !lower.includes('balance') &&
    (lower.includes('owing') || lower.includes('owes') || lower.includes('is in debt') || /\bdebt\b/i.test(lower));

  if (isStandaloneDebt) {
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
    } else {
      // Debt amount is missing (e.g. "David owes me")
      const promptText = `How much is ${custName} owing you?`;
      return {
        isQuestion: false,
        followUpRequired: {
          id: `fu-${Date.now()}`,
          prompt: promptText,
          missingField: 'DEBT_AMOUNT',
          customerName: custName,
          pendingEvent: {
            rawUserText: input,
            type: 'CUSTOMER_DEBT',
            customerName: custName,
          },
          helperText: `Enter the amount owed by ${custName} to update their debt record.`,
        },
        plainResponseText: promptText,
      };
    }
  }

  // 6.5. COMPOSITE PRODUCTION & CLIENT SALES (Merchant spent to make/produce and charged client):
  const fallbackComposite = parseCompositeProductionSale(input, state);
  if (fallbackComposite) {
    return fallbackComposite;
  }

  // 7. MERCHANT PURCHASES & EXPENSES ("I bought so and so", "Bought fuel 5k", "I bought 30 cartons from Musa at 12k each")
  // CRITICAL: When the merchant is buying, this is ALWAYS an OUTFLOW (Expense or Stock Purchase), NEVER A SALE!
  const merchantSpendingResult = parseMerchantExpenseOrPurchase(input, state);
  if (merchantSpendingResult) {
    return merchantSpendingResult;
  }

  const isMerchantBuying = isMerchantSpendingStatement(input, state.customers);

  // 8. SALES (Multi-item AND Single-item) - Evaluated strictly when NOT merchant buying!
  const multiFallback = !isMerchantBuying ? detectAndParseMultiItemSale(input, state) : null;
  if (multiFallback) return multiFallback;

  const isSaleStatement =
    !isMerchantBuying &&
    (isServiceSemantic('', input) ||
      lower.includes('sold') ||
      lower.includes('delivered') ||
      lower.includes('supplied') ||
      lower.includes('dispatched') ||
      lower.includes('sent') ||
      lower.includes('sewed') ||
      lower.includes('tailored') ||
      lower.includes('made') ||
      lower.includes('gave') ||
      /\b(?:delivered|supplied|dispatched|sent|sewed|tailored|made|gave)\b/i.test(lower) ||
      /\bto\s+[a-zA-Z]+\s+for\s+[₦#]?[0-9]+/i.test(lower) ||
      isCustomerBuyingStatement(input, state.customers) ||
      lower.includes('paid for') ||
      (lower.includes('took') && !lower.includes('took money') && !lower.includes('took from')) ||
      lower.includes('collected') ||
      lower.includes('each') ||
      lower.includes('at #') ||
      lower.includes('@') ||
      lower.includes('power bank') ||
      lower.includes('powerbank') ||
      lower.includes('charger') ||
      /\b(?:remaining|balance)\s+(?:[0-9.,]+[km]?)\s*(?:as\s+)?debts?\b/i.test(lower) ||
      matchKnownProduct(lower, state.products) !== null ||
      matchKnownCustomer(lower, state.customers) !== null ||
      /^[0-9]+\s*(?:bags?|bowls?|cartons?|bottles?|shirts?|shoes?|pairs?|pieces?|units?|items?|packs?|outfits?|gowns?|clothes?|dresses?|suits?|power\s*banks?|chargers?|phones?|braids?|wigs?)/i.test(input));

  if (isSaleStatement) {
    const saleResult = parseSaleStatement(input, state);
    return saleResult;
  }

  // 9. EXPENSES (Operating overheads)
  const isExplicitExpense =
    (lower.includes('spent') ||
      lower.startsWith('paid') ||
      lower.includes('expense') ||
      lower.includes('expenses') ||
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
    !lower.includes('sold') &&
    !lower.includes('paid me') &&
    matchKnownCustomer(lower, state.customers) === null;

  if (isExplicitExpense) {
    const cat = detectExpenseCategory(lower);
    // Specifically search for monetary amounts (#5k, ₦5,000, 15k, or following spent/paid/expense)
    const amtMatch =
      input.match(/(?:[₦#]\s*([0-9.,]+[km]?))/i) ||
      input.match(/([0-9.,]+[km])\b/i) ||
      input.match(/(?:spent|paid|expense\s+(?:of|for)?)\s*(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    const amt = (amtMatch ? parseNairaAmount(amtMatch[1]) : null) || parseNairaAmount(input) || 0;
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

  // Check product ambiguity (e.g. user says "I sold a dress" and there is "Ankara Dress" and "Corporate Dress")
  const extractedProd = extractProductName(input) || '';
  if (extractedProd) {
    const normExt = extractedProd.toLowerCase().replace(/s$/, '');
    const candidateMatches = state.products.filter((p) => {
      const pNorm = p.name.toLowerCase();
      return pNorm.includes(normExt) || pNorm.split(' ').includes(normExt);
    });
    if (candidateMatches.length > 1 && !candidateMatches.some((p) => lower.includes(p.name.toLowerCase()))) {
      const names = candidateMatches.map((c) => c.name).join(' or ');
      const promptMsg = `Which ${extractedProd.toLowerCase()} do you mean — ${names}?`;
      return {
        isQuestion: false,
        followUpRequired: {
          id: `fu-${Date.now()}`,
          prompt: promptMsg,
          missingField: 'AMBIGUOUS_CHOICE',
          options: candidateMatches.map((c) => c.name),
          pendingEvent: {
            rawUserText: input,
            quantity: 1,
            type: 'SALE',
          },
          helperText: 'Select or reply with the exact product name.',
        },
        plainResponseText: promptMsg,
      };
    }
  }

  // Extract target date from text or default to today
  const targetDate = extractDateFromText(input) || todayStr;
  const shouldNavigateToCalendar =
    lower.includes('calendar') || lower.includes('in my calendar') || lower.includes('change the input');

  // 2. Extract Quantity & Unit
  const parsedQty = extractSaleQuantity(input, state.products);
  let quantity = parsedQty.quantity;
  let unitMentioned = parsedQty.unit || '';

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
    const forMatch = input.match(/\bfor\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    if (forMatch) {
      totalRevenue = parseNairaAmount(forMatch[1]) || 0;
      unitPrice = totalRevenue / quantity;
    } else {
      // Look for explicit currency or k/m amount (e.g. "₦6000", "#150k", "50k", "2m", "6000 naira")
      const explicitAmtMatch = input.match(/(?:[₦#]\s*([0-9.,]+[km]?)|([0-9.,]+)\s*naira|\b([0-9.]+)\s*[km]\b)/i);
      if (explicitAmtMatch) {
        const amtStr = explicitAmtMatch[1] || explicitAmtMatch[2] || explicitAmtMatch[0];
        const parsed = parseNairaAmount(amtStr);
        if (parsed && parsed > 0) {
          totalRevenue = parsed;
          unitPrice = totalRevenue / quantity;
        }
      } else {
        // Look for a distinct second number that is NOT the quantity (e.g. "I sold 3 shirts 15000")
        const allNumMatches = [...input.matchAll(/\b([0-9.,]+)\b/g)];
        if (allNumMatches.length >= 2) {
          const nonQtyMatch = allNumMatches.find((m) => {
            const val = parseNairaAmount(m[1]);
            return val !== null && val !== quantity && val >= 50;
          });
          if (nonQtyMatch) {
            const parsed = parseNairaAmount(nonQtyMatch[1]);
            if (parsed && parsed > 0) {
              totalRevenue = parsed;
              unitPrice = totalRevenue / quantity;
            }
          }
        }
      }
    }
  }

  // Safeguard: If no revenue or price was specified in the sale statement (e.g. "I sold some rice", "I sold 2 dresses", "I sold 3 clothes")
  if (totalRevenue <= 0 && unitPrice <= 0) {
    if (product && product.normalSellingPrice && product.normalSellingPrice > 0) {
      // ACTIVE MEMORY RESOLVES PRICE AUTOMATICALLY!
      unitPrice = product.normalSellingPrice;
      totalRevenue = unitPrice * quantity;
    } else {
      const prodDisplayName = product ? product.name : (extractProductName(input) || 'items');
      const isKnownNoun = prodDisplayName.toLowerCase() !== 'items' && prodDisplayName.toLowerCase() !== 'item';
      let singularName = prodDisplayName.replace(/s$/i, '');
      if (prodDisplayName.toLowerCase() === 'clothes') {
        singularName = 'cloth';
      }

      const hasExplicitQuantity = /[0-9]+/.test(input) || /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(input);
      const isUncountable = ['rice', 'beans', 'garri', 'fuel', 'oil', 'flour', 'sugar', 'cement'].includes(prodDisplayName.toLowerCase());

      let promptText: string;
      let missingField: 'SELLING_PRICE' | 'QUANTITY_AND_PRICE';

      if (isUncountable) {
        promptText = `How many bags or bowls of ${prodDisplayName.toLowerCase()} did you sell, and for how much?`;
        missingField = 'QUANTITY_AND_PRICE';
      } else if (hasExplicitQuantity && isKnownNoun) {
        promptText = `How much do you normally sell one ${singularName.toLowerCase()} for?`;
        missingField = 'SELLING_PRICE';
      } else {
        const unitPart = unitMentioned || (product?.unit ? product.unit : '');
        if (unitPart) {
          promptText = `How many ${unitPart}s of ${prodDisplayName.toLowerCase()} did you sell, and for how much?`;
        } else {
          promptText = `How many ${prodDisplayName.toLowerCase()} did you sell, and for how much?`;
        }
        missingField = 'QUANTITY_AND_PRICE';
      }

      return {
        isQuestion: false,
        followUpRequired: {
          id: `fu-${Date.now()}`,
          prompt: promptText,
          missingField,
          productName: prodDisplayName,
          customerName: customerName || undefined,
          pendingEvent: {
            rawUserText: input,
            productName: prodDisplayName,
            customerName: customerName || undefined,
            quantity,
            type: 'SALE',
          },
          helperText: isKnownNoun
            ? `Tell me the normal selling price. I'll calculate your total and remember it for future sales.`
            : `Tell me how many you sold and the selling price or total amount to log this sale accurately.`,
        },
        plainResponseText: promptText,
      };
    }
  }

  // 4. Extract Cash Paid vs Debt:
  // A. Extract Debt Amount Mentioned (e.g. "owing me #12000", "remaining 15k as debts", "balance 15k", "owes 15k", "15k as debts", "will transfer 18k balance")
  let debtMentioned: number | null = null;
  const debtMatch =
    input.match(/(?:still\s+)?(?:owing|owes|is\s+owing)(?:\s+(?:me|us|shop|store))?\s*(?:of\s+)?(?:[₦#]?\s*([0-9.,]+[km]?))/i) ||
    input.match(/(?:remaining|balance|remains|left\s+with|debt\s+(?:of|is)?)\s*(?:of\s+)?(?:[₦#]?\s*([0-9.,]+[km]?))/i) ||
    input.match(/([0-9.,]+[km]?)\s*(?:as\s+)?debts?\b/i) ||
    input.match(/([0-9.,]+[km]?)\s*(?:remaining|balance|left)\b/i) ||
    input.match(/(?:will\s+transfer|will\s+pay|to\s+balance|to\s+pay\s+later)\s*(?:[₦#]?\s*([0-9.,]+[km]?))/i);
  if (debtMatch) {
    const dVal = parseNairaAmount(debtMatch[1]);
    if (dVal !== null && dVal > 0) {
      debtMentioned = dVal;
    }
  }

  // B. Extract Cash Paid / Received (e.g. "he paid 30k", "paid #68000", "received 15k cash", "paid 20,000 cash", "collected 15k", "she gave 20k")
  let cashMentioned: number | null = null;
  const cashMatch =
    input.match(/(?:he\s+paid|she\s+paid|they\s+paid|cash\s+paid|paid|received|collected|gives?|gave|brought|transferred|sent|deposited)\s*(?:[₦#]?\s*([0-9.,]+[km]?))/i) ||
    input.match(/([0-9.,]+[km]?)\s*(?:cash|upfront|down\s*payment|now|deposit)\b/i);
  if (cashMatch) {
    const cVal = parseNairaAmount(cashMatch[1]);
    if (cVal !== null && cVal > 0) {
      cashMentioned = cVal;
    }
  }

  // Check paid for quantity (e.g. "bought 5 but only paid for 3")
  const paidForQtyMatch = input.match(/paid\s+for\s+([0-9]+)/i);
  let paidForQty: number | null = null;
  if (paidForQtyMatch) {
    paidForQty = parseInt(paidForQtyMatch[1], 10);
  }

  // C. Reconcile totalRevenue, cashReceived, and receivableAdded:
  let cashReceived = totalRevenue;
  let receivableAdded = 0;

  if (cashMentioned !== null && debtMentioned !== null) {
    // Both cash and debt are explicit (e.g. "Alhaji bought 2 shirts, paid #68000, owing me #12000")
    totalRevenue = Math.max(totalRevenue, cashMentioned + debtMentioned);
    unitPrice = totalRevenue / quantity;
    cashReceived = cashMentioned;
    receivableAdded = debtMentioned;
  } else if (debtMentioned !== null) {
    // Debt is explicit (e.g. "3 power banks I sold to emeka for 45k, remaining 15k as debts")
    receivableAdded = debtMentioned;
    if (totalRevenue > 0) {
      cashReceived = Math.max(0, totalRevenue - receivableAdded);
    } else {
      totalRevenue = receivableAdded;
      cashReceived = 0;
      unitPrice = totalRevenue / quantity;
    }
  } else if (cashMentioned !== null) {
    // Cash is explicit (e.g. "Did hair braids for customer, received 15k cash" or "for 45k, he paid 30k")
    cashReceived = cashMentioned;
    if (totalRevenue > 0 && totalRevenue > cashReceived) {
      receivableAdded = totalRevenue - cashReceived;
    } else if (totalRevenue <= 0 || totalRevenue === cashReceived) {
      totalRevenue = cashReceived;
      receivableAdded = 0;
      unitPrice = totalRevenue / quantity;
    }
  } else if (paidForQty !== null) {
    cashReceived = paidForQty * unitPrice;
    receivableAdded = Math.max(0, totalRevenue - cashReceived);
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

  const isDeliveryOrCustomerSale = Boolean(customerName) || /\b(?:delivered|supplied|sent|dispatched|sewed|tailored|made|gave)\b/i.test(input);
  const isServiceOrPersonalLabour = isServiceSemantic(prodDisplayName, input);

  if (
    prodDisplayName.toLowerCase() === 'item' ||
    prodDisplayName.toLowerCase() === 'items' ||
    (isRateMultiplied && !product) ||
    isDeliveryOrCustomerSale ||
    isServiceOrPersonalLabour
  ) {
    const rateText = isRateMultiplied
      ? ` (${quantity} × ${formatNaira(unitPrice)} = ${formatNaira(totalRevenue)} total revenue)`
      : '';
    const actionVerb = /\bdelivered\b/i.test(input)
      ? 'delivery of'
      : /\bsupplied\b/i.test(input)
      ? 'supply of'
      : /\b(?:sewed|tailored|made)\b/i.test(input)
      ? 'custom order for'
      : 'sale of';
    const recipientText = customerName ? ` to ${customerName}` : '';
    let plainResponse = `Got it. Recorded ${actionVerb} ${quantity} ${prodDisplayName.toLowerCase()}${recipientText} for ${formatNaira(totalRevenue)} (${formatNaira(unitPrice)} each)${rateText}.`;
    if (receivableAdded > 0) {
      plainResponse += ` Paid: ${formatNaira(cashReceived)}. ${customerName || 'Customer'} still owes ${formatNaira(receivableAdded)}.`;
    }
    plainResponse += ` Added to your daily ledger and calendar.`;
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
      unit: unitMentioned || undefined,
      unitSellingPrice: unitPrice,
      totalRevenue,
      cashReceived,
      receivableAdded,
      unitCostAtTime: 0,
      totalCostAtTime: 0,
      grossProfit: totalRevenue,
    };

    const finalEvent = ensureEventHeadlineAndSummary(event);

    const memoryUpdates: MemoryUpdateItem[] = [
      {
        type: 'CALENDAR_UPDATE',
        summary: `Calendar updated for ${formatDateShort(targetDate)}: Sold ${quantity} ${prodDisplayName} for ${formatNaira(totalRevenue)}`,
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
          note: `Debt from delivery/purchase of ${quantity} ${unitMentioned || ''} ${prodDisplayName}`,
        },
      });
    }

    if (unitPrice > 0) {
      memoryUpdates.push({
        type: 'PRODUCT_PRICE',
        summary: `Normal selling price of ${prodDisplayName} recorded as ${formatNaira(unitPrice)}`,
        data: {
          productName: prodDisplayName,
          price: unitPrice,
          normalSellingPrice: unitPrice,
          date: targetDate,
          note: 'Recorded from customer transaction',
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

  // Otherwise, if cost is unknown for a named product, ask intelligent follow-up
  const pendingEvent: Partial<BusinessEvent> = {
    rawUserText: input,
    productName: prodDisplayName,
    customerName,
    quantity,
    unit: unitMentioned || undefined,
    unitSellingPrice: unitPrice,
    totalRevenue,
    cashReceived,
    receivableAdded,
  };

  const singularUnit = unitMentioned ? unitMentioned.replace(/s$/, '').toLowerCase() : '';
  const promptSubject = (singularUnit && singularUnit !== singularName.toLowerCase())
    ? singularUnit
    : (singularName.toLowerCase() === 'rice' ? 'bag of rice' : singularName.toLowerCase());
  const followUpPrompt = `How much does one ${promptSubject} normally cost you?`;

  const followUp: FollowUpQuestion = {
    id: `fu-${Date.now()}`,
    prompt: followUpPrompt,
    missingField: 'COST_PER_UNIT',
    productName: prodDisplayName,
    pendingEvent,
    helperText: `Tell me the cost (e.g. ₦1,500 or 1.5k), and I'll calculate your exact profit and remember it for future sales.`,
  };

  return {
    isQuestion: false,
    followUpRequired: followUp,
    plainResponseText: followUpPrompt,
  };
}

function matchKnownProduct(text: string, products: any[]) {
  if (!products || products.length === 0) return null;
  return matchProductFuzzy(text, products);
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
    .replace(/\s+(?:i\s+sold|sold|to\s+[a-zA-Z]+).*$/i, '')
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
    lower.includes('braid') || lower.includes('hair') || lower.includes('salon') ||
    lower.includes('barber') || lower.includes('barbing') || lower.includes('wig') ||
    lower.includes('styling') || lower.includes('makeup') || lower.includes('nail') ||
    lower.includes('beauty') || lower.includes('pedicure') || lower.includes('manicure') ||
    lower.includes('treatment')
  ) {
    return 'Salon & Beauty Services';
  }
  if (
    lower.includes('car wash') || lower.includes('mechanic') || lower.includes('alternator') ||
    lower.includes('brake pad') || lower.includes('oil change') || lower.includes('tyre') ||
    lower.includes('tire') || lower.includes('alignment') || lower.includes('auto repair')
  ) {
    return 'Automotive & Repairs';
  }
  if (
    lower.includes('plumbing') || lower.includes('electrician') || lower.includes('carpenter') ||
    lower.includes('painting') || lower.includes('cleaning') || lower.includes('dry clean') ||
    lower.includes('laundry') || lower.includes('installation') || lower.includes('repair')
  ) {
    return 'Home & Trades Services';
  }
  if (
    lower.includes('tailor') || lower.includes('sew') || lower.includes('agbada') ||
    lower.includes('senator') || lower.includes('alteration') || lower.includes('fashion design')
  ) {
    return 'Fashion & Tailoring Services';
  }
  if (
    lower.includes('photography') || lower.includes('photoshoot') || lower.includes('catering') ||
    lower.includes('tutoring') || lower.includes('consulting') || lower.includes('graphic design')
  ) {
    return 'Professional Services';
  }
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
    lower.includes('gadget') || lower.includes('headphone') || lower.includes('earphone') ||
    lower.includes('power bank') || lower.includes('powerbank')
  ) {
    return 'Electronics & Accessories';
  }
  return 'General Merchandise';
}

/**
 * Flexibly checks whether an item or transaction represents labor, service, styling,
 * or repairs across any merchant trade (meaning it has no unit procurement inventory cost).
 */
export function isServiceSemantic(prodName: string, text: string): boolean {
  const lowerProd = (prodName || '').toLowerCase();
  const lowerText = (text || '').toLowerCase();

  const cat = inferProductCategory(prodName);
  if (
    cat === 'Salon & Beauty Services' ||
    cat === 'Automotive & Repairs' ||
    cat === 'Home & Trades Services' ||
    cat === 'Fashion & Tailoring Services' ||
    cat === 'Professional Services'
  ) {
    return true;
  }

  // Verbs of service execution
  if (
    /\b(?:did|done|rendered|styled|braided|plait|plaited|washed|cleaned|repaired|repair|fixed|serviced|installed|tailored|sewed|barbed|cut|cooked|baked|catering|photographed|tutored|plumbed|maintained)\b/i.test(
      lowerText
    )
  ) {
    return true;
  }

  // Common service noun patterns
  const serviceKeywords = [
    'braid', 'braids', 'knotless', 'haircut', 'barbing', 'hair', 'styling',
    'makeup', 'nails', 'pedicure', 'manicure', 'treatment', 'wash', 'car wash',
    'repair', 'repairs', 'fixing', 'install', 'installation', 'tailoring', 'sewing',
    'service', 'catering', 'photography', 'shoot', 'cleaning', 'detailing', 'labour', 'labor',
    'mechanic', 'electrician', 'plumbing', 'consultation'
  ];

  for (const kw of serviceKeywords) {
    if (lowerProd.includes(kw) || lowerText.includes(kw)) {
      return true;
    }
  }

  return false;
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
  let debtOverride: number | null = null;

  for (const part of rawParts) {
    const pTrim = part.trim();
    if (!pTrim) continue;
    const pLower = pTrim.toLowerCase();

    // Check if this part is payment info (e.g. "he paid 50k", "David paid 100k", "received 15k cash", "collected 15k", "she gave 20k")
    const isPaymentPart =
      pLower.startsWith('paid') ||
      pLower.startsWith('he paid') ||
      pLower.startsWith('she paid') ||
      pLower.startsWith('they paid') ||
      pLower.startsWith('cash paid') ||
      pLower.startsWith('received') ||
      pLower.startsWith('collected') ||
      pLower.startsWith('she gave') ||
      pLower.startsWith('he gave') ||
      pLower.startsWith('brought') ||
      /\b(?:paid|received|collected|brought)\s+(?:[₦#]?\s*[0-9.,]+[km]?)/i.test(pLower) ||
      /\b([0-9.,]+[km]?)\s*cash\b/i.test(pLower);

    if (isPaymentPart) {
      const amtMatch = pTrim.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
      if (amtMatch) {
        cashPaidOverride = parseNairaAmount(amtMatch[1]);
      }
      continue;
    }

    // Check if this part is debt / balance / remaining (e.g. "remaining 15k as debts", "balance 15k", "owing 20k", "owes 10k")
    const isDebtPart =
      pLower.startsWith('remaining') ||
      pLower.startsWith('balance') ||
      pLower.startsWith('owing') ||
      pLower.startsWith('owes') ||
      pLower.startsWith('left with') ||
      pLower.startsWith('remains') ||
      pLower.includes('as debts') ||
      pLower.includes('as debt') ||
      /\b(?:remaining|balance|remains|owes|owing)\s*(?:of\s+)?(?:[₦#]?\s*[0-9.,]+[km]?)/i.test(pLower) ||
      /\b(?:will\s+transfer|will\s+pay)\b/i.test(pLower);

    if (isDebtPart) {
      const amtMatch = pTrim.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
      if (amtMatch) {
        debtOverride = parseNairaAmount(amtMatch[1]);
      }
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
          unitPrice = matchedProd.normalSellingPrice || 0;
          totalRev = qty * unitPrice;
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
  if (!customers || customers.length === 0) return null;
  const res = matchCustomerFuzzy(text, customers);
  return res.customer;
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
  // 1. Check title prefixes with names: "for Dr. Chidinma", "to Mama Ngozi", "from Pastor John"
  const titleMatch = text.match(/(?:to|from|for|with)\s+((?:Dr\.?|Mr\.?|Mrs\.?|Chief|Pastor|Mama|Papa|Sister|Brother)\s+[A-Za-z]+)/i);
  if (titleMatch) {
    const candidate = titleMatch[1].trim();
    const parts = candidate.split(/\s+/);
    if (parts.length >= 2 && !['for', 'to', 'from', 'with', 'at', 'each', 'cash', 'naira'].includes(parts[1].toLowerCase())) {
      return candidate;
    }
  }

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
    const invalid = ['i', 'we', 'he', 'she', 'they', 'you', 'it', 'my', 'the', 'a', 'an', 'today', 'yesterday', 'someone', 'customer', 'supplier', 'who', 'how', 'what', 'one', 'two', 'three', 'cash', 'naira', 'credit', 'balance', 'debts', 'debt'];
    if (!invalid.includes(name.toLowerCase())) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  return undefined;
}

function extractProductName(text: string): string | undefined {
  const lower = text.toLowerCase();

  // Known high-frequency service and merchant product phrases
  if (lower.includes('knotless braids') || lower.includes('knotless braid')) return 'Knotless Braids';
  if (lower.includes('hair treatment') || lower.includes('hair treatments')) return 'Hair Treatment';
  if (lower.includes('hair braids') || lower.includes('hair braid')) return 'Hair Braids';
  if (lower.includes('braids') || lower.includes('braid') || lower.includes('braided')) return 'Hair Braids';
  if (lower.includes('haircut') || lower.includes('barbing')) return 'Haircut';
  if (lower.includes('power banks') || lower.includes('power bank') || lower.includes('powerbank')) return 'Power Banks';
  if (lower.includes('phone chargers') || lower.includes('phone charger') || lower.includes('chargers') || lower.includes('charger')) return 'Chargers';
  if (lower.includes('earphones') || lower.includes('earphone') || lower.includes('headphones') || lower.includes('headphone')) return 'Headphones';

  // 1. Check patterns like "sold some rice", "delivered outfits", "bought some oil", "did hair braids"
  const verbMatch = text.match(
    /(?:sold|selling|sell|delivered|supplied|sent|dispatched|tailored|sewed|made|gave|bought|buy|did|done|rendered|styled|fixed|repaired|installed|braided|plait|plaited)\s+(?:some\s+|a\s+|an\s+|the\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i
  );
  if (verbMatch) {
    const candidate = verbMatch[1];
    const stopWords = ['to', 'for', 'from', 'at', 'yesterday', 'today', 'on', 'my', 'his', 'her', 'their', 'some'];
    const units = ['bowls', 'pieces', 'pairs', 'cartons', 'bottles', 'bags', 'carton', 'bag', 'bottle', 'piece', 'bowl', 'item', 'items'];
    if (!stopWords.includes(candidate.toLowerCase()) && !units.includes(candidate.toLowerCase())) {
      return candidate;
    }
    // If it was a unit (e.g. "sold bags of rice"), capture following word
    const ofUnitMatch = text.match(/(?:sold|delivered|supplied|bought)\s+(?:some\s+)?[a-zA-Z]+\s+(?:of\s+)?([a-zA-Z]+)/i);
    if (ofUnitMatch && !stopWords.includes(ofUnitMatch[1].toLowerCase())) {
      return ofUnitMatch[1];
    }
  }

  // 2. Check numbered multi-word patterns first like "2 native outfits", "3 power banks"
  const multiWordMatch = text.match(/[0-9]+\s+([a-zA-Z]+\s+[a-zA-Z]+)(?:\s+(?:to|for|at|from|with|\b)|$)/i);
  if (multiWordMatch) {
    const candidate = multiWordMatch[1].trim();
    const parts = candidate.split(/\s+/);
    const stopWords = ['to', 'for', 'from', 'at', 'each', 'yesterday', 'today', 'cash', 'naira'];
    const units = ['bowls', 'pieces', 'pairs', 'cartons', 'bottles', 'bags', 'carton', 'bag', 'bottle', 'piece', 'bowl'];
    if (
      parts.length === 2 &&
      !stopWords.includes(parts[1].toLowerCase()) &&
      !units.includes(parts[0].toLowerCase())
    ) {
      return candidate;
    }
  }

  // 3. Check numbered single-word pattern like "2 outfits", "3 shirts", "30 cartons of drinks"
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
  if (
    lower.includes('generator') ||
    lower.includes('light') ||
    lower.includes('electric') ||
    lower.includes('nepa') ||
    lower.includes('power') ||
    lower.includes('bill') ||
    lower.includes('water')
  ) {
    return 'Utilities';
  }
  if (
    lower.includes('transport') ||
    lower.includes('fuel') ||
    lower.includes('bus') ||
    lower.includes('moving') ||
    lower.includes('dispatch') ||
    lower.includes('rider') ||
    lower.includes('fare') ||
    lower.includes('okada') ||
    lower.includes('keke') ||
    lower.includes('logistics')
  ) {
    return 'Transportation';
  }
  if (lower.includes('shop rent') || lower.includes('stall rent') || lower.includes('space rent') || /\brent\b/.test(lower)) {
    return 'Rent';
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
  followUpRequired?: FollowUpQuestion;
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

  // 0a. CHECK FOR COMPOSITE PRODUCTION & CLIENT SALES IN CHAT:
  // e.g. "I spent #64000 to make a dress and charged the client #79000"
  const chatComposite = parseCompositeProductionSale(question, state);
  if (chatComposite && (chatComposite.createdEvents || chatComposite.createdEvent)) {
    return {
      answer: chatComposite.plainResponseText,
      createdEvent: chatComposite.createdEvent,
      createdEvents: chatComposite.createdEvents,
      memoryUpdates: chatComposite.memoryUpdates,
      targetCalendarDate: chatComposite.targetCalendarDate,
    };
  }

  // 0b. CHECK FOR MERCHANT PURCHASES, OUTFLOWS & EXPENSES IN CHAT:
  // e.g. "I bought so and so for 15k", "I bought fuel 5000", "Spent 10k on transport", "Paid shop rent"
  const isMerchantExpenseOrPurchase = isMerchantSpendingStatement(question, state.customers);

  if (isMerchantExpenseOrPurchase) {
    const merchRes = parseMerchantExpenseOrPurchase(question, state);
    if (merchRes && (merchRes.createdEvent || merchRes.createdEvents || merchRes.followUpRequired)) {
      return {
        answer: merchRes.plainResponseText,
        createdEvent: merchRes.createdEvent,
        createdEvents: merchRes.createdEvents,
        memoryUpdates: merchRes.memoryUpdates,
        targetCalendarDate: merchRes.targetCalendarDate || merchRes.createdEvent?.date,
      };
    }
  }

  // 0b. CHECK FOR MULTI-ITEM SALES OR SALE STATEMENTS IN CHAT:
  // e.g. "I sold 1 bag of rice, 3 bottles of coke", "2 bags of rice at #58,000 each and 3 bottles of coke at #400 each"
  const multiSale = !isMerchantExpenseOrPurchase ? detectAndParseMultiItemSale(question, state) : null;
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
    !isMerchantExpenseOrPurchase &&
    (lower.includes('sold') ||
      isCustomerBuyingStatement(question, state.customers) ||
      lower.includes('bags of') ||
      lower.includes('bowls of') ||
      lower.includes('at #') ||
      lower.includes('@') ||
      lower.includes('each'))
  ) {
    const saleRes = parseSaleStatement(question, state);
    if (saleRes.followUpRequired) {
      return {
        answer: saleRes.followUpRequired.prompt,
        followUpRequired: saleRes.followUpRequired,
      };
    }
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

  // 0d. DEBTOR INQUIRIES & QUESTIONS ("Who owes me money?", "Who are those owing me?", "Who is owing?", "List debtors", "Total debt"):
  const isDebtorInquiry =
    (/\b(?:who|which\s+customers?|list|show|check|tell\s+me\s+who|how\s+many|anybody|anyone)\b/i.test(lower) &&
      /\b(?:owes?|owing|debtors?|debts?|unpaid|balance)\b/i.test(lower)) ||
    lower.includes('who owes') ||
    lower.includes('who is owing') ||
    lower.includes('who are those owing') ||
    lower.includes('who is owing me') ||
    lower.includes('who has not paid') ||
    lower.includes('list of debtors') ||
    lower.includes('debtors list') ||
    lower.includes('customers owing') ||
    lower.includes('total debt') ||
    lower.includes('how much debt') ||
    lower.includes('how much are customers owing');

  if (isDebtorInquiry) {
    const debtors = state.customers
      .filter((c) => (c.outstandingBalance || 0) > 0)
      .sort((a, b) => (b.outstandingBalance || 0) - (a.outstandingBalance || 0));

    if (debtors.length === 0) {
      return {
        answer: 'Nobody is currently owing you money! All customer accounts are fully settled.',
      };
    }

    const totalOwing = debtors.reduce((sum, d) => sum + (d.outstandingBalance || 0), 0);
    const breakdown = debtors.map((d) => `${d.name} owes ${formatNaira(d.outstandingBalance || 0)}`).join(', ');

    if (lower.includes('the most')) {
      const top = debtors[0];
      return {
        answer: `${top.name} owes you the most at ${formatNaira(
          top.outstandingBalance || 0
        )}. In total, customers owe you ${formatNaira(totalOwing)} (${breakdown}).`,
      };
    }

    return {
      answer: `You have ${formatNaira(totalOwing)} in outstanding customer payments. Here is who owes you: ${breakdown}.`,
    };
  }

  // 0e. SALES INQUIRIES & QUESTIONS ("How much did I sell today?", "What are my sales today?", "Sales today"):
  const isTodaySalesInquiry =
    (lower.includes('sell today') ||
      lower.includes('sales today') ||
      lower.includes('sold today') ||
      lower.includes('made today in sales') ||
      lower.includes('how much did i sell today') ||
      lower.includes('what are my sales today') ||
      lower.includes('how much have i sold') ||
      lower.includes('total sales today')) &&
    !lower.startsWith('i sold');

  if (isTodaySalesInquiry) {
    const todaySales = todayEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.totalRevenue || 0 : 0), 0);
    const todaySalesCount = todayEvents.filter((e) => e.type === 'SALE').length;
    if (todaySales === 0) {
      return {
        answer: 'You have not recorded any sales for today yet.',
      };
    }
    return {
      answer: `Today you have recorded ${formatNaira(todaySales)} in sales across ${todaySalesCount} transaction${todaySalesCount !== 1 ? 's' : ''}.`,
    };
  }

  const isYesterdaySalesInquiry =
    lower.includes('sell yesterday') ||
    lower.includes('sales yesterday') ||
    lower.includes('sold yesterday') ||
    lower.includes('how much did i sell yesterday');

  if (isYesterdaySalesInquiry) {
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yStr = yDate.toISOString().split('T')[0];
    const yEvents = state.events.filter((e) => e.date === yStr && !e.isCorrected);
    const ySales = yEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.totalRevenue || 0 : 0), 0);
    const ySalesCount = yEvents.filter((e) => e.type === 'SALE').length;
    if (ySales === 0) {
      return {
        answer: 'You have no sales recorded for yesterday.',
      };
    }
    return {
      answer: `Yesterday you recorded ${formatNaira(ySales)} in sales across ${ySalesCount} transaction${ySalesCount !== 1 ? 's' : ''}.`,
    };
  }

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
    } else {
      return {
        answer: `How much is ${activeCustomer.name} owing you?`,
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
    } else {
      return {
        answer: `How much did ${activeCustomer.name} pay you?`,
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
    let hasKnownCost = false;
    for (const e of todayEvents) {
      if (e.type === 'SALE') {
        sales += e.totalRevenue || 0;
        if (e.totalCostAtTime && e.totalCostAtTime > 0) {
          cost += e.totalCostAtTime;
          hasKnownCost = true;
        }
      } else if (e.type === 'EXPENSE') {
        exp += e.expenseAmount || 0;
      }
    }
    if (sales === 0 && exp === 0) {
      return {
        answer: 'You have not recorded any sales or operating expenses for today yet.',
      };
    }
    if (!hasKnownCost && sales > 0) {
      return {
        answer: `Today you recorded ${formatNaira(sales)} in sales and ${formatNaira(exp)} in operating expenses. Because product cost prices were not recorded for these sales, exact gross profit cannot be calculated yet without your cost of goods.`,
      };
    }
    const gross = sales - cost;
    const net = gross - exp;
    return {
      answer: `Today you made an estimated ${formatNaira(gross)} gross profit from ${formatNaira(
        sales
      )} in sales (cost of goods: ${formatNaira(cost)}). After deducting ${formatNaira(exp)} in operating expenses, your net take-home for today is ${formatNaira(
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

  // 20. Greetings & Friendly Chit-chat
  if (/^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|how\s+far|kedu|yo|greetings)\b/i.test(lower.trim())) {
    const todaySales = todayEvents.reduce((acc, e) => acc + (e.totalRevenue || 0), 0);
    const debtorCount = state.customers.filter((c) => (c.outstandingBalance || 0) > 0).length;
    return {
      answer: `Hello! I'm Karra, your AI business assistant. Today you have recorded ${formatNaira(todaySales)} in sales across ${todayEvents.length} transactions${debtorCount > 0 ? `, with ${debtorCount} customer${debtorCount > 1 ? 's' : ''} currently owing` : ''}. Tell me what you'd like to do — record a sale, log an expense, or ask any question about your store!`,
    };
  }

  // 21. System Capabilities & Help ("What can you do?", "How does this work?", "Help")
  if (
    lower.includes('what can you do') ||
    lower.includes('how do you work') ||
    lower.includes('how does this work') ||
    lower.includes('how to use') ||
    lower.includes('who are you') ||
    lower.includes('what is karra') ||
    lower.includes('features') ||
    lower.trim() === 'help' ||
    lower.startsWith('help me')
  ) {
    return {
      answer: `I am Karra, your AI business partner for running your store effortlessly! You can speak or type to me in plain words to:\n• Record sales or services (e.g. "Sold 3 bags of rice to Emeka for 45k" or "Did hair braiding for 15k")\n• Log business expenses (e.g. "Spent ₦4,000 on generator fuel")\n• Track customer debts & payments (e.g. "Amaka paid ₦20,000" or "Who owes me money?")\n• Ask questions about your profits, product margins, and stock anytime.`,
    };
  }

  // 22. Business Overview / Performance Summary ("How is business?", "Summary", "Overview")
  if (
    lower.includes('how is business') ||
    lower.includes('store summary') ||
    lower.includes('business summary') ||
    lower.includes('overview') ||
    lower.includes('performance') ||
    lower.includes('daily report')
  ) {
    const todaySales = todayEvents.reduce((acc, e) => acc + (e.totalRevenue || 0), 0);
    const todayGross = todayEvents.reduce((acc, e) => acc + (e.grossProfit || 0), 0);
    const todayExp = todayEvents.reduce((acc, e) => acc + (e.expenseAmount || 0), 0);
    const totalDebts = state.customers.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0);
    return {
      answer: `Here is your current store summary:\n• Today's Sales: ${formatNaira(todaySales)} (${todayEvents.length} transactions)\n• Estimated Gross Profit: ${formatNaira(todayGross)}\n• Today's Expenses: ${formatNaira(todayExp)}\n• Uncollected Customer Debts: ${formatNaira(totalDebts)}\n• Products in Catalog: ${state.products.length} products.`,
    };
  }

  // 23. Inventory / Stock Inquiry
  if (
    lower.includes('what products') ||
    lower.includes('list products') ||
    lower.includes('my inventory') ||
    lower.includes('what stock') ||
    lower.includes('show products')
  ) {
    if (state.products.length === 0) {
      return {
        answer: "You don't have any products recorded in your catalog yet. You can tell me about what you sell (e.g. 'I sell bags of rice for ₦58,000 and cost is ₦50,000').",
      };
    }
    const list = state.products
      .slice(0, 6)
      .map(
        (p) =>
          `• ${p.name}: Selling for ${p.normalSellingPrice ? formatNaira(p.normalSellingPrice) : 'price not set'}${p.currentStock !== undefined ? ` (${p.currentStock} in stock)` : ''}`
      )
      .join('\n');
    return {
      answer: `Here are the products currently in your store memory:\n${list}${state.products.length > 6 ? `\n...and ${state.products.length - 6} more.` : ''}`,
    };
  }

  // 24. Intelligent, Warm Conversational Fallback
  const todaySales = todayEvents.reduce((acc, e) => acc + (e.totalRevenue || 0), 0);
  const contextNote = activeCustomer ? ` (active customer context: ${activeCustomer.name})` : '';
  return {
    answer: `I'm listening! Today you've recorded ${formatNaira(todaySales)} in sales${contextNote}. You can tell me to record a sale or expense (e.g. 'Sold 2 shirts for ₦10,000 to Emeka'), note a debt, or ask about your sales, debts, and profits.`,
  };
}

/**
 * Deterministically answers business questions using stored ledger and memory (string wrapper)
 */
export function answerBusinessQuestion(question: string, state: BusinessState, chatHistory?: any[]): string {
  const res = answerBusinessQuestionWithMemory(question, state, chatHistory);
  return res.answer;
}
