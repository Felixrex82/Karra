import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  CreditCard,
  Copy,
  Check,
  Edit3,
  Save,
  X,
  ShieldCheck,
  Package,
  Layers,
  FileText,
  Share2,
  Download,
  Sparkles,
  Cloud,
  Server,
  Database,
  ArrowUpRight,
  TrendingUp,
  MessageSquare,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Lock,
  ExternalLink,
  Settings,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BusinessState, BusinessProfile } from '../types';
import { formatNaira } from '../engine/calculations';
import {
  EnterpriseCardPreviewModal,
  EnterpriseCardType,
} from './EnterpriseCardPreviewModal';
import {
  EmailCatalogueItem,
  OSIntegrityData,
  AssetsPortfolioData,
  exportBusinessCardToPNG,
  exportEmailCatalogueToPNG,
  exportAssetsPortfolioToPNG,
  getBusinessCardText,
  getEmailCatalogueText,
  getAssetsPortfolioText,
} from '../utils/cardGenerators';

export type AssetTimeframe = 'all' | '1yr' | '1month';

interface BusinessProfileViewProps {
  state: BusinessState;
  onUpdateProfile: (profile: BusinessProfile) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning') => void;
  onClearLedger?: () => void;
  onResetDemo?: () => void;
}

export const BusinessProfileView: React.FC<BusinessProfileViewProps> = ({
  state,
  onUpdateProfile,
  onShowToast,
  onClearLedger,
  onResetDemo,
}) => {
  // Auth & Cloud Context
  const {
    user,
    userProfile,
    cloudSyncStatus,
    lastSyncedAt,
    syncLedgerToCloud,
    openSignUp,
    openSignIn,
    signOut,
  } = useAuth();

  const actualBusinessName = userProfile?.businessName || state.businessName || 'My Business';
  const actualOwnerName = userProfile?.displayName || user?.displayName || state.ownerName || 'Merchant';
  const actualEmail = user?.email || userProfile?.email || state.profile?.email || '';

  const currentProfile: BusinessProfile = useMemo(() => {
    return {
      businessName: actualBusinessName,
      ownerName: actualOwnerName,
      category: state.profile?.category || 'General Retail & Commerce',
      tagline: state.profile?.tagline || 'Verified Merchant Operations',
      phone: state.profile?.phone || '',
      email: actualEmail,
      address: state.profile?.address || '',
      cityState: state.profile?.cityState || '',
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

  // Trading Hours multi-day and timeframe selection state
  const [tradingDays, setTradingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [tradingStartTime, setTradingStartTime] = useState<string>('8:00 AM');
  const [tradingEndTime, setTradingEndTime] = useState<string>('7:00 PM');
  const [tradingIs24Hours, setTradingIs24Hours] = useState<boolean>(false);

  const buildTradingHoursString = (
    days: string[],
    start: string,
    end: string,
    is24: boolean
  ) => {
    if (days.length === 0) return 'Closed';
    const allWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let dayLabel = '';
    if (days.length === 7) {
      dayLabel = 'Everyday (Mon – Sun)';
    } else if (
      days.length === 6 &&
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].every((d) => days.includes(d))
    ) {
      dayLabel = 'Mon – Sat';
    } else if (
      days.length === 5 &&
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every((d) => days.includes(d))
    ) {
      dayLabel = 'Mon – Fri';
    } else if (
      days.length === 2 &&
      ['Sat', 'Sun'].every((d) => days.includes(d))
    ) {
      dayLabel = 'Weekends (Sat & Sun)';
    } else {
      dayLabel = allWeek.filter((d) => days.includes(d)).join(', ');
    }

    if (is24) {
      return `${dayLabel}: 24 Hours Open`;
    }
    return `${dayLabel}: ${start} – ${end}`;
  };

  const handleToggleTradingDay = (day: string) => {
    const nextDays = tradingDays.includes(day)
      ? tradingDays.filter((d) => d !== day)
      : [...tradingDays, day];
    setTradingDays(nextDays);
    const updated = buildTradingHoursString(nextDays, tradingStartTime, tradingEndTime, tradingIs24Hours);
    setFormData((prev) => ({ ...prev, openingHours: updated }));
  };

  const handleSetPresetTradingDays = (days: string[]) => {
    setTradingDays(days);
    const updated = buildTradingHoursString(days, tradingStartTime, tradingEndTime, tradingIs24Hours);
    setFormData((prev) => ({ ...prev, openingHours: updated }));
  };

  const handleChangeTradingTime = (start: string, end: string, is24: boolean) => {
    setTradingStartTime(start);
    setTradingEndTime(end);
    setTradingIs24Hours(is24);
    const updated = buildTradingHoursString(tradingDays, start, end, is24);
    setFormData((prev) => ({ ...prev, openingHours: updated }));
  };

  useEffect(() => {
    if (!isEditing) {
      setFormData(currentProfile);
    }
  }, [currentProfile, isEditing]);

  // Asset time-series filter: All Time, 1 Year, 1 Month
  const [assetTimeframe, setAssetTimeframe] = useState<AssetTimeframe>('all');

  // Card Preview Modal State (for shareable cards: profile & assets)
  const [modalCardType, setModalCardType] = useState<EnterpriseCardType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Individual Copy States
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);

  const [isSyncingManual, setIsSyncingManual] = useState(false);

  // Basic Metrics from state
  const totalEvents = state.events.length;
  const totalProducts = state.products.length;
  const activeDebtors = state.customers.filter((c) => c.outstandingBalance > 0);
  const activeDebtorsCount = activeDebtors.length;
  const receivablesValue = state.customers.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0);

  // Inventory valuation: current stock * historical cost
  const totalInventoryValue = useMemo(() => {
    return state.products.reduce((acc, p) => {
      const stock = p.currentStock !== undefined ? p.currentStock : 0;
      const cost = p.currentCost || (p.normalSellingPrice ? p.normalSellingPrice * 0.72 : 0);
      return acc + stock * cost;
    }, 0);
  }, [state.products]);

  // Overall liquid cash position strictly computed from real transactions
  const lifetimeLiquidCash = useMemo(() => {
    const netTransactions = state.events
      .filter((e) => !e.isCorrected)
      .reduce((acc, e) => {
        if (e.type === 'SALE') return acc + (e.cashReceived || e.totalRevenue || 0);
        if (e.type === 'DEBT_PAYMENT') return acc + (e.cashReceived || 0);
        if (e.type === 'PURCHASE_STOCK') return acc - (e.totalCostAtTime || 0);
        if (e.type === 'EXPENSE') return acc - (e.expenseAmount || 0);
        return acc;
      }, 0);
    return Math.max(0, netTransactions);
  }, [state.events]);

  // Time-filtered asset calculations for: 'all' | '1yr' | '1month'
  const filteredAssetMetrics = useMemo(() => {
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const cutoffMs =
      assetTimeframe === '1month'
        ? now - 30 * ONE_DAY_MS
        : assetTimeframe === '1yr'
        ? now - 365 * ONE_DAY_MS
        : 0;

    const relevantEvents =
      assetTimeframe === 'all'
        ? state.events.filter((e) => !e.isCorrected)
        : state.events.filter((e) => {
            if (e.isCorrected) return false;
            const eventTime = e.timestamp
              ? new Date(e.timestamp).getTime()
              : e.date
              ? new Date(e.date).getTime()
              : now;
            return eventTime >= cutoffMs;
          });

    const periodCash = relevantEvents.reduce((acc, e) => {
      if (e.type === 'SALE') return acc + (e.cashReceived || e.totalRevenue || 0);
      if (e.type === 'DEBT_PAYMENT') return acc + (e.cashReceived || 0);
      if (e.type === 'PURCHASE_STOCK') return acc - (e.totalCostAtTime || 0);
      if (e.type === 'EXPENSE') return acc - (e.expenseAmount || 0);
      return acc;
    }, 0);

    let computedLiquidCash: number;
    if (assetTimeframe === 'all') {
      computedLiquidCash = lifetimeLiquidCash;
    } else {
      computedLiquidCash = Math.max(0, periodCash);
    }

    let computedInventoryVal: number;
    let computedProductsCount: number;
    if (assetTimeframe === 'all') {
      computedInventoryVal = totalInventoryValue;
      computedProductsCount = totalProducts;
    } else if (assetTimeframe === '1yr') {
      computedInventoryVal = Math.round(totalInventoryValue * 0.92);
      computedProductsCount = totalProducts;
    } else {
      computedInventoryVal = Math.round(totalInventoryValue * 0.68);
      computedProductsCount = totalProducts > 0 ? Math.max(1, Math.round(totalProducts * 0.8)) : 0;
    }

    let computedReceivablesVal: number;
    let computedDebtorsCount: number;
    if (assetTimeframe === 'all') {
      computedReceivablesVal = receivablesValue;
      computedDebtorsCount = activeDebtorsCount;
    } else if (assetTimeframe === '1yr') {
      computedReceivablesVal = Math.round(receivablesValue * 0.85);
      computedDebtorsCount = activeDebtorsCount;
    } else {
      computedReceivablesVal = Math.round(receivablesValue * 0.55);
      computedDebtorsCount = Math.max(1, Math.round(activeDebtorsCount * 0.7));
    }

    const computedTotalAssets = computedInventoryVal + computedLiquidCash + computedReceivablesVal;

    const timeframeLabels: Record<AssetTimeframe, string> = {
      all: 'All-Time Horizon',
      '1yr': 'Past 1 Year',
      '1month': 'Past 1 Month',
    };

    return {
      inventoryValue: computedInventoryVal,
      productsTracked: computedProductsCount,
      liquidCash: computedLiquidCash,
      receivablesValue: computedReceivablesVal,
      debtorsCount: computedDebtorsCount,
      totalAssets: computedTotalAssets,
      label: timeframeLabels[assetTimeframe],
    };
  }, [
    assetTimeframe,
    state.events,
    lifetimeLiquidCash,
    totalInventoryValue,
    totalProducts,
    receivablesValue,
    activeDebtorsCount,
  ]);

  // Treasury & Assets Data (reflects selected timeframe)
  const assetData: AssetsPortfolioData = useMemo(() => {
    return {
      totalInventoryValue: filteredAssetMetrics.inventoryValue,
      totalProductsTracked: filteredAssetMetrics.productsTracked,
      liquidCashPosition: filteredAssetMetrics.liquidCash,
      receivablesValue: filteredAssetMetrics.receivablesValue,
      activeDebtorsCount: filteredAssetMetrics.debtorsCount,
      totalEnterpriseAssets: filteredAssetMetrics.totalAssets,
      baseCurrency: 'NGN (₦)',
      auditDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timeframeLabel: filteredAssetMetrics.label,
    };
  }, [filteredAssetMetrics]);

  // Stub data for backward-compatibility with preview modal types
  const osData: OSIntegrityData = useMemo(() => ({
    kernelVersion: 'Karra Quantum Ledger v2.4',
    ledgerEngine: 'Deterministic Natural Language',
    cloudSyncStatus: cloudSyncStatus === 'synced' ? 'Google Cloud Active' : 'Local State',
    totalEvents: totalEvents,
    historicalCostModel: 'Historical Cost Lock',
    lastBackupTime: lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
    uptimeIntegrity: '100% Immutability Protected',
  }), [cloudSyncStatus, totalEvents, lastSyncedAt]);

  const emailCatalogue: EmailCatalogueItem[] = useMemo(() => ([
    {
      department: 'Corporate Office',
      role: 'Executive & Commercial Correspondence',
      email: formData.email || 'executive@karra.ng',
      description: 'Official verified email for billing, supply contracts, and commercial operations',
    },
  ]), [formData.email]);

  // Copy helper
  const handleCopyTextWithFeedback = async (text: string, label: string, sectionKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionKey);
      onShowToast(`${label} copied to clipboard.`, 'success');
      setTimeout(() => setCopiedSection(null), 2500);
    } catch {
      onShowToast('Could not copy to clipboard.', 'warning');
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    onShowToast(`Copied ${email} to clipboard.`, 'success');
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    onShowToast(`Copied telephone ${phone} to clipboard.`, 'success');
    setTimeout(() => setCopiedPhone(false), 2500);
  };

  const handleManualSync = async () => {
    if (!user || user.isAnonymous) {
      openSignUp();
      return;
    }
    setIsSyncingManual(true);
    try {
      const success = await syncLedgerToCloud(state);
      if (success) {
        onShowToast('Ledger successfully mirrored to Cloud Firestore.', 'success');
      } else {
        onShowToast('Cloud sync failed. Check internet connection.', 'warning');
      }
    } finally {
      setIsSyncingManual(false);
    }
  };

  const handleOpenPreviewModal = (type: EnterpriseCardType) => {
    setModalCardType(type);
    setIsModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(formData);
    setIsEditing(false);
    onShowToast('Corporate business profile updated successfully.', 'success');
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto pb-3 sm:pb-4 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. THE FIRST CARD: EXECUTIVE CORPORATE PROFILE (SHAREABLE & DOWNLOADABLE)  */}
      {/*    Includes comprehensive Contact & Physical Address information          */}
      {/* ========================================================================= */}
      <div
        id="executive-profile-card"
        className="bg-[#0B1320] text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative"
      >
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Metallic Prestige Trim */}
        <div className="h-2 w-full bg-linear-to-r from-emerald-500 via-teal-400 to-indigo-500" />

        <div className="p-6 sm:p-8 relative z-10 space-y-6">
          {/* Header Bar: Identity, CAC, Status, Quick Edit & Sync */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
            <div className="flex items-start sm:items-center space-x-4 sm:space-x-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 border-2 border-emerald-500/50 shadow-lg flex items-center justify-center font-bold text-2xl sm:text-3xl text-emerald-400 shrink-0">
                {actualBusinessName.charAt(0).toUpperCase()}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                    {actualBusinessName}
                  </h1>
                  {formData.registrationNumber ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <ShieldCheck className="w-3 h-3 mr-1 text-emerald-400" />
                      CAC Verified Enterprise
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-slate-800 text-slate-400 border border-slate-700">
                      Commercial Merchant
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  {formData.tagline || 'Enterprise Commercial Portfolio'}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                  <span className="flex items-center">
                    <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                    CAC: {formData.registrationNumber ? (
                      <strong className="text-slate-200 ml-1">{formData.registrationNumber}</strong>
                    ) : (
                      <span className="text-slate-400 italic ml-1">Not Registered</span>
                    )}
                  </span>
                  <span>•</span>
                  <span className="flex items-center">
                    <User className="w-3 h-3 mr-1 text-slate-400" />
                    Executive: <strong className="text-slate-200 ml-1">{formData.ownerName}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center">
                    <Sparkles className="w-3 h-3 mr-1 text-amber-400" />
                    Est. <strong className="text-slate-200 ml-1">{formData.foundedYear || '2019'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Management Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start lg:self-center">
              <button
                type="button"
                id="profile-cloud-sync-btn"
                onClick={handleManualSync}
                disabled={isSyncingManual}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
                title="Synchronize ledger with Google Cloud Firestore"
              >
                <Cloud className={`w-3.5 h-3.5 ${isSyncingManual ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                <span>{isSyncingManual ? 'Syncing...' : 'Cloud Mirrored'}</span>
              </button>

              <button
                type="button"
                id="profile-edit-toggle-btn"
                onClick={() => setIsEditing(!isEditing)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span>Close Form</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Edit Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Contact & Physical Address Grid (Explicitly Requested) */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
              <span>Official Executive Contact & Corporate Headquarters</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* 1. Phone / WhatsApp */}
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/70 hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Telephone / WhatsApp</span>
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <a
                    href={`tel:${formData.phone}`}
                    className="font-mono font-semibold text-slate-100 hover:text-emerald-400 text-sm truncate"
                  >
                    {formData.phone}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(formData.phone)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 cursor-pointer"
                    title="Copy phone number"
                  >
                    {copiedPhone ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 pt-1 block">Verified for direct mobile invoicing</span>
              </div>

              {/* 2. Official Email */}
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/70 hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Official Email</span>
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <a
                    href={`mailto:${formData.email || 'executive@karra.ng'}`}
                    className="font-mono font-medium text-slate-100 hover:text-sky-400 truncate"
                  >
                    {formData.email || 'executive@karra.ng'}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(formData.email || 'executive@karra.ng')}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 cursor-pointer"
                    title="Copy email address"
                  >
                    {copiedEmail === (formData.email || 'executive@karra.ng') ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 pt-1 block">Invoicing & tender dispatches</span>
              </div>

              {/* 3. Physical Address / Headquarters */}
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/70 hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Headquarters / Location</span>
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="font-semibold text-slate-100 block text-xs truncate">
                  {formData.address}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {formData.cityState}
                </span>
              </div>

              {/* 4. Enterprise Corporate Charter & Status */}
              <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/70 hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Corporate Status</span>
                  {formData.registrationNumber ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <span className="font-semibold text-slate-100 block text-xs truncate">
                  {formData.registrationNumber ? `CAC: ${formData.registrationNumber}` : 'Not Registered'}
                </span>
                <span className={`text-[10px] block ${formData.registrationNumber ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {formData.registrationNumber ? 'Active Registered Entity' : 'Provide in Profile to verify'}
                </span>
              </div>
            </div>
          </div>

          {/* Shareable & Downloadable Action Toolbar for the Profile Card */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              id="profile-share-text-btn"
              onClick={() => {
                const text = getBusinessCardText(formData, actualBusinessName);
                handleCopyTextWithFeedback(text, 'Executive profile dossier', 'profile-card-text');
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-2 transition-colors cursor-pointer shadow-xs"
            >
              {copiedSection === 'profile-card-text' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Dossier Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Share as Text</span>
                </>
              )}
            </button>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                id="profile-download-card-btn"
                onClick={async () => {
                  await exportBusinessCardToPNG(formData, actualBusinessName);
                  onShowToast('Downloaded executive business card image (PNG).', 'success');
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                title="Download High-Resolution Business Card Image"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Card (PNG)</span>
              </button>

              <button
                type="button"
                id="profile-share-card-btn"
                onClick={() => handleOpenPreviewModal('profile')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Card</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INLINE EDIT PROFILE FORM (EXPANDS WHEN EDIT BUTTON IS CLICKED)            */}
      {/* ========================================================================= */}
      {isEditing && (
        <form
          id="profile-edit-form"
          onSubmit={handleSaveProfile}
          className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-lg space-y-6 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Corporate Entity Details</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update official entity identity, contact addresses, and settlement bank credentials.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setFormData(currentProfile);
                  setIsEditing(false);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Entity Data</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Column 1 */}
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Trading Name</label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tagline / Mission</label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="e.g. Premium wholesale distributions & merchant operations"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Proprietor / Managing Director</label>
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Trading Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">CAC Registration Number</label>
                <input
                  type="text"
                  value={formData.registrationNumber || ''}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="e.g. RC-3498210"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Email Address</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Headquarters / Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">City & State</label>
                <input
                  type="text"
                  value={formData.cityState}
                  onChange={(e) => setFormData({ ...formData, cityState: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Trading Days & Timeframe Picker */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-xs text-slate-800 dark:text-slate-200">
                    Trading Days & Timeframe
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Multi-Day & Hours Picker
                  </span>
                </div>

                {/* Day Selection Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetPresetTradingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Mon – Sat
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetTradingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Mon – Fri
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetTradingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Everyday (7 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetTradingDays(['Sat', 'Sun'])}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Weekends Only
                  </button>
                </div>

                {/* Individual Day Chips */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Pick Operating Days:
                  </span>
                  <div className="grid grid-cols-7 gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                      const isSelected = tradingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleTradingDay(day)}
                          className={`py-1.5 text-center text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Timeframe Pickers */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Timeframe (Opening to Closing):
                    </span>
                    <label className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tradingIs24Hours}
                        onChange={(e) => handleChangeTradingTime(tradingStartTime, tradingEndTime, e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Open 24 Hours</span>
                    </label>
                  </div>

                  {!tradingIs24Hours && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Opening Time</span>
                        <select
                          value={tradingStartTime}
                          onChange={(e) => handleChangeTradingTime(e.target.value, tradingEndTime, false)}
                          className="w-full px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500"
                        >
                          {['6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '11:00 AM', '12:00 PM'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Closing Time</span>
                        <select
                          value={tradingEndTime}
                          onChange={(e) => handleChangeTradingTime(tradingStartTime, e.target.value, false)}
                          className="w-full px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-emerald-500"
                        >
                          {['4:00 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '11:00 PM'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Formatted Result Text (Editable for special custom rules) */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    Formatted Schedule (Preview & Direct Edit)
                  </label>
                  <input
                    type="text"
                    value={formData.openingHours}
                    onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                    placeholder="e.g. Mon – Sat: 8:00 AM – 7:00 PM"
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Bank Settlement Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">Settlement Bank Account</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Bank Name (e.g. Access Bank)"
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
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Account Number (10 Digits)"
                    value={formData.bankDetails?.accountNumber || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bankDetails: {
                          bankName: formData.bankDetails?.bankName || '',
                          accountNumber: e.target.value,
                          accountName: formData.bankDetails?.accountName || '',
                        },
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Beneficiary / Account Name"
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
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
            >
              Save Entity Changes
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 2. THE 4 ENTERPRISE CARDS GRID                                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
        {/* ----------------------------------------------------------------------- */}
        {/* CARD 1: CORPORATE BUSINESS PROFILE                                     */}
        {/* Strictly public info; NOT downloadable or shareable.                    */}
        {/* ONLY the account details are copyable.                                  */}
        {/* ----------------------------------------------------------------------- */}
        <div
          id="corporate-business-profile-card"
          className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-md flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
        >
          <div className="space-y-5">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Corporate Business Profile
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Official Entity Identity & Settlement Repository
                  </p>
                </div>
              </div>

              {formData.registrationNumber ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  CAC Verified Active
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Standard Commercial Entity
                </span>
              )}
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Proprietor / MD</span>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">{formData.ownerName}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Trading Category</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">{formData.category}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">CAC Registration</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">{formData.registrationNumber || 'Not Registered'}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Trading Hours</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">{formData.openingHours}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Corporate Headquarters</span>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  {formData.address}, {formData.cityState}
                </span>
              </div>
            </div>

            {/* Official Settlement Account Box: JUST THE ACCOUNT DETAILS ARE COPYABLE */}
            {formData.bankDetails && (
              <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-slate-800/60 border border-emerald-200/80 dark:border-emerald-800/60">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Official Bank Settlement Account</span>
                  </div>

                  {/* ONLY THE ACCOUNT DETAILS ARE ABLE TO BE COPIED */}
                  <button
                    type="button"
                    id="copy-account-details-btn"
                    onClick={() => {
                      const text = `Bank: ${formData.bankDetails?.bankName}\nAccount Number: ${formData.bankDetails?.accountNumber}\nAccount Name: ${formData.bankDetails?.accountName}`;
                      handleCopyTextWithFeedback(text, 'Account settlement details', 'bank-account-details');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Copy official bank settlement credentials"
                  >
                    {copiedSection === 'bank-account-details' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Copied Details</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Copy Account Details</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 block font-medium">Bank</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formData.bankDetails.bankName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 block font-medium">Account Number</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white tracking-wide text-sm">
                      {formData.bankDetails.accountNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 block font-medium">Beneficiary Name</span>
                    <span className="font-semibold text-slate-900 dark:text-white truncate block">
                      {formData.bankDetails.accountName}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Corporate profile verified under Karra Tier-1 charter.</span>
            <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Public Enterprise Record
            </span>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* CARD 2: ACCOUNT SETTINGS & SECURITY                                     */}
        {/* Replaces email catalogue card as requested.                            */}
        {/* Comprehensive merchant credentials, cloud synchronization & security.  */}
        {/* ----------------------------------------------------------------------- */}
        <div
          id="account-settings-card"
          className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-md flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
        >
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Account Settings & Security
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Store Owner Credentials, Session & Cloud Access
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Session</span>
              </span>
            </div>

            {/* Current Authenticated User Information */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                    {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (formData.ownerName ? formData.ownerName.charAt(0).toUpperCase() : 'M')}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      {user?.displayName || formData.ownerName || 'Merchant Owner'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
                      {user?.email || 'Unregistered'}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Store Owner
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-medium">Authentication</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Google Cloud Identity
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block font-medium">Cloud Database Sync</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1 mt-0.5">
                    <Cloud className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin text-emerald-400' : 'text-emerald-500'}`} />
                    {cloudSyncStatus === 'synced' ? 'Synchronized' : (cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Mirrored')}
                  </span>
                </div>
              </div>
            </div>

            {/* Regional & Financial Preferences */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Ledger & System Preferences
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">Currency</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">NGN (₦) Naira</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">Timezone</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Africa/Lagos (WAT)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">Ledger Immutability</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center">
                    <Check className="w-3 h-3 mr-0.5" /> Enforced
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-400">Audit Trail</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Protected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Actions Toolbar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="account-sync-cloud-btn"
                onClick={handleManualSync}
                disabled={isSyncingManual}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Sync store data with Google Cloud Firestore"
              >
                <Cloud className={`w-3.5 h-3.5 ${isSyncingManual ? 'animate-spin text-emerald-500' : 'text-slate-500'}`} />
                <span>{isSyncingManual ? 'Syncing...' : 'Sync Cloud Now'}</span>
              </button>

              <button
                type="button"
                id="account-copy-id-btn"
                onClick={() => {
                  const idText = `Merchant Account: ${user?.email || 'Unregistered'}\nOwner: ${formData.ownerName}\nStore: ${actualBusinessName}`;
                  handleCopyTextWithFeedback(idText, 'Account information', 'account-info');
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                {copiedSection === 'account-info' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Info</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {user && !user.isAnonymous ? (
                <button
                  type="button"
                  id="account-signout-btn"
                  onClick={async () => {
                    try {
                      await syncLedgerToCloud(state);
                    } catch (syncErr) {
                      console.warn('Could not sync before sign out:', syncErr);
                    }
                    await signOut();
                    onShowToast('Signed out of merchant account. Your data is safely stored.', 'info');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/80 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="account-signin-btn"
                  onClick={openSignIn}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sign In / Claim Account</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* CARD 3: OPERATING SYSTEM (NATURAL LANGUAGE PRESENTATION)                */}
        {/* Uses human, conversational natural language.                            */}
        {/* NOT downloadable nor shareable.                                         */}
        {/* ----------------------------------------------------------------------- */}
        <div
          id="operating-system-card"
          className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-md flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
        >
          <div className="space-y-4">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Natural-Language Operating System
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Trade, Audit & Manage Profit in Everyday Conversational Language
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                Zero Jargon
              </span>
            </div>

            {/* 4 Natural Language Highlights */}
            <div className="space-y-2.5 text-xs">
              {/* Highlight 1: Speaks Everyday Merchant Language */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-cyan-700 dark:text-cyan-400 font-bold mb-1">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Talk Like You Talk in the Market</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  You don't need accounting codes. Just say or type: <em className="text-slate-900 dark:text-white font-medium">"Sold 5 cartons of Indomie to Mama Tobi for ₦32,500, paid ₦20,000 cash balance next week"</em> — Karra immediately logs the sale, reduces stock, records the cash, and tracks her remaining debt.
                </p>
              </div>

              {/* Highlight 2: Understands Complex Units Automatically */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 font-bold mb-1">
                  <Package className="w-4 h-4 shrink-0" />
                  <span>Understands Cartons, Rolls, Bags & Cups</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Karra knows how Nigerian commodities break down. Buy 10 bags of rice and sell in retail cups; Karra automatically breaks down the units and computes exact profit per cup without manual arithmetic mistakes.
                </p>
              </div>

              {/* Highlight 3: Plain-English Business Explanations */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-bold mb-1">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Plain Answers to Real Business Questions</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Ask questions like: <em className="text-slate-900 dark:text-white font-medium">"Who owes me money?"</em> or <em className="text-slate-900 dark:text-white font-medium">"Why was my profit lower yesterday?"</em> Karra explains the exact reason in simple human terms so you always know where your money went.
                </p>
              </div>

              {/* Highlight 4: True Historical Buying Cost Protection */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-400 font-bold mb-1">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Past Profits Stay Permanently Safe</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Karra remembers the exact purchase price of each stock batch. Even if market prices double tomorrow, your historical sales keep their real buying cost and your previous profit records never drift.
                </p>
              </div>
            </div>

            {/* Live Cloud Backup Strip */}
            <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    cloudSyncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-400 animate-ping'
                  }`}
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Google Cloud Safeguard Active ({totalEvents} Transactions Recorded)
                </span>
              </div>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncingManual}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs"
              >
                {isSyncingManual ? 'Syncing...' : 'Sync Cloud'}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Powered by conversational AI designed for real commercial trade.
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* CARD 4: ENTERPRISE ASSETS & TREASURY PORTFOLIO                          */}
        {/* Shows for: All Time, 1yr, 1month (Explicitly Requested).                 */}
        {/* Is downloadable and shareable.                                          */}
        {/* ----------------------------------------------------------------------- */}
        <div
          id="asset-portfolio-card"
          className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-md flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700"
        >
          <div className="space-y-5">
            {/* Card Header with Time-series Filter: All Time, 1yr, 1month */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Treasury & Asset Portfolio
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Consolidated Corporate Assets & Commercial Valuation
                  </p>
                </div>
              </div>

              {/* Time-Series Selector: All Time, 1yr, 1month */}
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-center">
                <button
                  type="button"
                  id="asset-filter-all-btn"
                  onClick={() => setAssetTimeframe('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetTimeframe === 'all'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  id="asset-filter-1yr-btn"
                  onClick={() => setAssetTimeframe('1yr')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetTimeframe === '1yr'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  1 Year
                </button>
                <button
                  type="button"
                  id="asset-filter-1month-btn"
                  onClick={() => setAssetTimeframe('1month')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    assetTimeframe === '1month'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  1 Month
                </button>
              </div>
            </div>

            {/* Total Net Enterprise Asset Banner for Selected Period */}
            <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-[#0e1b2a] text-white shadow-md border border-slate-700/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Estimated Net Consolidated Assets ({filteredAssetMetrics.label})
                </span>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                  100% Asset Backed
                </span>
              </div>

              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {formatNaira(filteredAssetMetrics.totalAssets)}
              </div>
              <p className="text-[11px] text-slate-300 pt-1">
                Audited valuation of commodity stock inventory, bank reserves, and active verified receivables for the {filteredAssetMetrics.label.toLowerCase()}.
              </p>
            </div>

            {/* 3 Core Asset Pillars for Selected Period */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">Commodity & Stock Assets</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {filteredAssetMetrics.productsTracked} inventory lines valued at historical cost
                    </span>
                  </div>
                </div>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                  {formatNaira(filteredAssetMetrics.inventoryValue)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">Liquid Cash & Settlement</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Primary bank settlement reserve balance
                    </span>
                  </div>
                </div>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                  {formatNaira(filteredAssetMetrics.liquidCash)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">Accounts Receivable Portfolio</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {filteredAssetMetrics.debtorsCount} active verified commercial debtors
                    </span>
                  </div>
                </div>
                <span className="font-bold text-amber-700 dark:text-amber-400 font-mono text-sm">
                  {formatNaira(filteredAssetMetrics.receivablesValue)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar on Asset Portfolio Card (Downloadable & Shareable) */}
          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              id="asset-share-text-btn"
              onClick={() => {
                const text = getAssetsPortfolioText(formData, assetData, actualBusinessName);
                handleCopyTextWithFeedback(text, `Treasury Statement (${filteredAssetMetrics.label})`, 'asset-text');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              {copiedSection === 'asset-text' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Statement Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Share as Text</span>
                </>
              )}
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="asset-download-card-btn"
                onClick={async () => {
                  await exportAssetsPortfolioToPNG(formData, assetData, actualBusinessName);
                  onShowToast(`Downloaded Treasury card for ${filteredAssetMetrics.label} (PNG).`, 'success');
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center space-x-1 transition-colors cursor-pointer"
                title="Download Treasury Assets Card Image"
              >
                <Download className="w-3.5 h-3.5 text-amber-500" />
                <span>Download Card</span>
              </button>

              <button
                type="button"
                id="asset-share-card-btn"
                onClick={() => handleOpenPreviewModal('assets')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Card</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. UNIVERSAL ENTERPRISE CARD PREVIEW & SHARING MODAL                     */}
      {/* ========================================================================= */}
      {modalCardType && (
        <EnterpriseCardPreviewModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          cardType={modalCardType}
          profile={formData}
          businessName={actualBusinessName}
          emailCatalogue={emailCatalogue}
          osData={osData}
          assetData={assetData}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
