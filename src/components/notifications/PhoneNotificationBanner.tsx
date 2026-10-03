import React, { useEffect, useState } from 'react';
import { X, ArrowRight, MessageSquare, PlusCircle, CheckCircle2, Smartphone } from 'lucide-react';
import { NotificationItem } from '../../types/notification';
import { KarraLogo } from '../KarraLogo';
import { playCalmNotificationChime } from '../../lib/notificationService';

interface PhoneNotificationBannerProps {
  notification: NotificationItem | null;
  onClose: () => void;
  onOpenAction: (actionType: string) => void;
}

export const PhoneNotificationBanner: React.FC<PhoneNotificationBannerProps> = ({
  notification,
  onClose,
  onOpenAction,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);

      // Trigger audio chime and rhythmic phone vibration (WhatsApp signature)
      try {
        playCalmNotificationChime();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([150, 80, 150, 80, 250]);
        }
      } catch {}

      // Auto dismiss after 8 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const handleClick = () => {
    setIsVisible(false);
    if (notification.actionType) {
      onOpenAction(notification.actionType);
    }
    setTimeout(onClose, 200);
  };

  const getActionIcon = () => {
    const act = notification.actionType as string | undefined;
    if (act === 'RECORD_SALE' || act === 'sale') return <PlusCircle className="w-3 h-3" />;
    if (act === 'RECORD_EXPENSE' || act === 'expense') return <PlusCircle className="w-3 h-3" />;
    return <MessageSquare className="w-3 h-3" />;
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-2 sm:top-4 inset-x-2 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 transition-all duration-300 ease-out transform ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100'
          : '-translate-y-10 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      {/* WhatsApp-Style Notification Card */}
      <div
        onClick={handleClick}
        className="w-full bg-[#111B21]/95 dark:bg-[#0B141A]/95 text-white backdrop-blur-xl rounded-2xl p-3.5 shadow-2xl border border-slate-700/60 hover:border-emerald-500/50 cursor-pointer transition-all hover:shadow-emerald-950/20 group"
      >
        {/* Top bar: WhatsApp style app identification */}
        <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 pb-1 border-b border-white/5">
          <div className="flex items-center space-x-1.5">
            {/* Small green app badge */}
            <div className="w-4 h-4 rounded-full bg-[#25D366] text-slate-950 flex items-center justify-center font-bold text-[9px] shadow-xs">
              <KarraLogo size="sm" variant="green-bg" />
            </div>
            <span className="font-bold tracking-wider text-[11px] uppercase text-emerald-400">
              KARRA
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-[11px] text-slate-400">now</span>
          </div>

          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-emerald-400/80 font-medium">Business Reminder</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
                setTimeout(onClose, 200);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content body with avatar */}
        <div className="flex items-start space-x-3 mt-1">
          <div className="relative shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md font-bold text-sm">
              K
            </div>
            {/* WhatsApp online green status dot */}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25D366] ring-2 ring-[#111B21]" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-sm font-bold text-white tracking-tight leading-snug truncate">
              {notification.title}
            </h4>
            <p className="text-xs text-slate-200 line-clamp-2 mt-0.5 leading-relaxed font-normal">
              {notification.message}
            </p>

            {/* Bottom Action Pill matching WhatsApp quick action */}
            <div className="mt-2.5 flex items-center justify-between">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#25D366] text-[#0B141A] font-bold text-xs shadow-md group-hover:bg-emerald-400 transition-colors">
                {getActionIcon()}
                <span>{notification.actionLabel || 'Tell Karra'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>

              <span className="text-[10px] text-slate-400">
                Tap to reply
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
