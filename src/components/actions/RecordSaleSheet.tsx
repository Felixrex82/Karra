import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  Check,
  AlertCircle,
  HelpCircle,
  Loader2,
  Calendar,
  CreditCard,
  User,
  Package,
} from 'lucide-react';
import { BottomSheetContainer } from './BottomSheetContainer';
import { ProductMemory, CustomerMemory } from '../../types';
import { formatNaira } from '../../engine/calculations';
import { getTodayDateStr } from '../../utils/dateUtils';

interface RecordSaleSheetProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  products: ProductMemory[];
  customers: CustomerMemory[];
  onSubmitSale: (params: {
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalSale: number;
    customerName?: string;
    cashReceived: number;
    receivableAdded: number;
    paymentMethod: string;
    date: string;
    note?: string;
    unit?: string;
  }) => Promise<boolean>;
  onQuickAddCustomer?: (name: string, phone?: string) => Promise<any>;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  onUpdateDraftSummary?: (summary: string) => void;
}

export const RecordSaleSheet: React.FC<RecordSaleSheetProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onMinimize,
  onExpand,
  products,
  customers,
  onSubmitSale,
  onQuickAddCustomer,
  onShowToast,
  onUpdateDraftSummary,
}) => {
  // Form fields
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [unit, setUnit] = useState<string>('piece');
  const [customerName, setCustomerName] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<'full' | 'partial' | 'unpaid'>('full');
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [note, setNote] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Identify matching product from memory
  const selectedProduct = useMemo(() => {
    if (!itemName.trim()) return null;
    return (
      products.find(
        (p) => p.name.toLowerCase() === itemName.trim().toLowerCase()
      ) || null
    );
  }, [itemName, products]);

  // Identify matching customer from memory
  const selectedCustomer = useMemo(() => {
    if (!customerName.trim()) return null;
    return (
      customers.find(
        (c) => c.name.toLowerCase() === customerName.trim().toLowerCase()
      ) || null
    );
  }, [customerName, customers]);

  // Filtered product suggestions
  const filteredProducts = useMemo(() => {
    if (!itemName.trim()) return products.slice(0, 8);
    const q = itemName.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [itemName, products]);

  // Filtered customer suggestions
  const filteredCustomers = useMemo(() => {
    if (!customerName.trim()) return customers.slice(0, 8);
    const q = customerName.toLowerCase().trim();
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [customerName, customers]);

  // Deterministic arithmetic calculations
  const totalSale = useMemo(() => {
    const qty = Math.max(0, quantity || 0);
    const price = Math.max(0, unitPrice || 0);
    return Math.round(qty * price);
  }, [quantity, unitPrice]);

  // Keep payment received in sync with payment option and total sale
  useEffect(() => {
    if (paymentOption === 'full') {
      setCashReceived(totalSale);
    } else if (paymentOption === 'unpaid') {
      setCashReceived(0);
    } else if (paymentOption === 'partial') {
      if (cashReceived > totalSale) {
        setCashReceived(totalSale);
      }
    }
  }, [totalSale, paymentOption]);

  const outstanding = useMemo(() => {
    return Math.max(0, totalSale - (cashReceived || 0));
  }, [totalSale, cashReceived]);

  // Estimated profit and cost if known from product memory
  const estimatedEconomics = useMemo(() => {
    if (selectedProduct && selectedProduct.currentCost && selectedProduct.currentCost > 0) {
      const totalCost = selectedProduct.currentCost * (quantity || 1);
      const grossMargin = totalSale - totalCost;
      return {
        unitCost: selectedProduct.currentCost,
        totalCost,
        grossMargin,
        isKnown: true,
      };
    }
    return { isKnown: false, unitCost: 0, totalCost: 0, grossMargin: 0 };
  }, [selectedProduct, quantity, totalSale]);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    return (
      itemName.trim().length > 0 ||
      unitPrice > 0 ||
      customerName.trim().length > 0 ||
      quantity !== 1 ||
      note.trim().length > 0
    );
  }, [itemName, unitPrice, customerName, quantity, note]);

  // Update draft summary for compact draft bar
  useEffect(() => {
    if (onUpdateDraftSummary) {
      if (itemName.trim()) {
        const itemLabel = `${quantity} ${itemName.trim()}`;
        const amountLabel = totalSale > 0 ? formatNaira(totalSale) : '';
        onUpdateDraftSummary(amountLabel ? `${itemLabel} · ${amountLabel}` : itemLabel);
      } else {
        onUpdateDraftSummary('Incomplete draft');
      }
    }
  }, [itemName, quantity, totalSale, onUpdateDraftSummary]);

  // Handle selecting an existing product
  const handleSelectProduct = (prod: ProductMemory) => {
    setItemName(prod.name);
    setUnit(prod.unit || 'piece');
    if (prod.normalSellingPrice && prod.normalSellingPrice > 0) {
      setUnitPrice(prod.normalSellingPrice);
    }
    setProductSearchOpen(false);
    setValidationError(null);
  };

  // Handle selecting a customer
  const handleSelectCustomer = (cust: CustomerMemory) => {
    setCustomerName(cust.name);
    setCustomerSearchOpen(false);
    setIsAddingNewCustomer(false);
    setValidationError(null);
  };

  const handleCreateCustomerInline = async () => {
    if (!customerName.trim()) return;
    if (onQuickAddCustomer) {
      await onQuickAddCustomer(customerName.trim(), newCustomerPhone.trim() || undefined);
    }
    setIsAddingNewCustomer(false);
  };

  // Submit sale
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation
    const cleanItem = itemName.trim();
    if (!cleanItem) {
      setValidationError('Please enter what product or item was sold.');
      return;
    }
    if (quantity <= 0) {
      setValidationError('Quantity must be at least 1.');
      return;
    }
    if (unitPrice < 0) {
      setValidationError('Selling price cannot be negative.');
      return;
    }
    if (totalSale <= 0) {
      setValidationError('Please enter a valid selling price.');
      return;
    }
    if (cashReceived < 0) {
      setValidationError('Payment received cannot be negative.');
      return;
    }
    if (cashReceived > totalSale) {
      setValidationError(`Payment received (₦${cashReceived.toLocaleString()}) cannot exceed the total sale amount (₦${totalSale.toLocaleString()}).`);
      return;
    }
    if (outstanding > 0 && !customerName.trim()) {
      setValidationError('This sale has an unpaid balance. Please enter the customer name so you can track who owes you.');
      return;
    }
    if (!date) {
      setValidationError('Please select a valid date for this sale.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmitSale({
        itemName: cleanItem,
        quantity,
        unitPrice,
        totalSale,
        customerName: customerName.trim() || undefined,
        cashReceived,
        receivableAdded: outstanding,
        paymentMethod,
        date,
        note: note.trim() || undefined,
        unit: unit || 'piece',
      });

      if (success) {
        // Reset form
        setItemName('');
        setQuantity(1);
        setUnitPrice(0);
        setCustomerName('');
        setPaymentOption('full');
        setCashReceived(0);
        setNote('');
        setDate(getTodayDateStr());
        onClose();
      }
    } catch (err: any) {
      setValidationError(err?.message || "Couldn't record the sale. Nothing was saved.");
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
      title="Record Sale"
      subtitle="Log an actual business sale with cash or credit terms"
      isDirty={isDirty}
    >
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
              {validationError}
            </p>
          </div>
        )}

        {/* 1. Item Selection & Memory Integration */}
        <div className="space-y-1.5 relative">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Item or Product Sold <span className="text-rose-500">*</span></span>
            {selectedProduct && selectedProduct.currentStock !== undefined && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                selectedProduct.currentStock < (quantity || 1)
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                {selectedProduct.currentStock} in stock
              </span>
            )}
          </label>

          <div className="relative">
            <input
              type="text"
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value);
                setProductSearchOpen(true);
                setValidationError(null);
              }}
              onFocus={() => setProductSearchOpen(true)}
              placeholder="e.g. Dress, Rice, Hair cut, Power bank"
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-emerald-500 rounded-2xl py-3 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all"
            />
            {itemName && (
              <button
                type="button"
                onClick={() => {
                  setItemName('');
                  setUnitPrice(0);
                }}
                className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Autocomplete suggestions dropdown */}
          {productSearchOpen && filteredProducts.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-[#0F1C2D] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              <div className="p-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                  From Business Memory
                </span>
                {filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-slate-100 dark:hover:bg-[#1A2D44] flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {prod.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {prod.unit ? `per ${prod.unit}` : ''}
                        {prod.currentStock !== undefined ? ` • ${prod.currentStock} in stock` : ''}
                      </p>
                    </div>
                    {prod.normalSellingPrice > 0 && (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {formatNaira(prod.normalSellingPrice)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Memory feedback pill */}
          {selectedProduct && selectedProduct.normalSellingPrice > 0 && (
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>
                Remembered usual price: <strong className="text-slate-700 dark:text-slate-200">{formatNaira(selectedProduct.normalSellingPrice)}</strong>. You can change it for this sale without affecting memory.
              </span>
            </div>
          )}

          {/* Insufficient Stock Warning */}
          {selectedProduct &&
            selectedProduct.currentStock !== undefined &&
            quantity > selectedProduct.currentStock && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  You have <strong>{selectedProduct.currentStock}</strong> recorded in stock, but you are recording a sale of <strong>{quantity}</strong>.
                </span>
              </div>
            )}
        </div>

        {/* 2. Quantity & Unit Price Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Quantity
            </label>
            <div className="flex items-center bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-11 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors font-bold text-base select-none cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-transparent text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none py-2"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-11 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors font-bold text-base select-none cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Unit Price */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Price per item (₦) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400">
                ₦
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={unitPrice || ''}
                onChange={(e) => {
                  setUnitPrice(parseFloat(e.target.value) || 0);
                  setValidationError(null);
                }}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-emerald-500 rounded-2xl py-3 pl-8 pr-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Real-time Total Sale Calculation Indicator */}
        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Total Sale ({quantity} × {formatNaira(unitPrice)})
          </span>
          <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatNaira(totalSale)}
          </span>
        </div>

        {/* 3. Customer Selection */}
        <div className="space-y-1.5 relative">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Customer <span className="text-slate-400 font-normal">(Optional for cash sales)</span>
            </label>
            {!isAddingNewCustomer && (
              <button
                type="button"
                onClick={() => setIsAddingNewCustomer(true)}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>New Customer</span>
              </button>
            )}
          </div>

          {!isAddingNewCustomer ? (
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustomerSearchOpen(true);
                  setValidationError(null);
                }}
                onFocus={() => setCustomerSearchOpen(true)}
                placeholder="Select or enter customer (Leave blank for walk-in)"
                className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-emerald-500 rounded-2xl py-3 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all"
              />
              {customerName && (
                <button
                  type="button"
                  onClick={() => setCustomerName('')}
                  className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Add New Customer
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCustomer(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer full name"
                className="w-full bg-white dark:bg-[#0B1522] border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <input
                type="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Phone or WhatsApp number (optional)"
                className="w-full bg-white dark:bg-[#0B1522] border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          )}

          {/* Customer suggestions dropdown */}
          {customerSearchOpen && !isAddingNewCustomer && filteredCustomers.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-[#0F1C2D] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
              <div className="p-1.5">
                {filteredCustomers.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectCustomer(cust)}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-slate-100 dark:hover:bg-[#1A2D44] flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {cust.name}
                      </p>
                      {cust.phone && (
                        <p className="text-[11px] text-slate-400">{cust.phone}</p>
                      )}
                    </div>
                    {cust.outstandingBalance > 0 && (
                      <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        Owes {formatNaira(cust.outstandingBalance)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Existing Customer Debt Pill */}
          {selectedCustomer && selectedCustomer.outstandingBalance > 0 && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              ℹ️ {selectedCustomer.name} currently owes an outstanding balance of <strong>{formatNaira(selectedCustomer.outstandingBalance)}</strong>.
            </div>
          )}
        </div>

        {/* 4. Payment Terms & Cash Received */}
        <div className="space-y-2.5 pt-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Payment Status
          </label>

          {/* 3 Quick Chips */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentOption('full')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                paymentOption === 'full'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#132235] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Paid in Full
            </button>
            <button
              type="button"
              onClick={() => setPaymentOption('partial')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                paymentOption === 'partial'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#132235] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Partial Payment
            </button>
            <button
              type="button"
              onClick={() => setPaymentOption('unpaid')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                paymentOption === 'unpaid'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#132235] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              On Credit (Unpaid)
            </button>
          </div>

          {/* Amount Paid Field */}
          {paymentOption === 'partial' && (
            <div className="space-y-1 pt-1 animate-in fade-in">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Amount Paid Today (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400">
                  ₦
                </span>
                <input
                  type="number"
                  min="0"
                  max={totalSale}
                  value={cashReceived || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setCashReceived(Math.min(totalSale, Math.max(0, val)));
                    setValidationError(null);
                  }}
                  className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-emerald-500 rounded-2xl py-3 pl-8 pr-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Payment Split Balance Display */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#111F30] border border-slate-200/80 dark:border-[#1B2F48]">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Cash Received
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {formatNaira(cashReceived)}
              </span>
            </div>
            <div className={`p-2.5 rounded-xl border ${
              outstanding > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-slate-100 dark:bg-[#111F30] border-slate-200/80 dark:border-[#1B2F48] text-slate-400'
            }`}>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Outstanding (Debt)
              </span>
              <span className={`text-sm font-bold ${outstanding > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                {formatNaira(outstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Payment Method & Date */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-3 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Card">Card / POS</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Transaction Date
            </label>
            <input
              type="date"
              value={date}
              max={getTodayDateStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-3 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        {/* 6. Short Note (Optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Note <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Delivered to customer's shop"
            className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-2.5 px-3.5 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
        </div>

        {/* 7. Comprehensive Sale Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#0E1A28] border border-slate-200 dark:border-[#192C42] space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Sale Summary
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Item</span>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
              {itemName || 'No item selected'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Quantity & Price</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {quantity} × {formatNaira(unitPrice)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-slate-900 dark:text-white">Total Sale</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
              {formatNaira(totalSale)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Payment Received</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatNaira(cashReceived)}
            </span>
          </div>
          {outstanding > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-500 font-semibold">Outstanding (Debt)</span>
              <span className="font-bold text-amber-500">
                {formatNaira(outstanding)}
              </span>
            </div>
          )}

          {/* Cost and estimated profit ONLY if cost is known */}
          {estimatedEconomics.isKnown && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 text-[11px] flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Estimated Cost: {formatNaira(estimatedEconomics.totalCost)}</span>
              <span className={`font-semibold ${estimatedEconomics.grossMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                Estimated Profit: {formatNaira(estimatedEconomics.grossMargin)}
              </span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || totalSale <= 0 || !itemName.trim()}
            className="w-full py-3.5 px-4 bg-[#00B074] hover:bg-[#009663] disabled:opacity-40 disabled:hover:bg-[#00B074] text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4 text-white" />
                <span>Record Sale • {formatNaira(totalSale)}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </BottomSheetContainer>
  );
};
