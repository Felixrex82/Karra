import React, { useState, useMemo } from 'react';
import {
  ProductMemory,
  CustomerMemory,
  SupplierMemory,
  UnitRelationship,
  BusinessRule,
} from '../types';
import { formatNaira } from '../engine/calculations';
import { getTodayDateStr } from '../utils/dateUtils';
import { KarraLogo } from './KarraLogo';
import {
  Package,
  Layers,
  Users,
  Building2,
  Lock,
  ChevronRight,
  Lightbulb,
  AlertCircle,
  Tag,
  Coins,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  X,
  Phone,
  MessageCircle,
  BrainCircuit,
  BarChart3,
  HelpCircle,
} from 'lucide-react';

interface BusinessMemoryViewProps {
  products: ProductMemory[];
  customers: CustomerMemory[];
  suppliers: SupplierMemory[];
  unitRelationships: UnitRelationship[];
  businessRules: BusinessRule[];
  onUpdateProductCost: (productName: string, newCost: number) => void;
  onAddProduct?: (product: ProductMemory) => void;
  onDeleteProduct?: (productId: string, productName: string) => void;
  onAddUnitRelationship: (rel: UnitRelationship) => void;
  onDeleteUnitRelationship?: (unitId: string) => void;
  onUpdateCustomerBalance: (customerName: string, newBalance: number) => void;
  onDeleteCustomer?: (customerId: string, customerName: string) => void;
  onDeleteBusinessRule?: (ruleId: string) => void;
  onSettleCustomerDebt?: (customerName: string, amount: number) => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  businessName?: string;
  initialSubTab?: 'products' | 'units' | 'debt_list' | 'customer_memory' | 'suppliers' | 'rules';
  onNavigateTab?: (tab: string) => void;
}

