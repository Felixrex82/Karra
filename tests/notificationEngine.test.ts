import assert from 'node:assert';
import {
  evaluateNotificationDecision,
  MORNING_TEMPLATES,
  DAY_TEMPLATES,
  NIGHT_TEMPLATES,
  CONTEXTUAL_TEMPLATES,
  isTimeInQuietHours,
  parseTimeToMinutes,
  getLocalTimeInTimezone,
} from '../src/engine/notificationEngine';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../src/types/notification';

console.log('--- Testing Karra Intelligent Notification Engine ---');

// Test 1: Quiet Hours detection
console.log('Test 1: Quiet Hours detection (overnight 21:30 - 06:30)');
assert.strictEqual(isTimeInQuietHours(parseTimeToMinutes('22:00'), '21:30', '06:30'), true);
assert.strictEqual(isTimeInQuietHours(parseTimeToMinutes('03:15'), '21:30', '06:30'), true);
assert.strictEqual(isTimeInQuietHours(parseTimeToMinutes('08:00'), '21:30', '06:30'), false);
assert.strictEqual(isTimeInQuietHours(parseTimeToMinutes('14:30'), '21:30', '06:30'), false);
console.log('✓ Quiet hours detection correct');

// Test 2: Morning Window (8:00 AM Lagos time)
console.log('Test 2: Morning Window (08:00 AM Africa/Lagos)');
const morningDecision = evaluateNotificationDecision({
  userId: 'usr_morning_1',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-09-01T00:00:00Z',
  lastActiveTimestamp: '2026-10-02T18:00:00Z', // active yesterday
  todayDateStr: '2026-10-03',
  eventsToday: [],
  lifetimeEventsCount: 5,
  recentNotificationsToday: [],
  nowIso: '2026-10-03T07:15:00Z', // 08:15 AM in Africa/Lagos (UTC+1)
});
assert.strictEqual(morningDecision.shouldSend, true);
assert.strictEqual(morningDecision.category, 'MORNING_REMINDER');
assert.strictEqual(morningDecision.window, 'morning');
assert(
  morningDecision.title?.includes('Good morning') || morningDecision.title?.includes('Start the day'),
  `Unexpected title: ${morningDecision.title}`
);
console.log(`✓ Morning decision delivered: "${morningDecision.title}"`);

// Test 3: Active User Suppression (User active 20 minutes ago)
console.log('Test 3: Active User Suppression (do not disturb actively working merchant)');
const activeUserDecision = evaluateNotificationDecision({
  userId: 'usr_active_1',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-09-01T00:00:00Z',
  lastActiveTimestamp: '2026-10-03T07:00:00Z', // 15 mins ago
  todayDateStr: '2026-10-03',
  eventsToday: [],
  lifetimeEventsCount: 5,
  recentNotificationsToday: [],
  nowIso: '2026-10-03T07:15:00Z',
});
assert.strictEqual(activeUserDecision.shouldSend, false);
assert.strictEqual(activeUserDecision.reason, 'recently_active');
console.log(`✓ Active user reminder suppressed: "${activeUserDecision.suppressedReason}"`);

// Test 4: Section 6 Contextual - Sale recorded, but no expense recorded
console.log('Test 4: Contextual reminder - Sale recorded, no expense recorded');
const saleNoExpenseDecision = evaluateNotificationDecision({
  userId: 'usr_context_1',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-09-01T00:00:00Z',
  lastActiveTimestamp: '2026-10-03T11:00:00Z', // active 3 hours ago
  todayDateStr: '2026-10-03',
  eventsToday: [
    { id: 'ev1', type: 'SALE', timestamp: '2026-10-03T11:00:00Z', totalRevenue: 45000 },
  ],
  lifetimeEventsCount: 8,
  recentNotificationsToday: [],
  nowIso: '2026-10-03T13:30:00Z', // 14:30 Lagos (Day window)
});
assert.strictEqual(saleNoExpenseDecision.shouldSend, true);
assert.strictEqual(saleNoExpenseDecision.title, CONTEXTUAL_TEMPLATES.saleNoExpense.title);
assert.strictEqual(saleNoExpenseDecision.message, CONTEXTUAL_TEMPLATES.saleNoExpense.message);
assert.strictEqual(saleNoExpenseDecision.actionType, 'RECORD_EXPENSE');
console.log(`✓ Sale-no-expense contextual copy matched: "${saleNoExpenseDecision.title}"`);

