import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BusinessPulseItem } from '../types';
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Pause,
  Play,
} from 'lucide-react';

interface BusinessPulseCardProps {
  insights: BusinessPulseItem[];
  onSelectInsightAction?: (actionKey: string, item?: BusinessPulseItem) => void;
}

export const BusinessPulseCard: React.FC<BusinessPulseCardProps> = ({
  insights,
  onSelectInsightAction,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Touch swipe support for smooth mobile interaction
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  const total = insights?.length || 0;

  // Clone first card at end to create seamless continuous infinite slide-in / slide-out
  const extendedInsights = useMemo(() => {
    if (!insights || insights.length === 0) return [];
    if (insights.length === 1) return insights;
    return [...insights, insights[0]];
  }, [insights]);

  // Clamp index if insights list shrinks
  useEffect(() => {
    if (total > 0 && currentIndex >= total) {
      setCurrentIndex(0);
    }
  }, [total, currentIndex]);

  // Auto-advance every 4 seconds (4000ms) with smooth slide transition
  useEffect(() => {
    if (total <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev + 1);
    }, 4000);

    return () => clearInterval(timer);
  }, [total, isPaused]);

  // Seamless wrap-around after transitioning to the cloned first slide
  const handleTransitionEnd = () => {
    if (total > 1 && currentIndex >= total) {
      setIsTransitioning(false);
      setCurrentIndex(0);
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (total <= 1) return;
    if (currentIndex === 0) {
      setIsTransitioning(false);
      setCurrentIndex(total);
      setTimeout(() => {
        setIsTransitioning(true);
        setCurrentIndex(total - 1);
      }, 20);
    } else {
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (total <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleDotClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTransitioning(true);
    setCurrentIndex(idx);
  };

  // Mobile Touch handlers (Swipe left for next, Swipe right for prev)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null) {
      touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
    }
  };

  const handleTouchEnd = () => {
    if (total > 1 && Math.abs(touchDeltaXRef.current) > 40) {
      if (touchDeltaXRef.current < 0) {
        // Swiped left -> next
        handleNext();
      } else {
        // Swiped right -> prev
        handlePrev();
      }
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
    setIsPaused(false);
  };

  if (!insights || insights.length === 0) {
    return null;
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'POSITIVE':
        return <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'OPPORTUNITY':
        return <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'NEUTRAL':
      default:
        return <DollarSign className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getCardBg = (type: string) => {
    switch (type) {
      case 'POSITIVE':
        return 'border-emerald-200/90 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-[#151D2C] hover:border-emerald-300 dark:hover:border-emerald-700';
      case 'WARNING':
        return 'border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/30 dark:to-[#151D2C] hover:border-amber-300 dark:hover:border-amber-700';
      case 'OPPORTUNITY':
        return 'border-blue-200/90 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-[#151D2C] hover:border-blue-300 dark:hover:border-blue-700';
      default:
        return 'border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151D2C] hover:border-slate-300 dark:hover:border-slate-700';
    }
  };

  const activeDotIndex = total > 0 ? currentIndex % total : 0;

  return (
    <div
      className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-slate-950/40 p-3.5 sm:p-5 transition-all select-none w-full max-w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carousel"
      aria-label="Business Pulse & Observant Insights"
    >
      {/* Header bar: Responsive flex layout with wrapping safety for narrow mobile screens */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
            <span>Business Pulse</span>
            <span className="hidden sm:inline"> &amp; Observant Insights</span>
          </h3>
          {total > 1 && (
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full shrink-0">
              {activeDotIndex + 1} / {total}
            </span>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {/* Pause / Resume indicator */}
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
              title={isPaused ? 'Resume auto-sliding (4s)' : 'Pause sliding'}
              aria-label={isPaused ? 'Resume auto-sliding' : 'Pause sliding'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Prev / Next Chevrons (Touch-friendly sizes) */}
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer active:scale-95"
              title="Previous insight"
              aria-label="Previous insight"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer active:scale-95"
              title="Next insight"
              aria-label="Next insight"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Viewport: Shows exactly ONE card at a time with smooth 4s delay slide transition */}
      <div className="relative overflow-hidden w-full rounded-xl">
        <div
          className={`flex ${
            isTransitioning ? 'transition-transform duration-600 ease-in-out' : ''
          }`}
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {extendedInsights.map((item, idx) => (
            <div
              key={item.id ? `${item.id}-${idx}` : `pulse-${idx}`}
              className="w-full shrink-0 min-w-full"
            >
              <div
                className={`p-3.5 sm:p-4 md:p-5 rounded-xl border flex flex-col justify-between shadow-2xs min-h-[145px] sm:min-h-[130px] transition-colors ${getCardBg(
                  item.type
                )}`}
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-1.5 sm:gap-2">
                    <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs shrink-0">
                        {getInsightIcon(item.type)}
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                        {item.title}
                      </h4>
                    </div>

                    {item.metric && (
                      <span className="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 shrink-0 self-start">
                        {item.metric}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed break-words">
                    {item.message}
                  </p>
                </div>

                {item.actionable && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Recommendation
                    </span>
                    <button
                      id={`btn-act-${item.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectInsightAction?.(item.id, item);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-slate-900 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer min-h-[34px]"
                      title={item.actionLabel || `Act on: ${item.title}`}
                    >
                      <span>{item.actionLabel || 'Act'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination indicators (Pills / Dots) with touch-friendly tap targets */}
      {total > 1 && (
        <div className="flex items-center justify-center space-x-1 sm:space-x-1.5 pt-2.5 sm:pt-3">
          {insights.map((_, dotIdx) => (
            <button
              key={`dot-${dotIdx}`}
              type="button"
              onClick={(e) => handleDotClick(dotIdx, e)}
              className="p-1 sm:p-1.5 cursor-pointer flex items-center justify-center"
              title={`Jump to insight ${dotIdx + 1}`}
              aria-label={`Jump to insight ${dotIdx + 1}`}
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  dotIdx === activeDotIndex
                    ? 'w-6 bg-slate-800 dark:bg-slate-200'
                    : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
