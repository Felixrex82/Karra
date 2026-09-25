import React from 'react';
import { BusinessPulseItem } from '../types';
import { TrendingUp, AlertTriangle, Lightbulb, DollarSign, CheckCircle2, ChevronRight } from 'lucide-react';

interface BusinessPulseCardProps {
  insights: BusinessPulseItem[];
  onSelectInsightAction?: (actionKey: string, item?: BusinessPulseItem) => void;
}

export const BusinessPulseCard: React.FC<BusinessPulseCardProps> = ({
  insights,
  onSelectInsightAction,
}) => {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'POSITIVE':
        return <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'OPPORTUNITY':
        return <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'NEUTRAL':
      default:
        return <DollarSign className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getCardBg = (type: string) => {
    switch (type) {
      case 'POSITIVE':
        return 'border-emerald-200/90 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-[#151D2C] hover:border-emerald-300 dark:hover:border-emerald-700';
      case 'WARNING':
        return 'border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/30 dark:to-[#151D2C] hover:border-amber-300 dark:hover:border-amber-700';
      case 'OPPORTUNITY':
        return 'border-blue-200/90 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-[#151D2C] hover:border-blue-300 dark:hover:border-blue-700';
      default:
        return 'border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151D2C] hover:border-slate-300 dark:hover:border-slate-700';
    }
  };

  return (
    <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-slate-950/40 p-4 sm:p-6 transition-all">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-3 sm:mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Business Pulse & Observant Insights
          </h3>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden xs:inline sm:inline">
          Continuous Pattern Analysis
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((item, idx) => (
          <div
            key={item.id ? `${item.id}-${idx}` : `pulse-${idx}`}
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between shadow-2xs ${getCardBg(
              item.type
            )}`}
          >
            <div>
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs shrink-0">
                  {getInsightIcon(item.type)}
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {item.title}
                </h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                {item.message}
              </p>
            </div>

            {item.actionable && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Recommendation
                </span>
                <button
                  id={`btn-act-${item.id}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectInsightAction?.(item.id, item);
                  }}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-900 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer min-h-[32px]"
                  title={item.actionLabel || `Act on: ${item.title}`}
                >
                  <span>{item.actionLabel || 'Act'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
