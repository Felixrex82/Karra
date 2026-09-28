import assert from 'node:assert';
import { executeBusinessAction, findTargetEvent, matchCustomerFuzzy, matchProductFuzzy } from '../src/engine/businessEngine';
import { processNaturalInput } from '../src/engine/nlpInterpreter';
import { BusinessState, BusinessEvent, CustomerMemory, ProductMemory } from '../src/types';

console.log('🧪 Starting Karra Beta Intelligence Engine & Business State Tests...\n');

const createBaseState = (): BusinessState => ({
  businessName: "Chuks Provisions & General Store",
  ownerName: "Chuks",
  currency: "NGN",
  events: [
    {
      id: "ev-1",
      timestamp: "2026-09-27T08:00:00Z",
      date: "2026-09-27",
      timeStr: "08:00 AM",
      type: "SALE",
      rawUserText: "Sold 5 cartons of biscuits for 25k",
      systemResponseText: "Recorded sale",
      productName: "Biscuits",
      customerName: "Ada",
      quantity: 5,
      unit: "carton",
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
      id: "ev-2",
      timestamp: "2026-09-27T07:30:00Z",
      date: "2026-09-27",
      timeStr: "07:30 AM",
      type: "EXPENSE",
      rawUserText: "Spent 10k on diesel for generator",
      systemResponseText: "Recorded expense",
      expenseAmount: 10000,
      expenseCategory: "Utilities",
      isCorrected: false,
    },
    {
      id: "ev-3",
      timestamp: "2026-09-26T16:00:00Z",
      date: "2026-09-26",
      timeStr: "04:00 PM",
      type: "SALE",
      rawUserText: "Sold 2 power banks to Emeka for 16k, paid 10k",
      systemResponseText: "Recorded sale",
      productName: "Power Bank",
      customerName: "Emeka",
      quantity: 2,
      unit: "piece",
      unitSellingPrice: 8000,
      totalRevenue: 16000,
      cashReceived: 10000,
      receivableAdded: 6000,
      unitCostAtTime: 5000,
      totalCostAtTime: 10000,
      grossProfit: 6000,
      isCorrected: false,
    },
  ],
  products: [
    {
      id: "prod-1",
      name: "Biscuits",
      unit: "carton",
      currentCost: 3500,
      normalSellingPrice: 5000,
      costHistory: [],
      priceHistory: [],
    },
    {
      id: "prod-2",
      name: "Power Bank",
      unit: "piece",
      currentCost: 5000,
      normalSellingPrice: 8000,
      costHistory: [],
      priceHistory: [],
    },
  ],
  customers: [
    {
      id: "cust-1",
      name: "Chuks",
      outstandingBalance: 80000,
      totalPurchased: 120000,
      totalPaid: 40000,
      lastActivityDate: "2026-09-25",
      history: [],
    },
    {
      id: "cust-2",
      name: "Emeka",
      outstandingBalance: 6000,
      totalPurchased: 16000,
      totalPaid: 10000,
      lastActivityDate: "2026-09-26",
      history: [],
    },
  ],
  suppliers: [
    {
      id: "sup-1",
      name: "Musa",
      itemsSupplied: ["Cartons"],
      currentPrices: { Cartons: 12000 },
      history: [],
    },
  ],
  businessRules: [],
  rules: [],
  unitRelationships: [],
  chatHistory: [],
  pendingFollowUp: null,
});

