import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  User,
  Briefcase,
  Settings,
  Bell,
  Shield,
  Palette,
  LogOut,
  Mail,
  ChevronRight,
  LineChart,
  Edit3,
  Check,
  X,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Sparkles,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BusinessState, BusinessProfile } from '../types';
import { formatNaira } from '../engine/calculations';
import { NotificationPreferences } from '../types/notification';

interface BusinessProfileViewProps {
  state: BusinessState;
  onUpdateProfile: (profile: BusinessProfile) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
  onClearLedger?: () => void;
  onResetDemo?: () => void;
  onBack?: () => void;
  onOpenBusinessOverview?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenNotificationSettings?: () => void;
  notificationPreferences?: NotificationPreferences;
}

const BUSINESS_CATEGORIES = [
  'General Retail & Provisions',
  'Fashion, Fabrics & Tailoring',
  'Electronics & Phone Accessories',
  'Food, Restaurant & Catering',
  'Cosmetics, Salon & Barbershop',
  'Building Materials & Hardware',
  'Pharmacy, Chemist & Healthcare',
  'Automobile Parts & Repairs',
  'Agriculture, Farm Produce & Feeds',
  'Professional Services & Agency',
  'Other Commerce',
];

export const BusinessProfileView: React.FC<BusinessProfileViewProps> = ({
  state,
  onUpdateProfile,
  onShowToast,
  onClearLedger,
  onResetDemo,
  onBack,
  onOpenBusinessOverview,
  theme = 'dark',
  onToggleTheme,
  onOpenNotificationSettings,
  notificationPreferences,
}) => {
  const { user, userProfile, signOut } = useAuth();

  const actualBusinessName =
    userProfile?.businessName || state.businessName || 'My Business';
  const actualOwnerName =
    userProfile?.displayName || user?.displayName || state.ownerName || 'Merchant';
  const actualEmail =
    user?.email || userProfile?.email || state.profile?.email || 'Your email address';

  const currentProfile: BusinessProfile = useMemo(() => {
    return {
      businessName: actualBusinessName,
      ownerName: actualOwnerName,
      category: state.profile?.category || 'General Retail & Provisions',
      tagline: state.profile?.tagline || '',
      phone: state.profile?.phone || '',
      email: actualEmail,
      address: state.profile?.address || '',
      cityState: state.profile?.cityState || 'Lagos, Nigeria',
      currency: state.profile?.currency || state.currency || 'NGN (₦)',
      openingHours: state.profile?.openingHours || 'Mon – Sat: 8:00 AM – 7:00 PM',
      foundedYear: state.profile?.foundedYear || new Date().getFullYear().toString(),
      registrationNumber: state.profile?.registrationNumber || '',
      paymentMethods: state.profile?.paymentMethods || ['Cash Settlement', 'Bank Transfer'],
      bankDetails: state.profile?.bankDetails || {
        bankName: '',
        accountNumber: '',
        accountName: '',
      },
      creditLimitPolicy: state.profile?.creditLimitPolicy || 0,
      lowStockThreshold: state.profile?.lowStockThreshold || 5,
    };
  }, [state.profile, state.businessName, state.ownerName, state.currency, user, userProfile, actualBusinessName, actualOwnerName, actualEmail]);

  const [isEditingBusinessInfo, setIsEditingBusinessInfo] = useState(false);
  const [formData, setFormData] = useState<BusinessProfile>(currentProfile);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Sync formData with currentProfile when not editing
  React.useEffect(() => {
    if (!isEditingBusinessInfo) {
      setFormData(currentProfile);
    }
  }, [currentProfile, isEditingBusinessInfo]);

  const handleSaveBusinessInfo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.businessName.trim()) {
      onShowToast('Business name is required.', 'warning');
      return;
    }
    onUpdateProfile(formData);
    setIsEditingBusinessInfo(false);
    onShowToast('Business details updated successfully.', 'success');
  };

  // Live business overview metrics for profile
  const totalSales = state.events
    .filter((e) => e.type === 'SALE' && !e.isCorrected)
    .reduce((sum, e) => sum + (e.totalRevenue || 0), 0);

  const totalExpenses = state.events
    .filter((e) => e.type === 'EXPENSE' && !e.isCorrected)
    .reduce((sum, e) => sum + (e.expenseAmount || 0), 0);

  const totalOutstandingDebts = state.customers.reduce(
    (sum, c) => sum + (c.outstandingBalance || 0),
    0
  );

  const totalStockItems = state.products.reduce(
    (sum, p) => sum + (p.currentStock !== undefined ? p.currentStock : 0),
    0
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 text-slate-900 dark:text-slate-100 pb-20 animate-in fade-in duration-200">
      {/* 1. Header with Back Button */}
      <div className="flex items-center space-x-3.5 pb-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#0D1B2A] hover:bg-slate-100 dark:hover:bg-[#16273C] border border-slate-200 dark:border-[#1A2C40] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-xs"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your account and business details
          </p>
        </div>
      </div>

      {/* 2. User Identity Card */}
      <div className="bg-white dark:bg-[#0D1B2A] border border-slate-200/90 dark:border-[#1A2C40] rounded-2xl p-4 sm:p-5 flex items-center justify-between shadow-xs dark:shadow-lg">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-[#18283D] border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {formData.ownerName || 'Merchant'}
              </h2>
              {formData.registrationNumber?.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0" title="CAC Verified Business">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formData.businessName || 'Business Owner'}
            </p>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="truncate">{formData.email || 'Your email address'}</span>
            </div>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
      </div>

      {/* 3. Business Overview Card (Clicking takes user to Daily Sales Volume Trend with necessary data) */}
      <div
        onClick={() => {
          if (onOpenBusinessOverview) {
            onOpenBusinessOverview();
          }
        }}
        className="bg-white dark:bg-[#0D1B2A] border border-slate-200/90 dark:border-[#1A2C40] hover:border-emerald-500/60 dark:hover:border-emerald-500/60 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group shadow-xs dark:shadow-lg hover:shadow-md"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-[#1A2C40]/80 mb-3.5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-[#132B45] text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-500/20 group-hover:scale-105 transition-transform">
              <LineChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Business Overview
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                  Daily Sales Trend →
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click to view daily sales volume trend, charts, and financial performance
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-0 sm:divide-x sm:divide-slate-100 dark:sm:divide-[#1A2C40]/80">
          <div className="sm:px-3 first:pl-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Total Sales</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalSales > 0 ? formatNaira(totalSales) : '—'}
            </p>
          </div>

          <div className="sm:px-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Total Expenses</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalExpenses > 0 ? formatNaira(totalExpenses) : '—'}
            </p>
          </div>

          <div className="sm:px-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Outstanding Debts</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalOutstandingDebts > 0 ? formatNaira(totalOutstandingDebts) : '—'}
            </p>
          </div>

          <div className="sm:px-3 last:pr-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Current Stock</span>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
              {totalStockItems > 0 ? `${totalStockItems} items` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Business Information Card */}
      <div className="bg-white dark:bg-[#0D1B2A] border border-slate-200/90 dark:border-[#1A2C40] rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-[#1A2C40]/80 mb-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-[#0F2D25] text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Business Information
                </h3>
                {formData.registrationNumber?.trim() ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your legal business identity and registered details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isEditingBusinessInfo) {
                handleSaveBusinessInfo();
              } else {
                setIsEditingBusinessInfo(true);
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#16273C] hover:bg-slate-200 dark:hover:bg-[#1E3550] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            {isEditingBusinessInfo ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Save</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Edit</span>
              </>
            )}
          </button>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100 dark:divide-[#16273A]">
          {/* Business Name */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Business Name
            </span>
            {isEditingBusinessInfo ? (
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) =>
                  setFormData({ ...formData, businessName: e.target.value })
                }
                className="bg-slate-50 dark:bg-[#07131F] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-right w-48 sm:w-64"
              />
            ) : (
              <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium text-right truncate">
                {formData.businessName || '—'}
              </span>
            )}
          </div>

          {/* Business Type */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Business Type
            </span>
            {isEditingBusinessInfo ? (
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="bg-slate-50 dark:bg-[#07131F] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-right max-w-[200px] sm:max-w-xs"
              >
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-white dark:bg-[#0D1B2A] text-slate-900 dark:text-white">
                    {cat}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium text-right truncate">
                {formData.category || '—'}
              </span>
            )}
          </div>

          {/* Phone / WhatsApp */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Phone / WhatsApp
            </span>
            {isEditingBusinessInfo ? (
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+234..."
                className="bg-slate-50 dark:bg-[#07131F] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-right w-48 sm:w-64"
              />
            ) : (
              <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium text-right">
                {formData.phone || '—'}
              </span>
            )}
          </div>

          {/* Location */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Location
            </span>
            {isEditingBusinessInfo ? (
              <input
                type="text"
                value={formData.cityState}
                onChange={(e) =>
                  setFormData({ ...formData, cityState: e.target.value })
                }
                placeholder="Lagos, Nigeria"
                className="bg-slate-50 dark:bg-[#07131F] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-right w-48 sm:w-64"
              />
            ) : (
              <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium text-right">
                {formData.cityState || '—'}
              </span>
            )}
          </div>

          {/* CAC Registration Number & Verification */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                CAC Registration Number
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Registered RC / BN number (automatically verified)
              </span>
            </div>
            {isEditingBusinessInfo ? (
              <input
                type="text"
                value={formData.registrationNumber || ''}
                onChange={(e) =>
                  setFormData({ ...formData, registrationNumber: e.target.value })
                }
                placeholder="e.g. RC1234567 or BN9876543"
                className="bg-slate-50 dark:bg-[#07131F] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-right w-48 sm:w-64 font-mono uppercase"
              />
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium font-mono text-right">
                  {formData.registrationNumber?.trim() || 'Not provided'}
                </span>
                {formData.registrationNumber?.trim() ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                    <BadgeCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Verified
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    (Unverified)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Account Settings Card */}
      <div className="bg-white dark:bg-[#0D1B2A] border border-slate-200/90 dark:border-[#1A2C40] rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-lg">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-3.5 border-b border-slate-100 dark:border-[#1A2C40]/80 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-[#0F2D25] text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Account Settings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your preferences
            </p>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100 dark:divide-[#16273A]">
          {/* Notifications */}
          <div
            id="btn-profile-notifications"
            onClick={() => {
              if (onOpenNotificationSettings) {
                onOpenNotificationSettings();
              } else {
                setNotificationsEnabled(!notificationsEnabled);
                onShowToast(
                  !notificationsEnabled
                    ? 'Notifications enabled.'
                    : 'Notifications muted.',
                  'info'
                );
              }
            }}
            className="py-3.5 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Notifications & Reminders
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Morning, daytime & night business check-in schedule
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                  (notificationPreferences?.enabled ?? notificationsEnabled)
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {(notificationPreferences?.enabled ?? notificationsEnabled) ? 'Active' : 'Muted'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>
          </div>

          {/* Security */}
          <div
            onClick={() => {
              onShowToast('Cloud authentication and security are active.', 'info');
            }}
            className="py-3.5 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Security
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  End-to-end cloud database encryption
                </p>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
          </div>

          {/* Appearance */}
          <div
            onClick={() => {
              if (onToggleTheme) {
                onToggleTheme();
              }
            }}
            className="py-3.5 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <Palette className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  Appearance
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose your preferred theme (light or dark)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* 6. Account Actions Card */}
      <div className="bg-white dark:bg-[#0D1B2A] border border-slate-200/90 dark:border-[#1A2C40] rounded-2xl p-4 sm:p-5 shadow-xs dark:shadow-lg">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-3.5 border-b border-slate-100 dark:border-[#1A2C40]/80 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-[#2D0F0F] text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-500/20">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Account Actions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your session and business data
            </p>
          </div>
        </div>

        {/* Sign Out Action Button */}
        <div
          onClick={async () => {
            try {
              await signOut();
              onShowToast('Signed out successfully.', 'info');
            } catch {
              onShowToast('Signed out from local session.', 'info');
            }
          }}
          className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#091421] hover:bg-red-50/60 dark:hover:bg-[#132235] border border-slate-200/80 dark:border-[#16273A] hover:border-red-300 dark:hover:border-red-500/30 flex items-center justify-between transition-colors cursor-pointer group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                Sign Out
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Log out of your account</p>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
        </div>

        {/* Data Maintenance Utility Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-[#16273A]">
          {onClearLedger && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#091421] hover:bg-red-50 dark:hover:bg-[#1A1822] text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200/80 dark:border-[#16273A] hover:border-red-300 dark:hover:border-red-500/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Ledger Data</span>
            </button>
          )}

          {onResetDemo && (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#091421] hover:bg-slate-100 dark:hover:bg-[#132235] text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-[#16273A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Load Sample Store</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modals for Clear / Reset */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A131F] border border-red-300 dark:border-red-500/40 rounded-2xl max-w-sm w-full p-5 text-center text-slate-900 dark:text-white shadow-xl">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold">Clear Ledger Data?</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 mb-4">
              This will remove all transactions while keeping your product list and customers.
            </p>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  if (onClearLedger) onClearLedger();
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white"
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0A131F] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 text-center text-slate-900 dark:text-white shadow-xl">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold">Load Sample Demo Store?</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 mb-4">
              This populates sample Nigerian merchant transactions, products, and customer debts.
            </p>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  if (onResetDemo) onResetDemo();
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white"
              >
                Load Sample
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
