import React, { useState, useEffect, useMemo } from 'react';
import { Package, AlertCircle, Loader2, Calendar, HelpCircle, Plus } from 'lucide-react';
import { BottomSheetContainer } from './BottomSheetContainer';
import { ProductMemory, SupplierMemory } from '../../types';
import { formatNaira } from '../../engine/calculations';
import { getTodayDateStr } from '../../utils/dateUtils';

interface AddStockSheetProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  products: ProductMemory[];
  suppliers: SupplierMemory[];
  onSubmitStock: (params: {
    itemName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    supplierName?: string;
    date: string;
    note?: string;
    unit?: string;
  }) => Promise<boolean>;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  onUpdateDraftSummary?: (summary: string) => void;
}

export const AddStockSheet: React.FC<AddStockSheetProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onMinimize,
  onExpand,
  products,
  suppliers,
  onSubmitStock,
  onShowToast,
  onUpdateDraftSummary,
}) => {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(10);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [unit, setUnit] = useState<string>('carton');
  const [supplierName, setSupplierName] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [note, setNote] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Match existing product
  const selectedProduct = useMemo(() => {
    if (!itemName.trim()) return null;
    return (
      products.find(
        (p) => p.name.toLowerCase() === itemName.trim().toLowerCase()
      ) || null
    );
  }, [itemName, products]);

  const filteredProducts = useMemo(() => {
    if (!itemName.trim()) return products.slice(0, 8);
    const q = itemName.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [itemName, products]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierName.trim()) return suppliers.slice(0, 8);
    const q = supplierName.toLowerCase().trim();
    return suppliers.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [supplierName, suppliers]);

  // Deterministic arithmetic for total cost
  const totalCost = useMemo(() => {
    const qty = Math.max(0, quantity || 0);
    const cost = Math.max(0, unitCost || 0);
    return Math.round(qty * cost);
  }, [quantity, unitCost]);

  const isDirty = useMemo(() => {
    return itemName.trim().length > 0 || unitCost > 0 || supplierName.trim().length > 0 || note.trim().length > 0;
  }, [itemName, unitCost, supplierName, note]);

  // Update draft summary for minimized bar
  useEffect(() => {
    if (onUpdateDraftSummary) {
      if (itemName.trim()) {
        const itemLabel = `${quantity} ${unit}s of ${itemName.trim()}`;
        const costLabel = totalCost > 0 ? formatNaira(totalCost) : '';
        onUpdateDraftSummary(costLabel ? `${itemLabel} · ${costLabel}` : itemLabel);
      } else {
        onUpdateDraftSummary('Incomplete stock draft');
      }
    }
  }, [itemName, quantity, unit, totalCost, onUpdateDraftSummary]);

  const handleSelectProduct = (prod: ProductMemory) => {
    setItemName(prod.name);
    setUnit(prod.unit || 'piece');
    if (prod.currentCost && prod.currentCost > 0) {
      setUnitCost(prod.currentCost);
    }
    setProductSearchOpen(false);
    setValidationError(null);
  };

  const handleSelectSupplier = (sup: SupplierMemory) => {
    setSupplierName(sup.name);
    setSupplierSearchOpen(false);
    setValidationError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanItem = itemName.trim();
    if (!cleanItem) {
      setValidationError('Please enter what inventory/goods you are restocking.');
      return;
    }
    if (quantity <= 0) {
      setValidationError('Quantity received must be at least 1.');
      return;
    }
    if (unitCost <= 0) {
      setValidationError('Please enter the wholesale cost per unit in ₦.');
      return;
    }
    if (!date) {
      setValidationError('Please select a valid purchase date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSubmitStock({
        itemName: cleanItem,
        quantity,
        unitCost,
        totalCost,
        supplierName: supplierName.trim() || undefined,
        date,
        note: note.trim() || undefined,
        unit: unit || 'unit',
      });

      if (success) {
        setItemName('');
        setQuantity(10);
        setUnitCost(0);
        setSupplierName('');
        setNote('');
        setDate(getTodayDateStr());
        onClose();
      }
    } catch (err: any) {
      setValidationError(err?.message || "Couldn't record stock. Nothing was saved.");
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
      title="Add Stock"
      subtitle="Record restocked inventory or goods received"
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

        {/* 1. Item Selection & Memory Integration */}
        <div className="space-y-1.5 relative">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Item or Product Restocked <span className="text-rose-500">*</span></span>
            {selectedProduct && selectedProduct.currentStock !== undefined && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                Current stock: {selectedProduct.currentStock}
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
              placeholder="e.g. Cotton Dress, Rice, Engine Oil, Power bank"
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-purple-500 rounded-2xl py-3 px-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all"
            />
            {itemName && (
              <button
                type="button"
                onClick={() => {
                  setItemName('');
                  setUnitCost(0);
                }}
                className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Autocomplete dropdown */}
          {productSearchOpen && filteredProducts.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-[#0F1C2D] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              <div className="p-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                  Select Product
                </span>
                {filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full px-3 py-2 text-left rounded-xl hover:bg-slate-100 dark:hover:bg-[#1A2D44] flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {prod.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {prod.unit ? `Unit: ${prod.unit}` : ''}
                        {prod.currentStock !== undefined ? ` • Stock: ${prod.currentStock}` : ''}
                      </p>
                    </div>
                    {prod.currentCost > 0 && (
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        Last cost: {formatNaira(prod.currentCost)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Known Cost Hint */}
          {selectedProduct && selectedProduct.currentCost > 0 && (
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
              <HelpCircle className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>
                Previous purchase cost was <strong>{formatNaira(selectedProduct.currentCost)}</strong> per {selectedProduct.unit || 'unit'}. You can enter new wholesale cost if supplier price changed.
              </span>
            </div>
          )}
        </div>

        {/* 2. Quantity, Unit Label & Cost Per Unit Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Quantity */}
          <div className="space-y-1.5 col-span-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Quantity <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity || ''}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-purple-500 rounded-2xl py-3 px-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Unit label (carton, bag, piece) */}
          <div className="space-y-1.5 col-span-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Unit Type
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. carton, bag"
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-3 px-3 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Cost per unit */}
          <div className="space-y-1.5 col-span-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Cost / Unit (₦) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">
                ₦
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={unitCost || ''}
                onChange={(e) => {
                  setUnitCost(parseFloat(e.target.value) || 0);
                  setValidationError(null);
                }}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] focus:border-purple-500 rounded-2xl py-3 pl-7 pr-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Real-time Total Cost Display */}
        <div className="p-3 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Total Purchase Cost ({quantity} × {formatNaira(unitCost)})
          </span>
          <span className="text-base font-extrabold text-purple-600 dark:text-purple-400">
            {formatNaira(totalCost)}
          </span>
        </div>

        {/* 3. Supplier (Optional) & Date */}
        <div className="grid grid-cols-2 gap-3 relative">
          <div className="space-y-1.5 relative">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Supplier <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => {
                setSupplierName(e.target.value);
                setSupplierSearchOpen(true);
              }}
              onFocus={() => setSupplierSearchOpen(true)}
              placeholder="e.g. Alhaji Musa, Trade Co"
              className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-3 px-3.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />

            {/* Supplier dropdown */}
            {supplierSearchOpen && filteredSuppliers.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-[#0F1C2D] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                <div className="p-1.5">
                  {filteredSuppliers.map((sup) => (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => handleSelectSupplier(sup)}
                      className="w-full px-3 py-2 text-left rounded-xl hover:bg-slate-100 dark:hover:bg-[#1A2D44] flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">
                        {sup.name}
                      </span>
                      {sup.phone && (
                        <span className="text-[11px] text-slate-400">{sup.phone}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Purchase Date
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

        {/* 4. Note (Optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Note <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Paid cash at wholesale market"
            className="w-full bg-slate-50 dark:bg-[#132235] border border-slate-200 dark:border-[#1E334D] rounded-2xl py-2.5 px-3.5 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
        </div>

        {/* 5. Stock Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#0E1A28] border border-slate-200 dark:border-[#192C42] space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Stock Procurement Summary
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Item</span>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
              {itemName || 'Not specified'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Quantity Received</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {quantity} {unit}s
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Cost per unit</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formatNaira(unitCost)}
            </span>
          </div>
          {supplierName && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Supplier</span>
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                {supplierName}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800">
            <span className="font-bold text-slate-900 dark:text-white">Total Restock Cost</span>
            <span className="font-extrabold text-purple-600 dark:text-purple-400 text-sm">
              {formatNaira(totalCost)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
            Historical sales will remain locked with their historical costs. This wholesale cost updates your current inventory reference.
          </p>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || totalCost <= 0 || !itemName.trim()}
            className="w-full py-3.5 px-4 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-40 disabled:hover:bg-[#8B5CF6] text-white font-bold text-sm rounded-2xl shadow-lg shadow-purple-500/20 active:scale-98 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Package className="w-4 h-4 text-white" />
                <span>Add Stock • {formatNaira(totalCost)}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </BottomSheetContainer>
  );
};
