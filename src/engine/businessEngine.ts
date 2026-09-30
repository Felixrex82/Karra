import {
  BusinessState,
  BusinessEvent,
  BusinessEventType,
  CustomerMemory,
  ProductMemory,
  SupplierMemory,
  BusinessRule,
  UnitRelationship,
  MemoryUpdateItem,
  AuditRecord,
  ExpenseCategory,
} from '../types';
import { getTodayDateStr, formatDateShort } from '../utils/dateUtils';
import { reconcileCustomerBalances, formatNaira } from './calculations';
import { ensureEventHeadlineAndSummary } from './eventSummarizer';

export type ActionIntent =
  | 'CREATE_SALE'
  | 'RECORD_EXPENSE'
  | 'RECORD_PURCHASE'
  | 'RECORD_PAYMENT'
  | 'RECORD_DEBT'
  | 'CORRECT_EVENT'
  | 'DELETE_EVENT'
  | 'DELETE_PRODUCT'
  | 'DELETE_CUSTOMER'
  | 'UPDATE_PRODUCT'
  | 'RECORD_RETURN_REFUND'
  | 'RECORD_OWNER_DRAWING'
  | 'RECORD_CAPITAL_INJECTION'
  | 'REMEMBER_FACT'
  | 'FORGET_FACT'
  | 'RETRIEVAL_ONLY';

export interface ActionItemDetail {
  productOrServiceName: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalAmount?: number;
  cashReceived?: number;
  unitCost?: number;
}

export interface StructuredBusinessAction {
  id?: string;
  intent: ActionIntent;
  confidence?: number;
  date?: string;
  timeStr?: string;
  rawUserText?: string;
  
  // Entities
  productOrServiceName?: string;
  itemType?: 'product' | 'service' | 'non_inventory';
  customerName?: string;
  supplierName?: string;
  quantity?: number;
  unit?: string;
  
  // Multi-item sales support
  items?: ActionItemDetail[];
  
  // Financial terms (all in NGN)
  unitPrice?: number;
  totalAmount?: number;
  cashReceived?: number;
  outstandingBalance?: number;
  expenseCategory?: ExpenseCategory;
  
  // Targets for mutation
  targetEventId?: string;
  targetEntityName?: string;
  targetDescription?: string;
  correctionChanges?: {
    quantity?: number;
    totalAmount?: number;
    cashReceived?: number;
    unitPrice?: number;
    date?: string;
    note?: string;
  };
  
  // Memory directives
  memoryUpdate?: MemoryUpdateItem;
  memoryUpdates?: MemoryUpdateItem[];
  memoryToRemove?: {
    type: 'RULE' | 'CUSTOMER_NOTE' | 'SUPPLIER_INFO' | 'FACT';
    targetName?: string;
    summaryText?: string;
  };
}

export interface ExecutionResult {
  success: boolean;
  actionId: string;
  intent: ActionIntent;
  newState: BusinessState;
  createdEvent?: BusinessEvent;
  createdEvents?: BusinessEvent[];
  correctedEvent?: BusinessEvent;
  deletedEventId?: string;
  deletedProductId?: string;
  deletedCustomerId?: string;
  memoryUpdates?: MemoryUpdateItem[];
  auditRecord?: AuditRecord;
  message: string;
  error?: string;
}

/**
 * Standard Levenshtein distance for fuzzy matching
 */
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
 * Match customer with tolerance for typos and colloquial spelling (e.g. "Chukz" -> "Chuks")
 */
export function matchCustomerFuzzy(
  text: string,
  customers: CustomerMemory[]
): { customer: CustomerMemory | null; isAmbiguous: boolean; ambiguousCandidates?: string[] } {
  const lower = text.toLowerCase();

  // 1. Exact substring match
  for (const c of customers) {
    if (lower.includes(c.name.toLowerCase())) {
      return { customer: c, isAmbiguous: false };
    }
  }

  // 2. Token-level fuzzy match
  // Exclude common Nigerian commerce/English words so words like 'paid', 'banks', 'spent' never match customer names
  const COMMON_COMMERCE_WORDS = new Set([
    'paid', 'pays', 'paying', 'spent', 'spend', 'spending', 'bought', 'buying',
    'sold', 'sells', 'selling', 'debt', 'debts', 'owes', 'owing', 'owed',
    'bank', 'banks', 'power', 'item', 'items', 'cost', 'costs', 'price', 'prices',
    'cash', 'give', 'gives', 'gave', 'giving', 'took', 'take', 'takes', 'taking',
    'with', 'from', 'that', 'this', 'they', 'them', 'have', 'done', 'doing',
    'will', 'some', 'good', 'said', 'sent', 'send', 'carton', 'bottle', 'piece',
    'pair', 'bags', 'bag', 'bowl', 'bowls', 'today', 'yesterday', 'tomorrow',
    'daily', 'month', 'week', 'year', 'sale', 'sales', 'shop', 'store', 'market',
    'fuel', 'rent', 'light', 'bill', 'unit', 'units', 'each', 'rate', 'much',
    'many', 'more', 'less', 'total', 'card', 'pos', 'transfer', 'balance', 'remain',
    'remaining', 'remains', 'received', 'collected', 'account', 'invoice', 'order'
  ]);

  const tokens = lower.match(/[a-z]{3,}/g) || [];
  const candidates: { customer: CustomerMemory; distance: number }[] = [];

  for (const token of tokens) {
    if (COMMON_COMMERCE_WORDS.has(token)) continue;
    for (const c of customers) {
      const cName = c.name.toLowerCase();
      const dist = levenshteinDistance(token, cName);
      // For short names (<=4 chars), only allow 1 edit distance; for 5+ allow up to 2
      const maxDist = cName.length <= 4 || token.length <= 4 ? 1 : 2;
      if (dist <= maxDist && Math.abs(token.length - cName.length) <= 1) {
        if (!candidates.some((cand) => cand.customer.id === c.id)) {
          candidates.push({ customer: c, distance: dist });
        }
      }
    }
  }

  if (candidates.length === 1) {
    return { customer: candidates[0].customer, isAmbiguous: false };
  } else if (candidates.length > 1) {
    candidates.sort((a, b) => a.distance - b.distance);
    if (candidates[0].distance < candidates[1].distance) {
      return { customer: candidates[0].customer, isAmbiguous: false };
    }
    return {
      customer: null,
      isAmbiguous: true,
      ambiguousCandidates: candidates.map((c) => c.customer.name),
    };
  }

  return { customer: null, isAmbiguous: false };
}

