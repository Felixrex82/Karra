import React from 'react';
import { CalculationExplanation, BusinessEvent } from '../types';
import { formatNaira } from '../engine/calculations';
import { X, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface ExplainCalculationModalProps {
  explanation: CalculationExplanation | null;
  onClose: () => void;
  onSelectEvent?: (event: BusinessEvent) => void;
}

export const ExplainCalculationModal: React.FC<ExplainCalculationModalProps> = ({
  explanation,
  onClose,
  onSelectEvent,
}) => {
  if (!explanation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full sm:max-w-xl bg-white dark:bg-[#111726] rounded-t-3xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 dark:bg-[#0d1322] text-white flex items-center justify-between shrink-0 border-b dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold leading-snug">
                Transparent Arithmetic Breakdown
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                100% Deterministic • Never hallucinated by AI
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

        {/* Content Body (Scrollable) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {/* Explanation Title & Result */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#141b2d] border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {explanation.title}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatNaira(explanation.totalValue)}
              </span>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 rounded">
                {explanation.targetMetric}
              </span>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400">
              Formula: {explanation.formula}
            </div>

            {explanation.isEstimate && (
              <div className="mt-2.5 flex items-start space-x-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/80">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Estimated: </strong>
                  {explanation.estimateReason || 'Includes derived yield units (e.g. bowls per bag).'}
                </span>
              </div>
            )}
          </div>

          {/* Mathematical Step-by-Step Table */}
          <div>
            <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Step-by-Step Accounting
            </h4>
            <div className="space-y-1.5 sm:space-y-2">
              {explanation.breakdownRows.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#141b2d] hover:bg-slate-50 dark:hover:bg-[#192238] transition-colors"
                >
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {row.label}
                    </div>
                    {row.note && (
                      <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">{row.note}</div>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-right font-mono">
                    <span
                      className={
                        row.isDeduction
                          ? 'text-red-600 dark:text-red-400'
                          : row.amount > 0
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {row.isDeduction ? `−${formatNaira(row.amount)}` : formatNaira(row.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contributing Transactions */}
          {explanation.contributingEvents.length > 0 && (
            <div>
              <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
                <span>Contributing Raw Business Events ({explanation.contributingEvents.length})</span>
                <span className="text-[10px] sm:text-[11px] font-normal text-slate-400">Ledger records</span>
              </h4>

              <div className="space-y-1.5 sm:space-y-2">
                {explanation.contributingEvents.map((ev, idx) => (
                  <div
                    key={ev.id ? `${ev.id}-${idx}` : `exp-ev-${idx}`}
                    onClick={() => {
                      onSelectEvent?.(ev);
                      onClose();
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141b2d] hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-pointer text-xs group"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-slate-900 dark:group-hover:bg-white" />
                        <span>{ev.timeStr} • {ev.type}</span>
                        {ev.customerName && (
                          <span className="text-slate-500 dark:text-slate-400 font-normal">({ev.customerName})</span>
                        )}
                      </span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {ev.type === 'SALE'
                          ? formatNaira(ev.totalRevenue || 0)
                          : ev.type === 'EXPENSE'
                          ? `−${formatNaira(ev.expenseAmount || 0)}`
                          : formatNaira(ev.cashReceived || ev.totalRevenue || 0)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1 italic">
                      "{ev.rawUserText}"
                    </p>
                    {ev.grossProfit !== undefined && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                        Gross profit: {formatNaira(ev.grossProfit)} (Cost locked: {formatNaira(ev.totalCostAtTime || 0)})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-[#0d1322] border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors min-h-[42px]"
          >
            Got it, close
          </button>
        </div>
      </div>
    </div>
  );
};
