import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Users,
  MessageSquare,
  BarChart3,
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  AlertTriangle,
  UserX,
  UserCheck,
  Send,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Building2,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BetaInvitation, BetaFeedbackItem, BetaAccessRequest, BetaAnalytics } from '../types';

interface AdminDashboardViewProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  onNavigateTab?: (tab: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onShowToast,
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'invitations' | 'requests' | 'users' | 'feedback'>('overview');

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
      const headers = {
        ...getAdminHeaders(),
        ...(options.headers || {}),
      };
      const res = await fetch(url, {
        ...options,
        headers,
      });
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

      if (invData?.invitations) setInvitations(invData.invitations);
      if (usersData?.users) setUsers(usersData.users);
      if (fbData?.feedback) setFeedbackList(fbData.feedback);
      if (reqData?.requests) setAccessRequests(reqData.requests);
      if (anaData?.analytics) setAnalytics(anaData.analytics);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

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

  const handleApproveRequest = async (requestId: string, reqName: string, reqBiz: string) => {
    try {
      // Create invitation for this approved merchant
      const inviteData = await safeFetchJson('/api/admin/invitations/create', {
        method: 'POST',
        body: JSON.stringify({
          notes: `Approved for ${reqName} (${reqBiz})`,
          maxUses: 1,
        }),
      });

      if (inviteData?.success) {
        if (onShowToast) onShowToast(`Approved ${reqName}! Generated code: ${inviteData.invitation.code}`, 'success');
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

  const pendingRequests = accessRequests.filter((r) => r.status === 'pending');
  const openFeedback = feedbackList.filter((f) => f.status === 'open');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner: Founder Welcome & Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-purple-500/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Karra Founder Admin Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/30 border border-purple-400/50 text-purple-200 uppercase tracking-wider">
                  Founder Portal
                </span>
              </div>
              <p className="text-xs sm:text-sm text-purple-200/80 mt-0.5">
                Full governance over merchant invitations, access gates, beta testers, and user feedback.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('dashboard')}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <span>Back to Store Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-purple-200/70 tracking-wider">Total Invitations</span>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              {analytics?.totalInvitations ?? invitations.length}
            </p>
            <span className="text-[10px] text-emerald-300 font-semibold">
              {analytics?.activeInvitations ?? invitations.filter(i => i.status === 'active').length} active codes
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-purple-200/70 tracking-wider">Registered Merchants</span>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              {analytics?.totalBetaUsers ?? users.length}
            </p>
            <span className="text-[10px] text-purple-200 font-semibold">
              {users.filter(u => u.betaStatus === 'active').length} active stores
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-purple-200/70 tracking-wider">Access Requests</span>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              {accessRequests.length}
            </p>
            <span className="text-[10px] text-amber-300 font-semibold">
              {pendingRequests.length} pending review
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-purple-200/70 tracking-wider">Feedback Submissions</span>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              {feedbackList.length}
            </p>
            <span className="text-[10px] text-emerald-300 font-semibold">
              {openFeedback.length} open issues
            </span>
          </div>
        </div>
      </div>

      {/* Admin Subtabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] rounded-2xl px-3 py-1 shadow-xs overflow-x-auto gap-1">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'overview'
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('invitations')}
          className={`flex items-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'invitations'
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Invitation Codes ({invitations.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('requests')}
          className={`flex items-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'requests'
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Access Requests ({pendingRequests.length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Registered Stores ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('feedback')}
          className={`flex items-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'feedback'
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Merchant Feedback ({feedbackList.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW & QUICK GENERATOR
         ========================================================================= */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Quick Code Generator */}
          <div className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1">
                <Plus className="w-4 h-4" />
                <span>Quick Code Generator</span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Generate Beta Invitation Pass
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Create a single or multi-use invitation pass for VIP merchants or partners.
              </p>
            </div>

            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient / Merchant Notes
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. VIP Merchant: Alhaji Musa (Alaba)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#161F2E] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Max Uses
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newMaxUses}
                    onChange={(e) => setNewMaxUses(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#161F2E] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={newExpiryDays}
                    onChange={(e) => setNewExpiryDays(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Never"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#161F2E] text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingInvite}
                className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingInvite ? 'Generating Code...' : 'Generate Invitation Code'}</span>
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Codes format: KARRA-XXXX-XXXX (Auto-encrypted)</span>
              </div>
              <p>Direct code entry automatically unlocks store registration.</p>
            </div>
          </div>

          {/* Right Column: Pending Access Requests & Recent Activity */}
          <div className="lg:col-span-7 space-y-6">
            {/* Pending Requests Box */}
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Pending Beta Applications ({pendingRequests.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Merchants who requested access from the landing page.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSubTab('requests')}
                  className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  View All &rarr;
                </button>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">All caught up!</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    No pending beta access requests awaiting approval.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-3">
                  {pendingRequests.slice(0, 3).map((req) => (
                    <div key={req.id} className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white">{req.fullName}</span>
                          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">&bull; {req.businessName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-3 mt-0.5">
                          <span>{req.phone}</span>
                          <span>{req.email}</span>
                        </div>
                        {req.notes && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 italic mt-1 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                            &ldquo;{req.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleApproveRequest(req.id, req.fullName, req.businessName)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Issue Code</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Invitations Snapshot */}
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Active Invitation Codes
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live passes ready for merchant registration.
                  </p>
                </div>
                <button
                  onClick={() => setActiveSubTab('invitations')}
                  className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Manage All &rarr;
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {invitations.slice(0, 4).map((inv) => (
                  <div
                    key={inv.code}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161F2E] border border-slate-200 dark:border-slate-700/80 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-extrabold text-xs text-slate-900 dark:text-white tracking-wider block">
                        {inv.code}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {inv.notes || 'General Pass'} &bull; {inv.currentUses}/{inv.maxUses} used
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(inv.code)}
                      className="p-2 rounded-xl text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === inv.code ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: INVITATION CODES MANAGER
         ========================================================================= */}
      {activeSubTab === 'invitations' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                All Invitation Codes ({invitations.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate, copy, monitor, or revoke private beta invitation passes.
              </p>
            </div>
            <button
              onClick={() => setActiveSubTab('overview')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Pass</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Invitation Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Uses</th>
                  <th className="py-3 px-4">Notes / Assigned To</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {invitations.map((inv) => (
                  <tr key={inv.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {inv.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : inv.status === 'redeemed'
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                          : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {inv.currentUses} / {inv.maxUses}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {inv.notes || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleCopyCode(inv.code)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedCode === inv.code ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      {inv.status === 'active' && (
                        <button
                          onClick={() => handleRevokeInvitation(inv.code)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          title="Revoke Code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ACCESS REQUESTS (From Landing Page)
         ========================================================================= */}
      {activeSubTab === 'requests' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Merchant Beta Applications ({accessRequests.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review and approve incoming access requests submitted via the landing page.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {accessRequests.map((req) => (
              <div key={req.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">{req.fullName}</span>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">&bull; {req.businessName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.status === 'pending'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{req.phone}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{req.email}</span>
                    </span>
                    <span>Applied: {new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                  {req.notes && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      &ldquo;{req.notes}&rdquo;
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <button
                    onClick={() => handleApproveRequest(req.id, req.fullName, req.businessName)}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shrink-0 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Issue Code</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: REGISTERED USERS
         ========================================================================= */}
      {activeSubTab === 'users' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Registered Merchant Stores ({users.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage merchant account access, roles, and suspension states.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Merchant Name & Store</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Beta Status</th>
                  <th className="py-3 px-4">Invitation Used</th>
                  <th className="py-3 px-4 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {users.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      <div>{u.businessName || 'My Business'}</div>
                      <span className="text-[10px] text-slate-400 font-normal">ID: {u.userId.slice(0, 8)}...</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === 'admin'
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {u.role || 'merchant'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.betaStatus === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                      }`}>
                        {u.betaStatus || 'active'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {u.betaInvitationCode || 'Direct'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.role !== 'admin' && (
                        u.betaStatus === 'active' ? (
                          <button
                            onClick={() => handleSetUserStatus(u.userId, 'suspended')}
                            className="text-red-600 hover:underline text-[11px] font-bold cursor-pointer"
                          >
                            Suspend Access
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSetUserStatus(u.userId, 'active')}
                            className="text-emerald-600 hover:underline text-[11px] font-bold cursor-pointer"
                          >
                            Reactivate Access
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: MERCHANT FEEDBACK
         ========================================================================= */}
      {activeSubTab === 'feedback' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Merchant Feedback & Suggestions ({feedbackList.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bug reports and feedback collected via the floating feedback balloon.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {feedbackList.map((item) => (
              <div key={item.id} className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white">{item.businessName}</span>
                    <span className="text-[11px] text-slate-500">&bull; {item.userEmail}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      {item.type}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 leading-relaxed">
                  &ldquo;{item.message}&rdquo;
                </p>

                {item.context && (
                  <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-3">
                    <span>Tab: {item.context.tab || 'General'}</span>
                    <span>Device: {item.context.device || 'Web'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
