import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  MessageSquare,
  Send,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  BrainCircuit,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  User,
  Package,
  Phone,
  HelpCircle,
  Database,
  X,
  Mic,
  Calendar,
} from 'lucide-react';
import { BusinessState, ChatMessage, MemoryUpdateItem, BusinessEvent } from '../types';
import { answerBusinessQuestionWithMemory } from '../engine/nlpInterpreter';
import { formatNaira } from '../engine/calculations';
import { getTodayDateStr } from '../utils/dateUtils';
import { ensureEventHeadlineAndSummary, ensureMemoryHeadlineAndSummary } from '../engine/eventSummarizer';

interface ConversationalQuestionsProps {
  state: BusinessState;
  onApplyMemories: (
    memories: MemoryUpdateItem[],
    createdEvent?: BusinessEvent,
    correctedEvent?: BusinessEvent,
    calendarDate?: string,
    deletedEventId?: string,
    createdEvents?: BusinessEvent[]
  ) => void;
  onUpdateChatHistory: (messages: ChatMessage[]) => void;
  onNavigateTab?: (tab: string) => void;
  onSelectCalendarDate?: (date: string) => void;
}

export const ConversationalQuestions: React.FC<ConversationalQuestionsProps> = ({
  state,
  onApplyMemories,
  onUpdateChatHistory,
  onNavigateTab,
  onSelectCalendarDate,
}) => {
  const initialThread: ChatMessage[] =
    state.chatHistory && state.chatHistory.length > 0
      ? state.chatHistory
      : [
          {
            id: 'm-initial',
            sender: 'assistant',
            text: "Hello! Ask any question about your store, sales, or customer debts, or tell me about a payment or rule.",
            timestamp: 'Just now',
          },
        ];

  const [messages, setMessages] = useState<ChatMessage[]>(initialThread);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMemoriesVault, setShowMemoriesVault] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Sync with state.chatHistory if updated externally
  useEffect(() => {
    if (state.chatHistory && state.chatHistory.length > 0 && state.chatHistory !== messages) {
      setMessages(state.chatHistory);
    }
  }, [state.chatHistory]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNear = distanceFromBottom < 90;
    isNearBottomRef.current = isNear;
    setShowScrollBottomBtn(distanceFromBottom > 130);
  };

  // Initial mount scroll directly without lag
  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  // Auto-scroll chat to latest message only if user is already near bottom or sent a message
  useEffect(() => {
    if (isNearBottomRef.current) {
      const timer = setTimeout(() => {
        scrollToBottom('smooth');
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [messages, isLoading]);

  const handleVoiceToggle = () => {
    setIsListening((prev) => !prev);
    if (!isListening) {
      setTimeout(() => {
        setIsListening(false);
        setInputQuestion('How much is Musa owing me right now?');
      }, 2000);
    }
  };

  // Derive all distinct memories learned across the active session
  const sessionMemories = messages
    .flatMap((m) => m.memorySaved || [])
    .filter((mem, idx, arr) => arr.findIndex((x) => x.summary === mem.summary) === idx);

  // Helper to determine the active entity currently in conversational focus
  const getActiveEntityContext = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.memorySaved) {
        for (const mem of msg.memorySaved) {
          if (mem.targetName) {
            const cust = state.customers.find((c) => c.name.toLowerCase() === mem.targetName?.toLowerCase());
            return {
              type: 'customer',
              name: mem.targetName,
              details: cust ? `${formatNaira(cust.outstandingBalance || 0)} owing` : 'Customer in memory',
              phone: cust?.phone,
              debt: cust?.outstandingBalance || 0,
            };
          }
        }
      }
      for (const c of state.customers) {
        if (msg.text.toLowerCase().includes(c.name.toLowerCase())) {
          return {
            type: 'customer',
            name: c.name,
            details: `${formatNaira(c.outstandingBalance || 0)} owing`,
            phone: c.phone,
            debt: c.outstandingBalance || 0,
          };
        }
      }
      for (const p of state.products) {
        if (msg.text.toLowerCase().includes(p.name.toLowerCase())) {
          return {
            type: 'product',
            name: p.name,
            details: `Cost ${formatNaira(p.currentCost || 0)}`,
            cost: p.currentCost,
          };
        }
      }
    }
    return null;
  };

  const activeEntity = getActiveEntityContext();

  // Dynamic context-aware chips based on active focus and recent discussion
  const getContextualPills = () => {
    if (activeEntity && activeEntity.type === 'customer') {
      const name = activeEntity.name;
      return [
        { label: `How much does ${name} owe?`, q: `How much does ${name} owe?` },
        { label: `${name} paid 30k`, q: `${name} paid 30,000` },
        { label: `${name} promised to pay Friday`, q: `${name} promised to pay on Friday` },
        { label: `What's ${name}'s phone number?`, q: `What is ${name}'s phone number?` },
        { label: `What did ${name} buy?`, q: `What did ${name} buy?` },
        { label: `Tell me about ${name}`, q: `Tell me everything you remember about ${name}` },
      ];
    }

    if (activeEntity && activeEntity.type === 'product') {
      const pName = activeEntity.name;
      return [
        { label: `Cost of ${pName} is now ₦9,000`, q: `Cost of ${pName} is now 9000` },
        { label: `Which product made most profit?`, q: `Which product makes me the most profit?` },
        { label: `How much did I make today?`, q: `How much did I make today?` },
        { label: `Who owes me money?`, q: `Who owes me money?` },
      ];
    }

    const lastUserOrAiText = messages
      .slice(-3)
      .map((m) => m.text.toLowerCase())
      .join(' ');

    if (lastUserOrAiText.includes('today') || lastUserOrAiText.includes('sales') || lastUserOrAiText.includes('profit')) {
      return [
        { label: "Which product made the most profit?", q: "Which product makes me the most profit?" },
        { label: "What did I spend the most money on?", q: "What did I spend the most money on?" },
        { label: "Can I afford another freezer?", q: "Can I afford to buy another freezer?" },
        { label: "Did my promo make money?", q: "Did my promo make money?" },
      ];
    }

    // Default versatile pills showcasing context and memory
    return [
      { label: "How much did I make today?", q: "How much did I make today?" },
      { label: "Who owes me money?", q: "Who owes me money?" },
      { label: "Chuks owes me 80k", q: "Chuks owes me 80,000" },
      { label: "David will pay on Monday", q: "David promised to pay next Monday" },
      { label: "Rule: Never give credit above 10k", q: "Rule: never give credit above 10,000" },
      { label: "Cost of shoes is now ₦9,000", q: "Cost of shoes is now 9000" },
      { label: "What rules do I have?", q: "What rules do I have?" },
    ];
  };

  const handleAsk = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    onUpdateChatHistory(newMessages);
    setInputQuestion('');
    setIsLoading(true);

    try {
      // Calculate live numbers for rich context grounding
      const todayStr = getTodayDateStr();
      const todayEvents = state.events.filter((e) => e.date === todayStr && !e.isCorrected);
      const todaySales = todayEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.totalRevenue || 0 : 0), 0);
      const todayGross = todayEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.grossProfit || 0 : 0), 0);
      const todayExpenses = todayEvents.reduce((acc, e) => acc + (e.type === 'EXPENSE' ? e.expenseAmount || 0 : 0), 0);
      const totalOwing = state.customers.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/gemini/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question: q,
          chatHistory: newMessages.slice(-10).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
          businessSummary: {
            todaySales,
            todayGrossProfit: todayGross,
            todayExpenses,
            todayNet: todayGross - todayExpenses,
            totalCustomerDebt: totalOwing,
            totalActiveProducts: state.products.length,
            totalCustomers: state.customers.length,
          },
          products: state.products.map((p) => ({
            name: p.name,
            currentCost: p.currentCost,
            normalSellingPrice: p.normalSellingPrice,
            unit: p.unit,
            yieldInfo: p.yieldInfo,
          })),
          customers: state.customers.map((c) => ({
            name: c.name,
            phone: c.phone,
            outstandingBalance: c.outstandingBalance,
            totalPurchased: c.totalPurchased,
            totalPaid: c.totalPaid,
            notes: c.notes,
          })),
          suppliers: state.suppliers.map((s) => ({
            name: s.name,
            phone: s.phone,
            itemsSupplied: s.itemsSupplied,
            currentPrices: s.currentPrices,
            notes: s.notes,
          })),
          rules: (state.businessRules || state.rules || []).map((r) => ({
            description: r.description,
            category: r.category,
          })),
          unitRelationships: state.unitRelationships,
          recentEvents: state.events.slice(0, 10).map((e) => ({
            date: e.date,
            timeStr: e.timeStr,
            type: e.type,
            productName: e.productName,
            customerName: e.customerName,
            totalRevenue: e.totalRevenue,
            cashReceived: e.cashReceived,
            expenseAmount: e.expenseAmount,
            rawUserText: e.rawUserText,
          })),
        }),
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      let answerText = '';
      let extractedMemories: MemoryUpdateItem[] = [];
      let recordedEvent: BusinessEvent | undefined = undefined;
      let recordedEvents: BusinessEvent[] | undefined = undefined;
      let correctedEvent: BusinessEvent | undefined = undefined;
      let deletedEventId: string | undefined = undefined;
      let calendarDate: string | undefined = undefined;
      let calendarAction: string | undefined = undefined;

      if (json.success && (json.data?.answer || json.answer)) {
        answerText = json.data?.answer || json.answer;
        if (Array.isArray(json.data?.memories) && json.data.memories.length > 0) {
          extractedMemories = json.data.memories;
        } else if (Array.isArray(json.memories) && json.memories.length > 0) {
          extractedMemories = json.memories;
        }
        recordedEvents = json.data?.recordedEvents || json.recordedEvents || undefined;
        recordedEvent = json.data?.recordedEvent || json.recordedEvent || (recordedEvents && recordedEvents[0]) || undefined;
        correctedEvent = json.data?.correctedEvent || json.correctedEvent || undefined;
        deletedEventId = json.data?.deletedEventId || json.deletedEventId || undefined;
        calendarDate = json.data?.calendarDate || json.calendarDate || undefined;
        calendarAction = json.data?.calendarAction || json.calendarAction || undefined;
      } else {
        // Fallback to deterministic calculated response with multi-turn context
        const detRes = answerBusinessQuestionWithMemory(q, state, newMessages);
        answerText = detRes.answer;
        if (detRes.memoryUpdates) {
          extractedMemories = detRes.memoryUpdates;
        }
        recordedEvents = detRes.createdEvents;
        recordedEvent = detRes.createdEvent || (detRes.createdEvents && detRes.createdEvents[0]) || undefined;
        correctedEvent = detRes.correctedEvent;
        deletedEventId = detRes.deletedEventId;
        calendarDate = detRes.targetCalendarDate;
      }

      // If recorded or corrected event exists, ensure calendar date is populated
      if (!calendarDate) {
        if (recordedEvents && recordedEvents[0]?.date) calendarDate = recordedEvents[0].date;
        else if (recordedEvent?.date) calendarDate = recordedEvent.date;
        if (correctedEvent?.date) calendarDate = correctedEvent.date;
      }

      // Ensure all recorded events, corrected events, and memories have headlines and summaries populated
      if (recordedEvents && recordedEvents.length > 0) {
        recordedEvents = recordedEvents.map(ensureEventHeadlineAndSummary);
      }
      if (recordedEvent) {
        recordedEvent = ensureEventHeadlineAndSummary(recordedEvent);
      }
      if (correctedEvent) {
        correctedEvent = ensureEventHeadlineAndSummary(correctedEvent);
      }
      if (extractedMemories && extractedMemories.length > 0) {
        extractedMemories = extractedMemories.map(ensureMemoryHeadlineAndSummary);
      }

      // Apply memories, events, deletions, and calendar updates to business state
      if (extractedMemories.length > 0 || recordedEvent || recordedEvents?.length || correctedEvent || calendarDate || deletedEventId) {
        onApplyMemories(extractedMemories, recordedEvent, correctedEvent, calendarDate, deletedEventId, recordedEvents);
      }

      // If calendar date modified, navigate or select date
      if (calendarDate && onSelectCalendarDate) {
        onSelectCalendarDate(calendarDate);
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: answerText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        memorySaved: extractedMemories.length > 0 ? extractedMemories : undefined,
        calendarUpdatedDate: calendarDate,
        actionBadge: calendarAction || (deletedEventId && correctedEvent ? 'Deleted & Relogged' : deletedEventId ? 'Deleted' : correctedEvent ? 'Correction Logged' : recordedEvents && recordedEvents.length > 1 ? `${recordedEvents.length} Sales Logged` : recordedEvent ? 'Event Logged' : undefined),
        recordedEvent,
        correctedEvent,
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      onUpdateChatHistory(finalMessages);
    } catch (err) {
      // Deterministic calculation with conversational context
      const detRes = answerBusinessQuestionWithMemory(q, state, newMessages);
      const targetDate = detRes.targetCalendarDate || detRes.createdEvents?.[0]?.date || detRes.createdEvent?.date || detRes.correctedEvent?.date;
      if (detRes.memoryUpdates?.length || detRes.createdEvent || detRes.createdEvents?.length || detRes.correctedEvent || targetDate || detRes.deletedEventId) {
        onApplyMemories(detRes.memoryUpdates || [], detRes.createdEvent, detRes.correctedEvent, targetDate, detRes.deletedEventId, detRes.createdEvents);
      }
      if (targetDate && onSelectCalendarDate) {
        onSelectCalendarDate(targetDate);
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: detRes.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        memorySaved: detRes.memoryUpdates && detRes.memoryUpdates.length > 0 ? detRes.memoryUpdates : undefined,
        calendarUpdatedDate: targetDate,
        actionBadge: detRes.correctedEvent ? 'Correction Logged' : detRes.createdEvents && detRes.createdEvents.length > 1 ? `${detRes.createdEvents.length} Sales Logged` : detRes.createdEvent ? 'Event Logged' : undefined,
        recordedEvent: detRes.createdEvent || detRes.createdEvents?.[0],
        correctedEvent: detRes.correctedEvent,
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      onUpdateChatHistory(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearThread = () => {
    const resetThread: ChatMessage[] = [
      {
        id: `m-reset-${Date.now()}`,
        sender: 'assistant',
        text: "Started a fresh conversation thread. All previous business memories, customer debts, rules, and ledger figures remain safely saved!",
        timestamp: 'Just now',
      },
    ];
    setMessages(resetThread);
    onUpdateChatHistory(resetThread);
  };

  // Count total memories stored across the business
  const totalCustomerNotes = state.customers.filter((c) => c.notes).length;
  const totalRules = (state.businessRules || state.rules || []).length;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-white dark:bg-[#111726] rounded-none sm:rounded-2xl border-0 sm:border border-slate-200/90 dark:border-slate-800 shadow-none sm:shadow-sm overflow-hidden transition-colors relative">
      {/* Header with Context & Flow status */}
      <div className="shrink-0 px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#111726]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mr-0.5 cursor-pointer shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Back</span>
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shrink-0">
              <BrainCircuit className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Ask AI
                </h3>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60 shrink-0">
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {sessionMemories.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMemoriesVault(!showMemoriesVault)}
                className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 transition-colors min-h-[34px] cursor-pointer"
                title="View all memories learned in this chat"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Learned</span>
                <span>({sessionMemories.length})</span>
                {showMemoriesVault ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleClearThread}
              className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors min-h-[34px] cursor-pointer"
              title="Start fresh conversation thread while keeping saved memories"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Expandable Session Memory Vault */}
        {showMemoriesVault && sessionMemories.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-2 animate-in fade-in max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Memories Learned from Current Chat:
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMemoriesVault(false)}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {sessionMemories.map((mem, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-2 p-2 rounded-lg bg-white dark:bg-[#161f32] border border-emerald-200/80 dark:border-slate-700/80 text-xs shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 dark:text-white block truncate">
                      {mem.summary}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                      {mem.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Active Conversational Focus & Follow-up Prompt Pills Strip */}
      <div className="shrink-0 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-slate-50/70 dark:bg-[#0f1422] border-b border-slate-100 dark:border-slate-800/80 space-y-1">
        {activeEntity && (
          <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white dark:bg-[#161f32] border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-white truncate">
                Focus: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{activeEntity.name}</span>
                <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({activeEntity.details})</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleAsk(`Tell me about ${activeEntity.name}`)}
              className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Review →
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none touch-pan-x overscroll-x-contain -mx-1 px-1">
          {getContextualPills().map((pill, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAsk(pill.q)}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-emerald-600 hover:text-white transition-all whitespace-nowrap shrink-0 min-h-[30px] border border-slate-200/80 dark:border-slate-700/80 active:scale-95 cursor-pointer shadow-2xs"
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Conversation Messages Thread (Flex-1) */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto touch-scroll-y overscroll-y-contain touch-pan-y p-3 sm:p-4 md:p-5 space-y-3.5 bg-slate-50/50 dark:bg-[#0b0f19]/60 scrollbar-thin"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[88%] sm:max-w-[80%] p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                m.sender === 'user'
                  ? 'bg-slate-900 dark:bg-emerald-700 text-white rounded-br-xs'
                  : 'bg-white dark:bg-[#161f32] text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-bl-xs'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>

              {/* Memory Saved Badge: Confirms memory captured from chat */}
              {m.memorySaved && m.memorySaved.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                  {m.memorySaved.map((rawMem, idx) => {
                    const mem = ensureMemoryHeadlineAndSummary(rawMem);
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200 text-xs space-y-1 animate-in fade-in"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <span className="font-bold text-[11px] text-emerald-900 dark:text-emerald-200 truncate">
                              {mem.headline || mem.summary}
                            </span>
                          </div>
                          {onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => onNavigateTab('memory')}
                              className="flex items-center space-x-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 underline shrink-0 whitespace-nowrap cursor-pointer"
                            >
                              <span>Memory</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {mem.summary && mem.headline && (
                          <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed font-normal">
                            {mem.summary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Event Logged / Corrected Executive Summary Card */}
              {(m.recordedEvent || m.correctedEvent) && (() => {
                const ev = ensureEventHeadlineAndSummary(m.recordedEvent || m.correctedEvent!);
                return (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#121829] border border-slate-200/90 dark:border-slate-700/80 text-xs space-y-1 animate-in fade-in">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-white truncate text-xs">
                          {ev.headline}
                        </span>
                      </div>
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('timeline')}
                          className="flex items-center space-x-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
                        >
                          <span>Transactions</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      {ev.summary}
                    </p>
                  </div>
                );
              })()}

              {/* Calendar / Ledger Sync Badge: Confirms event logged or calendar modified */}
              {(m.calendarUpdatedDate || m.actionBadge || m.recordedEvent || m.correctedEvent) && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 text-blue-950 dark:text-blue-200 text-xs gap-2 animate-in fade-in">
                    <div className="flex items-center space-x-2 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="font-bold text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-300 shrink-0">
                        {m.actionBadge || 'Calendar Synced:'}
                      </span>
                      <span className="truncate text-blue-900 dark:text-blue-100 font-medium">
                        {m.calendarUpdatedDate || m.recordedEvent?.date || m.correctedEvent?.date || 'Today'}
                      </span>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetDate = m.calendarUpdatedDate || m.recordedEvent?.date || m.correctedEvent?.date;
                          if (onSelectCalendarDate && targetDate) {
                            onSelectCalendarDate(targetDate);
                          }
                          onNavigateTab('calendar');
                        }}
                        className="flex items-center space-x-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:text-blue-900 underline shrink-0 whitespace-nowrap cursor-pointer"
                      >
                        <span>View in Calendar</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <span
                className={`block text-[10px] mt-1.5 ${
                  m.sender === 'user' ? 'text-slate-300 dark:text-emerald-200 text-right' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {m.timestamp}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-[#161f32] border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center space-x-2.5 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping inline-block shrink-0" />
              <span>Analyzing conversational context and ledger...</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Scroll to Latest Button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-16 sm:bottom-20 right-3 sm:right-6 z-30 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-emerald-600 text-white text-xs font-semibold shadow-lg hover:bg-slate-800 dark:hover:bg-emerald-500 transition-all animate-in fade-in slide-in-from-bottom-2 cursor-pointer backdrop-blur-xs"
        >
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          <span>Latest messages</span>
        </button>
      )}

      {/* Bottom Input Field - Anchored flex item */}
      <div className="shrink-0 bg-white dark:bg-[#111726] border-t border-slate-100 dark:border-slate-800/80 p-2 sm:p-3 space-y-1 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_-2px_12px_rgba(0,0,0,0.2)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(inputQuestion);
          }}
          className="relative flex items-center space-x-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputQuestion}
              onFocus={() => setTimeout(() => scrollToBottom('smooth'), 250)}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={
                activeEntity && activeEntity.type === 'customer'
                  ? `Ask about ${activeEntity.name}...`
                  : 'Ask about your store, sales, or debts...'
              }
              className="w-full pl-3.5 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-base sm:text-sm bg-slate-50/90 dark:bg-[#161f32] focus:bg-white dark:focus:bg-[#1b253b] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 min-h-[46px] transition-all"
            />
            {/* Voice toggle inside input */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              title={isListening ? 'Listening... tap to stop' : 'Tap to speak question'}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputQuestion.trim() || isLoading}
            className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-40 min-h-[46px] min-w-[46px] flex items-center justify-center transition-all shrink-0 shadow-xs cursor-pointer active:scale-95"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {isListening && (
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block shrink-0" />
            <span>Listening to speech...</span>
          </div>
        )}

        {/* Live Business Memory Footer Indicator */}
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 px-0.5">
          <div className="flex items-center space-x-2 truncate">
            <span>🧠 Notes: <strong className="text-slate-700 dark:text-slate-300">{totalCustomerNotes}</strong></span>
            <span>•</span>
            <span>🏷️ Rules: <strong className="text-slate-700 dark:text-slate-300">{totalRules}</strong></span>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('memory')}
              className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold shrink-0 cursor-pointer"
            >
              Memory Bank →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

