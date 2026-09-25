import React, { useState } from 'react';
import { BusinessEvent, DailySummary } from '../types';
import { calculateDailySummary, formatNaira, formatSignedNaira } from '../engine/calculations';
import { isToday, isYesterday, getTodayDateStr } from '../utils/dateUtils';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Info,
  Download,
  FileText,
  Share2,
  Sparkles,
} from 'lucide-react';
import { MonthlyCardModal } from './MonthlyCardModal';
import { MonthlyCardExportData, exportMonthlyCardToPNG, exportMonthlyCardToPDF } from '../utils/cardGenerators';
import { ensureEventHeadlineAndSummary } from '../engine/eventSummarizer';

interface BusinessCalendarProps {
  events: BusinessEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onExplainDate: (date: string) => void;
  businessName?: string;
  onShowToast?: (message: string, type?: 'info' | 'success') => void;
}

export const BusinessCalendar: React.FC<BusinessCalendarProps> = ({
  events,
  selectedDate,
  onSelectDate,
  onExplainDate,
  businessName = 'Karra Store',
  onShowToast,
}) => {
  // Calendar viewed month: default to September 2026
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(8); // 8 = September (0-indexed)
  const [isMonthlyCardModalOpen, setIsMonthlyCardModalOpen] = useState(false);
  const [isQuickDownloading, setIsQuickDownloading] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Generate days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  const daysArray: (string | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    daysArray.push(`${currentYear}-${mm}-${dd}`);
  }

  // Precalculate summaries for this month
  const monthSummaries: Record<string, DailySummary> = {};
  let totalMonthSales = 0;
  let totalMonthProfit = 0;
  let totalMonthCOGS = 0;
  let totalMonthExpenses = 0;
  let totalMonthCash = 0;
  let totalMonthCredit = 0;
  let totalTransactions = 0;
  let totalItemsSold = 0;
  let profitableDaysCount = 0;
  let lossDaysCount = 0;
  let breakevenDaysCount = 0;
  let bestDay: { date: string; profit: number } = { date: '', profit: -Infinity };

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${currentYear}-${mm}-${dd}`;
    const sum = calculateDailySummary(events, dateStr);
    monthSummaries[dateStr] = sum;

    if (sum.eventsCount > 0) {
      totalMonthSales += sum.sales;
      totalMonthProfit += sum.netOperatingResult;
      totalMonthCOGS += sum.costOfGoods;
      totalMonthExpenses += sum.expenses;
      totalMonthCash += sum.cashReceived;
      totalMonthCredit += sum.outstandingReceivables;
      totalTransactions += sum.eventsCount;
      totalItemsSold += sum.itemsSoldCount;

      if (sum.status === 'PROFIT') {
        profitableDaysCount++;
        if (sum.netOperatingResult > bestDay.profit) {
          bestDay = { date: dateStr, profit: sum.netOperatingResult };
        }
      } else if (sum.status === 'LOSS') {
        lossDaysCount++;
      } else {
        breakevenDaysCount++;
      }
    }
  }

  const netMarginPercent = totalMonthSales > 0 ? (totalMonthProfit / totalMonthSales) * 100 : 0;

  const monthCardData: MonthlyCardExportData = {
    year: currentYear,
    month: currentMonth,
    monthName: monthNames[currentMonth],
    totalSales: totalMonthSales,
    totalCostOfGoods: totalMonthCOGS,
    totalExpenses: totalMonthExpenses,
    netProfit: totalMonthProfit,
    netMarginPercent,
    cashReceived: totalMonthCash,
    creditGiven: totalMonthCredit,
    profitableDaysCount,
    lossDaysCount,
    breakevenDaysCount,
    bestDay,
    totalTransactions,
    totalItemsSold,
    monthSummaries,
    daysInMonth,
  };

  const selectedDaySummary = monthSummaries[selectedDate] || calculateDailySummary(events, selectedDate);

  const formatMobileCompact = (amount: number): string => {
    if (Math.abs(amount) >= 1000000) {
      return (amount / 1000000).toFixed(1) + 'M';
    }
    if (Math.abs(amount) >= 1000) {
      const k = Math.round(amount / 1000);
      return (k > 0 ? `+${k}k` : `${k}k`);
    }
    return (amount > 0 ? `+${amount}` : `${amount}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Month Overview Banner */}
      <div className="bg-slate-900 dark:bg-[#111726] text-white rounded-2xl border border-slate-800 dark:border-slate-800 p-4 sm:p-6 shadow-xs dark:shadow-slate-950/40 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800 dark:border-slate-800/80">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 dark:bg-slate-800/80 text-emerald-400 flex items-center justify-center font-bold shrink-0 border border-slate-700/60 dark:border-slate-700/50">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-400">
                Blue = Profit, Red = Loss, Neutral = Break-even
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center border border-slate-700/40 cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const today = getTodayDateStr();
                  const parts = today.split('-');
                  setCurrentYear(parseInt(parts[0], 10));
                  setCurrentMonth(parseInt(parts[1], 10) - 1);
                  onSelectDate(today);
                }}
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors min-h-[38px] border border-slate-700/40 cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center border border-slate-700/40 cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              id="btn-download-monthly-card"
              type="button"
              onClick={() => setIsMonthlyCardModalOpen(true)}
              className="px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer min-h-[38px]"
              title="Download or share monthly card as PNG image or PDF"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap hidden sm:inline">Download Monthly Card</span>
              <span className="whitespace-nowrap sm:hidden">Monthly Card</span>
            </button>
          </div>
        </div>

        {/* Month High-Level Metrics (2x2 grid on mobile) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 pt-3 sm:pt-4">
          <div className="p-2 sm:p-0 rounded-lg bg-slate-800/40 dark:bg-slate-800/30 sm:bg-transparent">
            <span className="text-[11px] sm:text-xs text-slate-400 block font-medium">Month Sales</span>
            <span className="text-base sm:text-xl font-bold text-white mt-0.5 block truncate font-mono">
              {formatNaira(totalMonthSales)}
            </span>
          </div>
          <div className="p-2 sm:p-0 rounded-lg bg-slate-800/40 dark:bg-slate-800/30 sm:bg-transparent">
            <span className="text-[11px] sm:text-xs text-slate-400 block font-medium">Net Profit</span>
            <span
              className={`text-base sm:text-xl font-bold mt-0.5 block truncate font-mono ${
                totalMonthProfit >= 0 ? 'text-blue-400 dark:text-blue-300' : 'text-red-400 dark:text-red-300'
              }`}
            >
              {formatSignedNaira(totalMonthProfit)}
            </span>
          </div>
          <div className="p-2 sm:p-0 rounded-lg bg-slate-800/40 dark:bg-slate-800/30 sm:bg-transparent">
            <span className="text-[11px] sm:text-xs text-slate-400 block font-medium">Profitable Days</span>
            <span className="text-base sm:text-xl font-bold text-emerald-400 dark:text-emerald-300 mt-0.5 block">
              {profitableDaysCount} days
            </span>
          </div>
          <div className="p-2 sm:p-0 rounded-lg bg-slate-800/40 dark:bg-slate-800/30 sm:bg-transparent">
            <span className="text-[11px] sm:text-xs text-slate-400 block font-medium">Best Day</span>
            <span className="text-xs sm:text-base font-bold text-slate-200 mt-0.5 block truncate">
              {bestDay.date ? `${bestDay.date.slice(-2)}th (+${formatNaira(bestDay.profit, true)})` : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-slate-950/40 p-3 sm:p-6 transition-colors">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1.5 sm:mb-2 text-center text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {daysArray.map((dateStr, idx) => {
            if (!dateStr) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="h-14 sm:h-24 rounded-lg sm:rounded-xl bg-slate-50/40 dark:bg-slate-900/30 border border-transparent"
                />
              );
            }

            const dayNum = parseInt(dateStr.slice(8), 10);
            const summary = monthSummaries[dateStr];
            const isSelected = selectedDate === dateStr;
            const isCurrentDay = isToday(dateStr);

            // Distinctive colors per prompt specification:
            // BLUE = profitable day
            // RED = loss day
            // WHITE/NEUTRAL = break-even or no activity
            let cellStyle = 'bg-white dark:bg-[#151D2C] border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600';
            let badgeStyle = 'text-slate-400 dark:text-slate-500';

            if (summary && summary.eventsCount > 0) {
              if (summary.status === 'PROFIT') {
                cellStyle = 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/70 text-blue-900 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50';
                badgeStyle = 'bg-blue-600 dark:bg-blue-500 text-white font-bold';
              } else if (summary.status === 'LOSS') {
                cellStyle = 'bg-red-50/90 dark:bg-red-950/40 border-red-200 dark:border-red-800/70 text-red-900 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50';
                badgeStyle = 'bg-red-600 dark:bg-red-500 text-white font-bold';
              } else {
                cellStyle = 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
                badgeStyle = 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold';
              }
            }

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(dateStr)}
                className={`h-[58px] sm:h-24 p-1 sm:p-2 rounded-lg sm:rounded-xl border flex flex-col justify-between text-left transition-all relative active:scale-95 touch-manipulation ${cellStyle} ${
                  isSelected ? 'ring-2 ring-slate-900 dark:ring-emerald-400 ring-offset-1 sm:ring-offset-2 dark:ring-offset-[#111726] z-10 shadow-xs' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-[11px] sm:text-xs font-bold leading-none ${
                      isCurrentDay
                        ? 'w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-900 dark:bg-emerald-500 text-white flex items-center justify-center text-[10px] sm:text-xs'
                        : ''
                    }`}
                  >
                    {dayNum}
                  </span>
                  {summary && summary.hasEstimates && (
                    <span className="hidden sm:inline text-[9px] font-semibold text-amber-700 dark:text-amber-400" title="Contains estimated yield">
                      ~est
                    </span>
                  )}
                </div>

                {summary && summary.eventsCount > 0 ? (
                  <div className="mt-auto w-full">
                    {/* Compact pill on mobile */}
                    <span
                      className={`block sm:inline-block px-0.5 sm:px-1 py-0.5 rounded text-[8.5px] xs:text-[9px] sm:text-xs text-center sm:text-left truncate tracking-tight ${badgeStyle}`}
                    >
                      <span className="sm:hidden">{formatMobileCompact(summary.netOperatingResult)}</span>
                      <span className="hidden sm:inline">{formatSignedNaira(summary.netOperatingResult)}</span>
                    </span>
                    <span className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      {summary.eventsCount} {summary.eventsCount === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                ) : (
                  <div className="mt-auto hidden sm:block">
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">₦0</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector Box */}
      {selectedDaySummary && (
        <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-slate-950/40 p-4 sm:p-5 animate-in fade-in duration-200 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {isToday(selectedDate)
                    ? `Today (${selectedDaySummary.formattedDate})`
                    : isYesterday(selectedDate)
                    ? `Yesterday (${selectedDaySummary.formattedDate})`
                    : selectedDaySummary.formattedDate}
                </h3>
                {selectedDaySummary.status === 'PROFIT' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    +Profitable
                  </span>
                )}
                {selectedDaySummary.status === 'LOSS' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60">
                    -Operating Loss
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                "{selectedDaySummary.plainSummary}"
              </p>
            </div>

            <button
              onClick={() => onExplainDate(selectedDate)}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors w-full sm:w-auto min-h-[40px]"
            >
              <span>Explain Numbers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 block">Sales</span>
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatNaira(selectedDaySummary.sales)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 block">Cost of Goods</span>
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatNaira(selectedDaySummary.costOfGoods)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 block">Expenses</span>
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatNaira(selectedDaySummary.expenses)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 block">Day Result</span>
              <span
                className={`text-sm sm:text-base font-bold font-mono ${
                  selectedDaySummary.netOperatingResult >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatSignedNaira(selectedDaySummary.netOperatingResult)}
              </span>
            </div>
          </div>

          {/* Transactions Logged on Selected Date with AI Headlines & Summaries */}
          {(() => {
            const dayEvents = events.filter((e) => e.date === selectedDate && !e.isCorrected);
            if (dayEvents.length === 0) return null;
            return (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Recorded Transactions ({dayEvents.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map((ev, idx) => {
                    const displayEv = ensureEventHeadlineAndSummary(ev);
                    return (
                      <div
                        key={ev.id ? `${ev.id}-${idx}` : `cal-ev-${selectedDate}-${idx}`}
                        className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#151D2C] border border-slate-200/70 dark:border-slate-800/80 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-bold text-slate-900 dark:text-white truncate text-xs">
                              {displayEv.headline}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-xs shrink-0">
                            {ev.type === 'SALE' && (
                              <span className="text-emerald-700 dark:text-emerald-400">+{formatNaira(ev.totalRevenue || 0)}</span>
                            )}
                            {ev.type === 'EXPENSE' && (
                              <span className="text-red-600 dark:text-red-400">−{formatNaira(ev.expenseAmount || 0)}</span>
                            )}
                            {ev.type === 'CUSTOMER_DEBT' && (
                              <span className="text-amber-700 dark:text-amber-400">Owed: {formatNaira(ev.receivableAdded || ev.totalRevenue || 0)}</span>
                            )}
                            {ev.type === 'DEBT_PAYMENT' && (
                              <span className="text-emerald-700 dark:text-emerald-400">Paid: {formatNaira(ev.cashReceived || ev.totalRevenue || 0)}</span>
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                          {displayEv.summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Monthly Performance Card Download & Share Modal */}
      <MonthlyCardModal
        isOpen={isMonthlyCardModalOpen}
        onClose={() => setIsMonthlyCardModalOpen(false)}
        data={monthCardData}
        businessName={businessName}
        onShowToast={onShowToast}
      />
    </div>
  );
};
