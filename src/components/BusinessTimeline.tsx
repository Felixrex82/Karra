import React, { useState } from 'react';
import { BusinessEvent } from '../types';
import { formatNaira } from '../engine/calculations';
import { getTodayDateStr, getYesterdayDateStr } from '../utils/dateUtils';
import {
  ShoppingBag,
  Truck,
  DollarSign,
  UserCheck,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Search,
  Tag,
  HelpCircle,
  Edit2,
  CheckCircle,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { ensureEventHeadlineAndSummary } from '../engine/eventSummarizer';

interface BusinessTimelineProps {
  events: BusinessEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onExplainEvent: (event: BusinessEvent) => void;
  onCorrectEvent: (eventId: string, correctedRevenue: number, correctedQuantity: number, note: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  initialFilter?: string;
}

export const BusinessTimeline: React.FC<BusinessTimelineProps> = ({
  events,
  selectedDate,
  onSelectDate,
  onExplainEvent,
  onCorrectEvent,
  onDeleteEvent,
  initialFilter = 'ALL',
}) => {
  const [filterType, setFilterType] = useState<string>(initialFilter);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialFilter) {
      setFilterType(initialFilter);
    }
  }, [initialFilter]);
  const [searchQuery, setSearchQuery] = useState('');
  const [correctingEventId, setCorrectingEventId] = useState<string | null>(null);
  const [editRevenue, setEditRevenue] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');

  // Get distinct dates available, filtering out empty or invalid values
  const availableDates = Array.from(
    new Set(
      events
        .map((e) => e.date)
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    )
  )
    .sort()
    .reverse();

  // Filter events
  const filteredEvents = events.filter((e) => {
    if (e.isCorrected) return false;
    if (selectedDate && e.date !== selectedDate) return false;
    if (filterType !== 'ALL' && e.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchRaw = e.rawUserText.toLowerCase().includes(q);
      const matchCustomer = e.customerName?.toLowerCase().includes(q);
      const matchProduct = e.productName?.toLowerCase().includes(q);
      const matchCategory = (e.expenseCategory || e.category || e.productCategory)?.toLowerCase().includes(q);
      const matchHeadline = e.headline?.toLowerCase().includes(q);
      const matchSummary = e.summary?.toLowerCase().includes(q);
      return matchRaw || matchCustomer || matchProduct || matchCategory || Boolean(matchHeadline) || Boolean(matchSummary);
    }
    return true;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'SALE':
        return <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />;
      case 'EXPENSE':
        return <Truck className="w-3.5 h-3.5 text-red-600" />;
      case 'PURCHASE_STOCK':
        return <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />;
      case 'DEBT_PAYMENT':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-600" />;
      case 'CUSTOMER_DEBT':
        return <UserCheck className="w-3.5 h-3.5 text-amber-600" />;
      case 'RETURN_REFUND':
        return <RotateCcw className="w-3.5 h-3.5 text-purple-600" />;
      case 'OWNER_DRAWING':
        return <ArrowDownLeft className="w-3.5 h-3.5 text-slate-700" />;
      case 'OWNER_INJECTION':
        return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const startCorrection = (event: BusinessEvent) => {
    setCorrectingEventId(event.id);
    setEditRevenue(event.totalRevenue || 0);
    setEditQuantity(event.quantity || 1);
    setEditNote('');
  };

  const handleSaveCorrection = (eventId: string) => {
    onCorrectEvent(eventId, editRevenue, editQuantity, editNote || 'Corrected entered amount');
    setCorrectingEventId(null);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Controls: Date Picker, Type Filters, Search */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-3.5 sm:p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center space-x-1.5 shrink-0">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Day:
              </span>
            </div>
            <select
              id="timeline-filter-date-select"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#161f32] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 min-h-[38px] flex-1 min-w-[140px]"
            >
              <option key="all-recorded-dates" value="">
                All Recorded Dates
              </option>
              {availableDates.map((d) => (
                <option key={`timeline-date-${d}`} value={d}>
                  {d === getTodayDateStr()
                    ? `Today (${d})`
                    : d === getYesterdayDateStr()
                    ? `Yesterday (${d})`
                    : d}
                </option>
              ))}
            </select>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={() => onSelectDate(getTodayDateStr())}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                  selectedDate === getTodayDateStr()
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => onSelectDate(getYesterdayDateStr())}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                  selectedDate === getYesterdayDateStr()
                    ? 'bg-slate-900 dark:bg-slate-700 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Yesterday
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, names, text..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#161f32] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 min-h-[38px]"
            />
          </div>
        </div>

        {/* Quick Filter Chips (Horizontal swipe on mobile) */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto pb-1 scrollbar-none touch-pan-x -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0 mr-1">Show:</span>
          {[
            { label: 'All Events', type: 'ALL' },
            { label: 'Sales', type: 'SALE' },
            { label: 'Expenses', type: 'EXPENSE' },
            { label: 'Customer Debts', type: 'CUSTOMER_DEBT' },
            { label: 'Debt Payments', type: 'DEBT_PAYMENT' },
            { label: 'Stock Purchases', type: 'PURCHASE_STOCK' },
            { label: 'Owner Drawings', type: 'OWNER_DRAWING' },
          ].map((chip) => (
            <button
              key={chip.type}
              onClick={() => setFilterType(chip.type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 min-h-[34px] cursor-pointer ${
                filterType === chip.type
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chronological Transactions List */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-3.5 sm:p-6 transition-colors">
        <div className="flex items-center justify-between mb-3.5 sm:mb-4">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Transactions Feed ({filteredEvents.length} recorded events)
          </h3>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            No transactions found matching current criteria.
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-2 sm:ml-4 space-y-4 sm:space-y-6">
            {filteredEvents.map((ev, idx) => {
              const displayEv = ensureEventHeadlineAndSummary(ev);
              return (
              <div key={ev.id ? `${ev.id}-${idx}` : `timeline-ev-${idx}`} className="relative pl-4 sm:pl-6 group">
                {/* Timeline Icon Marker */}
                <div className="absolute -left-[14px] sm:-left-[17px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white dark:bg-[#161f32] border-2 border-slate-300 dark:border-slate-700 group-hover:border-slate-800 dark:group-hover:border-emerald-500 flex items-center justify-center transition-colors shadow-2xs">
                  {getEventIcon(ev.type)}
                </div>

                <div
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    ev.isCorrected
                      ? 'bg-slate-50/70 dark:bg-[#141b2d]/60 border-slate-200 dark:border-slate-800 opacity-75'
                      : 'bg-[#FCFDFE] dark:bg-[#141b2d] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        {ev.timeStr}
                      </span>
                      <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{ev.date}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {ev.type.replace('_', ' ')}
                      </span>
                      {ev.isPromotion && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          PROMO
                        </span>
                      )}
                      {ev.isCorrected && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          CORRECTED
                        </span>
                      )}
                      {(ev.category || ev.productCategory) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {ev.category || ev.productCategory}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 font-mono text-sm sm:text-base font-bold">
                      {ev.type === 'SALE' && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          +{formatNaira(ev.totalRevenue || 0)}
                        </span>
                      )}
                      {ev.type === 'EXPENSE' && (
                        <span className="text-red-600 dark:text-red-400">
                          −{formatNaira(ev.expenseAmount || 0)}
                        </span>
                      )}
                      {ev.type === 'CUSTOMER_DEBT' && (
                        <span className="text-amber-700 dark:text-amber-400">
                          Owed: {formatNaira(ev.receivableAdded || ev.totalRevenue || 0)}
                        </span>
                      )}
                      {ev.type === 'DEBT_PAYMENT' && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Paid: {formatNaira(ev.cashReceived || ev.totalRevenue || 0)}
                        </span>
                      )}
                      {ev.type === 'OWNER_DRAWING' && (
                        <span className="text-slate-700 dark:text-slate-300">
                          Drawing: −{formatNaira(ev.ownerAmount || 0)}
                        </span>
                      )}
                      {ev.type === 'OWNER_INJECTION' && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Capital: +{formatNaira(ev.ownerAmount || 0)}
                        </span>
                      )}
                      {ev.type === 'RETURN_REFUND' && (
                        <span className="text-purple-700 dark:text-purple-400">
                          Refund: −{formatNaira(ev.refundAmount || 0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Structured Headline */}
                  <div className="flex items-center space-x-1.5 mt-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                      {displayEv.headline}
                    </h4>
                  </div>

                  {/* AI Executive Summary */}
                  <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    {displayEv.summary}
                  </p>

                  {/* Source Raw Merchant Statement */}
                  {displayEv.rawUserText && (
                    <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 italic">
                      Source note: "{displayEv.rawUserText}"
                    </p>
                  )}

                  {/* Profit breakdown for sales */}
                  {ev.type === 'SALE' && ev.grossProfit !== undefined && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600 dark:text-slate-400 text-[11px] sm:text-xs">
                        <span>
                          Locked Cost:{' '}
                          <strong className="text-slate-800 dark:text-slate-200 font-mono">
                            {formatNaira(ev.totalCostAtTime || 0)}
                          </strong>
                          {ev.costIsEstimate && ' (~est)'}
                        </span>
                        <span>•</span>
                        <span>
                          Gross Profit:{' '}
                          <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                            {formatNaira(ev.grossProfit)}
                          </strong>
                        </span>
                        {ev.receivableAdded && ev.receivableAdded > 0 ? (
                          <>
                            <span>•</span>
                            <span className="text-amber-800 dark:text-amber-400 font-semibold">
                              Owed: {formatNaira(ev.receivableAdded)}
                            </span>
                          </>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                        <button
                          onClick={() => onExplainEvent(ev)}
                          className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium flex items-center space-x-1 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[32px] cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Explain math</span>
                        </button>
                        <button
                          onClick={() => startCorrection(ev)}
                          className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium flex items-center space-x-1 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[32px] cursor-pointer"
                          title="Correct a mistake on this sale"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Correct</span>
                        </button>
                        {onDeleteEvent && (
                          confirmDeleteId === ev.id ? (
                            <div className="flex flex-wrap items-center gap-1 bg-red-50 dark:bg-red-950/60 p-1 rounded border border-red-200 dark:border-red-800">
                              <span className="text-[10px] text-red-700 dark:text-red-300 font-semibold px-1">Delete permanently?</span>
                              <button
                                onClick={() => {
                                  onDeleteEvent(ev.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-0.5 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer"
                                title="Confirm permanent deletion"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(ev.id)}
                              className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center space-x-1 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[32px] cursor-pointer transition-colors"
                              title="Permanently delete this entry from ledger and calendar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions for non-sale events */}
                  {ev.type !== 'SALE' && onDeleteEvent && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap justify-end">
                      {confirmDeleteId === ev.id ? (
                        <div className="flex flex-wrap items-center gap-1 bg-red-50 dark:bg-red-950/60 p-1 rounded border border-red-200 dark:border-red-800">
                          <span className="text-[10px] text-red-700 dark:text-red-300 font-semibold px-1">Delete permanently?</span>
                          <button
                            onClick={() => {
                              onDeleteEvent(ev.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(ev.id)}
                          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center space-x-1 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[32px] cursor-pointer transition-colors"
                          title="Permanently delete this entry from ledger and calendar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Audit Trail display if corrected */}
                  {ev.auditTrail && ev.auditTrail.length > 0 && (
                    <div className="mt-2 p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Audit Trail: </span>
                      {ev.auditTrail.map((a, i) => (
                        <span key={`${ev.id}-audit-${a.timestamp}-${i}`}>
                          [{a.timestamp.slice(11, 16)}] {a.action}: {a.note}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inline Safe Correction Form */}
                  {correctingEventId === ev.id && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-100 dark:bg-[#161f32] border border-slate-300 dark:border-slate-700 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Correct Entry (Safe Audit Trail)
                        </span>
                        <button
                          onClick={() => setCorrectingEventId(null)}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                            Correct Sale Revenue (₦)
                          </label>
                          <input
                            type="number"
                            value={editRevenue}
                            onChange={(e) => setEditRevenue(parseFloat(e.target.value) || 0)}
                            className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[36px]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                            Correct Quantity
                          </label>
                          <input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(parseInt(e.target.value, 10) || 1)}
                            className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[36px]"
                          />
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          placeholder="Reason for correction (e.g. entered wrong price)..."
                          className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[36px]"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveCorrection(ev.id)}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 min-h-[38px]"
                      >
                        Apply Safe Correction
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};
