/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BusinessState,
  BusinessEvent,
  CalculationExplanation,
  FollowUpQuestion,
  UnitRelationship,
  MemoryUpdateItem,
  ChatMessage,
  ReportPeriod,
  BusinessPulseItem,
  BusinessProfile,
  NavigationTab,
  ProductMemory,
} from './types';
import { initialSeedState, createEmptyBusinessState, isSampleSeedData } from './data/seedData';
import { Header } from './components/Header';
import { NaturalInputBar } from './components/NaturalInputBar';
import { DailySummaryCard } from './components/DailySummaryCard';
import { BusinessCalendar } from './components/BusinessCalendar';
import { BusinessTimeline } from './components/BusinessTimeline';
import { BusinessMemoryView } from './components/BusinessMemoryView';
import { BusinessPulseCard } from './components/BusinessPulseCard';
import { BusinessProfileView } from './components/BusinessProfileView';
import { ConversationalQuestions } from './components/ConversationalQuestions';
import { ExplainCalculationModal } from './components/ExplainCalculationModal';
import { OnboardingModal } from './components/OnboardingModal';
import { BusinessReportModal } from './components/BusinessReportModal';
import { InsightActionModal } from './components/InsightActionModal';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './components/AuthPage';
import { BetaAccessGate } from './components/BetaAccessGate';
import { BetaFeedbackModal } from './components/BetaFeedbackModal';
import { AdminPortalPage } from './components/AdminPortalPage';
import { BetaOnboardingModal } from './components/BetaOnboardingModal';
import { FloatingFeedbackBalloon } from './components/FloatingFeedbackBalloon';
import { KarraLogo } from './components/KarraLogo';
import { useAuth } from './contexts/AuthContext';
import { updateUserProfileDoc } from './lib/firebase';
import { calculateDailySummary, explainDailyCalculation, explainEventCalculation, reconcileCustomerBalances, formatNaira } from './engine/calculations';
import { generateObservantInsights } from './engine/observantInsights';
import { processNaturalInput } from './engine/nlpInterpreter';
import { getTodayDateStr, getYesterdayDateStr } from './utils/dateUtils';
import { Sparkles } from 'lucide-react';
import { ensureEventHeadlineAndSummary, ensureMemoryHeadlineAndSummary } from './engine/eventSummarizer';

const getStorageKey = (uid?: string | null): string => {
  if (!uid) return 'kudios_guest_state';
  return `kudios_user_state_${uid}`;
};

