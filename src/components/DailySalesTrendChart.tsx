import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { BusinessEvent } from '../types';
import { formatNaira } from '../engine/calculations';
import {
  formatDateShort,
  isToday,
  isYesterday,
  getTodayDateStr,
} from '../utils/dateUtils';
import { TrendingUp, Calendar, ShoppingBag, BarChart3 } from 'lucide-react';

interface DailySalesTrendChartProps {
  events: BusinessEvent[];
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  className?: string;
}

type MetricType = 'revenue' | 'volume';
type TimeRange = 7 | 14 | 30;

// Custom horizontal cursor that connects the active date with the chart
const HorizontalDateChartCursor = (props: any) => {
  const { points, width, height, stroke = '#94a3b8' } = props;
  if (!points || points.length === 0) return null;
  const x = points[0].x;
  const y = points[0].y;

  return (
    <g pointerEvents="none">
      {/* Horizontal cursor connecting value across chart */}
      <line
        x1={35}
        y1={y}
        x2={(width || 600) - 10}
        y2={y}
        stroke={stroke}
        strokeWidth={1.0}
        strokeDasharray="4 4"
        strokeOpacity={0.65}
      />
      {/* Connecting cursor line with the date on the axis */}
      <line
        x1={x}
        y1={10}
        x2={x}
        y2={(height || 220) + 10}
        stroke={stroke}
        strokeWidth={1.0}
        strokeDasharray="3 3"
        strokeOpacity={0.5}
      />
    </g>
  );
};

