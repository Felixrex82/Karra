import React, { useState, useRef } from 'react';
import {
  ArrowRight,
  Briefcase,
  CreditCard,
  Package,
  User,
  LineChart,
  ChevronRight,
  Clock,
  FileText,
  Lightbulb,
  Sparkles,
  AlertCircle,
  X,
  Loader2,
  BadgeCheck,
} from 'lucide-react';
import {
  BusinessState,
  BusinessEvent,
  NavigationTab,
  FollowUpQuestion,
  BusinessPulseItem,
} from '../types';
import { formatNaira } from '../engine/calculations';
import { formatDateShort, getTodayDateStr } from '../utils/dateUtils';
import { ensureEventHeadlineAndSummary } from '../engine/eventSummarizer';
import { BusinessPulseCard } from './BusinessPulseCard';

interface HomePageViewProps {
  state: BusinessState;
  onSendMessage: (text: string) => Promise<any>;
  pendingFollowUp?: FollowUpQuestion | null;
  onCancelFollowUp?: () => void;
  isProcessing?: boolean;
  onNavigateToTab: (tab: NavigationTab) => void;
  onOpenBusinessOverview: () => void;
  onQuickAction?: (actionText: string) => void;
  onExplainEvent?: (event: BusinessEvent) => void;
  onDeleteEvent?: (id: string) => void;
  observantInsights?: BusinessPulseItem[];
  onSelectInsightAction?: (actionKey: string, item?: BusinessPulseItem) => void;
}

