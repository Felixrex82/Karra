import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Key,
  Users,
  MessageSquare,
  ClipboardList,
  BarChart3,
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  AlertTriangle,
  UserX,
  UserCheck,
  Calendar,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BetaInvitation, BetaFeedbackItem, BetaAccessRequest, BetaAnalytics } from '../types';

interface BetaAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const BetaAdminModal: React.FC<BetaAdminModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'invitations' | 'users' | 'feedback' | 'requests' | 'analytics'>('invitations');

  // Data states
  const [invitations, setInvitations] = useState<BetaInvitation[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [feedbackList, setFeedbackList] = useState<BetaFeedbackItem[]>([]);
  const [accessRequests, setAccessRequests] = useState<BetaAccessRequest[]>([]);
  const [analytics, setAnalytics] = useState<BetaAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // New invitation form state
  const [newNotes, setNewNotes] = useState('');
  const [newMaxUses, setNewMaxUses] = useState(1);
  const [newExpiryDays, setNewExpiryDays] = useState<number | ''>('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const getAdminSecret = () => {
    try {
      return sessionStorage.getItem('karra_admin_token') || '';
    } catch {
      return '';
    }
  };

  const getAdminHeaders = () => {
    const secret = getAdminSecret();
    return {
      'Content-Type': 'application/json',
      'x-admin-email': user?.email || 'olamidefelix54@gmail.com',
      'x-admin-secret': secret,
      ...(secret ? { 'Authorization': `Bearer ${secret}` } : {}),
    };
  };

  const safeFetchJson = async (url: string, options: RequestInit = {}) => {
    try {
      const secret = getAdminSecret();
      if (!secret) return null;

      const headers = {
        ...getAdminHeaders(),
        ...(options.headers || {}),
      };
      const res = await fetch(url, {
        ...options,
        headers,
      });
      if (res.status === 401 || res.status === 403) {
        return null;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn(`Non-JSON response from ${url}: status ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.warn(`Fetch error for ${url}:`, err);
      return null;
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [invData, usersData, fbData, reqData, anaData] = await Promise.all([
        safeFetchJson('/api/admin/invitations'),
        safeFetchJson('/api/admin/users'),
        safeFetchJson('/api/admin/feedback'),
        safeFetchJson('/api/admin/access-requests'),
        safeFetchJson('/api/admin/analytics'),
      ]);

      if (invData?.invitations) {
        setInvitations(invData.invitations);
      }
      if (usersData?.users) {
        setUsers(usersData.users);
      }
      if (fbData?.feedback) {
        setFeedbackList(fbData.feedback);
      }
      if (reqData?.requests) {
        setAccessRequests(reqData.requests);
      }
      if (anaData?.analytics) {
        setAnalytics(anaData.analytics);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingInvite(true);
    try {
      const expiresAt =
        typeof newExpiryDays === 'number' && newExpiryDays > 0
          ? new Date(Date.now() + newExpiryDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const data = await safeFetchJson('/api/admin/invitations/create', {
        method: 'POST',
        body: JSON.stringify({
          notes: newNotes.trim() || undefined,
          maxUses: Number(newMaxUses) || 1,
          expiresAt,
        }),
      });
      if (data?.success) {
        if (onShowToast) onShowToast(`Generated code: ${data.invitation.code}`, 'success');
        setNewNotes('');
        setNewMaxUses(1);
        setNewExpiryDays('');
        loadAllData();
      } else {
        if (onShowToast) onShowToast(data?.error || 'Failed to create code', 'warning');
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message, 'warning');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleRevokeInvitation = async (code: string) => {
    try {
      const data = await safeFetchJson('/api/admin/invitations/revoke', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (data?.success) {
        if (onShowToast) onShowToast(`Invitation ${code} revoked.`, 'info');
        loadAllData();
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message, 'warning');
    }
  };

  const handleSetUserStatus = async (userId: string, status: 'active' | 'suspended' | 'revoked') => {
    try {
      const data = await safeFetchJson('/api/admin/users/status', {
        method: 'POST',
        body: JSON.stringify({ userId, status }),
      });
      if (data?.success) {
        if (onShowToast) onShowToast(`User status updated to ${status}.`, 'info');
        loadAllData();
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message, 'warning');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
    if (onShowToast) onShowToast(`Copied code: ${code}`, 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#111827] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:px-7 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Founder Beta Console
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage invitations, testers, feedback, and access gates.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 sm:px-7 bg-white dark:bg-[#111827] overflow-x-auto gap-2">
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'invitations'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Invitations ({invitations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'users'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Beta Testers ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'feedback'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Feedback ({feedbackList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'requests'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Waitlist ({accessRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 py-3 px-3 border-b-2 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              activeTab === 'analytics'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          
          {/* TAB 1: INVITATIONS */}
          {activeTab === 'invitations' && (
            <div className="space-y-6">
              {/* Generator Card */}
              <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center space-x-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Generate New Invitation Code</span>
                </h3>
                <form onSubmit={handleCreateInvitation} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Merchant Label / Notes
                    </label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="e.g. Tester 6 - Alaba Electronics"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Max Allowed Uses
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newMaxUses}
                      onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isCreatingInvite}
                      className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm hover:shadow disabled:opacity-50 cursor-pointer transition-all"
                    >
                      {isCreatingInvite ? 'Generating...' : 'Generate Code'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Invitations List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active & Issued Invitations
                </h3>
                {invitations.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No invitation codes created yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-[#111827]">
                    {invitations.map((inv, idx) => (
                      <div key={inv.id || inv.code || `inv-${idx}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2.5">
                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white tracking-wider">
                              {inv.code}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                inv.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : inv.status === 'redeemed'
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                  : inv.status === 'revoked'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {inv.status}
                            </span>
                            <span className="text-xs text-slate-400">
                              Uses: {inv.currentUses} / {inv.maxUses}
                            </span>
                          </div>
                          {inv.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {inv.notes}
                            </p>
                          )}
                          {inv.redeemedAt && (
                            <p className="text-[11px] text-slate-400">
                              Redeemed at: {new Date(inv.redeemedAt).toLocaleString()}
                              {inv.usedBy && inv.usedBy.length > 0 && ` by ${inv.usedBy.map((u) => u.userEmail).join(', ')}`}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => handleCopyCode(inv.code)}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          >
                            {copiedCode === inv.code ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>

                          {inv.status === 'active' && (
                            <button
                              onClick={() => handleRevokeInvitation(inv.code)}
                              className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BETA TESTERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Registered Beta Merchants ({users.length})
                </h3>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No beta accounts registered yet. Share an invitation code to onboard your first merchant!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-[#111827]">
                  {users.map((u, idx) => {
                    const userId = u.userId || u.id || `user-${idx}`;
                    const userKey = u.userId || u.id || u.email || `user-${idx}`;
                    return (
                      <div key={userKey} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {u.businessName || 'Business'}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                u.betaStatus === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : u.betaStatus === 'suspended'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              }`}
                            >
                              {u.betaStatus || 'active'}
                            </span>
                            {u.role === 'admin' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                Founder
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {u.email} &bull; Code: <span className="font-mono font-medium">{u.betaInvitationCode || 'N/A'}</span>
                          </p>
                          {(u.betaJoinedAt || u.joinedAt) && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Joined: {new Date(u.betaJoinedAt || u.joinedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {u.betaStatus === 'active' ? (
                            <button
                              onClick={() => handleSetUserStatus(userId, 'suspended')}
                              className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetUserStatus(userId, 'active')}
                              className="px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TESTER FEEDBACK */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Incoming Tester Bug Reports & Feedback ({feedbackList.length})
              </h3>

              {feedbackList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No feedback items submitted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbackList.map((fb, idx) => (
                    <div
                      key={fb.id || `fb-${idx}`}
                      className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {fb.type.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {fb.businessName} ({fb.userEmail})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(fb.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {fb.message}
                      </p>
                      {fb.context && (
                        <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/40 flex items-center space-x-3">
                          <span>Tab: <strong>{fb.context.tab}</strong></span>
                          <span>Screen: {fb.context.screen}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACCESS REQUESTS (WAITLIST) */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Merchants Requesting Access ({accessRequests.length})
              </h3>

              {accessRequests.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No access requests submitted from the landing page.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-[#111827]">
                  {accessRequests.map((req, idx) => (
                    <div key={req.id || req.email || `req-${idx}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {req.businessName}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({req.fullName})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Email: {req.email} {req.phone && `• Tel: ${req.phone}`}
                        </p>
                        {req.notes && (
                          <p className="text-xs italic text-slate-500 dark:text-slate-400">
                            "{req.notes}"
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400">
                          Requested: {new Date(req.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={async () => {
                          const d = await safeFetchJson('/api/admin/invitations/create', {
                            method: 'POST',
                            body: JSON.stringify({
                              notes: `For: ${req.fullName} (${req.businessName})`,
                              maxUses: 1,
                            }),
                          });
                          if (d?.success && d.invitation) {
                            handleCopyCode(d.invitation.code);
                            if (onShowToast) onShowToast(`Created code ${d.invitation.code} and copied to clipboard!`, 'success');
                            loadAllData();
                          } else {
                            if (onShowToast) onShowToast(d?.error || 'Failed to generate code', 'warning');
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition-all shrink-0"
                      >
                        Generate & Copy Code
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Closed Beta Telemetry
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Total Invitations
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {analytics?.totalInvitations || invitations.length}
                  </span>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block mb-1">
                    Active Invitations
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200">
                    {analytics?.activeInvitations || 0}
                  </span>
                </div>

                <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-2xl border border-sky-200 dark:border-sky-800/60">
                  <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 block mb-1">
                    Redeemed Codes
                  </span>
                  <span className="text-2xl font-extrabold text-sky-800 dark:text-sky-200">
                    {analytics?.redeemedInvitations || 0}
                  </span>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/60">
                  <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 block mb-1">
                    Active Beta Testers
                  </span>
                  <span className="text-2xl font-extrabold text-purple-800 dark:text-purple-200">
                    {analytics?.activeBetaUsers || users.length}
                  </span>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/60">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 block mb-1">
                    Feedback Items
                  </span>
                  <span className="text-2xl font-extrabold text-amber-800 dark:text-amber-200">
                    {analytics?.totalFeedbackSubmissions || feedbackList.length}
                  </span>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/60">
                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 block mb-1">
                    Waitlist Inquiries
                  </span>
                  <span className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-200">
                    {analytics?.totalAccessRequests || accessRequests.length}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
