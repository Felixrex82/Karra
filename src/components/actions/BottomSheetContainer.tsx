import React, { useState, useEffect, useRef } from 'react';
import { X, Minus, AlertTriangle } from 'lucide-react';

export type SheetSnapPoint = 'half' | 'expanded';

interface BottomSheetContainerProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  title: string;
  subtitle?: string;
  isDirty?: boolean;
  children: React.ReactNode;
}

export const BottomSheetContainer: React.FC<BottomSheetContainerProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onMinimize,
  onExpand,
  title,
  subtitle,
  isDirty = false,
  children,
}) => {
  const [snapPoint, setSnapPoint] = useState<SheetSnapPoint>('half');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync snap point with onExpand or onMinimize
  useEffect(() => {
    if (isOpen && !isMinimized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isMinimized]);

  if (!isOpen || isMinimized) {
    return null;
  }

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  // Touch drag gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    currentYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (startYRef.current === null || currentYRef.current === null) {
      startYRef.current = null;
      currentYRef.current = null;
      return;
    }

    const deltaY = currentYRef.current - startYRef.current;
    // Dragged down significantly
    if (deltaY > 120) {
      if (snapPoint === 'expanded') {
        setSnapPoint('half');
      } else {
        // Minimize to draft bar
        onMinimize();
      }
    } else if (deltaY < -60) {
      // Dragged up
      setSnapPoint('expanded');
      onExpand();
    }

    startYRef.current = null;
    currentYRef.current = null;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleRequestClose}
        className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Bottom Sheet Modal */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl bg-white dark:bg-[#0B1522] border-t border-x border-slate-200/90 dark:border-[#182B3E] rounded-t-3xl shadow-2xl flex flex-col transition-all duration-300 ease-out animate-in slide-in-from-bottom duration-300 ${
          snapPoint === 'expanded'
            ? 'h-[92vh] max-h-[92vh]'
            : 'h-[85vh] sm:h-auto sm:max-h-[85vh] sm:min-h-[50vh]'
        }`}
        style={{
          boxShadow: '0 -10px 40px -10px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Top Drag Handle Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="pt-3 pb-2 px-5 cursor-grab active:cursor-grabbing select-none shrink-0"
        >
          {/* Visual pill handle */}
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors" />

          {/* Sheet Top Bar */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="min-w-0 pr-3">
              <h2
                id="bottom-sheet-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              {/* Expand / Collapse toggle button */}
              <button
                type="button"
                onClick={() => setSnapPoint((prev) => (prev === 'half' ? 'expanded' : 'half'))}
                title={snapPoint === 'half' ? 'Expand form' : 'Collapse form'}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer hidden sm:flex items-center justify-center"
              >
                <span className="text-[11px] font-semibold px-1">
                  {snapPoint === 'half' ? 'Expand ↑' : 'Compact ↓'}
                </span>
              </button>

              {/* Minimize to draft button */}
              <button
                type="button"
                onClick={onMinimize}
                title="Minimize as Draft"
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={handleRequestClose}
                title="Close"
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 sm:pb-8 pt-1 overscroll-contain">
          {children}
        </div>
      </div>

      {/* Discard Draft Confirmation Prompt */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0E1A29] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Discard this draft?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              You have entered information in this form. If you discard now, your entered details will be lost.
            </p>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer text-center shadow-md active:scale-95"
              >
                Discard Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
