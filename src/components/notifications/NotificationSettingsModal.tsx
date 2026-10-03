import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Clock,
  Moon,
  Volume2,
  VolumeX,
  Globe,
  Check,
  Shield,
  Smartphone,
  Sparkles,
  ChevronDown,
  Info,
  Loader2,
} from 'lucide-react';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../types/notification';
import {
  requestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  playCalmNotificationChime,
} from '../../lib/notificationService';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: NotificationPreferences;
  onSavePreferences: (updated: NotificationPreferences) => void;
  onSendTestNotification?: (type: 'morning' | 'day' | 'night' | 'first_use' | 'inactive') => void;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
  onSendTestNotification,
  onShowToast,
}) => {
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences>(preferences);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);
  const [testDropdownOpen, setTestDropdownOpen] = useState(false);

  useEffect(() => {
    setLocalPrefs(preferences);
    setBrowserPermission(getBrowserNotificationPermission());
  }, [preferences, isOpen]);

  if (!isOpen) return null;

  const handleToggleMaster = () => {
    const next = { ...localPrefs, enabled: !localPrefs.enabled };
    setLocalPrefs(next);
    onSavePreferences(next);
    if (onShowToast) {
      onShowToast(next.enabled ? 'Karra reminders enabled' : 'Karra reminders paused', 'info');
    }
  };

  const handleUpdate = (updater: (prev: NotificationPreferences) => NotificationPreferences) => {
    const next = updater(localPrefs);
    setLocalPrefs(next);
    onSavePreferences(next);
  };

  const handleRequestPush = async () => {
    setIsRequestingPerm(true);
    try {
      const res = await requestBrowserNotificationPermission();
      setBrowserPermission(res);
      if (res === 'granted') {
        handleUpdate((p) => ({
          ...p,
          channels: { ...p.channels, browserPush: true },
        }));
        if (onShowToast) onShowToast('Browser notifications enabled!', 'success');
      } else if (res === 'denied') {
        if (onShowToast) {
          onShowToast(
            'Browser notifications were blocked. Please enable them in your browser settings.',
            'warning'
          );
        }
      }
    } finally {
      setIsRequestingPerm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-white dark:bg-[#0E1A29] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-[#122033]/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Reminder & Notification Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                “You don't learn Karra. Karra learns your business.”
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Master Toggle */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Karra Business Reminders
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    localPrefs.enabled
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {localPrefs.enabled ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Gentle, contextual reminders to help you record sales, stock, and expenses while still fresh. Never spammy.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleMaster}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                localPrefs.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  localPrefs.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Delivery Channels */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Delivery Channels
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* In-App Notifications */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bell className="w-4 h-4 text-emerald-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      In-App Inbox
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Inside Karra notification center
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.channels.inApp}
                  onChange={(e) =>
                    handleUpdate((p) => ({
                      ...p,
                      channels: { ...p.channels, inApp: e.target.checked },
                    }))
                  }
                  className="rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                />
              </div>

              {/* Browser Push */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Smartphone className="w-4 h-4 text-sky-500" />
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Browser Push
                      </p>
                      {browserPermission === 'granted' && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-500 font-bold px-1.5 py-0.2 rounded-sm">
                          Allowed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      When browser is backgrounded
                    </p>
                  </div>
                </div>
                {browserPermission === 'granted' ? (
                  <input
                    type="checkbox"
                    checked={localPrefs.channels.browserPush}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        channels: { ...p.channels, browserPush: e.target.checked },
                      }))
                    }
                    className="rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                  />
                ) : (
                  <button
                    onClick={handleRequestPush}
                    disabled={isRequestingPerm}
                    className="text-xs font-semibold px-2 py-1 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    {isRequestingPerm ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Enable'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3 Natural Reminder Windows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Natural Reminder Windows
              </h3>
              <span className="text-[11px] text-slate-400">Timezone: {localPrefs.timezone}</span>
            </div>

            <div className="space-y-2.5">
              {/* Morning Window */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Morning Window (7:00 AM – 9:00 AM)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    “Good morning 👋 What’s happening in your business today?”
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="time"
                    value={localPrefs.windows.morning.targetTime}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        windows: {
                          ...p.windows,
                          morning: { ...p.windows.morning, targetTime: e.target.value },
                        },
                      }))
                    }
                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                  />
                  <input
                    type="checkbox"
                    checked={localPrefs.windows.morning.enabled}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        windows: {
                          ...p.windows,
                          morning: { ...p.windows.morning, enabled: e.target.checked },
                        },
                      }))
                    }
                    className="rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                  />
                </div>
              </div>

              {/* Daytime Window */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Daytime Window (1:00 PM – 3:00 PM)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    “Don’t let today’s business slip away. Made a sale or spent money?”
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="time"
                    value={localPrefs.windows.day.targetTime}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        windows: {
                          ...p.windows,
                          day: { ...p.windows.day, targetTime: e.target.value },
                        },
                      }))
                    }
                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                  />
                  <input
                    type="checkbox"
                    checked={localPrefs.windows.day.enabled}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        windows: {
                          ...p.windows,
                          day: { ...p.windows.day, enabled: e.target.checked },
                        },
                      }))
                    }
                    className="rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                  />
                </div>
              </div>

              {/* Night Window */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Night Window (7:00 PM – 9:00 PM)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    “Before you call it a day… take a moment to tell Karra what happened.”
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="time"
                    value={localPrefs.windows.night.targetTime}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        windows: {
                          ...p.windows,
                          night: { ...p.windows.night, targetTime: e.target.value },
                        },
                      }))
                    }
                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                  />
                  <input
                    type="checkbox"
                    checked={localPrefs.windows.night.enabled}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        windows: {
                          ...p.windows,
                          night: { ...p.windows.night, enabled: e.target.checked },
                        },
                      }))
                    }
                    className="rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quiet Hours & Smart Frequency Protection */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Respect & Quiet Hours
            </h3>
            <div className="space-y-2.5">
              {/* Quiet hours */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Quiet Hours
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Never disturb between {localPrefs.quietHours.startTime} and {localPrefs.quietHours.endTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="time"
                    value={localPrefs.quietHours.startTime}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        quietHours: { ...p.quietHours, startTime: e.target.value },
                      }))
                    }
                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 text-slate-800 dark:text-slate-200"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={localPrefs.quietHours.endTime}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        quietHours: { ...p.quietHours, endTime: e.target.value },
                      }))
                    }
                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 text-slate-800 dark:text-slate-200"
                  />
                  <input
                    type="checkbox"
                    checked={localPrefs.quietHours.enabled}
                    onChange={(e) =>
                      handleUpdate((p) => ({
                        ...p,
                        quietHours: { ...p.quietHours, enabled: e.target.checked },
                      }))
                    }
                    className="ml-2 rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                  />
                </div>
              </div>

              {/* Active Suppression Toggle */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <div className="max-w-xs sm:max-w-sm">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Active Merchant Suppression
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Suppress reminders if you've been active in the last 60 minutes. Karra never interrupts work.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.suppressWhenRecentlyActive}
                  onChange={(e) =>
                    handleUpdate((p) => ({
                      ...p,
                      suppressWhenRecentlyActive: e.target.checked,
                    }))
                  }
                  className="rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                />
              </div>

              {/* Sound chime */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#122033] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Calm Audio Chime
                      </p>
                      <button
                        type="button"
                        onClick={playCalmNotificationChime}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        (Preview Sound)
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Subtle wooden marimba double tone
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.soundEnabled}
                  onChange={(e) =>
                    handleUpdate((p) => ({
                      ...p,
                      soundEnabled: e.target.checked,
                    }))
                  }
                  className="rounded-sm border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                />
              </div>
            </div>
          </div>

          {/* Test reminder triggers */}
          {onSendTestNotification && (
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Preview Reminder Copy & Experience
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Test how Karra gently checks in without aggressive language or spam.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSendTestNotification('morning')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Test Morning 👋
                </button>
                <button
                  type="button"
                  onClick={() => onSendTestNotification('day')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Test Daytime ☀️
                </button>
                <button
                  type="button"
                  onClick={() => onSendTestNotification('night')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Test Night 🌙
                </button>
                <button
                  type="button"
                  onClick={() => onSendTestNotification('first_use')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Test First-Use ✨
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#122033]/50 flex items-center justify-between">
          <span className="text-xs text-slate-400">Changes save automatically</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
