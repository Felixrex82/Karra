import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Activity,
  Building2,
  Receipt,
  Sparkles,
  Repeat,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronRight,
  Eye,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import { AdminUserRecord, AdminEventRecord, DailyActivityRecord } from './adminTypes';

interface AdminOverviewTabProps {
  users: AdminUserRecord[];
  events: AdminEventRecord[];
  dailyActivity: DailyActivityRecord[];
  dateRangeLabel: string;
  onSelectUser: (user: AdminUserRecord) => void;
  onNavigateTab: (tab: any) => void;
  filterStartDate?: Date;
  filterEndDate?: Date;
  comparisonStats?: {
    prevNewUsers: number;
    prevActiveUsers: number;
    prevTransactions: number;
    prevAiInteractions: number;
  };
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  users,
  events,
  dailyActivity,
  dateRangeLabel,
  onSelectUser,
  onNavigateTab,
  filterStartDate,
  filterEndDate,
  comparisonStats,
}) => {
  // Selected day inspection modal state
  const [selectedDayRecord, setSelectedDayRecord] = useState<DailyActivityRecord | null>(null);

  // Hover state for signup chart
  const [hoveredSignupIndex, setHoveredSignupIndex] = useState<number | null>(null);

  // 1. Calculate Period KPIs
  const periodStats = useMemo(() => {
    const totalSignups = users.length;
    const betaUsers = users.filter((u) => u.betaStatus === 'active').length;

    // Filter events inside date range
    const periodEvents = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      if (filterStartDate && t < filterStartDate.getTime()) return false;
      if (filterEndDate && t > filterEndDate.getTime()) return false;
      return true;
    });

    // New users in period
    const newUsersList = users.filter((u) => {
      const t = new Date(u.joinedAt).getTime();
      if (filterStartDate && t < filterStartDate.getTime()) return false;
      if (filterEndDate && t > filterEndDate.getTime()) return false;
      return true;
    });
    const newUsers = newUsersList.length;

    // Meaningful active users & businesses in period
    const activeUserIds = new Set<string>();
    const activeBusinessNames = new Set<string>();

    periodEvents.forEach((ev) => {
      if (ev.userId && ev.userId !== 'guest') {
        activeUserIds.add(ev.userId);
      }
      if (ev.businessName) {
        activeBusinessNames.add(ev.businessName);
      }
    });

    // Also include users who had lastActiveAt in period
    users.forEach((u) => {
      const t = new Date(u.lastActiveAt || u.joinedAt).getTime();
      if (filterStartDate && t >= filterStartDate.getTime() && (!filterEndDate || t <= filterEndDate.getTime())) {
        activeUserIds.add(u.userId);
        if (u.businessName) activeBusinessNames.add(u.businessName);
      }
    });

    const activeUsers = activeUserIds.size;
    const activeBusinesses = activeBusinessNames.size;

    // Transactions in period (sales, expenses, stock)
    const transactionEvents = periodEvents.filter((e) =>
      ['sale_recorded', 'expense_recorded', 'stock_updated', 'transaction_created', 'debt_recorded', 'debt_updated'].includes(e.eventName)
    );
    const totalTransactions = transactionEvents.length;

    // AI Interactions in period
    const aiEvents = periodEvents.filter((e) =>
      ['ai_query', 'ai_interaction', 'ai_interpret', 'conversational_question', 'natural_input_processed'].includes(e.eventName)
    );
    const aiInteractions = aiEvents.length;

    // Returning Users: Active in period, but joined or had activity BEFORE period start
    let returningUsers = 0;
    if (filterStartDate) {
      activeUserIds.forEach((uid) => {
        const u = users.find((usr) => usr.userId === uid);
        if (u && new Date(u.joinedAt).getTime() < filterStartDate.getTime()) {
          returningUsers += 1;
        }
      });
    }

    return {
      totalSignups,
      activeUsers,
      newUsers,
      activeBusinesses,
      totalTransactions,
      aiInteractions,
      returningUsers,
      betaUsers,
      periodEvents,
    };
  }, [users, events, filterStartDate, filterEndDate]);

  // Compute Percentage Comparison
  const getDiffBadge = (current: number, previous?: number) => {
    if (previous === undefined || previous === null) return null;
    if (previous === 0) {
      if (current === 0) return <span className="text-[11px] text-slate-400">0% vs prev</span>;
      return <span className="text-[11px] text-emerald-400 font-medium">+{current} vs prev</span>;
    }
    const diff = Math.round(((current - previous) / previous) * 100);
    const isPositive = diff >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? `+${diff}%` : `${diff}%`}
        <span className="text-slate-400 font-normal ml-0.5">vs prev</span>
      </span>
    );
  };

  // 2. Prepare Signups Time-series Points
  const signupsTimeSeries = useMemo(() => {
    return dailyActivity.map((d) => ({
      dateStr: d.dateStr,
      displayDate: d.displayDate,
      count: d.newUsers,
    }));
  }, [dailyActivity]);

  const maxSignups = Math.max(...signupsTimeSeries.map((s) => s.count), 1);
  const totalSignupsInView = signupsTimeSeries.reduce((acc, curr) => acc + curr.count, 0);

  // 3. Recent Activity Events List
  const recentEvents = useMemo(() => {
    return events.slice(0, 20);
  }, [events]);

  const formatEventLabel = (eventName: string) => {
    switch (eventName) {
      case 'user_registered':
        return { label: 'New User Registered', color: 'text-purple-400 bg-purple-950/60 border-purple-800/60' };
      case 'user_login':
        return { label: 'User Signed In', color: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60' };
      case 'sale_recorded':
        return { label: 'Sale Recorded', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' };
      case 'expense_recorded':
        return { label: 'Expense Recorded', color: 'text-amber-400 bg-amber-950/60 border-amber-800/60' };
      case 'stock_updated':
        return { label: 'Stock / Product Updated', color: 'text-sky-400 bg-sky-950/60 border-sky-800/60' };
      case 'customer_added':
        return { label: 'Customer Added', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60' };
      case 'debt_recorded':
      case 'debt_updated':
        return { label: 'Customer Debt Logged', color: 'text-rose-400 bg-rose-950/60 border-rose-800/60' };
      case 'ai_query':
      case 'ai_interaction':
      case 'conversational_question':
        return { label: 'AI Business Question', color: 'text-teal-400 bg-teal-950/60 border-teal-800/60' };
      case 'feedback_submitted':
        return { label: 'Feedback Submitted', color: 'text-pink-400 bg-pink-950/60 border-pink-800/60' };
      case 'beta_access_requested':
        return { label: 'Beta Access Requested', color: 'text-yellow-400 bg-yellow-950/60 border-yellow-800/60' };
      case 'beta_invite_redeemed':
        return { label: 'Invitation Redeemed', color: 'text-emerald-300 bg-emerald-900/60 border-emerald-700/60' };
      default:
        return { label: eventName.replace(/_/g, ' '), color: 'text-slate-300 bg-slate-900 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. OVERVIEW KPI SECTION                                    */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Key Metrics ({dateRangeLabel})
          </h2>
          <span className="text-xs text-slate-500 font-medium">Updated just now</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Total Sign-ups */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Total Sign-ups</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.totalSignups}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">All registered accounts</p>
          </div>

          {/* 2. Active Users */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Active Users</span>
              <Activity className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.activeUsers}
            </div>
            <div className="mt-1">
              {getDiffBadge(periodStats.activeUsers, comparisonStats?.prevActiveUsers) || (
                <span className="text-[11px] text-slate-500">Meaningful actions in period</span>
              )}
            </div>
          </div>

          {/* 3. New Users */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">New Users</span>
              <UserPlus className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.newUsers}
            </div>
            <div className="mt-1">
              {getDiffBadge(periodStats.newUsers, comparisonStats?.prevNewUsers) || (
                <span className="text-[11px] text-slate-500">Joined in period</span>
              )}
            </div>
          </div>

          {/* 4. Active Businesses */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Active Businesses</span>
              <Building2 className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.activeBusinesses}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Unique active stores</p>
          </div>

          {/* 5. Total Transactions */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Total Transactions</span>
              <Receipt className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.totalTransactions}
            </div>
            <div className="mt-1">
              {getDiffBadge(periodStats.totalTransactions, comparisonStats?.prevTransactions) || (
                <span className="text-[11px] text-slate-500">Actual sales & expenses</span>
              )}
            </div>
          </div>

          {/* 6. AI Interactions */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">AI Interactions</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.aiInteractions}
            </div>
            <div className="mt-1">
              {getDiffBadge(periodStats.aiInteractions, comparisonStats?.prevAiInteractions) || (
                <span className="text-[11px] text-slate-500">Natural queries & chats</span>
              )}
            </div>
          </div>

          {/* 7. Returning Users */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Returning Users</span>
              <Repeat className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.returningUsers}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Joined prior, active now</p>
          </div>

          {/* 8. Beta Users */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Beta Users</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {periodStats.betaUsers}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Authorized beta testers</p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SIGNUPS OVER TIME (Time-Series Chart)                   */}
      {/* ========================================================= */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Sign-ups Over Time</h3>
            <p className="text-xs text-slate-400">
              New merchant registrations across {dateRangeLabel} ({totalSignupsInView} new)
            </p>
          </div>
        </div>

        {totalSignupsInView === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <UserPlus className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No sign-ups recorded for this period.</p>
            <p className="text-xs text-slate-500 mt-1">New account registrations will plot automatically here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Interactive SVG Bar / Step Chart */}
            <div className="h-44 sm:h-52 w-full flex items-end gap-1 sm:gap-2 pt-6 pb-2 px-1 relative">
              {signupsTimeSeries.map((item, idx) => {
                const heightPercent = Math.max((item.count / maxSignups) * 100, item.count > 0 ? 12 : 2);
                const isHovered = hoveredSignupIndex === idx;

                return (
                  <div
                    key={item.dateStr}
                    className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                    onMouseEnter={() => setHoveredSignupIndex(idx)}
                    onMouseLeave={() => setHoveredSignupIndex(null)}
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div className="absolute -top-10 z-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-white whitespace-nowrap shadow-xl">
                        <span className="font-bold text-emerald-400">{item.count}</span> {item.count === 1 ? 'signup' : 'signups'} on {item.displayDate}
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-200 ${
                        item.count > 0
                          ? isHovered
                            ? 'bg-emerald-400 shadow-lg shadow-emerald-500/20'
                            : 'bg-emerald-500/80 hover:bg-emerald-400'
                          : 'bg-slate-800/40'
                      }`}
                    />

                    {/* Bottom Label (skip some on small screens) */}
                    <span className="text-[10px] text-slate-500 mt-2 truncate w-full text-center hidden sm:block">
                      {item.displayDate.split(',')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. DAILY ACTIVITY (Chart & Table + Date Drilldown)        */}
      {/* ========================================================= */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Daily Activity</h3>
            <p className="text-xs text-slate-400">
              Breakdown of product events by day. Click any date to inspect exactly what occurred.
            </p>
          </div>
        </div>

        {dailyActivity.length === 0 ? (
          <div className="py-10 text-center rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No activity yet</p>
            <p className="text-xs text-slate-500 mt-1">Recorded events will populate daily metrics.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">New Users</th>
                  <th className="py-3 px-3">Active Users</th>
                  <th className="py-3 px-3">Transactions</th>
                  <th className="py-3 px-3">AI Interactions</th>
                  <th className="py-3 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dailyActivity.map((day) => {
                  const hasActivity = day.newUsers > 0 || day.activeUsers > 0 || day.transactions > 0 || day.aiInteractions > 0;
                  return (
                    <tr
                      key={day.dateStr}
                      onClick={() => setSelectedDayRecord(day)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3 font-semibold text-white flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                        <span>{day.displayDate}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={day.newUsers > 0 ? 'text-purple-400 font-bold' : 'text-slate-500'}>
                          {day.newUsers}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={day.activeUsers > 0 ? 'text-teal-400 font-bold' : 'text-slate-500'}>
                          {day.activeUsers}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={day.transactions > 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                          {day.transactions}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={day.aiInteractions > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                          {day.aiInteractions}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors"
                        >
                          <span>Drilldown</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. RECENT ACTIVITY STREAM                                 */}
      {/* ========================================================= */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Recent Activity</h3>
            <p className="text-xs text-slate-400">Live operational events stream</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('activity')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View all events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentEvents.length === 0 ? (
          <div className="py-8 text-center rounded-2xl bg-slate-950/50 border border-slate-800/60">
            <Clock className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No activity yet</p>
            <p className="text-xs text-slate-500 mt-0.5">Events performed by merchants will stream here in real time.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {recentEvents.map((ev) => {
              const eventInfo = formatEventLabel(ev.eventName);
              const matchingUser = users.find((u) => u.userId === ev.userId);

              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (matchingUser) onSelectUser(matchingUser);
                  }}
                  className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    matchingUser ? 'hover:bg-slate-800/40 cursor-pointer rounded-xl px-2' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${eventInfo.color}`}>
                      {eventInfo.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {ev.businessName || matchingUser?.businessName || 'Business Account'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {ev.userEmail || matchingUser?.email || ev.userId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto text-[11px] text-slate-400">
                    <span title={new Date(ev.timestamp).toLocaleString()}>
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                      {new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    {matchingUser && (
                      <Eye className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* DATE DRILLDOWN INSPECTOR MODAL ("What happened on Tuesday?") */}
      {/* ========================================================= */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Activity on {selectedDayRecord.displayDate}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedDayRecord.events.length} events across {selectedDayRecord.activeUsers} active accounts
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayRecord(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics of the Day */}
            <div className="p-4 grid grid-cols-4 gap-2 border-b border-slate-800/80 bg-slate-950/30 text-center">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">New Users</p>
                <p className="text-base font-bold text-purple-400">{selectedDayRecord.newUsers}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Active Users</p>
                <p className="text-base font-bold text-teal-400">{selectedDayRecord.activeUsers}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Transactions</p>
                <p className="text-base font-bold text-emerald-400">{selectedDayRecord.transactions}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">AI Uses</p>
                <p className="text-base font-bold text-amber-400">{selectedDayRecord.aiInteractions}</p>
              </div>
            </div>

            {/* Events Feed for That Day */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {selectedDayRecord.events.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No individual granular events were logged for this day.
                </div>
              ) : (
                selectedDayRecord.events.map((ev) => {
                  const eventInfo = formatEventLabel(ev.eventName);
                  const matchingUser = users.find((u) => u.userId === ev.userId);

                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        if (matchingUser) {
                          setSelectedDayRecord(null);
                          onSelectUser(matchingUser);
                        }
                      }}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-emerald-500/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${eventInfo.color}`}>
                          {eventInfo.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {ev.businessName || matchingUser?.businessName || 'Business Account'}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {ev.userEmail || matchingUser?.email || ev.userId}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-slate-300">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {matchingUser && (
                          <span className="text-[10px] font-semibold text-emerald-400">View Business &rarr;</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
              >
                Close Drilldown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
