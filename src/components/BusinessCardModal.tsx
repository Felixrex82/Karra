import React, { useState } from 'react';
import { X, Download, FileText, Share2, Copy, Check, ShieldCheck, CreditCard, Building2, Phone, MapPin, Clock } from 'lucide-react';
import { BusinessProfile } from '../types';
import {
  exportBusinessCardToPNG,
  exportBusinessCardToPDF,
  shareBusinessCard,
  getBusinessCardText,
} from '../utils/cardGenerators';

interface BusinessCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BusinessProfile;
  businessName: string;
  onShowToast?: (message: string, type?: 'info' | 'success') => void;
}

export const BusinessCardModal: React.FC<BusinessCardModalProps> = ({
  isOpen,
  onClose,
  profile,
  businessName,
  onShowToast,
}) => {
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen) return null;

  const actualName = businessName || profile.businessName || 'Merchant Store';

  const handleDownloadPNG = async () => {
    try {
      setIsExportingPNG(true);
      await exportBusinessCardToPNG(profile, actualName);
      onShowToast?.('Downloaded digital business card as high-definition image (PNG).', 'success');
    } catch (err) {
      console.error('Error downloading PNG card:', err);
      onShowToast?.('Could not download image. Trying PDF fallback.', 'info');
    } finally {
      setIsExportingPNG(false);
    }
  };

  const handleDownloadPDF = () => {
    try {
      setIsExportingPDF(true);
      exportBusinessCardToPDF(profile, actualName);
      onShowToast?.('Downloaded printable business card (PDF).', 'success');
    } catch (err) {
      console.error('Error downloading PDF card:', err);
      onShowToast?.('Could not export PDF card.', 'info');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsSharing(true);
      const result = await shareBusinessCard(profile, actualName);
      if (result.success) {
        if (result.method === 'clipboard') {
          setHasCopied(true);
          onShowToast?.('Business card details copied to clipboard.', 'success');
          setTimeout(() => setHasCopied(false), 2500);
        } else {
          onShowToast?.('Shared business card successfully.', 'success');
        }
      }
    } catch (err) {
      console.error('Error sharing card:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyText = async () => {
    const text = getBusinessCardText(profile, actualName);
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      onShowToast?.('Card text copied to clipboard for WhatsApp/SMS.', 'success');
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      onShowToast?.('Clipboard copy failed.', 'info');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 text-white border border-slate-800 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Digital Business Card
              </h3>
              <p className="text-xs text-slate-400">
                Download or share your verified store identity & bank settlement details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Visual Card Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="rounded-2xl border border-slate-700/80 bg-linear-to-b from-[#0e1626] via-slate-900 to-[#09101d] p-5 sm:p-7 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar with Badge & CAC */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 relative z-10">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Karra Verified Merchant
              </span>
              {profile.registrationNumber && (
                <span className="text-xs font-mono text-slate-400">
                  CAC: {profile.registrationNumber}
                </span>
              )}
            </div>

            {/* Business Identity Row */}
            <div className="pt-4 pb-5 flex items-start space-x-4 relative z-10">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-slate-800/90 border-2 border-emerald-500/40 shadow-inner flex items-center justify-center font-black text-2xl text-emerald-400 shrink-0">
                {actualName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {actualName}
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  {profile.tagline || profile.category || 'Retail & Wholesale Store'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
                  <span>Proprietor: <strong className="text-slate-200">{profile.ownerName}</strong></span>
                  <span>•</span>
                  <span>Est. {profile.foundedYear || 2019}</span>
                  <span>•</span>
                  <span className="text-emerald-400">{profile.category}</span>
                </div>
              </div>
            </div>

            {/* Inset Bank Settlement Card */}
            {profile.bankDetails && (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2 relative z-10 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center">
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                    Official Bank Settlement Account
                  </span>
                  <span className="text-[10px] text-emerald-300/80">For Instant Customer Transfers</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Bank Name</span>
                    <span className="font-bold text-white text-sm block truncate">{profile.bankDetails.bankName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Account Number (NUBAN)</span>
                    <span className="font-mono font-black text-emerald-400 text-base sm:text-lg block tracking-wider">
                      {profile.bankDetails.accountNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Account Name</span>
                    <span className="font-semibold text-slate-200 text-xs block truncate">{profile.bankDetails.accountName}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Contact & Hours Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 relative z-10 text-xs pt-1 border-t border-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-300">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate font-mono">{profile.phone}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300 sm:col-span-2">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">{profile.address}, {profile.cityState}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300 sm:col-span-3">
                <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{profile.openingHours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 min-h-[42px]"
            title="Share card to WhatsApp, Messages, or social apps"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Card</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPNG}
            disabled={isExportingPNG}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 min-h-[42px]"
            title="Download high-resolution image (PNG)"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{isExportingPNG ? 'Saving...' : 'Download PNG'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-xs flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 min-h-[42px]"
            title="Download printable card document (PDF)"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>{isExportingPDF ? 'Saving...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer min-h-[42px]"
            title="Copy formatted text to clipboard"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{hasCopied ? 'Copied' : 'Copy Text'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
