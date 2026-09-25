import React, { useState } from 'react';
import { Send, Sparkles, Mic, HelpCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { FollowUpQuestion } from '../types';

interface NaturalInputBarProps {
  onSendMessage: (text: string) => Promise<void>;
  pendingFollowUp: FollowUpQuestion | null;
  onCancelFollowUp: () => void;
  isProcessing: boolean;
}

export const NaturalInputBar: React.FC<NaturalInputBarProps> = ({
  onSendMessage,
  pendingFollowUp,
  onCancelFollowUp,
  isProcessing,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'SALES' | 'DEBT' | 'EXPENSE' | 'QUESTIONS'>('ALL');

  const samplePrompts = [
    { text: 'I sold 3 shirts for 6000.', category: 'SALES' },
    { text: 'David bought 5 shirts for 150k but paid 100k.', category: 'SALES' },
    { text: 'I sold 8 bowls of rice for 2k each.', category: 'SALES' },
    { text: 'I sold 3 products for 35k instead of 50k because of the promo.', category: 'SALES' },
    { text: 'Chuks is owing me 80k.', category: 'DEBT' },
    { text: 'Ada paid me 40k today.', category: 'DEBT' },
    { text: 'I spent 15k moving the goods.', category: 'EXPENSE' },
    { text: 'Paid my shop rent 300k.', category: 'EXPENSE' },
    { text: 'I took 50k from the business for myself.', category: 'EXPENSE' },
    { text: 'I bought 30 cartons from Musa at 12k each.', category: 'EXPENSE' },
    { text: 'How much did I make today?', category: 'QUESTIONS' },
    { text: 'Who owes me money?', category: 'QUESTIONS' },
  ];

  const displayedPrompts = samplePrompts.filter(
    (p) => filterCategory === 'ALL' || p.category === filterCategory
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text);
  };

  const handleSelectSample = (sample: string) => {
    setInputText(sample);
  };

  const handleVoiceToggle = () => {
    setIsListening((prev) => !prev);
    if (!isListening) {
      // Simulate authentic merchant speech capture
      setTimeout(() => {
        setIsListening(false);
        setInputText('I sold 4 shirts for 12,000 cash.');
      }, 2400);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-slate-950/40 p-3.5 sm:p-5 transition-all">
      {/* Follow-up Question Alert (When AI needs missing cost or clarification) */}
      {pendingFollowUp && (
        <div className="mb-3.5 p-3.5 sm:p-4 rounded-xl bg-amber-50/95 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-800 dark:text-amber-300 font-bold text-sm">
                ?
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Intelligent Follow-Up Needed
                </p>
                <p className="text-sm font-bold text-amber-950 dark:text-amber-100 mt-0.5 leading-snug">
                  {pendingFollowUp.prompt}
                </p>
                {pendingFollowUp.helperText && (
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                    {pendingFollowUp.helperText}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onCancelFollowUp}
              className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-200 underline shrink-0 font-medium py-1 px-1.5"
            >
              Skip
            </button>
          </div>

          {/* Quick answer chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-amber-200/70 dark:border-amber-800/60">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mr-1">Quick Answer:</span>
            {['₦1,500', '₦1,800', '₦2,000', '₦2,500'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onSendMessage(opt)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-700 shadow-2xs transition-colors min-h-[36px]"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              id="natural-language-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                pendingFollowUp
                  ? `Type your answer here (e.g. 1500)...`
                  : `Speak or type: "Sold 3 shirts for 6000", "Chuks owes 80k"...`
              }
              disabled={isProcessing}
              className="w-full pl-3.5 sm:pl-4 pr-11 py-3 sm:py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-[#172033] hover:bg-white dark:hover:bg-[#1C273D] focus:bg-white dark:focus:bg-[#1C273D] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 focus:border-transparent transition-all min-h-[48px]"
            />

            {/* Voice toggle button with mobile touch area */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              title={isListening ? 'Listening... tap to stop' : 'Tap to speak natural update'}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-xs'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          <button
            id="btn-submit-natural-input"
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="flex items-center justify-center px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-semibold text-sm hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all shrink-0 min-h-[48px] min-w-[52px]"
          >
            {isProcessing ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="flex items-center space-x-1.5">
                <span className="hidden sm:inline">Record</span>
                <Send className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>

        {isListening && (
          <div className="mt-2.5 p-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping inline-block shrink-0" />
            <span>Listening to voice... (Speaking English / Nigerian pidgin)</span>
          </div>
        )}
      </form>

      {/* Filterable suggestion chips optimized for mobile swipe */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1.5 xs:gap-2 mb-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Try natural business phrases:</span>
          </div>

          {/* Category tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px] self-start xs:self-auto">
            {(['ALL', 'SALES', 'DEBT', 'EXPENSE'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Swipeable Horizontal list on mobile / wrap on desktop */}
        <div className="flex md:flex-wrap items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none touch-pan-x -mx-1 px-1 sm:mx-0 sm:px-0">
          {displayedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSample(prompt.text)}
              className="text-left text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100/90 dark:bg-[#172033] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-slate-800 whitespace-nowrap transition-colors shrink-0 max-w-[280px] sm:max-w-none truncate cursor-pointer active:scale-95"
            >
              {prompt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
