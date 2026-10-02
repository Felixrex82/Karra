import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { BottomSheetContainer } from './BottomSheetContainer';
import { ExpenseCategory } from '../../types';
import { formatNaira } from '../../engine/calculations';
import { getTodayDateStr } from '../../utils/dateUtils';

interface RecordExpenseSheetProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onSubmitExpense: (params: {
    description: string;
    amount: number;
    category: ExpenseCategory;
    date: string;
    note?: string;
  }) => Promise<boolean>;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  onUpdateDraftSummary?: (summary: string) => void;
}

const COMMON_EXPENSE_CHIPS = [
  { label: 'Transport', category: 'Transportation' as ExpenseCategory },
  { label: 'Generator Fuel', category: 'Utilities' as ExpenseCategory },
  { label: 'Shop Rent', category: 'Rent' as ExpenseCategory },
  { label: 'Packaging Bags', category: 'Packaging' as ExpenseCategory },
  { label: 'Electricity / NEPA', category: 'Utilities' as ExpenseCategory },
  { label: 'Delivery Rider', category: 'Transportation' as ExpenseCategory },
  { label: 'Staff Wages', category: 'Staff/Labour' as ExpenseCategory },
  { label: 'Shop Repairs', category: 'Repairs' as ExpenseCategory },
];

const CATEGORIES: ExpenseCategory[] = [
  'Transportation',
  'Rent',
  'Utilities',
  'Staff/Labour',
  'Packaging',
  'Marketing',
  'Repairs',
  'Procurement',
  'Taxes/fees',
  'Other',
];

export const RecordExpenseSheet: React.FC<RecordExpenseSheetProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onMinimize,
  onExpand,
  onSubmitExpense,
  onShowToast,
  onUpdateDraftSummary,
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<ExpenseCategory>('Transportation');
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    return description.trim().length > 0 || amount > 0 || note.trim().length > 0;
  }, [description, amount, note]);

  // Update draft summary for minimized bar
  useEffect(() => {
    if (onUpdateDraftSummary) {
      if (description.trim() || amount > 0) {
        const desc = description.trim() || 'Expense';
        const amt = amount > 0 ? formatNaira(amount) : '';
        onUpdateDraftSummary(amt ? `${desc} · ${amt}` : desc);
      } else {
        onUpdateDraftSummary('Incomplete draft');
      }
    }
  }, [description, amount, onUpdateDraftSummary]);

  const handleSelectChip = (chip: { label: string; category: ExpenseCategory }) => {
    setDescription(chip.label);
    setCategory(chip.category);
    setValidationError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      setValidationError('Please enter what you spent on.');
      return;
    }
    if (amount <= 0) {
      setValidationError('Please enter an expense amount greater than ₦0.');
      return;
    }
    if (!date) {
      setValidationError('Please select a valid date for this expense.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmitExpense({
        description: cleanDesc,
        amount,
        category,
        date,
        note: note.trim() || undefined,
      });

      if (success) {
        setDescription('');
        setAmount(0);
        setNote('');
        setDate(getTodayDateStr());
        onClose();
      }
    } catch (err: any) {
      setValidationError(err?.message || "Couldn't record the expense. Nothing was saved.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheetContainer
      isOpen={isOpen}
      isMinimized={isMinimized}
      onClose={onClose}
      onMinimize={onMinimize}
      onExpand={onExpand}
      title="Record Expense"
      subtitle="Track your operating costs and outflows"
      isDirty={isDirty}
    >
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Error Banner */}
        {validationError && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
              {validationError}
            </p>
          </div>
        )}

        {/* 1. Description & Quick Chips */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            What did you spend on? <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setValidationError(null);
            }}
            placeholder="e.g. Fuel for generator, Transport to market, Shop rent"
            className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-blue-500 rounded-2xl py-3 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all"
          />

          {/* Quick Expense Tap Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
            {COMMON_EXPENSE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleSelectChip(chip)}
                className={`py-1.5 px-3 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                  description === chip.label
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-[#132235] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Amount & Category Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Amount Spent (₦) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400">
                ₦
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount || ''}
                onChange={(e) => {
                  setAmount(parseFloat(e.target.value) || 0);
                  setValidationError(null);
                }}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-blue-500 rounded-2xl py-3 pl-8 pr-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Expense Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-3 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Date & Note */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Date
            </label>
            <input
              type="date"
              value={date}
              max={getTodayDateStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-3 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Note <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid in cash to driver"
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-2.5 px-3 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        {/* 4. Expense Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#0E1A28] border border-slate-200 dark:border-[#192C42] space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Expense Summary
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Expense</span>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
              {description || 'Not specified'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Category</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {category}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Date</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {date}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-slate-900 dark:text-white">Total Outflow</span>
            <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
              {formatNaira(amount)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || amount <= 0 || !description.trim()}
            className="w-full py-3.5 px-4 bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-40 disabled:hover:bg-[#0284C7] text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 text-white" />
                <span>Record Expense • {formatNaira(amount)}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </BottomSheetContainer>
  );
};
