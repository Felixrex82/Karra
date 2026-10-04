import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Send,
  Pause,
  Play,
  TrendingUp,
  Receipt,
  UserCheck,
} from 'lucide-react';
import { KarraLogo } from '../KarraLogo';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { AnimatedCounter } from './AnimatedCounter';

interface HeroScenario {
  id: string;
  name: string;
  category: string;
  inputText: string;
  saleLabel: string;
  saleQuantity: string;
  saleAmount: number;
  saleAmountFormatted: string;
  paidAmount: number;
  paidAmountFormatted: string;
  paidDetail: string;
  outstandingAmount: number;
  outstandingAmountFormatted: string;
  debtorName: string;
  debtorDetail: string;
  costAmount: number;
  profitAmount: number;
  profitFormatted: string;
  marginPercent: string;
  systemAction: string;
}

const HERO_SCENARIOS: HeroScenario[] = [
  {
    id: 'fashion',
    name: 'Fashion Atelier',
    category: 'Fashion & Bespoke Tailoring',
    inputText: 'Sold 3 dresses for ₦90,000. Amaka paid ₦60,000.',
    saleLabel: 'SALE',
    saleQuantity: '3 bespoke dresses',
    saleAmount: 90000,
    saleAmountFormatted: '₦90,000',
    paidAmount: 60000,
    paidAmountFormatted: '₦60,000',
    paidDetail: 'Paid via bank transfer',
    outstandingAmount: 30000,
    outstandingAmountFormatted: '₦30,000',
    debtorName: 'Amaka',
    debtorDetail: 'Outstanding balance recorded',
    costAmount: 36000,
    profitAmount: 54000,
    profitFormatted: '+₦54,000',
    marginPercent: '60.0%',
    systemAction: 'Debtor ledger created for Amaka · 1-tap WhatsApp reminder ready',
  },
  {
    id: 'provisions',
    name: 'Provisions Merchant',
    category: 'Wholesale Depot',
    inputText: 'Sold 10 cartons of Indomie for ₦125,000. Iya Basira paid ₦80,000 cash.',
    saleLabel: 'SALE',
    saleQuantity: '10 cartons Indomie Super Pack',
    saleAmount: 125000,
    saleAmountFormatted: '₦125,000',
    paidAmount: 80000,
    paidAmountFormatted: '₦80,000',
    paidDetail: 'Cash in drawer',
    outstandingAmount: 45000,
    outstandingAmountFormatted: '₦45,000',
    debtorName: 'Iya Basira',
    debtorDetail: 'Balance due this Friday',
    costAmount: 105500,
    profitAmount: 19500,
    profitFormatted: '+₦19,500',
    marginPercent: '15.6%',
    systemAction: 'Stock depleted (-10 cartons) · Debtor ledger updated',
  },
  {
    id: 'tech',
    name: 'Gadget Services',
    category: 'Phone & Tech Services',
    inputText: 'Replaced iPhone 13 screen for ₦65,000. Kenneth paid in full via OPay.',
    saleLabel: 'SALE',
    saleQuantity: '1 OLED screen replacement',
    saleAmount: 65000,
    saleAmountFormatted: '₦65,000',
    paidAmount: 65000,
    paidAmountFormatted: '₦65,000',
    paidDetail: 'OPay POS settlement',
    outstandingAmount: 0,
    outstandingAmountFormatted: '₦0',
    debtorName: 'Kenneth',
    debtorDetail: 'Settled in full',
    costAmount: 42000,
    profitAmount: 23000,
    profitFormatted: '+₦23,000',
    marginPercent: '35.4%',
    systemAction: 'Inventory updated (-1 screen unit) · Zero credit balance',
  },
];