export const HomePageView: React.FC<HomePageViewProps> = ({
  state,
  onSendMessage,
  pendingFollowUp,
  onCancelFollowUp,
  isProcessing = false,
  onNavigateToTab,
  onOpenBusinessOverview,
  onQuickAction,
  onExplainEvent,
  onDeleteEvent,
  observantInsights = [],
  onSelectInsightAction,
}) => {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Dynamic greeting based on time of day
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  })();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || isProcessing) return;
    setInputText('');
    await onSendMessage(clean);
  };

  const handleActionClick = (promptPrefix: string) => {
    setInputText(promptPrefix);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    if (onQuickAction) {
      onQuickAction(promptPrefix);
    }
  };

  // Calculate live Business Overview figures
  const totalSales = state.events
    .filter((e) => e.type === 'SALE' && !e.isCorrected)
    .reduce((sum, e) => sum + (e.totalRevenue || 0), 0);

  const totalExpenses = state.events
    .filter((e) => e.type === 'EXPENSE' && !e.isCorrected)
    .reduce((sum, e) => sum + (e.expenseAmount || 0), 0);

  const totalOutstandingDebts = state.customers.reduce(
    (sum, c) => sum + (c.outstandingBalance || 0),
    0
  );

  const totalStockItems = state.products.reduce(
    (sum, p) => sum + (p.currentStock !== undefined ? p.currentStock : 0),
    0
  );

  // Recent 4 active events
  const recentEvents = state.events
    .filter((e) => !e.isCorrected)
    .slice(0, 4)
    .map(ensureEventHeadlineAndSummary);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* 1. Hero Prompt Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B232D] via-[#0A1F28] to-[#071720] border border-[#143B47] p-5 sm:p-7 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          {/* Left Text & Input */}
          <div className="flex-1 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-medium text-[#7EA2B0]">
                {greeting}
              </span>
              {state.profile?.registrationNumber?.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <BadgeCheck className="w-3 h-3 text-emerald-400" />
                  <span>CAC Verified</span>
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight mt-1 mb-2">
              Let's get your business moving
            </h2>
            <p className="text-xs sm:text-sm text-[#8BA3AE] mb-4">
              Type or speak what you want to record. For example:
            </p>

            {/* Follow-up question banner if active */}
            {pendingFollowUp ? (
              <div className="mb-3 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm animate-in fade-in">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pendingFollowUp.prompt}</span>
                  </div>
                  {onCancelFollowUp && (
                    <button
                      type="button"
                      onClick={onCancelFollowUp}
                      className="text-amber-400 hover:text-white p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {pendingFollowUp.options && pendingFollowUp.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pendingFollowUp.options.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSendMessage(opt)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-white text-xs font-medium border border-amber-500/40 cursor-pointer"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Input Form Pill */}
            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-center bg-[#07161E]/95 border border-[#194352] rounded-2xl px-4 py-2.5 sm:py-3 shadow-inner focus-within:border-emerald-500/80 transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    pendingFollowUp
                      ? pendingFollowUp.prompt
                      : '"I sold 2 dresses"'
                  }
                  disabled={isProcessing}
                  className="w-full bg-transparent text-white placeholder-[#5A7480] text-sm focus:outline-none pr-3"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isProcessing}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#00B074] hover:bg-[#009663] disabled:opacity-30 disabled:hover:bg-[#00B074] text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md active:scale-95"
                  title="Send to Karra"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Floating Chat Graphic */}
          <div className="hidden sm:flex items-center justify-center shrink-0 relative self-center md:self-auto pr-2">
            <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-[#0D2F37] border border-[#144754] flex items-center justify-center relative shadow-2xl">
              {/* Decorative sparkle stars */}
              <Sparkles className="w-4 h-4 text-emerald-400 absolute top-2 right-2 animate-pulse" />
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 absolute bottom-3 left-3 animate-pulse delay-150" />

              {/* Chat bubble icon */}
              <div className="w-16 h-12 rounded-2xl bg-[#00B074] flex items-center justify-center shadow-lg relative">
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce delay-100" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce delay-200" />
                </div>
                {/* Bubble tail */}
                <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-[#00B074] rotate-45" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Action Grid (4 Actions) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Record Sale */}
        <button
          type="button"
          onClick={() => handleActionClick('I sold ')}
          className="bg-white dark:bg-[#0B1522] hover:bg-slate-50 dark:hover:bg-[#0F1E30] border border-slate-200/80 dark:border-[#182B3E] hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer group active:scale-95 shadow-xs hover:shadow-sm"
        >
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#00B074] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2.5">
            <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Record Sale
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log a new sale
          </span>
        </button>

        {/* Record Expense */}
        <button
          type="button"
          onClick={() => handleActionClick('Spent on ')}
          className="bg-white dark:bg-[#0B1522] hover:bg-slate-50 dark:hover:bg-[#0F1E30] border border-slate-200/80 dark:border-[#182B3E] hover:border-blue-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer group active:scale-95 shadow-xs hover:shadow-sm"
        >
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#0284C7] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2.5">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Record Expense
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track your costs
          </span>
        </button>

        {/* Update Stock */}
        <button
          type="button"
          onClick={() => onNavigateToTab('memory')}
          className="bg-white dark:bg-[#0B1522] hover:bg-slate-50 dark:hover:bg-[#0F1E30] border border-slate-200/80 dark:border-[#182B3E] hover:border-purple-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer group active:scale-95 shadow-xs hover:shadow-sm"
        >
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#8B5CF6] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2.5">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Update Stock
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Add or reduce stock
          </span>
        </button>

        {/* Add Customer */}
        <button
          type="button"
          onClick={() => handleActionClick('Add customer ')}
          className="bg-white dark:bg-[#0B1522] hover:bg-slate-50 dark:hover:bg-[#0F1E30] border border-slate-200/80 dark:border-[#182B3E] hover:border-amber-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer group active:scale-95 shadow-xs hover:shadow-sm"
        >
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#F59E0B] flex items-center justify-center shadow-md group-hover:scale-105 transition-transform mb-2.5">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            Add Customer
          </span>
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Save a customer
          </span>
        </button>
      </div>

      {/* 3. Business Overview Card (Clicking opens Daily Sales Volume Trend) */}
      <div
        onClick={onOpenBusinessOverview}
        className="bg-white dark:bg-[#0D1B2A] border border-slate-200/90 dark:border-[#1A2C40] hover:border-blue-500/50 dark:hover:border-blue-500/50 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group shadow-xs hover:shadow-md"
      >
        {/* Header Row */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-[#1A2C40]/80 mb-3.5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#132B45] text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-500/20 group-hover:scale-105 transition-transform">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Business Overview
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                  Sales Trend →
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click to view daily sales volume trend and performance metrics
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* 4 Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-0 sm:divide-x sm:divide-slate-100 dark:sm:divide-[#1A2C40]/80">
          <div className="sm:px-3 first:pl-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Total Sales</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalSales > 0 ? formatNaira(totalSales) : '—'}
            </p>
          </div>

          <div className="sm:px-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Total Expenses</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalExpenses > 0 ? formatNaira(totalExpenses) : '—'}
            </p>
          </div>

          <div className="sm:px-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Outstanding Debts</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalOutstandingDebts > 0 ? formatNaira(totalOutstandingDebts) : '—'}
            </p>
          </div>

          <div className="sm:px-3 last:pr-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Current Stock</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalStockItems > 0 ? `${totalStockItems} items` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Observant Business Pulse (Auto-advancing insights & actions) */}
      {observantInsights.length > 0 && (
        <BusinessPulseCard
          insights={observantInsights}
          onSelectInsightAction={onSelectInsightAction}
        />
      )}

      {/* 5. Recent Activity Card */}
      <div className="bg-white dark:bg-[#0D1B2A] border border-slate-200/90 dark:border-[#1A2C40] rounded-2xl p-4 sm:p-5 shadow-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-[#1A2C40]/80 mb-3.5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#132B45] text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700/40">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Recent Activity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your latest transactions and updates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('timeline')}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Activity Content */}
        {recentEvents.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#132235] text-slate-400 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">No recent activity yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your transactions and updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentEvents.map((ev, idx) => (
              <div
                key={ev.id || idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-[#091421] border border-slate-200/80 dark:border-[#16273A] text-xs hover:border-slate-300 dark:hover:border-[#223B57] transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                      ev.type === 'SALE'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : ev.type === 'EXPENSE'
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                    }`}
                  >
                    {ev.type === 'SALE' ? '₦' : ev.type === 'EXPENSE' ? '−' : 'D'}
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {ev.headline || ev.productName || ev.type}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {ev.customerName ? `To ${ev.customerName} · ` : ''}
                      {formatDateShort(ev.date || getTodayDateStr())} at {ev.timeStr || ''}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-3 flex items-center space-x-3">
                  <div>
                    {ev.type === 'SALE' && ev.totalRevenue !== undefined && (
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm block">
                        +{formatNaira(ev.totalRevenue)}
                      </span>
                    )}
                    {ev.type === 'EXPENSE' && ev.expenseAmount !== undefined && (
                      <span className="font-mono font-bold text-red-600 dark:text-red-400 text-sm block">
                        −{formatNaira(ev.expenseAmount)}
                      </span>
                    )}
                    {ev.type === 'CUSTOMER_DEBT' && (
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm block">
                        {formatNaira(ev.totalRevenue || 0)} debt
                      </span>
                    )}
                  </div>

                  {onExplainEvent && (
                    <button
                      type="button"
                      onClick={() => onExplainEvent(ev)}
                      className="hidden sm:inline-block text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded bg-slate-200/60 dark:bg-slate-800"
                    >
                      Explain
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. "Need help?" Card */}
      <div className="bg-emerald-50 dark:bg-[#072421] border border-emerald-200/80 dark:border-[#0F443E] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-[#0E3A33] text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Need help?
            </h4>
            <p className="text-xs text-emerald-900/80 dark:text-emerald-200/70 truncate">
              Ask any question or record any business transaction easily.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToTab('questions')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-transparent dark:border dark:border-emerald-500/80 dark:text-emerald-400 dark:hover:text-white dark:hover:bg-emerald-900/60 font-semibold px-4 py-2 rounded-full text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ml-3 shadow-xs"
        >
          <span>Start Chat</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