export const BusinessMemoryView: React.FC<BusinessMemoryViewProps> = ({
  products,
  customers,
  suppliers,
  unitRelationships,
  businessRules,
  onUpdateProductCost,
  onAddProduct,
  onDeleteProduct,
  onAddUnitRelationship,
  onDeleteUnitRelationship,
  onUpdateCustomerBalance,
  onDeleteCustomer,
  onDeleteBusinessRule,
  onSettleCustomerDebt,
  onShowToast,
  businessName,
  initialSubTab,
  onNavigateTab,
}) => {
  const [filterCategory, setFilterCategory] = useState<'All' | 'Products' | 'Customers' | 'Suppliers'>('All');
  const [activeDrilldown, setActiveDrilldown] = useState<'products' | 'units' | 'debts' | null>(null);

  // Modals state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [addProductName, setAddProductName] = useState('');
  const [addProductSellingPrice, setAddProductSellingPrice] = useState<number | ''>('');
  const [addProductCost, setAddProductCost] = useState<number | ''>('');
  const [addProductUnit, setAddProductUnit] = useState('piece');
  const [addProductCategory, setAddProductCategory] = useState('General Goods');

  const [editingProduct, setEditingProduct] = useState<ProductMemory | null>(null);
  const [newProductCost, setNewProductCost] = useState<number>(0);

  const [productToDelete, setProductToDelete] = useState<ProductMemory | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerMemory | null>(null);

  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [unitParent, setUnitParent] = useState('bag');
  const [unitProduct, setUnitProduct] = useState('Rice');
  const [unitChild, setUnitChild] = useState('bowl');
  const [unitRatio, setUnitRatio] = useState(45);
  const [unitParentCost, setUnitParentCost] = useState(59000);

  const [settlingCustomer, setSettlingCustomer] = useState<CustomerMemory | null>(null);
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null);

  // Active Debtors: strictly customers with positive outstanding balance
  const activeDebtors = useMemo(() => {
    return customers.filter((c) => (c.outstandingBalance || 0) > 0);
  }, [customers]);

  const totalOutstandingDebt = useMemo(() => {
    return activeDebtors.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  }, [activeDebtors]);

  // Averages for products
  const avgSellingPrice = useMemo(() => {
    const valid = products.map((p) => p.normalSellingPrice).filter((p) => p > 0);
    if (!valid.length) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  }, [products]);

  const avgCostPrice = useMemo(() => {
    const valid = products.map((p) => p.currentCost).filter((c) => c > 0);
    if (!valid.length) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  }, [products]);

  const mostCommonUnit = useMemo(() => {
    if (!unitRelationships.length) return '—';
    return `${unitRelationships[0].parentUnit} → ${unitRelationships[0].childUnit}`;
  }, [unitRelationships]);

  const handleSaveCost = () => {
    if (editingProduct && newProductCost > 0) {
      onUpdateProductCost(editingProduct.name, newProductCost);
      if (onShowToast) {
        onShowToast(`Updated cost for ${editingProduct.name} to ${formatNaira(newProductCost)}`, 'success');
      }
      setEditingProduct(null);
    }
  };

  const handleSaveNewProduct = () => {
    if (!addProductName.trim()) {
      if (onShowToast) onShowToast('Please provide an item or product name', 'warning');
      return;
    }
    const sellingPrice =
      typeof addProductSellingPrice === 'number'
        ? addProductSellingPrice
        : parseFloat(addProductSellingPrice) || 0;
    const cost =
      typeof addProductCost === 'number' ? addProductCost : parseFloat(addProductCost) || 0;

    const newProd: ProductMemory = {
      id: `prod-${Date.now()}`,
      name: addProductName.trim(),
      normalSellingPrice: sellingPrice,
      currentCost: cost,
      unit: addProductUnit.trim() || 'piece',
      category: addProductCategory.trim() || 'General Goods',
      costHistory: [
        {
          date: getTodayDateStr(),
          cost: cost,
          reason: 'Added to Business Memory',
        },
      ],
      priceHistory: [
        {
          date: getTodayDateStr(),
          price: sellingPrice,
          note: 'Initial price',
        },
      ],
      howLearned: 'Added to Business Memory',
    };

    if (onAddProduct) {
      onAddProduct(newProd);
    } else if (onShowToast) {
      onShowToast(`Saved ${newProd.name} (${formatNaira(newProd.normalSellingPrice)}) to memory.`, 'success');
    }

    setAddProductName('');
    setAddProductSellingPrice('');
    setAddProductCost('');
    setAddProductUnit('piece');
    setAddProductCategory('General Goods');
    setIsAddingProduct(false);
  };

  const handleSaveUnit = () => {
    if (unitParent && unitChild && unitRatio > 0) {
      const estCost = unitParentCost / unitRatio;
      onAddUnitRelationship({
        id: `rel-${Date.now()}`,
        parentUnit: unitParent,
        productName: unitProduct,
        childUnit: unitChild,
        ratio: unitRatio,
        yieldCount: unitRatio,
        parentCost: unitParentCost,
        estimatedCostPerChild: estCost,
        isEstimate: true,
        source: 'Defined in Business Memory',
        updatedAt: getTodayDateStr(),
      });
      setIsAddingUnit(false);
    }
  };

  const handleConfirmSettleDebt = (customer: CustomerMemory) => {
    const debtAmount = customer.outstandingBalance;
    if (onSettleCustomerDebt) {
      onSettleCustomerDebt(customer.name, debtAmount);
    } else {
      onUpdateCustomerBalance(customer.name, 0);
      if (onShowToast) {
        onShowToast(
          `Settled ${customer.name}'s debt of ${formatNaira(debtAmount)}. Customer debt updated.`,
          'success'
        );
      }
    }
    setSettlingCustomer(null);
  };

  const handleSendReminder = (customer: CustomerMemory) => {
    const storeTitle = businessName || 'our store';
    const text = `Hello ${customer.name}, friendly reminder from ${storeTitle} regarding your balance of ${formatNaira(customer.outstandingBalance)}. Thank you!`;
    navigator.clipboard.writeText(text);
    setCopiedCustomerId(customer.id);
    setTimeout(() => setCopiedCustomerId(null), 2500);

    const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-12">
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <div className="flex items-center space-x-3">
          <KarraLogo size="sm" variant="green-bg" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Memory</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">What Karra knows about your business</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('questions')}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#0d1d30] border border-slate-200 dark:border-[#162e49] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-[#122842] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
            title="Ask Karra about memory"
          >
            <BrainCircuit className="w-4 h-4" />
          </button>
          <div className="bg-emerald-50 dark:bg-[#04241d] border border-emerald-200 dark:border-[#093e32] text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active</span>
          </div>
        </div>
      </div>

      {/* 2. SECTION HEADER & FILTER PILLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Business Memory</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Information Karra uses to understand your business.</p>
        </div>

        {/* Filter Pill Navigation [All] [Products] [Customers] [Suppliers] */}
        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-[#091525] p-1 rounded-xl border border-slate-200 dark:border-[#14263e] overflow-x-auto scrollbar-none">
          {(['All', 'Products', 'Customers', 'Suppliers'] as const).map((tab) => {
            const isActive = filterCategory === tab && activeDrilldown === null;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setFilterCategory(tab);
                  setActiveDrilldown(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#0f2136]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. DRILLDOWN OR MAIN CARDS VIEW */}

      {/* A. DRILLDOWN: DETAILED PRODUCTS LIST */}
      {(filterCategory === 'Products' || activeDrilldown === 'products') && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setActiveDrilldown(null);
                  setFilterCategory('All');
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                ← Back to Overview
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Known Products ({products.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingProduct(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {products.map((p) => {
              const margin = p.normalSellingPrice - p.currentCost;
              const marginPct =
                p.normalSellingPrice > 0 ? ((margin / p.normalSellingPrice) * 100).toFixed(0) : '0';
              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#091525] border border-slate-200/80 dark:border-[#14263e] hover:border-slate-300 dark:hover:border-[#1d385a] rounded-2xl p-4 space-y-3 transition-colors shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">{p.name}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-50 dark:bg-[#0e2d3b] text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/50">
                          {p.unit}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.category || 'General Goods'}</p>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setNewProductCost(p.currentCost);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0e2135] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#162e49] text-xs font-medium flex items-center space-x-1 cursor-pointer"
                        title="Update cost"
                      >
                        <Edit className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Update Cost</span>
                      </button>
                      <button
                        onClick={() => setProductToDelete(p)}
                        className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 cursor-pointer"
                        title="Delete product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#060e1a] border border-slate-200/80 dark:border-[#0d1f33] text-center text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Normal Selling Price</div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {p.normalSellingPrice > 0 ? formatNaira(p.normalSellingPrice) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Current Cost</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {p.currentCost > 0 ? formatNaira(p.currentCost) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Est. Margin</div>
                      <div
                        className={`font-bold mt-0.5 ${
                          margin > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {margin > 0 ? `+${marginPct}%` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {products.length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#081524] rounded-2xl border border-slate-200/80 dark:border-[#12273e] shadow-xs">
                <Package className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No products saved yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click "Add Product" or record sales to build your product memory.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. DRILLDOWN: DETAILED DEBTS / CUSTOMERS LIST */}
      {(filterCategory === 'Customers' || activeDrilldown === 'debts') && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setActiveDrilldown(null);
                  setFilterCategory('All');
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                ← Back to Overview
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {activeDrilldown === 'debts' ? 'Customers with Debt' : 'Customer Memory'} ({customers.length})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(activeDrilldown === 'debts' ? activeDebtors : customers).map((c) => {
              const hasDebt = (c.outstandingBalance || 0) > 0;
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-[#091525] border border-slate-200/80 dark:border-[#14263e] hover:border-slate-300 dark:hover:border-[#1d385a] rounded-2xl p-4 space-y-3 transition-colors shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">{c.name}</h4>
                      {c.phone && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.phone}</p>}
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Outstanding Balance</div>
                      <div
                        className={`text-base font-bold ${
                          hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatNaira(c.outstandingBalance || 0)}
                      </div>
                    </div>
                  </div>

                  {hasDebt && (
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-[#102237]">
                      <button
                        type="button"
                        onClick={() => handleSendReminder(c)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#0e2135] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#162e49] flex items-center space-x-1 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{copiedCustomerId === c.id ? 'Copied WhatsApp' : 'Send Reminder'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettlingCustomer(c)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        Mark Settled
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {(activeDrilldown === 'debts' ? activeDebtors : customers).length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#081524] rounded-2xl border border-slate-200/80 dark:border-[#12273e] shadow-xs">
                <Users className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">
                  {activeDrilldown === 'debts' ? 'No active customer debts' : 'No customers recorded yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Customer balances update automatically as sales and payments are logged.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* C. DRILLDOWN: SUPPLIERS */}
      {filterCategory === 'Suppliers' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setActiveDrilldown(null);
                  setFilterCategory('All');
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                ← Back to Overview
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Suppliers ({suppliers.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-[#091525] border border-slate-200/80 dark:border-[#14263e] rounded-2xl p-4 space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{s.name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 dark:bg-[#0e2d3b] text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/50">
                    Supplier
                  </span>
                </div>
                {s.itemsSupplied && s.itemsSupplied.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supplies: {s.itemsSupplied.join(', ')}
                  </p>
                )}
                {s.notes && <p className="text-xs text-slate-600 dark:text-slate-500 italic">“{s.notes}”</p>}
              </div>
            ))}
            {suppliers.length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#081524] rounded-2xl border border-slate-200/80 dark:border-[#12273e] shadow-xs">
                <Building2 className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No suppliers saved yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Mention stock purchases from suppliers (e.g. "Bought from Musa") to record supplier info.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* D. MAIN SCREEN: 3 LARGE CARDS */}
      {filterCategory === 'All' && activeDrilldown === null && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* CARD 1: Products & Costs */}
          <div
            onClick={() => setActiveDrilldown('products')}
            className="bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] hover:border-slate-300 dark:hover:border-[#1a385a] rounded-2xl p-4 sm:p-5 transition-all shadow-xs cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-[#064e3b] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Products & Costs
                    </h3>
                    <span className="bg-cyan-50 dark:bg-[#0e2d3b] text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/50 font-mono text-xs px-2 py-0.5 rounded-full font-bold">
                      {products.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Products you sell, their prices and costs.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>

            {/* 3-Column Stats Container */}
            <div className="bg-slate-50 dark:bg-[#050e1a] border border-slate-200/80 dark:border-[#0d1f33] rounded-xl p-3 grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-[#0d1f33] my-3.5">
              <div className="px-2 sm:px-3 text-left">
                <Package className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Known products</div>
                <div className="text-slate-900 dark:text-white font-bold text-base mt-0.5">{products.length}</div>
              </div>

              <div className="px-2 sm:px-3 text-left">
                <Tag className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg. selling price</div>
                <div className="text-slate-900 dark:text-white font-bold text-base mt-0.5">
                  {avgSellingPrice ? formatNaira(avgSellingPrice) : '—'}
                </div>
              </div>

              <div className="px-2 sm:px-3 text-left">
                <Coins className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Avg. cost price</div>
                <div className="text-slate-900 dark:text-white font-bold text-base mt-0.5">
                  {avgCostPrice ? formatNaira(avgCostPrice) : '—'}
                </div>
              </div>
            </div>

            {/* Action Hint Strip */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingProduct(true);
              }}
              className="bg-emerald-50 dark:bg-[#051a24] border border-emerald-200/80 dark:border-[#0b333c] hover:border-emerald-500/50 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center min-w-0">
                <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mr-2.5" />
                <span className="truncate">
                  Add product details to help Karra give you better insights and suggestions.
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </div>
          </div>

          {/* CARD 2: Unit Yields */}
          <div
            onClick={() => setIsAddingUnit(true)}
            className="bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] hover:border-slate-300 dark:hover:border-[#1a385a] rounded-2xl p-4 sm:p-5 transition-all shadow-xs cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#1e3a8a] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Unit Yields
                    </h3>
                    <span className="bg-cyan-50 dark:bg-[#0e2d3b] text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/50 font-mono text-xs px-2 py-0.5 rounded-full font-bold">
                      {unitRelationships.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    How much you get from each unit (e.g. pieces per pack).
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>

            {/* 3-Column Stats Container */}
            <div className="bg-slate-50 dark:bg-[#050e1a] border border-slate-200/80 dark:border-[#0d1f33] rounded-xl p-3 grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-[#0d1f33] my-3.5">
              <div className="px-2 sm:px-3 text-left">
                <Layers className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Known unit yields</div>
                <div className="text-slate-900 dark:text-white font-bold text-base mt-0.5">
                  {unitRelationships.length}
                </div>
              </div>

              <div className="px-2 sm:px-3 text-left">
                <BarChart3 className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Most common</div>
                <div className="text-slate-900 dark:text-white font-bold text-base mt-0.5 truncate">
                  {mostCommonUnit}
                </div>
              </div>

              <div className="px-2 sm:px-3 text-left">
                <HelpCircle className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Used for</div>
                <div className="text-slate-700 dark:text-slate-300 font-medium text-xs mt-0.5 leading-snug">
                  Stock & profit calculations
                </div>
              </div>
            </div>

            {/* Action Hint Strip */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingUnit(true);
              }}
              className="bg-blue-50 dark:bg-[#051a24] border border-blue-200/80 dark:border-[#0b333c] hover:border-blue-500/50 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center min-w-0">
                <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mr-2.5" />
                <span className="truncate">
                  Add your unit yields to make tracking and calculations easier.
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </div>
          </div>

          {/* CARD 3: Debts */}
          <div
            onClick={() => setActiveDrilldown('debts')}
            className="bg-white dark:bg-[#081524] border border-slate-200/80 dark:border-[#12273e] hover:border-slate-300 dark:hover:border-[#1a385a] rounded-2xl p-4 sm:p-5 transition-all shadow-xs cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-[#881337] text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      Debts
                    </h3>
                    <span className="bg-cyan-50 dark:bg-[#0e2d3b] text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/50 font-mono text-xs px-2 py-0.5 rounded-full font-bold">
                      {activeDebtors.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Customers who owe you money and how much.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>

            {/* 3-Column Stats Container */}
            <div className="bg-slate-50 dark:bg-[#050e1a] border border-slate-200/80 dark:border-[#0d1f33] rounded-xl p-3 grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-[#0d1f33] my-3.5">
              <div className="px-2 sm:px-3 text-left">
                <Users className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Customers with debt</div>
                <div className="text-slate-900 dark:text-white font-bold text-base mt-0.5">
                  {activeDebtors.length}
                </div>
              </div>

              <div className="px-2 sm:px-3 text-left">
                <Coins className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Total amount owed</div>
                <div className="text-rose-600 dark:text-rose-400 font-bold text-base mt-0.5">
                  {totalOutstandingDebt > 0 ? formatNaira(totalOutstandingDebt) : '—'}
                </div>
              </div>

              <div className="px-2 sm:px-3 text-left">
                <AlertCircle className="w-4 h-4 text-slate-400 mb-1" />
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Payments due</div>
                <div className="text-slate-900 dark:text-white font-bold text-base mt-0.5">
                  {activeDebtors.length > 0 ? `${activeDebtors.length}` : '—'}
                </div>
              </div>
            </div>

            {/* Action Hint Strip (Rose Tinted) */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setActiveDrilldown('debts');
              }}
              className="bg-rose-50 dark:bg-[#200b14] border border-rose-200/80 dark:border-[#521226] hover:border-rose-500/50 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-rose-800 dark:text-rose-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mr-2.5" />
                <span className="truncate">
                  Add customer debts to keep track and get reminded when payments are due.
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
            </div>
          </div>

          {/* 4. SECURITY NOTICE AT BOTTOM */}
          <div className="bg-slate-50 dark:bg-[#050e1a] border border-slate-200/80 dark:border-[#0d1f33] rounded-xl p-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-slate-800 dark:text-slate-300 font-medium block">
                Your business memory is private and secure.
              </span>
              <span className="text-slate-500 text-[11px]">
                Only you and Karra can see this information.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD PRODUCT */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b1726] border border-slate-200 dark:border-[#14263e] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#14263e]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Product to Memory</h3>
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Product / Good Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ankara Fabric, Kaftan, Bag of Rice"
                  value={addProductName}
                  onChange={(e) => setAddProductName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#050e1a] border border-slate-300 dark:border-[#14263e] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Selling Price (₦)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 79000"
                    value={addProductSellingPrice}
                    onChange={(e) =>
                      setAddProductSellingPrice(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full bg-slate-50 dark:bg-[#050e1a] border border-slate-300 dark:border-[#14263e] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Unit Cost (₦)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 64000"
                    value={addProductCost}
                    onChange={(e) =>
                      setAddProductCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full bg-slate-50 dark:bg-[#050e1a] border border-slate-300 dark:border-[#14263e] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="piece, bag, bowl, set"
                    value={addProductUnit}
                    onChange={(e) => setAddProductUnit(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#050e1a] border border-slate-300 dark:border-[#14263e] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Clothing, Provisions, etc."
                    value={addProductCategory}
                    onChange={(e) => setAddProductCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#050e1a] border border-slate-300 dark:border-[#14263e] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewProduct}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE PRODUCT COST */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b1726] border border-slate-200 dark:border-[#14263e] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#14263e]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Update Cost: {editingProduct.name}</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                New Unit Cost (₦)
              </label>
              <input
                type="number"
                value={newProductCost}
                onChange={(e) => setNewProductCost(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#050e1a] border border-slate-300 dark:border-[#14263e] rounded-xl px-3 py-2 text-base text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCost}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                Save Cost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b1726] border border-slate-200 dark:border-[#14263e] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Product</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">{productToDelete.name}</span> from business memory?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteProduct) onDeleteProduct(productToDelete.id, productToDelete.name);
                  setProductToDelete(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SETTLE DEBT CONFIRMATION */}
      {settlingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0b1726] border border-slate-200 dark:border-[#14263e] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Mark Debt as Settled</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirm that <span className="font-bold text-slate-900 dark:text-white">{settlingCustomer.name}</span> has paid their outstanding debt of{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatNaira(settlingCustomer.outstandingBalance)}</span>?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlingCustomer(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSettleDebt(settlingCustomer)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