export const DailySalesTrendChart: React.FC<DailySalesTrendChartProps> = ({
  events,
  selectedDate,
  onSelectDate,
  className = '',
}) => {
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [timeRange, setTimeRange] = useState<TimeRange>(7);

  // Generate date series for the selected time range ending today (or selected date)
  const chartData = useMemo(() => {
    const today = new Date();
    const result = [];

    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Aggregate all active sales events for this date
      const dayEvents = events.filter(
        (ev) => ev.date === dateStr && !ev.isCorrected && ev.type === 'SALE'
      );

      const daySales = dayEvents.reduce((acc, ev) => acc + (ev.totalRevenue || 0), 0);
      const dayItems = dayEvents.reduce((acc, ev) => acc + (ev.quantity || 0), 0);
      const dayProfit = dayEvents.reduce((acc, ev) => acc + (ev.grossProfit || 0), 0);

      let shortLabel = formatDateShort(dateStr);
      if (isToday(dateStr)) {
        shortLabel = 'Today';
      } else if (isYesterday(dateStr)) {
        shortLabel = 'Yest';
      }

      result.push({
        date: dateStr,
        label: shortLabel,
        sales: daySales,
        itemsSold: dayItems,
        profit: dayProfit,
        transactionsCount: dayEvents.length,
        isSelected: dateStr === selectedDate,
      });
    }

    return result;
  }, [events, timeRange, selectedDate]);

  // Derived statistics for the period
  const stats = useMemo(() => {
    const totalSales = chartData.reduce((sum, item) => sum + item.sales, 0);
    const totalItems = chartData.reduce((sum, item) => sum + item.itemsSold, 0);
    const avgDailySales = chartData.length > 0 ? totalSales / chartData.length : 0;
    const avgDailyUnits = chartData.length > 0 ? Math.round(totalItems / chartData.length) : 0;
    const peakDay = [...chartData].sort((a, b) => b.sales - a.sales)[0];

    // Selected day figures
    const selectedDayData = chartData.find((d) => d.date === selectedDate);
    const selectedSales = selectedDayData ? selectedDayData.sales : 0;
    const vsAvgPercent =
      avgDailySales > 0 ? Math.round(((selectedSales - avgDailySales) / avgDailySales) * 100) : 0;

    return {
      totalSales,
      totalItems,
      avgDailySales,
      avgDailyUnits,
      peakDay,
      selectedSales,
      vsAvgPercent,
    };
  }, [chartData, selectedDate]);

  const activeValueKey = metric === 'revenue' ? 'sales' : 'itemsSold';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isSelectedDay = data.date === selectedDate;
      const isCurrentDay = isToday(data.date);

      return (
        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-700 text-xs min-w-[160px] animate-in fade-in duration-100">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-2">
            <span className="font-semibold text-slate-300">
              {data.label} ({data.date})
            </span>
            {isCurrentDay && (
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold">
                Today
              </span>
            )}
            {isSelectedDay && !isCurrentDay && (
              <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded text-[10px] font-bold">
                Active
              </span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-slate-400">Sales Volume:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {formatNaira(data.sales)}
              </span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-slate-400">Units Sold:</span>
              <span className="font-medium text-slate-200">{data.itemsSold} items</span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-slate-400">Transactions:</span>
              <span className="font-medium text-slate-200">{data.transactionsCount} sales</span>
            </div>
          </div>
          {onSelectDate && (
            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 text-center">
              Click node to view this day
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="daily-sales-trend-container"
      className={`rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/50 dark:bg-slate-900/40 p-3 sm:p-4 transition-all ${className}`}
    >
      {/* Header controls & toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 pb-2.5 border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Daily Sales Volume Trend</span>
              <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                (Last {timeRange} Days)
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Visual sales trajectory with benchmark and day selection
            </p>
          </div>
        </div>

        {/* Range & Metric Selectors */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Metric Toggle: Revenue (₦) vs Items */}
          <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 border border-slate-300/60 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                metric === 'revenue'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Revenue (₦)
            </button>
            <button
              type="button"
              onClick={() => setMetric('volume')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                metric === 'volume'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Units Sold
            </button>
          </div>

          {/* Time Horizon: 7d, 14d, 30d */}
          <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-800 p-0.5 border border-slate-300/60 dark:border-slate-700/80">
            {([7, 14, 30] as TimeRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  timeRange === range
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Numerical Benchmark Strip: Period Context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Period Volume</span>
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
            {formatNaira(stats.totalSales, true)}
          </span>
          <span className="text-[10px] text-slate-400 block">{stats.totalItems} units total</span>
        </div>
        <div className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Daily Average</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {formatNaira(stats.avgDailySales, true)}
          </span>
          <span className="text-[10px] text-slate-400 block">per day</span>
        </div>
        <div className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Peak Sales Day</span>
          <span className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">
            {stats.peakDay ? formatNaira(stats.peakDay.sales, true) : '₦0'}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">
            {stats.peakDay ? stats.peakDay.label : 'None'}
          </span>
        </div>
        <div className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Selected vs Avg</span>
          <span
            className={`text-xs sm:text-sm font-bold font-mono ${
              stats.vsAvgPercent >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {stats.vsAvgPercent > 0 ? `+${stats.vsAvgPercent}%` : `${stats.vsAvgPercent}%`}
          </span>
          <span className="text-[10px] text-slate-400 block truncate">
            {isToday(selectedDate) ? 'Today' : isYesterday(selectedDate) ? 'Yesterday' : selectedDate}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onClick={(e: any) => {
              const anyEvent = e as any;
              if (anyEvent?.activePayload && anyEvent.activePayload.length && onSelectDate) {
                const targetDate = anyEvent.activePayload[0]?.payload?.date;
                if (targetDate) onSelectDate(targetDate);
              }
            }}
          >
            <defs>
              <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="volumeTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#94a3b8"
              strokeOpacity={0.2}
              vertical={false}
            />

            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            />

            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => {
                if (metric === 'revenue') {
                  return formatNaira(val, true);
                }
                return String(val);
              }}
            />

            <Tooltip content={<CustomTooltip />} cursor={<HorizontalDateChartCursor />} />

            {/* Clean horizontal benchmark reference line in between showing the needed average information */}
            {metric === 'revenue' && stats.avgDailySales > 0 && (
              <ReferenceLine
                y={stats.avgDailySales}
                stroke="#6366f1"
                strokeDasharray="4 4"
                strokeWidth={1.0}
                label={{
                  value: `Avg: ${formatNaira(stats.avgDailySales, true)}`,
                  position: 'insideTopLeft',
                  fill: '#6366f1',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}
            {metric === 'volume' && stats.avgDailyUnits > 0 && (
              <ReferenceLine
                y={stats.avgDailyUnits}
                stroke="#2563EB"
                strokeDasharray="4 4"
                strokeWidth={1.0}
                label={{
                  value: `Avg: ${stats.avgDailyUnits} units`,
                  position: 'insideTopLeft',
                  fill: '#2563EB',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey={activeValueKey}
              stroke={metric === 'revenue' ? '#059669' : '#2563EB'}
              strokeWidth={1.0}
              fill={metric === 'revenue' ? 'url(#salesTrendGradient)' : 'url(#volumeTrendGradient)'}
              activeDot={{
                r: 4.5,
                stroke: '#ffffff',
                strokeWidth: 1.0,
                fill: metric === 'revenue' ? '#059669' : '#2563EB',
                className: 'cursor-pointer drop-shadow-sm',
              }}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy) return null;
                const isSelected = payload.date === selectedDate;
                if (isSelected) {
                  return (
                    <g key={`dot-${payload.date}`}>
                      <circle cx={cx} cy={cy} r={5.5} fill="#10B981" fillOpacity={0.25} />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill="#059669"
                        stroke="#ffffff"
                        strokeWidth={1.0}
                      />
                    </g>
                  );
                }
                return (
                  <circle
                    key={`dot-${payload.date}`}
                    cx={cx}
                    cy={cy}
                    r={2}
                    fill={metric === 'revenue' ? '#059669' : '#2563EB'}
                    fillOpacity={0.75}
                  />
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Helpful Interactive Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            <span>Daily Sales Volume</span>
          </div>
          {metric === 'revenue' && stats.avgDailySales > 0 && (
            <div className="flex items-center space-x-1.5">
              <span className="w-3 border-t-2 border-dashed border-indigo-500 inline-block" />
              <span>Average ({formatNaira(stats.avgDailySales, true)})</span>
            </div>
          )}
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500 ring-1 ring-emerald-600 inline-block" />
            <span>Active Selected Date</span>
          </div>
        </div>
      </div>
    </div>
  );
};