async function runEngineTests() {
  // TEST 1: Fuzzy matching handles Nigerian English typos without guessing
  console.log('▶ TEST 1: Typo and fuzzy customer matching');
  const state = createBaseState();
  const match1 = matchCustomerFuzzy("I sold 5 items to Chukz", state.customers);
  assert.strictEqual(match1.customer?.name, "Chuks", "Expected 'Chukz' to resolve to 'Chuks'");
  assert.strictEqual(match1.isAmbiguous, false, "Expected unambiguous resolution for single close match");

  const matchAmbiguous = matchCustomerFuzzy("I sold to C", state.customers);
  assert.strictEqual(matchAmbiguous.customer, null, "Should not match single letter");
  console.log('✅ TEST 1 PASSED: "Chukz" resolved to "Chuks" cleanly.\n');

  // TEST 2: Deterministic Target Resolution ("second", "last", "expense")
  console.log('▶ TEST 2: Relative target resolution');
  const targetSecond = findTargetEvent(state, "Delete the second one");
  assert.strictEqual(targetSecond?.id, "ev-2", "Expected second event to be ev-2");

  const targetExpense = findTargetEvent(state, "Remove that expense");
  assert.strictEqual(targetExpense?.type, "EXPENSE", "Expected expense event to be found");

  const targetLast = findTargetEvent(state, "Delete the last transaction");
  assert.strictEqual(targetLast?.id, "ev-1", "Expected most recent event ev-1");
  console.log('✅ TEST 2 PASSED: Target resolution ("second", "expense", "last") accurately identifies events.\n');

  // TEST 3: Deletion execution via deterministic engine
  console.log('▶ TEST 3: Deletion via business engine');
  const deleteRes = executeBusinessAction({
    intent: 'DELETE_EVENT',
    targetEventId: 'ev-2',
  }, state);
  assert.strictEqual(deleteRes.success, true);
  assert.strictEqual(deleteRes.deletedEventId, 'ev-2');
  assert.strictEqual(deleteRes.newState.events.length, 2);
  assert.strictEqual(deleteRes.newState.events.some(e => e.id === 'ev-2'), false);
  console.log('✅ TEST 3 PASSED: Event ev-2 permanently deleted from state.\n');

  // TEST 4: Deletion fails honestly if target does not exist (NO FALSE SUCCESS CLAIM)
  console.log('▶ TEST 4: Truthful failure on invalid deletion target');
  const failDelete = executeBusinessAction({
    intent: 'DELETE_EVENT',
    targetEventId: 'non-existent-id',
    targetDescription: 'some non existent transaction',
  }, { ...state, events: [] });
  assert.strictEqual(failDelete.success, false, "Should fail when transaction does not exist");
  assert(failDelete.message.includes("couldn't delete") || failDelete.message.includes("not found"), "Must report truthful failure message");
  console.log('✅ TEST 4 PASSED: Non-existent transaction fails truthfully with honest error message.\n');

  // TEST 5: Numerical correction ("Actually, it wasn't five. It was eight.")
  console.log('▶ TEST 5: Numerical correction to recent transaction');
  const corrResult = await processNaturalInput("Actually, it wasn't five. It was eight.", state);
  assert.strictEqual(corrResult.isCorrection, true);
  assert.strictEqual(corrResult.correctedEvent?.quantity, 8, "Expected quantity updated to 8");
  assert.strictEqual(corrResult.correctedEvent?.totalRevenue, 40000, "Expected 8 * 5000 = 40,000 revenue");
  assert.strictEqual(corrResult.correctedEvent?.grossProfit, 12000, "Expected 40,000 - (8 * 3500) = 12,000 profit");
  console.log('✅ TEST 5 PASSED: Quantity corrected to 8 with deterministic arithmetic update.\n');

  // TEST 6: Partial payment correction ("Actually, he paid 20k")
  console.log('▶ TEST 6: Partial payment correction');
  const payCorrResult = await processNaturalInput("Actually, he paid 20k", state);
  assert.strictEqual(payCorrResult.isCorrection, true);
  assert.strictEqual(payCorrResult.correctedEvent?.cashReceived, 20000, "Expected cashReceived updated to 20,000");
  assert.strictEqual(payCorrResult.correctedEvent?.receivableAdded, 5000, "Expected 25,000 - 20,000 = 5,000 receivable");
  console.log('✅ TEST 6 PASSED: Partial payment updated to ₦20,000 with ₦5,000 remaining debt.\n');

  // TEST 7: Domain Flexibility across multiple non-clothing/non-rice trades
  console.log('▶ TEST 7: Domain flexibility across multiple Nigerian trades');
  const electronicsSale = executeBusinessAction({
    intent: 'CREATE_SALE',
    productOrServiceName: 'Fast Charger',
    quantity: 3,
    unitPrice: 4000,
    cashReceived: 12000,
    customerName: 'Obinna',
  }, state);
  assert.strictEqual(electronicsSale.success, true);
  assert.strictEqual(electronicsSale.createdEvent?.productName, 'Fast Charger');
  assert.strictEqual(electronicsSale.createdEvent?.totalRevenue, 12000);

  const salonService = executeBusinessAction({
    intent: 'CREATE_SALE',
    productOrServiceName: 'Goddess Braids',
    itemType: 'service',
    quantity: 1,
    totalAmount: 15000,
    cashReceived: 15000,
    customerName: 'Fatima',
  }, state);
  assert.strictEqual(salonService.success, true);
  assert.strictEqual(salonService.createdEvent?.productName, 'Goddess Braids');
  assert.strictEqual(salonService.createdEvent?.unitCostAtTime, 0, "Service has ₦0 cost of goods");
  assert.strictEqual(salonService.createdEvent?.grossProfit, 15000);
  console.log('✅ TEST 7 PASSED: Electronics and Salon services recorded with exact domain economics.\n');

  // TEST 8: Stock procurement expense and debt recording
  console.log('▶ TEST 8: Stock procurement & Customer debt recording');
  const purchaseRes = executeBusinessAction({
    intent: 'RECORD_PURCHASE',
    productOrServiceName: 'Engine Oil',
    supplierName: 'Musa',
    quantity: 20,
    unitPrice: 6000,
    unit: 'carton',
  }, state);
  assert.strictEqual(purchaseRes.success, true);
  assert.strictEqual(purchaseRes.createdEvent?.type, 'PURCHASE_STOCK');
  assert.strictEqual(purchaseRes.createdEvent?.expenseAmount, 120000);
  assert(purchaseRes.newState.products.some(p => p.name === 'Engine Oil' && p.currentCost === 6000));

  const debtRes = executeBusinessAction({
    intent: 'RECORD_DEBT',
    customerName: 'David',
    totalAmount: 30000,
  }, state);
  assert.strictEqual(debtRes.success, true);
  assert.strictEqual(debtRes.createdEvent?.type, 'CUSTOMER_DEBT');
  assert(debtRes.newState.customers.some(c => c.name === 'David' && c.outstandingBalance === 30000));
  console.log('✅ TEST 8 PASSED: Procurement and debt recording verified.\n');

  // TEST 9: "I bought so and so" parsed as EXPENSE, NEVER A SALE
  console.log('▶ TEST 9: "I bought" parsed as EXPENSE (outflow), never SALE');
  const boughtFuel = await processNaturalInput("I bought fuel 5000", state);
  assert.strictEqual(boughtFuel.createdEvent?.type, 'EXPENSE', 'Must be EXPENSE type');
  assert.strictEqual(boughtFuel.createdEvent?.expenseAmount, 5000);
  assert.strictEqual(boughtFuel.createdEvent?.totalRevenue, 0, 'No sale revenue for expense');

  const boughtItem = await processNaturalInput("I bought nylon for 8k", state);
  assert.strictEqual(boughtItem.createdEvent?.type, 'EXPENSE', 'Must be EXPENSE type');
  assert.strictEqual(boughtItem.createdEvent?.expenseAmount, 8000);

  const boughtNoAmt = await processNaturalInput("I bought so and so", state);
  assert(boughtNoAmt.followUpRequired, 'Needs follow up for missing amount');
  assert.strictEqual(boughtNoAmt.followUpRequired?.pendingEvent?.type, 'EXPENSE', 'Pending event is EXPENSE');
  console.log('✅ TEST 9 PASSED: "I bought" statements deterministically interpreted as EXPENSE.\n');

  // TEST 10: Delete Product & Delete Customer from Memory
  console.log('▶ TEST 10: Deletion of Products and Customers from Memory');
  const delProdRes = executeBusinessAction({
    intent: 'DELETE_PRODUCT',
    productOrServiceName: 'Biscuits',
  }, state);
  assert.strictEqual(delProdRes.success, true);
  assert(!delProdRes.newState.products.some(p => p.name === 'Biscuits'), 'Product removed from memory');
  assert.strictEqual(delProdRes.deletedProductId, 'prod-1');

  const delCustRes = executeBusinessAction({
    intent: 'DELETE_CUSTOMER',
    customerName: 'Chuks',
  }, state);
  assert.strictEqual(delCustRes.success, true);
  assert(!delCustRes.newState.customers.some(c => c.name === 'Chuks'), 'Customer removed from memory');
  console.log('✅ TEST 10 PASSED: Deletion from Business and Customer Memory verified.\n');

  // TEST 11: Edit product price / cost
  console.log('▶ TEST 11: Edit product price / cost in memory');
  const editProdRes = executeBusinessAction({
    intent: 'UPDATE_PRODUCT',
    productOrServiceName: 'Power Bank',
    totalAmount: 10000,
  }, state);
  assert.strictEqual(editProdRes.success, true);
  const updatedPowerBank = editProdRes.newState.products.find(p => p.id === 'prod-2');
  assert.strictEqual(updatedPowerBank?.normalSellingPrice, 10000, 'Price updated to 10k');
  console.log('✅ TEST 11 PASSED: Product price edited successfully.\n');

  console.log('🎉 ALL 11 BETA INTELLIGENCE ENGINE TESTS PASSED SUCCESSFULLY!\n');
}

runEngineTests().catch((err) => {
  console.error('❌ Beta Intelligence Test Failure:', err);
  process.exit(1);
});
