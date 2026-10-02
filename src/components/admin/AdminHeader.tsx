import React, { useState } from 'react';
import {
  Calendar,
  RefreshCw,
  Menu,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { AdminDateRange } from './adminTypes';

interface AdminHeaderProps {
  title: string;
  subtitle: string;
  dateRange: AdminDateRange;
  onDateRangeChange: (range: AdminDateRange) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomDatesChange: (start: string, end: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenMobileMenu: () => void;
  onSignOut: () => void;
  lastUpdated?: Date | null;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  subtitle,
  dateRange,
  onDateRangeChange,
  customStartDate,
  customEndDate,
  onCustomDatesChange,
  onRefresh,
  isRefreshing,
  onOpenMobileMenu,
  onSignOut,
  lastUpdated,
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [localStart, setLocalStart] = useState(customStartDate);
  const [localEnd, setLocalEnd] = useState(customEndDate);

  const rangeButtons: { id: AdminDateRange; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
    { id: 'custom', label: 'Custom' },
  ];

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (localStart && localEnd) {
      onCustomDatesChange(localStart, localEnd);
      onDateRangeChange('custom');
      setShowCustomModal(false);
    }
  };

  return (
    <header className="border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Mobile Toggle + Title & Subtitle */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>{title}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>Live Data</span>
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-normal">{subtitle}</p>
          </div>
        </div>

        {/* Right: Date Range Selector + Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Date Range Button Pill */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            {rangeButtons.map((btn) => {
              const isSelected = dateRange === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    if (btn.id === 'custom') {
                      setShowCustomModal(true);
                    } else {
                      onDateRangeChange(btn.id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden md:inline">Refresh</span>
          </button>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 transition-colors cursor-pointer"
            title="Sign out of Admin Session"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden xl:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Popover / Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Select Custom Date Range
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleApplyCustom} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={localStart}
                  onChange={(e) => setLocalStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
                >
                  Apply Range
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
