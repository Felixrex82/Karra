import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  TrendingUp,
  Package,
  Users,
  Lightbulb,
  X,
  Store,
  HelpCircle,
} from 'lucide-react';
import { KarraLogo } from './KarraLogo';

interface BetaOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
}

export const BetaOnboardingModal: React.FC<BetaOnboardingModalProps> = ({
  isOpen,
  onClose,
  businessName,
}) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to the Karra Private Beta',
      subtitle: `Your workspace for ${businessName} is ready.`,
      icon: <Store className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            Karra is an intelligent business operating memory built specifically for real Nigerian merchants, traders, and store owners.
          </p>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
            <span className="font-semibold text-emerald-800 dark:text-emerald-200">
              Zero complicated accounting jargon.
            </span>{' '}
            No debits, credits, or balance sheets to memorize. Simply tell Karra what happened in your store using your natural words.
          </div>
        </div>
      ),
    },
    {
      title: 'How to Speak to Karra',
      subtitle: 'Type or speak your everyday transactions naturally.',
      icon: <MessageSquare className="w-8 h-8 text-sky-600 dark:text-sky-400" />,
      content: (
        <div className="space-y-2.5 text-xs sm:text-sm">
          <p className="text-slate-600 dark:text-slate-300 mb-2">
            Karra automatically extracts products, quantities, prices, profits, and debts:
          </p>
          <div className="space-y-2">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">
                Sales
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                "I sold 5 shirts for #30,000 cash"
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-0.5">
                Restocking
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                "Bought 20 shirts for 70k from Balogun"
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-0.5">
                Customer Debts
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                "David bought 2 bags of rice for 116k, paid 80k, owes 36k"
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                Expenses
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                "Spent 5,000 on generator fuel and 2,000 for keke transport"
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Use Your Real Business Figures',
      subtitle: 'Real data gives you real superpowers.',
      icon: <TrendingUp className="w-8 h-8 text-violet-600 dark:text-violet-400" />,
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            Karra works best when you log your <strong>actual daily transactions</strong>. The more real entries you provide, the better Karra calculates your real gross margins, tells you who owes you, and spots hidden profit leaks.
          </p>
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-amber-900 dark:text-amber-200">
            <strong>Your data is private & isolated:</strong> Only you and your authenticated account have access to your store's transactions and ledger.
          </div>
        </div>
      ),
    },
    {
      title: 'You Are Shaping Karra',
      subtitle: 'Direct line to the founder for feedback & questions.',
      icon: <HelpCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
      content: (
        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            As an invited private beta tester, you have a direct connection to the engineering team.
          </p>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-semibold">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              <span>Use the "Feedback" button anytime</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Found a bug, wrong arithmetic, or confusing wording? Tap the <strong>Beta Feedback</strong> button in the top navigation to send a report directly to the founder.
            </p>
          </div>
          <p className="text-center font-medium text-emerald-600 dark:text-emerald-400">
            Ready to take control of your store?
          </p>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step Indicator */}
        <div className="flex items-center space-x-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? 'w-8 bg-emerald-500'
                  : i < step
                  ? 'w-3 bg-emerald-300 dark:bg-emerald-700'
                  : 'w-3 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Icon & Title */}
        <div className="mb-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
            {currentStep.icon}
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {currentStep.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentStep.subtitle}
          </p>
        </div>

        {/* Body Content */}
        <div className="min-h-[170px] mb-6">{currentStep.content}</div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
            >
              Skip tour
            </button>
          )}

          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer transition-all"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center space-x-1.5 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer transition-all"
            >
              <span>Start Using Karra</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
