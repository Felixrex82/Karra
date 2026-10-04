import React, { useState, useEffect, useRef } from 'react';
import {
  BrainCircuit,
  Database,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  TrendingUp,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Play,
  Pause,
} from 'lucide-react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useInView } from './useInView';
import { AnimatedCounter } from './AnimatedCounter';

const PHASES = [
  {
    id: 'learn',
    step: 1,
    title: 'LEARN',
    kicker: 'You State Once',
    desc: 'You mention how much stock or supplies cost you.',
  },
  {
    id: 'remember',
    step: 2,
    title: 'REMEMBER',
    kicker: 'Karra Retains',
    desc: 'Saved into permanent business memory with local unit ratios.',
  },
  {
    id: 'understand',
    step: 3,
    title: 'UNDERSTAND',
    kicker: 'Later That Week',
    desc: 'You log a quick sale without repeating costs.',
  },
  {
    id: 'calculate',
    step: 4,
    title: 'CALCULATE',
    kicker: 'Instant True Margin',
    desc: 'Karra pulls the remembered cost to show true take-home profit.',
  },
];

export const MemoryAnimationSection: React.FC = () => {
  const prefersReduced = usePrefersReducedMotion();
  const { ref: containerRef, isInView } = useInView({ threshold: 0.2 });
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (prefersReduced || isPaused || !isInView) return;

    timerRef.current = setTimeout(() => {
      setActivePhaseIndex((prev) => (prev + 1) % PHASES.length);
    }, 3200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activePhaseIndex, isPaused, isInView, prefersReduced]);

  const activePhase = PHASES[activePhaseIndex];

  return (
    <section id="memory" ref={containerRef} className="py-16 sm:py-24 bg-slate-50 dark:bg-[#080D17] border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">
            <BrainCircuit className="w-4 h-4" />
            <span>Autonomous Business Memory</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Karra remembers what you buy, so you never have to re-enter costs.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Tell Karra once what a bag, roll, carton, or batch cost. Days or weeks later, Karra uses that knowledge to compute your exact margin on every sale.
          </p>
        </div>

        {/* Visual Pipeline Banner: LEARN -> REMEMBER -> UNDERSTAND -> CALCULATE */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-8">
          {PHASES.map((phase, idx) => {
            const isActive = activePhaseIndex === idx;
            const isPassed = activePhaseIndex > idx;

            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  setActivePhaseIndex(idx);
                }}
                className={`p-3.5 rounded-xl sm:rounded-2xl border text-left transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#131C30] border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                    : 'bg-white/60 dark:bg-[#0D1424]/60 border-slate-200 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-extrabold tracking-wider uppercase mb-1">
                  <span className={isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                    PHASE 0{phase.step}
                  </span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                </div>

                <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {phase.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  {phase.kicker}
                </p>
              </button>
            );
          })}
        </div>

        {/* Memory Demonstration Canvas */}
        <div className="bg-white dark:bg-[#101726] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Phase 1 & 2 - Learning & Remembering */}
            <div className={`lg:col-span-6 p-5 sm:p-6 rounded-2xl border transition-all duration-300 space-y-4 ${
              activePhaseIndex <= 1
                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600 shadow-sm'
                : 'bg-slate-50 dark:bg-[#141E32]/70 border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step 1 & 2: Cost Learning
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                  Business Memory
                </span>
              </div>

              {/* User Statement */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  You said earlier:
                </span>
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#18233C] border border-slate-200 dark:border-slate-700 font-mono text-xs sm:text-sm text-slate-900 dark:text-white font-medium">
                  &ldquo;One bag of rice costs me ₦59,000.&rdquo;
                </div>
              </div>

              {/* Memory Confirmation */}
              <div className="p-3 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-extrabold">
                  Karra learned this:
                </span>
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  Mama Gold Rice · ₦59,000 / 45-bowl bag (₦1,311/bowl cost)
                </span>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                Saved in persistent memory vault. Unit conversions (bags &rarr; bowls &rarr; plates) are linked automatically.
              </div>
            </div>

            {/* Right: Phase 3 & 4 - Understanding & Calculating Later */}
            <div className={`lg:col-span-6 p-5 sm:p-6 rounded-2xl border transition-all duration-300 space-y-4 ${
              activePhaseIndex >= 2
                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600 shadow-sm'
                : 'bg-slate-50 dark:bg-[#141E32]/70 border-slate-200 dark:border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step 3 & 4: Retrieval & Calculation
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                  Two Weeks Later
                </span>
              </div>

              {/* User Sale Statement */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  You log a quick sale:
                </span>
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#18233C] border border-slate-200 dark:border-slate-700 font-mono text-xs sm:text-sm text-slate-900 dark:text-white font-medium">
                  &ldquo;I sold 10 bowls of rice for ₦25,000.&rdquo;
                </div>
              </div>

              {/* Automatic Calculation Breakdown */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#18233C] border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Revenue Received</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">₦25,000</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-[11px]">
                  <span>Retrieved Cost (10 bowls × ₦1,311)</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">-₦13,110</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">True Take-Home Profit</span>
                  <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                    +₦11,890 <span className="text-xs font-semibold">(47.6%)</span>
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                You never had to re-type the supplier, unit cost, or do the division. Karra connected the dots.
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Works for fabrics, raw ingredients, wholesale cartons, repair parts, and workshop materials.
            </span>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsPaused((prev) => !prev)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center space-x-1 cursor-pointer py-1 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isPaused ? <Play className="w-3 h-3 text-emerald-600" /> : <Pause className="w-3 h-3" />}
                <span className="text-[11px]">{isPaused ? 'Resume' : 'Pause'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
