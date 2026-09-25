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
import {
  Package,
  Users,
  UserCheck,
  Building2,
  Layers,
  Shield,
  Edit,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Copy,
  Check,
  History,
  ArrowRight,
  Receipt,
  Sparkles,
  X,
} from 'lucide-react';

interface BusinessMemoryViewProps {
  products: ProductMemory[];
  customers: CustomerMemory[];
  suppliers: SupplierMemory[];
  unitRelationships: UnitRelationship[];
  businessRules: BusinessRule[];
  onUpdateProductCost: (productName: string, newCost: number) => void;
  onAddProduct?: (product: ProductMemory) => void;
  onAddUnitRelationship: (rel: UnitRelationship) => void;
  onUpdateCustomerBalance: (customerName: string, newBalance: number) => void;
  onSettleCustomerDebt?: (customerName: string, amount: number) => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  businessName?: string;
  initialSubTab?: 'products' | 'units' | 'debt_list' | 'customer_memory' | 'suppliers' | 'rules';
}

export const BusinessMemoryView: React.FC<BusinessMemoryViewProps> = ({
  products,
  customers,
  suppliers,
  unitRelationships,
  businessRules,
  onUpdateProductCost,
  onAddProduct,
  onAddUnitRelationship,
  onUpdateCustomerBalance,
  onSettleCustomerDebt,
  onShowToast,
  businessName,
  initialSubTab,
}) => {
  const [activeMemorySubTab, setActiveMemorySubTab] = useState<
    'products' | 'units' | 'debt_list' | 'customer_memory' | 'suppliers' | 'rules'
  >(initialSubTab || 'products');
  
  // Add product / memory state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [addProductName, setAddProductName] = useState('');
  const [addProductSellingPrice, setAddProductSellingPrice] = useState<number | ''>('');
  const [addProductCost, setAddProductCost] = useState<number | ''>('');
  const [addProductUnit, setAddProductUnit] = useState('piece');
  const [addProductCategory, setAddProductCategory] = useState('General Goods');

  // Quick edit modal states
  const [editingProduct, setEditingProduct] = useState<ProductMemory | null>(null);
  const [newProductCost, setNewProductCost] = useState<number>(0);

  // Add unit rule states
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [unitParent, setUnitParent] = useState('bag');
  const [unitProduct, setUnitProduct] = useState('Rice');
  const [unitChild, setUnitChild] = useState('bowl');
  const [unitRatio, setUnitRatio] = useState(45);
  const [unitParentCost, setUnitParentCost] = useState(59000);

  // Debt settlement confirmation dialog state
  const [settlingCustomer, setSettlingCustomer] = useState<CustomerMemory | null>(null);

  // Expanded transaction memory state in Customer Memory tab
  const [expandedHistoryCustomerId, setExpandedHistoryCustomerId] = useState<string | null>(null);

  // Copied reminder toast state
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null);

  // Active Debtors: strictly customers with positive outstanding balance
  // Settled debts (balance = 0) are automatically excluded/deleted from this list!
  const activeDebtors = useMemo(() => {
    return customers.filter((c) => (c.outstandingBalance || 0) > 0);
  }, [customers]);

  const totalOutstandingDebt = useMemo(() => {
    return activeDebtors.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  }, [activeDebtors]);

  const handleSaveCost = () => {
    if (editingProduct && newProductCost > 0) {
      onUpdateProductCost(editingProduct.name, newProductCost);
      setEditingProduct(null);
    }
  };

  const handleSaveNewProduct = () => {
    if (!addProductName.trim()) {
      if (onShowToast) onShowToast('Please provide an item or good name', 'warning');
      return;
    }
    const sellingPrice = typeof addProductSellingPrice === 'number' ? addProductSellingPrice : parseFloat(addProductSellingPrice) || 0;
    const cost = typeof addProductCost === 'number' ? addProductCost : parseFloat(addProductCost) || 0;

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
          `Settled ${customer.name}'s debt of ${formatNaira(debtAmount)}. Automatically deleted from Debt List; memory retained in Customer Memory.`,
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

  const subTabs = [
    { id: 'products', label: 'Products & Costs', icon: Package, count: products.length },
    { id: 'units', label: 'Unit Yields', icon: Layers, count: unitRelationships.length },
    { id: 'debt_list', label: 'Debt List', icon: Users, count: activeDebtors.length },
    { id: 'customer_memory', label: 'Customer Memory', icon: UserCheck, count: customers.length },
    { id: 'suppliers', label: 'Suppliers', icon: Building2, count: suppliers.length },
    { id: 'rules', label: 'Guardrails', icon: Shield, count: businessRules.length },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header Overview */}
      <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Business Memory Bank
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/80">
                Continuous Learning
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Facts, unit yields, customer habits, active debt tracking, and cost rules remembered from your daily updates.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsAddingProduct(true);
              setActiveMemorySubTab('products');
            }}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 min-h-[38px] self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Memory</span>
          </button>
        </div>

        {/* Sub-Navigation Tabs (Horizontal swipe on mobile) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-3 pb-1 scrollbar-none touch-pan-x -mx-1 px-1 sm:mx-0 sm:px-0">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMemorySubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMemorySubTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 min-h-[40px] cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 bg-slate-50 dark:bg-slate-800/60 sm:bg-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-slate-700 dark:bg-emerald-800 text-slate-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PRODUCTS TAB */}
      {activeMemorySubTab === 'products' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tracked Goods & Prices ({products.length})
            </span>
            <button
              type="button"
              onClick={() => setIsAddingProduct(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer min-h-[34px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Good / Price</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {products.map((p) => {
              const margin = p.normalSellingPrice - p.currentCost;
              const marginPct = ((margin / p.normalSellingPrice) * 100).toFixed(0);

              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#141b2d] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{p.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.unit}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {p.category} • {p.howLearned || 'Learned from business events'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingProduct(p);
                        setNewProductCost(p.currentCost);
                      }}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center space-x-1 min-h-[36px]"
                      title="Update supplier wholesale cost"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Update Cost</span>
                    </button>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1322] border border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Selling Price</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                        {formatNaira(p.normalSellingPrice)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Unit Cost</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                        {formatNaira(p.currentCost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 block font-medium">Est. Margin</span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 block">
                        {marginPct}% (+{formatNaira(margin)})
                      </span>
                    </div>
                  </div>

                  {/* Bulk yield note if exists */}
                  {p.yieldInfo && (
                    <div className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/80 text-[11px] text-amber-900 dark:text-amber-300">
                      <strong>Yield Rule:</strong> 1 {p.yieldInfo.parentUnit} gives approx{' '}
                      {p.yieldInfo.yieldCount} {p.yieldInfo.childUnit}s (bag cost ₦
                      {p.yieldInfo.parentCost.toLocaleString()} = ~
                      {formatNaira(p.yieldInfo.estimatedUnitCost)}/{p.yieldInfo.childUnit}).
                    </div>
                  )}

                  {/* Cost History Log */}
                  {p.costHistory.length > 1 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center space-x-1 mb-1">
                        <Clock className="w-3 h-3" />
                        <span>Past Locked Costs</span>
                      </span>
                      <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                        {p.costHistory.map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                            <span className="truncate pr-2">{h.date} • {h.note || h.reason || 'Cost updated'}</span>
                            <span className="font-mono font-semibold shrink-0 text-slate-800 dark:text-slate-200">{formatNaira(h.cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Edit Cost Modal (Responsive Bottom Sheet on mobile) */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="w-full sm:max-w-md bg-white dark:bg-[#161f32] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-200 dark:border-slate-700">
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Update Wholesale Cost: {editingProduct.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Previous transactions remain permanently locked to their cost at the time they occurred. Future sales will use this updated cost.
                </p>

                <div className="mt-4">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    New Cost per {editingProduct.unit} (₦)
                  </label>
                  <input
                    type="number"
                    value={newProductCost}
                    onChange={(e) => setNewProductCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white font-mono text-base font-bold min-h-[48px]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 mt-5">
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCost}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 shadow-xs min-h-[40px]"
                  >
                    Save & Remember
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Memory Modal (Goods & Prices) */}
          {isAddingProduct && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="w-full sm:max-w-md bg-white dark:bg-[#161f32] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[92vh] overflow-y-auto">
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-3 sm:hidden" />
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                      <Plus className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Add Good to Memory
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveNewProduct();
                  }}
                  className="space-y-3.5 mt-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Good / Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Semovita 10kg, Palm Oil 5L, Peak Milk..."
                      value={addProductName}
                      onChange={(e) => setAddProductName(e.target.value)}
                      className="w-full p-2.5 sm:p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Selling Price (₦) *
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 7500"
                        value={addProductSellingPrice}
                        onChange={(e) => setAddProductSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full p-2.5 sm:p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Unit Wholesale Cost (₦)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 5200"
                        value={addProductCost}
                        onChange={(e) => setAddProductCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full p-2.5 sm:p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Unit of Sale
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. bag, piece, carton, bottle..."
                        value={addProductUnit}
                        onChange={(e) => setAddProductUnit(e.target.value)}
                        className="w-full p-2.5 sm:p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Category
                      </label>
                      <select
                        value={addProductCategory}
                        onChange={(e) => setAddProductCategory(e.target.value)}
                        className="w-full p-2.5 sm:p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                      >
                        <option value="Food & Grains">Food & Grains</option>
                        <option value="Provisions">Provisions</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Apparel & Fashion">Apparel & Fashion</option>
                        <option value="Household">Household</option>
                        <option value="Cosmetics & Beauty">Cosmetics & Beauty</option>
                        <option value="Electronics">Electronics</option>
                        <option value="General Goods">General Goods</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!addProductName.trim()}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-40 shadow-xs min-h-[40px] cursor-pointer"
                    >
                      Save to Memory
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UNIT RELATIONSHIPS TAB */}
      {activeMemorySubTab === 'units' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bulk-to-retail conversion ratios (e.g. 1 bag of rice = 45 bowls).
            </p>
            <button
              onClick={() => setIsAddingUnit(true)}
              className="flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors min-h-[38px] active:scale-95 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Teach New Unit Ratio</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {unitRelationships.map((rel) => (
              <div
                key={rel.id}
                className="bg-white dark:bg-[#141b2d] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-slate-900 dark:text-white">
                        1 {rel.parentUnit} = {rel.yieldCount || rel.ratio} {rel.childUnit}s
                      </span>
                      {rel.isEstimate && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                          Yield Estimate
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Product: <strong className="text-slate-800 dark:text-slate-200">{rel.productName}</strong>
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1322] border border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Parent Unit Cost</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block font-mono mt-0.5">
                      {formatNaira(rel.parentCost || 0)} / {rel.parentUnit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Derived Child Cost</span>
                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400 block font-mono mt-0.5">
                      ~{formatNaira(rel.estimatedCostPerChild || 0)} / {rel.childUnit}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Source: "{rel.source || 'Business Memory rule'}"
                </p>
              </div>
            ))}
          </div>

          {/* Add Unit Modal (Responsive Bottom Sheet on mobile) */}
          {isAddingUnit && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="w-full sm:max-w-md bg-white dark:bg-[#161f32] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-200 dark:border-slate-700">
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Teach Bulk Yield Relationship
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Example: 1 bag of rice yields approximately 45 bowls.
                </p>

                <div className="space-y-3 mt-4 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Product Name</label>
                    <input
                      type="text"
                      value={unitProduct}
                      onChange={(e) => setUnitProduct(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[42px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Parent Unit</label>
                      <input
                        type="text"
                        value={unitParent}
                        onChange={(e) => setUnitParent(e.target.value)}
                        placeholder="bag / carton"
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[42px]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Parent Cost (₦)</label>
                      <input
                        type="number"
                        value={unitParentCost}
                        onChange={(e) => setUnitParentCost(parseFloat(e.target.value) || 0)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[42px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Yields Count</label>
                      <input
                        type="number"
                        value={unitRatio}
                        onChange={(e) => setUnitRatio(parseInt(e.target.value, 10) || 1)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[42px]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Child Unit</label>
                      <input
                        type="text"
                        value={unitChild}
                        onChange={(e) => setUnitChild(e.target.value)}
                        placeholder="bowl / bottle"
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111726] text-slate-900 dark:text-white min-h-[42px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 mt-5">
                  <button
                    onClick={() => setIsAddingUnit(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUnit}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 min-h-[40px]"
                  >
                    Remember Rule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEBT LIST TAB: Shows active debtors only. Settled debts are automatically deleted while memory is retained */}
      {(activeMemorySubTab === 'debt_list' || (activeMemorySubTab as string) === 'customers') && (
        <div className="space-y-4">
          {/* Informational Banner */}
          <div className="bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Debt List</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                    {activeDebtors.length} Unsettled
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-2xl">
                  Every settled debt is <strong>automatically deleted from this list</strong> as soon as it is paid off. All purchase history, lifetime metrics, and relationship notes are safely preserved in <strong>Customer Memory</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveMemorySubTab('customer_memory')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>View Customer Memory ({customers.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Receivables Summary Bar */}
          {activeDebtors.length > 0 && (
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Active customer accounts with unsettled credit
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                Total Outstanding: <span className="text-rose-600 dark:text-rose-400">{formatNaira(totalOutstandingDebt)}</span>
              </span>
            </div>
          )}

          {/* Empty State: When all debts are settled */}
          {activeDebtors.length === 0 ? (
            <div className="bg-white dark:bg-[#141b2d] rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-800/80 p-8 sm:p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  All Debts Settled & Cleared
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  There are currently zero active debtors on your Debt List. Every settled debt has been automatically deleted from this list, while all historical purchases and customer records remain permanently stored in Customer Memory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveMemorySubTab('customer_memory')}
                className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center space-x-2 transition-colors cursor-pointer shadow-xs"
              >
                <UserCheck className="w-4 h-4" />
                <span>Open Customer Memory & History</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {activeDebtors.map((c) => (
                <div
                  key={c.id}
                  className="bg-white dark:bg-[#141b2d] rounded-2xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs p-4 sm:p-5 space-y-3 transition-all hover:border-amber-300 dark:hover:border-amber-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{c.name}</h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Phone: {c.phone || 'Not recorded'} • Reliability: {c.paymentReliability || 'Medium'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono shrink-0 bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      Owes {formatNaira(c.outstandingBalance)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1322] border border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Total Purchased</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {formatNaira(c.totalPurchased)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Total Paid</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatNaira(c.totalPaid)}
                      </span>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-[#0d1322] p-2 rounded-lg leading-relaxed">
                      "{c.notes}"
                    </p>
                  )}

                  {/* Settle & Reminder Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Debt Actions:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setSettlingCustomer(c)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors min-h-[36px] cursor-pointer"
                        title="Settle debt in full (automatically clears from debt list & retains history in Customer Memory)"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settle Debt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendReminder(c)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold shadow-2xs transition-colors min-h-[36px] cursor-pointer"
                      >
                        {copiedCustomerId === c.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CUSTOMER MEMORY TAB: Complete retained memory of all customers, relationships, and settled debt records */}
      {activeMemorySubTab === 'customer_memory' && (
        <div className="space-y-4">
          {/* Informational Banner */}
          <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Relationship & Memory Bank</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                    {customers.length} Profiles Retained
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-2xl">
                  <strong>Retained Memory:</strong> When debts are settled and automatically deleted from the Debt List, customer relationship records, lifetime purchase volumes, and transaction histories are permanently preserved here.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveMemorySubTab('debt_list')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Active Debt List ({activeDebtors.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Grid of all customers with retained memory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {customers.map((c) => {
              const isSettled = (c.outstandingBalance || 0) <= 0;
              const hasHistory = c.history && c.history.length > 0;
              const isExpanded = expandedHistoryCustomerId === c.id;

              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-[#141b2d] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{c.name}</h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Phone: {c.phone || 'Not recorded'} • Reliability: {c.paymentReliability || 'Medium'}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono shrink-0 flex items-center space-x-1 ${
                        !isSettled
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800'
                      }`}
                    >
                      {isSettled ? (
                        <>
                          <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Debt Settled • Memory Retained</span>
                        </>
                      ) : (
                        <span>Owes {formatNaira(c.outstandingBalance)}</span>
                      )}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0d1322] border border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Lifetime Purchases</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {formatNaira(c.totalPurchased)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Total Payments Received</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatNaira(c.totalPaid)}
                      </span>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-[#0d1322] p-2 rounded-lg leading-relaxed">
                      "{c.notes}"
                    </p>
                  )}

                  {/* Expandable Retained Transaction History */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryCustomerId(isExpanded ? null : c.id)}
                      className="w-full py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center space-x-1.5">
                        <History className="w-3.5 h-3.5 text-slate-400" />
                        <span>Retained Transaction Memory ({c.history?.length || 0})</span>
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {isExpanded ? 'Hide Details' : 'View Memory Logs'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {hasHistory ? (
                          c.history.map((h, idx) => (
                            <div
                              key={h.eventId || idx}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-[#0d1322] border border-slate-100 dark:border-slate-800 text-[11px] flex items-start justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      h.type === 'PAYMENT'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    }`}
                                  >
                                    {h.type}
                                  </span>
                                  <span className="text-slate-400 text-[10px]">{h.date}</span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 leading-snug">{h.description}</p>
                              </div>
                              <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                                {formatNaira(h.amount)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-slate-400 italic py-1 text-center">
                            No ledger events recorded yet for this customer profile.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Settle Debt Button if customer has an active balance */}
                  {!isSettled && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setSettlingCustomer(c)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs transition-colors min-h-[36px] cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settle in Full ({formatNaira(c.outstandingBalance)})</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUPPLIERS TAB */}
      {activeMemorySubTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white dark:bg-[#141b2d] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{s.name}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Phone: {s.phone || 'Not recorded'} • Location: {s.location || 'Local Wholesale Depot'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {s.history.length} purchases
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Supplied Products:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.itemsSupplied.map((item) => (
                      <span key={item} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block">Recorded Prices:</span>
                  <div className="mt-1 space-y-1">
                    {Object.entries(s.typicalPrices || s.currentPrices || {}).map(([item, price]) => (
                      <div key={item} className="flex justify-between font-mono text-[11px] sm:text-xs">
                        <span className="text-slate-600 dark:text-slate-400">{item}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{formatNaira(typeof price === 'number' ? price : 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BUSINESS GUARDRAILS & RULES TAB */}
      {activeMemorySubTab === 'rules' && (
        <div className="space-y-2.5 sm:space-y-3">
          {businessRules.map((rule) => (
            <div
              key={rule.id}
              className="bg-white dark:bg-[#141b2d] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-5 flex items-start space-x-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{rule.headline || rule.ruleName || rule.category}</h3>
                  <span className="text-xs font-mono font-bold text-violet-800 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 px-2 py-0.5 rounded shrink-0">
                    {typeof rule.ruleValue === 'number'
                      ? formatNaira(rule.ruleValue)
                      : rule.ruleValue || (rule.active ? 'Active' : 'Disabled')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{rule.summary || rule.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Debt Settlement Confirmation Dialog */}
      {settlingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Debt Settlement
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Mark <strong className="text-slate-900 dark:text-white">{settlingCustomer.name}</strong>'s balance of{' '}
                  <strong className="text-emerald-800 dark:text-emerald-400 font-mono font-bold">
                    {formatNaira(settlingCustomer.outstandingBalance)}
                  </strong>{' '}
                  as fully settled?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0d1322] border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-start text-slate-700 dark:text-slate-300 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 mr-2 mt-0.5 shrink-0" />
                <span><strong>Automatic Deletion:</strong> Settled debt is deleted automatically from the Debt List.</span>
              </div>
              <div className="flex items-start text-slate-700 dark:text-slate-300 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 mr-2 mt-0.5 shrink-0" />
                <span><strong>Retained Memory:</strong> Customer profile, purchase history, and reliability logs remain permanently preserved in Customer Memory.</span>
              </div>
              <div className="flex items-start text-slate-700 dark:text-slate-300 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 mr-2 mt-0.5 shrink-0" />
                <span><strong>Cash Flow Logged:</strong> A debt payment event is automatically added to today's ledger cash collections.</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSettlingCustomer(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSettleDebt(settlingCustomer)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px] shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Settlement & Clear Debt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
