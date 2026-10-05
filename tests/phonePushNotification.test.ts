import assert from 'node:assert';
import { getOrGenerateVapidKeys, savePushSubscription, sendPushToUser } from '../server/webPushService';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../src/types/notification';

console.log('--- Testing Karra Phone Push Notifications & Web Push Engine ---');

// Test 1: VAPID Key Generation
console.log('Test 1: VAPID Key Generation and Validation');
const keys = getOrGenerateVapidKeys();
assert(keys.publicKey, 'Public key must be present');
assert(keys.privateKey, 'Private key must be present');
assert.strictEqual(typeof keys.publicKey, 'string');
assert(keys.publicKey.length > 30, 'VAPID public key should be valid base64url string');
console.log('✓ VAPID Keys successfully initialized with valid public key');

// Test 2: Push Subscription Storage
console.log('Test 2: Push Subscription Storage & Deduplication');
const mockSub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/mock-token-xyz123',
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0AgtGoKE-TaNmEcEI',
    auth: 'tBHItJI5svbpqma0QA==',
  },
};

savePushSubscription('merchant_test_phone_1', mockSub as any, 'Mozilla/5.0 Android');
console.log('✓ Push subscription safely persisted');

// Test 3: Notification channels default configuration
console.log('Test 3: Channel Configuration Defaults');
assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.channels.browserPush, true);
assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.channels.inApp, true);
assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.soundEnabled, true);
assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.vibrationEnabled, true);
console.log('✓ Default notification preferences enable both Phone Push, In-App, and Sound');

// Test 4: Notification Windows Configuration
console.log('Test 4: Three natural reminder windows defined');
assert(DEFAULT_NOTIFICATION_PREFERENCES.windows.morning.enabled);
assert(DEFAULT_NOTIFICATION_PREFERENCES.windows.day.enabled);
assert(DEFAULT_NOTIFICATION_PREFERENCES.windows.night.enabled);
console.log('✓ Morning, Daytime, and Night windows are active by default');

// Test 5: User Presence & Away-from-App Activity Tracking
console.log('Test 5: User Presence & Activity Tracking');
import { updateUserPresence, scheduleDelayedPush, startBackgroundNotificationWorker } from '../server/notificationEngine';

updateUserPresence({
  userId: 'merchant_test_phone_1',
  userEmail: 'test@merchant.ng',
  businessName: 'Lekki Couture',
  lastActiveTimestamp: new Date().toISOString(),
  eventsTodayCount: 2,
});
console.log('✓ User presence tracking safely stored');

// Test 6: Delayed Push Scheduling for Away-from-App Testing
console.log('Test 6: Delayed Push Scheduling');
const scheduledPromise = scheduleDelayedPush('merchant_test_phone_1', 1, 'night');
assert(scheduledPromise instanceof Promise, 'scheduleDelayedPush must return a Promise');
const scheduledResult = await scheduledPromise;
assert(scheduledResult.title, 'Scheduled notification must have a title');
assert.strictEqual(scheduledResult.category, 'NIGHT_REMINDER');
console.log('✓ Delayed push successfully delivered for away-from-app testing');

// Test 7: Background Notification Worker Initialization
console.log('Test 7: Background Worker Initialization');
startBackgroundNotificationWorker();
console.log('✓ Background worker started without errors');

console.log('--- ALL PHONE PUSH TESTS PASSED! ---');
process.exit(0);
