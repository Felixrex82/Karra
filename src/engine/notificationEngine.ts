import {
  NotificationCategory,
  NotificationActionType,
  NotificationItem,
  NotificationPreferences,
  NotificationEvaluationContext,
  NotificationDecision,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../types/notification';

export interface NotificationTemplate {
  title: string;
  message: string;
  actionType: NotificationActionType;
  actionLabel: string;
}

// -------------------------------------------------------------
// Approved Message Templates (Exact Prompt Copy & African Context)
// -------------------------------------------------------------

export const MORNING_TEMPLATES: NotificationTemplate[] = [
  {
    title: 'Good morning 👋',
    message: 'What’s happening in your business today? Tell Karra and let it keep track for you.',
    actionType: 'CHAT_KARRA',
    actionLabel: 'Tell Karra',
  },
  {
    title: 'Good morning. Let’s get your business ready.',
    message: 'Starting with new stock, a sale, an expense, or something else? Tell Karra what’s happening.',
    actionType: 'RECORD_SALE',
    actionLabel: 'Record Activity',
  },
  {
    title: 'Start the day with Karra.',
    message: 'Whatever happens in your business today, you can simply tell Karra and we’ll keep track.',
    actionType: 'CHAT_KARRA',
    actionLabel: 'Open Karra',
  },
];

export const DAY_TEMPLATES: NotificationTemplate[] = [
  {
    title: 'Don’t let today’s business slip away.',
    message: 'Made a sale, spent money, received stock, or collected a payment? Tell Karra now while you still remember.',
    actionType: 'RECORD_SALE',
    actionLabel: 'Record Sale',
  },
  {
    title: 'How’s business going today?',
    message: 'If you\'ve made any sales, spent money, received stock, or collected a payment, tell Karra and keep your records up to date.',
    actionType: 'RECORD_SALE',
    actionLabel: 'Update Records',
  },
  {
    title: 'What has happened so far?',
    message: 'A sale, expense, payment or stock update? Tell Karra in your own words.',
    actionType: 'CHAT_KARRA',
    actionLabel: 'Tell Karra',
  },
];

export const NIGHT_TEMPLATES: NotificationTemplate[] = [
  {
    title: 'Before you call it a day…',
    message: 'Take a moment to tell Karra what happened today. Record your sales, expenses, payments and other business activity.',
    actionType: 'RECORD_SALE',
    actionLabel: 'Close the Day',
  },
  {
    title: 'Let’s close the day with Karra.',
    message: 'Anything you haven\'t recorded today? Tell Karra before you call it a day.',
    actionType: 'CHAT_KARRA',
    actionLabel: 'Review Day',
  },
  {
    title: 'What happened in your business today?',
    message: 'Tell Karra what happened today and keep your business records up to date.',
    actionType: 'RECORD_SALE',
    actionLabel: 'Record Activity',
  },
];

export const CONTEXTUAL_TEMPLATES = {
  // Several transactions already recorded today
  severalTransactionsRecorded: {
    title: 'Before you call it a day…',
    message: 'You\'ve recorded today\'s activity so far. Is there anything else that happened today?',
    actionType: 'CHAT_KARRA' as NotificationActionType,
    actionLabel: 'Check Today',
  },
  // Sale recorded, but no expense recorded
  saleNoExpense: {
    title: 'One more thing before the day ends.',
    message: 'You\'ve recorded today\'s sale. Did you spend anything on the business today?',
    actionType: 'RECORD_EXPENSE' as NotificationActionType,
    actionLabel: 'Record Expense',
  },
  // Expense recorded, but no sale recorded
  expenseNoSale: {
    title: 'How’s business going today?',
    message: 'If you\'ve made any sales or received payments today, tell Karra and we\'ll keep track.',
    actionType: 'RECORD_SALE' as NotificationActionType,
    actionLabel: 'Record Sale',
  },
  // No activity recorded at all
  noActivity: {
    title: 'What happened in your business today?',
    message: 'Made a sale, spent money, received stock, or collected a payment? Tell Karra.',
    actionType: 'RECORD_SALE' as NotificationActionType,
    actionLabel: 'Record Activity',
  },
  // Day 0 Onboarding
  onboarding: {
    title: 'Welcome to Karra 👋',
    message: 'Whenever something happens in your business — a sale, expense, or new stock — just tell Karra in your own words.',
    actionType: 'CHAT_KARRA' as NotificationActionType,
    actionLabel: 'Say hello to Karra',
  },
  // Signed up > 24 hours, but never recorded anything
  firstUse: {
    title: 'Ready when you are.',
    message: 'Tell Karra what happened in your business today. You can start with a sale, expense, stock update, or customer.',
    actionType: 'RECORD_SALE' as NotificationActionType,
    actionLabel: 'Record First Activity',
  },
  // Inactive user (> 3 days)
  inactiveUser: {
    title: 'How’s business going?',
    message: 'Whenever you\'re ready, tell Karra what has happened in your business and we\'ll keep track.',
    actionType: 'CHAT_KARRA' as NotificationActionType,
    actionLabel: 'Check in with Karra',
  },
};

// -------------------------------------------------------------
// Helper Utilities for Timezone & Quiet Hours
// -------------------------------------------------------------

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

export function getLocalTimeInTimezone(
  date: Date,
  timezone: string
): { hour: number; minute: number; timeStr: string; totalMinutes: number; dateStr: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Africa/Lagos',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '0';
    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const dateStr = `${year}-${month}-${day}`;
    return { hour, minute, timeStr, totalMinutes: hour * 60 + minute, dateStr };
  } catch {
    // Fallback to UTC/local
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const dateStr = date.toISOString().split('T')[0];
    return { hour, minute, timeStr, totalMinutes: hour * 60 + minute, dateStr };
  }
}

