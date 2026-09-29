import React, { useState, useMemo } from 'react';
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Edit3,
  Save,
  X,
  ShieldCheck,
  Cloud,
  RefreshCw,
  LogOut,
  AlertTriangle,
  RotateCcw,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BusinessState, BusinessProfile } from '../types';

interface BusinessProfileViewProps {
  state: BusinessState;
  onUpdateProfile: (profile: BusinessProfile) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
  onClearLedger?: () => void;
  onResetDemo?: () => void;
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
}) => {
  const {
    user,
    userProfile,
    cloudSyncStatus,
    lastSyncedAt,
    syncLedgerToCloud,
    signOut,
  } = useAuth();

  const actualBusinessName = userProfile?.businessName || state.businessName || 'My Business';
  const actualOwnerName = userProfile?.displayName || user?.displayName || state.ownerName || 'Merchant';
  const actualEmail = user?.email || userProfile?.email || state.profile?.email || '';

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
      paymentMethods: state.profile?.paymentMethods || ['Cash Settlement', 'Bank Transfer', 'POS Terminal'],
      bankDetails: state.profile?.bankDetails || {
        bankName: '',
        accountNumber: '',
        accountName: '',
      },
      creditLimitPolicy: state.profile?.creditLimitPolicy || 0,
      lowStockThreshold: state.profile?.lowStockThreshold || 5,
    };
  }, [state.profile, state.businessName, state.ownerName, state.currency, user, userProfile, actualBusinessName, actualOwnerName, actualEmail]);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<BusinessProfile>(currentProfile);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync formData if currentProfile changes when not actively editing
  React.useEffect(() => {
    if (!isEditing) {
      setFormData(currentProfile);
    }
  }, [currentProfile, isEditing]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName.trim()) {
      onShowToast('Business name is required.', 'warning');
      return;
    }
    onUpdateProfile(formData);
    setIsEditing(false);
    onShowToast('Business profile updated successfully.', 'success');
  };

  const handleCancel = () => {
    setFormData(currentProfile);
    setIsEditing(false);
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncLedgerToCloud(state);
      onShowToast('Cloud records synchronized.', 'success');
    } catch {
      onShowToast('Sync failed. Please check network connection.', 'warning');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6 text-slate-900 dark:text-slate-100">
      {/* 1. Header / Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-900 text-white dark:bg-emerald-600 dark:text-white flex items-center justify-center font-bold text-xl tracking-tight shadow-sm shrink-0">
            {formData.businessName ? formData.businessName.substring(0, 2).toUpperCase() : 'KA'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {formData.businessName || 'Business Profile'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Active Account
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {formData.ownerName ? `Owned by ${formData.ownerName}` : 'Business profile and operational settings'}
              {formData.email ? ` • ${formData.email}` : ''}
            </p>
          </div>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-xs"
          >
            <Edit3 className="w-4 h-4 text-slate-500" />
            Edit Profile
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg transition-colors shadow-xs"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* 2. Business Details */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Business Information
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Operating details used by Karra to personalize records and customer communication
            </p>
          </div>
          <Building2 className="w-4 h-4 text-slate-400" />
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Business Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Alaba Electronics"
                required
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1">
                {formData.businessName || '—'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Owner / Representative Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. David Okon"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {formData.ownerName || '—'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Industry / Trade Category
            </label>
            {isEditing ? (
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1">
                {formData.category || '—'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Contact Phone / WhatsApp
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. 0802 345 6789"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {formData.phone || 'Not provided'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Operating Location / City & State
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.cityState}
                onChange={(e) => setFormData({ ...formData, cityState: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Trade Fair, Lagos"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {formData.cityState || '—'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Base Operating Currency
            </label>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1">
              Nigerian Naira (₦ NGN)
            </p>
          </div>
        </form>
      </section>

      {/* 3. Settlement & Bank Details */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Settlement & Banking
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Account information for customer direct bank transfers and receipts
            </p>
          </div>
          <CreditCard className="w-4 h-4 text-slate-400" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Bank Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.bankDetails?.bankName || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bankDetails: {
                      bankName: e.target.value,
                      accountNumber: formData.bankDetails?.accountNumber || '',
                      accountName: formData.bankDetails?.accountName || '',
                    },
                  })
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Zenith Bank / Access Bank"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1">
                {formData.bankDetails?.bankName || 'Not specified'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Account Number
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.bankDetails?.accountNumber || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bankDetails: {
                      bankName: formData.bankDetails?.bankName || '',
                      accountNumber: e.target.value.replace(/\D/g, ''),
                      accountName: formData.bankDetails?.accountName || '',
                    },
                  })
                }
                maxLength={10}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                placeholder="10-digit NUBAN"
              />
            ) : (
              <p className="text-sm font-medium font-mono text-slate-900 dark:text-slate-100 py-1">
                {formData.bankDetails?.accountNumber || '—'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Beneficiary Account Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.bankDetails?.accountName || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bankDetails: {
                      bankName: formData.bankDetails?.bankName || '',
                      accountNumber: formData.bankDetails?.accountNumber || '',
                      accountName: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                placeholder="Registered business or owner name"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 py-1">
                {formData.bankDetails?.accountName || '—'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 4. Account & Cloud Persistence */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Account & Synchronization
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Authentication state and cloud database persistence
            </p>
          </div>
          <Cloud className="w-4 h-4 text-slate-400" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Account Email
            </span>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 break-all">
                {actualEmail || 'Unauthenticated / Local Merchant'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                  Cloud Ledger Status
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cloudSyncStatus === 'syncing' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {cloudSyncStatus === 'syncing'
                      ? 'Synchronizing...'
                      : cloudSyncStatus === 'error'
                      ? 'Sync issue (local cache active)'
                      : 'Connected & Synced'}
                  </span>
                </div>
                {lastSyncedAt && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Last updated: {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                title="Force cloud sync"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Account Actions */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Account Actions
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Session controls and business ledger maintenance
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {user && (
            <button
              type="button"
              onClick={async () => {
                await signOut();
                onShowToast('Signed out of Karra.', 'info');
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              Sign Out of Account
            </button>
          )}

          <div className="flex items-center gap-2">
            {onResetDemo && (
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Reset Sample Data
              </button>
            )}

            {onClearLedger && (
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                Clear Ledger Data
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Confirmation Modal: Reset Demo Data */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Reset Sample Business Records?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              This replaces your current transactions with standard sample data (provisions, drinks, and customer debts). Any custom transactions will be overwritten.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  onResetDemo?.();
                  onShowToast('Sample business data restored.', 'info');
                }}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Clear Ledger Data */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Clear All Business Transactions?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              This will clear all recorded sales, expenses, and transaction history from your ledger. Your registered products, prices, and business memory bank will remain saved.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  onClearLedger?.();
                  onShowToast('All transactions cleared from ledger.', 'info');
                }}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
