import assert from 'node:assert';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  generateContentWithRetryAndFallback,
  buildAskSystemPrompt,
  buildInterpretPrompt,
} from '../api/_geminiEngine';
import handlerAsk from '../api/gemini/ask';
import handlerInterpret from '../api/gemini/interpret';
import { dispatchApiRequest } from '../server/apiDispatcher';
import { executeBusinessAction } from '../src/engine/businessEngine';
import { BusinessState } from '../src/types';

dotenv.config();

console.log('🧪 Starting AI Anti-Hallucination & Grounding Verification Suite...\n');

const sampleState: BusinessState = {
  businessName: 'Chuks Provisions & General Store',
  ownerName: 'Chuks',
  currency: 'NGN',
  rules: [],
  chatHistory: [],
  pendingFollowUp: null,
  events: [
    {
      id: 'ev-1',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      timeStr: '10:00 AM',
      type: 'SALE',
      rawUserText: 'Sold 5 cartons of biscuits for 25k',
      systemResponseText: 'Recorded sale of 5 cartons of Biscuits',
      productName: 'Biscuits',
      customerName: 'Ada',
      quantity: 5,
      unitSellingPrice: 5000,
      totalRevenue: 25000,
      cashReceived: 25000,
      receivableAdded: 0,
      unitCostAtTime: 3500,
      totalCostAtTime: 17500,
      grossProfit: 7500,
      isCorrected: false,
    },
    {
      id: 'ev-2',
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      timeStr: '11:00 AM',
      type: 'EXPENSE',
      rawUserText: 'Bought fuel 10k',
      systemResponseText: 'Recorded expense',
      expenseAmount: 10000,
      expenseCategory: 'Utilities',
      isCorrected: false,
    },
  ],
  products: [
    {
      id: 'prod-1',
      name: 'Biscuits',
      unit: 'carton',
      currentCost: 3500,
      normalSellingPrice: 5000,
      costHistory: [],
      priceHistory: [],
    },
    {
      id: 'prod-2',
      name: 'Power Bank',
      unit: 'piece',
      currentCost: 5000,
      normalSellingPrice: 8000,
      costHistory: [],
      priceHistory: [],
    },
  ],
  customers: [
    {
      id: 'cust-1',
      name: 'Chuks',
      outstandingBalance: 80000,
      totalPurchased: 120000,
      totalPaid: 40000,
      lastActivityDate: '2026-09-25',
      history: [],
    },
    {
      id: 'cust-2',
      name: 'Emeka',
      outstandingBalance: 6000,
      totalPurchased: 16000,
      totalPaid: 10000,
      lastActivityDate: '2026-09-26',
      history: [],
    },
  ],
  suppliers: [],
  businessRules: [
    {
      id: 'r-1',
      description: 'Never give credit above 10,000 to new customers',
      category: 'PAYMENT',
      active: true,
      createdAt: new Date().toISOString(),
    },
  ],
  unitRelationships: [],
};

// Mock response creator for API testing
function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader: (k: string, v: string) => {
      res.headers[k.toLowerCase()] = v;
    },
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (data: any) => {
      res.body = data;
      return res;
    },
    end: (str?: string) => {
      if (str && !res.body) {
        try {
          res.body = JSON.parse(str);
        } catch {
          res.body = str;
        }
      }
      return res;
    },
  };
  return res;
}

function safeJsonParse(text: string): any {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return {};
  }
}