export function isTimeInQuietHours(
  currentMinutes: number,
  startTime: string,
  endTime: string
): boolean {
  const startM = parseTimeToMinutes(startTime);
  const endM = parseTimeToMinutes(endTime);

  if (startM > endM) {
    // Overnight range (e.g. 21:30 to 06:30)
    return currentMinutes >= startM || currentMinutes < endM;
  }
  return currentMinutes >= startM && currentMinutes < endM;
}

/**
 * Deterministic pseudo-random number based on string seed.
 * Produces consistent jitter within a window for a specific user and date.
 */
function pseudoRandomSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) / 2147483647;
}

// -------------------------------------------------------------
// Core Notification Decision Engine
// -------------------------------------------------------------

export function evaluateNotificationDecision(
  context: NotificationEvaluationContext
): NotificationDecision {
  const {
    userId,
    preferences = DEFAULT_NOTIFICATION_PREFERENCES,
    signupTimestamp,
    lastActiveTimestamp,
    eventsToday = [],
    lifetimeEventsCount = 0,
    recentNotificationsToday = [],
    nowIso,
  } = context;

  // 1. Eligibility & Master Preferences
  if (!userId) {
    return { shouldSend: false, reason: 'user_id_missing', suppressedReason: 'Missing user ID' };
  }
  if (!preferences.enabled) {
    return { shouldSend: false, reason: 'notifications_disabled', suppressedReason: 'User disabled notifications' };
  }
  if (!preferences.channels.inApp && !preferences.channels.browserPush) {
    return { shouldSend: false, reason: 'all_channels_disabled', suppressedReason: 'Both in-app and push channels disabled' };
  }

  const now = nowIso ? new Date(nowIso) : new Date();
  const timezone = preferences.timezone || 'Africa/Lagos';
  const localTime = getLocalTimeInTimezone(now, timezone);

  // 2. Quiet Hours Check
  if (preferences.quietHours.enabled) {
    if (isTimeInQuietHours(localTime.totalMinutes, preferences.quietHours.startTime, preferences.quietHours.endTime)) {
      return {
        shouldSend: false,
        reason: 'quiet_hours',
        suppressedReason: `Currently in quiet hours (${preferences.quietHours.startTime} - ${preferences.quietHours.endTime} ${timezone})`,
      };
    }
  }

  // 3. User Recency & Active Suppression
  // "Do not send a daytime reminder if the user has just been actively using Karra."
  // "Do not send a night reminder if the user has already completed meaningful activity recently."
  if (preferences.suppressWhenRecentlyActive && lastActiveTimestamp) {
    const lastActiveTime = new Date(lastActiveTimestamp).getTime();
    const minutesSinceActive = (now.getTime() - lastActiveTime) / (1000 * 60);

    if (minutesSinceActive >= 0 && minutesSinceActive < 60) {
      return {
        shouldSend: false,
        reason: 'recently_active',
        suppressedReason: `User was active ${Math.round(minutesSinceActive)} minutes ago. Unnecessary reminder suppressed.`,
      };
    }
  }

  // 4. Onboarding & New User Check (Day 0)
  // "Day 0: Welcome/onboarding notification where appropriate. Day 1 onward: Normal reminder logic."
  const signupDate = signupTimestamp ? new Date(signupTimestamp) : null;
  const hoursSinceSignup = signupDate ? (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60) : 999;
  const isDayZero = hoursSinceSignup >= 0 && hoursSinceSignup < 24;

  if (isDayZero) {
    const alreadyReceivedWelcome = recentNotificationsToday.some(
      (n) => n.category === 'ONBOARDING_REMINDER'
    );
    if (!alreadyReceivedWelcome && recentNotificationsToday.length === 0) {
      return {
        shouldSend: true,
        category: 'ONBOARDING_REMINDER',
        title: CONTEXTUAL_TEMPLATES.onboarding.title,
        message: CONTEXTUAL_TEMPLATES.onboarding.message,
        actionType: CONTEXTUAL_TEMPLATES.onboarding.actionType,
        actionLabel: CONTEXTUAL_TEMPLATES.onboarding.actionLabel,
        reason: 'day_0_welcome_onboarding',
      };
    }
    // Suppress daily scheduled reminders on Day 0 to avoid overwhelming the new user
    return {
      shouldSend: false,
      reason: 'day_0_grace_period',
      suppressedReason: 'New user on Day 0: gently allowing them to explore without reminder pressure.',
    };
  }

  // 5. First-Use Reminder Check
  // "If someone has signed up but has never recorded anything, the system can gently encourage their first action."
  if (lifetimeEventsCount === 0 && hoursSinceSignup >= 24) {
    const alreadySentFirstUseToday = recentNotificationsToday.some(
      (n) => n.category === 'FIRST_USE_REMINDER'
    );
    // Send during daytime window if not sent today
    const inDayWindow = localTime.hour >= 11 && localTime.hour < 16;
    if (!alreadySentFirstUseToday && inDayWindow) {
      return {
        shouldSend: true,
        category: 'FIRST_USE_REMINDER',
        title: CONTEXTUAL_TEMPLATES.firstUse.title,
        message: CONTEXTUAL_TEMPLATES.firstUse.message,
        actionType: CONTEXTUAL_TEMPLATES.firstUse.actionType,
        actionLabel: CONTEXTUAL_TEMPLATES.firstUse.actionLabel,
        reason: 'first_use_encouragement',
      };
    }
  }

  // 6. Inactive User Check
  // "If a user has previously used Karra but has become inactive... 'How’s business going?'"
  if (lifetimeEventsCount > 0 && lastActiveTimestamp) {
    const daysSinceActive = (now.getTime() - new Date(lastActiveTimestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActive >= 3) {
      const alreadySentInactiveToday = recentNotificationsToday.some(
        (n) => n.category === 'INACTIVE_USER_REMINDER'
      );
      const inMiddayWindow = localTime.hour >= 12 && localTime.hour < 15;
      if (!alreadySentInactiveToday && inMiddayWindow) {
        return {
          shouldSend: true,
          category: 'INACTIVE_USER_REMINDER',
          title: CONTEXTUAL_TEMPLATES.inactiveUser.title,
          message: CONTEXTUAL_TEMPLATES.inactiveUser.message,
          actionType: CONTEXTUAL_TEMPLATES.inactiveUser.actionType,
          actionLabel: CONTEXTUAL_TEMPLATES.inactiveUser.actionLabel,
          reason: 'returning_inactive_user_friendly_checkin',
        };
      }
    }
  }

  // 7. Window Matching (Morning, Day, Night)
  let activeWindow: 'morning' | 'day' | 'night' | null = null;
  const morningConfig = preferences.windows.morning;
  const dayConfig = preferences.windows.day;
  const nightConfig = preferences.windows.night;

  if (morningConfig.enabled && localTime.hour >= morningConfig.startHour && localTime.hour < morningConfig.endHour) {
    activeWindow = 'morning';
  } else if (dayConfig.enabled && localTime.hour >= dayConfig.startHour && localTime.hour < dayConfig.endHour) {
    activeWindow = 'day';
  } else if (nightConfig.enabled && localTime.hour >= nightConfig.startHour && localTime.hour < nightConfig.endHour) {
    activeWindow = 'night';
  }

  if (!activeWindow) {
    return {
      shouldSend: false,
      reason: 'outside_window',
      suppressedReason: `Current local time ${localTime.timeStr} is outside morning, day, and night reminder windows.`,
    };
  }

  // 8. Over-notification Guard: Max 1 notification per window per day
  const categoryForWindow: NotificationCategory =
    activeWindow === 'morning'
      ? 'MORNING_REMINDER'
      : activeWindow === 'day'
      ? 'DAY_REMINDER'
      : 'NIGHT_REMINDER';

  const alreadySentInThisWindow = recentNotificationsToday.some(
    (n) => n.category === categoryForWindow || n.contextMeta?.window === activeWindow
  );

  if (alreadySentInThisWindow) {
    return {
      shouldSend: false,
      reason: 'already_sent_in_window',
      window: activeWindow,
      suppressedReason: `Already delivered a ${activeWindow} reminder today. Suppressed to prevent duplicate/over-notification.`,
    };
  }

  // 9. Contextual Intelligence Analysis
  // Inspect events recorded today
  const salesToday = eventsToday.filter((e) => e.type === 'SALE');
  const expensesToday = eventsToday.filter((e) => e.type === 'EXPENSE');
  const totalEventsToday = eventsToday.length;

  // Night window suppression if meaningful activity completed recently
  if (activeWindow === 'night' && totalEventsToday >= 2 && lastActiveTimestamp) {
    const minutesSinceActive = (now.getTime() - new Date(lastActiveTimestamp).getTime()) / (1000 * 60);
    if (minutesSinceActive < 90 && salesToday.length > 0 && expensesToday.length > 0) {
      return {
        shouldSend: false,
        reason: 'night_activity_already_complete',
        window: 'night',
        suppressedReason: 'Merchant recorded both sales & expenses and was active recently. Day records are already complete.',
      };
    }
  }

  // 10. Message Selection & Variation Rotation
  // We use deterministic rotation based on user ID + today's date so variations rotate day-to-day
  const rotationIndex = Math.floor(
    pseudoRandomSeed(`${userId}_${localTime.dateStr}_${activeWindow}`) * 10
  );

  // Apply Section 6 Contextual Rules
  let chosenTitle = '';
  let chosenMessage = '';
  let chosenAction: NotificationActionType = 'RECORD_SALE';
  let chosenActionLabel = 'Record Activity';
  let decisionReason = `contextual_${activeWindow}_evaluation`;

  if (activeWindow === 'night') {
    if (totalEventsToday >= 2) {
      // "If the user has already recorded several transactions today: Before you call it a day… You've recorded today's activity so far. Is there anything else that happened today?"
      chosenTitle = CONTEXTUAL_TEMPLATES.severalTransactionsRecorded.title;
      chosenMessage = CONTEXTUAL_TEMPLATES.severalTransactionsRecorded.message;
      chosenAction = CONTEXTUAL_TEMPLATES.severalTransactionsRecorded.actionType;
      chosenActionLabel = CONTEXTUAL_TEMPLATES.severalTransactionsRecorded.actionLabel;
      decisionReason = 'night_contextual_several_recorded';
    } else if (salesToday.length > 0 && expensesToday.length === 0) {
      // "If the user has recorded a sale but no expense: One more thing before the day ends. You've recorded today's sale. Did you spend anything on the business today?"
      chosenTitle = CONTEXTUAL_TEMPLATES.saleNoExpense.title;
      chosenMessage = CONTEXTUAL_TEMPLATES.saleNoExpense.message;
      chosenAction = CONTEXTUAL_TEMPLATES.saleNoExpense.actionType;
      chosenActionLabel = CONTEXTUAL_TEMPLATES.saleNoExpense.actionLabel;
      decisionReason = 'night_contextual_sale_no_expense';
    } else if (expensesToday.length > 0 && salesToday.length === 0) {
      // "If the user has recorded an expense but no sale: How’s business going today? If you've made any sales or received payments today, tell Karra and we'll keep track."
      chosenTitle = CONTEXTUAL_TEMPLATES.expenseNoSale.title;
      chosenMessage = CONTEXTUAL_TEMPLATES.expenseNoSale.message;
      chosenAction = CONTEXTUAL_TEMPLATES.expenseNoSale.actionType;
      chosenActionLabel = CONTEXTUAL_TEMPLATES.expenseNoSale.actionLabel;
      decisionReason = 'night_contextual_expense_no_sale';
    } else if (totalEventsToday === 0) {
      // "If the user has recorded no activity: What happened in your business today? Made a sale, spent money, received stock, or collected a payment? Tell Karra."
      chosenTitle = CONTEXTUAL_TEMPLATES.noActivity.title;
      chosenMessage = CONTEXTUAL_TEMPLATES.noActivity.message;
      chosenAction = CONTEXTUAL_TEMPLATES.noActivity.actionType;
      chosenActionLabel = CONTEXTUAL_TEMPLATES.noActivity.actionLabel;
      decisionReason = 'night_contextual_no_activity';
    } else {
      const template = NIGHT_TEMPLATES[rotationIndex % NIGHT_TEMPLATES.length];
      chosenTitle = template.title;
      chosenMessage = template.message;
      chosenAction = template.actionType;
      chosenActionLabel = template.actionLabel;
      decisionReason = 'night_standard_rotated';
    }
  } else if (activeWindow === 'day') {
    if (salesToday.length > 0 && expensesToday.length === 0) {
      // Daytime reminder checking if any money was spent
      chosenTitle = CONTEXTUAL_TEMPLATES.saleNoExpense.title;
      chosenMessage = CONTEXTUAL_TEMPLATES.saleNoExpense.message;
      chosenAction = CONTEXTUAL_TEMPLATES.saleNoExpense.actionType;
      chosenActionLabel = CONTEXTUAL_TEMPLATES.saleNoExpense.actionLabel;
      decisionReason = 'day_contextual_sale_no_expense';
    } else if (expensesToday.length > 0 && salesToday.length === 0) {
      chosenTitle = CONTEXTUAL_TEMPLATES.expenseNoSale.title;
      chosenMessage = CONTEXTUAL_TEMPLATES.expenseNoSale.message;
      chosenAction = CONTEXTUAL_TEMPLATES.expenseNoSale.actionType;
      chosenActionLabel = CONTEXTUAL_TEMPLATES.expenseNoSale.actionLabel;
      decisionReason = 'day_contextual_expense_no_sale';
    } else {
      const template = DAY_TEMPLATES[rotationIndex % DAY_TEMPLATES.length];
      chosenTitle = template.title;
      chosenMessage = template.message;
      chosenAction = template.actionType;
      chosenActionLabel = template.actionLabel;
      decisionReason = 'day_standard_rotated';
    }
  } else {
    // Morning window
    const template = MORNING_TEMPLATES[rotationIndex % MORNING_TEMPLATES.length];
    chosenTitle = template.title;
    chosenMessage = template.message;
    chosenAction = template.actionType;
    chosenActionLabel = template.actionLabel;
    decisionReason = 'morning_standard_rotated';
  }

  return {
    shouldSend: true,
    category: categoryForWindow,
    title: chosenTitle,
    message: chosenMessage,
    actionType: chosenAction,
    actionLabel: chosenActionLabel,
    window: activeWindow,
    reason: decisionReason,
  };
}
