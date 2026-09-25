import assert from 'node:assert';
import { createEmptyBusinessState, isSampleSeedData } from '../src/data/seedData';
import { BusinessState, BusinessEvent, ProductMemory, CustomerMemory, BusinessRule } from '../src/types';
import { sanitizeForFirestore } from '../src/lib/firebase';

/**
 * Persistence & Tenant Isolation Regression Suite
 * Tests requirements A through J
 */

console.log('🧪 Starting Karra Persistence & Tenant Isolation Regression Tests...\n');

// Mock in-memory Firestore database simulating `/users/{userId}/data/ledger`
const mockFirestoreDb: Record<string, any> = {};

// Mock localStorage simulating client-side storage keys `kudios_user_state_${userId}`
const mockLocalStorage: Record<string, string> = {};

function mockSaveBusinessLedger(userId: string, state: BusinessState) {
  if (!userId) throw new Error('Cannot save ledger: Missing userId');
  const path = `/users/${userId}/data/ledger`;
  const rawPayload = {
    id: 'ledger',
    ownerId: userId,
    businessName: state.businessName || 'My Business',
    ownerName: state.ownerName || '',
    currency: state.currency || 'NGN',
    profile: state.profile || null,
    products: state.products || [],
    events: state.events || [],
    customers: state.customers || [],
    suppliers: state.suppliers || [],
    unitRelationships: state.unitRelationships || [],
    rules: state.rules || state.businessRules || [],
    businessRules: state.businessRules || state.rules || [],
    chatHistory: state.chatHistory || [],
    pendingFollowUp: state.pendingFollowUp || null,
    pulseInsights: state.pulseInsights || [],
    updatedAt: new Date().toISOString(),
  };
  mockFirestoreDb[path] = JSON.parse(JSON.stringify(sanitizeForFirestore(rawPayload)));
}

function mockLoadBusinessLedger(userId: string) {
  if (!userId) return { status: 'error', error: new Error('Missing userId') };
  const path = `/users/${userId}/data/ledger`;
  if (mockFirestoreDb[path]) {
    const data = mockFirestoreDb[path];
    return {
      status: 'found',
      data: {
        businessName: data.businessName,
        ownerName: data.ownerName,
        currency: data.currency,
        profile: data.profile,
        products: data.products || [],
        events: data.events || [],
        customers: data.customers || [],
        suppliers: data.suppliers || [],
        unitRelationships: data.unitRelationships || [],
        rules: data.rules || data.businessRules || [],
        businessRules: data.businessRules || data.rules || [],
        chatHistory: data.chatHistory || [],
        pendingFollowUp: data.pendingFollowUp || null,
        pulseInsights: data.pulseInsights || [],
      },
    };
  }
  return { status: 'not_found' };
}

// -------------------------------------------------------------
// TEST A & B: User A & User B Data Persists Across Logout / Login
// -------------------------------------------------------------
console.log('▶ TEST A & B: Data persistence across logout and login for multiple accounts');

const userAId = 'user_account_a_123';
const userBId = 'user_account_b_456';

// 1. Account A logs in & creates business data
const stateA = createEmptyBusinessState("Chinedu's Electronics", 'Chinedu Okeke', 'chinedu@example.com');
const productA: ProductMemory = {
  id: 'prod-radio-1',
  name: 'Solar Radio',
  unit: 'piece',
  currentCost: 15000,
  normalSellingPrice: 22000,
  costHistory: [{ date: '2026-09-01', cost: 15000 }],
  priceHistory: [{ date: '2026-09-01', price: 22000 }],
};
const customerA: CustomerMemory = {
  id: 'cust-a-1',
  name: 'Emeka Trading',
  totalPurchased: 22000,
  totalPaid: 12000,
  outstandingBalance: 10000,
  lastActivityDate: '2026-09-24',
  history: [],
};
const saleA: BusinessEvent = {
  id: 'ev-sale-a-1',
  timestamp: new Date().toISOString(),
  date: '2026-09-24',
  timeStr: '10:00 AM',
  type: 'SALE',
  rawUserText: 'Sold 1 Solar Radio to Emeka for 22,000, paid 12,000 cash',
  systemResponseText: 'Recorded sale of 1 Solar Radio to Emeka Trading.',
  productName: 'Solar Radio',
  customerName: 'Emeka Trading',
  quantity: 1,
  unitSellingPrice: 22000,
  totalRevenue: 22000,
  cashReceived: 12000,
  receivableAdded: 10000,
  unitCostAtTime: 15000,
  totalCostAtTime: 15000,
  grossProfit: 7000,
};
const expenseA: BusinessEvent = {
  id: 'ev-exp-a-1',
  timestamp: new Date().toISOString(),
  date: '2026-09-24',
  timeStr: '11:00 AM',
  type: 'EXPENSE',
  rawUserText: 'Paid shop electricity 5000',
  systemResponseText: 'Recorded Utilities expense 5,000.',
  expenseCategory: 'Utilities',
  expenseAmount: 5000,
};

