import React from 'react';
import {
  X,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  FileText,
  Clock,
  ArrowRight,
  Phone,
  MessageCircle,
  Users,
  CheckCircle2,
  DollarSign,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { BusinessPulseItem, CustomerMemory, BusinessEvent } from '../types';
import { formatNaira } from '../engine/calculations';

interface InsightActionModalProps {
  insight: BusinessPulseItem | null;
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerMemory[];
  events: BusinessEvent[];
  onOpenReport: (period: 'weekly' | 'monthly' | 'yearly') => void;
  onNavigateToTab: (tab: 'dashboard' | 'calendar' | 'timeline' | 'memory' | 'questions', filter?: string) => void;
  onShowToast: (message: string, type?: 'info' | 'success') => void;
  onSettleCustomerDebt?: (customerName: string, amount: number) => void;
}

export const InsightActionModal: React.FC<InsightActionModalProps> = ({
  insight,
  isOpen,
  onClose,
  customers,
  events,
  onOpenReport,
  onNavigateToTab,
  onShowToast,
  onSettleCustomerDebt,
}) => {
  if (!isOpen || !insight) return null;

  const isSalesInsight =
    insight.actionType === 'WEEKLY_REPORT' ||
    insight.id === 'pulse-1' ||
    insight.id === 'pulse-sales' ||
    insight.title.toLowerCase().includes('sale');

  const isExpenseInsight =
    insight.actionType === 'AUDIT_EXPENSES' ||
    insight.id === 'pulse-2' ||
    insight.id === 'pulse-expenses' ||
    insight.title.toLowerCase().includes('transport') ||
    insight.title.toLowerCase().includes('expense');

  const isDebtInsight =
    insight.actionType === 'COLLECT_DEBTS' ||
    insight.id === 'pulse-3' ||
    insight.id === 'pulse-debts' ||
    insight.title.toLowerCase().includes('debt') ||
    insight.title.toLowerCase().includes('outstanding') ||
    insight.title.toLowerCase().includes('credit');

  const isProductInsight =
    insight.actionType === 'PRODUCT_OPPORTUNITY' ||
    insight.id === 'pulse-4' ||
    insight.id === 'pulse-products' ||
    insight.title.toLowerCase().includes('product') ||
    insight.title.toLowerCase().includes('yield') ||
    insight.title.toLowerCase().includes('rice');

  // Filter active debtors
  const activeDebtors = customers.filter((c) => c.outstandingBalance > 0);

  // Filter transport / recent expenses
  const transportExpenses = events.filter(
    (ev) =>
      !ev.isCorrected &&
      (ev.type === 'EXPENSE' ||
        (ev.expenseCategory && ev.expenseCategory.toLowerCase().includes('transport')) ||
        (ev.rawUserText && ev.rawUserText.toLowerCase().includes('transport')))
  );

  const handleSendWhatsAppReminder = (debtorName: string, amount: number, phone?: string) => {
    const text = encodeURIComponent(
      `Hello ${debtorName}, gentle reminder regarding your outstanding balance of ${formatNaira(amount)} with our business. Please let us know when you can complete the payment. Thank you!`
    );
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
    onShowToast(`Opened WhatsApp reminder template for ${debtorName}`, 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="insight-action-dialog"
        className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 shadow-2xs">
              {isSalesInsight && <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {isExpenseInsight && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              {isDebtInsight && <Users className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {isProductInsight && <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              {!isSalesInsight && !isExpenseInsight && !isDebtInsight && !isProductInsight && (
                <CheckCircle2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Actionable Insight
                </span>
                {insight.metric && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {insight.metric}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                {insight.title}
              </h3>
            </div>
          </div>

          <button
            id="btn-close-insight-action"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
            {insight.message}
          </p>

          {/* Sales Insight Special Actions */}
          {isSalesInsight && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recommended Operational Actions
              </h4>

              <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      Download Weekly Financial Statement
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Export your 7-day revenue, net margin, and product yield breakdown as a high-res PDF or CSV.
                    </p>
                  </div>
                  <button
                    id="btn-act-open-weekly-report"
                    onClick={() => {
                      onClose();
                      onOpenReport('weekly');
                    }}
                    className="shrink-0 ml-3 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open Report</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                    Inspect Sales Transactions
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Review all recorded sales events in the transactions ledger.
                  </p>
                </div>
                <button
                  id="btn-act-view-sales-timeline"
                  onClick={() => {
                    onClose();
                    onNavigateToTab('timeline', 'SALE');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center space-x-1 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>View Transactions</span>
                </button>
              </div>
            </div>
          )}

          {/* Expense Insight Special Actions */}
          {isExpenseInsight && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expense Breakdown & Optimization
              </h4>

              <div className="space-y-2">
                {transportExpenses.slice(0, 3).map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {exp.rawUserText || 'Transport Expense'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {exp.date} • {exp.timeStr || 'Recorded'}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {formatNaira(exp.expenseAmount || 0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                    Audit All Expenses in Transactions
                  </h5>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Filter by expense events to check invoices, correct amounts, or reassign categories.
                  </p>
                </div>
                <button
                  id="btn-act-filter-expenses"
                  onClick={() => {
                    onClose();
                    onNavigateToTab('timeline', 'EXPENSE');
                  }}
                  className="shrink-0 ml-3 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Audit Expenses</span>
                </button>
              </div>

              <button
                id="btn-act-open-monthly-expense-report"
                onClick={() => {
                  onClose();
                  onOpenReport('monthly');
                }}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>View Full Monthly Cost Report</span>
              </button>
            </div>
          )}

          {/* Debt Insight Special Actions */}
          {isDebtInsight && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Outstanding Customer Debts ({activeDebtors.length})
                </h4>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Total: {formatNaira(activeDebtors.reduce((sum, d) => sum + d.outstandingBalance, 0))}
                </span>
              </div>

              <div className="space-y-2">
                {activeDebtors.map((debtor) => (
                  <div
                    key={debtor.id}
                    className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/60 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {debtor.name}
                        </span>
                        {debtor.phone && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {debtor.phone}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Purchased: {formatNaira(debtor.totalPurchased)} • Paid: {formatNaira(debtor.totalPaid)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right mr-1">
                        <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                          {formatNaira(debtor.outstandingBalance)}
                        </div>
                        <div className="text-[10px] text-slate-400">Owed</div>
                      </div>

                      {onSettleCustomerDebt && (
                        <button
                          id={`btn-settle-${debtor.id}`}
                          onClick={() => {
                            onSettleCustomerDebt(debtor.name, debtor.outstandingBalance);
                            if (activeDebtors.length <= 1) {
                              onClose();
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                          title="Settle debt in full (automatically clears from debt list & retains history)"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Settle</span>
                        </button>
                      )}

                      <button
                        id={`btn-whatsapp-${debtor.id}`}
                        onClick={() =>
                          handleSendWhatsAppReminder(debtor.name, debtor.outstandingBalance, debtor.phone)
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-1 transition-colors shadow-2xs"
                        title="Send polite WhatsApp payment reminder"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  id="btn-act-manage-debtors-memory"
                  onClick={() => {
                    onClose();
                    onNavigateToTab('memory');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Manage All Customers in Memory</span>
                </button>
              </div>
            </div>
          )}

          {/* Product Opportunity Special Actions */}
          {isProductInsight && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Inventory Yield & Margin Opportunity
              </h4>

              <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20">
                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span>Yield conversion:</span>
                    <span className="text-slate-900 dark:text-white">1 Bag (~50kg) = ~45 Selling Bowls</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wholesale Bag Cost:</span>
                    <span>₦59,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bowl Selling Price:</span>
                    <span>₦2,000 / bowl</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                    <span>Estimated Profit per Bag:</span>
                    <span>₦31,000 (~52% margin)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="btn-act-view-yield-memory"
                  onClick={() => {
                    onClose();
                    onNavigateToTab('memory');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>View Product Yields in Memory</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Karra Contextual Action Engine
          </span>
          <button
            id="btn-dismiss-insight-action"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
