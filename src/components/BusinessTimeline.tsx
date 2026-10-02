import React, { useState, useMemo } from 'react';
import { BusinessEvent } from '../types';
import { formatNaira } from '../engine/calculations';
import { getTodayDateStr, getYesterdayDateStr } from '../utils/dateUtils';
import { KarraLogo } from './KarraLogo';
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Calendar as CalendarIcon,
  ChevronDown,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Wallet,
  Users,
  FileText,
  DollarSign,
  Trash2,
  ChevronRight,
  User,
  ShoppingBag,
  Truck,
  RotateCcw,
  Sparkles,
  X,
  List,
} from 'lucide-react';

interface BusinessTimelineProps {
  events: BusinessEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onExplainEvent: (event: BusinessEvent) => void;
  onCorrectEvent: (
    eventId: string,
    correctedRevenue: number,
    correctedQuantity: number,
    note: string
  ) => void;
  onDeleteEvent?: (eventId: string) => void;
  initialFilter?: string;
  onNavigateTab?: (tab: string) => void;
}

export const BusinessTimeline: React.FC<BusinessTimelineProps> = ({
  events,
  selectedDate,
  onSelectDate,
  onExplainEvent,
  onCorrectEvent,
  onDeleteEvent,
  initialFilter = 'ALL',
  onNavigateTab,
}) => {
  const [filterType, setFilterType] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr();

  // Filter events by date and type
  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.isCorrected) return false;
      if (selectedDate && e.date !== selectedDate) return false;
      return true;
    });
  }, [events, selectedDate]);

  // Daily Metrics for the 4 summary cards
  const metrics = useMemo(() => {
    let totalSales = 0;
    let totalExpenses = 0;
    let moneyReceived = 0;
    let customerDebts = 0;

    for (const ev of dayEvents) {
      if (ev.type === 'SALE') {
        totalSales += ev.totalRevenue || 0;
        moneyReceived += ev.cashReceived !== undefined ? ev.cashReceived : (ev.totalRevenue || 0);
        if (ev.receivableAdded && ev.receivableAdded > 0) {
          customerDebts += ev.receivableAdded;
        }
      } else if (ev.type === 'EXPENSE' || ev.type === 'PURCHASE_STOCK') {
        const amt = ev.expenseAmount || ev.totalCostAtTime || 0;
        totalExpenses += amt;
      } else if (ev.type === 'DEBT_PAYMENT') {
        moneyReceived += ev.cashReceived || ev.totalRevenue || 0;
      } else if (ev.type === 'CUSTOMER_DEBT') {
        customerDebts += ev.receivableAdded || ev.totalRevenue || 0;
      }
    }

    return { totalSales, totalExpenses, moneyReceived, customerDebts };
  }, [dayEvents]);

  // Filtered feed events based on pill tabs and search query
  const filteredEvents = useMemo(() => {
    return dayEvents.filter((e) => {
      if (filterType === 'Sales' && e.type !== 'SALE') return false;
      if (filterType === 'Expenses' && e.type !== 'EXPENSE') return false;
      if (filterType === 'Purchases' && e.type !== 'PURCHASE_STOCK' && e.expenseCategory !== 'Procurement')
        return false;
      if (filterType === 'Payments' && e.type !== 'DEBT_PAYMENT') return false;
      if (filterType === 'Debts' && e.type !== 'CUSTOMER_DEBT' && (!e.receivableAdded || e.receivableAdded <= 0))
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRaw = e.rawUserText.toLowerCase().includes(q);
        const matchCustomer = e.customerName?.toLowerCase().includes(q);
        const matchProduct = e.productName?.toLowerCase().includes(q);
        const matchCategory = (e.expenseCategory || e.category || e.productCategory)?.toLowerCase().includes(q);
        const matchHeadline = e.headline?.toLowerCase().includes(q);
        const matchSummary = e.summary?.toLowerCase().includes(q);
        return matchRaw || matchCustomer || matchProduct || matchCategory || Boolean(matchHeadline) || Boolean(matchSummary);
      }
      return true;
    });
  }, [dayEvents, filterType, searchQuery]);

  const filterTabs = ['All', 'Sales', 'Expenses', 'Purchases', 'Payments', 'Debts'] as const;

  return (
    <div className="space-y-4 sm:space-y-5 pb-12">
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('dashboard')}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#0d1d30] border border-slate-200 dark:border-[#162e49] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-xs cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <KarraLogo size="sm" variant="green-bg" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Transactions</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">View and manage all your business activity</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('transaction-search-input');
              if (el) el.focus();
            }}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#0d1d30] border border-slate-200 dark:border-[#162e49] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onExplainEvent(dayEvents[0] || ({} as any))}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#0d1d30] border border-slate-200 dark:border-[#162e49] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. DATE SELECTOR & TODAY / YESTERDAY ROW */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="bg-white dark:bg-[#081524] border border-slate-200 dark:border-[#12273e] hover:border-slate-300 dark:hover:border-[#1a385a] px-3.5 py-2 rounded-xl flex items-center space-x-2 text-xs font-semibold text-slate-900 dark:text-white transition-all shadow-xs cursor-pointer"
          >
            <CalendarIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {selectedDate === todayStr
                ? `Today (${selectedDate})`
                : selectedDate === yesterdayStr
                ? `Yesterday (${selectedDate})`
                : selectedDate}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {showDatePicker && (
            <div className="absolute left-0 top-full mt-2 z-30 bg-white dark:bg-[#0b1726] border border-slate-200 dark:border-[#14263e] rounded-2xl p-3 shadow-xl space-y-2 animate-in fade-in">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectDate(e.target.value);
                    setShowDatePicker(false);
                  }
                }}
                className="bg-slate-50 dark:bg-[#050e1a] border border-slate-300 dark:border-[#14263e] rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectDate(todayStr)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
              selectedDate === todayStr
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-white dark:bg-[#081524] border border-slate-200 dark:border-[#12273e] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onSelectDate(yesterdayStr)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
              selectedDate === yesterdayStr
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-white dark:bg-[#081524] border border-slate-200 dark:border-[#12273e] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Yesterday
          </button>
        </div>
      </div>

      {/* 3. SEARCH BAR */}
      <div className="relative">
        <div className="bg-white dark:bg-[#050e1a] border border-slate-200 dark:border-[#102237] rounded-xl px-3.5 py-2.5 flex items-center space-x-2.5 transition-colors focus-within:border-emerald-500/60 shadow-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            id="transaction-search-input"
            type="text"
            placeholder="Search transactions (e.g. sale, expense, customer...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. FILTER TABS ROW */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none pb-1">
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = filterType === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterType(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-[#081524] border border-slate-200 dark:border-[#12273e] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setFilterType('All')}
          className="p-2 rounded-xl bg-white dark:bg-[#081524] border border-slate-200 dark:border-[#12273e] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0 cursor-pointer"
          title="Reset filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 5. FOUR SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Total Sales */}
        <div className="bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-[#04241d] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ArrowUp className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Sales</div>
            <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
              {formatNaira(metrics.totalSales)}
            </div>
          </div>
        </div>

        {/* Card 2: Total Expenses */}
        <div className="bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-[#200b14] text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ArrowDown className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total Expenses</div>
            <div className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 tracking-tight mt-0.5">
              {formatNaira(metrics.totalExpenses)}
            </div>
          </div>
        </div>

        {/* Card 3: Money Received */}
        <div className="bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-[#0a1e38] text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Money Received</div>
            <div className="text-base sm:text-lg font-bold text-sky-600 dark:text-sky-400 tracking-tight mt-0.5">
              {formatNaira(metrics.moneyReceived)}
            </div>
          </div>
        </div>

        {/* Card 4: Customer Debts */}
        <div className="bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-[#291705] text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Customer Debts</div>
            <div className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tracking-tight mt-0.5">
              {formatNaira(metrics.customerDebts)}
            </div>
          </div>
        </div>
      </div>

      {/* 6. TRANSACTIONS FEED SECTION */}
      <div className="space-y-3 pt-1">
        {/* Section Header */}
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-[#064e3b] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <List className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Transactions Feed{' '}
            <span className="text-slate-500 dark:text-slate-400 font-normal text-xs">
              ({filteredEvents.length} recorded event{filteredEvents.length === 1 ? '' : 's'})
            </span>
          </h2>
        </div>

        {/* Feed Cards List with Left Timeline Rail */}
        <div className="space-y-3 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-[#12273e]">
          {filteredEvents.map((ev) => {
            const isExpense = ev.type === 'EXPENSE' || ev.type === 'PURCHASE_STOCK';
            const isSale = ev.type === 'SALE';
            const isDebt = ev.type === 'CUSTOMER_DEBT';
            const isPayment = ev.type === 'DEBT_PAYMENT';

            const amount = isExpense
              ? ev.expenseAmount || ev.totalCostAtTime || 0
              : ev.totalRevenue || ev.cashReceived || 0;

            const categoryName =
              ev.expenseCategory || ev.category || (isSale ? 'Sale' : isPayment ? 'Payment' : 'General');

            return (
              <div key={ev.id} className="relative flex items-start space-x-3.5 group">
                {/* Timeline Icon Badge */}
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 z-10 border transition-transform group-hover:scale-105 ${
                    isExpense
                      ? 'bg-rose-50 dark:bg-[#200b14] border-rose-200 dark:border-[#4a1223] text-rose-600 dark:text-rose-400'
                      : isSale
                      ? 'bg-emerald-50 dark:bg-[#04241d] border-emerald-200 dark:border-[#093e32] text-emerald-600 dark:text-emerald-400'
                      : isDebt
                      ? 'bg-amber-50 dark:bg-[#291705] border-amber-200 dark:border-[#4d2c0b] text-amber-600 dark:text-amber-400'
                      : 'bg-sky-50 dark:bg-[#0a1e38] border-sky-200 dark:border-[#133257] text-sky-600 dark:text-sky-400'
                  }`}
                >
                  {isExpense ? (
                    <Truck className="w-4 h-4" />
                  ) : isSale ? (
                    <ShoppingBag className="w-4 h-4" />
                  ) : isDebt ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    <Wallet className="w-4 h-4" />
                  )}
                </div>

                {/* Event Card */}
                <div className="flex-1 bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] hover:border-slate-300 dark:hover:border-[#1a385a] rounded-2xl p-4 space-y-3 transition-colors shadow-xs">
                  {/* Top Line: Date/Time + Type Pill */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {ev.timeStr || '12:00 PM'} • {ev.date}
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isExpense
                          ? 'bg-rose-50 dark:bg-[#2a0e1b] text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-[#521226]'
                          : isSale
                          ? 'bg-emerald-50 dark:bg-[#062422] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-[#093e32]'
                          : isDebt
                          ? 'bg-amber-50 dark:bg-[#2d1806] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-[#4d2c0b]'
                          : 'bg-sky-50 dark:bg-[#0a233f] text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-[#133257]'
                      }`}
                    >
                      {ev.type}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <div
                      onClick={() => onExplainEvent(ev)}
                      className="flex items-center justify-between cursor-pointer group/title"
                    >
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover/title:text-emerald-600 dark:group-hover/title:text-emerald-400 transition-colors">
                        {ev.headline || ev.productName || (isExpense ? 'Other Expense' : 'Sale')}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover/title:text-slate-900 dark:group-hover/title:text-white" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {ev.summary || (isExpense ? `Spent on ${ev.productName || categoryName}.` : `Sold to ${ev.customerName || 'customer'}.`)}
                    </p>
                  </div>

                  {/* 2-Column Attributes Box */}
                  <div className="bg-slate-50 dark:bg-[#050e1a] border border-slate-200/80 dark:border-[#0d1f33] rounded-xl p-3 grid grid-cols-2 divide-x divide-slate-200/80 dark:divide-[#0d1f33] text-xs">
                    <div className="flex items-center space-x-2 pr-3">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Category</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{categoryName}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pl-3">
                      <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Amount</div>
                        <div
                          className={`font-bold truncate ${
                            isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {formatNaira(amount)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Raw User Quote Box */}
                  {ev.rawUserText && (
                    <div className="bg-slate-50/80 dark:bg-[#050e1a]/70 border border-slate-200/80 dark:border-[#0d1f33] rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-slate-300 italic">
                      “{ev.rawUserText}”
                    </div>
                  )}

                  {/* Bottom Footer: Recorded by you + Delete button */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#0d1f33] text-xs">
                    <div className="flex items-center space-x-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Recorded by you</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(ev.id)}
                        className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold cursor-pointer text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#081524] rounded-2xl border border-slate-200/80 dark:border-[#12273e] relative z-10 shadow-xs">
              <CalendarIcon className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No transactions recorded for this day</p>
              <p className="text-xs text-slate-500 mt-1">
                Type or speak your sales and expenses on the Home tab to record transactions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b1726] border border-slate-200 dark:border-[#14263e] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Transaction</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete this recorded transaction from your ledger?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteEvent) onDeleteEvent(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
