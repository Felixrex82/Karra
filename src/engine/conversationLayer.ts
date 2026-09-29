import {
  BusinessState,
  BusinessEvent,
  ProductMemory,
  CustomerMemory,
  SupplierMemory,
  MemoryUpdateItem,
  FollowUpQuestion,
  ConversationState,
  TransactionDraft,
} from '../types';
import {
  computeSaleMetrics,
  formatNaira,
} from './calculations';
import { getTodayDateStr, formatDateShort, extractDateFromText } from '../utils/dateUtils';
import { ensureEventHeadlineAndSummary } from './eventSummarizer';
import { matchProductFuzzy, matchCustomerFuzzy } from './businessEngine';
import {
  parseNairaAmount,
  resolveProductCostForUnit,
  ParseResult,
} from './nlpInterpreter';

export interface UnderstandingResult {
  understood: boolean;
  intent: string;
  confidence: number;
  interpretationSummary?: string;
  entities: {
    productReference?: string | null;
    quantity?: number | null;
    unit?: string | null;
    explicitUnitPrice?: number | null;
    explicitTotalAmount?: number | null;
    cashPaid?: number | null;
    customerReference?: string | null;
    supplierReference?: string | null;
    expenseCategory?: string | null;
    expenseAmount?: number | null;
    notes?: string | null;
  };
  pronounResolution?: Record<string, string>;
  isCorrection?: boolean;
  correctedField?: string | null;
  correctedValue?: any;
  isAmbiguous?: boolean;
  ambiguityQuestion?: string | null;
  ambiguityOptions?: string[];
  missingInformation?: string[];
  clarificationPrompt?: string | null;
  learnedKnowledge?: {
    type: 'PRODUCT_PRICE' | 'PRODUCT_COST' | 'BUSINESS_RULE' | 'CUSTOMER_INFO' | 'SUPPLIER_INFO';
    targetName: string;
    value?: number;
    rule?: string;
    note?: string;
  } | null;
  nextAction?: string;
  targetCalendarDate?: string | null;
}

/**
 * Normalizes text for robust semantic and fuzzy comparison.
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Searches product memory with ambiguity detection.
 * If multiple distinct products match (e.g. "Ankara Dress" and "Corporate Dress" for "dress"),
 * returns 'ambiguous' with the candidates list.
 * If exactly one product matches, returns 'found'.
 */
export function resolveProductSemantic(
  productRef: string,
  products: ProductMemory[]
): { status: 'found'; product: ProductMemory } | { status: 'ambiguous'; candidates: ProductMemory[] } | { status: 'not_found' } {
  if (!productRef || products.length === 0) return { status: 'not_found' };

  const normRef = normalize(productRef);
  const singularRef = normRef.replace(/s$/, '');

  // 1. Exact match
  const exact = products.find((p) => normalize(p.name) === normRef || normalize(p.name) === singularRef);
  if (exact) return { status: 'found', product: exact };

  // 2. Token match (e.g. "dress" matching "Ladies Ankara Dress")
  const matches = products.filter((p) => {
    const pNorm = normalize(p.name);
    const pTokens = pNorm.split(' ');
    const refTokens = singularRef.split(' ');
    // Product contains the reference or reference tokens contain product tokens
    return refTokens.every((t) => pTokens.includes(t)) || pTokens.includes(singularRef);
  });

  if (matches.length === 1) {
    return { status: 'found', product: matches[0] };
  }

  if (matches.length > 1) {
    return { status: 'ambiguous', candidates: matches };
  }

  // 3. Fallback fuzzy match
  const fuzzy = matchProductFuzzy(productRef, products);
  if (fuzzy) {
    return { status: 'found', product: fuzzy };
  }

  return { status: 'not_found' };
}

/**
 * Searches customer memory with ambiguity detection.
 */
export function resolveCustomerSemantic(
  customerRef: string,
  customers: CustomerMemory[]
): { status: 'found'; customer: CustomerMemory } | { status: 'ambiguous'; candidates: CustomerMemory[] } | { status: 'not_found' } {
  if (!customerRef || customers.length === 0) return { status: 'not_found' };

  const normRef = normalize(customerRef);
  const exact = customers.find((c) => normalize(c.name) === normRef);
  if (exact) return { status: 'found', customer: exact };

  const matches = customers.filter((c) => {
    const cNorm = normalize(c.name);
    return cNorm.split(' ').includes(normRef) || cNorm.includes(normRef);
  });

  if (matches.length === 1) return { status: 'found', customer: matches[0] };
  if (matches.length > 1) return { status: 'ambiguous', candidates: matches };

  const fuzzyRes = matchCustomerFuzzy(customerRef, customers);
  if (fuzzyRes?.customer) return { status: 'found', customer: fuzzyRes.customer };

  return { status: 'not_found' };
}

/**
 * Deterministically interprets user input locally if Gemini API is offline or busy.
 * Complies with Fact vs Inference vs Unknown and handles multi-turn state.
 */
