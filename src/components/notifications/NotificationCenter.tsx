import React, { useState } from 'react';
import {
  X,
  Bell,
  Sun,
  Moon,
  Clock,
  Sparkles,
  CheckCheck,
  Settings,
  ArrowRight,
  TrendingUp,
  Receipt,
  Package,
  User,
  MessageSquare,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  NotificationItem,
  NotificationCategory,
  NotificationActionType,
} from '../../types/notification';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (notificationIds?: string[]) => void;
  onOpenSettings: () => void;
  onOpenAction: (actionType: string) => void;
  onTriggerTest?: (type: 'morning' | 'day' | 'night' | 'first_use' | 'inactive') => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onOpenSettings,
  onOpenAction,
  onTriggerTest,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'reminders'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'reminders') {
      return (
        item.category === 'MORNING_REMINDER' ||
        item.category === 'DAY_REMINDER' ||
        item.category === 'NIGHT_REMINDER' ||
        item.category === 'CONTEXTUAL_FOLLOWUP'
      );
    }
    return true;
  });

  const getCategoryBadge = (category: NotificationCategory) => {
    switch (category) {
      case 'MORNING_REMINDER':
        return {
          label: 'Morning Check-in',
          icon: Sun,
          badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          iconClass: 'text-amber-500',
        };
      case 'DAY_REMINDER':
        return {
          label: 'Daytime Reminder',
          icon: Clock,
          badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
          iconClass: 'text-sky-500',
        };
      case 'NIGHT_REMINDER':
        return {
          label: 'Night Wrap-up',
          icon: Moon,
          badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          iconClass: 'text-indigo-400',
        };
      case 'ONBOARDING_REMINDER':
        return {
          label: 'Welcome',
          icon: Sparkles,
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          iconClass: 'text-emerald-500',
        };
      case 'FIRST_USE_REMINDER':
        return {
          label: 'First Activity',
          icon: Sparkles,
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          iconClass: 'text-emerald-500',
        };
      case 'INACTIVE_USER_REMINDER':
        return {
          label: 'Friendly Check-in',
          icon: User,
          badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
          iconClass: 'text-violet-400',
        };
      default:
        return {
          label: 'Karra Assistant',
          icon: Bell,
          badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
          iconClass: 'text-slate-400',
        };
    }
  };

  const formatTimeAgo = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleActionClick = (item: NotificationItem) => {
    // Mark as read
    if (!item.read) {
      onMarkRead([item.id]);
    }
    // Close drawer
    onClose();

    // Trigger action
    if (!item.actionType) return;
    switch (item.actionType) {
      case 'RECORD_SALE':
        onOpenAction('sale');
        break;
      case 'RECORD_EXPENSE':
        onOpenAction('expense');
        break;
      case 'ADD_STOCK':
        onOpenAction('stock');
        break;
      case 'ADD_CUSTOMER':
        onOpenAction('customer');
        break;
      case 'CHAT_KARRA':
      default:
        onOpenAction('chat');
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-[#0E1A29] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col text-slate-800 dark:text-slate-100 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-[#122033]/50">
            <div className="flex items-center space-x-2.5">
              <div className="relative w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0E1A29]" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      {unreadCount} new
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => onMarkRead()}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reminder settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2 bg-slate-50/30 dark:bg-[#122033]/30">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'unread'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('reminders')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'reminders'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Reminders
            </button>
          </div>

          {/* Quick Test on Phone Bar */}
          {onTriggerTest && (
            <div className="px-5 py-2 bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-emerald-500/10 flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                📲 Test Phone Alert:
              </span>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => onTriggerTest('morning')}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Morning 👋
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerTest('day')}
                  className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Day ☀️
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerTest('night')}
                  className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Night 🌙
                </button>
              </div>
            </div>
          )}

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Check className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    You're all caught up
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                    Karra only sends gentle reminders when it’s genuinely helpful for your business.
                  </p>
                </div>
                {onTriggerTest && (
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => onTriggerTest('morning')}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      Preview Morning Reminder 👋
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const badge = getCategoryBadge(item.category);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={item.id}
                    className={`relative p-4 rounded-xl border transition-all ${
                      item.read
                        ? 'bg-white dark:bg-[#122033] border-slate-200/80 dark:border-slate-800/80 opacity-85 hover:opacity-100'
                        : 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-500/30 shadow-xs'
                    }`}
                  >
                    {/* Unread indicator */}
                    {!item.read && (
                      <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500" />
                    )}

                    {/* Category pill & time */}
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badge.badgeClass}`}
                      >
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 mr-4">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>

                    {/* Title & Message */}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {/* Actions bar */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      {item.actionType ? (
                        <button
                          type="button"
                          onClick={() => handleActionClick(item)}
                          className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer group"
                        >
                          <span>{item.actionLabel || 'Take Action'}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ) : (
                        <span />
                      )}

                      {!item.read && (
                        <button
                          type="button"
                          onClick={() => onMarkRead([item.id])}
                          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#122033]/50 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Contextual reminders enabled</span>
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
            >
              Configure windows
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
