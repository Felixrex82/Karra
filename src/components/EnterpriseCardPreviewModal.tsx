import React, { useState, useEffect } from 'react';
import { X, Download, Share2, Copy, Check, Sparkles, MessageCircle } from 'lucide-react';
import { BusinessProfile } from '../types';
import {
  EmailCatalogueItem,
  OSIntegrityData,
  AssetsPortfolioData,
  renderBusinessCardCanvas,
  renderEmailCatalogueCanvas,
  renderOSIntegrityCanvas,
  renderAssetsPortfolioCanvas,
  exportBusinessCardToPNG,
  exportEmailCatalogueToPNG,
  exportOSIntegrityToPNG,
  exportAssetsPortfolioToPNG,
  shareBusinessCard,
  shareEmailCatalogue,
  shareOSIntegrity,
  shareAssetsPortfolio,
  getBusinessCardText,
  getEmailCatalogueText,
  getOSIntegrityText,
  getAssetsPortfolioText,
} from '../utils/cardGenerators';

export type EnterpriseCardType = 'profile' | 'email' | 'os' | 'assets';

interface EnterpriseCardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: EnterpriseCardType;
  profile: BusinessProfile;
  businessName: string;
  emailCatalogue: EmailCatalogueItem[];
  osData: OSIntegrityData;
  assetData: AssetsPortfolioData;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const EnterpriseCardPreviewModal: React.FC<EnterpriseCardPreviewModalProps> = ({
  isOpen,
  onClose,
  cardType,
  profile,
  businessName,
  emailCatalogue,
  osData,
  assetData,
  onShowToast,
}) => {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [hasCopiedText, setHasCopiedText] = useState(false);

  const actualName = businessName || profile.businessName || 'Karra Enterprise';

  // Render high-DPI canvas preview when opened or when type changes
  useEffect(() => {
    if (!isOpen) return;

    let canvas: HTMLCanvasElement;
    if (cardType === 'profile') {
      canvas = renderBusinessCardCanvas(profile, actualName, true);
    } else if (cardType === 'email') {
      canvas = renderEmailCatalogueCanvas(profile, emailCatalogue, actualName);
    } else if (cardType === 'os') {
      canvas = renderOSIntegrityCanvas(profile, osData, actualName);
    } else {
      canvas = renderAssetsPortfolioCanvas(profile, assetData, actualName);
    }

    try {
      setPreviewDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('Failed to generate card data URL:', err);
    }
  }, [isOpen, cardType, profile, actualName, emailCatalogue, osData, assetData]);

  if (!isOpen) return null;

  const getTitleAndSubtitle = () => {
    switch (cardType) {
      case 'profile':
        return {
          title: 'Official Executive Business Card',
          subtitle: 'Corporate identity, CAC verification & bank settlement credentials',
        };
      case 'email':
        return {
          title: 'Official Email Catalogue Card',
          subtitle: 'Executive & departmental routing inboxes for corporate inquiries',
        };
      case 'os':
        return {
          title: 'System Architecture & Integrity Card',
          subtitle: 'Cryptographic ledger immutability & cloud persistence certificate',
        };
      case 'assets':
        return {
          title: 'Corporate Treasury & Asset Portfolio Card',
          subtitle: 'Audited commodity inventory, liquid capital & receivables balance',
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();

  const handleDownloadPNG = async () => {
    try {
      setIsExporting(true);
      if (cardType === 'profile') {
        await exportBusinessCardToPNG(profile, actualName);
      } else if (cardType === 'email') {
        await exportEmailCatalogueToPNG(profile, emailCatalogue, actualName);
      } else if (cardType === 'os') {
        await exportOSIntegrityToPNG(profile, osData, actualName);
      } else {
        await exportAssetsPortfolioToPNG(profile, assetData, actualName);
      }
      onShowToast?.('Downloaded executive card as high-definition image (PNG).', 'success');
    } catch (err) {
      console.error(err);
      onShowToast?.('Could not download image.', 'info');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareCard = async () => {
    try {
      setIsSharing(true);
      let result;
      if (cardType === 'profile') {
        result = await shareBusinessCard(profile, actualName);
      } else if (cardType === 'email') {
        result = await shareEmailCatalogue(profile, emailCatalogue, actualName);
      } else if (cardType === 'os') {
        result = await shareOSIntegrity(profile, osData, actualName);
      } else {
        result = await shareAssetsPortfolio(profile, assetData, actualName);
      }

      if (result.success) {
        if (result.method === 'clipboard') {
          setHasCopiedText(true);
          onShowToast?.('Card summary text copied to clipboard.', 'success');
          setTimeout(() => setHasCopiedText(false), 2500);
        } else {
          onShowToast?.('Card shared successfully.', 'success');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyText = async () => {
    let text = '';
    if (cardType === 'profile') {
      text = getBusinessCardText(profile, actualName);
    } else if (cardType === 'email') {
      text = getEmailCatalogueText(profile, emailCatalogue, actualName);
    } else if (cardType === 'os') {
      text = getOSIntegrityText(profile, osData, actualName);
    } else {
      text = getAssetsPortfolioText(profile, assetData, actualName);
    }

    try {
      await navigator.clipboard.writeText(text);
      setHasCopiedText(true);
      onShowToast?.('Card text copied to clipboard for WhatsApp/SMS.', 'success');
      setTimeout(() => setHasCopiedText(false), 2500);
    } catch {
      onShowToast?.('Clipboard copy failed.', 'info');
    }
  };

  const handleWhatsAppShare = () => {
    let text = '';
    if (cardType === 'profile') {
      text = getBusinessCardText(profile, actualName);
    } else if (cardType === 'email') {
      text = getEmailCatalogueText(profile, emailCatalogue, actualName);
    } else if (cardType === 'os') {
      text = getOSIntegrityText(profile, osData, actualName);
    } else {
      text = getAssetsPortfolioText(profile, assetData, actualName);
    }
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 text-white border border-slate-800 w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                {title}
              </h2>
              <p className="text-xs text-slate-400 hidden sm:block">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Card Image Canvas Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950/50">
          {previewDataUrl ? (
            <div className="relative group w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 bg-slate-900">
              <img
                src={previewDataUrl}
                alt={title}
                className="w-full h-auto object-contain rounded-xl select-none"
              />
            </div>
          ) : (
            <div className="w-full aspect-16/10 rounded-2xl bg-slate-800/50 animate-pulse flex items-center justify-center text-slate-400 text-xs">
              Rendering high-resolution vector card...
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-7 py-4 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Copy formatted card text for WhatsApp or SMS"
            >
              {hasCopiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Text Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Share as Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Send directly via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isExporting ? 'Saving Image...' : 'Download Card (PNG)'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareCard}
              disabled={isSharing}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSharing ? 'Sharing...' : 'Share Card'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