export function interpretLocally(
  input: string,
  state: BusinessState,
  conversationState?: ConversationState | null
): UnderstandingResult {
  const lower = input.toLowerCase().trim();
  const todayStr = getTodayDateStr();
  const dateMention = extractDateFromText(input);

  // 1. Check if user is responding to an active conversation draft
  if (conversationState && conversationState.transactionDraft) {
    const draft = conversationState.transactionDraft;
    const missing = conversationState.missingInformation || [];

    // User provided a number to resolve missing unit price or total
    if (missing.includes('unit_price') || missing.includes('selling_price') || missing.includes('QUANTITY_AND_PRICE')) {
      const amt = parseNairaAmount(input);
      if (amt !== null && amt > 0) {
        return {
          understood: true,
          intent: 'RECORD_SALE',
          confidence: 0.95,
          entities: {
            productReference: draft.productName,
            quantity: draft.quantity || 1,
            unit: draft.unit,
            explicitUnitPrice: amt,
            explicitTotalAmount: (draft.quantity || 1) * amt,
            customerReference: draft.customerName,
          },
          learnedKnowledge: draft.productName
            ? {
                type: 'PRODUCT_PRICE',
                targetName: draft.productName,
                value: amt,
                note: 'Learned normal selling price from owner answer',
              }
            : null,
          nextAction: 'RESOLVE_AND_EXECUTE',
        };
      }
    }

    // User answering missing payment amount (e.g. "John paid me" -> "5000")
    if (missing.includes('payment_amount')) {
      const amt = parseNairaAmount(input);
      if (amt !== null && amt > 0) {
        return {
          understood: true,
          intent: 'RECORD_CUSTOMER_PAYMENT',
          confidence: 0.95,
          entities: {
            customerReference: draft.customerName,
            cashPaid: amt,
          },
          nextAction: 'RESOLVE_AND_EXECUTE',
        };
      }
    }

    // User answering missing debt amount (e.g. "David owes me" -> "80k")
    if (missing.includes('debt_amount')) {
      const amt = parseNairaAmount(input);
      if (amt !== null && amt > 0) {
        return {
          understood: true,
          intent: 'RECORD_DEBT',
          confidence: 0.95,
          entities: {
            customerReference: draft.customerName,
            explicitTotalAmount: amt,
          },
          nextAction: 'RESOLVE_AND_EXECUTE',
        };
      }
    }

    // User answering customer name (e.g. "To Amaka")
    if (missing.includes('customer_name') || lower.startsWith('to ')) {
      const custName = input.replace(/^to\s+/i, '').trim();
      return {
        understood: true,
        intent: draft.intent === 'customer_payment' ? 'RECORD_CUSTOMER_PAYMENT' : 'RECORD_SALE',
        confidence: 0.95,
        entities: {
          productReference: draft.productName,
          quantity: draft.quantity,
          explicitUnitPrice: draft.unitPrice,
          explicitTotalAmount: draft.totalAmount,
          customerReference: custName,
        },
        nextAction: 'RESOLVE_AND_EXECUTE',
      };
    }

    // User correcting quantity (e.g. "Actually, 5 shirts" or "Sorry, 5")
    const corrQtyMatch = input.match(/(?:actually|sorry|no|it was|make it)\s*([0-9]+)/i) ||
      input.match(/^([0-9]+)\s*(?:shirts?|dresses?|bags?|pieces?|items?|units?)?$/i);
    if (corrQtyMatch) {
      const newQty = parseInt(corrQtyMatch[1], 10);
      return {
        understood: true,
        intent: 'CORRECTION',
        confidence: 0.95,
        isCorrection: true,
        correctedField: 'quantity',
        correctedValue: newQty,
        entities: {
          productReference: draft.productName,
          quantity: newQty,
          explicitUnitPrice: draft.unitPrice,
          customerReference: draft.customerName,
        },
        nextAction: 'RESOLVE_AND_EXECUTE',
      };
    }

    // User clarifying which product (e.g. "Ankara" or "Corporate Dress")
    if (conversationState.clarificationOptions && conversationState.clarificationOptions.length > 0) {
      const picked = conversationState.clarificationOptions.find((opt) =>
        lower.includes(opt.toLowerCase()) || opt.toLowerCase().includes(lower)
      );
      if (picked) {
        return {
          understood: true,
          intent: 'RECORD_SALE',
          confidence: 0.95,
          entities: {
            productReference: picked,
            quantity: draft.quantity || 1,
            explicitUnitPrice: draft.unitPrice,
            customerReference: draft.customerName,
          },
          nextAction: 'RESOLVE_AND_EXECUTE',
        };
      }
    }
  }

  // 2. Check teaching new reusable knowledge
  // "I now sell this dress for 35k", "One bag of rice costs me 59k", "My normal delivery charge is 5k"
  const sellTeachMatch = input.match(/(?:i now sell|normal selling price of|selling price for|we sell)\s+([a-zA-Z\s]+?)\s+(?:for|at|is)\s+([₦#]?[0-9.,]+[km]?)/i);
  if (sellTeachMatch) {
    const prodName = sellTeachMatch[1].trim();
    const price = parseNairaAmount(sellTeachMatch[2]);
    if (price && price > 0) {
      return {
        understood: true,
        intent: 'UPDATE_MEMORY',
        confidence: 0.95,
        entities: {},
        learnedKnowledge: {
          type: 'PRODUCT_PRICE',
          targetName: prodName,
          value: price,
          note: `Established normal selling price of ₦${price.toLocaleString()}`,
        },
        nextAction: 'RESOLVE_AND_EXECUTE',
      };
    }
  }

  const costTeachMatch = input.match(/(?:one bag of|bag of|cost of|costs me)\s+([a-zA-Z\s]+?)\s+(?:costs me|costs|is)\s+([₦#]?[0-9.,]+[km]?)/i);
  if (costTeachMatch) {
    const prodName = costTeachMatch[1].trim();
    const cost = parseNairaAmount(costTeachMatch[2]);
    if (cost && cost > 0) {
      return {
        understood: true,
        intent: 'UPDATE_MEMORY',
        confidence: 0.95,
        entities: {},
        learnedKnowledge: {
          type: 'PRODUCT_COST',
          targetName: prodName,
          value: cost,
          note: `Wholesale cost recorded at ₦${cost.toLocaleString()}`,
        },
        nextAction: 'RESOLVE_AND_EXECUTE',
      };
    }
  }

  // 3. Subject Direction: Merchant Spending vs Customer Purchase
  const isMerchantSpending =
    lower.startsWith('i bought') ||
    lower.startsWith('bought ') ||
    lower.startsWith('we bought') ||
    lower.startsWith('spent ') ||
    lower.startsWith('i spent');

  if (isMerchantSpending) {
    // Check Procurement: "I bought 30 cartons from Musa at 12k each"
    const supMatch = input.match(/from\s+([a-zA-Z]+)/i);
    const qtyMatch = input.match(/(?:bought|spent)\s+([0-9]+)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const rateMatch = input.match(/(?:at|for|@)\s+([₦#]?[0-9.,]+[km]?)\s*(?:each|per)?/i);
    const rate = rateMatch ? parseNairaAmount(rateMatch[1]) : null;
    const totalAmt = rate ? rate * qty : parseNairaAmount(input) || 0;

    if (supMatch) {
      const supName = supMatch[1].trim();
      const prodName = input.replace(/^.*?(?:bought|buy)\s+/i, '').replace(/\s+from.*$/i, '').trim();
      return {
        understood: true,
        intent: 'RECORD_PURCHASE',
        confidence: 0.95,
        entities: {
          productReference: prodName || 'Stock',
          supplierReference: supName,
          quantity: qty,
          explicitTotalAmount: totalAmt,
          explicitUnitPrice: rate || (totalAmt / qty),
          expenseCategory: 'Procurement',
        },
        nextAction: 'RESOLVE_AND_EXECUTE',
        targetCalendarDate: dateMention,
      };
    }

    // Operating Expense: "Spent 15k on transport", "I bought fuel 5000"
    const expAmt = parseNairaAmount(input) || 0;
    return {
      understood: true,
      intent: 'RECORD_EXPENSE',
      confidence: 0.95,
      entities: {
        expenseAmount: expAmt,
        expenseCategory: lower.includes('fuel') || lower.includes('generator')
          ? 'Utilities'
          : lower.includes('transport') || lower.includes('moving')
          ? 'Transportation'
          : lower.includes('rent')
          ? 'Rent'
          : 'Operations',
      },
      nextAction: expAmt > 0 ? 'RESOLVE_AND_EXECUTE' : 'REQUEST_MISSING_INFO',
      missingInformation: expAmt <= 0 ? ['expense_amount'] : [],
      clarificationPrompt: expAmt <= 0 ? 'How much did you spend on this?' : null,
      targetCalendarDate: dateMention,
    };
  }

  // 4. Customer Debt Payment: "John paid me 20k", "John paid me"
  if (lower.includes('paid me') || lower.includes('paid debt') || lower.includes('settled balance')) {
    const custName = input.replace(/\s+paid.*$/i, '').replace(/^.*?from\s+/i, '').trim();
    const amt = parseNairaAmount(input);
    return {
      understood: true,
      intent: 'RECORD_CUSTOMER_PAYMENT',
      confidence: 0.95,
      entities: {
        customerReference: custName || 'Customer',
        cashPaid: amt,
      },
      nextAction: amt && amt > 0 ? 'RESOLVE_AND_EXECUTE' : 'REQUEST_MISSING_INFO',
      missingInformation: !amt || amt <= 0 ? ['payment_amount'] : [],
      clarificationPrompt: !amt || amt <= 0 ? `How much did ${custName || 'the customer'} pay you?` : null,
      targetCalendarDate: dateMention,
    };
  }

  // 5. Customer Debt Owed: "Chuks is owing me 80k", "David owes me"
  if (lower.includes('is owing') || lower.includes('owes me') || lower.includes('owing me')) {
    const custName = input.replace(/\s+(?:is\s+)?owing.*$/i, '').replace(/\s+owes.*$/i, '').trim();
    const amt = parseNairaAmount(input);
    return {
      understood: true,
      intent: 'RECORD_DEBT',
      confidence: 0.95,
      entities: {
        customerReference: custName || 'Customer',
        explicitTotalAmount: amt,
      },
      nextAction: amt && amt > 0 ? 'RESOLVE_AND_EXECUTE' : 'REQUEST_MISSING_INFO',
      missingInformation: !amt || amt <= 0 ? ['debt_amount'] : [],
      clarificationPrompt: !amt || amt <= 0 ? `How much is ${custName || 'the customer'} owing you?` : null,
      targetCalendarDate: dateMention,
    };
  }

  // 6. Customer Sale: "I sold 2 dresses", "Sold 3 shirts for 60k", "David bought 5 but paid for 3"
  const isSale =
    lower.startsWith('i sold') ||
    lower.startsWith('sold ') ||
    lower.includes(' bought ') ||
    lower.match(/^[0-9]+\s+[a-zA-Z]+/);

  if (isSale) {
    const qtyMatch = input.match(/([0-9]+)\s*(?:bags?|bowls?|cartons?|bottles?|shirts?|dresses?|shoes?|pairs?|pieces?|units?|items?|packs?)?/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

    // Extract product candidate
    let prodCand = '';
    const prodMatch = input.match(/(?:sold|bought)\s+(?:some\s+|a\s+|an\s+|the\s+)?([0-9]+\s+)?([a-zA-Z\s]+?)(?:\s+to|\s+for|\s+at|\s+but|\s+yesterday|\s+today|$)/i);
    if (prodMatch && prodMatch[2]) {
      prodCand = prodMatch[2].replace(/^[0-9]+\s+/, '').trim();
    }
    if (!prodCand) {
      prodCand = input.replace(/^(?:i\s+)?sold\s+/i, '').replace(/[0-9]+/g, '').replace(/for\s+.*$/i, '').trim();
    }

    // Extract customer
    let custCand: string | null = null;
    const toMatch = input.match(/to\s+([a-zA-Z]+)/i);
    if (toMatch) {
      custCand = toMatch[1].trim();
    } else {
      const boughtByMatch = input.match(/^([a-zA-Z]+)\s+bought/i);
      if (boughtByMatch) custCand = boughtByMatch[1].trim();
    }

    // Extract price / total
    let unitPrice: number | null = null;
    let totalAmt: number | null = null;

    const forEachMatch = input.match(/(?:for|at|@)\s+([₦#]?[0-9.,]+[km]?)\s*(?:each|per\s*piece|a\s*piece)/i);
    if (forEachMatch) {
      unitPrice = parseNairaAmount(forEachMatch[1]);
      totalAmt = unitPrice ? unitPrice * qty : null;
    } else {
      const totalMatch = input.match(/for\s+([₦#]?[0-9.,]+[km]?)/i);
      if (totalMatch) {
        totalAmt = parseNairaAmount(totalMatch[1]);
        unitPrice = totalAmt ? totalAmt / qty : null;
      }
    }

    // Extract cash paid vs debt
    let cashPaid = totalAmt;
    const paidMatch = input.match(/paid\s+(?:[₦#]?\s*([0-9.,]+[km]?))/i);
    if (paidMatch) {
      cashPaid = parseNairaAmount(paidMatch[1]);
    } else {
      const paidForMatch = input.match(/paid\s+for\s+([0-9]+)/i);
      if (paidForMatch && unitPrice) {
        cashPaid = parseInt(paidForMatch[1], 10) * unitPrice;
      }
    }

    return {
      understood: true,
      intent: 'RECORD_SALE',
      confidence: 0.95,
      entities: {
        productReference: prodCand || 'items',
        quantity: qty,
        explicitUnitPrice: unitPrice,
        explicitTotalAmount: totalAmt,
        cashPaid,
        customerReference: custCand,
      },
      nextAction: 'RESOLVE_AND_EXECUTE',
      targetCalendarDate: dateMention,
    };
  }

  // 7. Informational business inquiry
  return {
    understood: true,
    intent: 'BUSINESS_QUESTION',
    confidence: 0.9,
    entities: {},
    nextAction: 'ANSWER_QUESTION',
  };
}

/**
 * Main Entry Point: Coordinates AI Understanding -> Memory Retrieval -> Deterministic Engine -> Persistence -> Response
 */
export async function executeConversationTurn(
  input: string,
  state: BusinessState
): Promise<ParseResult> {
  const todayStr = getTodayDateStr();
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  let understanding: UnderstandingResult | null = null;

  // STEP 1: AI Understanding (Call Gemini server endpoint with fallback to deterministic local understanding)
  if (typeof window !== 'undefined' || process.env.TEST_API_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);

      const res = await fetch('/api/gemini/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          userInput: input,
          conversationState: state.conversationState || null,
          memoryContext: {
            products: state.products.map((p) => ({
              name: p.name,
              price: p.normalSellingPrice,
              cost: p.currentCost,
              unit: p.unit,
            })),
            customers: state.customers.map((c) => ({
              name: c.name,
              balance: c.outstandingBalance,
            })),
            suppliers: state.suppliers.map((s) => ({
              name: s.name,
              phone: s.phone,
            })),
            rules: state.rules,
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
          })),
        }),
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      if (json.success && json.data && json.data.understood) {
        understanding = json.data;
      }
    } catch {
      understanding = null;
    }
  }

  // Fallback to local understanding if Gemini call failed or offline
  if (!understanding) {
    understanding = interpretLocally(input, state, state.conversationState);
  }

  const { intent, entities, learnedKnowledge, isAmbiguous, ambiguityQuestion, ambiguityOptions } = understanding;

  // STEP 2: Handle Teaching / Memory Updates
  const memoryUpdates: MemoryUpdateItem[] = [];
  if (learnedKnowledge) {
    if (learnedKnowledge.type === 'PRODUCT_PRICE') {
      memoryUpdates.push({
        type: 'PRODUCT_PRICE',
        summary: `Established normal price of ${learnedKnowledge.targetName}: ${formatNaira(learnedKnowledge.value || 0)}`,
        data: {
          productName: learnedKnowledge.targetName,
          price: learnedKnowledge.value,
          note: learnedKnowledge.note,
        },
      });
    } else if (learnedKnowledge.type === 'PRODUCT_COST') {
      memoryUpdates.push({
        type: 'PRODUCT_COST',
        summary: `Recorded cost of ${learnedKnowledge.targetName}: ${formatNaira(learnedKnowledge.value || 0)}`,
        data: {
          productName: learnedKnowledge.targetName,
          cost: learnedKnowledge.value,
          note: learnedKnowledge.note,
        },
      });
    } else if (learnedKnowledge.type === 'BUSINESS_RULE') {
      memoryUpdates.push({
        type: 'BUSINESS_RULE',
        summary: `Business rule established: ${learnedKnowledge.rule}`,
        data: {
          rule: learnedKnowledge.rule,
          category: 'Operations',
        },
      });
    }
    if (intent === 'UPDATE_MEMORY') {
      return {
        isQuestion: false,
        memoryUpdates,
        plainResponseText: `Understood and saved to Business Memory: ${memoryUpdates[0]?.summary}.`,
      };
    }
  }

  // STEP 3: Handle Ambiguity
  if (isAmbiguous && ambiguityQuestion) {
    const promptMsg = ambiguityQuestion;
    return {
      isQuestion: false,
      followUpRequired: {
        id: `fu-${Date.now()}`,
        prompt: promptMsg,
        missingField: 'AMBIGUOUS_CHOICE',
        pendingEvent: {
          rawUserText: input,
          quantity: entities?.quantity || 1,
        },
        options: ambiguityOptions || [],
        conversationState: {
          activeIntent: intent,
          transactionDraft: {
            quantity: entities?.quantity || 1,
          },
          missingInformation: ['ambiguous_choice'],
          clarificationOptions: ambiguityOptions || [],
          lastPrompt: promptMsg,
        },
        helperText: 'Select or reply with the exact product name.',
      },
      plainResponseText: promptMsg,
    };
  }

  // STEP 4: Handle Business Questions
  if (intent === 'BUSINESS_QUESTION') {
    const { answerBusinessQuestionWithMemory } = await import('./nlpInterpreter');
    const ansRes = answerBusinessQuestionWithMemory(input, state);
    return {
      isQuestion: true,
      questionAnswer: ansRes.answer,
      createdEvent: ansRes.createdEvent,
      memoryUpdates: ansRes.memoryUpdates,
      plainResponseText: ansRes.answer,
    };
  }

  // STEP 5: Handle Customer Payments ("John paid me 20k", "John paid me")
  if (intent === 'RECORD_CUSTOMER_PAYMENT') {
    const custRef = entities.customerReference || 'Customer';
    const custRes = resolveCustomerSemantic(custRef, state.customers);
    const resolvedCustomer = custRes.status === 'found' ? custRes.customer : null;
    const finalCustName = resolvedCustomer ? resolvedCustomer.name : custRef;

    let payAmt = entities.cashPaid || entities.explicitTotalAmount;

    if (!payAmt || payAmt <= 0) {
      const promptMsg = `How much did ${finalCustName} pay you?`;
      return {
        isQuestion: false,
        followUpRequired: {
          id: `fu-${Date.now()}`,
          prompt: promptMsg,
          missingField: 'PAYMENT_AMOUNT',
          customerName: finalCustName,
          pendingEvent: {
            rawUserText: input,
            customerName: finalCustName,
            type: 'DEBT_PAYMENT',
          },
          conversationState: {
            activeIntent: 'customer_payment',
            transactionDraft: {
              intent: 'customer_payment',
              customerName: finalCustName,
              resolvedCustomerId: resolvedCustomer?.id,
            },
            missingInformation: ['payment_amount'],
            lastPrompt: promptMsg,
          },
          helperText: `Enter the amount paid by ${finalCustName} to credit their balance.`,
        },
        plainResponseText: promptMsg,
      };
    }

    // Deterministic Payment Execution
    const payEv: BusinessEvent = ensureEventHeadlineAndSummary({
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: understanding.targetCalendarDate || todayStr,
      timeStr,
      type: 'DEBT_PAYMENT',
      rawUserText: input,
      systemResponseText: `Recorded payment of ${formatNaira(payAmt)} from ${finalCustName}.`,
      customerName: finalCustName,
      cashReceived: payAmt,
      receivableAdded: -payAmt,
      totalRevenue: 0,
      grossProfit: 0,
    });

    const previousBalance = resolvedCustomer?.outstandingBalance || 0;
    const remainingBalance = Math.max(0, previousBalance - payAmt);
    const balanceNote = resolvedCustomer
      ? ` Their remaining balance is ${formatNaira(remainingBalance)}.`
      : '';

    payEv.systemResponseText = `Recorded payment of ${formatNaira(payAmt)} from ${finalCustName}.${balanceNote}`;

    const paymentMemories: MemoryUpdateItem[] = [
      {
        type: 'CUSTOMER_PAYMENT',
        summary: `Payment of ${formatNaira(payAmt)} received from ${finalCustName}`,
        data: {
          customerName: finalCustName,
          amountPaid: payAmt,
          date: payEv.date,
        },
      },
    ];

    return {
      isQuestion: false,
      createdEvent: payEv,
      memoryUpdates: paymentMemories,
      plainResponseText: payEv.systemResponseText,
    };
  }

  // STEP 6: Handle Customer Debts ("Chuks is owing me 80k")
  if (intent === 'RECORD_DEBT') {
    const custRef = entities.customerReference || 'Customer';
    const custRes = resolveCustomerSemantic(custRef, state.customers);
    const resolvedCustomer = custRes.status === 'found' ? custRes.customer : null;
    const finalCustName = resolvedCustomer ? resolvedCustomer.name : custRef;
    const owedAmt = entities.explicitTotalAmount;

    if (!owedAmt || owedAmt <= 0) {
      const promptMsg = `How much is ${finalCustName} owing you?`;
      return {
        isQuestion: false,
        followUpRequired: {
          id: `fu-${Date.now()}`,
          prompt: promptMsg,
          missingField: 'DEBT_AMOUNT',
          customerName: finalCustName,
          pendingEvent: {
            rawUserText: input,
            customerName: finalCustName,
            type: 'CUSTOMER_DEBT',
          },
          conversationState: {
            activeIntent: 'customer_debt',
            transactionDraft: {
              intent: 'customer_debt',
              customerName: finalCustName,
              resolvedCustomerId: resolvedCustomer?.id,
            },
            missingInformation: ['debt_amount'],
            lastPrompt: promptMsg,
          },
          helperText: `Enter the debt amount owed by ${finalCustName}.`,
        },
        plainResponseText: promptMsg,
      };
    }

    const debtEv: BusinessEvent = ensureEventHeadlineAndSummary({
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: understanding.targetCalendarDate || todayStr,
      timeStr,
      type: 'CUSTOMER_DEBT',
      rawUserText: input,
      customerName: finalCustName,
      receivableAdded: owedAmt,
      totalRevenue: 0,
      cashReceived: 0,
      grossProfit: 0,
      systemResponseText: `Recorded: ${finalCustName} is owing ${formatNaira(owedAmt)}. Added to customer debt ledger.`,
    });

    const debtMemories: MemoryUpdateItem[] = [
      {
        type: 'CUSTOMER_DEBT',
        summary: `${finalCustName} balance increased by ${formatNaira(owedAmt)}`,
        data: {
          customerName: finalCustName,
          balanceAdded: owedAmt,
          date: debtEv.date,
        },
      },
    ];

    return {
      isQuestion: false,
      createdEvent: debtEv,
      memoryUpdates: debtMemories,
      plainResponseText: debtEv.systemResponseText,
    };
  }

  // STEP 7: Handle Expenses & Procurement Purchases
  if (intent === 'RECORD_PURCHASE' || intent === 'RECORD_EXPENSE') {
    const isProcurement = intent === 'RECORD_PURCHASE' || entities.supplierReference;
    const qty = entities.quantity || 1;
    const totalAmt = entities.explicitTotalAmount || entities.expenseAmount || 0;
    const supName = entities.supplierReference || 'Supplier';
    const prodName = entities.productReference || 'Stock';

    if (totalAmt <= 0) {
      const promptMsg = 'How much did you spend on this?';
      return {
        isQuestion: false,
        followUpRequired: {
          id: `fu-${Date.now()}`,
          prompt: promptMsg,
          missingField: 'EXPENSE_AMOUNT',
          pendingEvent: {
            rawUserText: input,
            type: 'EXPENSE',
          },
          helperText: 'Enter the amount spent.',
        },
        plainResponseText: promptMsg,
      };
    }

    const expCategory = isProcurement ? 'Procurement' : (entities.expenseCategory || 'Operations');
    const ev: BusinessEvent = ensureEventHeadlineAndSummary({
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: understanding.targetCalendarDate || todayStr,
      timeStr,
      type: 'EXPENSE',
      expenseCategory: expCategory as any,
      expenseAmount: totalAmt,
      rawUserText: input,
      supplierName: isProcurement ? supName : undefined,
      productName: isProcurement ? prodName : undefined,
      quantity: isProcurement ? qty : undefined,
      totalCostAtTime: totalAmt,
      systemResponseText: isProcurement
        ? `Recorded: Bought ${qty} ${prodName} from ${supName} for ${formatNaira(totalAmt)} (Procurement Expense).`
        : `Recorded ${expCategory} expense: ${formatNaira(totalAmt)}.`,
    });

    const expMemories: MemoryUpdateItem[] = [];
    if (isProcurement) {
      const unitCost = Math.round(totalAmt / qty);
      expMemories.push(
        {
          type: 'SUPPLIER_INFO',
          summary: `Supplier ${supName} record updated for ${prodName}`,
          data: { supplierName: supName, note: `Supplied ${qty} ${prodName} for ${formatNaira(totalAmt)}` },
        },
        {
          type: 'PRODUCT_COST',
          summary: `Cost of ${prodName} recorded at ${formatNaira(unitCost)} each`,
          data: { productName: prodName, cost: unitCost, date: ev.date },
        }
      );
    }

    return {
      isQuestion: false,
      createdEvent: ev,
      memoryUpdates: expMemories.length > 0 ? expMemories : undefined,
      plainResponseText: ev.systemResponseText,
    };
  }

  // STEP 8: Handle Product Sales (Core Business Flow)
  const productRef = entities.productReference || 'items';
  const qty = entities.quantity || 1;
  const prodRes = resolveProductSemantic(productRef, state.products);

  // Ambiguity check on product:
  if (prodRes.status === 'ambiguous') {
    const candNames = prodRes.candidates.map((c) => c.name).join(' or ');
    const promptMsg = `Which ${productRef} do you mean — ${candNames}?`;
    return {
      isQuestion: false,
      followUpRequired: {
        id: `fu-${Date.now()}`,
        prompt: promptMsg,
        missingField: 'AMBIGUOUS_CHOICE',
        options: prodRes.candidates.map((c) => c.name),
        pendingEvent: {
          rawUserText: input,
          quantity: qty,
        },
        conversationState: {
          activeIntent: 'sale',
          transactionDraft: {
            quantity: qty,
            customerName: entities.customerReference || undefined,
            cashReceived: entities.cashPaid || undefined,
          },
          missingInformation: ['ambiguous_choice'],
          clarificationOptions: prodRes.candidates.map((c) => c.name),
          lastPrompt: promptMsg,
        },
        helperText: 'Select or reply with the exact product name.',
      },
      plainResponseText: promptMsg,
    };
  }

  const matchedProduct: ProductMemory | null = prodRes.status === 'found' ? prodRes.product : null;
  const finalProdName = matchedProduct ? matchedProduct.name : productRef;

  // Resolve Customer
  const custRef = entities.customerReference;
  const custRes = custRef ? resolveCustomerSemantic(custRef, state.customers) : null;
  const matchedCustomer = custRes && custRes.status === 'found' ? custRes.customer : null;
  const finalCustName = matchedCustomer ? matchedCustomer.name : custRef || undefined;

  // Price Resolution Hierarchy:
  // 1. Explicit price in current message ALWAYS overrides memory default for this transaction!
  // 2. Otherwise, check authoritative Business Memory (matchedProduct.normalSellingPrice)
  // 3. Otherwise, price is unknown -> ask the user!
  let unitPrice: number | null = null;
  let totalRevenue: number | null = null;

  if (entities.explicitUnitPrice && entities.explicitUnitPrice > 0) {
    unitPrice = entities.explicitUnitPrice;
    totalRevenue = unitPrice * qty;
  } else if (entities.explicitTotalAmount && entities.explicitTotalAmount > 0) {
    totalRevenue = entities.explicitTotalAmount;
    unitPrice = totalRevenue / qty;
  } else if (matchedProduct && matchedProduct.normalSellingPrice && matchedProduct.normalSellingPrice > 0) {
    // ACTIVE MEMORY RESOLVES PRICE AUTOMATICALLY!
    unitPrice = matchedProduct.normalSellingPrice;
    totalRevenue = unitPrice * qty;
  }

  // If price is still unknown, ask intelligent follow-up and create active draft!
  if (!unitPrice || unitPrice <= 0 || !totalRevenue || totalRevenue <= 0) {
    const promptMsg = `How much do you normally sell one ${finalProdName.toLowerCase()} for?`;
    return {
      isQuestion: false,
      followUpRequired: {
        id: `fu-${Date.now()}`,
        prompt: promptMsg,
        missingField: 'SELLING_PRICE',
        productName: finalProdName,
        customerName: finalCustName,
        pendingEvent: {
          rawUserText: input,
          productName: finalProdName,
          customerName: finalCustName,
          quantity: qty,
          type: 'SALE',
        },
        conversationState: {
          activeIntent: 'sale',
          transactionDraft: {
            intent: 'sale',
            productName: finalProdName,
            resolvedProductId: matchedProduct?.id,
            quantity: qty,
            customerName: finalCustName,
            cashReceived: entities.cashPaid || undefined,
          },
          missingInformation: ['unit_price'],
          lastPrompt: promptMsg,
        },
        helperText: `Tell me the normal selling price (e.g. ₦25,000 or 25k). I'll remember it in Business Memory for future sales.`,
      },
      plainResponseText: promptMsg,
    };
  }

  // Cash Paid vs Debt
  const cashReceived = entities.cashPaid !== undefined && entities.cashPaid !== null
    ? Math.min(totalRevenue, entities.cashPaid)
    : totalRevenue;
  const receivableAdded = Math.max(0, totalRevenue - cashReceived);

  // Cost & Profit Deterministic Calculation:
  // If product has known cost, calculate exact COGS and profit.
  // If cost is UNKNOWN, profit is UNKNOWN (NEVER hallucinate or equate debt to profit!).
  const costRes = resolveProductCostForUnit(matchedProduct || undefined, entities.unit || undefined, state);
  const unitCost = costRes.unitCost || 0;
  const totalCost = unitCost > 0 ? unitCost * qty : 0;
  const hasKnownCost = unitCost > 0;
  const grossProfit = hasKnownCost ? totalRevenue - totalCost : 0;

  const saleMetrics = computeSaleMetrics({
    quantity: qty,
    totalRevenue,
    cashReceived,
    unitCostAtTime: unitCost,
    costIsEstimate: costRes.isEstimate,
    costEstimateBasis: costRes.costBasis,
  });

  // Construct Natural Language Response:
  let responseText = '';
  if (finalCustName && receivableAdded > 0) {
    responseText = `Recorded sale: ${qty} ${finalProdName} to ${finalCustName} for ${formatNaira(totalRevenue)}. Received ${formatNaira(cashReceived)}, with ${formatNaira(receivableAdded)} remaining as customer debt.`;
  } else {
    responseText = `Recorded ${qty} ${finalProdName} for ${formatNaira(totalRevenue)}.`;
  }

  if (hasKnownCost) {
    responseText += ` Estimated cost: ${formatNaira(totalCost)}, gross profit: ${formatNaira(grossProfit)}.`;
  } else {
    responseText += ` (Cost is not recorded yet, so profit cannot be calculated).`;
  }

  const saleEvent: BusinessEvent = ensureEventHeadlineAndSummary({
    id: `ev-${Date.now()}`,
    timestamp: new Date().toISOString(),
    date: understanding.targetCalendarDate || todayStr,
    timeStr,
    type: 'SALE',
    rawUserText: input,
    systemResponseText: responseText,
    productName: finalProdName,
    customerName: finalCustName,
    quantity: qty,
    unitSellingPrice: unitPrice,
    totalRevenue,
    cashReceived,
    receivableAdded,
    unitCostAtTime: unitCost,
    totalCostAtTime: totalCost,
    grossProfit: hasKnownCost ? grossProfit : 0,
    costIsEstimate: costRes.isEstimate,
    costEstimateBasis: saleMetrics.costEstimateBasis,
  });

  const saleMemories: MemoryUpdateItem[] = [...memoryUpdates];

  if (receivableAdded > 0 && finalCustName) {
    saleMemories.push({
      type: 'CUSTOMER_DEBT',
      summary: `${finalCustName} debt balance increased by ${formatNaira(receivableAdded)}`,
      data: {
        customerName: finalCustName,
        balanceAdded: receivableAdded,
        date: saleEvent.date,
        note: `Debt from sale of ${qty} ${finalProdName}`,
      },
    });
  }

  return {
    isQuestion: false,
    createdEvent: saleEvent,
    memoryUpdates: saleMemories.length > 0 ? saleMemories : undefined,
    plainResponseText: responseText,
  };
}
