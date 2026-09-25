import React, { useState } from 'react';
import { DailySummary, BusinessEvent } from '../types';
import { formatNaira } from '../engine/calculations';
import { getTodayDateStr, getYesterdayDateStr, isToday, isYesterday, formatDateShort } from '../utils/dateUtils';
import { HelpCircle, TrendingUp, TrendingDown, Minus, Info, Volume2, VolumeX, Sparkles, FileText, Calendar, LineChart as ChartLineIcon, LayoutGrid } from 'lucide-react';
import { DailySalesTrendChart } from './DailySalesTrendChart';

interface DailySummaryCardProps {
  summary: DailySummary;
  events?: BusinessEvent[];
  onExplainCalculation: () => void;
  onOpenReports?: () => void;
  onSelectDate?: (date: string) => void;
  selectedDate: string;
}

export const DailySummaryCard: React.FC<DailySummaryCardProps> = ({
  summary,
  events = [],
  onExplainCalculation,
  onOpenReports,
  onSelectDate,
  selectedDate,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [viewMode, setViewMode] = useState<'augmented' | 'trend' | 'numerical'>('augmented');
  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr();
  const isCurrentDay = isToday(selectedDate);
  const isPrevDay = isYesterday(selectedDate);

  const handleToggleAudio = () => {
    if ('speechSynthesis' in window) {
      if (isPlayingAudio) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(summary.plainSummary);
        utterance.rate = 0.95;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
        setIsPlayingAudio(true);
      }
    } else {
      setIsPlayingAudio(!isPlayingAudio);
    }
  };

  const statusBadge = () => {
    if (summary.status === 'PROFIT') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70 shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Profitable Day</span>
        </span>
      );
    }
    if (summary.status === 'LOSS') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70 shrink-0">
          <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          <span>Operating Loss Day</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
        <Minus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        <span>Neutral / Break-Even</span>
      </span>
    );
  };

  return (
    <div className="w-full bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-slate-950/40 p-4 sm:p-6 transition-all">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {isCurrentDay ? 'Today' : isPrevDay ? 'Yesterday' : summary.formattedDate}
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">({summary.date})</span>
            {statusBadge()}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic business calculation engine
          </p>
        </div>

        {/* Quick Date Switcher & Action buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onSelectDate && (
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 mr-1">
              <button
                type="button"
                onClick={() => onSelectDate(todayStr)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isCurrentDay
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Today ({formatDateShort(todayStr)})
              </button>
              <button
                type="button"
                onClick={() => onSelectDate(yesterdayStr)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isPrevDay
                    ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Yesterday ({formatDateShort(yesterdayStr)})
              </button>
            </div>
          )}

          <button
            id="btn-explain-daily-calculation"
            onClick={onExplainCalculation}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors min-h-[40px] cursor-pointer active:scale-95"
          >
            <HelpCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span className="truncate">How did you calculate this?</span>
          </button>

          {onOpenReports && (
            <button
              id="btn-daily-open-reports"
              onClick={onOpenReports}
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-300/80 dark:border-slate-700 shadow-2xs transition-colors min-h-[40px] cursor-pointer active:scale-95"
            >
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Download Reports</span>
            </button>
          )}
        </div>
      </div>

      {/* Viewing Yesterday banner notice if not viewing today */}
      {isPrevDay && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              You are viewing <strong>Yesterday's ({summary.date})</strong> figures. Today is <strong>{todayStr}</strong>.
            </span>
          </div>
          {onSelectDate && (
            <button
              type="button"
              onClick={() => onSelectDate(todayStr)}
              className="font-bold underline hover:no-underline text-amber-950 dark:text-amber-100 cursor-pointer"
            >
              Switch to Today ({todayStr}) →
            </button>
          )}
        </div>
      )}

      {/* Main Metric Spotlight: Estimated Net Result */}
      <div className="my-4 sm:my-5 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-slate-50 via-slate-50 to-emerald-50/40 dark:from-[#151D2C] dark:via-[#162032] dark:to-emerald-950/20 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-colors">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Estimated Take-Home / Net Result
            </span>
            {summary.hasEstimates ? (
              <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 shrink-0">
                <Info className="w-3 h-3" />
                <span>ESTIMATED</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shrink-0">
                <span>CONFIRMED</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1">
            <span
              className={`text-2xl xs:text-3xl sm:text-4xl font-extrabold tracking-tight font-mono ${
                summary.netOperatingResult >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatNaira(summary.netOperatingResult)}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              (Sales − COGS − Expenses)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-start space-x-6 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-3 sm:pt-0 sm:pl-6 shrink-0">
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 block uppercase">
              Items Sold
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              {summary.itemsSoldCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 block uppercase">
              Events Logged
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              {summary.eventsCount}
            </span>
          </div>
        </div>
      </div>

      {/* View Mode Selector: Augmenting (Both) vs Replacing (Trend Line Only) vs Numbers Only */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-4 mb-3 pt-2">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Sales & Ledger Analysis
          </span>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/90 p-0.5 border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto">
          <button
            type="button"
            id="btn-view-mode-augmented"
            onClick={() => setViewMode('augmented')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'augmented'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Trend + Numbers</span>
          </button>
          <button
            type="button"
            id="btn-view-mode-trend"
            onClick={() => setViewMode('trend')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'trend'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ChartLineIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Trend Line</span>
          </button>
          <button
            type="button"
            id="btn-view-mode-numerical"
            onClick={() => setViewMode('numerical')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'numerical'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>Numbers Only</span>
          </button>
        </div>
      </div>

      {/* Numerical Summary Grid (Shown in 'augmented' and 'numerical' modes) */}
      {(viewMode === 'augmented' || viewMode === 'numerical') && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {/* Total Sales Revenue */}
          <div className="p-3 sm:p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-950/30 dark:to-[#151D2C] transition-colors shadow-2xs">
            <span className="text-[10px] sm:text-xs font-semibold text-indigo-800 dark:text-indigo-300 block truncate">
              Total Sales
            </span>
            <span className="text-base xs:text-lg sm:text-xl font-bold text-indigo-950 dark:text-indigo-100 mt-0.5 sm:mt-1 block truncate font-mono">
              {formatNaira(summary.sales)}
            </span>
            <span className="text-[9.5px] sm:text-[11px] text-indigo-600/80 dark:text-indigo-400/80 font-medium block truncate">
              Goods delivered
            </span>
          </div>

          {/* Cash Received */}
          <div className="p-3 sm:p-4 rounded-xl border border-emerald-300/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/35 dark:to-[#151D2C] transition-colors shadow-2xs">
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-300 block truncate">
              Cash Received
            </span>
            <span className="text-base xs:text-lg sm:text-xl font-bold text-emerald-950 dark:text-emerald-100 mt-0.5 sm:mt-1 block truncate font-mono">
              {formatNaira(summary.cashReceived)}
            </span>
            <span className="text-[9.5px] sm:text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium block truncate">
              In hand / bank
            </span>
          </div>

          {/* Customer Debt */}
          <div className="p-3 sm:p-4 rounded-xl border border-amber-300/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/35 dark:to-[#151D2C] transition-colors shadow-2xs">
            <span className="text-[10px] sm:text-xs font-semibold text-amber-800 dark:text-amber-300 block truncate">
              Customer Debt
            </span>
            <span className="text-base xs:text-lg sm:text-xl font-bold text-amber-950 dark:text-amber-100 mt-0.5 sm:mt-1 block truncate font-mono">
              {formatNaira(summary.outstandingReceivables)}
            </span>
            <span className="text-[9.5px] sm:text-[11px] text-amber-700/80 dark:text-amber-400/80 font-medium block truncate">
              Unpaid today
            </span>
          </div>

          {/* Operating Expenses */}
          <div className="p-3 sm:p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-gradient-to-br from-rose-50/70 to-white dark:from-rose-950/30 dark:to-[#151D2C] transition-colors shadow-2xs">
            <span className="text-[10px] sm:text-xs font-semibold text-rose-800 dark:text-rose-300 block truncate">
              Expenses
            </span>
            <span className="text-base xs:text-lg sm:text-xl font-bold text-rose-950 dark:text-rose-100 mt-0.5 sm:mt-1 block truncate font-mono">
              {formatNaira(summary.expenses)}
            </span>
            <span className="text-[9.5px] sm:text-[11px] text-rose-600/80 dark:text-rose-400/80 font-medium block truncate">
              Shop costs & moving
            </span>
          </div>
        </div>
      )}

      {/* Visual Trend Line of Daily Sales Volume (Recharts) - augmenting or replacing */}
      {(viewMode === 'augmented' || viewMode === 'trend') && (
        <div className={viewMode === 'augmented' ? 'mt-3.5' : ''}>
          <DailySalesTrendChart
            events={events}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        </div>
      )}

      {/* Plain-Language Human Audio / Text Summary Box */}
      <div className="mt-3.5 sm:mt-4 p-3.5 sm:p-4 rounded-xl bg-slate-900 dark:bg-[#0D131F] text-white shadow-xs border border-slate-800 dark:border-slate-800/90 transition-colors">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 dark:text-slate-400">
              Plain Human Explanation
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleAudio}
            className="flex items-center space-x-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 dark:bg-slate-800/80 hover:bg-slate-700 dark:hover:bg-slate-700 px-2 py-1 rounded-lg transition-colors"
            title="Read summary aloud"
          >
            {isPlayingAudio ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-emerald-400" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                <span>Listen</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-100 dark:text-slate-200 leading-relaxed">
          "{summary.plainSummary}"
        </p>
      </div>
    </div>
  );
};
