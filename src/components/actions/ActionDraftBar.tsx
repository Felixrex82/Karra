import React, { useState } from 'react';
import { Briefcase, CreditCard, Package, User, ChevronUp, Trash2, AlertTriangle } from 'lucide-react';

export type ActionType = 'sale' | 'expense' | 'stock' | 'customer';

interface ActionDraftBarProps {
  actionType: ActionType;
  draftSummary: string;
  onReopen: () => void;
  onDiscard: () => void;
}

export const ActionDraftBar: React.FC<ActionDraftBarProps> = ({
  actionType,
  draftSummary,
  onReopen,
  onDiscard,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const getActionConfig = () => {
    switch (actionType) {
      case 'sale':
        return {
          title: 'Record Sale · Draft',
          color: 'bg-emerald-500',
          textColor: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
          icon: Briefcase,
        };
      case 'expense':
        return {
          title: 'Record Expense · Draft',
          color: 'bg-blue-500',
          textColor: 'text-blue-400',
          borderColor: 'border-blue-500/30',
          icon: CreditCard,
        };
      case 'stock':
        return {
          title: 'Add Stock · Draft',
          color: 'bg-purple-500',
          textColor: 'text-purple-400',
          borderColor: 'border-purple-500/30',
          icon: Package,
        };
      case 'customer':
        return {
          title: 'Add Customer · Draft',
          color: 'bg-amber-500',
          textColor: 'text-amber-400',
          borderColor: 'border-amber-500/30',
          icon: User,
        };
    }
  };

  const config = getActionConfig();
  const Icon = config.icon;

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom-5 duration-300">
        <div
          onClick={onReopen}
          className="bg-white/95 dark:bg-[#0E1A29]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#1E3048] hover:border-emerald-500/50 rounded-2xl p-3 sm:p-3.5 shadow-xl flex items-center justify-between cursor-pointer group transition-all"
        >
          <div className="flex items-center space-x-3 min-w-0 pr-2">
            <div className={`w-9 h-9 rounded-xl ${config.color} text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {config.title}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {draftSummary || 'Tap to continue editing'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onReopen}
              title="Resume draft"
              className="py-1 px-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
            >
              <span>Resume</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              title="Discard draft"
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Discard confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Discard {config.title.replace(' · Draft', '')}?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Your unfinished draft will be removed permanently. Are you sure?
            </p>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
              >
                Keep Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onDiscard();
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer text-center shadow-md active:scale-95"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
