import React, { useState } from 'react';
import {
  Ticket,
  Plus,
  Copy,
  Check,
  Trash2,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Mail,
  Phone,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { BetaInvitation, BetaAccessRequest } from '../../types';

interface AdminBetaTabProps {
  invitations: BetaInvitation[];
  accessRequests: BetaAccessRequest[];
  onCreateInvitation: (params: {
    maxUses?: number;
    notes?: string;
    expiresAt?: string | null;
    customCode?: string;
  }) => Promise<BetaInvitation | null>;
  onRevokeInvitation: (code: string) => Promise<boolean>;
  onApproveAccessRequest: (request: BetaAccessRequest) => Promise<void>;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AdminBetaTab: React.FC<AdminBetaTabProps> = ({
  invitations,
  accessRequests,
  onCreateInvitation,
  onRevokeInvitation,
  onApproveAccessRequest,
  onShowToast,
}) => {
  const [activeSubView, setActiveSubView] = useState<'invitations' | 'requests'>('invitations');

  // Generator form state
  const [notes, setNotes] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [expiryDays, setExpiryDays] = useState<number | ''>('');
  const [customCode, setCustomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);

  // Overview stats
  const totalInvs = invitations.length;
  const activeInvs = invitations.filter((i) => i.status === 'active').length;
  const redeemedInvs = invitations.filter((i) => i.status === 'redeemed' || i.currentUses > 0).length;
  const revokedInvs = invitations.filter((i) => i.status === 'revoked').length;
  const pendingRequests = accessRequests.filter((r) => r.status === 'pending').length;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    if (onShowToast) onShowToast(`Invitation code ${code} copied!`, 'info');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const expiresAt =
        typeof expiryDays === 'number' && expiryDays > 0
          ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const result = await onCreateInvitation({
        notes: notes.trim() || undefined,
        maxUses: Number(maxUses) || 1,
        expiresAt,
        customCode: customCode.trim() || undefined,
      });

      if (result) {
        setNotes('');
        setCustomCode('');
        setExpiryDays('');
        setMaxUses(1);
        handleCopy(result.code);
        if (onShowToast) onShowToast(`Created invitation ${result.code} & copied to clipboard!`, 'success');
      } else {
        if (onShowToast) onShowToast('Failed to create invitation. Please try again.', 'warning');
      }
    } catch {
      if (onShowToast) onShowToast('Failed to create invitation', 'warning');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (code: string) => {
    if (!window.confirm(`Revoke invitation code ${code}? It can no longer be used to sign up.`)) return;
    try {
      const ok = await onRevokeInvitation(code);
      if (ok && onShowToast) {
        onShowToast(`Invitation ${code} revoked.`, 'info');
      }
    } catch {
      if (onShowToast) onShowToast('Could not revoke invitation', 'warning');
    }
  };

  const handleApprove = async (req: BetaAccessRequest) => {
    setApprovingRequestId(req.id);
    try {
      await onApproveAccessRequest(req);
      if (onShowToast) onShowToast(`Generated & assigned invitation for ${req.businessName}!`, 'success');
    } catch {
      if (onShowToast) onShowToast('Failed to approve request', 'warning');
    } finally {
      setApprovingRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Beta Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Invitations</p>
          <p className="text-xl font-bold text-white mt-1">{totalInvs}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Active Available</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{activeInvs}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Redeemed</p>
          <p className="text-xl font-bold text-purple-400 mt-1">{redeemedInvs}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Revoked</p>
          <p className="text-xl font-bold text-rose-400 mt-1">{revokedInvs}</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Waitlist Requests</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{pendingRequests} pending</p>
        </div>
      </div>

      {/* 2. Sub-navigation Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubView('invitations')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubView === 'invitations'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>Invitations ({invitations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubView === 'requests'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Waitlist & Access Requests ({accessRequests.length})</span>
          {pendingRequests > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
              {pendingRequests}
            </span>
          )}
        </button>
      </div>

      {activeSubView === 'invitations' ? (
        <div className="space-y-6">
          {/* Create New Invitation Form */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Generate Beta Invitation Code
              </h3>
              <button
                type="button"
                disabled={isCreating}
                onClick={async () => {
                  setIsCreating(true);
                  try {
                    const result = await onCreateInvitation({ maxUses: 1, notes: 'Instant Quick Code' });
                    if (result) {
                      handleCopy(result.code);
                      if (onShowToast) onShowToast(`Instant Code: ${result.code} (Copied to clipboard!)`, 'success');
                    }
                  } catch (e: any) {
                    if (onShowToast) onShowToast(e?.message || 'Could not generate code', 'warning');
                  } finally {
                    setIsCreating(false);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>⚡ Instant 1-Click Code</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Recipient / Merchant Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alaba Wholesale Store"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Custom Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. KARRA-VIP-001"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 uppercase font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Max Uses
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-2 px-4 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreating ? 'Generating...' : 'Generate Code'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Invitations Table */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
            {invitations.length === 0 ? (
              <div className="py-14 text-center">
                <Ticket className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-300">No invitations yet</h3>
                <p className="text-xs text-slate-500 mt-1">Generate a code above to invite your first beta merchant.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Usage</th>
                      <th className="py-3 px-3">Note / Recipient</th>
                      <th className="py-3 px-3">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invitations.map((inv) => {
                      const isCopied = copiedCode === inv.code;
                      const isActive = inv.status === 'active';

                      return (
                        <tr key={inv.id || inv.code} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800/50">
                              {inv.code}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                isActive
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                                  : inv.status === 'redeemed'
                                  ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                  : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {inv.currentUses} / {inv.maxUses} used
                          </td>
                          <td className="py-3 px-3 text-slate-300 truncate max-w-xs">
                            {inv.notes || '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(inv.code)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                              title="Copy code"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>

                            {isActive && (
                              <button
                                type="button"
                                onClick={() => handleRevoke(inv.code)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-800/50 cursor-pointer"
                                title="Revoke code"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Revoke</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Access Requests / Waitlist Subview */
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
          {accessRequests.length === 0 ? (
            <div className="py-14 text-center">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-300">No waitlist requests yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                When merchants submit beta access requests from the landing page, they will show up here for 1-click approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Merchant / Business</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Note</th>
                    <th className="py-3 px-3">Requested</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {accessRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproving = approvingRequestId === req.id;

                    return (
                      <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-white text-xs">{req.businessName}</p>
                          <p className="text-[11px] text-slate-400">{req.fullName}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-slate-200">{req.email}</p>
                          <p className="text-slate-400 text-[11px]">{req.phone}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                          {req.notes || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              isPending
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                : req.status === 'approved'
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isPending && (
                            <button
                              type="button"
                              disabled={isApproving}
                              onClick={() => handleApprove(req)}
                              className="px-3 py-1 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {isApproving ? 'Approving...' : 'Approve & Create Invite'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