/**
 * Match product name flexibly from known products in state
 */
export function matchProductFuzzy(text: string, products: ProductMemory[]): ProductMemory | null {
  const lower = text.toLowerCase();
  // 1. Exact substring
  for (const p of products) {
    if (lower.includes(p.name.toLowerCase())) {
      return p;
    }
  }

  // 2. Word token match
  const tokens = lower.match(/[a-z]{3,}/g) || [];
  for (const token of tokens) {
    for (const p of products) {
      const pName = p.name.toLowerCase();
      if (pName.includes(token) || levenshteinDistance(token, pName) <= 1) {
        return p;
      }
    }
  }

  return null;
}

function parseAmountHelper(text: string): number | null {
  if (!text) return null;
  const match = text.match(/(?:[₦#]?\s*([0-9.,]+))\s*([km])?\b/i);
  if (!match) return null;
  let val = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(val)) return null;
  if (match[2]?.toLowerCase() === 'k') val *= 1000;
  if (match[2]?.toLowerCase() === 'm') val *= 1000000;
  return val;
}

/**
 * Resolves target event from user natural references:
 * e.g. "the second one", "the last transaction", "the rice sale", "the 10k expense", "that sale to David"
 */
export function findTargetEvent(
  state: BusinessState,
  targetQuery?: string,
  targetId?: string
): BusinessEvent | null {
  const activeEvents = state.events.filter((e) => !e.isCorrected);
  if (activeEvents.length === 0) return null;

  if (targetId && targetId !== 'last' && targetId !== 'recent') {
    const byId = activeEvents.find((e) => e.id === targetId);
    if (byId) return byId;
  }

  if (!targetQuery || targetQuery.trim() === '') {
    return activeEvents[0] || null;
  }

  const lower = targetQuery.toLowerCase().trim();

  // Explicit relative ordinal references
  if (lower.includes('second') || lower.includes('2nd')) {
    return activeEvents[1] || activeEvents[0] || null;
  }
  if (lower.includes('third') || lower.includes('3rd')) {
    return activeEvents[2] || activeEvents[0] || null;
  }
  if (lower.includes('fourth') || lower.includes('4th')) {
    return activeEvents[3] || activeEvents[0] || null;
  }
  if (lower.includes('first') || lower.includes('1st')) {
    return activeEvents[0] || null;
  }

  // Explicit recent references
  if (
    lower.includes('last') ||
    lower.includes('recent') ||
    lower.includes('latest') ||
    lower === 'that' ||
    lower === 'it' ||
    lower.includes('just recorded') ||
    lower.includes('just added')
  ) {
    if (lower.includes('expense')) {
      return activeEvents.find((e) => e.type === 'EXPENSE') || null;
    }
    if (lower.includes('sale')) {
      return activeEvents.find((e) => e.type === 'SALE') || null;
    }
    if (lower.includes('payment')) {
      return activeEvents.find((e) => e.type === 'DEBT_PAYMENT') || null;
    }
    return activeEvents[0] || null;
  }

  // Monetary Amount match: e.g. "the 10k expense", "25000", "sale of 15k"
  const targetAmt = parseAmountHelper(lower);
  if (targetAmt && targetAmt > 0) {
    const byAmt = activeEvents.find((e) => {
      const rev = e.totalRevenue || 0;
      const exp = e.expenseAmount || 0;
      const cash = e.cashReceived || 0;
      return rev === targetAmt || exp === targetAmt || cash === targetAmt;
    });
    if (byAmt) return byAmt;
  }

  // Customer reference
  const custMatch = matchCustomerFuzzy(lower, state.customers);
  if (custMatch.customer) {
    const custEv = activeEvents.find(
      (e) => e.customerName?.toLowerCase() === custMatch.customer!.name.toLowerCase()
    );
    if (custEv) return custEv;
  }

  // Product reference in an event
  const prodMatch = matchProductFuzzy(lower, state.products);
  if (prodMatch) {
    const prodEv = activeEvents.find(
      (e) => e.productName?.toLowerCase() === prodMatch.name.toLowerCase()
    );
    if (prodEv) return prodEv;
  }

  // Type-specific references
  if (lower.includes('expense')) {
    return activeEvents.find((e) => e.type === 'EXPENSE') || null;
  }
  if (lower.includes('payment') || lower.includes('debt payment')) {
    return activeEvents.find((e) => e.type === 'DEBT_PAYMENT') || null;
  }
  if (lower.includes('purchase') || lower.includes('stock')) {
    return activeEvents.find((e) => e.type === 'PURCHASE_STOCK') || null;
  }
  if (lower.includes('sale')) {
    return activeEvents.find((e) => e.type === 'SALE') || null;
  }

  // If specific target terms were given but did not match any event, return null
  return null;
}

/**
 * Deterministically executes a validated business action on authoritative business state.
 * Preserves historical costs, reconciles customer debts, logs audit records, and ensures tenant data integrity.
 */
export function executeBusinessAction(
  action: StructuredBusinessAction,
  currentState: BusinessState
): ExecutionResult {
  const actionId = action.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const todayStr = getTodayDateStr();
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const eventDate = action.date || todayStr;

  try {
    switch (action.intent) {
      case 'CREATE_SALE': {
        // Multi-item sales support
        if (action.items && action.items.length > 1) {
          const eventsToAdd: BusinessEvent[] = [];
          let updatedProducts = [...currentState.products];
          let updatedCustomers = [...currentState.customers];
          let totalCombinedRev = 0;
          let totalCombinedCash = 0;
          let totalCombinedDebt = 0;

          for (let idx = 0; idx < action.items.length; idx++) {
            const it = action.items[idx];
            const itemName = (it.productOrServiceName || 'Item').trim();
            const qty = Math.max(1, it.quantity || 1);
            const unit = it.unit || 'piece';
            
            const existingProd = currentState.products.find(
              (p) => p.name.toLowerCase() === itemName.toLowerCase()
            );

            let unitPrice = it.unitPrice || 0;
            let itTotal = it.totalAmount || 0;
            if (itTotal > 0 && unitPrice === 0) {
              unitPrice = Math.round(itTotal / qty);
            } else if (unitPrice > 0 && itTotal === 0) {
              itTotal = unitPrice * qty;
            } else if (unitPrice === 0 && itTotal === 0) {
              unitPrice = existingProd?.normalSellingPrice || 0;
              itTotal = unitPrice * qty;
            }

            const itCash = it.cashReceived !== undefined ? it.cashReceived : itTotal;
            const itDebt = Math.max(0, itTotal - itCash);
            const unitCost = it.unitCost !== undefined ? it.unitCost : (existingProd?.currentCost || 0);
            const totalCost = unitCost * qty;
            const grossProfit = itTotal - totalCost;

            totalCombinedRev += itTotal;
            totalCombinedCash += itCash;
            totalCombinedDebt += itDebt;

            const ev: BusinessEvent = ensureEventHeadlineAndSummary({
              id: `ev-sale-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              date: eventDate,
              timeStr: action.timeStr || timeNow,
              type: 'SALE',
              rawUserText: action.rawUserText || `Sold ${qty} ${unit} of ${itemName}`,
              systemResponseText: '',
              productName: itemName,
              customerName: action.customerName || undefined,
              quantity: qty,
              unit,
              unitSellingPrice: unitPrice,
              totalRevenue: itTotal,
              cashReceived: itCash,
              receivableAdded: itDebt,
              unitCostAtTime: unitCost,
              totalCostAtTime: totalCost,
              grossProfit,
              isLoss: grossProfit < 0,
              isCorrected: false,
            });
            eventsToAdd.push(ev);

            if (!existingProd && itTotal > 0) {
              updatedProducts.push({
                id: `prod-${Date.now()}-${idx}`,
                name: itemName,
                unit,
                currentCost: unitCost,
                normalSellingPrice: unitPrice,
                costHistory: [{ date: eventDate, cost: unitCost, reason: 'Learned from sale' }],
                priceHistory: [{ date: eventDate, price: unitPrice, note: 'Initial price' }],
              });
            }
          }

          // Update customer once with aggregated debt
          if (action.customerName) {
            const custName = action.customerName.trim();
            const cIdx = updatedCustomers.findIndex(
              (c) => c.name.toLowerCase() === custName.toLowerCase()
            );
            if (cIdx >= 0) {
              const c = updatedCustomers[cIdx];
              updatedCustomers[cIdx] = {
                ...c,
                totalPurchased: (c.totalPurchased || 0) + totalCombinedRev,
                totalPaid: (c.totalPaid || 0) + totalCombinedCash,
                outstandingBalance: (c.outstandingBalance || 0) + totalCombinedDebt,
                lastActivityDate: eventDate,
              };
            } else {
              updatedCustomers.push({
                id: `cust-${Date.now()}`,
                name: custName,
                totalPurchased: totalCombinedRev,
                totalPaid: totalCombinedCash,
                outstandingBalance: totalCombinedDebt,
                lastActivityDate: eventDate,
                paymentReliability: totalCombinedDebt > 0 ? 'Medium' : 'High',
                history: [],
              });
            }
          }

          const updatedEvents = [...eventsToAdd, ...currentState.events];
          updatedCustomers = reconcileCustomerBalances(updatedEvents, updatedCustomers);

          return {
            success: true,
            actionId,
            intent: 'CREATE_SALE',
            newState: {
              ...currentState,
              events: updatedEvents,
              products: updatedProducts,
              customers: updatedCustomers,
            },
            createdEvents: eventsToAdd,
            createdEvent: eventsToAdd[0],
            message: `Recorded ${eventsToAdd.length} sales totaling ${formatNaira(totalCombinedRev)}.${totalCombinedDebt > 0 && action.customerName ? ` ${action.customerName} owes ${formatNaira(totalCombinedDebt)}.` : ''}`,
          };
        }

        // Single item sale
        const itemName = (action.productOrServiceName || 'Sale Item').trim();
        const qty = Math.max(1, action.quantity || 1);
        const itemType = action.itemType || (itemName.toLowerCase().includes('repair') || itemName.toLowerCase().includes('braid') || itemName.toLowerCase().includes('service') || itemName.toLowerCase().includes('consult') ? 'service' : 'product');
        const unit = action.unit || (itemType === 'service' ? 'job' : 'piece');
        
        const existingProd = currentState.products.find(
          (p) => p.name.toLowerCase() === itemName.toLowerCase()
        );

        let unitSellingPrice = action.unitPrice || 0;
        let totalRevenue = action.totalAmount || 0;

        if (totalRevenue > 0 && unitSellingPrice === 0) {
          unitSellingPrice = Math.round(totalRevenue / qty);
        } else if (unitSellingPrice > 0 && totalRevenue === 0) {
          totalRevenue = unitSellingPrice * qty;
        } else if (unitSellingPrice === 0 && totalRevenue === 0) {
          unitSellingPrice = existingProd?.normalSellingPrice || 0;
          totalRevenue = unitSellingPrice * qty;
        }

        const cashReceived = action.cashReceived !== undefined ? action.cashReceived : totalRevenue;
        const receivableAdded = Math.max(0, totalRevenue - cashReceived);

        let unitCostAtTime = 0;
        let totalCostAtTime = 0;

        if (itemType === 'product') {
          unitCostAtTime = existingProd?.currentCost || 0;
          totalCostAtTime = unitCostAtTime * qty;
        }

        const grossProfit = totalRevenue - totalCostAtTime;

        const newEvent: BusinessEvent = ensureEventHeadlineAndSummary({
          id: `ev-sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          date: eventDate,
          timeStr: action.timeStr || timeNow,
          type: 'SALE',
          rawUserText: action.rawUserText || `Sold ${qty} ${unit} of ${itemName} for ${formatNaira(totalRevenue)}`,
          systemResponseText: '',
          productName: itemName,
          customerName: action.customerName || undefined,
          quantity: qty,
          unit: unit,
          unitSellingPrice,
          totalRevenue,
          cashReceived,
          receivableAdded,
          unitCostAtTime,
          totalCostAtTime,
          grossProfit,
          isLoss: grossProfit < 0,
          isCorrected: false,
        });

        let updatedEvents = [newEvent, ...currentState.events];
        let updatedProducts = [...currentState.products];
        if (!existingProd && totalRevenue > 0) {
          updatedProducts.push({
            id: `prod-${Date.now()}`,
            name: itemName,
            unit: unit,
            currentCost: unitCostAtTime,
            normalSellingPrice: unitSellingPrice,
            costHistory: [{ date: eventDate, cost: unitCostAtTime, reason: 'Learned from first transaction' }],
            priceHistory: [{ date: eventDate, price: unitSellingPrice, note: 'Initial price' }],
          });
        }

        let updatedCustomers = [...currentState.customers];
        if (action.customerName) {
          const custName = action.customerName.trim();
          const cIdx = updatedCustomers.findIndex(
            (c) => c.name.toLowerCase() === custName.toLowerCase()
          );

          if (cIdx >= 0) {
            const c = updatedCustomers[cIdx];
            updatedCustomers[cIdx] = {
              ...c,
              totalPurchased: (c.totalPurchased || 0) + totalRevenue,
              totalPaid: (c.totalPaid || 0) + cashReceived,
              outstandingBalance: (c.outstandingBalance || 0) + receivableAdded,
              lastActivityDate: eventDate,
              history: [
                ...(c.history || []),
                {
                  eventId: newEvent.id,
                  date: eventDate,
                  type: 'PURCHASE',
                  amount: totalRevenue,
                  description: `Purchased ${qty} ${unit} of ${itemName}`,
                },
              ],
            };
          } else {
            updatedCustomers.push({
              id: `cust-${Date.now()}`,
              name: custName,
              totalPurchased: totalRevenue,
              totalPaid: cashReceived,
              outstandingBalance: receivableAdded,
              lastActivityDate: eventDate,
              paymentReliability: receivableAdded > 0 ? 'Medium' : 'High',
              notes: receivableAdded > 0 ? `Owes ${formatNaira(receivableAdded)} from ${eventDate}` : undefined,
              history: [
                {
                  eventId: newEvent.id,
                  date: eventDate,
                  type: 'PURCHASE',
                  amount: totalRevenue,
                  description: `Purchased ${qty} ${unit} of ${itemName}`,
                },
              ],
            });
          }
        }

        updatedCustomers = reconcileCustomerBalances(updatedEvents, updatedCustomers);

        const auditRecord: AuditRecord = {
          timestamp: new Date().toISOString(),
          action: 'CREATE_SALE',
          note: `Created sale of ${qty} ${unit} ${itemName} for ${formatNaira(totalRevenue)} (Cash: ${formatNaira(cashReceived)})`,
        };

        let confirmationMsg = `Recorded sale: ${qty} ${unit} of ${itemName} for ${formatNaira(totalRevenue)}.`;
        if (receivableAdded > 0 && action.customerName) {
          confirmationMsg += ` ${action.customerName} paid ${formatNaira(cashReceived)} and owes ${formatNaira(receivableAdded)}.`;
        }

        return {
          success: true,
          actionId,
          intent: 'CREATE_SALE',
          newState: {
            ...currentState,
            events: updatedEvents,
            products: updatedProducts,
            customers: updatedCustomers,
          },
          createdEvent: newEvent,
          auditRecord,
          message: confirmationMsg,
        };
      }

      case 'RECORD_EXPENSE': {
        const amount = action.totalAmount || 0;
        if (amount <= 0) {
          return {
            success: false,
            actionId,
            intent: 'RECORD_EXPENSE',
            newState: currentState,
            error: 'Expense amount must be greater than zero.',
            message: 'Expense amount must be greater than zero.',
          };
        }

        const category: ExpenseCategory = action.expenseCategory || 'Other';
        const expenseEvent: BusinessEvent = ensureEventHeadlineAndSummary({
          id: `ev-exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          date: eventDate,
          timeStr: action.timeStr || timeNow,
          type: 'EXPENSE',
          rawUserText: action.rawUserText || `Spent ${formatNaira(amount)} on ${category}`,
          systemResponseText: `Logged ${formatNaira(amount)} expense under ${category}.`,
          expenseAmount: amount,
          expenseCategory: category,
          supplierName: action.supplierName || undefined,
          productName: action.productOrServiceName || undefined,
          isCorrected: false,
        });

        let updatedSuppliers = [...currentState.suppliers];
        if (action.supplierName) {
          const supName = action.supplierName.trim();
          const sIdx = updatedSuppliers.findIndex((s) => s.name.toLowerCase() === supName.toLowerCase());
          if (sIdx >= 0) {
            updatedSuppliers[sIdx] = {
              ...updatedSuppliers[sIdx],
              notes: `Supplied goods on ${eventDate}`,
            };
          } else {
            updatedSuppliers.push({
              id: `sup-${Date.now()}`,
              name: supName,
              itemsSupplied: action.productOrServiceName ? [action.productOrServiceName] : [],
              currentPrices: {},
              history: [],
              notes: `Recorded on ${eventDate}`,
            });
          }
        }

        const auditRecord: AuditRecord = {
          timestamp: new Date().toISOString(),
          action: 'RECORD_EXPENSE',
          note: `Recorded ${formatNaira(amount)} ${category} expense`,
        };

        return {
          success: true,
          actionId,
          intent: 'RECORD_EXPENSE',
          newState: {
            ...currentState,
            events: [expenseEvent, ...currentState.events],
            suppliers: updatedSuppliers,
          },
          createdEvent: expenseEvent,
          auditRecord,
          message: `Recorded ${formatNaira(amount)} expense for ${category}.`,
        };
      }

      case 'RECORD_PURCHASE': {
        const supName = (action.supplierName || 'Supplier').trim();
        const itemName = (action.productOrServiceName || 'Stock').trim();
        const qty = Math.max(1, action.quantity || 1);
        const unit = action.unit || 'units';
        let unitCost = action.unitPrice || 0;
        let totalCost = action.totalAmount || 0;

        if (totalCost > 0 && unitCost === 0) {
          unitCost = Math.round(totalCost / qty);
        } else if (unitCost > 0 && totalCost === 0) {
          totalCost = unitCost * qty;
        }

        const purchaseEvent: BusinessEvent = ensureEventHeadlineAndSummary({
          id: `ev-pur-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          date: eventDate,
          timeStr: action.timeStr || timeNow,
          type: 'PURCHASE_STOCK',
          rawUserText: action.rawUserText || `Bought ${qty} ${unit} of ${itemName} from ${supName} for ${formatNaira(totalCost)}`,
          systemResponseText: `Recorded purchase of ${qty} ${unit} of ${itemName} from ${supName} for ${formatNaira(totalCost)}.`,
          productName: itemName,
          supplierName: supName,
          quantity: qty,
          unit,
          unitCostAtTime: unitCost,
          totalCostAtTime: totalCost,
          expenseAmount: totalCost,
          expenseCategory: 'Procurement',
          isCorrected: false,
        });

        // Update product cost in memory
        let updatedProducts = [...currentState.products];
        const pIdx = updatedProducts.findIndex((p) => p.name.toLowerCase() === itemName.toLowerCase());
        if (pIdx >= 0) {
          const prev = updatedProducts[pIdx];
          updatedProducts[pIdx] = {
            ...prev,
            previousCost: prev.currentCost,
            currentCost: unitCost,
            costHistory: [
              ...(prev.costHistory || []),
              { date: eventDate, cost: unitCost, reason: `Purchased from ${supName}` },
            ],
          };
        } else if (unitCost > 0) {
          updatedProducts.push({
            id: `prod-${Date.now()}`,
            name: itemName,
            unit,
            currentCost: unitCost,
            normalSellingPrice: Math.round(unitCost * 1.3),
            costHistory: [{ date: eventDate, cost: unitCost, reason: `Initial stock purchase from ${supName}` }],
            priceHistory: [],
          });
        }

        // Update suppliers
        let updatedSuppliers = [...currentState.suppliers];
        const sIdx = updatedSuppliers.findIndex((s) => s.name.toLowerCase() === supName.toLowerCase());
        if (sIdx >= 0) {
          const s = updatedSuppliers[sIdx];
          const suppliedItems = s.itemsSupplied ? [...s.itemsSupplied] : [];
          if (!suppliedItems.includes(itemName)) suppliedItems.push(itemName);
          updatedSuppliers[sIdx] = {
            ...s,
            itemsSupplied: suppliedItems,
            currentPrices: { ...(s.currentPrices || {}), [itemName]: unitCost },
            notes: `Supplied ${qty} ${unit} on ${eventDate}`,
          };
        } else {
          updatedSuppliers.push({
            id: `sup-${Date.now()}`,
            name: supName,
            itemsSupplied: [itemName],
            currentPrices: { [itemName]: unitCost },
            history: [],
            notes: `First supplied ${qty} ${unit} on ${eventDate}`,
          });
        }

        const auditRecord: AuditRecord = {
          timestamp: new Date().toISOString(),
          action: 'RECORD_PURCHASE',
          note: `Procured ${qty} ${unit} of ${itemName} from ${supName} for ${formatNaira(totalCost)}`,
        };

        return {
          success: true,
          actionId,
          intent: 'RECORD_PURCHASE',
          newState: {
            ...currentState,
            events: [purchaseEvent, ...currentState.events],
            products: updatedProducts,
            suppliers: updatedSuppliers,
          },
          createdEvent: purchaseEvent,
          auditRecord,
          message: `Recorded stock purchase: ${qty} ${unit} of ${itemName} from ${supName} for ${formatNaira(totalCost)}. Cost updated to ${formatNaira(unitCost)} per ${unit}.`,
        };
      }

      case 'RECORD_PAYMENT': {
        const custName = (action.customerName || '').trim();
        const amount = action.cashReceived || action.totalAmount || 0;
        if (!custName || amount <= 0) {
          return {
            success: false,
            actionId,
            intent: 'RECORD_PAYMENT',
            newState: currentState,
            error: 'Valid customer name and payment amount are required.',
            message: 'Could not record debt payment: missing customer name or amount.',
          };
        }

        const paymentEvent: BusinessEvent = ensureEventHeadlineAndSummary({
          id: `ev-pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          date: eventDate,
          timeStr: action.timeStr || timeNow,
          type: 'DEBT_PAYMENT',
          rawUserText: action.rawUserText || `${custName} paid ${formatNaira(amount)}`,
          systemResponseText: `Received payment of ${formatNaira(amount)} from ${custName}.`,
          customerName: custName,
          cashReceived: amount,
          grossProfit: 0,
          isCorrected: false,
        });

        const updatedEvents = [paymentEvent, ...currentState.events];
        let updatedCustomers = [...currentState.customers];
        const cIdx = updatedCustomers.findIndex((c) => c.name.toLowerCase() === custName.toLowerCase());

        if (cIdx >= 0) {
          const c = updatedCustomers[cIdx];
          const newOutstanding = Math.max(0, (c.outstandingBalance || 0) - amount);
          updatedCustomers[cIdx] = {
            ...c,
            totalPaid: (c.totalPaid || 0) + amount,
            outstandingBalance: newOutstanding,
            lastActivityDate: eventDate,
            history: [
              ...(c.history || []),
              {
                eventId: paymentEvent.id,
                date: eventDate,
                type: 'PAYMENT',
                amount,
                description: `Payment of ${formatNaira(amount)} received`,
              },
            ],
          };
        }

        updatedCustomers = reconcileCustomerBalances(updatedEvents, updatedCustomers);

        return {
          success: true,
          actionId,
          intent: 'RECORD_PAYMENT',
          newState: {
            ...currentState,
            events: updatedEvents,
            customers: updatedCustomers,
          },
          createdEvent: paymentEvent,
          message: `Recorded ${formatNaira(amount)} payment from ${custName}. Balance updated.`,
        };
      }

      case 'RECORD_DEBT': {
        const custName = (action.customerName || '').trim();
        const amount = action.totalAmount || action.outstandingBalance || 0;
        if (!custName || amount <= 0) {
          return {
            success: false,
            actionId,
            intent: 'RECORD_DEBT',
            newState: currentState,
            error: 'Valid customer name and debt amount are required.',
            message: 'Could not record debt: missing customer name or amount.',
          };
        }

        const debtEvent: BusinessEvent = ensureEventHeadlineAndSummary({
          id: `ev-debt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          date: eventDate,
          timeStr: action.timeStr || timeNow,
          type: 'CUSTOMER_DEBT',
          rawUserText: action.rawUserText || `${custName} owes ${formatNaira(amount)}`,
          systemResponseText: `Recorded debt: ${custName} owes ${formatNaira(amount)}.`,
          customerName: custName,
          receivableAdded: amount,
          isCorrected: false,
        });

        const updatedEvents = [debtEvent, ...currentState.events];
        let updatedCustomers = [...currentState.customers];
        const cIdx = updatedCustomers.findIndex((c) => c.name.toLowerCase() === custName.toLowerCase());

        if (cIdx >= 0) {
          const c = updatedCustomers[cIdx];
          updatedCustomers[cIdx] = {
            ...c,
            outstandingBalance: (c.outstandingBalance || 0) + amount,
            totalPurchased: (c.totalPurchased || 0) + amount,
            lastActivityDate: eventDate,
          };
        } else {
          updatedCustomers.push({
            id: `cust-${Date.now()}`,
            name: custName,
            outstandingBalance: amount,
            totalPurchased: amount,
            totalPaid: 0,
            lastActivityDate: eventDate,
            paymentReliability: 'Medium',
            notes: `Owes ${formatNaira(amount)}`,
            history: [],
          });
        }

        updatedCustomers = reconcileCustomerBalances(updatedEvents, updatedCustomers);

        return {
          success: true,
          actionId,
          intent: 'RECORD_DEBT',
          newState: {
            ...currentState,
            events: updatedEvents,
            customers: updatedCustomers,
          },
          createdEvent: debtEvent,
          message: `Recorded: ${custName} owes ${formatNaira(amount)}. Ledger and customer balance updated.`,
        };
      }

      case 'RECORD_OWNER_DRAWING': {
        const amount = action.totalAmount || 0;
        if (amount <= 0) {
          return {
            success: false,
            actionId,
            intent: 'RECORD_OWNER_DRAWING',
            newState: currentState,
            error: 'Drawing amount must be greater than zero.',
            message: 'Owner withdrawal amount must be greater than zero.',
          };
        }
        const drawingEvent: BusinessEvent = ensureEventHeadlineAndSummary({
          id: `ev-draw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          date: eventDate,
          timeStr: action.timeStr || timeNow,
          type: 'OWNER_DRAWING',
          rawUserText: action.rawUserText || `Took ${formatNaira(amount)} from business for personal use`,
          systemResponseText: `Recorded owner withdrawal of ${formatNaira(amount)}. This is tracked as personal drawings and does not count as business operating overhead.`,
          expenseAmount: amount,
          isCorrected: false,
        });

        return {
          success: true,
          actionId,
          intent: 'RECORD_OWNER_DRAWING',
          newState: {
            ...currentState,
            events: [drawingEvent, ...currentState.events],
          },
          createdEvent: drawingEvent,
          message: `Recorded personal withdrawal of ${formatNaira(amount)}. Logged separately from operating expenses.`,
        };
      }

      case 'RECORD_CAPITAL_INJECTION': {
        const amount = action.totalAmount || 0;
        if (amount <= 0) {
          return {
            success: false,
            actionId,
            intent: 'RECORD_CAPITAL_INJECTION',
            newState: currentState,
            error: 'Injection amount must be greater than zero.',
            message: 'Capital injection amount must be greater than zero.',
          };
        }
        const injectionEvent: BusinessEvent = ensureEventHeadlineAndSummary({
          id: `ev-inj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          date: eventDate,
          timeStr: action.timeStr || timeNow,
          type: 'OWNER_INJECTION',
          rawUserText: action.rawUserText || `Injected ${formatNaira(amount)} capital into business`,
          systemResponseText: `Recorded personal capital injection of ${formatNaira(amount)}. This is tracked as equity and does not count as customer sales revenue.`,
          cashReceived: amount,
          isCorrected: false,
        });

        return {
          success: true,
          actionId,
          intent: 'RECORD_CAPITAL_INJECTION',
          newState: {
            ...currentState,
            events: [injectionEvent, ...currentState.events],
          },
          createdEvent: injectionEvent,
          message: `Recorded capital injection of ${formatNaira(amount)}. Added to cash in hand without distorting sales revenue.`,
        };
      }

      case 'CORRECT_EVENT': {
        const targetEvent = findTargetEvent(
          currentState,
          action.targetDescription || action.targetEntityName || action.rawUserText,
          action.targetEventId
        );

        if (!targetEvent) {
          return {
            success: false,
            actionId,
            intent: 'CORRECT_EVENT',
            newState: currentState,
            error: 'No target transaction found to correct.',
            message: "I couldn't find the transaction you wanted to correct in your records.",
          };
        }

        const changes = action.correctionChanges;
        const newQty = changes?.quantity !== undefined ? changes.quantity : (targetEvent.quantity || 1);
        let newRev = changes?.totalAmount !== undefined ? changes.totalAmount : (targetEvent.totalRevenue || 0);
        let newCash = changes?.cashReceived !== undefined ? changes.cashReceived : (targetEvent.cashReceived || newRev);

        if (changes?.unitPrice !== undefined) {
          newRev = changes.unitPrice * newQty;
          if (changes?.cashReceived === undefined) newCash = newRev;
        }

        const unitCost = targetEvent.unitCostAtTime || 0;
        const newTotalCost = unitCost * newQty;
        const newGross = newRev - newTotalCost;

        const corrected: BusinessEvent = ensureEventHeadlineAndSummary({
          ...targetEvent,
          id: `ev-corr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: changes?.date || targetEvent.date,
          quantity: newQty,
          totalRevenue: newRev,
          cashReceived: newCash,
          receivableAdded: Math.max(0, newRev - newCash),
          totalCostAtTime: newTotalCost,
          grossProfit: newGross,
          isCorrected: false,
          correctionOfId: targetEvent.id,
          auditTrail: [
            ...(targetEvent.auditTrail || []),
            {
              timestamp: new Date().toISOString(),
              action: 'CORRECTION',
              note: changes?.note || 'Corrected via owner instruction',
            },
          ],
        });

        const updatedEvents = [
          corrected,
          ...currentState.events.filter((e) => e.id !== targetEvent!.id),
        ];

        const updatedCustomers = reconcileCustomerBalances(updatedEvents, currentState.customers);

        return {
          success: true,
          actionId,
          intent: 'CORRECT_EVENT',
          newState: {
            ...currentState,
            events: updatedEvents,
            customers: updatedCustomers,
          },
          correctedEvent: corrected,
          message: `Correction saved: updated ${corrected.productName || 'transaction'} to ${formatNaira(newRev)}.`,
        };
      }

      case 'DELETE_EVENT': {
        const eventToDelete = findTargetEvent(
          currentState,
          action.targetDescription || action.targetEntityName || action.rawUserText,
          action.targetEventId
        );

        if (!eventToDelete) {
          return {
            success: false,
            actionId,
            intent: 'DELETE_EVENT',
            newState: currentState,
            error: 'Transaction not found or already deleted.',
            message: "I couldn't delete that transaction because it wasn't found in your records.",
          };
        }

        const remainingEvents = currentState.events.filter((e) => e.id !== eventToDelete!.id);
        const updatedCustomers = reconcileCustomerBalances(remainingEvents, currentState.customers);

        const auditRecord: AuditRecord = {
          timestamp: new Date().toISOString(),
          action: 'DELETE_EVENT',
          note: `Deleted event ${eventToDelete.id} (${eventToDelete.type}: ${eventToDelete.headline || eventToDelete.productName || 'Record'})`,
        };

        return {
          success: true,
          actionId,
          intent: 'DELETE_EVENT',
          newState: {
            ...currentState,
            events: remainingEvents,
            customers: updatedCustomers,
          },
          deletedEventId: eventToDelete.id,
          memoryUpdates: [
            {
              type: 'EVENT_DELETE',
              targetName: eventToDelete.productName,
              summary: `Deleted ${eventToDelete.type} entry (${formatNaira(eventToDelete.totalRevenue || eventToDelete.expenseAmount || 0)})`,
              data: { deletedEventId: eventToDelete.id, eventId: eventToDelete.id },
            },
          ],
          auditRecord,
          message: `Deleted the ${eventToDelete.productName || eventToDelete.type.toLowerCase()} record of ${formatNaira(eventToDelete.totalRevenue || eventToDelete.expenseAmount || 0)} from your ledger.`,
        };
      }

      case 'DELETE_PRODUCT': {
        const targetName = (
          action.productOrServiceName ||
          action.targetEntityName ||
          action.targetDescription ||
          action.rawUserText ||
          ''
        ).toLowerCase().replace(/^(?:delete|remove|void)\s+(?:product\s+)?/i, '').trim();

        const product = matchProductFuzzy(targetName, currentState.products);
        if (!product) {
          return {
            success: false,
            actionId,
            intent: 'DELETE_PRODUCT',
            newState: currentState,
            error: `Product not found in memory: ${targetName}`,
            message: `I couldn't find "${action.productOrServiceName || targetName}" in your Business Memory to delete.`,
          };
        }

        const remainingProducts = currentState.products.filter((p) => p.id !== product.id);
        const remainingUnits = (currentState.unitRelationships || []).filter(
          (u) => u.productName?.toLowerCase() !== product.name.toLowerCase()
        );

        const memoryUpdate: MemoryUpdateItem = {
          type: 'PRODUCT_DELETE',
          targetName: product.name,
          summary: `Deleted ${product.name} from Business Memory`,
          data: { productId: product.id, productName: product.name },
        };

        const auditRecord: AuditRecord = {
          timestamp: new Date().toISOString(),
          action: 'DELETE_PRODUCT',
          note: `Deleted product ${product.name} (${product.id}) from Business Memory`,
        };

        return {
          success: true,
          actionId,
          intent: 'DELETE_PRODUCT',
          newState: {
            ...currentState,
            products: remainingProducts,
            unitRelationships: remainingUnits,
          },
          deletedProductId: product.id,
          memoryUpdates: [memoryUpdate],
          auditRecord,
          message: `Permanently deleted ${product.name} from your Business Memory and removed any linked yield conversion rules.`,
        };
      }

      case 'DELETE_CUSTOMER': {
        const targetName = (
          action.customerName ||
          action.targetEntityName ||
          action.targetDescription ||
          action.rawUserText ||
          ''
        ).toLowerCase().replace(/^(?:delete|remove|void)\s+(?:customer\s+)?/i, '').trim();

        const res = matchCustomerFuzzy(targetName, currentState.customers);
        const customer = res.customer;
        if (!customer) {
          return {
            success: false,
            actionId,
            intent: 'DELETE_CUSTOMER',
            newState: currentState,
            error: `Customer not found: ${targetName}`,
            message: `I couldn't find customer "${action.customerName || targetName}" in your records to delete.`,
          };
        }

        const remainingCustomers = currentState.customers.filter((c) => c.id !== customer.id);
        const memoryUpdate: MemoryUpdateItem = {
          type: 'CUSTOMER_DELETE',
          targetName: customer.name,
          summary: `Deleted customer profile ${customer.name}`,
          data: { customerId: customer.id, customerName: customer.name },
        };

        return {
          success: true,
          actionId,
          intent: 'DELETE_CUSTOMER',
          newState: {
            ...currentState,
            customers: remainingCustomers,
          },
          deletedCustomerId: customer.id,
          memoryUpdates: [memoryUpdate],
          message: `Deleted customer profile for ${customer.name} from your Customer Memory bank.`,
        };
      }

      case 'UPDATE_PRODUCT': {
        const targetName = (
          action.productOrServiceName ||
          action.targetEntityName ||
          ''
        ).toLowerCase();

        const product = matchProductFuzzy(targetName, currentState.products);
        if (!product) {
          return {
            success: false,
            actionId,
            intent: 'UPDATE_PRODUCT',
            newState: currentState,
            error: `Product not found: ${targetName}`,
            message: `I couldn't find "${action.productOrServiceName || targetName}" in your Business Memory.`,
          };
        }

        const newCost = action.unitPrice !== undefined && action.unitPrice > 0 ? action.unitPrice : product.currentCost;
        const newSellingPrice = action.totalAmount !== undefined && action.totalAmount > 0 ? action.totalAmount : product.normalSellingPrice;

        const updatedProducts = currentState.products.map((p) => {
          if (p.id === product.id) {
            return {
              ...p,
              currentCost: newCost,
              normalSellingPrice: newSellingPrice,
              costHistory: [
                ...p.costHistory,
                {
                  date: todayStr,
                  cost: newCost,
                  reason: 'Updated via Ask AI',
                },
              ],
            };
          }
          return p;
        });

        const memoryUpdate: MemoryUpdateItem = {
          type: 'PRODUCT_COST',
          targetName: product.name,
          summary: `Updated ${product.name}: Cost ${formatNaira(newCost)}, Price ${formatNaira(newSellingPrice)}`,
          data: { productName: product.name, cost: newCost, price: newSellingPrice },
        };

        return {
          success: true,
          actionId,
          intent: 'UPDATE_PRODUCT',
          newState: {
            ...currentState,
            products: updatedProducts,
          },
          memoryUpdates: [memoryUpdate],
          message: `Updated ${product.name}: wholesale cost is now ${formatNaira(newCost)}, selling price is ${formatNaira(newSellingPrice)}.`,
        };
      }

      case 'REMEMBER_FACT': {
        const updates = action.memoryUpdates || (action.memoryUpdate ? [action.memoryUpdate] : []);
        if (updates.length === 0) {
          return {
            success: false,
            actionId,
            intent: 'REMEMBER_FACT',
            newState: currentState,
            error: 'No memory facts provided.',
            message: 'I did not catch what you wanted me to remember.',
          };
        }

        let updatedProducts = [...currentState.products];
        let updatedCustomers = [...currentState.customers];
        let updatedSuppliers = [...currentState.suppliers];
        let updatedRules = [...(currentState.businessRules || currentState.rules || [])];
        let updatedUnits = [...currentState.unitRelationships];

        for (const mu of updates) {
          if (mu.type === 'BUSINESS_RULE') {
            const ruleText = mu.data?.rule || mu.summary;
            if (ruleText) {
              updatedRules.push({
                id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                description: ruleText,
                category: mu.data?.category || 'GENERAL',
                active: true,
                createdAt: todayStr,
              });
            }
          } else if (mu.type === 'CUSTOMER_NOTE') {
            const cName = mu.targetName || mu.data?.customerName;
            if (cName) {
              const idx = updatedCustomers.findIndex((c) => c.name.toLowerCase() === cName.toLowerCase());
              const noteText = mu.data?.note || mu.summary;
              if (idx >= 0) {
                updatedCustomers[idx] = {
                  ...updatedCustomers[idx],
                  notes: updatedCustomers[idx].notes ? `${updatedCustomers[idx].notes}; ${noteText}` : noteText,
                };
              } else {
                updatedCustomers.push({
                  id: `cust-${Date.now()}`,
                  name: cName,
                  totalPurchased: 0,
                  totalPaid: 0,
                  outstandingBalance: 0,
                  lastActivityDate: todayStr,
                  notes: noteText,
                  history: [],
                });
              }
            }
          } else if (mu.type === 'SUPPLIER_INFO') {
            const sName = mu.targetName || mu.data?.supplierName;
            if (sName) {
              const idx = updatedSuppliers.findIndex((s) => s.name.toLowerCase() === sName.toLowerCase());
              const noteText = mu.data?.note || mu.summary;
              if (idx >= 0) {
                updatedSuppliers[idx] = {
                  ...updatedSuppliers[idx],
                  notes: updatedSuppliers[idx].notes ? `${updatedSuppliers[idx].notes}; ${noteText}` : noteText,
                };
              } else {
                updatedSuppliers.push({
                  id: `sup-${Date.now()}`,
                  name: sName,
                  itemsSupplied: [],
                  currentPrices: {},
                  history: [],
                  notes: noteText,
                });
              }
            }
          } else if (mu.type === 'PRODUCT_COST' && mu.data?.productName) {
            const pName = mu.data.productName;
            const newCost = Number(mu.data.cost) || 0;
            const idx = updatedProducts.findIndex((p) => p.name.toLowerCase() === pName.toLowerCase());
            if (idx >= 0) {
              const prev = updatedProducts[idx];
              updatedProducts[idx] = {
                ...prev,
                previousCost: prev.currentCost,
                currentCost: newCost,
                costHistory: [...prev.costHistory, { date: todayStr, cost: newCost, reason: mu.summary }],
              };
            } else {
              updatedProducts.push({
                id: `prod-${Date.now()}`,
                name: pName,
                unit: 'piece',
                currentCost: newCost,
                normalSellingPrice: Math.round(newCost * 1.3),
                costHistory: [{ date: todayStr, cost: newCost, reason: 'Stored in memory' }],
                priceHistory: [],
              });
            }
          }
        }

        return {
          success: true,
          actionId,
          intent: 'REMEMBER_FACT',
          newState: {
            ...currentState,
            products: updatedProducts,
            customers: updatedCustomers,
            suppliers: updatedSuppliers,
            businessRules: updatedRules,
            rules: updatedRules,
            unitRelationships: updatedUnits,
          },
          message: updates.length === 1 ? `Remembered: ${updates[0].summary}` : `Stored ${updates.length} business memories.`,
        };
      }

      case 'FORGET_FACT': {
        const removal = action.memoryToRemove;
        if (!removal) {
          return {
            success: false,
            actionId,
            intent: 'FORGET_FACT',
            newState: currentState,
            error: 'Missing memory to remove.',
            message: 'I was unable to determine which memory to forget.',
          };
        }

        let updatedRules = [...(currentState.businessRules || currentState.rules || [])];
        let updatedSuppliers = [...currentState.suppliers];
        let updatedCustomers = [...currentState.customers];
        let updatedProducts = [...currentState.products];
        let updatedUnits = [...currentState.unitRelationships];
        let deletedProdId: string | undefined = undefined;

        if (removal.targetName) {
          const target = removal.targetName.toLowerCase();
          const matchedProd = matchProductFuzzy(target, currentState.products);
          if (matchedProd) {
            deletedProdId = matchedProd.id;
            updatedProducts = updatedProducts.filter((p) => p.id !== matchedProd.id);
            updatedUnits = updatedUnits.filter((u) => u.productName?.toLowerCase() !== matchedProd.name.toLowerCase());
          }
          updatedSuppliers = updatedSuppliers.map((s) =>
            s.name.toLowerCase() === target ? { ...s, notes: undefined } : s
          );
          updatedCustomers = updatedCustomers.map((c) =>
            c.name.toLowerCase() === target ? { ...c, notes: undefined } : c
          );
          updatedRules = updatedRules.filter(
            (r) => !r.description.toLowerCase().includes(target)
          );
        }

        if (removal.summaryText) {
          const sub = removal.summaryText.toLowerCase();
          updatedRules = updatedRules.filter((r) => !r.description.toLowerCase().includes(sub));
        }

        return {
          success: true,
          actionId,
          intent: 'FORGET_FACT',
          newState: {
            ...currentState,
            products: updatedProducts,
            unitRelationships: updatedUnits,
            businessRules: updatedRules,
            rules: updatedRules,
            suppliers: updatedSuppliers,
            customers: updatedCustomers,
          },
          deletedProductId: deletedProdId,
          memoryUpdates: [
            {
              type: 'FORGET_FACT',
              targetName: removal.targetName,
              summary: `Cleared memory for ${removal.targetName || removal.summaryText || 'rule'}`,
            },
          ],
          message: `Cleared that memory from your business profile.`,
        };
      }

      default:
        return {
          success: true,
          actionId,
          intent: action.intent,
          newState: currentState,
          message: 'Retrieved business information.',
        };
    }
  } catch (err: any) {
    console.error('Fatal execution error in businessEngine:', err);
    return {
      success: false,
      actionId,
      intent: action.intent,
      newState: currentState,
      error: err?.message || 'Business engine execution failure.',
      message: 'Failed to update business state.',
    };
  }
}
