import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  Calendar,
  DollarSign,
  Package,
  Receipt,
  Users,
  CheckCircle2,
  Percent,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Building2,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react';
import { ReportPeriod, BusinessState, BusinessReportData } from '../types';
import {
  generateBusinessReport,
  exportReportToCSV,
  exportReportToPDF,
  exportReportToPrintableHTML,
  formatNaira,
} from '../engine/calculations';
import { getTodayDateStr } from '../utils/dateUtils';

interface BusinessReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: BusinessState;
  initialPeriod?: ReportPeriod;
  referenceDate?: string;
  onShowToast: (message: string, type?: 'info' | 'success') => void;
}

export const BusinessReportModal: React.FC<BusinessReportModalProps> = ({
  isOpen,
  onClose,
  state,
  initialPeriod = 'weekly',
  referenceDate = getTodayDateStr(),
  onShowToast,
}) => {
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  // Synchronize initialPeriod when modal opens
  React.useEffect(() => {
    if (initialPeriod) {
      setPeriod(initialPeriod);
    }
  }, [initialPeriod, isOpen]);

  // Compute report data deterministically
  const report: BusinessReportData = useMemo(() => {
    return generateBusinessReport(state.events, state.customers, period, referenceDate);
  }, [state.events, state.customers, period, referenceDate]);

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    try {
      exportReportToPDF(report, state.businessName);
      onShowToast(`Downloaded ${period} financial report PDF to your device.`, 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      exportReportToPrintableHTML(report, state.businessName);
      onShowToast(`Opened ${period} report printable view.`, 'info');
    }
  };

  const handleDownloadCSV = () => {
    exportReportToCSV(report, state.businessName);
    onShowToast(`Downloaded ${period} financial report spreadsheet (CSV).`, 'success');
  };

  const handlePrintReport = () => {
    exportReportToPrintableHTML(report, state.businessName);
    onShowToast(`Triggered ${period} report printable view.`, 'info');
  };

  // SVG Chart Geometry Calculations
  const trendData = report.dailyTrend;
  const maxMetric = Math.max(
    ...trendData.map((d) => Math.max(d.sales, d.expenses, Math.max(0, d.profit))),
    10000
  );

  const chartWidth = 640;
  const chartHeight = 220;
  const chartPadding = { top: 24, right: 24, bottom: 36, left: 48 };

  const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;

  const getX = (index: number) => {
    if (trendData.length <= 1) return chartPadding.left + usableWidth / 2;
    return chartPadding.left + (index / (trendData.length - 1)) * usableWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, val);
    return chartPadding.top + usableHeight - (clamped / maxMetric) * usableHeight;
  };

  // Generate SVG path for Sales area
  const salesPoints = trendData.map((d, i) => `${getX(i)},${getY(d.sales)}`).join(' ');
  const salesAreaPath =
    trendData.length > 0
      ? `M ${getX(0)},${chartPadding.top + usableHeight} L ${salesPoints.replace(/ /g, ' L ')} L ${getX(trendData.length - 1)},${chartPadding.top + usableHeight} Z`
      : '';

  // Generate SVG path for Profit line
  const profitPoints = trendData.map((d, i) => `${getX(i)},${getY(d.profit)}`).join(' ');
  const profitAreaPath =
    trendData.length > 0
      ? `M ${getX(0)},${chartPadding.top + usableHeight} L ${profitPoints.replace(/ /g, ' L ')} L ${getX(trendData.length - 1)},${chartPadding.top + usableHeight} Z`
      : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="business-report-modal"
        className="bg-white dark:bg-[#0E1422] border border-slate-200/90 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                Official Business Ledger
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {state.businessName}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 tracking-tight">
              {report.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Period: <span className="font-semibold text-slate-700 dark:text-slate-200">{report.dateRangeLabel}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            {/* Period Switcher Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700">
              <button
                id="btn-report-weekly"
                type="button"
                onClick={() => setPeriod('weekly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  period === 'weekly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Weekly
              </button>
              <button
                id="btn-report-monthly"
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  period === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                id="btn-report-yearly"
                type="button"
                onClick={() => setPeriod('yearly')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  period === 'yearly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Yearly
              </button>
            </div>

            <button
              id="btn-close-report-modal"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close report modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Action Download Bar */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-slate-50 to-blue-500/10 dark:from-emerald-950/30 dark:via-[#131B2D] dark:to-blue-950/20 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Export & Share Business Report
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Save as a formatted, high-resolution PDF document or download raw accounting data in CSV.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                id="btn-download-pdf-report"
                type="button"
                onClick={handleDownloadPDF}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer min-h-[38px]"
                title="Directly download high-resolution .pdf document"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>

              <button
                id="btn-download-csv-report"
                type="button"
                onClick={handleDownloadCSV}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 shadow-2xs flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer min-h-[38px]"
                title="Download raw spreadsheet data in .csv format"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                id="btn-print-report"
                type="button"
                onClick={handlePrintReport}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer min-h-[38px]"
                title="Print report or preview via browser dialog"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Executive Performance Summary Box */}
          <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center space-x-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Executive Operational Summary
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {report.summaryExecutiveText}
            </p>
          </div>

          {/* 4 Primary Financial KPI Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Sales Revenue */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B2D] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  Gross Sales
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              </div>
              <div className="text-base xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 truncate font-mono">
                {formatNaira(report.totalSales)}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center truncate">
                <span>{report.totalTransactions} recorded sales</span>
              </div>
            </div>

            {/* Cost of Goods Sold */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B2D] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  Product Costs
                </span>
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              </div>
              <div className="text-base xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 truncate font-mono">
                {formatNaira(report.totalCostOfGoods)}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                <span>{report.totalItemsSold} items moved</span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131B2D] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                  Expenses
                </span>
                <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              </div>
              <div className="text-base xs:text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 truncate font-mono">
                {formatNaira(report.totalExpenses)}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                <span>{report.expensesByCategory.length} active categories</span>
              </div>
            </div>

            {/* Net Profit */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-200/90 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/70 to-white dark:from-emerald-950/40 dark:to-[#131B2D] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 truncate">
                  Net Result
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 text-white shrink-0">
                  {report.netMarginPercent.toFixed(1)}%
                </span>
              </div>
              <div
                className={`text-base xs:text-xl sm:text-2xl font-black mt-1 truncate font-mono ${
                  report.netProfit >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatNaira(report.netProfit)}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                <span>Estimated take-home profit</span>
              </div>
            </div>
          </div>

          {/* Graphically Top-Notch Performance Chart (Interactive SVG) */}
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Financial Trajectory & Cash Velocity
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visual revenue generation versus operating expenditure over the {period} horizon
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center space-x-4 text-xs font-semibold">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-xs bg-emerald-500" />
                  <span className="text-slate-700 dark:text-slate-300">Sales</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-xs bg-blue-500" />
                  <span className="text-slate-700 dark:text-slate-300">Net Profit</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-xs bg-amber-500" />
                  <span className="text-slate-700 dark:text-slate-300">Expenses</span>
                </div>
              </div>
            </div>

            {/* Responsive SVG Container */}
            <div className="w-full overflow-x-auto">
              <div className="min-w-[500px]">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-auto overflow-visible select-none"
                >
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const y = chartPadding.top + usableHeight * (1 - ratio);
                    const val = maxMetric * ratio;
                    return (
                      <g key={i}>
                        <line
                          x1={chartPadding.left}
                          y1={y}
                          x2={chartWidth - chartPadding.right}
                          y2={y}
                          stroke="currentColor"
                          className="text-slate-200 dark:text-slate-800"
                          strokeDasharray={ratio === 0 ? undefined : '4 4'}
                        />
                        <text
                          x={chartPadding.left - 8}
                          y={y + 3}
                          textAnchor="end"
                          className="text-[10px] fill-slate-400 dark:fill-slate-500"
                        >
                          {formatNaira(val, true)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Shaded Area for Sales */}
                  {salesAreaPath && (
                    <path d={salesAreaPath} fill="url(#salesGradient)" />
                  )}

                  {/* Shaded Area for Profit */}
                  {profitAreaPath && (
                    <path d={profitAreaPath} fill="url(#profitGradient)" />
                  )}

                  {/* Sales Curve Line */}
                  <polyline
                    points={salesPoints}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Profit Curve Line */}
                  <polyline
                    points={profitPoints}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Expense Bars / Markers */}
                  {trendData.map((d, i) => {
                    const x = getX(i);
                    const barWidth = 14;
                    const expHeight = (Math.max(0, d.expenses) / maxMetric) * usableHeight;
                    const expY = chartPadding.top + usableHeight - expHeight;
                    const isHovered = hoveredTrendIndex === i;

                    return (
                      <g
                        key={i}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredTrendIndex(i)}
                        onMouseLeave={() => setHoveredTrendIndex(null)}
                      >
                        {/* Expense Bar */}
                        {d.expenses > 0 && (
                          <rect
                            x={x - barWidth / 2}
                            y={expY}
                            width={barWidth}
                            height={expHeight}
                            rx="3"
                            fill="#f59e0b"
                            opacity={isHovered ? 1 : 0.75}
                          />
                        )}

                        {/* Sales Data Point */}
                        <circle
                          cx={x}
                          cy={getY(d.sales)}
                          r={isHovered ? 5 : 3.5}
                          fill="#ffffff"
                          stroke="#10b981"
                          strokeWidth="1.0"
                          className="transition-all"
                        />

                        {/* Profit Data Point */}
                        <circle
                          cx={x}
                          cy={getY(d.profit)}
                          r={isHovered ? 4.5 : 3}
                          fill="#ffffff"
                          stroke="#3b82f6"
                          strokeWidth="1.0"
                          className="transition-all"
                        />

                        {/* X-axis Label */}
                        <text
                          x={x}
                          y={chartHeight - 10}
                          textAnchor="middle"
                          className={`text-[10px] font-semibold transition-colors ${
                            isHovered
                              ? 'fill-slate-900 dark:fill-white font-bold'
                              : 'fill-slate-500 dark:fill-slate-400'
                          }`}
                        >
                          {d.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Dynamic Hover Tooltip Card */}
            {hoveredTrendIndex !== null && trendData[hoveredTrendIndex] && (
              <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Period: <span className="text-emerald-600 dark:text-emerald-400">{trendData[hoveredTrendIndex].label}</span>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Sales:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNaira(trendData[hoveredTrendIndex].sales)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Expenses:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {formatNaira(trendData[hoveredTrendIndex].expenses)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Net Profit:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {formatNaira(trendData[hoveredTrendIndex].profit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Cash Collected:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {formatNaira(trendData[hoveredTrendIndex].cash)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Inventory Performance & Yield Margins */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Products Table (2 cols) */}
            <div className="lg:col-span-2 p-4 sm:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Top Selling Products & Margins
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">
                  {report.topProducts.length} items logged
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/60 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-2">Product</th>
                      <th className="pb-2 text-right">Units</th>
                      <th className="pb-2 text-right">Revenue</th>
                      <th className="pb-2 text-right">Profit</th>
                      <th className="pb-2 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {report.topProducts.length > 0 ? (
                      report.topProducts.map((prod) => (
                        <tr key={prod.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {prod.name}
                          </td>
                          <td className="py-2.5 text-right text-slate-600 dark:text-slate-300 font-medium">
                            {prod.quantity}
                          </td>
                          <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                            {formatNaira(prod.revenue)}
                          </td>
                          <td className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatNaira(prod.profit)}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {prod.marginPercent}%
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          No product transactions recorded during this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Operating Expenses Breakdown (1 col) */}
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Expense Distribution
                  </h4>
                </div>

                <div className="space-y-3">
                  {report.expensesByCategory.length > 0 ? (
                    report.expensesByCategory.map((exp) => (
                      <div key={exp.category} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <span>{exp.category}</span>
                          <span>{formatNaira(exp.amount)}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${exp.percentage}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-right text-slate-400 font-medium">
                          {exp.percentage}% of expenses
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No operating expenses recorded.
                    </div>
                  )}
                </div>
              </div>

              {/* Liquid Cash vs Credit Extended mini-box */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-lg">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Liquid Cash Collected:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNaira(report.cashReceived)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Credit Given to Buyers:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {formatNaira(report.creditGiven)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Cash Collection Ratio:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {report.cashCollectionRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Active Debtors & Collections */}
          {report.activeDebtors.length > 0 && (
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] shadow-2xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Outstanding Customer Debt Schedule
                  </h4>
                </div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Total Receivables: {formatNaira(report.activeDebtors.reduce((sum, d) => sum + d.outstandingBalance, 0))}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.activeDebtors.map((debtor) => (
                  <div
                    key={debtor.customerName}
                    className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {debtor.customerName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {debtor.phone || 'No phone recorded'} • Last: {debtor.lastActivityDate}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                        {formatNaira(debtor.outstandingBalance)}
                      </div>
                      <button
                        id={`btn-report-whatsapp-${debtor.customerName}`}
                        onClick={() => {
                          const text = encodeURIComponent(
                            `Hello ${debtor.customerName}, gentle reminder regarding your balance of ${formatNaira(debtor.outstandingBalance)} with ${state.businessName}. Thank you!`
                          );
                          const cleanPhone = debtor.phone ? debtor.phone.replace(/[^0-9]/g, '') : '';
                          window.open(
                            cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`,
                            '_blank'
                          );
                        }}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center space-x-0.5 mt-0.5"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Deterministic financial reconciliation • No estimation guessing</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              id="btn-footer-close-report"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              id="btn-footer-download-pdf"
              type="button"
              onClick={handleDownloadPDF}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {period.toUpperCase()} PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
