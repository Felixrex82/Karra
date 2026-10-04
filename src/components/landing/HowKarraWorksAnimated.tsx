import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Sparkles,
  Database,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  RotateCcw,
  Package,
  Layers,
  Receipt,
  ShieldCheck,
  Play,
  Pause,
} from 'lucide-react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useInView } from './useInView';

interface StepData {
  step: number;
  label: string;
  tagline: string;
  icon: React.ElementType;
}

const STEPS: StepData[] = [
  {
    step: 1,
    label: 'You talk',
    tagline: 'Speak naturally or type in ordinary words',
    icon: MessageSquare,
  },
  {
    step: 2,
    label: 'Karra understands',
    tagline: 'Entities, amounts, supplier & quantities extracted',
    icon: Sparkles,
  },
  {
    step: 3,
    label: 'Karra records',
    tagline: 'Stock counted, unit costs computed & cash flow logged',
    icon: Database,
  },
  {
    step: 4,
    label: 'You know',
    tagline: 'Instant business status & audit-clean clarity',
    icon: CheckCircle2,
  },
];

export const HowKarraWorksAnimated: React.FC = () => {
  const prefersReduced = usePrefersReducedMotion();
  const { ref: containerRef, isInView } = useInView({ threshold: 0.2 });
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (prefersReduced || isPaused || !isInView) return;

    timerRef.current = setTimeout(() => {
      setActiveStep((prev) => (prev >= 4 ? 1 : prev + 1));
    }, 2800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeStep, isPaused, isInView, prefersReduced]);

  const handleSelectStep = (stepNumber: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveStep(stepNumber);
  };

  return (
    <div ref={containerRef} className="w-full">
      {/* Step Selector Header / Navigation Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {STEPS.map((s) => {
          const isActive = activeStep === s.step;
          const isPassed = activeStep > s.step;
          const Icon = s.icon;

          return (
            <button
              key={s.step}
              type="button"
              onClick={() => handleSelectStep(s.step)}
              className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#131C30] border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-slate-50/70 dark:bg-[#0D1424] border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : isPassed
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {s.step}
                </span>

                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
              </div>

              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                STEP {s.step}
              </p>
              <p
                className={`text-xs font-extrabold mt-0.5 transition-colors ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {s.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage Visualization */}
      <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-lg">
        {/* Timeline connector visual */}
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pb-4 border-b border-slate-100 dark:border-slate-800">
          <span className="font-extrabold tracking-wider uppercase text-[10px] text-emerald-700 dark:text-emerald-400">
            Real-Time Processing Pipeline
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

        {/* The 4 Connected Pipeline Stages */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          {/* STAGE 1: You talk */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
              activeStep === 1
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                : activeStep > 1
                ? 'bg-slate-50 dark:bg-[#131C30]/50 border-slate-200 dark:border-slate-800 opacity-90'
                : 'bg-slate-50/40 dark:bg-[#131C30]/20 border-slate-100 dark:border-slate-800/40 opacity-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                <span>STEP 1 · You talk</span>
                {activeStep === 1 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#162238] border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-900 dark:text-white leading-relaxed shadow-xs">
                &ldquo;Bought 30 cartons from Musa at ₦12,000 each.&rdquo;
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              Natural voice or quick typing in daily Nigerian market units.
            </div>
          </div>

          {/* STAGE 2: Karra understands */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
              activeStep === 2
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                : activeStep > 2
                ? 'bg-slate-50 dark:bg-[#131C30]/50 border-slate-200 dark:border-slate-800 opacity-90'
                : 'bg-slate-50/40 dark:bg-[#131C30]/20 border-slate-100 dark:border-slate-800/40 opacity-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                <span>STEP 2 · Karra understands</span>
                {activeStep === 2 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>

              <div className="space-y-1.5 p-3 rounded-xl bg-white dark:bg-[#162238] border border-slate-200/80 dark:border-slate-700 text-xs shadow-xs">
                <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Item:</span>
                  <span className="font-bold text-slate-900 dark:text-white">Cartons</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Quantity:</span>
                  <span className="font-bold text-slate-900 dark:text-white">30</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Supplier:</span>
                  <span className="font-bold text-slate-900 dark:text-white">Musa</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500 dark:text-slate-400">Unit cost:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">₦12,000</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              Autonomous extraction without rigid form dropdowns.
            </div>
          </div>

          {/* STAGE 3: Karra records */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
              activeStep === 3
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                : activeStep > 3
                ? 'bg-slate-50 dark:bg-[#131C30]/50 border-slate-200 dark:border-slate-800 opacity-90'
                : 'bg-slate-50/40 dark:bg-[#131C30]/20 border-slate-100 dark:border-slate-800/40 opacity-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                <span>STEP 3 · Karra records</span>
                {activeStep === 3 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#162238] border border-slate-200/80 dark:border-slate-700 space-y-2 shadow-xs text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Inventory</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                    +30
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Purchase cost</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    ₦360,000
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  (30 × ₦12,000 = ₦360,000)
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              Debits cash, logs cost basis, updates Musa's supplier ledger.
            </div>
          </div>

          {/* STAGE 4: You know */}
          <div
            className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
              activeStep === 4
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                : 'bg-slate-50/40 dark:bg-[#131C30]/20 border-slate-100 dark:border-slate-800/40 opacity-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                <span>STEP 4 · You know</span>
                {activeStep === 4 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-600 text-white shadow-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-extrabold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span>&ldquo;Stock updated.&rdquo;</span>
                </div>
                <p className="text-[11px] text-emerald-100 pt-1">
                  Ready for future sales: Karra will automatically use ₦12,000 cost basis to compute your true profit margin on every carton sold.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              Zero manual recalculation required.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