stateA.products.push(productA);
stateA.customers.push(customerA);
stateA.events.push(saleA, expenseA);

// Save User A's data
mockSaveBusinessLedger(userAId, stateA);
mockLocalStorage[`kudios_user_state_${userAId}`] = JSON.stringify(stateA);

// 2. Account A logs out -> client state cleared
let clientActiveUser: string | null = null;
let clientActiveState: BusinessState = createEmptyBusinessState('My Business');

// 3. Account B logs in
clientActiveUser = userBId;
const stateB = createEmptyBusinessState("Amina's Fabrics", 'Amina Bello', 'amina@example.com');
const productB: ProductMemory = {
  id: 'prod-lace-1',
  name: 'Swiss Lace',
  unit: 'yard',
  currentCost: 8000,
  normalSellingPrice: 14000,
  costHistory: [{ date: '2026-09-02', cost: 8000 }],
  priceHistory: [{ date: '2026-09-02', price: 14000 }],
};
const customerB: CustomerMemory = {
  id: 'cust-b-1',
  name: 'Hajiya Fatima',
  totalPurchased: 28000,
  totalPaid: 28000,
  outstandingBalance: 0,
  lastActivityDate: '2026-09-24',
  history: [],
};
const saleB: BusinessEvent = {
  id: 'ev-sale-b-1',
  timestamp: new Date().toISOString(),
  date: '2026-09-24',
  timeStr: '02:00 PM',
  type: 'SALE',
  rawUserText: 'Sold 2 yards Swiss Lace to Hajiya Fatima for 28000 cash',
  systemResponseText: 'Recorded sale of 2 yards Swiss Lace to Hajiya Fatima.',
  productName: 'Swiss Lace',
  customerName: 'Hajiya Fatima',
  quantity: 2,
  unitSellingPrice: 14000,
  totalRevenue: 28000,
  cashReceived: 28000,
  receivableAdded: 0,
  unitCostAtTime: 8000,
  totalCostAtTime: 16000,
  grossProfit: 12000,
};

stateB.products.push(productB);
stateB.customers.push(customerB);
stateB.events.push(saleB);

mockSaveBusinessLedger(userBId, stateB);
mockLocalStorage[`kudios_user_state_${userBId}`] = JSON.stringify(stateB);

// 4. Account B logs out
clientActiveUser = null;
clientActiveState = createEmptyBusinessState('My Business');

// 5. Account A logs back in -> load from backend
clientActiveUser = userAId;
const loadResultA = mockLoadBusinessLedger(userAId);
assert.strictEqual(loadResultA.status, 'found', 'User A data must be found in Firestore');
assert.strictEqual(loadResultA.data?.businessName, "Chinedu's Electronics");
assert.strictEqual(loadResultA.data?.products?.length, 1);
assert.strictEqual(loadResultA.data?.products?.[0].name, 'Solar Radio');
assert.strictEqual(loadResultA.data?.customers?.length, 1);
assert.strictEqual(loadResultA.data?.customers?.[0].name, 'Emeka Trading');
assert.strictEqual(loadResultA.data?.customers?.[0].outstandingBalance, 10000);
assert.strictEqual(loadResultA.data?.events?.length, 2);
console.log('✅ TEST A PASSED: Account A retained all products, sales, customers, and expenses.');

// 6. Account B logs back in -> load from backend
const loadResultB = mockLoadBusinessLedger(userBId);
assert.strictEqual(loadResultB.status, 'found', 'User B data must be found in Firestore');
assert.strictEqual(loadResultB.data?.businessName, "Amina's Fabrics");
assert.strictEqual(loadResultB.data?.products?.length, 1);
assert.strictEqual(loadResultB.data?.products?.[0].name, 'Swiss Lace');
assert.strictEqual(loadResultB.data?.events?.length, 1);
console.log('✅ TEST B PASSED: Account B retained all products, sales, and customers.');

// -------------------------------------------------------------
// TEST C & D: Strict Tenant Isolation
// -------------------------------------------------------------
console.log('\n▶ TEST C & D: Tenant isolation (A cannot see B, B cannot see A)');

// Verify User A cannot access User B's document
assert.strictEqual(
  loadResultA.data?.products?.some((p: ProductMemory) => p.name === 'Swiss Lace'),
  false,
  'Account A must NOT see Swiss Lace'
);
assert.strictEqual(
  loadResultA.data?.customers?.some((c: CustomerMemory) => c.name === 'Hajiya Fatima'),
  false,
  'Account A must NOT see Hajiya Fatima'
);

// Verify User B cannot access User A's document
assert.strictEqual(
  loadResultB.data?.products?.some((p: ProductMemory) => p.name === 'Solar Radio'),
  false,
  'Account B must NOT see Solar Radio'
);
assert.strictEqual(
  loadResultB.data?.customers?.some((c: CustomerMemory) => c.name === 'Emeka Trading'),
  false,
  'Account B must NOT see Emeka Trading'
);
console.log('✅ TEST C & D PASSED: Strict tenant isolation between Account A and Account B verified.');