// Test 5: Section 6 Contextual - Several transactions recorded at night
console.log('Test 5: Contextual reminder - Several transactions recorded at night');
const severalTransactionsDecision = evaluateNotificationDecision({
  userId: 'usr_context_2',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-09-01T00:00:00Z',
  lastActiveTimestamp: '2026-10-03T15:00:00Z', // active 4 hours ago
  todayDateStr: '2026-10-03',
  eventsToday: [
    { id: 'ev1', type: 'SALE', timestamp: '2026-10-03T11:00:00Z' },
    { id: 'ev2', type: 'SALE', timestamp: '2026-10-03T14:00:00Z' },
    { id: 'ev3', type: 'EXPENSE', timestamp: '2026-10-03T15:00:00Z' },
  ],
  lifetimeEventsCount: 20,
  recentNotificationsToday: [],
  nowIso: '2026-10-03T19:00:00Z', // 20:00 Lagos (Night window)
});
assert.strictEqual(severalTransactionsDecision.shouldSend, true);
assert.strictEqual(severalTransactionsDecision.category, 'NIGHT_REMINDER');
assert.strictEqual(severalTransactionsDecision.title, CONTEXTUAL_TEMPLATES.severalTransactionsRecorded.title);
assert.strictEqual(severalTransactionsDecision.message, CONTEXTUAL_TEMPLATES.severalTransactionsRecorded.message);
console.log(`✓ Several transactions contextual reminder matched: "${severalTransactionsDecision.message}"`);

// Test 6: Over-notification Guard (Max 1 per window)
console.log('Test 6: Over-notification Guard (already sent in this window)');
const alreadySentDecision = evaluateNotificationDecision({
  userId: 'usr_already_sent',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-09-01T00:00:00Z',
  lastActiveTimestamp: '2026-10-03T10:00:00Z',
  todayDateStr: '2026-10-03',
  eventsToday: [],
  lifetimeEventsCount: 5,
  recentNotificationsToday: [
    {
      id: 'notif_prior',
      userId: 'usr_already_sent',
      category: 'DAY_REMINDER',
      title: 'Don’t let today’s business slip away.',
      message: '...',
      timestamp: '2026-10-03T13:10:00Z',
      read: false,
      deliveryChannel: 'both',
    },
  ],
  nowIso: '2026-10-03T13:40:00Z', // Still Day window
});
assert.strictEqual(alreadySentDecision.shouldSend, false);
assert.strictEqual(alreadySentDecision.reason, 'already_sent_in_window');
console.log(`✓ Already-sent reminder suppressed: "${alreadySentDecision.suppressedReason}"`);

// Test 7: Section 8 New User Day 0 Onboarding
console.log('Test 7: Section 8 New User Day 0 Onboarding');
const day0Decision = evaluateNotificationDecision({
  userId: 'usr_day0_new',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-10-03T05:00:00Z', // signed up 3 hours ago
  lastActiveTimestamp: '2026-10-03T05:30:00Z',
  todayDateStr: '2026-10-03',
  eventsToday: [],
  lifetimeEventsCount: 0,
  recentNotificationsToday: [],
  nowIso: '2026-10-03T08:00:00Z',
});
assert.strictEqual(day0Decision.shouldSend, true);
assert.strictEqual(day0Decision.category, 'ONBOARDING_REMINDER');
assert.strictEqual(day0Decision.title, CONTEXTUAL_TEMPLATES.onboarding.title);
console.log(`✓ Day 0 welcome onboarding matched: "${day0Decision.title}"`);

// Test 8: Section 9 First-Use Encouragement (>24h, 0 lifetime events)
console.log('Test 8: Section 9 First-Use Encouragement');
const firstUseDecision = evaluateNotificationDecision({
  userId: 'usr_first_use',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-10-01T10:00:00Z', // 48h ago
  lastActiveTimestamp: '2026-10-01T10:30:00Z',
  todayDateStr: '2026-10-03',
  eventsToday: [],
  lifetimeEventsCount: 0,
  recentNotificationsToday: [],
  nowIso: '2026-10-03T12:00:00Z', // 13:00 Lagos
});
assert.strictEqual(firstUseDecision.shouldSend, true);
assert.strictEqual(firstUseDecision.category, 'FIRST_USE_REMINDER');
assert.strictEqual(firstUseDecision.title, CONTEXTUAL_TEMPLATES.firstUse.title);
assert.strictEqual(firstUseDecision.message, CONTEXTUAL_TEMPLATES.firstUse.message);
console.log(`✓ First-use reminder matched: "${firstUseDecision.title}" - "${firstUseDecision.message}"`);

// Test 9: Section 10 Inactive Returning User (>3 days inactive)
console.log('Test 9: Section 10 Inactive Returning User');
const inactiveUserDecision = evaluateNotificationDecision({
  userId: 'usr_inactive_1',
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  signupTimestamp: '2026-08-01T10:00:00Z',
  lastActiveTimestamp: '2026-09-25T10:00:00Z', // 8 days ago
  todayDateStr: '2026-10-03',
  eventsToday: [],
  lifetimeEventsCount: 15,
  recentNotificationsToday: [],
  nowIso: '2026-10-03T12:30:00Z', // 13:30 Lagos
});
assert.strictEqual(inactiveUserDecision.shouldSend, true);
assert.strictEqual(inactiveUserDecision.category, 'INACTIVE_USER_REMINDER');
assert.strictEqual(inactiveUserDecision.title, CONTEXTUAL_TEMPLATES.inactiveUser.title);
assert.strictEqual(inactiveUserDecision.message, CONTEXTUAL_TEMPLATES.inactiveUser.message);
console.log(`✓ Inactive user reminder matched: "${inactiveUserDecision.title}" - "${inactiveUserDecision.message}"`);

console.log('\n--- ALL NOTIFICATION ENGINE TESTS PASSED! ---');
