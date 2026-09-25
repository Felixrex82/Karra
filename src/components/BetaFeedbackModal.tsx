import React, { useState } from 'react';
import {
  MessageSquare,
  X,
  Bug,
  Calculator,
  Bot,
  HelpCircle,
  Sparkles,
  Layout,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { BetaFeedbackType } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface BetaFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab?: string;
  businessName?: string;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const BetaFeedbackModal: React.FC<BetaFeedbackModalProps> = ({
  isOpen,
  onClose,
  currentTab = 'dashboard',
  businessName = 'My Business',
  onShowToast,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<BetaFeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const types: Array<{
    id: BetaFeedbackType;
    label: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    { id: 'bug', label: 'Bug / Error', icon: <Bug className="w-3.5 h-3.5" />, color: 'text-red-500 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60' },
    { id: 'wrong_calculation', label: 'Wrong Math / Calculation', icon: <Calculator className="w-3.5 h-3.5" />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' },
    { id: 'ai_problem', label: 'AI Misunderstood', icon: <Bot className="w-3.5 h-3.5" />, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/60' },
    { id: 'confusing', label: 'Confusing / Hard to use', icon: <HelpCircle className="w-3.5 h-3.5" />, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60' },
    { id: 'missing_feature', label: 'Missing Feature', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60' },
    { id: 'ui_problem', label: 'UI / Mobile Glitch', icon: <Layout className="w-3.5 h-3.5" />, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60' },
    { id: 'general', label: 'General Feedback', icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please write a brief description of the issue or feedback.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'anonymous-beta-user',
          userEmail: user?.email || '',
          businessName,
          type,
          message: message.trim(),
          context: {
            tab: currentTab,
            userAgent: navigator.userAgent,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (onShowToast) onShowToast('Thank you! Your feedback was sent directly to the founder.', 'success');
        setMessage('');
        onClose();
      } else {
        setError(data.error || 'Failed to submit feedback.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error submitting feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Send Founder Feedback
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Report bugs, calculation issues, or ideas directly to the creator of Karra.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start space-x-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              What kind of issue or note is this?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    type === t.id
                      ? `${t.color} font-bold ring-2 ring-emerald-500/40`
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Details & Description
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. When I typed 'Sold 5 shirts for 30k', the gross profit showed negative even though my cost was 4k each..."
              rows={4}
              required
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1E293B] text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Attached Context Badge */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>
              Context attached: <strong className="text-slate-700 dark:text-slate-300">{currentTab}</strong> tab &bull; {businessName}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Safe & Private</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer transition-all"
            >
              {isSubmitting ? (
                <span>Sending...</span>
              ) : (
                <>
                  <span>Send Feedback</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
