import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquarePlus, GripVertical, Sparkles } from 'lucide-react';

interface FloatingFeedbackBalloonProps {
  onOpenFeedback: () => void;
  businessName?: string;
}

const STORAGE_KEY = 'karra_feedback_balloon_pos_v1';

export const FloatingFeedbackBalloon: React.FC<FloatingFeedbackBalloonProps> = ({
  onOpenFeedback,
}) => {
  const balloonRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // References for dragging logic
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);

  // Initialize or restore position
  useEffect(() => {
    const updateInitialPosition = () => {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      // Check saved position
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            typeof parsed.x === 'number' &&
            typeof parsed.y === 'number' &&
            parsed.x >= 0 &&
            parsed.x <= screenW - 60 &&
            parsed.y >= 0 &&
            parsed.y <= screenH - 60
          ) {
            setPosition(parsed);
            return;
          }
        }
      } catch {}

      // Default initial position: Bottom right corner, above mobile dock
      const defaultWidth = 140;
      const defaultHeight = 48;
      const initialX = Math.max(16, screenW - defaultWidth - 24);
      const initialY = Math.max(80, screenH - defaultHeight - 96);

      setPosition({ x: initialX, y: initialY });
    };

    updateInitialPosition();

    // Adjust position on window resize so balloon never gets trapped outside viewport
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const balloonW = balloonRef.current?.offsetWidth || 140;
        const balloonH = balloonRef.current?.offsetHeight || 48;

        const clampedX = Math.min(Math.max(12, prev.x), Math.max(12, screenW - balloonW - 12));
        const clampedY = Math.min(Math.max(12, prev.y), Math.max(12, screenH - balloonH - 12));
        return { x: clampedX, y: clampedY };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save position when updated
  const savePosition = useCallback((pos: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {}
  }, []);

  // Pointer Down (Mouse & Touch via PointerEvents)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to main click / touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (!position) return;

    // Capture pointer on this element for seamless dragging even when leaving boundaries
    e.currentTarget.setPointerCapture(e.pointerId);

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: position.x,
      startY: position.y,
      hasMoved: false,
    };

    setIsDragging(true);
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.pointerX;
    const deltaY = e.clientY - dragStartRef.current.pointerY;

    // Threshold check (5px) to differentiate click from drag
    if (Math.hypot(deltaX, deltaY) > 5) {
      dragStartRef.current.hasMoved = true;
    }

    if (!dragStartRef.current.hasMoved) return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const balloonW = balloonRef.current?.offsetWidth || 140;
    const balloonH = balloonRef.current?.offsetHeight || 48;

    const rawX = dragStartRef.current.startX + deltaX;
    const rawY = dragStartRef.current.startY + deltaY;

    // Clamp inside viewport
    const clampedX = Math.min(Math.max(10, rawX), Math.max(10, screenW - balloonW - 10));
    const clampedY = Math.min(Math.max(10, rawY), Math.max(10, screenH - balloonH - 10));

    setPosition({ x: clampedX, y: clampedY });
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const hasMoved = dragStartRef.current.hasMoved;
    const currentPos = position;

    dragStartRef.current = null;
    setIsDragging(false);

    if (hasMoved) {
      // Save new position
      if (currentPos) {
        savePosition(currentPos);
      }
    } else {
      // It was a tap / click! Open feedback overlay
      onOpenFeedback();
    }
  };

  // Keyboard support for accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenFeedback();
    }
  };

  if (!position) return null;

  return (
    <div
      ref={balloonRef}
      role="button"
      tabIndex={0}
      aria-label="Feedback Balloon. Drag to any position, click to open feedback form."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: 'none',
      }}
      className={`fixed top-0 left-0 z-40 select-none cursor-grab active:cursor-grabbing transition-shadow duration-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 group ${
        isDragging ? 'opacity-95 scale-105' : 'hover:scale-102 active:scale-98'
      }`}
    >
      {/* Balloon Bubble Body */}
      <div className="relative flex items-center space-x-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg hover:shadow-xl shadow-emerald-950/20 border border-emerald-400/40 backdrop-blur-md">
        
        {/* Subtle Grip Handle indicator */}
        <div className="text-emerald-200/70 -ml-1 flex items-center pointer-events-none" title="Drag me">
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Balloon Icon */}
        <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white shadow-inner shrink-0">
          <MessageSquarePlus className="w-4 h-4 text-white" />
          {/* Subtle live indicator pulse */}
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
        </div>

        {/* Balloon Label */}
        <div className="flex flex-col text-left pr-1">
          <div className="flex items-center space-x-1">
            <span className="text-xs font-bold tracking-tight text-white leading-none">
              Feedback
            </span>
            <Sparkles className="w-2.5 h-2.5 text-amber-300 animate-pulse" />
          </div>
          <span className="text-[9px] font-medium text-emerald-100/90 leading-tight">
            Share Thoughts
          </span>
        </div>

        {/* Balloon speech tail decorative triangle */}
        <div className="absolute -bottom-1.5 left-7 w-3 h-3 bg-teal-800 rotate-45 border-r border-b border-emerald-400/40 pointer-events-none" />
      </div>

      {/* Hover Tooltip / Hint */}
      {isHovered && !isDragging && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-900/90 dark:bg-slate-800 text-white text-[10px] font-medium rounded-lg shadow-md whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-150 border border-slate-700">
          Drag to any angle &bull; Click to open
        </div>
      )}
    </div>
  );
};