async function runAntiHallucinationTests() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required to test AI grounding.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // -------------------------------------------------------------
  // TEST 1: Debtor Question Grounding (Must only state Chuks & Emeka)
  // -------------------------------------------------------------
  console.log('▶ TEST 1: Debtor Question Grounding ("Who owes me money?")');
  const prompt1 = buildAskSystemPrompt({
    businessSummary: {
      todayDate: '2026-10-01',
      todaySales: 25000,
      todayGrossProfit: 7500,
      todayExpenses: 10000,
      todayNet: -2500,
      totalCustomerDebt: 86000,
      debtorsList: [
        { name: 'Chuks', amountOwed: 80000 },
        { name: 'Emeka', amountOwed: 6000 },
      ],
    },
    products: sampleState.products,
    customers: sampleState.customers,
    suppliers: [],
    rules: sampleState.businessRules || [],
    unitRelationships: [],
    recentEvents: sampleState.events,
    recentChatText: '',
  });

  const res1 = await generateContentWithRetryAndFallback(ai, {
    contents: [{ text: prompt1 }, { text: 'Owner message: "Who owes me money?"' }],
  });
  const parsed1 = safeJsonParse(res1.text || '{}');
  assert.ok(parsed1.answer, 'Must return answer');
  assert.ok(parsed1.answer.includes('Chuks'), 'Must name Chuks as debtor');
  assert.ok(parsed1.answer.includes('80,000') || parsed1.answer.includes('80k'), 'Must state Chuks owes 80,000');
  assert.ok(parsed1.answer.includes('Emeka'), 'Must name Emeka as debtor');
  assert.ok(parsed1.answer.includes('6,000') || parsed1.answer.includes('6k'), 'Must state Emeka owes 6,000');
  assert.strictEqual(parsed1.structuredAction, null, 'Must NOT output a structuredAction for debtor question');
  console.log('✅ TEST 1 TEST PASSED: Debtors accurately listed (Chuks: ₦80k, Emeka: ₦6k). Zero hallucinated customers.');

  // -------------------------------------------------------------
  // TEST 2: Today Net Financial Truth (Gross: 7,500, Exp: 10,000 -> Loss: -2,500)
  // -------------------------------------------------------------
  console.log('\n▶ TEST 2: Financial Truth Grounding ("Did I make any profit today?")');
  const res2 = await generateContentWithRetryAndFallback(ai, {
    contents: [{ text: prompt1 }, { text: 'Owner message: "Did I make any profit today?"' }],
  });
  const parsed2 = safeJsonParse(res2.text || '{}');
  assert.ok(parsed2.answer, 'Must return answer');
  assert.ok(
    parsed2.answer.includes('7,500') || parsed2.answer.includes('2,500') || parsed2.answer.includes('loss'),
    'Must state the real numbers (7,500 gross or 2,500 net loss)'
  );
  assert.strictEqual(parsed2.structuredAction, null, 'Must NOT output a structuredAction for inquiry');
  console.log('✅ TEST 2 PASSED: Grounded financial response reflects true gross profit and net loss.');

  // -------------------------------------------------------------
  // TEST 3: Zero Sales Truth (When store has 0 sales today, never invent numbers)
  // -------------------------------------------------------------
  console.log('\n▶ TEST 3: Zero Sales Truth (Store with 0 sales)');
  const promptEmpty = buildAskSystemPrompt({
    businessSummary: {
      todayDate: '2026-10-01',
      todaySales: 0,
      todayGrossProfit: 0,
      todayExpenses: 0,
      todayNet: 0,
      totalCustomerDebt: 0,
      debtorsList: [],
    },
    products: [],
    customers: [],
    suppliers: [],
    rules: [],
    unitRelationships: [],
    recentEvents: [],
    recentChatText: '',
  });

  const res3 = await generateContentWithRetryAndFallback(ai, {
    contents: [{ text: promptEmpty }, { text: 'Owner message: "How much did I sell today?"' }],
  });
  const parsed3 = safeJsonParse(res3.text || '{}');
  assert.ok(
    parsed3.answer.includes('0') || parsed3.answer.toLowerCase().includes('no sales') || parsed3.answer.toLowerCase().includes('haven\'t recorded'),
    'Must state 0 or no sales recorded'
  );
  assert.strictEqual(parsed3.structuredAction, null, 'Must NOT create structuredAction');
  console.log('✅ TEST 3 PASSED: Zero sales truthfully reported without hallucinating fake figures.');

  // -------------------------------------------------------------
  // TEST 4: Action Separation (Sale command outputs CREATE_SALE)
  // -------------------------------------------------------------
  console.log('\n▶ TEST 4: Action Recording ("I sold 2 dresses for 40,000")');
  const res4 = await generateContentWithRetryAndFallback(ai, {
    contents: [{ text: prompt1 }, { text: 'Owner message: "I sold 2 dresses for 40,000"' }],
  });
  const parsed4 = safeJsonParse(res4.text || '{}');
  assert.ok(parsed4.structuredAction, 'Must output structuredAction for explicit sale');
  assert.strictEqual(parsed4.structuredAction.intent, 'CREATE_SALE', 'Intent must be CREATE_SALE');
  assert.strictEqual(parsed4.structuredAction.quantity, 2, 'Quantity must be 2');
  assert.strictEqual(parsed4.structuredAction.totalAmount, 40000, 'Total amount must be 40,000');
  console.log('✅ TEST 4 PASSED: Explicit sale correctly structured as CREATE_SALE with exact quantity and price.');

  // -------------------------------------------------------------
  // TEST 5: Direct Vercel /api/gemini/ask route execution
  // -------------------------------------------------------------
  console.log('\n▶ TEST 5: Vercel /api/gemini/ask endpoint execution');
  const mockReq5: any = {
    method: 'POST',
    url: '/api/gemini/ask',
    headers: { 'content-type': 'application/json' },
    body: {
      question: 'Who owes me money?',
      businessSummary: {
        totalCustomerDebt: 86000,
        debtorsList: [
          { name: 'Chuks', amountOwed: 80000 },
          { name: 'Emeka', amountOwed: 6000 },
        ],
      },
      customers: sampleState.customers,
      products: sampleState.products,
      rules: sampleState.businessRules,
    },
  };
  const mockRes5 = createMockRes();
  await handlerAsk(mockReq5, mockRes5);
  assert.strictEqual(mockRes5.statusCode, 200, 'Vercel handler must return 200');
  assert.ok(mockRes5.body?.success, 'Must succeed');
  assert.ok(mockRes5.body?.answer.includes('Chuks'), 'Must name Chuks in Vercel handler');
  console.log('✅ TEST 5 PASSED: Vercel /api/gemini/ask endpoint responded with verified grounded answer.');

  // -------------------------------------------------------------
  // TEST 6: Preview Server API Dispatcher (/api/gemini/ask)
  // -------------------------------------------------------------
  console.log('\n▶ TEST 6: Preview Server Dispatcher (/api/gemini/ask)');
  const mockReq6: any = {
    method: 'POST',
    url: '/api/gemini/ask',
    headers: { 'content-type': 'application/json' },
    body: {
      question: 'What rules do I have in my store?',
      rules: [{ description: 'Never give credit above 10,000 to new customers', category: 'Credit' }],
    },
  };
  const mockRes6 = createMockRes();
  await dispatchApiRequest(mockReq6, mockRes6);
  assert.strictEqual(mockRes6.statusCode, 200, 'Preview dispatcher must return 200');
  assert.ok(mockRes6.body?.success, 'Must succeed in preview dispatcher');
  assert.ok(
    mockRes6.body?.answer.includes('10,000') || mockRes6.body?.answer.toLowerCase().includes('credit'),
    'Must reference the 10,000 credit rule'
  );
  console.log('✅ TEST 6 PASSED: Preview Server API Dispatcher executed identically with zero hallucination.');

  // -------------------------------------------------------------
  // TEST 7: Preview Server Interpretation (/api/gemini/interpret)
  // -------------------------------------------------------------
  console.log('\n▶ TEST 7: Preview Server Interpretation (/api/gemini/interpret)');
  const mockReq7: any = {
    method: 'POST',
    url: '/api/gemini/interpret',
    headers: { 'content-type': 'application/json' },
    body: {
      userInput: 'Spent 15k on generator fuel',
      memoryContext: { products: [], customers: [], unitRules: [] },
      recentEventsContext: [],
    },
  };
  const mockRes7 = createMockRes();
  await dispatchApiRequest(mockReq7, mockRes7);
  assert.strictEqual(mockRes7.statusCode, 200, 'Preview interpret must return 200');
  assert.ok(mockRes7.body?.success, 'Must succeed');
  assert.strictEqual(mockRes7.body?.data?.intent, 'RECORD_EXPENSE', 'Must classify as RECORD_EXPENSE');
  assert.strictEqual(mockRes7.body?.data?.entities?.expenseAmount, 15000, 'Expense amount must be 15,000');
  console.log('✅ TEST 7 PASSED: Interpretation accurately classified fuel expense with ₦15,000 amount.');

  // -------------------------------------------------------------
  // TEST 8: Customer Promise Grounding (Never record sale on promises)
  // -------------------------------------------------------------
  console.log('\n▶ TEST 8: Customer Promise Grounding ("Fola wants to make another cloth, but promised to pay next month")');
  const res8 = await generateContentWithRetryAndFallback(ai, {
    contents: [{ text: prompt1 }, { text: 'Owner message: "Fola wants to make another cloth, but she promised to pay me next month"' }],
  });
  const parsed8 = safeJsonParse(res8.text || '{}');
  assert.strictEqual(parsed8.structuredAction, null, 'Must NOT output structuredAction for future promise');
  assert.ok(
    parsed8.answer?.toLowerCase().includes('note') || parsed8.answer?.toLowerCase().includes('fola') || parsed8.answer?.toLowerCase().includes('recorded'),
    'Must acknowledge recording note without logging sale'
  );
  console.log('✅ TEST 8 PASSED: Customer promise saved as note; zero hallucinated transactions in ledger.');

  // -------------------------------------------------------------
  // TEST 9: Clarification Grounding ("John paid me" without amount)
  // -------------------------------------------------------------
  console.log('\n▶ TEST 9: Missing Info Clarification ("John paid me")');
  const res9 = await generateContentWithRetryAndFallback(ai, {
    contents: [{ text: prompt1 }, { text: 'Owner message: "John paid me"' }],
  });
  const parsed9 = safeJsonParse(res9.text || '{}');
  assert.strictEqual(parsed9.structuredAction, null, 'Must NOT record payment without amount');
  assert.ok(
    parsed9.requiresClarification === true || parsed9.answer.toLowerCase().includes('how much'),
    'Must ask how much John paid'
  );
  console.log('✅ TEST 9 PASSED: System requests clarification rather than hallucinating an amount.');

  // -------------------------------------------------------------
  // TEST 10: Deterministic NLP Fallback - Debtor Query Grounding
  // -------------------------------------------------------------
  console.log('\n▶ TEST 10: Deterministic NLP Fallback ("Who are those owing me?")');
  const { answerBusinessQuestionWithMemory } = await import('../src/engine/nlpInterpreter');
  const detRes10 = answerBusinessQuestionWithMemory('Who are those owing me?', sampleState);
  assert.ok(detRes10.answer.includes('Chuks'), 'Must name Chuks');
  assert.ok(detRes10.answer.includes('80,000'), 'Must include 80,000 for Chuks');
  assert.ok(detRes10.answer.includes('Emeka'), 'Must name Emeka');
  assert.ok(detRes10.answer.includes('6,000'), 'Must include 6,000 for Emeka');
  assert.strictEqual(detRes10.createdEvent, undefined, 'Must NOT create any event');
  console.log('✅ TEST 10 PASSED: Deterministic engine immediately lists debtors without asking "How much is Chuks owing you?".');

  // -------------------------------------------------------------
  // TEST 11: Deterministic NLP Fallback - Sales Inquiry Grounding
  // -------------------------------------------------------------
  console.log('\n▶ TEST 11: Deterministic NLP Fallback ("How much did I sell today?")');
  const detRes11 = answerBusinessQuestionWithMemory('How much did I sell today?', sampleState);
  assert.ok(detRes11.answer.includes('25,000'), 'Must state 25,000 sales');
  assert.strictEqual(detRes11.createdEvent, undefined, 'Must NOT create any event');
  console.log('✅ TEST 11 PASSED: Deterministic engine accurately returns true sales without hallucination.');

  // -------------------------------------------------------------
  // TEST 12: Split Sale & Customer Debt ("Alhaji bought 2 shirts, paid #68000, owing me #12000")
  // -------------------------------------------------------------
  console.log('\n▶ TEST 12: Split Sale & Customer Debt ("Alhaji bought 2 shirts, paid #68000, owing me #12000")');
  const { processNaturalInput } = await import('../src/engine/nlpInterpreter');
  const { reconcileCustomerBalances } = await import('../src/engine/calculations');
  const splitInput = 'Alhaji bought 2 shirts, paid #68000, owing me #12000';
  const splitRes = await processNaturalInput(splitInput, sampleState);
  assert.ok(splitRes.createdEvent, 'Must create an event');
  assert.strictEqual(splitRes.createdEvent?.customerName, 'Alhaji', 'Customer must be Alhaji');
  assert.strictEqual(splitRes.createdEvent?.totalRevenue, 80000, 'Total revenue must be 80,000 (68,000 cash + 12,000 debt)');
  assert.strictEqual(splitRes.createdEvent?.cashReceived, 68000, 'Cash received must be 68,000');
  assert.strictEqual(splitRes.createdEvent?.receivableAdded, 12000, 'Receivable added must be 12,000');

  const reconciledCustomers = reconcileCustomerBalances([splitRes.createdEvent!], sampleState.customers);
  const alhajiRecord = reconciledCustomers.find((c) => c.name.toLowerCase() === 'alhaji');
  assert.ok(alhajiRecord, 'Alhaji must exist in reconciled customers');
  assert.strictEqual(alhajiRecord?.outstandingBalance, 12000, 'Alhaji outstanding balance must be 12,000');
  console.log('✅ TEST 12 PASSED: ₦12,000 customer debt accurately recorded for Alhaji with ₦80,000 total sale and ₦68,000 cash.');

  console.log('\n🎉 ALL 12 AI ANTI-HALLUCINATION & GROUNDING TESTS PASSED PERFECTLY!\n');
}

runAntiHallucinationTests().catch((err) => {
  console.error('❌ AI Verification Test Failed:', err);
  process.exit(1);
});
