export type NotificationCategory =
  | 'MORNING_REMINDER'
  | 'DAY_REMINDER'
  | 'NIGHT_REMINDER'
  | 'ONBOARDING_REMINDER'
  | 'FIRST_USE_REMINDER'
  | 'INACTIVE_USER_REMINDER'
  | 'CONTEXTUAL_FOLLOWUP';

export type NotificationActionType =
  | 'RECORD_SALE'
  | 'RECORD_EXPENSE'
  | 'ADD_STOCK'
  | 'ADD_CUSTOMER'
  | 'CHAT_KARRA'
  | 'VIEW_TRANSACTIONS'
  | 'VIEW_PROFILE';

export interface NotificationItem {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  actionType?: NotificationActionType;
  actionLabel?: string;
  timestamp: string; // ISO
  read: boolean;
  readAt?: string;
  deliveryChannel: 'in_app' | 'browser_push' | 'both';
  contextMeta?: {
    window?: 'morning' | 'day' | 'night' | 'first_use' | 'inactive';
    salesCountToday?: number;
    expensesCountToday?: number;
    totalRevenueToday?: number;
    totalExpensesToday?: number;
    reason?: string;
  };
}

export interface WindowSchedule {
  enabled: boolean;
  targetTime: string; // "HH:MM" 24h
  startHour: number;   // e.g. 7
  endHour: number;     // e.g. 9
}

export interface NotificationPreferences {
  enabled: boolean;
  channels: {
    inApp: boolean;
    browserPush: boolean;
  };
  windows: {
    morning: WindowSchedule;
    day: WindowSchedule;
    night: WindowSchedule;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // "21:30"
    endTime: string;   // "06:30"
  };
  timezone: string; // e.g. "Africa/Lagos"
  suppressWhenRecentlyActive: boolean; // default true (active within 60 mins)
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface NotificationEvaluationContext {
  userId: string;
  userEmail?: string;
  businessName?: string;
  signupTimestamp?: string;
  lastActiveTimestamp?: string;
  preferences: NotificationPreferences;
  // Activity today
  todayDateStr: string; // YYYY-MM-DD
  eventsToday: Array<{
    id: string;
    type: string;
    timestamp: string;
    totalRevenue?: number;
    expenseAmount?: number;
  }>;
  lifetimeEventsCount: number;
  // History of notifications sent today
  recentNotificationsToday: NotificationItem[];
  // Current time override (for testing / timezone evaluation)
  nowIso?: string;
}

export interface NotificationDecision {
  shouldSend: boolean;
  category?: NotificationCategory;
  title?: string;
  message?: string;
  actionType?: NotificationActionType;
  actionLabel?: string;
  window?: 'morning' | 'day' | 'night';
  reason: string;
  suppressedReason?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  channels: {
    inApp: true,
    browserPush: true,
  },
  windows: {
    morning: {
      enabled: true,
      targetTime: '08:00',
      startHour: 7,
      endHour: 9,
    },
    day: {
      enabled: true,
      targetTime: '14:00',
      startHour: 13,
      endHour: 15,
    },
    night: {
      enabled: true,
      targetTime: '20:00',
      startHour: 19,
      endHour: 21,
    },
  },
  quietHours: {
    enabled: true,
    startTime: '21:30',
    endTime: '06:30',
  },
  timezone: 'Africa/Lagos',
  suppressWhenRecentlyActive: true,
  soundEnabled: true,
  vibrationEnabled: true,
};
