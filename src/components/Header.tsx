import React from 'react';
import {
  Sparkles,
  Calendar,
  BookOpen,
  Clock,
  HelpCircle,
  RefreshCw,
  MessageSquare,
  Sun,
  Moon,
  FileText,
  User,
} from 'lucide-react';
import { NavigationTab, BusinessState } from '../types';
import { KarraLogo } from './KarraLogo';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  businessName: string;
  businessState: BusinessState;
  onOpenOnboarding: () => void;
  onResetDemo: () => void;
  onClearLedger?: () => void;
  onOpenReports: () => void;
  onOpenFeedback?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  businessName,
  businessState,
  onOpenOnboarding,
  onResetDemo,
  onClearLedger,
  onOpenReports,
  onOpenFeedback,
  theme,
  onToggleTheme,
  onShowToast,
}) => {
  return (
    <>
      {/* Top Main App Header - Hidden on Ask AI per user request */}
      {activeTab !== 'questions' && (
        <header className="shrink-0 sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Business Identity */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1 md:flex-initial">
            <KarraLogo size="sm" variant="green-bg" />
            <h1
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[200px] xs:max-w-xs sm:max-w-sm md:max-w-md"
              title={businessName || 'My Business'}
            >
              {businessName || 'My Business'}
            </h1>
          </div>

          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Today</span>
            </button>

            <button
              id="tab-calendar"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Calendar</span>
            </button>

            <button
              id="tab-timeline"
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'timeline'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Transactions</span>
            </button>

            <button
              id="tab-memory"
              onClick={() => setActiveTab('memory')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'memory'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span>Memory</span>
            </button>

            <button
              id="tab-questions"
              onClick={() => setActiveTab('questions')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                (activeTab as string) === 'questions'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Ask AI</span>
            </button>

            <button
              id="tab-profile"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'profile'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Profile</span>
            </button>
          </nav>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {/* Download Reports Trigger */}
            <button
              id="btn-header-reports"
              type="button"
              onClick={onOpenReports}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer min-h-[36px]"
              title="Download Weekly, Monthly, or Yearly Financial Reports"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400 dark:text-white" />
              <span>Reports</span>
            </button>

            {/* Profile Quick Button (Shown on desktop/tablet; on phone it's in the bottom dock) */}
            <button
              id="btn-header-profile-quick"
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all min-h-[36px] cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                  : 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
              title="Store Profile & Bank Details"
            >
              <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Profile</span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              id="btn-toggle-theme"
              type="button"
              onClick={onToggleTheme}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors min-h-[36px]"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            <button
              id="btn-reset-demo"
              onClick={onResetDemo}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors min-h-[36px]"
              title="Load Sample Nigerian Demo Store"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Sample Demo</span>
            </button>

            <button
              id="btn-onboarding-help"
              onClick={onOpenOnboarding}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors min-h-[36px]"
              title="Business Intro Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Guide</span>
            </button>
          </div>
        </div>
      </header>
      )}

      {/* Mobile-First Bottom Navigation Dock (Optimized for one-handed thumb navigation + iOS home bar padding) */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 px-1 py-1 sm:px-2 shadow-lg pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-6 gap-0.5 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[10px] font-bold transition-all min-h-[46px] active:scale-95 touch-manipulation ${
              activeTab === 'dashboard'
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/50 shadow-2xs font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className={`w-4 h-4 mb-0.5 ${activeTab === 'dashboard' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="truncate">Today</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[10px] font-bold transition-all min-h-[46px] active:scale-95 touch-manipulation ${
              activeTab === 'calendar'
                ? 'text-blue-700 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50 shadow-2xs font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className={`w-4 h-4 mb-0.5 ${activeTab === 'calendar' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="truncate">Calendar</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[10px] font-bold transition-all min-h-[46px] active:scale-95 touch-manipulation ${
              activeTab === 'timeline'
                ? 'text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/50 shadow-2xs font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className={`w-4 h-4 mb-0.5 ${activeTab === 'timeline' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="truncate">Transactions</span>
          </button>

          <button
            onClick={() => setActiveTab('memory')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[10px] font-bold transition-all min-h-[46px] active:scale-95 touch-manipulation ${
              activeTab === 'memory'
                ? 'text-violet-700 dark:text-violet-400 bg-violet-50/80 dark:bg-violet-950/50 shadow-2xs font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className={`w-4 h-4 mb-0.5 ${activeTab === 'memory' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="truncate">Memory</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[10px] font-bold transition-all min-h-[46px] active:scale-95 touch-manipulation ${
              activeTab === 'questions'
                ? 'text-rose-700 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/50 shadow-2xs font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className={`w-4 h-4 mb-0.5 ${activeTab === 'questions' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="truncate">Ask AI</span>
          </button>

          <button
            id="tab-mobile-profile"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl text-[10px] font-bold transition-all min-h-[46px] active:scale-95 touch-manipulation ${
              activeTab === 'profile'
                ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-2xs font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className={`w-4 h-4 mb-0.5 ${activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className="truncate">Profile</span>
          </button>
        </div>
      </nav>
    </>
  );
};
