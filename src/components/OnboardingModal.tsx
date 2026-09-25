import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { KarraLogo } from './KarraLogo';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeachInitialBusiness: (text: string) => Promise<void>;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onTeachInitialBusiness,
}) => {
  const [introText, setIntroText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickExample = (example: string) => {
    setIntroText(example);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!introText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onTeachInitialBusiness(introText);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#111726] rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 dark:bg-[#0d1322] text-white flex items-center justify-between shrink-0 border-b dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <KarraLogo size="sm" variant="green-bg" />
            <div>
              <h3 className="text-sm sm:text-base font-bold leading-snug">
                Welcome to Karra
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                The operating system that learns how your business works
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#141b2d] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed">
            <p className="font-semibold text-slate-900 dark:text-white mb-1">
              "Tell me a little about your business. What do you sell? How do you normally sell it?"
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              No forms, no accounting codes. Just talk like you're texting a smart business partner.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              rows={3}
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              placeholder="e.g. I run a boutique and food provision shop. I sell shirts for ₦6,000 that cost ₦1,500 each. I also sell bags of rice and sell in bowls for ₦2,000 each..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141b2d] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 resize-none min-h-[90px]"
            />

            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                Quick examples to try:
              </span>
              <div className="flex flex-col gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickExample(
                      'I sell quality unisex shirts for ₦6,000 which cost me ₦1,500 each. I also sell bags of rice and sell them in bowls for ₦2,000 each.'
                    )
                  }
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-left text-slate-700 dark:text-slate-300 transition-colors"
                >
                  👕 Clothing & Rice store merchant
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickExample(
                      'I run a provision store selling cold drinks, biscuits, and soap. One carton of drinks costs ₦12,000 from Musa and has 24 bottles.'
                    )
                  }
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-left text-slate-700 dark:text-slate-300 transition-colors"
                >
                  🥤 Cold drinks & Provisions merchant
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white py-2 sm:py-0 text-center"
              >
                Skip, I'll record as I go
              </button>
              <button
                type="submit"
                disabled={!introText.trim() || isSubmitting}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-40 transition-all min-h-[42px]"
              >
                <span>Save Business Facts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
