import React, { useState } from 'react';
import {
  TrendingUp,
  Receipt,
  Users,
  Calendar,
  Activity,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { KarraLogo } from '../KarraLogo';
import { useInView } from './useInView';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { AnimatedCounter } from './AnimatedCounter';

export const DashboardPreviewMockup: React.FC = () => {
  const prefersReduced = usePrefersReducedMotion();
  const { ref, isInView } = useInView({ threshold: 0.15 });

  const [selectedDay, setSelectedDay] = useState<number>(3); // Wednesday

  const days = [
    { label: 'M', day: 'Mon', num: '14', profit: 45000, hasEvent: true },
    { label: 'T', day: 'Tue', num: '15', profit: 32000, hasEvent: true },
    { label: 'W', day: 'Wed', num: '16', profit: 64500, hasEvent: true, active: true },
    { label: 'T', day: 'Thu', num: '17', profit: 51000, hasEvent: true },
    { label: 'F', day: 'Fri', num: '18', profit: 98000, hasEvent: true },
    { label: 'S', day: 'Sat', num: '19', profit: 120000, hasEvent: true },
    { label: 'S', day: 'Sun', num: '20', profit: 0, hasEvent: false },
  ];

  return (
    <section className="py-16 sm:py-24 bg-white dark:bg-[#0B111E] border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">
            <Activity className="w-4 h-4" />
            <span>Interactive Workspace Preview</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            See your entire business at a glance.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Every transaction logged in natural language immediately populates your daily summary card, cash drawer reconciliation, and debtor ledger.
          </p>
        </div>

        {/* The Dashboard Mockup Card with Viewport-Triggered Entrance */}
        <div
          ref={ref}
          className={`rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-xl transition-all duration-700 ${
            isInView || prefersReduced
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-6 scale-[0.98]'
          }`}
        >
          {/* Top Bar of the Mockup */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <KarraLogo size="sm" variant="green-bg" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Karra Daily Business Summary
                  </span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 font-bold px-2 py-0.5 rounded-full">
                    Live Ledger
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Wednesday Trading Session · Lagos, Nigeria
                </p>
              </div>
            </div>

            {/* Interactive Calendar Strip */}
            <div className="flex items-center space-x-1 bg-white dark:bg-[#162238] p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs self-start sm:self-auto">
              {days.map((d, idx) => (
                <button
                  key={d.num}
                  type="button"
                  onClick={() => setSelectedDay(idx)}
                  className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                    selectedDay === idx
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold opacity-80">{d.label}</span>
                  <span className="font-extrabold text-xs">{d.num}</span>
                  {d.hasEvent && (
                    <span
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        selectedDay === idx ? 'bg-white' : 'bg-emerald-500'
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 4 Primary KPI Cards with upward counting numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-6">
            {/* Net Profit */}
            <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
              <div className="flex items-center justify-between text-[10px] uppercase font-extrabold text-emerald-700 dark:text-emerald-400 tracking-wider">
                <span>Today's Net Profit</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">
                <AnimatedCounter value={64500} prefix="₦" trigger={isInView} />
              </div>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                44.5% Profit Margin
              </p>
            </div>

            {/* Total Inflow */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <div className="flex items-center justify-between text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                <span>Total Cash Inflow</span>
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                <AnimatedCounter value={145000} prefix="₦" trigger={isInView} />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Cash & bank deposits
              </p>
            </div>

            {/* Debtor Receivables */}
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 shadow-xs">
              <div className="flex items-center justify-between text-[10px] uppercase font-extrabold text-amber-700 dark:text-amber-400 tracking-wider">
                <span>Uncollected Credit</span>
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-amber-900 dark:text-amber-300 mt-1">
                <AnimatedCounter value={30000} prefix="₦" trigger={isInView} />
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                1 debtor pending (Amaka)
              </p>
            </div>

            {/* Direct Materials Cost */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <div className="flex items-center justify-between text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                <span>Materials & Supplies</span>
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-700 dark:text-slate-300 mt-1">
                <AnimatedCounter value={50500} prefix="₦" trigger={isInView} />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Auto-deducted from cost basis
              </p>
            </div>
          </div>

          {/* Staggered Recent Transactions Stream */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              <span>Today's Natural Language Activity Feed</span>
              <span className="text-emerald-600 dark:text-emerald-400 normal-case font-semibold">
                Auto-balanced
              </span>
            </div>

            {/* Row 1 - Stagger 0ms */}
            <div
              className={`p-3.5 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs transition-all duration-500 ${
                isInView || prefersReduced
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Sold 3 bespoke dresses to Amaka (₦90,000)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Paid ₦60,000 transfer · Balance ₦30,000 due next Friday
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                  +₦54,000 True Profit
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                  ₦30,000 Credit Tracked
                </p>
              </div>
            </div>

            {/* Row 2 - Stagger 80ms */}
            <div
              style={{ transitionDelay: prefersReduced ? '0ms' : '80ms' }}
              className={`p-3.5 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs transition-all duration-500 ${
                isInView || prefersReduced
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Bought 2 cartons fabric lining & thread
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Paid ₦24,000 cash from drawer · Unit cost updated
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs sm:text-sm font-extrabold text-slate-700 dark:text-slate-300">
                  -₦24,000 Cost Outflow
                </p>
                <p className="text-[10px] text-slate-400">
                  Stock logged to inventory
                </p>
              </div>
            </div>

            {/* Row 3 - Stagger 160ms */}
            <div
              style={{ transitionDelay: prefersReduced ? '0ms' : '160ms' }}
              className={`p-3.5 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs transition-all duration-500 ${
                isInView || prefersReduced
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-3'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    OPay POS settlement from yesterday evening
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ₦45,000 received into Moniepoint business account
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                  ₦45,000 Bank Cleared
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Reconciled with daily card
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
