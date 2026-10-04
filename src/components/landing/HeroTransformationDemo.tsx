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
  Receipt,
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
  paidAmount: number;
  paidDetail: string;
  outstandingAmount: number;
  debtorName: string;
  debtorDetail: string;
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
    paidAmount: 60000,
    paidDetail: 'Paid via bank transfer',
    outstandingAmount: 30000,
    debtorName: 'Amaka',
    debtorDetail: 'Outstanding balance recorded',
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
    paidAmount: 80000,
    paidDetail: 'Cash in drawer',
    outstandingAmount: 45000,
    debtorName: 'Iya Basira',
    debtorDetail: 'Balance due this Friday',
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
    paidAmount: 65000,
    paidDetail: 'OPay POS settlement',
    outstandingAmount: 0,
    debtorName: 'Kenneth',
    debtorDetail: 'Settled in full',
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
  const [runId, setRunId] = useState(0);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Switch or replay scenario smoothly
  const triggerScenario = (idx: number) => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    setActiveScenarioIdx(idx);
    setRunId((prev) => prev + 1);
  };

  useEffect(() => {
    // If reduced motion is preferred, immediately show final state
    if (prefersReduced) {
      setTypedChars(scenario.inputText.length);
      setStage('structured');
      return;
    }

    // Reset to typing start
    setTypedChars(0);
    setStage('typing');

    let currentLength = 0;
    const fullText = scenario.inputText;

    // Smooth, consistent character stream
    const interval = setInterval(() => {
      currentLength += 1;
      setTypedChars(currentLength);

      if (currentLength >= fullText.length) {
        clearInterval(interval);
        // Pause briefly after finishing typing, then enter interpreting phase
        stageTimerRef.current = setTimeout(() => {
          setStage('interpreting');
          // Short understanding pulse, then reveal structured data
          stageTimerRef.current = setTimeout(() => {
            setStage('structured');
          }, 600);
        }, 350);
      }
    }, 28);

    typingTimerRef.current = interval;

    return () => {
      clearInterval(interval);
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    };
  }, [runId, activeScenarioIdx, scenario.inputText, prefersReduced]);

  const displayedText = prefersReduced
    ? scenario.inputText
    : scenario.inputText.slice(0, typedChars);

  return (
    <div className="w-full max-w-4xl mx-auto my-7 sm:my-9 text-left">
      {/* Transformation Framework Card with Fixed Geometry to Prevent Layout Shifting */}
      <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0D1424] border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
        {/* Top Header: Karra Identity & Transformation Stepper */}
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

          {/* Stepper Indicators with Stable Layout */}
          <div className="flex items-center space-x-2 text-[11px] font-semibold">
            <div
              className={`flex items-center space-x-1.5 transition-colors ${
                stage === 'typing'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  stage === 'typing' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
              <span>1. Natural Speech</span>
            </div>

            <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" />

            <div
              className={`flex items-center space-x-1.5 transition-colors ${
                stage === 'interpreting'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  stage === 'interpreting' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
              <span>2. Understanding</span>
            </div>

            <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" />

            <div
              className={`flex items-center space-x-1.5 transition-colors ${
                stage === 'structured'
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  stage === 'structured' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
              <span>3. Structured Ledger</span>
            </div>
          </div>
        </div>

        {/* Content Body with Stable Heights */}
        <div className="p-4 sm:p-6 space-y-4">
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

            {/* Input Box with Fixed Minimum Height to Guarantee Zero Content Shift */}
            <div className="relative rounded-xl bg-slate-50 dark:bg-[#121A2C] border-2 border-emerald-500/30 dark:border-emerald-500/40 p-3 sm:p-4 min-h-[68px] sm:min-h-[64px] flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center space-x-3 w-full min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="font-mono text-xs sm:text-sm text-slate-900 dark:text-white font-medium break-words leading-relaxed w-full">
                  <span>&ldquo;{displayedText}&rdquo;</span>
                  {stage === 'typing' && !prefersReduced && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 align-middle bg-emerald-500 animate-cursor-blink" />
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

          {/* Reserved Status Line: Smooth crossfade without layout shift */}
          <div className="h-6 flex items-center px-1">
            {stage === 'interpreting' ? (
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 animate-in fade-in duration-200">
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>
                  Karra understands: extracting items, payment mode, and customer balance...
                </span>
              </div>
            ) : stage === 'structured' ? (
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 animate-in fade-in duration-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Transaction parsed and reconciled into business ledger</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">
                Listening to natural transaction details...
              </span>
            )}
          </div>

          {/* Step 2: The Structured Business Output (Transformation) */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-slate-600 dark:text-slate-300 mb-2">
              <span className="flex items-center space-x-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Karra Understands Your Business</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold normal-case tracking-normal">
                Structured & Audit-Ready
              </span>
            </div>

            {/* The Core 3 Business Blocks: SALE, PAID, OUTSTANDING */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* BLOCK 1: SALE */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between min-h-[125px]">
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
                      <span className="text-slate-300 dark:text-slate-600 font-normal">₦ — — —</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Total transaction value
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  Recorded in daily sales log
                </div>
              </div>

              {/* BLOCK 2: PAID */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/60 shadow-xs flex flex-col justify-between min-h-[125px]">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                    <span>PAID</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">
                    {stage === 'structured' ? (
                      <AnimatedCounter value={scenario.paidAmount} prefix="₦" trigger={stage === 'structured'} />
                    ) : (
                      <span className="text-emerald-300 dark:text-emerald-900/60 font-normal">₦ — — —</span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {stage === 'structured' ? scenario.paidDetail : 'Payment channel detected'}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Cash drawer & bank reconciled
                </div>
              </div>

              {/* BLOCK 3: OUTSTANDING */}
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 shadow-xs flex flex-col justify-between min-h-[125px]">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                    <span>OUTSTANDING</span>
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-amber-900 dark:text-amber-300 mt-1">
                    {stage === 'structured' ? (
                      <AnimatedCounter value={scenario.outstandingAmount} prefix="₦" trigger={stage === 'structured'} />
                    ) : (
                      <span className="text-amber-300 dark:text-amber-900/60 font-normal">₦ — — —</span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    {stage === 'structured' ? `Debtor: ${scenario.debtorName}` : 'Customer credit'}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  {stage === 'structured' ? scenario.debtorDetail : 'Auto debtor reminder'}
                </div>
              </div>
            </div>

            {/* Bottom Summary Bar: Business Knowledge + WhatsApp Reminder */}
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-[#121A2C] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium text-[11px] sm:text-xs">
                  {stage === 'structured' ? scenario.systemAction : 'Karra Ledger Engine active'}
                </span>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400">Calculated Profit:</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-xs">
                  {stage === 'structured' ? (
                    `${scenario.profitFormatted} (${scenario.marginPercent} margin)`
                  ) : (
                    'Calculating...'
                  )}
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
                  type="button"
                  onClick={() => triggerScenario(idx)}
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
                onClick={() => triggerScenario(activeScenarioIdx)}
                className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 py-1 px-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors"
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