export default function App() {
  const {
    user,
    userProfile,
    isLoading: isAuthLoading,
    isBetaAuthorized,
    isAdmin,
    fetchLedgerFromCloud,
    syncLedgerToCloud,
  } = useAuth();

  // Reference to prevent duplicate cloud ledger loads for the same active user UID
  const activeLoadedUidRef = React.useRef<string | null>(null);
  const [isLedgerLoaded, setIsLedgerLoaded] = useState(false);
  const isSettingStateFromLoadRef = React.useRef(false);
  const isDirtyRef = React.useRef(false);

  // Initialize state cleanly for the current user or guest
  const [state, setState] = useState<BusinessState>(() => {
    return createEmptyBusinessState('My Business');
  });

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateStr());
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [activeExplanation, setActiveExplanation] = useState<CalculationExplanation | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'info' | 'success' | 'warning' } | null>(null);

  // Check if navigating to the separate Admin page (/admin or ?admin)
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    try {
      const pathname = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      return (
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        search.includes('admin') ||
        hash.includes('admin')
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleUrlChange = () => {
      try {
        const pathname = window.location.pathname.toLowerCase();
        const search = window.location.search.toLowerCase();
        const hash = window.location.hash.toLowerCase();
        setIsAdminRoute(
          pathname === '/admin' ||
          pathname.startsWith('/admin/') ||
          search.includes('admin') ||
          hash.includes('admin')
        );
      } catch {}
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleExitAdmin = useCallback(() => {
    setIsAdminRoute(false);
    try {
      const url = new URL(window.location.href);
      url.pathname = '/';
      url.searchParams.delete('admin');
      url.searchParams.delete('tab');
      url.searchParams.delete('page');
      window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
    } catch {}
    setActiveTab('dashboard');
  }, []);

  // Business reporting & insight action state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('weekly');
  const [activeInsightAction, setActiveInsightAction] = useState<BusinessPulseItem | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<string>('ALL');

  // Beta system modals
  const [isBetaFeedbackOpen, setIsBetaFeedbackOpen] = useState(false);
  const [isBetaOnboardingOpen, setIsBetaOnboardingOpen] = useState(false);

  // Track mutations made by the user while the ledger is loaded
  useEffect(() => {
    if (isSettingStateFromLoadRef.current) {
      isSettingStateFromLoadRef.current = false;
      isDirtyRef.current = false;
      return;
    }
    if (isLedgerLoaded && activeLoadedUidRef.current === user?.uid) {
      isDirtyRef.current = true;
    }
  }, [state, isLedgerLoaded, user?.uid]);

  // Automatically trigger beta onboarding once upon first entry
  useEffect(() => {
    if (user && isBetaAuthorized) {
      const onboardedKey = `karra_beta_onboarded_${user.uid}`;
      try {
        const hasOnboarded = localStorage.getItem(onboardedKey);
        if (!hasOnboarded) {
          setIsBetaOnboardingOpen(true);
          localStorage.setItem(onboardedKey, 'true');
        }
      } catch {}
    }
  }, [user, isBetaAuthorized]);

  // Route to separate admin page if requested by founder login or session flag
  useEffect(() => {
    try {
      const target = sessionStorage.getItem('karra_target_tab');
      if (target === 'admin' && (isAdmin || (user?.email || '').toLowerCase() === 'olamidefelix54@gmail.com')) {
        sessionStorage.removeItem('karra_target_tab');
        setIsAdminRoute(true);
      }
    } catch {}
  }, [isAdmin, user?.email]);

  // Light / Dark mode state persisted to localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('kudios_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('kudios_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Strictly isolate data per authenticated merchant user.
  // When a user signs in, load ONLY that specific account's data.
  // New sign-ups get a pristine, empty dashboard and empty data.
  useEffect(() => {
    let isMounted = true;

    if (!user) {
      activeLoadedUidRef.current = null;
      setIsLedgerLoaded(false);
      isSettingStateFromLoadRef.current = true;
      setState(createEmptyBusinessState('My Business'));
      return;
    }

    if (activeLoadedUidRef.current === user.uid) {
      return;
    }

    const currentUid = user.uid;
    const userStorageKey = getStorageKey(currentUid);
    const bName = userProfile?.businessName || (user.displayName ? `${user.displayName}'s Store` : 'My Business');
    const oName = userProfile?.displayName || user.displayName || '';
    const email = user.email || userProfile?.email || '';

    if (user.isAnonymous) {
      // Guest demo session: check isolated guest key
      activeLoadedUidRef.current = currentUid;
      try {
        const saved = localStorage.getItem(userStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          isSettingStateFromLoadRef.current = true;
          setState(parsed);
          setIsLedgerLoaded(true);
          return;
        }
      } catch (err) {
        console.warn('Could not read guest state', err);
      }
      isSettingStateFromLoadRef.current = true;
      setState(createEmptyBusinessState('Guest Store'));
      setIsLedgerLoaded(true);
      return;
    }

    // Authenticated cloud merchant user:
    setIsLedgerLoaded(false);

    // Fast-path: Check if there is isolated local state saved specifically for this user's UID
    // and load it immediately so UI is responsive while cloud fetch completes
    let hasLocalCache = false;
    try {
      const savedLocal = localStorage.getItem(userStorageKey);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        if (!isSampleSeedData(parsed)) {
          hasLocalCache = true;
          isSettingStateFromLoadRef.current = true;
          setState(parsed);
        }
      }
    } catch {}

    fetchLedgerFromCloud().then(async (result) => {
      if (!isMounted) return;

      if (result.status === 'found' && result.data && !isSampleSeedData(result.data)) {
        const cloudData = result.data;
        const sanitizedEvents = (cloudData.events || []).map((e) =>
          ensureEventHeadlineAndSummary(e)
        );

        const loadedState: BusinessState = {
          ...createEmptyBusinessState(bName, oName, email),
          ...cloudData,
          events: sanitizedEvents,
          businessName: cloudData.businessName || userProfile?.businessName || bName,
          ownerName: cloudData.ownerName || userProfile?.displayName || oName,
          currency: cloudData.currency || 'NGN',
          products: cloudData.products || [],
          customers: cloudData.customers || [],
          suppliers: cloudData.suppliers || [],
          unitRelationships: cloudData.unitRelationships || [],
          rules: cloudData.rules || cloudData.businessRules || [],
          businessRules: cloudData.businessRules || cloudData.rules || [],
          chatHistory: cloudData.chatHistory || [],
          pulseInsights: cloudData.pulseInsights || [],
          pendingFollowUp: cloudData.pendingFollowUp || null,
          profile: cloudData.profile ? {
            ...createEmptyBusinessState(bName, oName, email).profile!,
            ...cloudData.profile,
            email: cloudData.profile.email || email,
            businessName: cloudData.profile.businessName || cloudData.businessName || bName,
            ownerName: cloudData.profile.ownerName || cloudData.ownerName || oName,
          } : {
            ...createEmptyBusinessState(bName, oName, email).profile!,
            businessName: bName,
            ownerName: oName,
            email,
          },
        };

        activeLoadedUidRef.current = currentUid;
        isSettingStateFromLoadRef.current = true;
        setState(loadedState);
        setIsLedgerLoaded(true);
        try {
          localStorage.setItem(userStorageKey, JSON.stringify(loadedState));
        } catch {}
        showToast(`Welcome back! Data loaded for ${loadedState.businessName}.`, 'success');
        return;
      }

      if (result.status === 'not_found') {
        // Cloud document does not exist yet for this account.
        // Check if there was cached local state for this specific user
        if (hasLocalCache) {
          try {
            const savedLocal = localStorage.getItem(userStorageKey);
            if (savedLocal) {
              const parsed = JSON.parse(savedLocal);
              if (!isSampleSeedData(parsed)) {
                activeLoadedUidRef.current = currentUid;
                setIsLedgerLoaded(true);
                // Initialize the cloud document once with the user's data
                await syncLedgerToCloud(parsed);
                return;
              }
            }
          } catch {}
        }

        // Truly brand new user account: initialize a pristine empty business state once
        const freshEmptyState = createEmptyBusinessState(bName, oName, email);
        activeLoadedUidRef.current = currentUid;
        isSettingStateFromLoadRef.current = true;
        setState(freshEmptyState);
        setIsLedgerLoaded(true);
        try {
          localStorage.setItem(userStorageKey, JSON.stringify(freshEmptyState));
        } catch {}
        await syncLedgerToCloud(freshEmptyState);
        return;
      }

      // If status === 'error' (network error, transient issue):
      // CRITICAL: NEVER overwrite user's data or create empty business on read error!
      if (hasLocalCache) {
        activeLoadedUidRef.current = currentUid;
        setIsLedgerLoaded(true);
        showToast('Connected offline. Working with locally stored business ledger.', 'info');
      } else {
        // Fallback to empty in memory but DO NOT SYNC to cloud
        activeLoadedUidRef.current = currentUid;
        isSettingStateFromLoadRef.current = true;
        setState(createEmptyBusinessState(bName, oName, email));
        setIsLedgerLoaded(true);
        showToast('Could not reach cloud database. Retrying...', 'warning');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.uid, userProfile?.businessName, fetchLedgerFromCloud, syncLedgerToCloud]);

  // Sync state strictly to isolated user storage & debounced to user's Firestore cloud
  // CRITICAL: Only sync when ledger is loaded for this user and has user-driven changes (isDirty)
  useEffect(() => {
    if (!user) return;

    if (user.isAnonymous) {
      const userStorageKey = getStorageKey(user.uid);
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(state));
      } catch (e) {
        console.warn('Could not write to localStorage', e);
      }
      return;
    }

    // Must be fully loaded for this specific user and have actual mutations
    if (!isLedgerLoaded || activeLoadedUidRef.current !== user.uid) {
      return;
    }

    if (!isDirtyRef.current) {
      return;
    }

    const userStorageKey = getStorageKey(user.uid);
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not write to localStorage', e);
    }

    const timer = setTimeout(() => {
      syncLedgerToCloud(state).then((success) => {
        if (success) {
          isDirtyRef.current = false;
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [state, user?.uid, isLedgerLoaded, syncLedgerToCloud]);

  const showToast = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Clear all data to start fresh with a completely empty dashboard
  const handleClearLedger = () => {
    if (
      window.confirm(
        'Clear all recorded transactions, customer records, and inventory to start fresh with a completely empty dashboard?'
      )
    ) {
      const bName =
        userProfile?.businessName ||
        (user?.displayName ? `${user.displayName}'s Store` : state.businessName || 'My Business');
      const oName = userProfile?.displayName || user?.displayName || state.ownerName || '';
      const email = user?.email || userProfile?.email || state.profile?.email || '';
      const emptyState = createEmptyBusinessState(bName, oName, email);
      setState(emptyState);
      setSelectedDate(getTodayDateStr());
      if (user) {
        const userStorageKey = getStorageKey(user.uid);
        try {
          localStorage.setItem(userStorageKey, JSON.stringify(emptyState));
        } catch {}
        if (!user.isAnonymous) {
          syncLedgerToCloud(emptyState);
        }
      }
      showToast('Ledger cleared. Your store dashboard is now completely fresh and empty.', 'success');
    }
  };

  // Optional reset handler to load sample Nigerian merchant dataset for demonstration
  const handleResetDemo = () => {
    if (
      window.confirm(
        'Load the sample Nigerian merchant dataset (sample goods, sales, and customer debts for demonstration)?'
      )
    ) {
      const demoState: BusinessState = {
        ...initialSeedState,
        events: initialSeedState.events.map(ensureEventHeadlineAndSummary),
        businessName: userProfile?.businessName || initialSeedState.businessName,
      };
      setState(demoState);
      setSelectedDate(getTodayDateStr());
      if (user) {
        const userStorageKey = getStorageKey(user.uid);
        try {
          localStorage.setItem(userStorageKey, JSON.stringify(demoState));
        } catch {}
        if (!user.isAnonymous) {
          syncLedgerToCloud(demoState);
        }
      }
      showToast('Loaded sample store dataset.', 'info');
    }
  };

  // Compute daily summary for currently selected date
  const selectedDaySummary = useMemo(() => {
    return calculateDailySummary(state.events, selectedDate);
  }, [state.events, selectedDate]);

  // Dynamically compute intelligent Observant Insights strictly grounded in real recorded state
  const observantInsights = useMemo(() => {
    return generateObservantInsights(state);
  }, [state]);

  // Main natural language event processing loop
  const handleNaturalInput = async (inputText: string) => {
    setIsProcessingInput(true);
    try {
      const result = await processNaturalInput(inputText, state);

      if (result.isQuestion) {
        // If user asked a question, route to Questions tab or show toast with direct answer
        showToast(result.questionAnswer || result.plainResponseText, 'info');
        setActiveTab('questions');
      } else if (result.followUpRequired) {
        // Intelligent Follow-up question triggered (e.g. unknown product cost)
        setState((prev) => ({
          ...prev,
          pendingFollowUp: result.followUpRequired || null,
        }));
        showToast(result.followUpRequired.prompt, 'info');
      } else {
        // Event successfully parsed!
        let updatedEvents = [...state.events];
        let updatedProducts = [...state.products];
        let updatedCustomers = [...state.customers];
        let updatedSuppliers = [...state.suppliers];
        let updatedUnits = [...state.unitRelationships];

        if (result.targetCalendarDate) {
          setSelectedDate(result.targetCalendarDate);
        }
        if (result.shouldNavigateToCalendar) {
          setActiveTab('calendar');
        }

        if (result.deletedEventId) {
          updatedEvents = updatedEvents.filter((e) => e.id !== result.deletedEventId);
        }

        if (result.correctedEvent) {
          const safeCorrected: BusinessEvent = ensureEventHeadlineAndSummary({
            ...result.correctedEvent,
            id: result.correctedEvent.id || `ev-corr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            isCorrected: false,
          });
          updatedEvents = updatedEvents.filter(
            (e) => e.id !== safeCorrected.id && e.id !== safeCorrected.correctionOfId
          );
          updatedEvents = [safeCorrected, ...updatedEvents];
        }

        const eventsToAdd: BusinessEvent[] = [];
        if (result.createdEvents && result.createdEvents.length > 0) {
          for (const ev of result.createdEvents) {
            eventsToAdd.push(
              ensureEventHeadlineAndSummary({
                ...ev,
                id: ev.id || `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                isCorrected: false,
              })
            );
          }
        } else if (result.createdEvent) {
          eventsToAdd.push(
            ensureEventHeadlineAndSummary({
              ...result.createdEvent,
              id: result.createdEvent.id || `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              isCorrected: false,
            })
          );
        }

        if (eventsToAdd.length > 0) {
          const idsToRemove = new Set(eventsToAdd.map((e) => e.id));
          updatedEvents = updatedEvents.filter((e) => !idsToRemove.has(e.id));
          updatedEvents = [...eventsToAdd, ...updatedEvents];
        }

        // Handle memory updates learned from this turn
        const allMemories = [
          ...(result.memoryUpdate ? [result.memoryUpdate] : []),
          ...(result.memoryUpdates || []),
        ];

        for (const mu of allMemories) {
          if (mu.type === 'EVENT_CORRECTION') {
            const delId = mu.data?.deletedEventId || mu.data?.eventId;
            if (delId) {
              updatedEvents = updatedEvents.filter((ev) => ev.id !== delId);
            }
          } else if (mu.type === 'CALENDAR_UPDATE') {
            if (mu.data?.date) {
              setSelectedDate(mu.data.date);
            }
          } else if (mu.type === 'PRODUCT_COST') {
            const { productName, cost, date, note, normalSellingPrice } = mu.data;
            const existingIdx = updatedProducts.findIndex(
              (p) => p.name.toLowerCase() === productName.toLowerCase()
            );
            if (existingIdx >= 0) {
              const prev = updatedProducts[existingIdx];
              updatedProducts[existingIdx] = {
                ...prev,
                previousCost: prev.currentCost,
                currentCost: cost,
                normalSellingPrice: normalSellingPrice || prev.normalSellingPrice,
                costHistory: [
                  ...prev.costHistory,
                  {
                    date: date || getTodayDateStr(),
                    cost,
                    reason: note || 'Updated via natural language statement',
                  },
                ],
              };
            } else {
              updatedProducts.push({
                id: `prod-${Date.now()}`,
                name: productName.charAt(0).toUpperCase() + productName.slice(1),
                unit: 'piece',
                currentCost: cost,
                normalSellingPrice: normalSellingPrice || (cost > 0 ? Math.round(cost * 1.3) : 0),
                costHistory: [
                  {
                    date: date || getTodayDateStr(),
                    cost,
                    reason: note || 'Learned from merchant input',
                  },
                ],
                priceHistory: [],
              });
            }
          } else if (mu.type === 'SUPPLIER_INFO') {
            const { supplierName, note } = mu.data || {};
            if (supplierName) {
              const sIdx = updatedSuppliers.findIndex(
                (s) => s.name.toLowerCase() === supplierName.toLowerCase()
              );
              if (sIdx >= 0) {
                const s = updatedSuppliers[sIdx];
                updatedSuppliers[sIdx] = {
                  ...s,
                  notes: note ? `${s.notes ? s.notes + '; ' : ''}${note}` : s.notes,
                };
              } else {
                updatedSuppliers.push({
                  id: `sup-${Date.now()}`,
                  name: supplierName,
                  itemsSupplied: [],
                  currentPrices: {},
                  notes: note || 'Recorded from stock purchase',
                  history: [],
                });
              }
            }
          } else if (mu.type === 'CUSTOMER_DEBT') {
            const { customerName, balanceAdded } = mu.data;
            const cIdx = updatedCustomers.findIndex(
              (c) => c.name.toLowerCase() === customerName.toLowerCase()
            );
            if (cIdx >= 0) {
              const c = updatedCustomers[cIdx];
              updatedCustomers[cIdx] = {
                ...c,
                outstandingBalance: c.outstandingBalance + balanceAdded,
                totalPurchased: c.totalPurchased + balanceAdded,
              };
            } else {
              updatedCustomers.push({
                id: `cust-${Date.now()}`,
                name: customerName,
                outstandingBalance: balanceAdded,
                totalPurchased: balanceAdded,
                totalPaid: 0,
                lastActivityDate: getTodayDateStr(),
                paymentReliability: 'Medium',
                history: [],
                notes: 'Created from customer debt statement',
              });
            }
          } else if (mu.type === 'CUSTOMER_PAYMENT') {
            const { customerName, amountPaid } = mu.data;
            const cIdx = updatedCustomers.findIndex(
              (c) => c.name.toLowerCase() === customerName.toLowerCase()
            );
            if (cIdx >= 0) {
              const c = updatedCustomers[cIdx];
              updatedCustomers[cIdx] = {
                ...c,
                outstandingBalance: Math.max(0, c.outstandingBalance - amountPaid),
                totalPaid: c.totalPaid + amountPaid,
              };
            }
          } else if (mu.type === 'UNIT_CONVERSION') {
            const { parentUnit, childUnit, productName, ratio, parentCost } = mu.data;
            const estCost = parentCost ? parentCost / ratio : 0;
            updatedUnits.push({
              id: `rel-${Date.now()}`,
              parentUnit,
              childUnit,
              productName: productName || 'General',
              ratio,
              yieldCount: ratio,
              parentCost: parentCost || 0,
              estimatedCostPerChild: estCost,
              isEstimate: true,
              source: 'Learned from natural language',
              updatedAt: getTodayDateStr(),
            });
          }
        }

        // Ensure deleted logs are purged across all pages and balances reflect current events
        updatedEvents = updatedEvents.filter((ev) => !ev.isCorrected);
        updatedCustomers = reconcileCustomerBalances(updatedEvents, updatedCustomers);

        setState((prev) => ({
          ...prev,
          events: updatedEvents,
          products: updatedProducts,
          customers: updatedCustomers,
          suppliers: updatedSuppliers,
          unitRelationships: updatedUnits,
          pendingFollowUp: null, // clear pending follow-up if resolved
        }));

        showToast(result.plainResponseText, 'success');
      }
    } catch (err: any) {
      console.error('Error processing natural input:', err);
      showToast('Sorry, could not understand that event. Please try again.', 'info');
    } finally {
      setIsProcessingInput(false);
    }
  };

  // Inspect transparent calculation for daily summary
  const handleExplainDaily = (dateStr: string) => {
    const explanation = explainDailyCalculation(state.events, dateStr);
    setActiveExplanation(explanation);
  };

  // Inspect transparent calculation for individual event
  const handleExplainEvent = (event: BusinessEvent) => {
    const explanation = explainEventCalculation(event);
    setActiveExplanation(explanation);
  };

  // Event correction: Permanently deletes previous entry and relogs updated details across all pages
  const handleCorrectEvent = (
    eventId: string,
    correctedRevenue: number,
    correctedQuantity: number,
    note: string
  ) => {
    setState((prev) => {
      const targetEvent = prev.events.find((e) => e.id === eventId);
      if (!targetEvent) return prev;

      const oldRevenue = targetEvent.totalRevenue || 0;
      const costPerUnit = (targetEvent.totalCostAtTime || 0) / (targetEvent.quantity || 1);
      const newCost = costPerUnit * correctedQuantity;
      const newGross = correctedRevenue - newCost;

      const auditEntry = {
        timestamp: new Date().toISOString(),
        action: 'CORRECTION',
        note: `${note} (Revenue: ₦${oldRevenue.toLocaleString()} -> ₦${correctedRevenue.toLocaleString()})`,
        performedBy: 'Owner',
      };

      const reloggedEvent: BusinessEvent = {
        ...targetEvent,
        id: `ev-relog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        totalRevenue: correctedRevenue,
        cashReceived: (targetEvent.receivableAdded && targetEvent.receivableAdded > 0) ? targetEvent.cashReceived : correctedRevenue,
        quantity: correctedQuantity,
        totalCostAtTime: newCost,
        grossProfit: newGross,
        isCorrected: false, // Active relogged details
        correctionOfId: eventId,
        auditTrail: [...(targetEvent.auditTrail || []), auditEntry],
      };

      // Permanently remove previous event and relog new details
      const updatedEvents = [
        reloggedEvent,
        ...prev.events.filter((ev) => ev.id !== eventId && !ev.isCorrected),
      ];
      const updatedCustomers = reconcileCustomerBalances(updatedEvents, prev.customers);

      return {
        ...prev,
        events: updatedEvents,
        customers: updatedCustomers,
      };
    });

    showToast('Previous entry deleted permanently and new details relogged into ledger and calendar.', 'success');
  };

  // Permanently delete an event across all pages
  const handleDeleteEvent = (eventId: string) => {
    setState((prev) => {
      const updatedEvents = prev.events.filter((e) => e.id !== eventId && !e.isCorrected);
      const updatedCustomers = reconcileCustomerBalances(updatedEvents, prev.customers);
      return {
        ...prev,
        events: updatedEvents,
        customers: updatedCustomers,
      };
    });
    showToast('Entry permanently deleted from ledger, calendar, and all pages.', 'info');
  };

  // Product cost update from Business Memory
  const handleUpdateProductCost = (productName: string, newCost: number) => {
    setState((prev) => {
      const updatedProds = prev.products.map((p) => {
        if (p.name.toLowerCase() === productName.toLowerCase()) {
          return {
            ...p,
            previousCost: p.currentCost,
            currentCost: newCost,
            costHistory: [
              ...p.costHistory,
              {
                date: getTodayDateStr(),
                cost: newCost,
                reason: 'Manually updated in Business Memory',
              },
            ],
          };
        }
        return p;
      });
      return {
        ...prev,
        products: updatedProds,
      };
    });
    showToast(`Updated current cost for ${productName} to ₦${newCost.toLocaleString()}. Historical sales remain locked.`, 'success');
  };

  // Add new product or good into Business Memory
  const handleAddProductMemory = (newProduct: ProductMemory) => {
    setState((prev) => {
      const existingIdx = prev.products.findIndex(
        (p) => p.name.toLowerCase() === newProduct.name.toLowerCase()
      );
      let updatedProds = [...prev.products];
      if (existingIdx >= 0) {
        updatedProds[existingIdx] = {
          ...updatedProds[existingIdx],
          ...newProduct,
        };
      } else {
        updatedProds.unshift(newProduct);
      }
      return {
        ...prev,
        products: updatedProds,
      };
    });
    showToast(`Saved ${newProduct.name} to memory (${formatNaira(newProduct.normalSellingPrice)} selling price).`, 'success');
  };

  // Add unit relationship from Business Memory
  const handleAddUnitRelationship = (rel: UnitRelationship) => {
    setState((prev) => ({
      ...prev,
      unitRelationships: [...prev.unitRelationships, rel],
    }));
    showToast(`Saved unit conversion: 1 ${rel.parentUnit} = ${rel.yieldCount} ${rel.childUnit}s.`, 'success');
  };

  // Customer balance update
  const handleUpdateCustomerBalance = (customerName: string, newBalance: number) => {
    setState((prev) => {
      const updatedCusts = prev.customers.map((c) => {
        if (c.name.toLowerCase() === customerName.toLowerCase()) {
          return { ...c, outstandingBalance: newBalance };
        }
        return c;
      });
      return { ...prev, customers: updatedCusts };
    });
  };

  // Settle customer debt: Automatically creates a DEBT_PAYMENT ledger event,
  // updates cash collections, reconciles customer balances (clearing outstandingBalance to 0),
  // which automatically removes the customer from the Debt List while preserving all transaction memory.
  const handleSettleCustomerDebt = (customerName: string, amount: number) => {
    const todayStr = getTodayDateStr();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Create the debt payment business event conforming to BusinessEvent interface
    const paymentEvent: BusinessEvent = ensureEventHeadlineAndSummary({
      id: `ev-settle-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      date: todayStr,
      timeStr: timeNow,
      type: 'DEBT_PAYMENT',
      rawUserText: `Received ₦${amount.toLocaleString()} debt payment from ${customerName}`,
      systemResponseText: `Settled outstanding debt of ₦${amount.toLocaleString()} from ${customerName}. Balance cleared to ₦0.`,
      customerName: customerName,
      cashReceived: amount,
      grossProfit: 0,
      isCorrected: false,
    });

    setState((prev) => {
      // 2. Prepend payment event to business ledger
      const updatedEvents = [paymentEvent, ...prev.events];

      // 3. Update customer record: retain history, update lifetime paid, and set outstanding balance to 0
      let updatedCustomers = prev.customers.map((c) => {
        if (c.name.toLowerCase() === customerName.toLowerCase()) {
          const newTotalPaid = (c.totalPaid || 0) + amount;
          const newHistory = [
            ...(c.history || []),
            {
              eventId: paymentEvent.id,
              date: todayStr,
              type: 'PAYMENT' as const,
              amount: amount,
              description: `Settled outstanding debt of ₦${amount.toLocaleString()} in full`,
            },
          ];
          return {
            ...c,
            outstandingBalance: 0,
            totalPaid: newTotalPaid,
            lastActivityDate: todayStr,
            paymentReliability: 'High' as const,
            history: newHistory,
            notes: c.notes ? `${c.notes} • Settled on ${todayStr}` : `Settled debt on ${todayStr}`,
          };
        }
        return c;
      });

      // 4. Reconcile customer balances using the calculation engine
      updatedCustomers = reconcileCustomerBalances(updatedEvents, updatedCustomers);

      return {
        ...prev,
        events: updatedEvents,
        customers: updatedCustomers,
      };
    });

    showToast(
      `Debt of ₦${amount.toLocaleString()} from ${customerName} settled! Automatically removed from Debt List; memory retained in Customer Memory.`,
      'success'
    );
  };

  // Apply memories extracted from conversational chat flow & persistence
  const handleApplyChatMemories = (
    memories: MemoryUpdateItem[],
    createdEvent?: BusinessEvent,
    correctedEvent?: BusinessEvent,
    calendarDate?: string,
    deletedEventId?: string,
    createdEvents?: BusinessEvent[]
  ) => {
    const targetDate = calendarDate || correctedEvent?.date || (createdEvents && createdEvents[0]?.date) || createdEvent?.date;
    if (targetDate) {
      setSelectedDate(targetDate);
    }

    setState((prev) => {
      let updatedProducts = [...prev.products];
      let updatedCustomers = [...prev.customers];
      let updatedSuppliers = [...prev.suppliers];
      let updatedRules = [...(prev.businessRules || prev.rules || [])];
      let updatedUnits = [...prev.unitRelationships];
      let updatedEvents = [...prev.events];

      // 1. Permanently delete targeted event if specified
      if (deletedEventId) {
        updatedEvents = updatedEvents.filter((e) => e.id !== deletedEventId);
      }

      // 2. Relog corrected event as active, removing previous original entry
      if (correctedEvent) {
        const safeCorrected: BusinessEvent = ensureEventHeadlineAndSummary({
          ...correctedEvent,
          id: correctedEvent.id || `ev-chat-corr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          isCorrected: false,
        });
        updatedEvents = updatedEvents.filter(
          (e) => e.id !== safeCorrected.id && e.id !== safeCorrected.correctionOfId
        );
        updatedEvents = [safeCorrected, ...updatedEvents];
      }

      // 3. Add newly created event(s) as active
      const eventsToAdd: BusinessEvent[] = [];
      if (createdEvents && createdEvents.length > 0) {
        for (const ev of createdEvents) {
          eventsToAdd.push(
            ensureEventHeadlineAndSummary({
              ...ev,
              id: ev.id || `ev-chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              date: ev.date || getTodayDateStr(),
              timeStr: ev.timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isCorrected: false,
            })
          );
        }
      } else if (createdEvent) {
        eventsToAdd.push(
          ensureEventHeadlineAndSummary({
            ...createdEvent,
            id: createdEvent.id || `ev-chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: createdEvent.date || getTodayDateStr(),
            timeStr: createdEvent.timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isCorrected: false,
          })
        );
      }

      if (eventsToAdd.length > 0) {
        const idsToRemove = new Set(eventsToAdd.map((e) => e.id));
        updatedEvents = updatedEvents.filter((e) => !idsToRemove.has(e.id));
        updatedEvents = [...eventsToAdd, ...updatedEvents];
      }

      for (const m of memories) {
        if (m.type === 'EVENT_CORRECTION') {
          const delId = m.data?.deletedEventId || m.data?.eventId;
          if (delId) {
            updatedEvents = updatedEvents.filter((ev) => ev.id !== delId);
          }
        } else if (m.type === 'CALENDAR_UPDATE') {
          if (m.data?.date) {
            setSelectedDate(m.data.date);
          }
        } else if (m.type === 'CUSTOMER_DEBT') {
          const custName = m.targetName || m.data?.customerName;
          const amt = m.data?.amount ?? m.data?.balance;
          if (custName && amt !== undefined) {
            const idx = updatedCustomers.findIndex(
              (c) => c.name.toLowerCase() === custName.toLowerCase()
            );
            if (idx >= 0) {
              updatedCustomers[idx] = {
                ...updatedCustomers[idx],
                outstandingBalance: amt,
              };
            } else {
              updatedCustomers.push({
                id: `cust-${Date.now()}`,
                name: custName,
                outstandingBalance: amt,
                totalPurchased: amt,
                totalPaid: 0,
                lastActivityDate: getTodayDateStr(),
                paymentReliability: 'Medium',
                history: [],
                notes: 'Created from customer debt update',
              });
            }
          }
        } else if (m.type === 'CUSTOMER_PAYMENT') {
          const custName = m.targetName || m.data?.customerName;
          const amt = m.data?.amountPaid ?? m.data?.amount;
          if (custName && amt !== undefined) {
            const idx = updatedCustomers.findIndex(
              (c) => c.name.toLowerCase() === custName.toLowerCase()
            );
            if (idx >= 0) {
              const c = updatedCustomers[idx];
              updatedCustomers[idx] = {
                ...c,
                outstandingBalance: Math.max(0, c.outstandingBalance - amt),
                totalPaid: (c.totalPaid || 0) + amt,
              };
            }
          }
        } else if (m.type === 'CUSTOMER_NOTE') {
          const custName = m.targetName || m.data?.customerName;
          const note = m.data?.note || m.summary;
          const idx = updatedCustomers.findIndex(
            (c) => c.name.toLowerCase() === custName?.toLowerCase()
          );
          if (idx >= 0) {
            const c = updatedCustomers[idx];
            updatedCustomers[idx] = {
              ...c,
              notes: c.notes ? `${c.notes} | ${note}` : note,
            };
          } else if (custName) {
            updatedCustomers.push({
              id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: custName,
              totalPurchased: 0,
              totalPaid: 0,
              outstandingBalance: 0,
              lastActivityDate: getTodayDateStr(),
              paymentReliability: 'Medium',
              notes: note,
              history: [],
            });
          }
        } else if (m.type === 'CUSTOMER_PHONE') {
          const custName = m.targetName || m.data?.customerName;
          const phone = m.data?.phone;
          const idx = updatedCustomers.findIndex(
            (c) => c.name.toLowerCase() === custName?.toLowerCase()
          );
          if (idx >= 0) {
            updatedCustomers[idx] = {
              ...updatedCustomers[idx],
              phone,
            };
          } else if (custName) {
            updatedCustomers.push({
              id: `cust-${Date.now()}`,
              name: custName,
              phone,
              totalPurchased: 0,
              totalPaid: 0,
              outstandingBalance: 0,
              lastActivityDate: getTodayDateStr(),
              paymentReliability: 'Medium',
              history: [],
            });
          }
        } else if (m.type === 'PRODUCT_COST') {
          const prodName = m.targetName || m.data?.productName;
          const cost = m.data?.cost;
          if (prodName && cost) {
            const idx = updatedProducts.findIndex(
              (p) => p.name.toLowerCase() === prodName.toLowerCase()
            );
            if (idx >= 0) {
              const prevP = updatedProducts[idx];
              updatedProducts[idx] = {
                ...prevP,
                previousCost: prevP.currentCost,
                currentCost: cost,
                costHistory: [
                  ...prevP.costHistory,
                  {
                    date: getTodayDateStr(),
                    cost,
                    reason: 'Updated from chat conversation memory',
                  },
                ],
              };
            }
          }
        } else if (m.type === 'PRODUCT_PRICE') {
          const prodName = m.targetName || m.data?.productName;
          const price = m.data?.price;
          if (prodName && price) {
            const idx = updatedProducts.findIndex(
              (p) => p.name.toLowerCase() === prodName.toLowerCase()
            );
            if (idx >= 0) {
              updatedProducts[idx] = {
                ...updatedProducts[idx],
                normalSellingPrice: price,
              };
            }
          }
        } else if (m.type === 'BUSINESS_RULE') {
          const ruleText = m.data?.rule || m.summary;
          if (ruleText) {
            const memItem = ensureMemoryHeadlineAndSummary(m);
            updatedRules.push({
              id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              description: ruleText,
              headline: memItem.headline,
              summary: memItem.summary,
              category: m.data?.category || 'GENERAL',
              active: true,
              createdAt: getTodayDateStr(),
            });
          }
        } else if (m.type === 'SUPPLIER_INFO') {
          const supName = m.targetName || m.data?.supplierName;
          if (supName) {
            const idx = updatedSuppliers.findIndex(
              (s) => s.name.toLowerCase() === supName.toLowerCase()
            );
            if (idx >= 0) {
              updatedSuppliers[idx] = {
                ...updatedSuppliers[idx],
                phone: m.data?.phone || updatedSuppliers[idx].phone,
                location: m.data?.location || updatedSuppliers[idx].location,
                notes: m.data?.note || updatedSuppliers[idx].notes,
              };
            }
          }
        }
      }

      // Ensure deleted logs are purged across all pages and customer balances reflect active events
      updatedEvents = updatedEvents.filter((ev) => !ev.isCorrected);
      updatedCustomers = reconcileCustomerBalances(updatedEvents, updatedCustomers);

      return {
        ...prev,
        products: updatedProducts,
        customers: updatedCustomers,
        suppliers: updatedSuppliers,
        rules: updatedRules,
        businessRules: updatedRules,
        unitRelationships: updatedUnits,
        events: updatedEvents,
      };
    });
    showToast('Updated business records and memory.', 'success');
  };

  const handleUpdateChatHistory = (messages: ChatMessage[]) => {
    setState((prev) => ({
      ...prev,
      chatHistory: messages,
    }));
  };

  const handleUpdateProfile = (newProfile: BusinessProfile) => {
    setState((prev) => {
      const updated = {
        ...prev,
        businessName: newProfile.businessName,
        ownerName: newProfile.ownerName,
        profile: newProfile,
      };
      if (user && !user.isAnonymous) {
        syncLedgerToCloud(updated);
        updateUserProfileDoc(user.uid, {
          businessName: newProfile.businessName,
          displayName: newProfile.ownerName,
        }).catch((err) => console.warn('Could not update Firestore user document:', err));
      }
      return updated;
    });
  };

  // Open high-resolution, printable business financial reports
  const handleOpenReport = (period: ReportPeriod = 'weekly') => {
    setReportPeriod(period);
    setIsReportModalOpen(true);
  };

  // Handle "Act" button click on Observant Insight items
  const handleSelectInsightAction = (actionKey: string, item?: BusinessPulseItem) => {
    const pulseItem = item || observantInsights.find((p) => p.id === actionKey) || state.pulseInsights?.find((p) => p.id === actionKey);
    if (!pulseItem) {
      showToast('Observing patterns...', 'info');
      return;
    }

    if (pulseItem.actionType === 'WEEKLY_REPORT') {
      handleOpenReport('weekly');
      return;
    }

    // Open rich contextual action resolution modal
    setActiveInsightAction(pulseItem);
  };

  // Check if separate admin page is requested via URL (/admin or ?admin)
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
        <AdminPortalPage
          onShowToast={showToast}
          onExitAdmin={handleExitAdmin}
          theme={theme}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 dark:bg-[#161F2E] text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700/80 dark:border-slate-700 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-400'
                  : toastMessage.type === 'warning'
                  ? 'bg-amber-400'
                  : 'bg-sky-400'
              }`}
            />
            <p className="text-xs sm:text-sm font-medium leading-snug">
              {toastMessage.text}
            </p>
          </div>
        )}
      </div>
    );
  }

  // 1. Session verification or ledger restoration loading state
  if (isAuthLoading || (user && !user.isAnonymous && !isLedgerLoaded && activeLoadedUidRef.current !== user.uid)) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-[#0B111E] flex flex-col items-center justify-center p-4 selection:bg-emerald-100 dark:selection:bg-emerald-950">
        <div className="flex flex-col items-center max-w-sm text-center animate-in fade-in duration-300">
          <div className="flex items-center space-x-3.5 mb-2">
            <KarraLogo size="lg" className="shadow-lg animate-pulse" />
            <h1 className="font-extrabold text-3xl sm:text-4xl tracking-tight text-slate-900 dark:text-white">
              Karra
            </h1>
          </div>
          <p className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight">
            Your Business, Understood
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Gate: Client must sign in or register before accessing the site
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E]">
        <AuthPage
          onShowToast={showToast}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Floating Feedback Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 dark:bg-[#161F2E] text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700/80 dark:border-slate-700 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-400'
                  : toastMessage.type === 'warning'
                  ? 'bg-amber-400'
                  : 'bg-sky-400'
              }`}
            />
            <p className="text-xs sm:text-sm font-medium leading-snug">
              {toastMessage.text}
            </p>
          </div>
        )}
      </div>
    );
  }

  // 3. Beta Access Authorization Gate: Authenticated user must have active beta access
  if (user && !isBetaAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E]">
        <BetaAccessGate onShowToast={showToast} />

        {/* Floating Feedback Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 dark:bg-[#161F2E] text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700/80 dark:border-slate-700 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-400'
                  : toastMessage.type === 'warning'
                  ? 'bg-amber-400'
                  : 'bg-sky-400'
              }`}
            />
            <p className="text-xs sm:text-sm font-medium leading-snug">
              {toastMessage.text}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-100 dark:selection:bg-emerald-950 selection:text-emerald-900 dark:selection:text-emerald-300 transition-colors duration-200 ${
        activeTab === 'questions' ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        businessName={state.businessName}
        businessState={state}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onResetDemo={handleResetDemo}
        onClearLedger={handleClearLedger}
        onOpenReports={() => handleOpenReport('weekly')}
        onOpenFeedback={() => setIsBetaFeedbackOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onShowToast={showToast}
      />

      {/* Floating Feedback Toast (Safe distance above mobile dock) */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-50 max-w-md bg-slate-900 dark:bg-[#161F2E] text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700/80 dark:border-slate-700 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-400'
                : toastMessage.type === 'warning'
                ? 'bg-amber-400'
                : 'bg-sky-400'
            }`}
          />
          <p className="text-xs sm:text-sm font-medium leading-snug">
            {toastMessage.text}
          </p>
        </div>
      )}

      {/* Main App Canvas - responsive padding with specialized full-height container on Ask AI page */}
      <main
        className={`flex-1 w-full mx-auto transition-all ${
          activeTab === 'questions'
            ? 'max-w-5xl px-0 sm:px-4 pt-0 sm:pt-2 pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-2 flex flex-col min-h-0 h-full overflow-hidden'
            : 'max-w-6xl px-3.5 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8 space-y-4 sm:space-y-6'
        }`}
      >
        {/* Natural Input Prompt Engine - active exclusively on the Dashboard per user request */}
        {activeTab === 'dashboard' && (
          <NaturalInputBar
            onSendMessage={handleNaturalInput}
            pendingFollowUp={state.pendingFollowUp}
            onCancelFollowUp={() => setState((prev) => ({ ...prev, pendingFollowUp: null }))}
            isProcessing={isProcessingInput}
          />
        )}

        {/* Tab 1: DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
            {/* Today's Daily Business Summary Card */}
            <DailySummaryCard
              summary={selectedDaySummary}
              events={state.events}
              onExplainCalculation={() => handleExplainDaily(selectedDate)}
              onOpenReports={() => handleOpenReport('weekly')}
              onSelectDate={(date) => setSelectedDate(date)}
              selectedDate={selectedDate}
            />

            {/* Observant Business Pulse - Grounded dynamically in actual recorded ledger state */}
            <BusinessPulseCard
              insights={observantInsights}
              onSelectInsightAction={handleSelectInsightAction}
            />

            {/* Quick Preview of Today's Transactions (Distinct Ledger Card) */}
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs dark:shadow-slate-950/40 p-4 sm:p-6 transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {selectedDate === getTodayDateStr() ? "Today's" : selectedDate === getYesterdayDateStr() ? "Yesterday's" : `${selectedDate}`} Activity Ledger ({selectedDaySummary.eventsCount} events)
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline min-h-[36px] flex items-center transition-colors"
                >
                  All Transactions →
                </button>
              </div>

              {state.events.filter((e) => e.date === selectedDate && !e.isCorrected).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  No events logged yet for today. Type or speak a sale above to begin.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {state.events
                    .filter((e) => e.date === selectedDate && !e.isCorrected)
                    .map((ev, idx) => {
                      const displayEv = ensureEventHeadlineAndSummary(ev);
                      return (
                        <div
                          key={ev.id ? `${ev.id}-${idx}` : `ev-${selectedDate}-${idx}`}
                          className="p-3.5 rounded-xl bg-[#FCFDFE] dark:bg-[#151D2C] border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-xs transition-colors space-y-1.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center shrink-0">
                                <Sparkles className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {displayEv.headline}
                              </span>
                              {ev.isPromotion && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 shrink-0">
                                  PROMO
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:justify-end space-x-2 pt-1 sm:pt-0 shrink-0 font-mono font-bold">
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-normal">
                                {ev.timeStr}
                              </span>
                              {ev.type === 'SALE' && ev.totalRevenue !== undefined && (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  +{formatNaira(ev.totalRevenue)}
                                </span>
                              )}
                              {ev.type === 'EXPENSE' && ev.expenseAmount !== undefined && (
                                <span className="text-red-600 dark:text-red-400">
                                  −{formatNaira(ev.expenseAmount)}
                                </span>
                              )}
                              {ev.type === 'CUSTOMER_DEBT' && (
                                <span className="text-amber-700 dark:text-amber-400">
                                  Owed: {formatNaira(ev.receivableAdded || ev.totalRevenue || 0)}
                                </span>
                              )}
                              {ev.type === 'DEBT_PAYMENT' && (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Paid: {formatNaira(ev.cashReceived || ev.totalRevenue || 0)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* AI Generated Executive Summary */}
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                            {displayEv.summary}
                          </p>

                          {/* Footer with original note & action buttons */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 text-[10px] sm:text-[11px]">
                            <span className="text-slate-400 dark:text-slate-500 italic truncate max-w-md">
                              "{ev.rawUserText}"
                            </span>
                            <div className="flex items-center space-x-2 shrink-0">
                              {ev.grossProfit !== undefined && (
                                <span className="text-emerald-700 dark:text-emerald-400 font-mono font-semibold">
                                  Gross: {ev.grossProfit >= 0 ? '+' : ''}{formatNaira(ev.grossProfit)}
                                </span>
                              )}
                              <button
                                onClick={() => handleExplainEvent(ev)}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[26px] cursor-pointer"
                              >
                                Explain math
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(ev.id)}
                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[26px] cursor-pointer"
                                title="Delete this entry permanently"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: CALENDAR VIEW */}
        {activeTab === 'calendar' && (
          <div className="animate-in fade-in duration-200">
            <BusinessCalendar
              events={state.events}
              selectedDate={selectedDate}
              onSelectDate={(date) => setSelectedDate(date)}
              onExplainDate={(date) => handleExplainDaily(date)}
              businessName={state.businessName}
              onShowToast={showToast}
            />
          </div>
        )}

        {/* Tab 3: TRANSACTIONS VIEW */}
        {(activeTab === 'timeline' || (activeTab as string) === 'transactions') && (
          <div className="animate-in fade-in duration-200">
            <BusinessTimeline
              events={state.events}
              selectedDate={selectedDate}
              onSelectDate={(date) => setSelectedDate(date)}
              onExplainEvent={handleExplainEvent}
              onCorrectEvent={handleCorrectEvent}
              onDeleteEvent={handleDeleteEvent}
              initialFilter={timelineFilter}
            />
          </div>
        )}

        {/* Tab 4: BUSINESS MEMORY VIEW */}
        {activeTab === 'memory' && (
          <div className="animate-in fade-in duration-200">
            <BusinessMemoryView
              products={state.products}
              customers={state.customers}
              suppliers={state.suppliers}
              unitRelationships={state.unitRelationships}
              businessRules={state.businessRules || state.rules || []}
              onUpdateProductCost={handleUpdateProductCost}
              onAddProduct={handleAddProductMemory}
              onAddUnitRelationship={handleAddUnitRelationship}
              onUpdateCustomerBalance={handleUpdateCustomerBalance}
              onSettleCustomerDebt={handleSettleCustomerDebt}
              onShowToast={showToast}
              businessName={state.businessName}
            />
          </div>
        )}

        {/* Tab 5: CONVERSATIONAL QUESTIONS */}
        {activeTab === 'questions' && (
          <div className="flex-1 flex flex-col min-h-0 h-full animate-in fade-in duration-200">
            <ConversationalQuestions
              state={state}
              onApplyMemories={handleApplyChatMemories}
              onUpdateChatHistory={handleUpdateChatHistory}
              onNavigateTab={(tab) => setActiveTab(tab as any)}
              onSelectCalendarDate={(date) => {
                setSelectedDate(date);
                setActiveTab('calendar');
              }}
            />
          </div>
        )}

        {/* Tab 6: BUSINESS PROFILE & SETTLEMENT */}
        {activeTab === 'profile' && (
          <div className="animate-in fade-in duration-200">
            <BusinessProfileView
              state={state}
              onUpdateProfile={handleUpdateProfile}
              onClearLedger={handleClearLedger}
              onResetDemo={handleResetDemo}
              onShowToast={showToast}
            />
          </div>
        )}
      </main>

      {/* Transparent Arithmetic Breakdown Modal ("How did you get this number?") */}
      <ExplainCalculationModal
        explanation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
        onSelectEvent={(ev) => {
          setActiveExplanation(null);
          handleExplainEvent(ev);
        }}
      />

      {/* Conversational Soft Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onTeachInitialBusiness={async (text) => {
          await handleNaturalInput(text);
          showToast('Business memory initialized from your description.', 'success');
        }}
      />

      {/* High-Resolution Printable & Downloadable Business Report Modal (Weekly, Monthly, Yearly) */}
      <BusinessReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        state={state}
        initialPeriod={reportPeriod}
        referenceDate={selectedDate}
        onShowToast={showToast}
      />

      {/* Observant Insight Action Resolution Modal */}
      <InsightActionModal
        isOpen={!!activeInsightAction}
        insight={activeInsightAction}
        onClose={() => setActiveInsightAction(null)}
        customers={state.customers}
        events={state.events}
        onOpenReport={(period) => handleOpenReport(period)}
        onNavigateToTab={(tab, filter) => {
          if (filter) {
            setTimelineFilter(filter);
          }
          setActiveTab(tab);
        }}
        onShowToast={showToast}
        onSettleCustomerDebt={handleSettleCustomerDebt}
      />

      {/* Floating Feedback Balloon - Draggable to any angle & opens feedback overlay on click */}
      <FloatingFeedbackBalloon
        onOpenFeedback={() => setIsBetaFeedbackOpen(true)}
        businessName={state.businessName}
      />

      {/* Beta Feedback Modal */}
      <BetaFeedbackModal
        isOpen={isBetaFeedbackOpen}
        onClose={() => setIsBetaFeedbackOpen(false)}
        currentTab={activeTab}
        businessName={state.businessName}
        onShowToast={showToast}
      />

      {/* Beta Onboarding Tour Modal */}
      <BetaOnboardingModal
        isOpen={isBetaOnboardingOpen}
        onClose={() => setIsBetaOnboardingOpen(false)}
        businessName={state.businessName}
      />

      {/* Cloud Authentication & Store Account Management Modal */}
      <AuthModal onShowToast={showToast} />
    </div>
  );
}
