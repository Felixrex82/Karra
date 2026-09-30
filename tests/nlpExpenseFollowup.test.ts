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

  // Test 11: "Delivered 2 native outfits to Alhaji for 40k"
  console.log('\n▶ TEST 11: "Delivered 2 native outfits to Alhaji for 40k" extracts quantity 2, cost for 2 units, and Alhaji as customer');
  state.pendingFollowUp = null;
  state.products.push({
    id: 'prod-native-outfits',
    name: 'Native Outfits',
    category: 'Fashion',
    currentCost: 17300,
    normalSellingPrice: 20000,
    unit: 'outfit',
    costHistory: [],
    priceHistory: [],
  });

  const res11 = await processNaturalInput('Delivered 2 native outfits to Alhaji for 40k', state);
  if (!res11.createdEvent) {
    throw new Error(`TEST 11 FAILED: Expected createdEvent, got: ${JSON.stringify(res11)}`);
  }
  if (res11.createdEvent.quantity !== 2) {
    throw new Error(`TEST 11 FAILED: Expected quantity 2, but got ${res11.createdEvent.quantity}`);
  }
  if (res11.createdEvent.customerName !== 'Alhaji') {
    throw new Error(`TEST 11 FAILED: Expected customerName 'Alhaji', got '${res11.createdEvent.customerName}'`);
  }
  if (res11.createdEvent.totalRevenue !== 40000) {
    throw new Error(`TEST 11 FAILED: Expected totalRevenue 40000, got ${res11.createdEvent.totalRevenue}`);
  }
  if (res11.createdEvent.unitSellingPrice !== 20000) {
    throw new Error(`TEST 11 FAILED: Expected unitSellingPrice 20000 (40k / 2), got ${res11.createdEvent.unitSellingPrice}`);
  }
  if (res11.createdEvent.totalCostAtTime !== 34600) {
    throw new Error(`TEST 11 FAILED: Expected totalCostAtTime 34600 (2 x 17300), got ${res11.createdEvent.totalCostAtTime}`);
  }
  if (res11.createdEvent.grossProfit !== 5400) {
    throw new Error(`TEST 11 FAILED: Expected grossProfit 5400 (40000 - 34600), got ${res11.createdEvent.grossProfit}`);
  }
  console.log('✅ TEST 11 PASSED: Exactly 2 native outfits logged to Alhaji for ₦40,000 (Cost: ₦34,600, Gross Profit: ₦5,400).');

  // Test 12: Interruption of follow-up by a brand new transaction does NOT corrupt or swallow input
  console.log('\n▶ TEST 12: Starting new transaction while follow-up is pending supersedes follow-up and logs sale');
  state.pendingFollowUp = null;
  const resFollowUp = await processNaturalInput('I sold 3 kaftans', state);
  if (!resFollowUp.followUpRequired) {
    throw new Error('TEST 12 FAILED: Expected follow-up for "I sold 3 kaftans"');
  }
  state.pendingFollowUp = resFollowUp.followUpRequired;

  // Now user says "delivered 2 outfits to Alhaji for 40k" instead of answering cost
  const res12 = await processNaturalInput('delivered 2 outfits to Alhaji for 40k', state);
  if (!res12.createdEvent) {
    throw new Error(`TEST 12 FAILED: Expected createdEvent for delivered 2 outfits, got: ${JSON.stringify(res12)}`);
  }
  if (res12.createdEvent.quantity !== 2) {
    throw new Error(`TEST 12 FAILED: Expected quantity 2, got ${res12.createdEvent.quantity}`);
  }
  if (res12.createdEvent.customerName !== 'Alhaji') {
    throw new Error(`TEST 12 FAILED: Expected customerName 'Alhaji', got '${res12.createdEvent.customerName}'`);
  }
  if (res12.createdEvent.totalRevenue !== 40000) {
    throw new Error(`TEST 12 FAILED: Expected totalRevenue 40000, got ${res12.createdEvent.totalRevenue}`);
  }
  console.log('✅ TEST 12 PASSED: Pending follow-up was superseded cleanly; 2 outfits logged to Alhaji for ₦40,000.');

  // Test 13: Delivery to new customer with unlisted product records immediately without blocking
  console.log('\n▶ TEST 13: Fresh delivery with unlisted product records immediately without cost obstruction');
  state.pendingFollowUp = null;
  const res13 = await processNaturalInput('delivered 2 outfits to Alhaji for 40k', state);
  if (!res13.createdEvent) {
    throw new Error(`TEST 13 FAILED: Expected createdEvent, got: ${JSON.stringify(res13)}`);
  }
  if (res13.createdEvent.quantity !== 2) {
    throw new Error(`TEST 13 FAILED: Expected quantity 2, got ${res13.createdEvent.quantity}`);
  }
  if (res13.createdEvent.customerName !== 'Alhaji') {
    throw new Error(`TEST 13 FAILED: Expected customerName 'Alhaji', got '${res13.createdEvent.customerName}'`);
  }
  console.log('✅ TEST 13 PASSED: Recorded delivery of 2 outfits to Alhaji for ₦40,000 without getting blocked.');

  // Test 14: User says "cancel" to dismiss follow-up
  console.log('\n▶ TEST 14: User says "cancel" to clear active follow-up');
  state.pendingFollowUp = resFollowUp.followUpRequired;
  const res14 = await processNaturalInput('cancel', state);
  if (res14.createdEvent) {
    throw new Error('TEST 14 FAILED: Cancel should not create event');
  }
  if (!res14.plainResponseText.toLowerCase().includes('cancel')) {
    throw new Error(`TEST 14 FAILED: Expected cancel confirmation, got "${res14.plainResponseText}"`);
  }
  console.log('✅ TEST 14 PASSED: Follow-up cancelled cleanly.');

  // Test 15: Generator fuel expense logged on first try with event created
  console.log('\n▶ TEST 15: "Spent 12k on shop generator fuel" creates Expense event immediately');
  state.pendingFollowUp = null;
  const res15 = await processNaturalInput('Spent 12k on shop generator fuel.', state);
  if (!res15.createdEvent) {
    throw new Error(`TEST 15 FAILED: Expected createdEvent, got: ${JSON.stringify(res15)}`);
  }
  if (res15.createdEvent.type !== 'EXPENSE') {
    throw new Error(`TEST 15 FAILED: Expected EXPENSE event, got ${res15.createdEvent.type}`);
  }
  if (res15.createdEvent.expenseAmount !== 12000) {
    throw new Error(`TEST 15 FAILED: Expected expenseAmount 12000, got ${res15.createdEvent.expenseAmount}`);
  }
  if (res15.createdEvent.expenseCategory !== 'Utilities') {
    throw new Error(`TEST 15 FAILED: Expected expenseCategory 'Utilities', got '${res15.createdEvent.expenseCategory}'`);
  }
  console.log('✅ TEST 15 PASSED: ₦12,000 generator fuel expense recorded on first try with Utilities category.');

  // Test 16: Power banks sale with partial payment and remaining debt
  console.log('\n▶ TEST 16: "sold 3 power banks to emeka for 45k, he paid 30k remaining 15k as debts" logs sale and debt');
  state.pendingFollowUp = null;
  const res16 = await processNaturalInput('sold 3 power banks to emeka for 45k, he paid 30k remaining 15k as debts', state);
  if (!res16.createdEvent) {
    throw new Error(`TEST 16 FAILED: Expected createdEvent, got: ${JSON.stringify(res16)}`);
  }
  if (res16.createdEvent.type !== 'SALE') {
    throw new Error(`TEST 16 FAILED: Expected SALE event, got ${res16.createdEvent.type}`);
  }
  if (res16.createdEvent.quantity !== 3) {
    throw new Error(`TEST 16 FAILED: Expected quantity 3, got ${res16.createdEvent.quantity}`);
  }
  if (res16.createdEvent.totalRevenue !== 45000) {
    throw new Error(`TEST 16 FAILED: Expected totalRevenue 45000, got ${res16.createdEvent.totalRevenue}`);
  }
  if (res16.createdEvent.cashReceived !== 30000) {
    throw new Error(`TEST 16 FAILED: Expected cashReceived 30000, got ${res16.createdEvent.cashReceived}`);
  }
  if (res16.createdEvent.receivableAdded !== 15000) {
    throw new Error(`TEST 16 FAILED: Expected receivableAdded 15000, got ${res16.createdEvent.receivableAdded}`);
  }
  if (res16.createdEvent.customerName !== 'Emeka') {
    throw new Error(`TEST 16 FAILED: Expected customerName 'Emeka', got '${res16.createdEvent.customerName}'`);
  }
  const debtUpdate16 = res16.memoryUpdates?.find(m => m.type === 'CUSTOMER_DEBT');
  if (!debtUpdate16 || debtUpdate16.data.balanceAdded !== 15000) {
    throw new Error(`TEST 16 FAILED: Expected CUSTOMER_DEBT memory update with 15000, got ${JSON.stringify(debtUpdate16)}`);
  }
  console.log('✅ TEST 16 PASSED: 3 power banks sold to Emeka for ₦45k with ₦30k cash and ₦15k debt recorded cleanly.');

  // Test 17: Front-loaded quantity power banks sale with debt
  console.log('\n▶ TEST 17: "3 power banks I sold to emeka for 45k, remaining 15k as debts"');
  state.pendingFollowUp = null;
  const res17 = await processNaturalInput('3 power banks I sold to emeka for 45k, remaining 15k as debts', state);
  if (!res17.createdEvent || res17.createdEvent.quantity !== 3 || res17.createdEvent.receivableAdded !== 15000 || res17.createdEvent.customerName !== 'Emeka') {
    throw new Error(`TEST 17 FAILED: Unexpected event: ${JSON.stringify(res17.createdEvent)}`);
  }
  console.log('✅ TEST 17 PASSED: Front-loaded quantity statement properly recorded ₦15k debt to Emeka.');

  // Test 18: Hair braiding salon service recorded immediately without cost obstruction
  console.log('\n▶ TEST 18: "Did hair braids for customer, received 15k cash." records immediately');
  state.pendingFollowUp = null;
  const res18 = await processNaturalInput('Did hair braids for customer, received 15k cash.', state);
  if (!res18.createdEvent) {
    throw new Error(`TEST 18 FAILED: Expected createdEvent, got: ${JSON.stringify(res18)}`);
  }
  if (res18.createdEvent.totalRevenue !== 15000 || res18.createdEvent.cashReceived !== 15000) {
    throw new Error(`TEST 18 FAILED: Expected revenue 15000, got ${res18.createdEvent.totalRevenue}`);
  }
  if (res18.createdEvent.productName !== 'Hair Braids') {
    throw new Error(`TEST 18 FAILED: Expected productName 'Hair Braids', got '${res18.createdEvent.productName}'`);
  }
  console.log('✅ TEST 18 PASSED: Salon hair braiding service logged immediately with ₦15,000 revenue.');

  // Test 19: Dynamic service detection for newly onboarded trade (Automotive/Cleaning - Car Wash)
  console.log('\n▶ TEST 19: "Did car wash for customer, received 3k cash" dynamically recognized as service');
  state.pendingFollowUp = null;
  const res19 = await processNaturalInput('Did car wash for customer, received 3k cash', state);
  if (!res19.createdEvent || res19.createdEvent.totalRevenue !== 3000 || res19.createdEvent.cashReceived !== 3000) {
    throw new Error(`TEST 19 FAILED: Expected createdEvent with 3000 revenue, got: ${JSON.stringify(res19)}`);
  }
  if (!res19.createdEvent.productName || !res19.createdEvent.productName.toLowerCase().includes('car wash')) {
    throw new Error(`TEST 19 FAILED: Expected car wash service, got ${res19.createdEvent.productName}`);
  }
  console.log('✅ TEST 19 PASSED: Car wash service recorded immediately without unit cost obstruction.');

  // Test 20: Dynamic service detection with partial debt (Installation / Trade service)
  console.log('\n▶ TEST 20: "Installed solar inverter for Chief for 180k, he paid 100k remaining 80k as debts"');
  state.pendingFollowUp = null;
  const res20 = await processNaturalInput('Installed solar inverter for Chief for 180k, he paid 100k remaining 80k as debts', state);
  if (!res20.createdEvent || res20.createdEvent.totalRevenue !== 180000 || res20.createdEvent.receivableAdded !== 80000) {
    throw new Error(`TEST 20 FAILED: Expected 180000 rev and 80000 debt, got: ${JSON.stringify(res20.createdEvent)}`);
  }
  if (res20.createdEvent.customerName !== 'Chief') {
    throw new Error(`TEST 20 FAILED: Expected customerName 'Chief', got '${res20.createdEvent.customerName}'`);
  }
  console.log('✅ TEST 20 PASSED: Solar installation recorded with ₦100,000 cash and ₦80,000 debt to Chief.');

  // Test 21: Tailoring fashion custom craft order
  console.log('\n▶ TEST 21: "Tailored 3 agbada for Alhaji for 75k"');
  state.pendingFollowUp = null;
  const res21 = await processNaturalInput('Tailored 3 agbada for Alhaji for 75k', state);
  if (!res21.createdEvent || res21.createdEvent.totalRevenue !== 75000 || res21.createdEvent.quantity !== 3) {
    throw new Error(`TEST 21 FAILED: Expected 75000 rev and qty 3, got: ${JSON.stringify(res21.createdEvent)}`);
  }
  console.log('✅ TEST 21 PASSED: Tailoring custom craft logged immediately with ₦75,000 revenue for 3 units.');

  console.log('\n🎉 ALL NLP & EXPENSE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
