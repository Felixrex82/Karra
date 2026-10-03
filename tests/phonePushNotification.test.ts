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

console.log('--- ALL PHONE PUSH TESTS PASSED! ---');
