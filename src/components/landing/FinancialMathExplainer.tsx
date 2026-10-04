import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Minus,
  Equal,
  RotateCcw,
  CheckCircle2,
  PieChart,
  BarChart3,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useInView } from './useInView';
import { AnimatedCounter } from './AnimatedCounter';

export const FinancialMathExplainer: React.FC = () => {
  const prefersReduced = usePrefersReducedMotion();
  const { ref: containerRef, isInView } = useInView({ threshold: 0.25 });

  // Deterministic demonstration numbers (purely explaining the interface)
  const REVENUE = 480000;
  const COSTS = 210000;
  const EXPENSES = 55000;
  const PROFIT = REVENUE - COSTS - EXPENSES; // 215,000
  const MARGIN = ((PROFIT / REVENUE) * 100).toFixed(1); // 44.8%

  // Build steps: 0 = idle, 1 = revenue, 2 = costs, 3 = expenses, 4 = calculated profit
  const [step, setStep] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (prefersReduced) {
      setStep(4);
      return;
    }
    setStep(1);
    timerRef.current = setTimeout(() => {
      setStep(2);
      timerRef.current = setTimeout(() => {
        setStep(3);
        timerRef.current = setTimeout(() => {
          setStep(4);
        }, 650);
      }, 650);
    }, 650);
  };

  useEffect(() => {
    if (isInView && step === 0) {
      startAnimation();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isInView, prefersReduced]);

  return (
    <div
      ref={containerRef}
      className="mt-10 p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-white dark:bg-[#121A2C] border border-slate-200 dark:border-slate-800 shadow-lg text-left"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Deterministic Profit Calculation Flow
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Demonstration of Karra's internal ledger subtraction model
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={startAnimation}
          className="self-start sm:self-auto text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center space-x-1.5 py-1 px-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/60 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Replay Math Breakdown</span>
        </button>
      </div>

      {/* Visual Proportional Fill Bar */}
      <div className="mt-6 mb-8">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
          <span>Total Trading Volume (100%)</span>
          <span className="text-slate-900 dark:text-white font-extrabold">₦{REVENUE.toLocaleString()}</span>
        </div>

        <div className="h-6 w-full rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-inner">
          {/* Revenue base fill */}
          {step >= 1 && (
            <div
              style={{
                width: step >= 2 ? `${((PROFIT / REVENUE) * 100).toFixed(0)}%` : '100%',
                transition: prefersReduced ? 'none' : 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="h-full bg-emerald-500 flex items-center justify-center text-[10px] font-extrabold text-white px-2 truncate"
              title="Net Profit"
            >
              {step >= 4 ? `Profit ${MARGIN}%` : 'Gross Revenue'}
            </div>
          )}

          {/* Direct Costs fill */}
          {step >= 2 && (
            <div
              style={{
                width: `${((COSTS / REVENUE) * 100).toFixed(0)}%`,
                transition: prefersReduced ? 'none' : 'all 0.6s ease',
              }}
              className="h-full bg-slate-400 dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-white px-2 truncate"
              title="Direct Costs"
            >
              Cost Basis (43.8%)
            </div>
          )}

          {/* Expenses fill */}
          {step >= 3 && (
            <div
              style={{
                width: `${((EXPENSES / REVENUE) * 100).toFixed(0)}%`,
                transition: prefersReduced ? 'none' : 'all 0.6s ease',
              }}
              className="h-full bg-amber-400 dark:bg-amber-500 flex items-center justify-center text-[10px] font-bold text-slate-900 px-2 truncate"
              title="Shop Expenses"
            >
              Expenses (11.4%)
            </div>
          )}
        </div>
      </div>

      {/* Sequential Formula Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-center">
        {/* 1. Revenue */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            step >= 1
              ? 'bg-slate-50 dark:bg-[#162238] border-slate-300 dark:border-slate-700 opacity-100 translate-y-0'
              : 'opacity-30 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <span>Step 1</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Inflow</span>
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
            Total Sales Revenue
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {step >= 1 ? (
              <AnimatedCounter value={REVENUE} prefix="₦" trigger={step >= 1} />
            ) : (
              '₦480,000'
            )}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">All sales logged today</p>
        </div>

        {/* 2. Costs */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            step >= 2
              ? 'bg-slate-50 dark:bg-[#162238] border-slate-300 dark:border-slate-700 opacity-100 translate-y-0'
              : 'opacity-30 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <span>Step 2</span>
            <span className="text-slate-500 font-bold">Deduction</span>
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
            Cost of Goods (Supplies)
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-1">
            {step >= 2 ? (
              <AnimatedCounter value={COSTS} prefix="-₦" trigger={step >= 2} />
            ) : (
              '-₦210,000'
            )}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Fabrics, stock, parts</p>
        </div>

        {/* 3. Expenses */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            step >= 3
              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/80 opacity-100 translate-y-0'
              : 'opacity-30 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <span>Step 3</span>
            <span className="font-bold">Overhead</span>
          </div>
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-1">
            Operating Expenses
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-amber-900 dark:text-amber-300 mt-1">
            {step >= 3 ? (
              <AnimatedCounter value={EXPENSES} prefix="-₦" trigger={step >= 3} />
            ) : (
              '-₦55,000'
            )}
          </p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">Generator fuel & logistics</p>
        </div>

        {/* 4. Profit Result */}
        <div
          className={`p-4 rounded-xl border-2 transition-all duration-300 ${
            step >= 4
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-md opacity-100 scale-102'
              : 'opacity-30 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <span>Step 4</span>
            <span className="font-bold">True Take-Home</span>
          </div>
          <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mt-1">
            Real Net Profit
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            {step >= 4 ? (
              <AnimatedCounter value={PROFIT} prefix="₦" trigger={step >= 4} />
            ) : (
              '₦215,000'
            )}
          </p>
          <p className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
            {MARGIN}% Real Net Margin
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">
          Revenue (₦480k) &minus; Costs (₦210k) &minus; Expenses (₦55k) = ₦215,000 True Profit
        </span>
        <span className="text-emerald-700 dark:text-emerald-400 font-bold hidden sm:inline">
          Audit-Clean Subtraction
        </span>
      </div>
    </div>
  );
};