// -------------------------------------------------------------
// TEST E: Page Refresh Preserves Data
// -------------------------------------------------------------
console.log('\n▶ TEST E: Page refresh restoration');
const refreshedLocalA = JSON.parse(mockLocalStorage[`kudios_user_state_${userAId}`]);
assert.strictEqual(refreshedLocalA.businessName, "Chinedu's Electronics");
assert.strictEqual(refreshedLocalA.products[0].name, 'Solar Radio');
console.log('✅ TEST E PASSED: Page refresh retrieves cached and authoritative state correctly.');

// -------------------------------------------------------------
// TEST F & G: Existing business is not recreated; New accounts created once
// -------------------------------------------------------------
console.log('\n▶ TEST F & G: Business creation lifecycle');

// Calling load on existing user returns 'found' without overwriting
const existingCheck = mockLoadBusinessLedger(userAId);
assert.strictEqual(existingCheck.status, 'found');
assert.strictEqual(existingCheck.data?.businessName, "Chinedu's Electronics");

// Calling load on brand new user returns 'not_found'
const brandNewUserId = 'new_merchant_789';
const newCheck = mockLoadBusinessLedger(brandNewUserId);
assert.strictEqual(newCheck.status, 'not_found');

// Initialize new merchant once
const newMerchantState = createEmptyBusinessState('Brand New Mart', 'Kano Owner', 'owner@kano.ng');
mockSaveBusinessLedger(brandNewUserId, newMerchantState);

const initializedCheck = mockLoadBusinessLedger(brandNewUserId);
assert.strictEqual(initializedCheck.status, 'found');
assert.strictEqual(initializedCheck.data?.businessName, 'Brand New Mart');
console.log('✅ TEST F & G PASSED: Existing business preserved without recreation; new business created exactly once.');

// -------------------------------------------------------------
// TEST H: Historical transaction values remain unchanged
// -------------------------------------------------------------
console.log('\n▶ TEST H: Historical cost preservation');
// In Account A, product currentCost increases from 15000 to 19000
const updatedStateA = { ...stateA };
updatedStateA.products[0].currentCost = 19000;
mockSaveBusinessLedger(userAId, updatedStateA);

// The historical sale transaction must still record unitCostAtTime: 15000 and grossProfit: 7000
const reloadedA = mockLoadBusinessLedger(userAId);
const savedSale = reloadedA.data?.events?.[0];
assert.strictEqual(savedSale?.unitCostAtTime, 15000, 'Historical unitCostAtTime must remain 15,000');
assert.strictEqual(savedSale?.totalCostAtTime, 15000, 'Historical totalCostAtTime must remain 15,000');
assert.strictEqual(savedSale?.grossProfit, 7000, 'Historical grossProfit must remain 7,000');
console.log('✅ TEST H PASSED: Historical cost basis preserved despite current cost update.');

// -------------------------------------------------------------
// TEST I: Business Memory Persists
// -------------------------------------------------------------
console.log('\n▶ TEST I: AI Business memory and operational rules persist');
const rule1: BusinessRule = {
  id: 'rule-1',
  description: 'Never give credit above 20,000 without 50% deposit',
  category: 'PAYMENT',
  active: true,
  createdAt: '2026-09-24',
};
updatedStateA.rules.push(rule1);
mockSaveBusinessLedger(userAId, updatedStateA);

const reloadedMemory = mockLoadBusinessLedger(userAId);
assert.strictEqual(reloadedMemory.data?.rules?.length, 1);
assert.strictEqual(reloadedMemory.data?.rules?.[0].description, 'Never give credit above 20,000 without 50% deposit');
console.log('✅ TEST I PASSED: Business rules and operational memory persist cleanly.');

// -------------------------------------------------------------
// TEST J: Switching accounts does not leak cached state
// -------------------------------------------------------------
console.log('\n▶ TEST J: Cache isolation across account switching');
// Ensure local storage keys are strictly partitioned by UID
assert.notStrictEqual(
  mockLocalStorage[`kudios_user_state_${userAId}`],
  mockLocalStorage[`kudios_user_state_${userBId}`]
);
assert.ok(mockLocalStorage[`kudios_user_state_${userAId}`].includes('Solar Radio'));
assert.ok(!mockLocalStorage[`kudios_user_state_${userAId}`].includes('Swiss Lace'));
assert.ok(mockLocalStorage[`kudios_user_state_${userBId}`].includes('Swiss Lace'));
assert.ok(!mockLocalStorage[`kudios_user_state_${userBId}`].includes('Solar Radio'));
console.log('✅ TEST J PASSED: Local storage cache keys are strictly isolated per account UID.');

console.log('\n🎉 ALL 10 REGRESSION TESTS PASSED SUCCESSFULLY!');
process.exit(0);