export const HeroTransformationDemo: React.FC = () => {
  const prefersReduced = usePrefersReducedMotion();
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const scenario = HERO_SCENARIOS[activeScenarioIdx];

  const [typedChars, setTypedChars] = useState(0);
  const [stage, setStage] = useState<'typing' | 'interpreting' | 'structured'>('typing');
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Restart animation when scenario changes or replay clicked
  const restart = (newIdx = activeScenarioIdx) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveScenarioIdx(newIdx);
    if (prefersReduced) {
      setTypedChars(HERO_SCENARIOS[newIdx].inputText.length);
      setStage('structured');
      return;
    }
    setTypedChars(0);
    setStage('typing');
  };

  useEffect(() => {
    if (prefersReduced) {
      setTypedChars(scenario.inputText.length);
      setStage('structured');
      return;
    }

    if (isPaused) return;

    if (stage === 'typing') {
      if (typedChars < scenario.inputText.length) {
        timerRef.current = setTimeout(() => {
          setTypedChars((prev) => prev + 1);
        }, 32);
      } else {
        // Finished typing -> pause briefly then interpret
        timerRef.current = setTimeout(() => {
          setStage('interpreting');
        }, 450);
      }
    } else if (stage === 'interpreting') {
      timerRef.current = setTimeout(() => {
        setStage('structured');
      }, 700);
    } else if (stage === 'structured') {
      // Hold on structured state for 7 seconds then cycle to next scenario
      timerRef.current = setTimeout(() => {
        const nextIdx = (activeScenarioIdx + 1) % HERO_SCENARIOS.length;
        restart(nextIdx);
      }, 7500);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stage, typedChars, scenario.inputText, isPaused, prefersReduced, activeScenarioIdx]);

  const displayedText = prefersReduced
    ? scenario.inputText
    : scenario.inputText.slice(0, typedChars);

  return (
    <div className="w-full max-w-4xl mx-auto my-8 sm:my-10 text-left">
      {/* Transformation Framework Card */}
      <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0D1424] border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
        {/* Top Bar: Karra Status & Transformation Stepper */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 dark:bg-[#131C30]/80 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2.5">
            <KarraLogo size="sm" variant="green-bg" />
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold tracking-tight text-slate-900 dark:text-white">
                Karra Intelligence Engine
              </span>
              <span className="text-slate-300 dark:text-slate-700 text-xs hidden sm:inline">·</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                {scenario.category}
              </span>
            </div>
          </div>

          {/* Stepper Indicators */}
          <div className="flex items-center space-x-2 text-[11px] font-semibold">
            <div
              className={`flex items-center space-x-1.5 transition-colors ${
                stage === 'typing'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stage === 'typing' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
              <span>Natural Speech</span>
            </div>

            <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-700" />

            <div
              className={`flex items-center space-x-1.5 transition-colors ${
                stage === 'interpreting'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stage === 'interpreting' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
              <span>Understanding</span>
            </div>

            <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-700" />

            <div
              className={`flex items-center space-x-1.5 transition-colors ${
                stage === 'structured'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stage === 'structured' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
              <span>Structured Ledger</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-7 space-y-5">
          {/* Step 1: Realistic Natural Input Component */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-slate-600 dark:text-slate-300 mb-2">
              <span className="flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>You Tell Karra</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-medium normal-case tracking-normal">
                Everyday spoken language
              </span>
            </div>

            <div className="relative rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-[#121A2C] border-2 border-emerald-500/30 dark:border-emerald-500/40 p-3.5 sm:p-4.5 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center space-x-3 w-full min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="font-mono text-xs sm:text-sm md:text-base text-slate-900 dark:text-white font-medium truncate sm:whitespace-normal">
                  <span>&ldquo;{displayedText}&rdquo;</span>
                  {stage === 'typing' && !prefersReduced && (
                    <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-emerald-500 animate-cursor-blink" />
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center space-x-1.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    stage !== 'typing'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Transformation Bridge / Status */}
          {stage === 'interpreting' && (
            <div className="py-2 px-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-semibold">
                  Karra understands: detecting 3 items, ₦60,000 paid transfer, and ₦30,000 customer balance...
                </span>
              </div>
            </div>
          )}

          {/* Step 2: The Structured Business Output (Transformation) */}
          <div
            className={`transition-all duration-500 ${
              stage === 'structured'
                ? 'opacity-100 translate-y-0'
                : 'opacity-40 translate-y-1 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-slate-600 dark:text-slate-300 mb-2.5">
              <span className="flex items-center space-x-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Karra Understands Your Business</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold normal-case tracking-normal">
                Structured & Audit-Ready
              </span>
            </div>

            {/* The Core 3 Business Blocks requested by user: SALE, PAID, OUTSTANDING */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* BLOCK 1: SALE */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    <span>{scenario.saleLabel}</span>
                    <span className="text-slate-600 dark:text-slate-300 normal-case font-medium text-[11px]">
                      {scenario.saleQuantity}
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {stage === 'structured' ? (
                      <AnimatedCounter value={scenario.saleAmount} prefix="₦" trigger={stage === 'structured'} />
                    ) : (
                      scenario.saleAmountFormatted
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Total transaction value
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                  Recorded in daily sales log
                </div>
              </div>

              {/* BLOCK 2: PAID */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/60 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                    <span>PAID</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">
                    {stage === 'structured' ? (
                      <AnimatedCounter value={scenario.paidAmount} prefix="₦" trigger={stage === 'structured'} />
                    ) : (
                      scenario.paidAmountFormatted
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {scenario.paidDetail}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Cash drawer & bank reconciled
                </div>
              </div>

              {/* BLOCK 3: OUTSTANDING */}
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                    <span>OUTSTANDING</span>
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-amber-900 dark:text-amber-300 mt-1">
                    {stage === 'structured' ? (
                      <AnimatedCounter value={scenario.outstandingAmount} prefix="₦" trigger={stage === 'structured'} />
                    ) : (
                      scenario.outstandingAmountFormatted
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    Debtor: {scenario.debtorName}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  {scenario.debtorDetail}
                </div>
              </div>
            </div>

            {/* Bottom Summary Bar: Business Knowledge + WhatsApp Reminder */}
            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-[#121A2C] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium text-[11px] sm:text-xs">
                  {scenario.systemAction}
                </span>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400">Calculated Profit:</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-xs">
                  {scenario.profitFormatted} ({scenario.marginPercent} margin)
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Controls & Scenario Switchers */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mr-1">
                Try other examples:
              </span>
              {HERO_SCENARIOS.map((sc, idx) => (
                <button
                  key={sc.id}
                  onClick={() => restart(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeScenarioIdx === idx
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sc.name}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsPaused((prev) => !prev)}
                className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title={isPaused ? 'Resume auto-play' : 'Pause'}
              >
                {isPaused ? <Play className="w-3 h-3 text-emerald-600" /> : <Pause className="w-3 h-3" />}
                <span className="text-[11px]">{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                type="button"
                onClick={() => restart(activeScenarioIdx)}
                className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 py-1 px-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="text-[11px]">Replay</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
