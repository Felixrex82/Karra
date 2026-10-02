import React, { useState, useEffect, useMemo } from 'react';
import { User, AlertCircle, Loader2, Phone, Mail, MapPin, Receipt, Check, HelpCircle } from 'lucide-react';
import { BottomSheetContainer } from './BottomSheetContainer';
import { CustomerMemory } from '../../types';
import { formatNaira } from '../../engine/calculations';
import { levenshteinDistance } from '../../engine/businessEngine';

interface AddCustomerSheetProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  customers: CustomerMemory[];
  onSubmitCustomer: (params: {
    customerName: string;
    phone?: string;
    email?: string;
    address?: string;
    openingBalance?: number;
    note?: string;
  }) => Promise<boolean>;
  onNavigateToCustomer?: (customer: CustomerMemory) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  onUpdateDraftSummary?: (summary: string) => void;
}

export const AddCustomerSheet: React.FC<AddCustomerSheetProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onMinimize,
  onExpand,
  customers,
  onSubmitCustomer,
  onNavigateToCustomer,
  onShowToast,
  onUpdateDraftSummary,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check for existing similar or exact customer names
  const existingMatch = useMemo(() => {
    const clean = customerName.trim().toLowerCase();
    if (!clean || clean.length < 2) return null;

    // Exact match
    const exact = customers.find((c) => c.name.toLowerCase() === clean);
    if (exact) return { customer: exact, type: 'exact' as const };

    // Substring or fuzzy match
    for (const c of customers) {
      const cName = c.name.toLowerCase();
      if (cName.includes(clean) || clean.includes(cName)) {
        return { customer: c, type: 'similar' as const };
      }
      if (clean.length >= 4 && cName.length >= 4) {
        const dist = levenshteinDistance(clean, cName);
        if (dist <= 2) {
          return { customer: c, type: 'similar' as const };
        }
      }
    }

    return null;
  }, [customerName, customers]);

  const isDirty = useMemo(() => {
    return (
      customerName.trim().length > 0 ||
      phone.trim().length > 0 ||
      email.trim().length > 0 ||
      address.trim().length > 0 ||
      openingBalance > 0 ||
      note.trim().length > 0
    );
  }, [customerName, phone, email, address, openingBalance, note]);

  // Update draft bar summary
  useEffect(() => {
    if (onUpdateDraftSummary) {
      if (customerName.trim()) {
        const nameLabel = customerName.trim();
        const debtLabel = openingBalance > 0 ? `Owes ${formatNaira(openingBalance)}` : 'New Customer';
        onUpdateDraftSummary(`${nameLabel} · ${debtLabel}`);
      } else {
        onUpdateDraftSummary('Incomplete customer draft');
      }
    }
  }, [customerName, openingBalance, onUpdateDraftSummary]);

  // Normalize Nigerian phone format if valid
  const cleanPhone = (val: string) => {
    return val.replace(/[^0-9+]/g, '');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanName = customerName.trim();
    if (!cleanName) {
      setValidationError('Please enter customer full or trade name.');
      return;
    }

    if (openingBalance < 0) {
      setValidationError('Opening balance debt cannot be a negative amount.');
      return;
    }

    // Phone validation
    const cleanedPhone = phone.trim() ? cleanPhone(phone.trim()) : undefined;
    if (cleanedPhone && cleanedPhone.length > 0 && cleanedPhone.length < 8) {
      setValidationError('Please enter a valid phone number (at least 8 digits).');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmitCustomer({
        customerName: cleanName,
        phone: cleanedPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        openingBalance: openingBalance > 0 ? openingBalance : 0,
        note: note.trim() || undefined,
      });

      if (success) {
        setCustomerName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setOpeningBalance(0);
        setNote('');
        onClose();
      }
    } catch (err: any) {
      setValidationError(err?.message || "Couldn't save customer. Nothing was recorded.");
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
      title="Add Customer"
      subtitle="Save customer contact info and track outstanding debts"
      isDirty={isDirty}
    >
      <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col justify-between overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="space-y-4">
          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-2.5 text-rose-600 dark:text-rose-400 text-xs sm:text-sm animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Customer Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Customer Name <span className="text-emerald-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setValidationError(null);
                }}
                placeholder="e.g. Musa Ibrahim, Mama Ngozi, Alhaji Bello"
                className="w-full bg-slate-50 dark:bg-[#070D14] border border-slate-200 dark:border-[#1E3048] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                autoFocus
              />
            </div>

            {/* Duplicate Heads-up */}
            {existingMatch && (
              <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start justify-between space-x-3 text-xs text-amber-700 dark:text-amber-400 animate-in fade-in">
                <div className="flex items-start space-x-2">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <span className="font-semibold">
                      A customer named &ldquo;{existingMatch.customer.name}&rdquo; already exists.
                    </span>
                    {existingMatch.customer.outstandingBalance && existingMatch.customer.outstandingBalance > 0 ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-0.5">
                        Current balance: owes {formatNaira(existingMatch.customer.outstandingBalance)}
                      </p>
                    ) : null}
                  </div>
                </div>
                {onNavigateToCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToCustomer(existingMatch.customer);
                      onClose();
                    }}
                    className="shrink-0 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    View Record
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Phone Number & Email Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Phone Number <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0803 123 4567 or +234..."
                  className="w-full bg-slate-50 dark:bg-[#070D14] border border-slate-200 dark:border-[#1E3048] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@gmail.com"
                  className="w-full bg-slate-50 dark:bg-[#070D14] border border-slate-200 dark:border-[#1E3048] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address / Shop Location */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Address / Location <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Shop 14 Balogun Market, Lagos"
                className="w-full bg-slate-50 dark:bg-[#070D14] border border-slate-200 dark:border-[#1E3048] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
              />
            </div>
          </div>

          {/* Opening Balance / Existing Debt */}
          <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#0E1A29] border border-slate-200/80 dark:border-[#1E3048] rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-white">
                  Opening Balance / Existing Debt
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  How much does this customer currently owe you?
                </p>
              </div>
              <Receipt className="w-5 h-5 text-amber-500/80" />
            </div>

            <div className="relative mt-2">
              <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400 select-none">
                ₦
              </span>
              <input
                type="number"
                min="0"
                step="50"
                value={openingBalance || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setOpeningBalance(isNaN(val) ? 0 : Math.max(0, val));
                }}
                placeholder="0"
                className="w-full bg-white dark:bg-[#070D14] border border-slate-200 dark:border-[#1E3048] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-8 pr-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
              />
            </div>
            {openingBalance > 0 && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                This will automatically add {formatNaira(openingBalance)} to your accounts receivable ledger.
              </p>
            )}
          </div>

          {/* Note / Preference */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Note <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Prefers bank transfer, usually orders on Mondays"
              className="w-full bg-slate-50 dark:bg-[#070D14] border border-slate-200 dark:border-[#1E3048] focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all"
            />
          </div>

          {/* Customer Summary Card */}
          {customerName.trim() && (
            <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/20 rounded-2xl space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span className="font-medium">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-white">{customerName.trim()}</span>
              </div>
              {phone.trim() && (
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Phone:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{phone.trim()}</span>
                </div>
              )}
              {openingBalance > 0 ? (
                <div className="flex justify-between items-center pt-1 border-t border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                  <span>Opening Debt:</span>
                  <span>{formatNaira(openingBalance)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center pt-1 border-t border-amber-500/20 text-slate-500 dark:text-slate-400">
                  <span>Opening Balance:</span>
                  <span>₦0 (Clean slate)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#162536] flex items-center justify-end space-x-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !customerName.trim()}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Customer</span>
              </>
            )}
          </button>
        </div>
      </form>
    </BottomSheetContainer>
  );
};
