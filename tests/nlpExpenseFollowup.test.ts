import { processNaturalInput } from '../src/engine/nlpInterpreter';
import { createEmptyBusinessState } from '../src/data/seedData';
import { calculateDailySummary } from '../src/engine/calculations';

async function runTests() {
  console.log('🧪 Starting NLP, Follow-Up & Expense Tests...\n');

  const state = createEmptyBusinessState('Amina Fashion Store');

  // Test 1: "I sold 3 shirts for 6000" asks intelligent follow-up question
  console.log('▶ TEST 1: Intelligent follow-up question for unknown product cost');
  const t0 = Date.now();
  const res1 = await processNaturalInput('I sold 3 shirts for 6000', state);
  const latency1 = Date.now() - t0;

  if (!res1.followUpRequired) {
    throw new Error('TEST 1 FAILED: Expected followUpRequired to be defined!');
  }
  if (!res1.followUpRequired.prompt.toLowerCase().includes('shirt normally cost')) {
    throw new Error(`TEST 1 FAILED: Expected prompt to ask for shirt cost, got: "${res1.followUpRequired.prompt}"`);
  }
  if (latency1 > 15000) {
    throw new Error(`TEST 1 FAILED: Latency exceeded 15 seconds (${latency1}ms)`);
  }
  console.log(`✅ TEST 1 PASSED in ${latency1}ms: Prompt -> "${res1.followUpRequired.prompt}"`);

  // Test 2: Answering follow-up question with "1500"
  console.log('\n▶ TEST 2: Resolving follow-up question with cost answer "1500"');
  state.pendingFollowUp = res1.followUpRequired;
  const res2 = await processNaturalInput('1500', state);

  if (!res2.createdEvent) {
    throw new Error('TEST 2 FAILED: Expected createdEvent to be defined!');
  }
  if (res2.createdEvent.type !== 'SALE') {
    throw new Error(`TEST 2 FAILED: Expected event type 'SALE', got: ${res2.createdEvent.type}`);
  }
  if (res2.createdEvent.totalRevenue !== 6000) {
    throw new Error(`TEST 2 FAILED: Expected total revenue 6000, got: ${res2.createdEvent.totalRevenue}`);
  }
  if (res2.createdEvent.totalCostAtTime !== 4500) {
    throw new Error(`TEST 2 FAILED: Expected total cost 4500 (3 * 1500), got: ${res2.createdEvent.totalCostAtTime}`);
  }
  if (res2.createdEvent.grossProfit !== 1500) {
    throw new Error(`TEST 2 FAILED: Expected gross profit 1500, got: ${res2.createdEvent.grossProfit}`);
  }
  console.log('✅ TEST 2 PASSED: Sale recorded with ₦6,000 revenue, ₦4,500 cost, and ₦1,500 gross profit.');

  // Test 3: "I bought 30 cartons from Musa at 12k each." logged as Expense
  console.log('\n▶ TEST 3: Stock purchase categorized as Expense (Procurement)');
  state.pendingFollowUp = null;
  const t2 = Date.now();
  const res3 = await processNaturalInput('I bought 30 cartons from Musa at 12k each.', state);
  const latency3 = Date.now() - t2;

  if (!res3.createdEvent) {
    throw new Error('TEST 3 FAILED: Expected createdEvent to be defined!');
  }
  if (res3.createdEvent.type !== 'EXPENSE') {
    throw new Error(`TEST 3 FAILED: Expected event type 'EXPENSE', got: ${res3.createdEvent.type}`);
  }
  if (res3.createdEvent.expenseCategory !== 'Procurement') {
    throw new Error(`TEST 3 FAILED: Expected expense category 'Procurement', got: ${res3.createdEvent.expenseCategory}`);
  }
  if (res3.createdEvent.expenseAmount !== 360000) {
    throw new Error(`TEST 3 FAILED: Expected expense amount 360000 (30 * 12k), got: ${res3.createdEvent.expenseAmount}`);
  }
  if (res3.createdEvent.supplierName !== 'Musa') {
    throw new Error(`TEST 3 FAILED: Expected supplier Musa, got: ${res3.createdEvent.supplierName}`);
  }
  if (res3.createdEvent.productName !== 'Cartons') {
    throw new Error(`TEST 3 FAILED: Expected product Cartons, got: ${res3.createdEvent.productName}`);
  }

  // Check calculations
  const daily = calculateDailySummary([res2.createdEvent, res3.createdEvent], res3.createdEvent.date);
  if (daily.expenses !== 360000) {
    throw new Error(`TEST 3 FAILED: calculateDailySummary expenses expected 360000, got ${daily.expenses}`);
  }
  console.log(`✅ TEST 3 PASSED in ${latency3}ms: Logged ₦360,000 Procurement Expense from Musa.`);

  // Test 4: "John paid me" without amount triggers follow-up
  console.log('\n▶ TEST 4: "John paid me" triggers follow-up and does NOT invent amount');
  const res4 = await processNaturalInput('John paid me', state);
  if (!res4.followUpRequired) {
    throw new Error('TEST 4 FAILED: Expected followUpRequired for "John paid me"');
  }
  if (!res4.followUpRequired.prompt.toLowerCase().includes('how much')) {
    throw new Error(`TEST 4 FAILED: Expected prompt to ask how much, got "${res4.followUpRequired.prompt}"`);
  }
  console.log(`✅ TEST 4 PASSED: Prompt -> "${res4.followUpRequired.prompt}"`);

  // Test 5: Answering "John paid me" follow-up with "5000" records debt payment of 5,000
  console.log('\n▶ TEST 5: Resolving "John paid me" follow-up with "5000"');
  state.pendingFollowUp = res4.followUpRequired;
  const res5 = await processNaturalInput('5000', state);
  if (!res5.createdEvent || res5.createdEvent.type !== 'DEBT_PAYMENT') {
    throw new Error(`TEST 5 FAILED: Expected DEBT_PAYMENT event, got ${res5.createdEvent?.type}`);
  }
  if (res5.createdEvent.cashReceived !== 5000) {
    throw new Error(`TEST 5 FAILED: Expected cashReceived 5000, got ${res5.createdEvent.cashReceived}`);
  }
  if (res5.createdEvent.customerName !== 'John') {
    throw new Error(`TEST 5 FAILED: Expected customerName 'John', got ${res5.createdEvent.customerName}`);
  }
  console.log('✅ TEST 5 PASSED: ₦5,000 debt payment recorded from John.');

  // Test 6: "I sold some rice" without quantity or price triggers follow-up
  console.log('\n▶ TEST 6: "I sold some rice" triggers follow-up and does NOT invent price or qty');
  state.pendingFollowUp = null;
  const res6 = await processNaturalInput('I sold some rice', state);
  if (!res6.followUpRequired) {
    throw new Error('TEST 6 FAILED: Expected followUpRequired for "I sold some rice"');
  }
  if (!res6.followUpRequired.prompt.toLowerCase().includes('rice') || !res6.followUpRequired.prompt.toLowerCase().includes('how much')) {
    throw new Error(`TEST 6 FAILED: Expected prompt to ask for rice details, got "${res6.followUpRequired.prompt}"`);
  }
  console.log(`✅ TEST 6 PASSED: Prompt -> "${res6.followUpRequired.prompt}"`);

  // Test 7: Resolving "I sold some rice" with "2 bags for 120k"
  console.log('\n▶ TEST 7: Resolving rice follow-up with "2 bags for 120k"');
  state.pendingFollowUp = res6.followUpRequired;
  // If rice has no known cost, it will ask for cost, or if we provide cost it records
  const res7 = await processNaturalInput('2 bags for 120k', state);
  if (res7.followUpRequired && res7.followUpRequired.missingField === 'COST_PER_UNIT') {
    console.log(`✅ TEST 7 PASSED: Successfully parsed 2 bags for 120k, now asking for cost: "${res7.followUpRequired.prompt}"`);
  } else if (res7.createdEvent && res7.createdEvent.totalRevenue === 120000) {
    console.log('✅ TEST 7 PASSED: Recorded sale with ₦120,000 revenue.');
  } else {
    throw new Error(`TEST 7 FAILED: Expected either cost follow-up or completed sale, got: ${JSON.stringify(res7)}`);
  }

  // Test 8: "I sold 3 clothes" with product cost ₦39,000 but unknown selling price
  console.log('\n▶ TEST 8: "I sold 3 clothes" must ask for selling price and NEVER invent ₦3 revenue');
  state.pendingFollowUp = null;
  state.products.push({
    id: 'prod-clothes',
    name: 'Clothes',
    category: 'Fashion',
    currentCost: 39000,
    normalSellingPrice: 0, // selling price is unknown
    unit: 'cloth',
    costHistory: [],
    priceHistory: [],
  });

  const res8 = await processNaturalInput('I sold 3 clothes', state);
  if (!res8.followUpRequired) {
    throw new Error(`TEST 8 FAILED: Expected follow-up question for missing selling price, but sale was recorded: ${JSON.stringify(res8.createdEvent)}`);
  }
  if (res8.createdEvent && res8.createdEvent.totalRevenue === 3) {
    throw new Error('TEST 8 FAILED: Severely hallucinated revenue of ₦3 from quantity 3!');
  }
  if (!res8.followUpRequired.prompt.toLowerCase().includes('how much') || !res8.followUpRequired.prompt.toLowerCase().includes('cloth')) {
    throw new Error(`TEST 8 FAILED: Unexpected follow-up prompt: "${res8.followUpRequired.prompt}"`);
  }
  console.log(`✅ TEST 8 PASSED: Follow-up triggered cleanly -> "${res8.followUpRequired.prompt}"`);

  // Test 9: Answering "I sold 3 clothes" follow-up with "45,000"
  console.log('\n▶ TEST 9: Resolving "I sold 3 clothes" follow-up with "45,000"');
  state.pendingFollowUp = res8.followUpRequired;
  const res9 = await processNaturalInput('45000', state);
  if (!res9.createdEvent) {
    throw new Error(`TEST 9 FAILED: Expected createdEvent, got: ${JSON.stringify(res9)}`);
  }
  if (res9.createdEvent.totalRevenue !== 135000) {
    throw new Error(`TEST 9 FAILED: Expected totalRevenue 135000 (3 x 45k), got ${res9.createdEvent.totalRevenue}`);
  }
  if (res9.createdEvent.totalCostAtTime !== 117000) {
    throw new Error(`TEST 9 FAILED: Expected totalCostAtTime 117000 (3 x 39k), got ${res9.createdEvent.totalCostAtTime}`);
  }
  if (res9.createdEvent.grossProfit !== 18000) {
    throw new Error(`TEST 9 FAILED: Expected grossProfit 18000, got ${res9.createdEvent.grossProfit}`);
  }
  console.log('✅ TEST 9 PASSED: Recorded sale with ₦135,000 revenue, ₦117,000 cost, and +₦18,000 gross profit.');

  // Test 10: "I sold 3 clothes" when normal selling price IS in Business Memory
  console.log('\n▶ TEST 10: Active Business Memory automatically calculates revenue when normal selling price is saved');
  state.pendingFollowUp = null;
  const clothesProd = state.products.find((p) => p.name.toLowerCase() === 'clothes');
  if (clothesProd) {
    clothesProd.normalSellingPrice = 50000;
  }
  const res10 = await processNaturalInput('I sold 3 clothes', state);
  if (res10.followUpRequired) {
    throw new Error(`TEST 10 FAILED: Follow-up was asked even though normal selling price ₦50,000 exists in Business Memory: "${res10.followUpRequired.prompt}"`);
  }
  if (!res10.createdEvent || res10.createdEvent.totalRevenue !== 150000) {
    throw new Error(`TEST 10 FAILED: Expected totalRevenue 150000 (3 x 50k), got ${res10.createdEvent?.totalRevenue}`);
  }
  if (res10.createdEvent.grossProfit !== 33000) {
    throw new Error(`TEST 10 FAILED: Expected gross profit 33000 (150k - 117k), got ${res10.createdEvent.grossProfit}`);
  }
  console.log('✅ TEST 10 PASSED: Active Business Memory resolved 3 clothes at ₦50,000 each = ₦150,000 revenue without asking.');

  console.log('\n🎉 ALL NLP & EXPENSE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
