import React, { useMemo, useState } from 'react';
import {
  X,
  TrendingUp,
  ShoppingBag,
  Calendar,
  DollarSign,
  ArrowLeft,
  ArrowUpRight,
  Package,
  Users,
  CreditCard,
  BarChart3,
  Clock,
  Sparkles,
} from 'lucide-react';
import { BusinessState, BusinessEvent } from '../types';
import { formatNaira } from '../engine/calculations';
import { formatDateShort, isToday, isYesterday, getTodayDateStr } from '../utils/dateUtils';
import { DailySalesTrendChart } from './DailySalesTrendChart';

interface DailySalesVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: BusinessState;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export const DailySalesVolumeModal: React.FC<DailySalesVolumeModalProps> = ({
  isOpen,
  onClose,
  state,
  selectedDate = getTodayDateStr(),
  onSelectDate,
}) => {
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(14);
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'volume'>('revenue');

  // Aggregated analytics for the selected time range
  const rangeAnalytics = useMemo(() => {
    const today = new Date();
    const days: {
      date: string;
      label: string;
      sales: number;
      units: number;
      profit: number;
      eventsCount: number;
      receivable: number;
    }[] = [];

    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const dayEvents = state.events.filter(
        (e) => e.date === dateStr && !e.isCorrected
      );
      const daySales = dayEvents
        .filter((e) => e.type === 'SALE')
        .reduce((sum, e) => sum + (e.totalRevenue || 0), 0);
      const dayUnits = dayEvents
        .filter((e) => e.type === 'SALE')
        .reduce((sum, e) => sum + (e.quantity || 0), 0);
      const dayProfit = dayEvents
        .filter((e) => e.type === 'SALE')
        .reduce((sum, e) => sum + (e.grossProfit || 0), 0);
      const dayReceivable = dayEvents.reduce(
        (sum, e) => sum + (e.receivableAdded || 0),
        0
      );

      let label = formatDateShort(dateStr);
      if (isToday(dateStr)) label = 'Today';
      else if (isYesterday(dateStr)) label = 'Yesterday';

      days.push({
        date: dateStr,
        label,
        sales: daySales,
        units: dayUnits,
        profit: dayProfit,
        eventsCount: dayEvents.length,
        receivable: dayReceivable,
      });
    }

    const totalSales = days.reduce((sum, d) => sum + d.sales, 0);
    const totalUnits = days.reduce((sum, d) => sum + d.units, 0);
    const totalProfit = days.reduce((sum, d) => sum + d.profit, 0);
    const totalReceivables = days.reduce((sum, d) => sum + d.receivable, 0);
    const totalTransactions = days.reduce((sum, d) => sum + d.eventsCount, 0);

    const avgDailySales = Math.round(totalSales / timeRange);
    const avgDailyUnits = Math.round((totalUnits / timeRange) * 10) / 10;
    const peakDay = [...days].sort((a, b) => b.sales - a.sales)[0];

    const profitMargin =
      totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

    return {
      days,
      totalSales,
      totalUnits,
      totalProfit,
      totalReceivables,
      totalTransactions,
      avgDailySales,
      avgDailyUnits,
      peakDay,
      profitMargin,
    };
  }, [state.events, timeRange]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0A131F] border border-slate-200 dark:border-[#1E3048] rounded-3xl shadow-2xl overflow-hidden my-4 text-slate-900 dark:text-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1E3048] flex items-center justify-between shrink-0 bg-slate-50/90 dark:bg-[#0D1B2A]/90">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#16273C] hover:bg-slate-200 dark:hover:bg-[#1E3550] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Daily Sales Volume Trend
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Key business volume analytics and financial performance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#16273C] hover:bg-slate-200 dark:hover:bg-[#1E3550] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Time Range & View Toggles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3048] p-3 rounded-2xl">
            {/* Period Selector */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Period:
              </span>
              {[
                { label: 'Last 7 Days', value: 7 },
                { label: 'Last 14 Days', value: 14 },
                { label: 'Last 30 Days', value: 30 },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setTimeRange(p.value as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    timeRange === p.value
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#142438] hover:bg-slate-100 dark:hover:bg-[#1B314B] border border-slate-200/60 dark:border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Metric Mode */}
            <div className="flex items-center space-x-1 bg-white dark:bg-[#142438] p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveMetric('revenue')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeMetric === 'revenue'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Revenue (₦)</span>
              </button>
              <button
                onClick={() => setActiveMetric('volume')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeMetric === 'volume'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Volume (Units)</span>
              </button>
            </div>
          </div>

          {/* Primary High-Level Summary Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3048] rounded-2xl p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Sales Revenue</span>
              <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatNaira(rangeAnalytics.totalSales)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                Across {timeRange} days
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3048] rounded-2xl p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Units Sold</span>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                {rangeAnalytics.totalUnits.toLocaleString()} items
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                Avg ~{rangeAnalytics.avgDailyUnits}/day
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3048] rounded-2xl p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gross Profit</span>
              <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {formatNaira(rangeAnalytics.totalProfit)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                {rangeAnalytics.profitMargin}% margin
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3048] rounded-2xl p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Outstanding Debts</span>
              <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {formatNaira(
                  state.customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0)
                )}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                From customer receivables
              </span>
            </div>
          </div>

          {/* Recharts Trend Chart Container */}
          <div className="bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3048] rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Daily {activeMetric === 'revenue' ? 'Sales Revenue' : 'Volume (Items)'} Curve
                </h3>
              </div>
              {rangeAnalytics.peakDay && rangeAnalytics.peakDay.sales > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  <span>
                    Peak:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {rangeAnalytics.peakDay.label} (
                      {formatNaira(rangeAnalytics.peakDay.sales)})
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <DailySalesTrendChart
              events={state.events}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                if (onSelectDate) onSelectDate(date);
              }}
            />
          </div>

          {/* Daily Table Breakdown */}
          <div className="bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3048] rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Day-by-Day Volume Breakdown</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#1E3048] text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Transactions</th>
                    <th className="py-2.5 px-3">Units Sold</th>
                    <th className="py-2.5 px-3">Revenue (₦)</th>
                    <th className="py-2.5 px-3">Gross Profit</th>
                    <th className="py-2.5 px-3">New Debt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1A2A3D]">
                  {rangeAnalytics.days.slice().reverse().map((day) => (
                    <tr
                      key={day.date}
                      className={`hover:bg-slate-100 dark:hover:bg-[#132438] transition-colors ${
                        day.date === selectedDate ? 'bg-slate-200/60 dark:bg-[#15273E] font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 flex items-center gap-2">
                        {day.label}
                        {day.date === getTodayDateStr() && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-bold">
                            Live
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{day.eventsCount}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {day.units > 0 ? `${day.units} items` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {day.sales > 0 ? formatNaira(day.sales) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400">
                        {day.profit > 0 ? formatNaira(day.profit) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                        {day.receivable > 0 ? formatNaira(day.receivable) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
