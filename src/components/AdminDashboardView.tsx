import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AdminSidebar,
  AdminTab,
} from './admin/AdminSidebar';
import {
  AdminHeader,
} from './admin/AdminHeader';
import {
  AdminOverviewTab,
} from './admin/AdminOverviewTab';
import {
  AdminUsersTab,
} from './admin/AdminUsersTab';
import {
  AdminActivityTab,
} from './admin/AdminActivityTab';
import {
  AdminAnalyticsTab,
} from './admin/AdminAnalyticsTab';
import {
  AdminFeedbackTab,
} from './admin/AdminFeedbackTab';
import {
  AdminBetaTab,
} from './admin/AdminBetaTab';
import {
  AdminSettingsTab,
} from './admin/AdminSettingsTab';
import {
  AdminBusinessDetailModal,
} from './admin/AdminBusinessDetailModal';
import {
  AdminUserRecord,
  AdminEventRecord,
  DailyActivityRecord,
  AdminDateRange,
} from './admin/adminTypes';
import {
  BetaInvitation,
  BetaFeedbackItem,
  BetaAccessRequest,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchAdminAllFirestoreUsers,
  fetchAdminFirestoreEvents,
  fetchAdminFirestoreFeedback,
  fetchAdminFirestoreAccessRequests,
} from '../lib/firebase';

interface AdminDashboardViewProps {
  onShowToast?: (message: string, type?: 'success' | 'info' | 'warning') => void;
  onNavigateTab?: (tab: string) => void;
  onUnauthorized?: () => void;
  onExitAdmin?: () => void;
}

