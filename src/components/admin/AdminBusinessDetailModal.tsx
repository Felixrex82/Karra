import React, { useState } from 'react';
import {
  X,
  Building2,
  Mail,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Receipt,
  Sparkles,
  ShoppingBag,
  Users,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Activity,
  DollarSign,
  Copy,
  Check,
} from 'lucide-react';
import { AdminUserRecord, AdminEventRecord } from './adminTypes';
import { BetaFeedbackItem } from '../../types';

interface AdminBusinessDetailModalProps {
  user: AdminUserRecord;
  events: AdminEventRecord[];
  feedbackList: BetaFeedbackItem[];
  onClose: () => void;
  onUpdateStatus?: (userId: string, newStatus: 'active' | 'suspended' | 'revoked') => Promise<void>;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AdminBusinessDetailModal: React.FC<AdminBusinessDetailModalProps> = ({
  user,
  events,
  feedbackList,
  onClose,
  onUpdateStatus,
  onShowToast,
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Filter events and feedback for this user
  const userEvents = events.filter(
    (e) => e.userId === user.userId || (user.email && e.userEmail === user.email)
  );

  const userFeedback = feedbackList.filter(
    (f) => f.userId === user.userId || (user.email && f.userEmail === user.email)
  );

  // Derived engagement facts
  const hasActivated =
    user.totalTransactions > 0 ||
    user.salesCount > 0 ||
    user.expensesCount > 0 ||
    user.customersCount > 0 ||
    user.stockUpdatesCount > 0 ||
    user.aiInteractionsCount > 0;

  const firstActivityDate = user.firstActivityAt || user.joinedAt;
  const lastActivityDate = user.lastActivityAt || user.lastActiveAt;

  // Active days count estimate
  const distinctDaysActive = new Set(
    userEvents.map((e) => new Date(e.timestamp).toISOString().slice(0, 10))
  ).size;

  const isReturning = distinctDaysActive > 1;

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.userId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    if (onShowToast) onShowToast('User ID copied to clipboard', 'info');
  };

  const handleStatusChange = async (newBetaStatus: 'active' | 'suspended' | 'revoked') => {
    if (!onUpdateStatus) return;
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(user.userId, newBetaStatus);
      if (onShowToast) onShowToast(`Updated status to ${newBetaStatus}`, 'success');
    } catch {
      if (onShowToast) onShowToast('Failed to update status', 'warning');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Top Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/80">
          <div className="flex items-start space-x-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                  {user.businessName || 'Business Profile'}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    user.status === 'active'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                      : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                  }`}
                >
                  {user.status}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    user.betaStatus === 'active'
                      ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Beta: {user.betaStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-500" />
                  {user.email || 'No email associated'}
                </span>
                <span className="text-slate-600">&bull;</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="font-mono text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                  title="Click to copy UID"
                >
                  <span>UID: {user.userId.slice(0, 12)}...</span>
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Quick Founder Answers Pill Box */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Did they activate?</p>
              <p className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${hasActivated ? 'text-emerald-400' : 'text-amber-400'}`}>
                {hasActivated ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {hasActivated ? 'Activated' : 'Zero actions yet'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Are they returning?</p>
              <p className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${isReturning ? 'text-emerald-400' : 'text-slate-400'}`}>
                <Repeat className="w-4 h-4" />
                {isReturning ? `Returning (${distinctDaysActive} days)` : 'Single day user'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Transactions</p>
              <p className="text-sm font-bold text-white mt-0.5">{user.totalTransactions} recorded</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Encountered Problems?</p>
              <p className={`text-sm font-bold mt-0.5 ${userFeedback.length > 0 ? 'text-pink-400' : 'text-slate-400'}`}>
                {userFeedback.length > 0 ? `${userFeedback.length} reported issues` : 'No issues reported'}
              </p>
            </div>
          </div>

          {/* Section 1: Account & Engagement Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Info */}
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                Account Details
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Owner Identifier:</span>
                  <span className="text-slate-200 font-medium">{user.ownerName || user.email || user.userId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Joined Date:</span>
                  <span className="text-slate-200 font-medium">
                    {user.joinedAt ? new Date(user.joinedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Last Active:</span>
                  <span className="text-slate-200 font-medium">
                    {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Beta Invitation Code:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{user.betaInvitationCode || 'None / Direct'}</span>
                </div>
              </div>
            </div>

            {/* Engagement Details */}
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                Engagement & Retention
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">First Activity:</span>
                  <span className="text-slate-200 font-medium">
                    {firstActivityDate ? new Date(firstActivityDate).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Active Calendar Days:</span>
                  <span className="text-slate-200 font-semibold">{distinctDaysActive || 1} day(s)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/50">
                  <span className="text-slate-400">Products in Catalog:</span>
                  <span className="text-slate-200 font-semibold">{user.productsCount || 0}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Customer Records:</span>
                  <span className="text-slate-200 font-semibold">{user.customersCount || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Product Activity Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              Activity Breakdown
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Sales Logged</p>
                <p className="text-base font-bold text-emerald-400 mt-0.5">{user.salesCount || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Expenses Logged</p>
                <p className="text-base font-bold text-amber-400 mt-0.5">{user.expensesCount || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">AI Assistant Uses</p>
                <p className="text-base font-bold text-teal-400 mt-0.5">{user.aiInteractionsCount || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Stock / Yield Updates</p>
                <p className="text-base font-bold text-sky-400 mt-0.5">{user.stockUpdatesCount || 0}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Recent Real Activity Chronology */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              Recent Chronological Activity ({userEvents.length} events)
            </h3>

            {userEvents.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No individual events recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-56 overflow-y-auto">
                {userEvents.slice(0, 15).map((ev) => (
                  <div key={ev.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="font-semibold text-slate-200 capitalize truncate">
                        {ev.eventName.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Submitted Feedback / Problem Reports */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
              Feedback Submitted by this Business ({userFeedback.length})
            </h3>

            {userFeedback.length === 0 ? (
              <p className="text-xs text-slate-500 py-2 text-center">This merchant has not submitted any problem reports or feedback.</p>
            ) : (
              <div className="space-y-2">
                {userFeedback.map((fb) => (
                  <div key={fb.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-pink-950 text-pink-400 border border-pink-800/60">
                        {fb.type}
                      </span>
                      <span className="text-[10px] text-slate-500">{new Date(fb.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-200 pt-1">{fb.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Change Buttons */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 text-[11px] font-semibold">Change Beta Access:</span>
            <button
              type="button"
              disabled={isUpdatingStatus || user.betaStatus === 'active'}
              onClick={() => handleStatusChange('active')}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 disabled:opacity-40"
            >
              Set Active
            </button>
            <button
              type="button"
              disabled={isUpdatingStatus || user.betaStatus === 'suspended'}
              onClick={() => handleStatusChange('suspended')}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900 disabled:opacity-40"
            >
              Suspend
            </button>
            <button
              type="button"
              disabled={isUpdatingStatus || user.betaStatus === 'revoked'}
              onClick={() => handleStatusChange('revoked')}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 disabled:opacity-40"
            >
              Revoke
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {user.email && (
              <a
                href={`mailto:${user.email}?subject=Karra%20Beta%20Check-in`}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700"
              >
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Contact Merchant</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
