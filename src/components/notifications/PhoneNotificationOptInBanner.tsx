import React, { useState, useEffect } from 'react';
import { Smartphone, Bell, X, Check, Sparkles, Loader2, Volume2 } from 'lucide-react';
import { KarraLogo } from '../KarraLogo';
import {
  requestBrowserNotificationPermission,
  getBrowserNotificationPermission,
  subscribePhonePushNotifications,
  playCalmNotificationChime,
} from '../../lib/notificationService';

interface PhoneNotificationOptInBannerProps {
  userId?: string;
  onSendTestNotification?: (type: 'morning' | 'day' | 'night') => void;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

const STORAGE_DISMISSED_KEY = 'karra_phone_notif_banner_dismissed_v1';

export const PhoneNotificationOptInBanner: React.FC<PhoneNotificationOptInBannerProps> = ({
  userId,
  onSendTestNotification,
  onShowToast,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDismissed, setIsDismissed] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentPerm = getBrowserNotificationPermission();
    setPermission(currentPerm);

    // Check if dismissed in last 24h
    const dismissedTimestamp = localStorage.getItem(STORAGE_DISMISSED_KEY);
    const now = Date.now();
    const isRecentlyDismissed =
      dismissedTimestamp && now - parseInt(dismissedTimestamp, 10) < 24 * 60 * 60 * 1000;

    // Show if permission is default or if granted recently to allow testing
    if (currentPerm === 'default' && !isRecentlyDismissed) {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_DISMISSED_KEY, Date.now().toString());
  };

  const handleEnablePhoneNotifications = async () => {
    setIsActivating(true);
    try {
      // 1. Play immediate pleasant chime & vibrate phone (WhatsApp rhythm)
      playCalmNotificationChime();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([150, 80, 150, 80, 250]);
        } catch {}
      }

      // 2. Request native browser / phone notification permission
      const result = await requestBrowserNotificationPermission();
      setPermission(result);

      if (result === 'granted') {
        setIsSuccess(true);

        // 3. Subscribe to web push on server
        if (userId) {
          await subscribePhonePushNotifications(userId);
        }

        if (onShowToast) {
          onShowToast(
            'Phone reminders enabled! Karra will notify your lock screen when you are away from the app.',
            'success'
          );
        }

        // Auto dismiss banner after 4 seconds on success
        setTimeout(() => {
          setIsDismissed(true);
        }, 4000);
      } else if (result === 'denied') {
        if (onShowToast) {
          onShowToast(
            'Notifications blocked. Please tap the lock icon in your browser address bar to allow alerts.',
            'warning'
          );
        }
      }
    } catch (err) {
      console.error('[PhoneNotificationOptIn] Activation failed:', err);
    } finally {
      setIsActivating(false);
    }
  };

  if (isDismissed && permission !== 'default' && !isSuccess) {
    return null;
  }

  if (isDismissed) {
    return null;
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F2D1F] via-[#0B2319] to-[#0A1A24] border border-emerald-500/30 text-white shadow-xl relative animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Decorative WhatsApp-green accent bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 w-full" />

      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: WhatsApp style notification preview illustration */}
        <div className="flex items-start space-x-3.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-inner">
              <KarraLogo size="sm" variant="green-bg" />
            </div>
            {/* Small phone indicator badge */}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center ring-2 ring-slate-900 text-[9px] font-bold">
              <Smartphone className="w-2.5 h-2.5" />
            </span>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                Phone Reminders • Like WhatsApp
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300">
                Morning • Day • Night
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
              {isSuccess
                ? 'Phone Notifications Active!'
                : 'Get business check-ins directly on your phone screen'}
            </h3>

            <p className="text-xs text-slate-300/90 leading-relaxed max-w-xl">
              {isSuccess
                ? 'Karra will gently check in 3 times a day to help you record sales, expenses, and stock before you forget. No spam, ever.'
                : 'Never lose track of today’s sales or expenses. Receive gentle check-ins right on your phone’s lock screen and notification shade.'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0 border-t border-emerald-500/20 sm:border-t-0">
          {isSuccess ? (
            <div className="flex items-center space-x-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Connected</span>
              </div>
              {onSendTestNotification && (
                <button
                  type="button"
                  onClick={() => onSendTestNotification('morning')}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Test Alert 🔔
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Later
              </button>

              <button
                type="button"
                onClick={handleEnablePhoneNotifications}
                disabled={isActivating}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2 cursor-pointer"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Enabling...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 text-slate-950" />
                    <span>Turn On Phone Alerts</span>
                  </>
                )}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