const FOUNDER_EMAIL = 'olamidefelix54@gmail.com';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onShowToast,
  onNavigateTab,
  onUnauthorized,
  onExitAdmin,
}) => {
  const { user } = useAuth();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Date Range State
  const [dateRange, setDateRange] = useState<AdminDateRange>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Data states
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [events, setEvents] = useState<AdminEventRecord[]>([]);
  const [invitations, setInvitations] = useState<BetaInvitation[]>([]);
  const [feedbackList, setFeedbackList] = useState<BetaFeedbackItem[]>([]);
  const [accessRequests, setAccessRequests] = useState<BetaAccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Drilldown / Detail modal
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);

  const getAdminSecret = () => {
    try {
      return (
        sessionStorage.getItem('karra_admin_token') ||
        localStorage.getItem('karra_admin_token') ||
        sessionStorage.getItem('karra_admin_auth') ||
        'founder_active_admin'
      );
    } catch {
      return 'founder_active_admin';
    }
  };

  const getAdminHeaders = () => {
    const secret = getAdminSecret();
    return {
      'Content-Type': 'application/json',
      'x-admin-email': user?.email || FOUNDER_EMAIL,
      'x-admin-secret': secret,
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    };
  };

  const safeFetchJson = async (url: string, options: RequestInit = {}) => {
    try {
      const headers = {
        ...getAdminHeaders(),
        ...(options.headers || {}),
      };
      const res = await fetch(url, { ...options, headers });

      if (res.status === 401 || res.status === 403) {
        if (onUnauthorized) onUnauthorized();
        return { success: false, error: 'Unauthorized' };
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, error: `Status ${res.status}` };
      }
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  };

  // Reconcile and load real data
  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setIsRefreshing(true);

    try {
      // 1. Fetch Backend API Endpoints in parallel
      const [invData, usersData, fbData, reqData, eventsData] = await Promise.all([
        safeFetchJson('/api/admin/invitations'),
        safeFetchJson('/api/admin/users'),
        safeFetchJson('/api/admin/feedback'),
        safeFetchJson('/api/admin/access-requests'),
        safeFetchJson('/api/admin/events?limit=1000'),
      ]);

      // 2. Fetch Live Firestore data in parallel if founder has Firebase session
      let firestoreUsers: Array<{ profile: any; ledger?: any }> = [];
      let firestoreEvents: any[] = [];
      let firestoreFeedback: any[] = [];
      let firestoreRequests: any[] = [];

      try {
        const [fsUsers, fsEvents, fsFb, fsReqs] = await Promise.all([
          fetchAdminAllFirestoreUsers(),
          fetchAdminFirestoreEvents(500),
          fetchAdminFirestoreFeedback(),
          fetchAdminFirestoreAccessRequests(),
        ]);
        firestoreUsers = fsUsers || [];
        firestoreEvents = fsEvents || [];
        firestoreFeedback = fsFb || [];
        firestoreRequests = fsReqs || [];
      } catch (fsErr) {
        console.warn('Firestore admin direct read skipped or partially loaded:', fsErr);
      }

      // 3. Reconcile Users (Real database data only)
      const userMap = new Map<string, AdminUserRecord>();

      // Populate from Server users
      if (Array.isArray(usersData?.users)) {
        usersData.users.forEach((u: any) => {
          const uid = u.userId || u.id;
          if (!uid) return;
          userMap.set(uid, {
            userId: uid,
            email: u.email || '',
            businessName: u.businessName || 'Business Account',
            ownerName: u.ownerName || '',
            joinedAt: u.joinedAt || u.betaJoinedAt || new Date().toISOString(),
            lastActiveAt: u.lastActiveAt || u.joinedAt || new Date().toISOString(),
            status: u.betaStatus === 'suspended' ? 'suspended' : 'active',
            betaStatus: u.betaStatus || 'active',
            betaInvitationCode: u.betaInvitationCode,
            role: u.role || 'merchant',
            totalTransactions: u.transactionCount || 0,
            salesCount: u.salesCount || 0,
            expensesCount: u.expensesCount || 0,
            stockUpdatesCount: u.stockCount || 0,
            customersCount: u.customersCount || 0,
            aiInteractionsCount: u.aiQueryCount || 0,
            memoryUpdatesCount: 0,
            activeDaysCount: 1,
          });
        });
      }

      // Merge with Firestore live profiles & actual ledgers
      firestoreUsers.forEach(({ profile, ledger }) => {
        if (!profile || !profile.id) return;
        const uid = profile.id;
        const existing = userMap.get(uid);

        // Analyze real ledger events if present
        let totalTx = 0;
        let sales = 0;
        let expenses = 0;
        let stock = 0;
        let customers = 0;
        let aiQueries = 0;
        let distinctDays = new Set<string>();

        if (ledger) {
          const ledgerEvents: any[] = ledger.events || [];
          totalTx = ledgerEvents.length;
          sales = ledgerEvents.filter((e: any) => e.type === 'SALE' || (e.totalRevenue && e.totalRevenue > 0)).length;
          expenses = ledgerEvents.filter((e: any) => e.type === 'EXPENSE' || (e.totalCostAtTime && e.totalCostAtTime > 0)).length;
          stock = (ledger.products || []).length;
          customers = (ledger.customers || []).length;
          aiQueries = (ledger.chatHistory || []).length;

          ledgerEvents.forEach((ev: any) => {
            const dateStr = ev.date || (ev.timestamp ? ev.timestamp.slice(0, 10) : null);
            if (dateStr) distinctDays.add(dateStr);
          });
        }

        const mergedRecord: AdminUserRecord = {
          userId: uid,
          email: profile.email || existing?.email || '',
          businessName: ledger?.businessName || profile.businessName || existing?.businessName || 'Business Account',
          ownerName: ledger?.ownerName || profile.displayName || existing?.ownerName || '',
          joinedAt: profile.createdAt || profile.betaJoinedAt || existing?.joinedAt || new Date().toISOString(),
          lastActiveAt:
            ledger?.updatedAt ||
            profile.updatedAt ||
            existing?.lastActiveAt ||
            new Date().toISOString(),
          status: profile.betaStatus === 'suspended' ? 'suspended' : 'active',
          betaStatus: profile.betaStatus || existing?.betaStatus || 'active',
          betaInvitationCode: profile.betaInvitationCode || existing?.betaInvitationCode,
          role: profile.role || existing?.role || 'merchant',
          totalTransactions: Math.max(totalTx, existing?.totalTransactions || 0),
          salesCount: Math.max(sales, existing?.salesCount || 0),
          expensesCount: Math.max(expenses, existing?.expensesCount || 0),
          stockUpdatesCount: Math.max(stock, existing?.stockUpdatesCount || 0),
          customersCount: Math.max(customers, existing?.customersCount || 0),
          aiInteractionsCount: Math.max(aiQueries, existing?.aiInteractionsCount || 0),
          memoryUpdatesCount: 0,
          activeDaysCount: Math.max(distinctDays.size, existing?.activeDaysCount || 1),
          productsCount: (ledger?.products || []).length,
        };

        userMap.set(uid, mergedRecord);
      });

      const reconciledUsers = Array.from(userMap.values()).sort((a, b) =>
        new Date(b.lastActiveAt || b.joinedAt).getTime() - new Date(a.lastActiveAt || a.joinedAt).getTime()
      );
      setUsers(reconciledUsers);

      // 4. Reconcile Events (server events + firestore events + ledger events)
      const eventMap = new Map<string, AdminEventRecord>();

      // Server tracked events
      if (Array.isArray(eventsData?.events)) {
        eventsData.events.forEach((ev: any) => {
          if (ev && ev.id) eventMap.set(ev.id, ev);
        });
      }

      // Firestore tracked events
      firestoreEvents.forEach((ev: any) => {
        if (ev && ev.id) eventMap.set(ev.id, ev);
      });

      // Extract real events from Firestore ledgers so timeline is populated
      firestoreUsers.forEach(({ profile, ledger }) => {
        if (!ledger || !Array.isArray(ledger.events)) return;
        ledger.events.forEach((lev: any) => {
          const evId = lev.id || `lev_${lev.date}_${lev.totalRevenue || lev.amount}`;
          if (!eventMap.has(evId)) {
            const isSale = lev.type === 'SALE' || (lev.totalRevenue && lev.totalRevenue > 0);
            eventMap.set(evId, {
              id: evId,
              userId: profile.id,
              userEmail: profile.email || '',
              businessName: ledger.businessName || profile.businessName || 'Business Account',
              eventName: isSale ? 'sale_recorded' : 'expense_recorded',
              timestamp: lev.timestamp || (lev.date ? `${lev.date}T12:00:00.000Z` : new Date().toISOString()),
              metadata: {
                amount: lev.totalRevenue || lev.amount || lev.cashReceived,
                headline: lev.headline || lev.note,
              },
            });
          }
        });
      });

      const reconciledEvents = Array.from(eventMap.values()).sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setEvents(reconciledEvents);

      // 5. Invitations (strictly real invitations from backend & local storage)
      const serverInvs: BetaInvitation[] = Array.isArray(invData?.invitations) ? invData.invitations : [];
      setInvitations(serverInvs);

      // 6. Feedback
      const feedbackMap = new Map<string, BetaFeedbackItem>();
      if (Array.isArray(fbData?.feedback)) {
        fbData.feedback.forEach((f: any) => feedbackMap.set(f.id, f));
      }
      firestoreFeedback.forEach((f: any) => {
        if (f && f.id) feedbackMap.set(f.id, f);
      });
      setFeedbackList(Array.from(feedbackMap.values()).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));

      // 7. Access Requests
      const reqMap = new Map<string, BetaAccessRequest>();
      if (Array.isArray(reqData?.requests)) {
        reqData.requests.forEach((r: any) => reqMap.set(r.id, r));
      }
      firestoreRequests.forEach((r: any) => {
        if (r && r.id) reqMap.set(r.id, r);
      });
      setAccessRequests(Array.from(reqMap.values()).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));

      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to load admin records:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Determine active date boundaries
  const { filterStartDate, filterEndDate, prevStartDate, prevEndDate, dateRangeLabel } = useMemo(() => {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined = now;
    let prevStart: Date | undefined;
    let prevEnd: Date | undefined;
    let label = 'Last 7 Days';

    if (dateRange === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      start = todayStart;
      prevStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      prevEnd = todayStart;
      label = 'Today';
    } else if (dateRange === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      prevEnd = start;
      label = 'Last 7 Days';
    } else if (dateRange === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      prevEnd = start;
      label = 'Last 30 Days';
    } else if (dateRange === '90d') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      prevEnd = start;
      label = 'Last 90 Days';
    } else if (dateRange === 'custom') {
      start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : undefined;
      end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : undefined;
      label = `${customStartDate} to ${customEndDate}`;
    }

    return {
      filterStartDate: start,
      filterEndDate: end,
      prevStartDate: prevStart,
      prevEndDate: prevEnd,
      dateRangeLabel: label,
    };
  }, [dateRange, customStartDate, customEndDate]);

  // Compute Daily Activity Buckets across selected date range
  const dailyActivity: DailyActivityRecord[] = useMemo(() => {
    if (!filterStartDate) return [];

    const daysCount = Math.max(
      1,
      Math.min(
        90,
        Math.ceil(((filterEndDate ? filterEndDate.getTime() : Date.now()) - filterStartDate.getTime()) / (24 * 60 * 60 * 1000))
      )
    );

    const result: DailyActivityRecord[] = [];
    const dateMap = new Map<string, DailyActivityRecord>();

    // Initialize calendar days in range
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(filterStartDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const displayDate = d.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      const record: DailyActivityRecord = {
        dateStr,
        displayDate,
        newUsers: 0,
        activeUsers: 0,
        transactions: 0,
        aiInteractions: 0,
        activeUserIds: [],
        events: [],
      };
      dateMap.set(dateStr, record);
      result.push(record);
    }

    // Bucket New Users by Join Date
    users.forEach((u) => {
      const joinDay = u.joinedAt ? u.joinedAt.slice(0, 10) : null;
      if (joinDay && dateMap.has(joinDay)) {
        dateMap.get(joinDay)!.newUsers += 1;
      }
    });

    // Bucket Events
    events.forEach((ev) => {
      const evDay = ev.timestamp ? ev.timestamp.slice(0, 10) : null;
      if (evDay && dateMap.has(evDay)) {
        const item = dateMap.get(evDay)!;
        item.events.push(ev);

        if (ev.userId && !item.activeUserIds.includes(ev.userId)) {
          item.activeUserIds.push(ev.userId);
        }

        if (['sale_recorded', 'expense_recorded', 'stock_updated', 'transaction_created', 'debt_recorded'].includes(ev.eventName)) {
          item.transactions += 1;
        }

        if (['ai_query', 'ai_interaction', 'ai_interpret', 'conversational_question'].includes(ev.eventName)) {
          item.aiInteractions += 1;
        }
      }
    });

    // Set activeUsers count per day
    result.forEach((item) => {
      item.activeUsers = item.activeUserIds.length;
    });

    return result;
  }, [filterStartDate, filterEndDate, users, events]);

  // Compute Previous Period Stats for comparison percentages
  const comparisonStats = useMemo(() => {
    if (!prevStartDate || !prevEndDate) return undefined;

    const pStart = prevStartDate.getTime();
    const pEnd = prevEndDate.getTime();

    const prevNewUsers = users.filter((u) => {
      const t = new Date(u.joinedAt).getTime();
      return t >= pStart && t < pEnd;
    }).length;

    const prevEvents = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= pStart && t < pEnd;
    });

    const activeIds = new Set<string>();
    let prevTx = 0;
    let prevAi = 0;

    prevEvents.forEach((e) => {
      if (e.userId) activeIds.add(e.userId);
      if (['sale_recorded', 'expense_recorded', 'stock_updated', 'transaction_created', 'debt_recorded'].includes(e.eventName)) {
        prevTx += 1;
      }
      if (['ai_query', 'ai_interaction', 'conversational_question'].includes(e.eventName)) {
        prevAi += 1;
      }
    });

    return {
      prevNewUsers,
      prevActiveUsers: activeIds.size,
      prevTransactions: prevTx,
      prevAiInteractions: prevAi,
    };
  }, [prevStartDate, prevEndDate, users, events]);

  // Create new invitation handler
  const handleCreateInvitation = async (params: {
    maxUses?: number;
    notes?: string;
    expiresAt?: string | null;
    customCode?: string;
  }): Promise<BetaInvitation | null> => {
    const res = await safeFetchJson('/api/admin/invitations/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (res?.success && res.invitation) {
      setInvitations((prev) => [res.invitation, ...prev]);
      return res.invitation;
    }
    return null;
  };

  // Revoke invitation handler
  const handleRevokeInvitation = async (code: string): Promise<boolean> => {
    const res = await safeFetchJson('/api/admin/invitations/revoke', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });

    if (res?.success) {
      setInvitations((prev) =>
        prev.map((i) => (i.code === code ? { ...i, status: 'revoked' } : i))
      );
      return true;
    }
    return false;
  };

  // Update user beta access status handler
  const handleUpdateUserStatus = async (
    userId: string,
    newStatus: 'active' | 'suspended' | 'revoked'
  ): Promise<void> => {
    await safeFetchJson('/api/admin/users/status', {
      method: 'POST',
      body: JSON.stringify({ userId, status: newStatus }),
    });

    setUsers((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, betaStatus: newStatus } : u))
    );

    if (selectedUser && selectedUser.userId === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, betaStatus: newStatus } : null));
    }
  };

  // Update feedback status handler
  const handleUpdateFeedbackStatus = async (
    id: string,
    status: 'open' | 'reviewed' | 'resolved'
  ): Promise<void> => {
    await safeFetchJson('/api/admin/feedback/status', {
      method: 'POST',
      body: JSON.stringify({ feedbackId: id, status }),
    });

    setFeedbackList((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  };

  // Approve waitlist request handler
  const handleApproveAccessRequest = async (request: BetaAccessRequest): Promise<void> => {
    // 1. Generate invitation
    const inv = await handleCreateInvitation({
      notes: `Approved for ${request.businessName} (${request.fullName})`,
      maxUses: 1,
    });

    // 2. Mark request approved
    await safeFetchJson('/api/admin/access-requests/status', {
      method: 'POST',
      body: JSON.stringify({ requestId: request.id, status: 'approved' }),
    });

    setAccessRequests((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, status: 'approved' } : r))
    );
  };

  // Badges
  const openFeedbackCount = feedbackList.filter((f) => (f.status || 'open') === 'open').length;
  const pendingRequestsCount = accessRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex font-sans selection:bg-emerald-900 selection:text-white">
      {/* 1. Primary Left Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExitAdmin={onExitAdmin || (() => onNavigateTab && onNavigateTab('dashboard'))}
        openFeedbackCount={openFeedbackCount}
        pendingRequestsCount={pendingRequestsCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        founderEmail={FOUNDER_EMAIL}
      />

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <AdminHeader
          title={
            activeTab === 'overview'
              ? 'Karra Overview'
              : activeTab === 'users'
              ? 'Merchant Accounts'
              : activeTab === 'activity'
              ? 'Live Activity Log'
              : activeTab === 'analytics'
              ? 'Product Analytics'
              : activeTab === 'feedback'
              ? 'User Problem Reports'
              : activeTab === 'beta'
              ? 'Beta Management'
              : 'Admin Settings'
          }
          subtitle={
            activeTab === 'overview'
              ? 'Understand how businesses are using Karra.'
              : activeTab === 'users'
              ? 'Inspect and manage registered merchant businesses.'
              : activeTab === 'activity'
              ? 'Stream of real-time merchant events and actions.'
              : activeTab === 'analytics'
              ? 'Acquisition trend, activation funnel, and feature adoption.'
              : activeTab === 'feedback'
              ? 'Direct feedback and bug reports from active merchants.'
              : activeTab === 'beta'
              ? 'Issue invitation codes and approve waitlist requests.'
              : 'Founder account credentials, system diagnostics, and raw data export.'
          }
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomDatesChange={(start, end) => {
            setCustomStartDate(start);
            setCustomEndDate(end);
          }}
          onRefresh={() => loadAllData(true)}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onSignOut={onUnauthorized || (() => {})}
          lastUpdated={lastRefreshedAt}
        />

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-400">Loading Karra Command Center...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <AdminOverviewTab
                  users={users}
                  events={events}
                  dailyActivity={dailyActivity}
                  dateRangeLabel={dateRangeLabel}
                  onSelectUser={(u) => setSelectedUser(u)}
                  onNavigateTab={(t) => setActiveTab(t as AdminTab)}
                  filterStartDate={filterStartDate}
                  filterEndDate={filterEndDate}
                  comparisonStats={comparisonStats}
                />
              )}

              {activeTab === 'users' && (
                <AdminUsersTab
                  users={users}
                  onSelectUser={(u) => setSelectedUser(u)}
                  onRefresh={() => loadAllData(true)}
                />
              )}

              {activeTab === 'activity' && (
                <AdminActivityTab
                  events={events}
                  users={users}
                  onSelectUser={(u) => setSelectedUser(u)}
                />
              )}

              {activeTab === 'analytics' && (
                <AdminAnalyticsTab
                  users={users}
                  events={events}
                  dailyActivity={dailyActivity}
                  dateRangeLabel={dateRangeLabel}
                />
              )}

              {activeTab === 'feedback' && (
                <AdminFeedbackTab
                  feedbackList={feedbackList}
                  onUpdateFeedbackStatus={handleUpdateFeedbackStatus}
                  onShowToast={onShowToast}
                />
              )}

              {activeTab === 'beta' && (
                <AdminBetaTab
                  invitations={invitations}
                  accessRequests={accessRequests}
                  onCreateInvitation={handleCreateInvitation}
                  onRevokeInvitation={handleRevokeInvitation}
                  onApproveAccessRequest={handleApproveAccessRequest}
                  onShowToast={onShowToast}
                />
              )}

              {activeTab === 'settings' && (
                <AdminSettingsTab
                  founderEmail={FOUNDER_EMAIL}
                  users={users}
                  events={events}
                  feedbackList={feedbackList}
                  invitations={invitations}
                  onExitAdmin={onExitAdmin || (() => onNavigateTab && onNavigateTab('dashboard'))}
                  onShowToast={onShowToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Individual Business Detail Modal */}
      {selectedUser && (
        <AdminBusinessDetailModal
          user={selectedUser}
          events={events}
          feedbackList={feedbackList}
          onClose={() => setSelectedUser(null)}
          onUpdateStatus={handleUpdateUserStatus}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
