import { BetaFeedbackType } from '../../types';

export type AdminDateRange = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface AdminUserRecord {
  userId: string;
  email: string;
  businessName: string;
  ownerName?: string;
  joinedAt: string;
  lastActiveAt: string;
  status: 'active' | 'inactive' | 'suspended';
  betaStatus: 'active' | 'suspended' | 'revoked' | 'none';
  betaInvitationCode?: string;
  role: 'admin' | 'merchant';
  totalTransactions: number;
  salesCount: number;
  expensesCount: number;
  stockUpdatesCount: number;
  customersCount: number;
  aiInteractionsCount: number;
  memoryUpdatesCount: number;
  activeDaysCount: number;
  firstActivityAt?: string;
  lastActivityAt?: string;
  events?: AdminEventRecord[];
  productsCount?: number;
  totalSalesVolume?: number;
  totalExpensesVolume?: number;
}

export interface AdminEventRecord {
  id: string;
  userId: string;
  userEmail?: string;
  businessName?: string;
  eventName: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface DailyActivityRecord {
  dateStr: string; // YYYY-MM-DD
  displayDate: string; // e.g. Mon, Sep 29
  newUsers: number;
  activeUsers: number;
  transactions: number;
  aiInteractions: number;
  activeUserIds: string[];
  events: AdminEventRecord[];
}

export interface FunnelStage {
  id: string;
  name: string;
  description: string;
  count: number;
  conversionPercent: number;
  dropOffPercent: number;
}

export interface FeatureUsageMetric {
  featureId: string;
  name: string;
  description: string;
  iconName: string;
  totalUses: number;
  activeUsersCount: number;
  userAdoptionPercent: number;
}

export interface FrictionPointReport {
  zeroTransactionUsers: number;
  inactiveOver7Days: number;
  inactiveOver30Days: number;
  reportedBugsCount: number;
  usersWithErrors: number;
}
