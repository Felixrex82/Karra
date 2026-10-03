import React, { useState, useEffect } from 'react';
import {
  Bell,
  Sun,
  Clock,
  Moon,
  Shield,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sparkles,
  User,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { AdminUserRecord } from './adminTypes';

interface AdminNotificationsTabProps {
  users: AdminUserRecord[];
  adminSecret: string;
  adminEmail: string;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({
  users,
  adminSecret,
  adminEmail,
  onShowToast,
}) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggeringCycle, setIsTriggeringCycle] = useState(false);
  const [cycleResults, setCycleResults] = useState<any>(null);
  const [selectedUserForTest, setSelectedUserForTest] = useState<string>(
    users[0]?.userId || ''
  );
  const [testType, setTestType] = useState<
    'morning' | 'day' | 'night' | 'first_use' | 'inactive' | 'sale_no_expense' | 'several_recorded'
  >('morning');
  const [isDispatchingTest, setIsDispatchingTest] = useState(false);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        headers: {
          'x-admin-secret': adminSecret,
          'x-admin-email': adminEmail,
        },
      });
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to load notification analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [adminSecret, adminEmail]);

  const handleTriggerCycle = async () => {
    setIsTriggeringCycle(true);
    setCycleResults(null);
    try {
      const res = await fetch('/api/admin/notifications/trigger-cycle', {
        method: 'POST',
        headers: {
          'x-admin-secret': adminSecret,
          'x-admin-email': adminEmail,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCycleResults(data);
        onShowToast(
          `Cycle completed: ${data.evaluatedUsersCount} users evaluated, ${data.dispatchedCount} reminders delivered.`,
          'success'
        );
        fetchAnalytics();
      } else {
        onShowToast(data.error || 'Failed to trigger evaluation cycle.', 'warning');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Error executing cycle.', 'warning');
    } finally {
      setIsTriggeringCycle(false);
    }
  };

  const handleDispatchTest = async () => {
    if (!selectedUserForTest) {
      onShowToast('Select a merchant first.', 'warning');
      return;
    }
    setIsDispatchingTest(true);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForTest,
          type: testType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast(data.message || 'Test reminder dispatched!', 'success');
        fetchAnalytics();
      } else {
        onShowToast(data.error || 'Failed to send test reminder.', 'warning');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Test dispatch error.', 'warning');
    } finally {
      setIsDispatchingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with trigger button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Karra Intelligent Reminder Engine
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Respectful 3-window schedule (Morning, Daytime, Night). Contextually aware of sales, expenses, and active merchant behavior. Never sends spam.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleTriggerCycle}
            disabled={isTriggeringCycle}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            {isTriggeringCycle ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run Evaluation Cycle</span>
          </button>
        </div>
      </div>

      {/* Cycle Results Banner if run */}
      {cycleResults && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>
              Evaluation cycle completed: evaluated <strong>{cycleResults.evaluatedUsersCount}</strong> registered merchants, delivered <strong>{cycleResults.dispatchedCount}</strong> contextual reminders.
            </span>
          </div>
          <button
            onClick={() => setCycleResults(null)}
            className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Analytics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Dispatched</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {analytics?.totalDispatched ?? 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Lifetime reminders</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Sent Today</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {analytics?.totalSent ?? 0}
          </p>
          <p className="text-[11px] text-emerald-500/80 mt-0.5">Delivered in window</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Suppressed (Active)</p>
          <p className="text-xl font-bold text-amber-500 mt-1">
            {analytics?.suppressedActiveUser ?? 0}
          </p>
          <p className="text-[11px] text-amber-500/80 mt-0.5">User active &lt;60m</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Suppressed (Quiet)</p>
          <p className="text-xl font-bold text-indigo-400 mt-1">
            {analytics?.suppressedQuietHours ?? 0}
          </p>
          <p className="text-[11px] text-indigo-400/80 mt-0.5">Quiet hours respected</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Read / Opened Rate</p>
          <p className="text-xl font-bold text-sky-500 mt-1">
            {analytics?.readRate ?? 0}%
          </p>
          <p className="text-[11px] text-sky-400/80 mt-0.5">{analytics?.totalRead ?? 0} opened</p>
        </div>
      </div>

      {/* Live Test & Simulator Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Founder Test Simulator
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Simulate a reminder delivery to any merchant account to preview copy and check-in behavior.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <select
            value={selectedUserForTest}
            onChange={(e) => setSelectedUserForTest(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          >
            {users.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.businessName || 'Business'} ({u.email || u.userId.slice(0, 8)})
              </option>
            ))}
          </select>

          <select
            value={testType}
            onChange={(e: any) => setTestType(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          >
            <option value="morning">Morning Check-in 👋</option>
            <option value="day">Daytime Reminder ☀️</option>
            <option value="night">Night Wrap-up 🌙</option>
            <option value="sale_no_expense">Contextual: Sale recorded, no expense</option>
            <option value="several_recorded">Contextual: Several transactions recorded</option>
            <option value="first_use">First-Use Encouragement ✨</option>
            <option value="inactive">Inactive User Check-in 🤝</option>
          </select>

          <button
            type="button"
            onClick={handleDispatchTest}
            disabled={isDispatchingTest}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center space-x-1.5"
          >
            {isDispatchingTest ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
            <span>Dispatch Test Reminder</span>
          </button>
        </div>
      </div>

      {/* Dispatched History Log */}
      <div className="rounded-2xl bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Reminder Dispatches
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit log of reminders sent to Karra merchants
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {analytics?.recentDispatches?.length ?? 0} entries
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-96 overflow-y-auto">
          {(!analytics?.recentDispatches || analytics.recentDispatches.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No reminders dispatched yet. Click "Run Evaluation Cycle" or send a test above.
            </div>
          ) : (
            analytics.recentDispatches.map((item: any) => (
              <div key={item.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-[#122033]/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {item.message}
                </p>
                <div className="flex items-center space-x-3 mt-2 text-[11px] text-slate-400">
                  <span>User: <code className="text-slate-600 dark:text-slate-300">{item.userId.slice(0, 10)}...</code></span>
                  <span>Channel: {item.deliveryChannel}</span>
                  {item.contextMeta?.reason && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      Reason: {item.contextMeta.reason}
                    </span>
                  )}
                  {item.read && <span className="text-sky-500 font-semibold">✓ Read</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
