import React, { useMemo } from 'react';
import {
  TrendingUp,
  UserCheck,
  UserPlus,
  Repeat,
  AlertOctagon,
  Sparkles,
  Receipt,
  Mic,
  Keyboard,
  Clock,
  BookOpen,
  PieChart,
  Calendar,
  AlertTriangle,
  ArrowDown,
  Layers,
} from 'lucide-react';
import { AdminUserRecord, AdminEventRecord, DailyActivityRecord, FunnelStage } from './adminTypes';

interface AdminAnalyticsTabProps {
  users: AdminUserRecord[];
  events: AdminEventRecord[];
  dailyActivity: DailyActivityRecord[];
  dateRangeLabel: string;
}

export const AdminAnalyticsTab: React.FC<AdminAnalyticsTabProps> = ({
  users,
  events,
  dailyActivity,
  dateRangeLabel,
}) => {
  // 1. User Acquisition Analysis
  const acquisitionStats = useMemo(() => {
    const totalUsers = users.length;
    const now = Date.now();
    const last7d = now - 7 * 24 * 60 * 60 * 1000;
    const last30d = now - 30 * 24 * 60 * 60 * 1000;

    const newLast7d = users.filter((u) => new Date(u.joinedAt).getTime() >= last7d).length;
    const newLast30d = users.filter((u) => new Date(u.joinedAt).getTime() >= last30d).length;

    // Daily average in current active range
    const activeDaysCount = Math.max(dailyActivity.length, 1);
    const totalNewInRange = dailyActivity.reduce((acc, curr) => acc + curr.newUsers, 0);
    const avgDailySignups = (totalNewInRange / activeDaysCount).toFixed(1);

    return {
      totalUsers,
      newLast7d,
      newLast30d,
      avgDailySignups,
      totalNewInRange,
    };
  }, [users, dailyActivity]);

  // 2. Activation Funnel
  const funnelStages: FunnelStage[] = useMemo(() => {
    const totalRegistered = users.length;
    if (totalRegistered === 0) {
      return [
        { id: '1', name: 'Sign-up', description: 'Registered an account', count: 0, conversionPercent: 0, dropOffPercent: 0 },
        { id: '2', name: 'Completed Setup', description: 'Configured business name & profile', count: 0, conversionPercent: 0, dropOffPercent: 0 },
        { id: '3', name: 'First Meaningful Activity', description: 'Added product, customer, or asked AI', count: 0, conversionPercent: 0, dropOffPercent: 0 },
        { id: '4', name: 'First Transaction', description: 'Logged first real sale or expense', count: 0, conversionPercent: 0, dropOffPercent: 0 },
        { id: '5', name: 'Returned to Karra', description: 'Active on 2 or more distinct calendar days', count: 0, conversionPercent: 0, dropOffPercent: 0 },
        { id: '6', name: 'Repeated Usage', description: 'Logged 3+ transactions across multiple days', count: 0, conversionPercent: 0, dropOffPercent: 0 },
      ];
    }

    // Stage 1: Registered
    const stage1 = totalRegistered;

    // Stage 2: Completed setup (has businessName set and not default empty)
    const stage2 = users.filter(
      (u) => Boolean(u.businessName && u.businessName !== 'My Store' && u.businessName !== 'Business Account')
    ).length;

    // Stage 3: First meaningful activity (has transactions or products or customers or AI query)
    const stage3 = users.filter(
      (u) =>
        u.totalTransactions > 0 ||
        (u.productsCount && u.productsCount > 0) ||
        (u.customersCount && u.customersCount > 0) ||
        u.aiInteractionsCount > 0
    ).length;

    // Stage 4: First transaction (at least 1 sale or expense)
    const stage4 = users.filter((u) => u.totalTransactions > 0).length;

    // Stage 5: Returned to Karra (active on >= 2 distinct calendar days or has activity days count > 1)
    const stage5 = users.filter((u) => (u.activeDaysCount && u.activeDaysCount >= 2)).length;

    // Stage 6: Repeated usage (at least 3 transactions or active >= 3 days)
    const stage6 = users.filter(
      (u) => u.totalTransactions >= 3 || (u.activeDaysCount && u.activeDaysCount >= 3)
    ).length;

    const counts = [stage1, stage2, stage3, stage4, stage5, stage6];
    const descriptions = [
      'Registered an account',
      'Configured business name & profile',
      'Added product, customer, or asked AI',
      'Logged first real sale or expense',
      'Active on 2 or more distinct calendar days',
      'Logged 3+ transactions across multiple days',
    ];
    const names = [
      '1. Sign-up',
      '2. Completed Setup',
      '3. First Activity',
      '4. First Transaction',
      '5. Returned to Karra',
      '6. Repeated Usage',
    ];

    return counts.map((count, idx) => {
      const prev = idx === 0 ? count : counts[idx - 1];
      const conv = stage1 > 0 ? Math.round((count / stage1) * 100) : 0;
      const drop = prev > 0 ? Math.max(0, Math.round(((prev - count) / prev) * 100)) : 0;
      return {
        id: String(idx + 1),
        name: names[idx],
        description: descriptions[idx],
        count,
        conversionPercent: conv,
        dropOffPercent: drop,
      };
    });
  }, [users]);

  // 3. Retention & Engagement Metrics
  const retentionStats = useMemo(() => {
    const totalUsers = users.length;
    if (totalUsers === 0) return { returningRate: 0, avgActiveDays: 0, highlyActiveUsers: 0 };

    const returningUsersCount = users.filter((u) => u.activeDaysCount && u.activeDaysCount >= 2).length;
    const returningRate = Math.round((returningUsersCount / totalUsers) * 100);

    const totalDays = users.reduce((acc, u) => acc + (u.activeDaysCount || 1), 0);
    const avgActiveDays = (totalDays / totalUsers).toFixed(1);

    const highlyActiveUsers = users.filter((u) => u.totalTransactions >= 5).length;

    return {
      returningRate,
      avgActiveDays,
      highlyActiveUsers,
    };
  }, [users]);

  // 4. Feature Usage Breakdown
  const featureBreakdown = useMemo(() => {
    const totalUsers = users.length;
    const denom = totalUsers > 0 ? totalUsers : 1;

    // Count usage across all events
    const featureEvents = {
      naturalTyping: events.filter((e) => e.eventName === 'natural_input_processed').length,
      voice: events.filter((e) => e.eventName === 'voice_input_used').length,
      sales: events.filter((e) => e.eventName === 'sale_recorded').length,
      expenses: events.filter((e) => e.eventName === 'expense_recorded').length,
      stock: events.filter((e) => e.eventName === 'stock_updated').length,
      debt: events.filter((e) => ['debt_recorded', 'debt_updated'].includes(e.eventName)).length,
      aiAssistant: events.filter((e) => ['ai_query', 'ai_interaction', 'conversational_question'].includes(e.eventName)).length,
      reports: events.filter((e) => e.eventName === 'report_generated').length,
      timeline: events.filter((e) => e.eventName === 'timeline_viewed').length,
    };

    // Count unique users who used each feature
    const userFeatureAdoption = {
      salesUsers: users.filter((u) => u.salesCount > 0).length,
      expenseUsers: users.filter((u) => u.expensesCount > 0).length,
      aiUsers: users.filter((u) => u.aiInteractionsCount > 0).length,
      stockUsers: users.filter((u) => u.stockUpdatesCount > 0).length,
      debtUsers: users.filter((u) => u.customersCount > 0).length,
    };

    return [
      {
        id: 'sales',
        name: 'Sales Logging',
        description: 'Recording everyday store revenue',
        icon: Receipt,
        totalUses: featureEvents.sales,
        usersCount: userFeatureAdoption.salesUsers,
        adoptionRate: Math.round((userFeatureAdoption.salesUsers / denom) * 100),
      },
      {
        id: 'expenses',
        name: 'Expense Tracking',
        description: 'Logging operational and inventory expenses',
        icon: Receipt,
        totalUses: featureEvents.expenses,
        usersCount: userFeatureAdoption.expenseUsers,
        adoptionRate: Math.round((userFeatureAdoption.expenseUsers / denom) * 100),
      },
      {
        id: 'aiAssistant',
        name: 'AI Business Assistant',
        description: 'Natural speech & financial question answering',
        icon: Sparkles,
        totalUses: featureEvents.aiAssistant,
        usersCount: userFeatureAdoption.aiUsers,
        adoptionRate: Math.round((userFeatureAdoption.aiUsers / denom) * 100),
      },
      {
        id: 'stock',
        name: 'Stock & Inventory',
        description: 'Managing products, costs, and selling prices',
        icon: Layers,
        totalUses: featureEvents.stock,
        usersCount: userFeatureAdoption.stockUsers,
        adoptionRate: Math.round((userFeatureAdoption.stockUsers / denom) * 100),
      },
      {
        id: 'debt',
        name: 'Customer Debt Tracking',
        description: 'Keeping track of debtors and receivables',
        icon: UserCheck,
        totalUses: featureEvents.debt,
        usersCount: userFeatureAdoption.debtUsers,
        adoptionRate: Math.round((userFeatureAdoption.debtUsers / denom) * 100),
      },
      {
        id: 'naturalTyping',
        name: 'Natural Text Input',
        description: 'Logging transactions via conversational phrasing',
        icon: Keyboard,
        totalUses: featureEvents.naturalTyping,
        usersCount: users.filter((u) => u.totalTransactions > 0).length,
        adoptionRate: Math.round((users.filter((u) => u.totalTransactions > 0).length / denom) * 100),
      },
    ];
  }, [users, events]);

  // 5. Drop-off & Friction Points
  const frictionReport = useMemo(() => {
    const totalUsers = users.length;
    const now = Date.now();
    const day7 = 7 * 24 * 60 * 60 * 1000;
    const day30 = 30 * 24 * 60 * 60 * 1000;

    // Users signed up with zero transactions
    const zeroTransactionUsers = users.filter((u) => u.totalTransactions === 0).length;

    // Inactive over 7 days
    const inactiveOver7d = users.filter((u) => {
      const last = new Date(u.lastActiveAt || u.joinedAt).getTime();
      return now - last > day7;
    }).length;

    // Inactive over 30 days
    const inactiveOver30d = users.filter((u) => {
      const last = new Date(u.lastActiveAt || u.joinedAt).getTime();
      return now - last > day30;
    }).length;

    return {
      totalUsers,
      zeroTransactionUsers,
      zeroTransactionRate: totalUsers > 0 ? Math.round((zeroTransactionUsers / totalUsers) * 100) : 0,
      inactiveOver7d,
      inactiveOver30d,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      {/* 1. Header Insight */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800">
        <h2 className="text-base font-bold text-white tracking-tight">Product Usage & Analytics</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          In-depth behavioral tracking: Acquisition, Activation Funnel, Retention, and Feature Adoption.
        </p>

        {/* Quick Acquisition Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Accounts</p>
            <p className="text-xl font-bold text-white mt-0.5">{acquisitionStats.totalUsers}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Signups (Last 7 Days)</p>
            <p className="text-xl font-bold text-purple-400 mt-0.5">{acquisitionStats.newLast7d}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Signups (Last 30 Days)</p>
            <p className="text-xl font-bold text-teal-400 mt-0.5">{acquisitionStats.newLast30d}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Avg Daily Signups</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{acquisitionStats.avgDailySignups} / day</p>
          </div>
        </div>
      </div>

      {/* 2. Activation Funnel */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Activation Funnel</h3>
          <p className="text-xs text-slate-400">
            Observed progression from first sign-up through setup, initial transaction, and repeated usage.
          </p>
        </div>

        {users.length === 0 ? (
          <div className="py-10 text-center rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No users yet</p>
            <p className="text-xs text-slate-500 mt-1">Funnel conversion will compute as users sign up and record events.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {funnelStages.map((stage, idx) => {
              const widthPercent = Math.max(stage.conversionPercent, stage.count > 0 ? 8 : 2);
              return (
                <div key={stage.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{stage.name}</span>
                      <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline">&bull; {stage.description}</span>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="font-bold text-white">{stage.count} users</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        {stage.conversionPercent}%
                      </span>
                      {idx > 0 && stage.dropOffPercent > 0 && (
                        <span className="text-[10px] font-semibold text-rose-400">
                          -{stage.dropOffPercent}% drop
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Funnel Bar */}
                  <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                    <div
                      style={{ width: `${widthPercent}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Retention & Engagement Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Returning User Rate</span>
            <Repeat className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {retentionStats.returningRate}%
          </div>
          <p className="text-xs text-slate-400 mt-1">Users active on 2+ distinct calendar days</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Avg Active Days</span>
            <Calendar className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {retentionStats.avgActiveDays} days
          </div>
          <p className="text-xs text-slate-400 mt-1">Average distinct days active per registered business</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Power Users</span>
            <UserCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {retentionStats.highlyActiveUsers}
          </div>
          <p className="text-xs text-slate-400 mt-1">Accounts with 5+ recorded transactions</p>
        </div>
      </div>

      {/* 4. Feature Usage Breakdown */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Feature Usage & Adoption</h3>
          <p className="text-xs text-slate-400">
            Which product features are merchants actively utilizing inside Karra?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {featureBreakdown.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
                    {feat.adoptionRate}% adoption
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-white">{feat.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{feat.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Recorded uses:</span>
                  <span className="font-bold text-white">{feat.totalUses}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Drop-off & Friction Points */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-amber-400" />
          Friction & Drop-off Points
        </h3>
        <p className="text-xs text-slate-400">
          Pinpointing where merchants hesitate or discontinue product usage.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <p className="text-[11px] font-semibold text-slate-400">Zero Transaction Accounts</p>
            <p className="text-xl font-bold text-amber-400 mt-1">
              {frictionReport.zeroTransactionUsers} ({frictionReport.zeroTransactionRate}%)
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Registered but have not logged a single sale or expense.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <p className="text-[11px] font-semibold text-slate-400">Inactive &gt; 7 Days</p>
            <p className="text-xl font-bold text-slate-200 mt-1">{frictionReport.inactiveOver7d}</p>
            <p className="text-[11px] text-slate-500 mt-1">No activity in the last 7 calendar days.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <p className="text-[11px] font-semibold text-slate-400">Inactive &gt; 30 Days</p>
            <p className="text-xl font-bold text-slate-400 mt-1">{frictionReport.inactiveOver30d}</p>
            <p className="text-[11px] text-slate-500 mt-1">Dormant accounts needing founder outreach.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
