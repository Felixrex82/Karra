import React, { useState, useMemo } from 'react';
import { BusinessEvent, DailySummary } from '../types';
import { calculateDailySummary, formatNaira, formatSignedNaira } from '../engine/calculations';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Package,
  Users,
  User,
  Sparkles,
  ArrowRight,
  Check,
  Plus,
  Download,
  Share2,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { MonthlyCardModal } from './MonthlyCardModal';
import { MonthlyCardExportData } from '../utils/cardGenerators';
import { ensureEventHeadlineAndSummary } from '../engine/eventSummarizer';

interface BusinessCalendarProps {
  events: BusinessEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onExplainDate: (date: string) => void;
  businessName?: string;
  onShowToast?: (message: string, type?: 'info' | 'success') => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenRecordSale?: () => void;
  onOpenRecordExpense?: () => void;
}

interface CalendarDayCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
}

interface ActivityItem {
  id: string;
  type: 'SALE' | 'EXPENSE' | 'STOCK' | 'CUSTOMER' | 'AI' | 'DEBT';
  title: string;
  subtitle: string;
  amount?: number;
  amountText?: string;
  timeStr: string;
  rawEvent?: BusinessEvent;
}

export const BusinessCalendar: React.FC<BusinessCalendarProps> = ({
  events,
  selectedDate,
  onSelectDate,
  onExplainDate,
  businessName = 'Karra Store',
  onShowToast,
  onNavigateToTab,
  onOpenRecordSale,
  onOpenRecordExpense,
}) => {
  // Parse year and month from selectedDate or default to September 2026
  const parsedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { year: parts[0], month: parts[1] - 1, day: parts[2] };
      }
    } catch {}
    return { year: 2026, month: 8, day: 3 }; // Sep 3, 2026
  }, [selectedDate]);

  const [currentYear, setCurrentYear] = useState<number>(parsedDate.year);
  const [currentMonth, setCurrentMonth] = useState<number>(parsedDate.month); // 0-indexed (8 = September)
  const [activeSegment, setActiveSegment] = useState<'day' | 'week' | 'month'>('day');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isActivityExpanded, setIsActivityExpanded] = useState(true);
  const [isMonthlyCardModalOpen, setIsMonthlyCardModalOpen] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const monthShortNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectMonthYear = (mIdx: number, y: number) => {
    setCurrentMonth(mIdx);
    setCurrentYear(y);
    setIsMonthPickerOpen(false);
    // select 1st of that month or clamp
    const mm = String(mIdx + 1).padStart(2, '0');
    onSelectDate(`${y}-${mm}-01`);
  };

  // Generate calendar cells (including previous month trailing and next month leading)
  const calendarCells = useMemo<CalendarDayCell[]>(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: CalendarDayCell[] = [];

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayNum = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const mm = String(prevMonth + 1).padStart(2, '0');
      const dd = String(prevDayNum).padStart(2, '0');
      cells.push({
        dateStr: `${prevYear}-${mm}-${dd}`,
        dayNum: prevDayNum,
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(currentMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({
        dateStr: `${currentYear}-${mm}-${dd}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Leading days from next month to complete standard grid (35 or 42 cells)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const mm = String(nextMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({
        dateStr: `${nextYear}-${mm}-${dd}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Precalculate daily summaries for current month and previous month for true real-time analytics
  const {
    monthSummaries,
    totalMonthSales,
    totalMonthExpenses,
    totalMonthCOGS,
    totalMonthProfit,
    totalItemsSold,
    distinctCustomersCount,
    profitableDaysCount,
    lossDaysCount,
    breakevenDaysCount,
    bestDayDate,
    bestDayProfit,
    prevMonthSales,
    prevMonthExpenses,
    prevMonthProfit,
    prevMonthItemsSold,
    prevMonthCustomersCount,
  } = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const summaries: Record<string, DailySummary> = {};
    let sales = 0;
    let expenses = 0;
    let cogs = 0;
    let profit = 0;
    let items = 0;
    const customersSet = new Set<string>();
    let profitable = 0;
    let loss = 0;
    let breakeven = 0;
    let maxProfit = -Infinity;
    let maxProfitDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(currentMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${mm}-${dd}`;
      const sum = calculateDailySummary(events, dateStr);
      summaries[dateStr] = sum;

      if (sum.eventsCount > 0) {
        sales += sum.sales;
        expenses += sum.expenses;
        cogs += sum.costOfGoods;
        profit += sum.netOperatingResult;
        items += sum.itemsSoldCount;

        if (sum.netOperatingResult > maxProfit) {
          maxProfit = sum.netOperatingResult;
          maxProfitDay = dateStr;
        }

        if (sum.status === 'PROFIT') {
          profitable++;
        } else if (sum.status === 'LOSS') {
          loss++;
        } else {
          breakeven++;
        }
      }
    }

    // Scan events in this month for customer names
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    events.forEach((ev) => {
      if (!ev.isCorrected && ev.date && ev.date.startsWith(currentMonthPrefix)) {
        if (ev.customerName) customersSet.add(ev.customerName.trim());
      }
    });

    // Compute Previous Month analytics for true real-time trend comparisons
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthPrefix = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}`;

    let pSales = 0;
    let pExpenses = 0;
    let pProfit = 0;
    let pItems = 0;
    const prevCustomersSet = new Set<string>();

    events.forEach((ev) => {
      if (!ev.isCorrected && ev.date && ev.date.startsWith(prevMonthPrefix)) {
        if (ev.type === 'SALE') {
          pSales += ev.totalRevenue || 0;
          pItems += ev.quantity || 1;
          if (ev.totalCostAtTime) pProfit -= ev.totalCostAtTime;
        } else if (ev.type === 'EXPENSE' || ev.type === 'PURCHASE_STOCK') {
          const expAmt = ev.expenseAmount || ev.totalCostAtTime || 0;
          pExpenses += expAmt;
          pProfit -= expAmt;
        } else if (ev.type === 'RETURN_REFUND') {
          const refAmt = ev.refundAmount || ev.totalRevenue || 0;
          pSales = Math.max(0, pSales - refAmt);
        }
        if (ev.customerName) {
          prevCustomersSet.add(ev.customerName.trim());
        }
      }
    });

    pProfit += pSales;

    return {
      monthSummaries: summaries,
      totalMonthSales: sales,
      totalMonthExpenses: expenses,
      totalMonthCOGS: cogs,
      totalMonthProfit: profit,
      totalItemsSold: items,
      distinctCustomersCount: customersSet.size,
      profitableDaysCount: profitable,
      lossDaysCount: loss,
      breakevenDaysCount: breakeven,
      bestDayDate: maxProfit > -Infinity ? maxProfitDay : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
      bestDayProfit: maxProfit > -Infinity ? maxProfit : 0,
      prevMonthSales: pSales,
      prevMonthExpenses: pExpenses,
      prevMonthProfit: pProfit,
      prevMonthItemsSold: pItems,
      prevMonthCustomersCount: prevCustomersSet.size,
    };
  }, [events, currentYear, currentMonth]);

  // Real-time Trend Calculator helper
  const computeTrend = (current: number, previous: number) => {
    if (previous === 0) {
      if (current > 0) return { percent: 100, formatted: '+100%', direction: 'up' as const };
      if (current < 0) return { percent: 100, formatted: '-100%', direction: 'down' as const };
      return { percent: 0, formatted: '0.0%', direction: 'neutral' as const };
    }
    const diff = current - previous;
    const pct = (diff / Math.abs(previous)) * 100;
    if (pct > 0.05) {
      return { percent: pct, formatted: `+${pct.toFixed(1)}%`, direction: 'up' as const };
    }
    if (pct < -0.05) {
      return { percent: Math.abs(pct), formatted: `-${Math.abs(pct).toFixed(1)}%`, direction: 'down' as const };
    }
    return { percent: 0, formatted: '0.0%', direction: 'neutral' as const };
  };

  // Real-time Analytical Metrics (Zero dummy values, real-time percentages and directions)
  const displayMetrics = useMemo(() => {
    const salesTrend = computeTrend(totalMonthSales, prevMonthSales);
    const expensesTrend = computeTrend(totalMonthExpenses, prevMonthExpenses);
    const itemsTrend = computeTrend(totalItemsSold, prevMonthItemsSold);
    const customersTrend = computeTrend(distinctCustomersCount, prevMonthCustomersCount);

    // Net Profit Margin & Profit/Loss state
    const netProfitMargin = totalMonthSales > 0 ? (totalMonthProfit / totalMonthSales) * 100 : 0;
    const isNetProfit = totalMonthProfit > 0;
    const isNetLoss = totalMonthProfit < 0;

    let profitTrendFormatted = '0.0%';
    let profitDirection: 'up' | 'down' | 'neutral' = 'neutral';
    if (isNetProfit) {
      profitTrendFormatted = `+${netProfitMargin.toFixed(1)}%`;
      profitDirection = 'up';
    } else if (isNetLoss) {
      profitTrendFormatted = `-${Math.abs(netProfitMargin).toFixed(1)}%`;
      profitDirection = 'down';
    }

    return {
      sales: totalMonthSales,
      salesTrend: salesTrend.formatted,
      salesDirection: salesTrend.direction,
      expenses: totalMonthExpenses,
      expensesTrend: expensesTrend.formatted,
      expensesDirection: expensesTrend.direction,
      profit: totalMonthProfit,
      isNetProfit,
      isNetLoss,
      profitMarginPercent: netProfitMargin,
      profitTrend: profitTrendFormatted,
      profitDirection,
      itemsSold: totalItemsSold,
      itemsSoldTrend: itemsTrend.formatted,
      itemsSoldDirection: itemsTrend.direction,
      customers: distinctCustomersCount,
      customersTrend: customersTrend.formatted,
      customersDirection: customersTrend.direction,
      profitableDays: profitableDaysCount,
      lossDays: lossDaysCount,
      breakevenDays: breakevenDaysCount,
    };
  }, [
    totalMonthSales,
    prevMonthSales,
    totalMonthExpenses,
    prevMonthExpenses,
    totalMonthProfit,
    totalItemsSold,
    prevMonthItemsSold,
    distinctCustomersCount,
    prevMonthCustomersCount,
    profitableDaysCount,
    lossDaysCount,
    breakevenDaysCount,
  ]);

  // Selected Day Summary (Real analytical calculation)
  const selectedDaySummary = useMemo<DailySummary>(() => {
    if (monthSummaries[selectedDate]) {
      return monthSummaries[selectedDate];
    }
    return calculateDailySummary(events, selectedDate);
  }, [monthSummaries, selectedDate, events]);

  // Real Analytical Values for Selected Day
  const effectiveDaySales = selectedDaySummary.sales;
  const effectiveDayExpenses = selectedDaySummary.expenses;
  const effectiveDayNetProfit = selectedDaySummary.netOperatingResult;

  // Real analytical values for Week and Month view in Segmented Switcher
  const activeSegmentData = useMemo(() => {
    if (activeSegment === 'month') {
      return {
        sales: totalMonthSales,
        expenses: totalMonthExpenses,
        netProfit: totalMonthProfit,
        status: totalMonthProfit > 0 ? ('PROFIT' as const) : totalMonthProfit < 0 ? ('LOSS' as const) : ('BREAKEVEN' as const),
      };
    }
    if (activeSegment === 'week') {
      // 7-day period ending on selectedDate
      try {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const endD = new Date(y, m - 1, d);
        const startD = new Date(endD);
        startD.setDate(endD.getDate() - 6);

        let wSales = 0;
        let wExpenses = 0;
        let wProfit = 0;
        let wEvents = 0;

        for (let dt = new Date(startD); dt <= endD; dt.setDate(dt.getDate() + 1)) {
          const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          const sum = monthSummaries[dtStr] || calculateDailySummary(events, dtStr);
          if (sum.eventsCount > 0) {
            wSales += sum.sales;
            wExpenses += sum.expenses;
            wProfit += sum.netOperatingResult;
            wEvents += sum.eventsCount;
          }
        }

        return {
          sales: wSales,
          expenses: wExpenses,
          netProfit: wProfit,
          status: wProfit > 0 ? ('PROFIT' as const) : wProfit < 0 ? ('LOSS' as const) : ('BREAKEVEN' as const),
        };
      } catch {
        return {
          sales: effectiveDaySales,
          expenses: effectiveDayExpenses,
          netProfit: effectiveDayNetProfit,
          status: selectedDaySummary.status,
        };
      }
    }
    // Day
    return {
      sales: effectiveDaySales,
      expenses: effectiveDayExpenses,
      netProfit: effectiveDayNetProfit,
      status: selectedDaySummary.status,
    };
  }, [activeSegment, selectedDate, totalMonthSales, totalMonthExpenses, totalMonthProfit, monthSummaries, events, effectiveDaySales, effectiveDayExpenses, effectiveDayNetProfit, selectedDaySummary]);

  // Determine active segment status
  const effectiveDayStatus = useMemo<'PROFIT' | 'LOSS' | 'BREAKEVEN' | 'EMPTY'>(() => {
    if (activeSegment === 'day' && selectedDaySummary.eventsCount === 0) return 'EMPTY';
    if (activeSegmentData.netProfit > 0) return 'PROFIT';
    if (activeSegmentData.netProfit < 0) return 'LOSS';
    if (activeSegmentData.sales > 0 || activeSegmentData.expenses > 0) return 'BREAKEVEN';
    return 'EMPTY';
  }, [activeSegment, selectedDaySummary.eventsCount, activeSegmentData]);

  // Format date helper: "Wednesday, Sep 3, 2026"
  const formattedFullSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const weekday = dt.toLocaleDateString('en-US', { weekday: 'long' });
      const month = dt.toLocaleDateString('en-US', { month: 'short' });
      return `${weekday}, ${month} ${d}, ${y}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Format short date helper: "Activity on Sep 3, 2026"
  const formattedActivityHeaderDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const month = dt.toLocaleDateString('en-US', { month: 'short' });
      return `${month} ${d}, ${y}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Format nested card header: "Today (Wed, Sep 3)"
  const formattedCardTodayHeader = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const month = dt.toLocaleDateString('en-US', { month: 'short' });
      return `Today (${weekday}, ${month} ${d})`;
    } catch {
      return `Selected (${selectedDate})`;
    }
  }, [selectedDate]);

  // Activity list on selected date
  const dayActivityList = useMemo<ActivityItem[]>(() => {
    const rawEvents = events.filter((e) => e.date === selectedDate && !e.isCorrected);

    if (rawEvents.length > 0) {
      return rawEvents.map((ev, idx) => {
        const display = ensureEventHeadlineAndSummary(ev);
        let itemType: ActivityItem['type'] = 'SALE';
        let amountText: string | undefined;

        if (ev.type === 'SALE') {
          itemType = 'SALE';
          amountText = `+${formatNaira(ev.totalRevenue || 0)}`;
        } else if (ev.type === 'EXPENSE') {
          itemType = 'EXPENSE';
          amountText = `-${formatNaira(ev.expenseAmount || 0)}`;
        } else if (ev.type === 'CUSTOMER_DEBT') {
          itemType = 'DEBT';
          amountText = `Owed: ${formatNaira(ev.receivableAdded || 0)}`;
        } else if (ev.type === 'DEBT_PAYMENT') {
          itemType = 'SALE';
          amountText = `Paid: +${formatNaira(ev.cashReceived || 0)}`;
        } else {
          itemType = 'AI';
          amountText = '-';
        }

        return {
          id: ev.id || `act-${idx}`,
          type: itemType,
          title: (ev.type === 'SALE' ? 'Sale recorded' : ev.type === 'EXPENSE' ? 'Expense recorded' : display.headline) || 'Recorded activity',
          subtitle: (ev.type === 'SALE'
            ? `${ev.quantity ? `${ev.quantity} ${ev.unit || 'items'}` : ev.productName || 'Sale'}${ev.customerName ? ` • Customer: ${ev.customerName}` : ''}`
            : ev.type === 'EXPENSE'
            ? ev.expenseCategory || ev.rawUserText || 'Expense'
            : display.summary) || 'Business update',
          amount: ev.totalRevenue || ev.expenseAmount,
          amountText,
          timeStr: ev.timeStr || '12:00 PM',
          rawEvent: ev,
        };
      });
    }

    return [];
  }, [events, selectedDate]);

  // Dynamic Dot color helper for a calendar day strictly from recorded events
  const getDayDots = (dateStr: string) => {
    const sum = monthSummaries[dateStr];
    if (!sum || sum.eventsCount === 0) return [];

    const dots: string[] = [];
    if (sum.status === 'PROFIT') dots.push('green');
    else if (sum.status === 'LOSS') dots.push('red');
    else dots.push('blue');

    if (sum.outstandingReceivables > 0) {
      dots.push('yellow');
    }
    return dots;
  };

  // Monthly Card Export Data strictly from actual recorded numbers
  const monthCardData: MonthlyCardExportData = {
    year: currentYear,
    month: currentMonth,
    monthName: monthNames[currentMonth],
    totalSales: totalMonthSales,
    totalCostOfGoods: totalMonthCOGS,
    totalExpenses: totalMonthExpenses,
    netProfit: totalMonthProfit,
    netMarginPercent: displayMetrics.profitMarginPercent,
    cashReceived: totalMonthSales,
    creditGiven: 0,
    profitableDaysCount: profitableDaysCount,
    lossDaysCount: lossDaysCount,
    breakevenDaysCount: breakevenDaysCount,
    bestDay: { date: bestDayDate, profit: bestDayProfit },
    totalTransactions: totalItemsSold,
    totalItemsSold: totalItemsSold,
    monthSummaries,
    daysInMonth: new Date(currentYear, currentMonth + 1, 0).getDate(),
  };

  return (
    <div className="space-y-4 sm:space-y-6 text-slate-900 dark:text-slate-100 animate-in fade-in duration-300">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track your business activity and see your daily summary.
          </p>
        </div>

        {/* Month Selector Dropdown Pill */}
        <div className="relative self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsMonthPickerOpen((prev) => !prev)}
            className="inline-flex items-center space-x-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#0F1B2B] hover:bg-slate-50 dark:hover:bg-[#142337] border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <CalendarIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>{monthNames[currentMonth]} {currentYear}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Month & Year Picker Popup */}
          {isMonthPickerOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#0F1B2B] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-3.5 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Select Month & Year
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setCurrentYear((y) => y - 1)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                    title="Previous Year"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-slate-900 dark:text-white px-1">{currentYear}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentYear((y) => y + 1)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                    title="Next Year"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 12 Months Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {monthShortNames.map((name, idx) => {
                  const isCurrent = idx === currentMonth;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectMonthYear(idx, currentYear)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center ${
                        isCurrent
                          ? 'bg-emerald-500 text-white font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCurrentYear(now.getFullYear());
                    setCurrentMonth(now.getMonth());
                    setIsMonthPickerOpen(false);
                    const mm = String(now.getMonth() + 1).padStart(2, '0');
                    const dd = String(now.getDate()).padStart(2, '0');
                    onSelectDate(`${now.getFullYear()}-${mm}-${dd}`);
                  }}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                >
                  Jump to Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMonthPickerOpen(false);
                    setIsMonthlyCardModalOpen(true);
                  }}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Export Card</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards Row (Real Analytical Data, Real-time Trends & Directional Profit/Loss Arrows) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-md shrink-0 ${
              displayMetrics.salesDirection === 'down' ? 'bg-[#EF4444] shadow-rose-950/40' : 'bg-[#10B981] shadow-emerald-950/40'
            }`}>
              {displayMetrics.salesDirection === 'down' ? (
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block truncate">Total Sales</span>
              <span className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block font-mono truncate">
                {formatNaira(displayMetrics.sales)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
              displayMetrics.salesDirection === 'up'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : displayMetrics.salesDirection === 'down'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
            }`}>
              {displayMetrics.salesDirection === 'up' && <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.salesDirection === 'down' && <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.salesDirection === 'neutral' && <Minus className="w-2.5 h-2.5 stroke-[3]" />}
              <span>{displayMetrics.salesTrend.replace('+', '')}</span>
            </span>
            <span className="text-[11px] truncate">vs prev month</span>
          </div>
        </div>

        {/* Card 2: Total Expenses */}
        <div className="bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#EF4444] text-white flex items-center justify-center font-bold shadow-md shadow-rose-950/40 shrink-0">
              {displayMetrics.expensesDirection === 'down' ? (
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block truncate">Total Expenses</span>
              <span className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block font-mono truncate">
                {formatNaira(displayMetrics.expenses)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
              displayMetrics.expensesDirection === 'down'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : displayMetrics.expensesDirection === 'up'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
            }`}>
              {displayMetrics.expensesDirection === 'up' && <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.expensesDirection === 'down' && <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.expensesDirection === 'neutral' && <Minus className="w-2.5 h-2.5 stroke-[3]" />}
              <span>{displayMetrics.expensesTrend.replace('+', '')}</span>
            </span>
            <span className="text-[11px] truncate">vs prev month</span>
          </div>
        </div>

        {/* Card 3: Net Profit / Operating Loss (Directional Arrow & Real-Time Margin Percentage) */}
        <div className="bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold shadow-md shrink-0 ${
              displayMetrics.profitDirection === 'down'
                ? 'bg-[#EF4444] shadow-rose-950/40'
                : displayMetrics.profitDirection === 'up'
                ? 'bg-[#10B981] shadow-emerald-950/40'
                : 'bg-slate-500 shadow-slate-950/40'
            }`}>
              {displayMetrics.profitDirection === 'down' ? (
                <TrendingDown className="w-5 h-5 stroke-[2.5]" />
              ) : displayMetrics.profitDirection === 'up' ? (
                <TrendingUp className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <Receipt className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block truncate">
                {displayMetrics.isNetLoss ? 'Operating Loss' : 'Net Profit'}
              </span>
              <span className={`text-base sm:text-xl font-extrabold tracking-tight mt-0.5 block font-mono truncate ${
                displayMetrics.isNetLoss
                  ? 'text-rose-600 dark:text-rose-400'
                  : displayMetrics.isNetProfit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-900 dark:text-white'
              }`}>
                {displayMetrics.isNetProfit
                  ? `+${formatNaira(displayMetrics.profit)}`
                  : displayMetrics.isNetLoss
                  ? `-${formatNaira(Math.abs(displayMetrics.profit))}`
                  : '₦0'}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
              displayMetrics.profitDirection === 'up'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : displayMetrics.profitDirection === 'down'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
            }`}>
              {displayMetrics.profitDirection === 'up' && <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.profitDirection === 'down' && <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.profitDirection === 'neutral' && <Minus className="w-2.5 h-2.5 stroke-[3]" />}
              <span>{displayMetrics.profitTrend.replace('+', '')}</span>
            </span>
            <span className="text-[11px] truncate">
              {displayMetrics.isNetLoss ? 'operating loss' : 'net margin'}
            </span>
          </div>
        </div>

        {/* Card 4: Items Sold */}
        <div className="bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#3B82F6] text-white flex items-center justify-center font-bold shadow-md shadow-blue-950/40 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block truncate">Items Sold</span>
              <span className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block font-mono truncate">
                {displayMetrics.itemsSold}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
              displayMetrics.itemsSoldDirection === 'up'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : displayMetrics.itemsSoldDirection === 'down'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
            }`}>
              {displayMetrics.itemsSoldDirection === 'up' && <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.itemsSoldDirection === 'down' && <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.itemsSoldDirection === 'neutral' && <Minus className="w-2.5 h-2.5 stroke-[3]" />}
              <span>{displayMetrics.itemsSoldTrend.replace('+', '')}</span>
            </span>
            <span className="text-[11px] truncate">vs prev month</span>
          </div>
        </div>

        {/* Card 5: Customers */}
        <div className="bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center font-bold shadow-md shadow-purple-950/40 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block truncate">Customers</span>
              <span className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block font-mono truncate">
                {displayMetrics.customers}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
              displayMetrics.customersDirection === 'up'
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : displayMetrics.customersDirection === 'down'
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
            }`}>
              {displayMetrics.customersDirection === 'up' && <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.customersDirection === 'down' && <ArrowDown className="w-2.5 h-2.5 stroke-[3]" />}
              {displayMetrics.customersDirection === 'neutral' && <Minus className="w-2.5 h-2.5 stroke-[3]" />}
              <span>{displayMetrics.customersTrend.replace('+', '')}</span>
            </span>
            <span className="text-[11px] truncate">vs prev month</span>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Calendar Grid (Left) + Performance Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column (7 cols on lg, 8 cols on xl): Calendar Grid */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg">
          {/* Calendar Header with Navigation */}
          <div className="flex items-center justify-between pb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {monthNames[currentMonth]} {currentYear}
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* 7-Column Day Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarCells.map((cell) => {
              const isSelected = selectedDate === cell.dateStr;
              const dots = getDayDots(cell.dateStr);

              let cellClasses =
                'aspect-square sm:h-16 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer relative select-none ';

              if (!cell.isCurrentMonth) {
                cellClasses += 'bg-slate-50/50 dark:bg-[#0B1522]/40 text-slate-400 dark:text-slate-600 border border-slate-100 dark:border-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700/60 ';
              } else if (isSelected) {
                cellClasses += 'bg-emerald-50 dark:bg-[#0E2822] border-2 border-emerald-500 text-emerald-950 dark:text-white font-bold shadow-md shadow-emerald-500/10 dark:shadow-emerald-950/40 scale-[1.02] z-10 ';
              } else {
                cellClasses += 'bg-slate-50/80 dark:bg-[#0B1522] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-[#0E1A29] ';
              }

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => onSelectDate(cell.dateStr)}
                  className={cellClasses}
                >
                  <span className={`text-xs sm:text-sm ${isSelected ? 'font-bold text-emerald-950 dark:text-white' : ''}`}>
                    {cell.dayNum}
                  </span>

                  {/* Colored status dot indicators */}
                  {dots.length > 0 && (
                    <div className="flex items-center space-x-1 mt-1">
                      {dots.map((dotColor, dotIdx) => {
                        let dotBg = 'bg-[#3B82F6]'; // default blue
                        if (dotColor === 'green') dotBg = 'bg-[#10B981]';
                        else if (dotColor === 'red') dotBg = 'bg-[#EF4444]';
                        else if (dotColor === 'yellow') dotBg = 'bg-[#EAB308]';

                        return (
                          <span
                            key={dotIdx}
                            className={`w-1.5 h-1.5 rounded-full ${dotBg}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (5 cols on lg, 4 cols on xl): Selected Day Summary Card */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg space-y-4">
          {/* Day / Week / Month Segmented Switcher */}
          <div className="bg-slate-100 dark:bg-[#0B1420] p-1 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setActiveSegment('day')}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeSegment === 'day'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setActiveSegment('week')}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeSegment === 'week'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setActiveSegment('month')}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeSegment === 'month'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Month
            </button>
          </div>

          {/* Date Heading & Status Pill */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {activeSegment === 'month'
                ? `${monthNames[currentMonth]} ${currentYear}`
                : activeSegment === 'week'
                ? `Week of ${formattedActivityHeaderDate}`
                : formattedFullSelectedDate}
            </h3>

            {/* Status Pill Badge */}
            {effectiveDayStatus === 'PROFIT' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Profitable
              </span>
            )}
            {effectiveDayStatus === 'LOSS' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                Operating Loss
              </span>
            )}
            {effectiveDayStatus === 'BREAKEVEN' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                Break-even
              </span>
            )}
            {effectiveDayStatus === 'EMPTY' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700/20 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/40">
                No Activity
              </span>
            )}
          </div>

          {/* Month / Period Performance Counts with status dots */}
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-slate-600 dark:text-slate-300">Profitable Days</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{displayMetrics.profitableDays}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <span className="text-slate-600 dark:text-slate-300">Loss Days</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{displayMetrics.lossDays}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-slate-600 dark:text-slate-300">Break-even Days</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{displayMetrics.breakevenDays}</span>
            </div>
          </div>

          {/* Nested Selected Date Breakdown Card */}
          <div className="bg-slate-50 dark:bg-[#0B1522] rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              {activeSegment === 'month'
                ? `Month Summary (${monthNames[currentMonth]} ${currentYear})`
                : activeSegment === 'week'
                ? `Weekly Breakdown (${formattedActivityHeaderDate})`
                : formattedCardTodayHeader}
            </span>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 dark:text-slate-400">Sales</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatNaira(activeSegmentData.sales)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Expenses</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatNaira(activeSegmentData.expenses)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-semibold">
                {activeSegmentData.netProfit >= 0 ? 'Net Profit' : 'Operating Loss'}
              </span>
              <span className={`font-mono font-extrabold text-sm ${
                activeSegmentData.netProfit > 0
                  ? 'text-emerald-600 dark:text-[#10B981]'
                  : activeSegmentData.netProfit < 0
                  ? 'text-rose-600 dark:text-[#EF4444]'
                  : 'text-slate-700 dark:text-slate-300'
              }`}>
                {activeSegmentData.netProfit > 0
                  ? `+${formatNaira(activeSegmentData.netProfit)}`
                  : activeSegmentData.netProfit < 0
                  ? `-${formatNaira(Math.abs(activeSegmentData.netProfit))}`
                  : '₦0'}
              </span>
            </div>
          </div>

          {/* Full Summary CTA Button */}
          <button
            type="button"
            onClick={() => onExplainDate(selectedDate)}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-[#092B21] hover:bg-emerald-100 dark:hover:bg-[#0c382b] border border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
          >
            <span>View Full Summary</span>
            <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* 4. Bottom Activity Section: "Activity on [Selected Date]" */}
      <div className="bg-white dark:bg-[#0F1B2B] rounded-2xl border border-slate-200/90 dark:border-slate-800/80 p-4 sm:p-5 shadow-xs dark:shadow-lg space-y-3">
        {/* Activity Section Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Activity on {formattedActivityHeaderDate}
            </h3>
            {effectiveDayStatus === 'PROFIT' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Profitable
              </span>
            )}
            {effectiveDayStatus === 'LOSS' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                Operating Loss
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsActivityExpanded((prev) => !prev)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Toggle activity"
          >
            {isActivityExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Activity List */}
        {isActivityExpanded && (
          <div className="space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60 pt-1">
            {dayActivityList.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No activity recorded on this day.
                </p>
                <div className="flex items-center justify-center space-x-2">
                  {onOpenRecordSale && (
                    <button
                      type="button"
                      onClick={onOpenRecordSale}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      + Record Sale
                    </button>
                  )}
                  {onOpenRecordExpense && (
                    <button
                      type="button"
                      onClick={onOpenRecordExpense}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      + Record Expense
                    </button>
                  )}
                </div>
              </div>
            ) : (
              dayActivityList.map((act) => {
                return (
                  <div
                    key={act.id}
                    onClick={() => {
                      if (act.rawEvent && onExplainDate) {
                        onExplainDate(selectedDate);
                      }
                    }}
                    className="py-3 flex items-center justify-between gap-3 group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/20 px-2 rounded-xl transition-colors"
                  >
                    {/* Left: Icon & Title/Subtitle */}
                    <div className="flex items-center space-x-3 min-w-0">
                      {act.type === 'SALE' && (
                        <div className="w-9 h-9 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-md">
                          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      )}
                      {act.type === 'EXPENSE' && (
                        <div className="w-9 h-9 rounded-full bg-[#EF4444] text-white flex items-center justify-center shrink-0 shadow-md">
                          <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      )}
                      {act.type === 'STOCK' && (
                        <div className="w-9 h-9 rounded-full bg-[#3B82F6] text-white flex items-center justify-center shrink-0 shadow-md">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      {act.type === 'CUSTOMER' && (
                        <div className="w-9 h-9 rounded-full bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-md">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                      {(act.type === 'AI' || act.type === 'DEBT') && (
                        <div className="w-9 h-9 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-md">
                          <Sparkles className="w-4 h-4" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                          {act.title}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {act.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount & Timestamp & Chevron */}
                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-xs sm:text-sm font-bold font-mono block ${
                            act.type === 'SALE'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : act.type === 'EXPENSE'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {act.amountText}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                          {act.timeStr}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })
            )}

            {/* View All Activity Bottom Button */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToTab) {
                    onNavigateToTab('timeline');
                  } else {
                    onExplainDate(selectedDate);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700/60 hover:border-emerald-500/50 bg-slate-50 dark:bg-[#0B1522] hover:bg-slate-100 dark:hover:bg-[#0E1A29] text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <span>View All Activity</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

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
