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
  CheckCheck,
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
  Plus,
  MoreVertical,
} from 'lucide-react';
import { KarraLogo } from './KarraLogo';
import { BusinessState, ChatMessage, MemoryUpdateItem, BusinessEvent } from '../types';
import {
  answerBusinessQuestionWithMemory,
  isMerchantSpendingStatement,
  parseMerchantExpenseOrPurchase,
  handleCorrectionInput,
  parseNairaAmount,
} from '../engine/nlpInterpreter';
import { formatNaira } from '../engine/calculations';
import { getTodayDateStr } from '../utils/dateUtils';
import { ensureEventHeadlineAndSummary, ensureMemoryHeadlineAndSummary } from '../engine/eventSummarizer';
import { useVoiceInput } from '../hooks/useVoiceInput';
import {
  executeBusinessAction,
  findTargetEvent,
  matchProductFuzzy,
  matchCustomerFuzzy,
  StructuredBusinessAction,
} from '../engine/businessEngine';

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
            text: "I'm here to help! Ask any question about your business, or record your sales, expenses, and customer debts using plain everyday language.",
            timestamp: '12:00 PM',
          },
        ];

  const [messages, setMessages] = useState<ChatMessage[]>(initialThread);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMemoriesVault, setShowMemoriesVault] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const {
    isListening,
    interimTranscript,
    errorMessage: voiceError,
    isSupported: isVoiceSupported,
    toggleListening: handleVoiceToggle,
  } = useVoiceInput({
    onTranscript: (spokenText) => {
      if (spokenText.trim()) {
        setInputQuestion(spokenText.trim());
      }
    },
  });

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
        { label: `View notes on ${name}`, q: `What do you remember about ${name}?` },
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
      // Calculate live numbers and pre-computed ground truths for zero-hallucination AI
      const todayStr = getTodayDateStr();
      const todayEvents = state.events.filter((e) => e.date === todayStr && !e.isCorrected);
      const todaySales = todayEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.totalRevenue || 0 : 0), 0);
      const todayGross = todayEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.grossProfit || 0 : 0), 0);
      const todayExpenses = todayEvents.reduce((acc, e) => acc + (e.type === 'EXPENSE' ? e.expenseAmount || 0 : 0), 0);
      const todayNet = todayGross - todayExpenses;

      // Yesterday's metrics
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      const yesterdayStr = yDate.toISOString().split('T')[0];
      const yesterdayEvents = state.events.filter((e) => e.date === yesterdayStr && !e.isCorrected);
      const yesterdaySales = yesterdayEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.totalRevenue || 0 : 0), 0);
      const yesterdayGross = yesterdayEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.grossProfit || 0 : 0), 0);
      const yesterdayExpenses = yesterdayEvents.reduce((acc, e) => acc + (e.type === 'EXPENSE' ? e.expenseAmount || 0 : 0), 0);
      const yesterdayNet = yesterdayGross - yesterdayExpenses;

      // Debtor metrics
      const debtors = state.customers.filter((c) => (c.outstandingBalance || 0) > 0);
      const totalOwing = debtors.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0);

      // Lifetime metrics
      const allActiveEvents = state.events.filter((e) => !e.isCorrected);
      const totalLifetimeSales = allActiveEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.totalRevenue || 0 : 0), 0);
      const totalLifetimeExpenses = allActiveEvents.reduce((acc, e) => acc + (e.type === 'EXPENSE' ? e.expenseAmount || 0 : 0), 0);
      const totalLifetimeGross = allActiveEvents.reduce((acc, e) => acc + (e.type === 'SALE' ? e.grossProfit || 0 : 0), 0);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

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
            todayDate: todayStr,
            todaySales,
            todayGrossProfit: todayGross,
            todayExpenses,
            todayNet,
            yesterdayDate: yesterdayStr,
            yesterdaySales,
            yesterdayGrossProfit: yesterdayGross,
            yesterdayExpenses,
            yesterdayNet,
            totalCustomerDebt: totalOwing,
            debtorsList: debtors.map((d) => ({ name: d.name, amountOwed: d.outstandingBalance })),
            totalActiveProducts: state.products.length,
            totalCustomers: state.customers.length,
            totalLifetimeSales,
            totalLifetimeExpenses,
            totalLifetimeProfit: totalLifetimeGross - totalLifetimeExpenses,
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
          recentEvents: state.events.slice(0, 20).map((e) => ({
            date: e.date,
            timeStr: e.timeStr,
            type: e.type,
            productName: e.productName,
            customerName: e.customerName,
            totalRevenue: e.totalRevenue,
            cashReceived: e.cashReceived,
            expenseAmount: e.expenseAmount,
            grossProfit: e.grossProfit,
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

        // Check if server returned a structured business action to execute
        const action: StructuredBusinessAction | undefined = json.data?.structuredAction || json.structuredAction;
        if (action && action.intent && action.intent !== 'RETRIEVAL_ONLY') {
          const execRes = executeBusinessAction(action, state);
          if (!execRes.success) {
            answerText = execRes.message || "I couldn't perform that action. Your business records remain unchanged.";
            calendarAction = undefined;
            recordedEvent = undefined;
            recordedEvents = undefined;
            correctedEvent = undefined;
            deletedEventId = undefined;
          } else {
            recordedEvent = execRes.createdEvent;
            recordedEvents = execRes.createdEvents;
            correctedEvent = execRes.correctedEvent;
            deletedEventId = execRes.deletedEventId;
            calendarDate = action.date || getTodayDateStr();
            calendarAction = execRes.deletedEventId
              ? 'DELETED'
              : execRes.deletedProductId
              ? 'Product Deleted'
              : execRes.deletedCustomerId
              ? 'Customer Deleted'
              : execRes.correctedEvent
              ? 'CORRECTED'
              : 'RECORDED';
            answerText = execRes.message || answerText;
            if (execRes.memoryUpdates && execRes.memoryUpdates.length > 0) {
              extractedMemories = [...extractedMemories, ...execRes.memoryUpdates];
            }
          }
        } else {
          // Direct event payloads or client-validated deletion/edit intent
          const rawDelId = json.data?.deletedEventId || json.deletedEventId;
          const targetDesc = json.data?.targetDescription || json.targetDescription || q;
          const lowerQ = q.toLowerCase().trim();

          const isExplicitDelete =
            Boolean(rawDelId) ||
            lowerQ.startsWith('delete') ||
            lowerQ.startsWith('remove') ||
            lowerQ.startsWith('void') ||
            lowerQ.startsWith('clear') ||
            lowerQ.startsWith('please delete') ||
            lowerQ.startsWith('can you delete') ||
            lowerQ.includes('delete ') ||
            lowerQ.includes('remove ') ||
            lowerQ.includes('void ') ||
            lowerQ.includes('delete product') ||
            lowerQ.includes('delete customer') ||
            lowerQ.includes('delete sale') ||
            lowerQ.includes('delete expense') ||
            (answerText.toLowerCase().includes('deleted') &&
              (lowerQ.includes('delete') || lowerQ.includes('remove') || lowerQ.includes('void')));

          const isExplicitEdit =
            lowerQ.startsWith('edit') ||
            lowerQ.startsWith('change') ||
            lowerQ.startsWith('correct') ||
            lowerQ.startsWith('update') ||
            lowerQ.startsWith('actually') ||
            lowerQ.includes('edit product') ||
            lowerQ.includes('change product') ||
            lowerQ.includes('update product') ||
            lowerQ.includes('change the') ||
            lowerQ.includes('correct the') ||
            (answerText.toLowerCase().includes('corrected') &&
              (lowerQ.includes('change') || lowerQ.includes('correct') || lowerQ.includes('update') || lowerQ.includes('edit')));

          const isMerchantSpending = isMerchantSpendingStatement(q, state.customers);

          if (rawDelId || isExplicitDelete) {
            const cleanTarget = targetDesc
              .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:delete|remove|void|clear)\s+(?:the\s+)?(?:product\s+|good\s+|item\s+)?/i, '')
              .replace(/\s+(?:from\s+memory|from\s+business\s+memory|from\s+my\s+store)$/i, '')
              .trim();

            const matchedProd = matchProductFuzzy(cleanTarget, state.products);
            if (
              lowerQ.includes('product') ||
              lowerQ.includes('from memory') ||
              (matchedProd && !lowerQ.includes('transaction') && !lowerQ.includes('sale') && !lowerQ.includes('expense'))
            ) {
              // Delete Product intent
              const execDel = executeBusinessAction(
                { intent: 'DELETE_PRODUCT', productOrServiceName: cleanTarget },
                state
              );
              answerText = execDel.message;
              if (execDel.success && execDel.memoryUpdates) {
                extractedMemories = [...extractedMemories, ...execDel.memoryUpdates];
                calendarAction = 'Product Deleted';
              }
            } else if (lowerQ.includes('customer') || lowerQ.includes('debtor')) {
              // Delete Customer intent
              const cleanCust = targetDesc
                .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:delete|remove|void)\s+(?:the\s+)?(?:customer\s+|debtor\s+)?/i, '')
                .trim();
              const execDel = executeBusinessAction(
                { intent: 'DELETE_CUSTOMER', customerName: cleanCust },
                state
              );
              answerText = execDel.message;
              if (execDel.success && execDel.memoryUpdates) {
                extractedMemories = [...extractedMemories, ...execDel.memoryUpdates];
                calendarAction = 'Customer Deleted';
              }
            } else {
              // Delete Transaction / Event intent
              const targetEv = findTargetEvent(state, targetDesc, rawDelId);
              if (targetEv) {
                const execDel = executeBusinessAction(
                  { intent: 'DELETE_EVENT', targetEventId: targetEv.id },
                  state
                );
                if (execDel.success) {
                  deletedEventId = targetEv.id;
                  calendarAction = 'DELETED';
                  calendarDate = targetEv.date;
                  answerText = execDel.message;
                  if (execDel.memoryUpdates) {
                    extractedMemories = [...extractedMemories, ...execDel.memoryUpdates];
                  }
                } else {
                  answerText = "I couldn't delete that transaction. Your business records remain unchanged.";
                  deletedEventId = undefined;
                  calendarAction = undefined;
                }
              } else {
                answerText = `I couldn't find a transaction matching "${cleanTarget || targetDesc}" to delete in your business records. Your ledger remains unchanged.`;
                deletedEventId = undefined;
                calendarAction = undefined;
              }
            }
          } else if (isExplicitEdit) {
            // Edit / Correction intent
            const cleanTarget = targetDesc
              .replace(/^(?:please\s+)?(?:edit|change|update|correct)\s+(?:the\s+)?(?:product\s+|good\s+|item\s+)?/i, '')
              .trim();
            const matchedProd = matchProductFuzzy(cleanTarget, state.products);

            if (lowerQ.includes('product') || (matchedProd && !lowerQ.includes('sale') && !lowerQ.includes('transaction'))) {
              const amtMatch = q.match(/(?:[₦#]?\s*([0-9.,]+[km]?))/i);
              const parsedAmt = amtMatch ? parseNairaAmount(amtMatch[1]) : null;
              if (matchedProd && parsedAmt && parsedAmt > 0) {
                const isCostUpdate = lowerQ.includes('cost') || lowerQ.includes('wholesale');
                const execUp = executeBusinessAction(
                  {
                    intent: 'UPDATE_PRODUCT',
                    productOrServiceName: matchedProd.name,
                    unitPrice: isCostUpdate ? parsedAmt : undefined,
                    totalAmount: !isCostUpdate ? parsedAmt : undefined,
                  },
                  state
                );
                answerText = execUp.message;
                if (execUp.success && execUp.memoryUpdates) {
                  extractedMemories = [...extractedMemories, ...execUp.memoryUpdates];
                  calendarAction = 'Product Updated';
                }
              } else {
                const corr = handleCorrectionInput(q, state);
                if (corr) {
                  answerText = corr.plainResponseText || answerText;
                  if (corr.memoryUpdates) extractedMemories = [...extractedMemories, ...corr.memoryUpdates];
                  if (corr.correctedEvent) correctedEvent = corr.correctedEvent;
                  if (corr.targetCalendarDate) calendarDate = corr.targetCalendarDate;
                  calendarAction = 'Product Updated';
                }
              }
            } else {
              const corr = handleCorrectionInput(q, state);
              if (corr) {
                answerText = corr.plainResponseText || answerText;
                if (corr.correctedEvent) {
                  correctedEvent = corr.correctedEvent;
                  calendarAction = 'CORRECTED';
                  calendarDate = corr.targetCalendarDate || corr.correctedEvent.date;
                }
                if (corr.deletedEventId) {
                  deletedEventId = corr.deletedEventId;
                  calendarAction = 'DELETED';
                  calendarDate = corr.targetCalendarDate || getTodayDateStr();
                }
                if (corr.memoryUpdates) {
                  extractedMemories = [...extractedMemories, ...corr.memoryUpdates];
                }
              }
            }
          } else if (isMerchantSpending) {
            // "I bought so and so", "Bought fuel 5k", "I bought 30 cartons from Musa" - ALWAYS an expense, NEVER a sale!
            const merchRes = parseMerchantExpenseOrPurchase(q, state);
            if (merchRes) {
              if (merchRes.createdEvent) {
                recordedEvent = merchRes.createdEvent;
                calendarAction = 'RECORDED';
                calendarDate = merchRes.createdEvent.date;
                answerText = merchRes.plainResponseText;
              }
              if (merchRes.memoryUpdates) {
                extractedMemories = [...extractedMemories, ...merchRes.memoryUpdates];
              }
            }
          } else {
            // Informational query, greeting, or guidance: Never record an event
            recordedEvent = undefined;
            recordedEvents = undefined;
            correctedEvent = undefined;
          }
        }
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
        
        if (detRes.deletedEventId) {
          const exists = state.events.some((e) => e.id === detRes.deletedEventId && !e.isCorrected);
          if (exists) {
            deletedEventId = detRes.deletedEventId;
          } else {
            deletedEventId = undefined;
            answerText = "I couldn't find that transaction to delete in your business records. Your ledger remains unchanged.";
          }
        }
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
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 dark:bg-[#061026] text-slate-900 dark:text-slate-100 overflow-hidden relative font-sans">
      {/* 1. TOP HEADER (Matching Reference Screenshot) */}
      <div className="shrink-0 px-3.5 sm:px-5 py-3 border-b border-slate-200 dark:border-[#0d2238] bg-white/95 dark:bg-[#061026]/95 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center space-x-3 min-w-0">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-[#112437] hover:bg-slate-200 dark:hover:bg-[#18314a] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#162e49] flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="shrink-0">
            <KarraLogo size="sm" variant="green-bg" />
          </div>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
              Ask Karra
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-none mt-0.5">
              Your business assistant
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 relative">
          <div className="bg-emerald-50 dark:bg-[#04241d] border border-emerald-200 dark:border-[#093e32] text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span>Active</span>
          </div>

          <button
            type="button"
            onClick={() => setShowMenuDropdown(!showMenuDropdown)}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-transparent hover:bg-slate-200 dark:hover:bg-[#112437] border border-slate-200 dark:border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            title="Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Options Dropdown Menu */}
          {showMenuDropdown && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-[#0b1b2d] border border-slate-200 dark:border-[#142c46] rounded-2xl p-2 shadow-2xl z-50 space-y-1 animate-in fade-in">
              <button
                type="button"
                onClick={() => {
                  setShowMenuDropdown(false);
                  handleClearThread();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12283e] flex items-center space-x-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Conversation</span>
              </button>

              {sessionMemories.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenuDropdown(false);
                    setShowMemoriesVault(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-[#12283e] flex items-center space-x-2 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Saved Memories ({sessionMemories.length})</span>
                </button>
              )}

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenuDropdown(false);
                    onNavigateTab('memory');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#12283e] flex items-center space-x-2 cursor-pointer transition-colors"
                >
                  <Database className="w-3.5 h-3.5 text-slate-400" />
                  <span>View Memory Bank</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expandable Session Memory Vault Modal if opened from menu */}
      {showMemoriesVault && sessionMemories.length > 0 && (
        <div className="mx-3.5 sm:mx-4 mt-2 p-3 rounded-2xl bg-emerald-50 dark:bg-[#09222c] border border-emerald-200 dark:border-[#0e484a] space-y-2 animate-in fade-in max-h-48 overflow-y-auto shrink-0 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Memories Saved from Current Chat:
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowMemoriesVault(false)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {sessionMemories.map((mem, idx) => (
              <div
                key={idx}
                className="flex items-start space-x-2 p-2 rounded-xl bg-white dark:bg-[#061824] border border-emerald-100 dark:border-[#0e3b44] text-xs shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-900 dark:text-white block truncate">
                    {mem.summary}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {mem.type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SCROLLABLE CONVERSATION FEED */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-4 py-3 sm:py-4 space-y-4 scrollbar-thin bg-transparent"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          if (isUser) {
            return (
              <div key={m.id} className="flex justify-end animate-in fade-in duration-200">
                <div className="max-w-[85%] sm:max-w-[75%] bg-[#065b43] text-white rounded-2xl rounded-tr-xs p-3.5 text-xs sm:text-sm font-medium shadow-xs leading-relaxed">
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <div className="flex items-center justify-end space-x-1 text-[10px] text-emerald-200/90 mt-1">
                    <span>{m.timestamp}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-300 ml-1 inline-block" />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className="flex items-start space-x-2.5 max-w-[92%] sm:max-w-[85%] animate-in fade-in duration-200"
            >
              <div className="w-8 h-8 rounded-xl bg-[#084b3e] text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <KarraLogo size="sm" variant="green-bg" />
              </div>
              <div className="flex-1 bg-white dark:bg-[#0d2238] border border-slate-200 dark:border-[#16314d] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-xs p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-xs">
                <p className="whitespace-pre-wrap">{m.text}</p>

                {/* If memory was saved */}
                {m.memorySaved && m.memorySaved.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-[#16314d] space-y-1.5">
                    {m.memorySaved.map((rawMem, idx) => {
                      const mem = ensureMemoryHeadlineAndSummary(rawMem);
                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-emerald-50 dark:bg-[#082a2b] border border-emerald-200 dark:border-[#0d4f4e] text-emerald-800 dark:text-emerald-200 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="font-bold text-[11px] truncate">
                                {mem.headline || mem.summary}
                              </span>
                            </div>
                            {onNavigateTab && (
                              <button
                                type="button"
                                onClick={() => onNavigateTab('memory')}
                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline shrink-0 whitespace-nowrap cursor-pointer"
                              >
                                View Memory →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Event Logged / Corrected Executive Summary Card */}
                {(m.recordedEvent || m.correctedEvent) && (() => {
                  const ev = ensureEventHeadlineAndSummary(m.recordedEvent || m.correctedEvent!);
                  return (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#071d33] border border-slate-200 dark:border-[#0e355c] text-xs space-y-1">
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
                            className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
                          >
                            Transactions →
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                        {ev.summary}
                      </p>
                    </div>
                  );
                })()}

                {/* Calendar / Ledger Sync Badge */}
                {(m.calendarUpdatedDate || m.actionBadge) && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-[#16314d]">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-sky-50 dark:bg-[#081e36] border border-sky-200 dark:border-[#0f3b6a] text-sky-800 dark:text-sky-200 text-xs gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span className="font-bold text-[11px] uppercase tracking-wider text-sky-700 dark:text-sky-300 shrink-0">
                          {m.actionBadge || 'Calendar Synced:'}
                        </span>
                        <span className="truncate text-sky-900 dark:text-sky-100 font-medium">
                          {m.calendarUpdatedDate || 'Today'}
                        </span>
                      </div>
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectCalendarDate && m.calendarUpdatedDate) {
                              onSelectCalendarDate(m.calendarUpdatedDate);
                            }
                            onNavigateTab('calendar');
                          }}
                          className="text-[11px] font-bold text-sky-600 dark:text-sky-400 underline shrink-0 whitespace-nowrap cursor-pointer"
                        >
                          View Calendar →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <span className="text-[11px] text-slate-400 dark:text-slate-400 mt-2 block font-normal">
                  Karra • {m.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start space-x-2.5 max-w-[92%] animate-in fade-in">
            <div className="w-8 h-8 rounded-xl bg-[#084b3e] text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <KarraLogo size="sm" variant="green-bg" />
            </div>
            <div className="bg-white dark:bg-[#0d2238] border border-slate-200 dark:border-[#16314d] text-slate-600 dark:text-slate-300 rounded-2xl rounded-tl-xs px-4 py-3 text-xs flex items-center space-x-2.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Karra is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Scroll to Latest Button */}
      {showScrollBottomBtn && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-20 right-4 sm:right-6 z-30 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#059669] text-white text-xs font-semibold shadow-lg hover:bg-[#047857] transition-all animate-in fade-in slide-in-from-bottom-2 cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
          <span>Latest messages</span>
        </button>
      )}

      {/* 4. BOTTOM INPUT FIELD (Matching Reference Screenshot 100%) */}
      <div className="shrink-0 p-3 sm:p-4 bg-white dark:bg-[#061026] border-t border-slate-200 dark:border-[#0d2238]">
        {/* Quick prompt popup when '+' is clicked */}
        {showQuickPrompts && (
          <div className="mb-2.5 p-3 rounded-2xl bg-white dark:bg-[#091829] border border-slate-200 dark:border-[#142c46] shadow-xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-300">Quick Prompt Ideas</span>
              <button
                type="button"
                onClick={() => setShowQuickPrompts(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {[
                { label: 'Who owes me money?', q: 'Who owes me money?' },
                { label: 'How much did I sell today?', q: 'How much did I sell today?' },
                { label: 'What did I spend the most on?', q: 'What did I spend the most money on?' },
                { label: 'Which product made most profit?', q: 'Which product makes me the most profit?' },
              ].map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setShowQuickPrompts(false);
                    handleAsk(qp.q);
                  }}
                  className="text-left text-xs p-2 rounded-xl bg-slate-100 dark:bg-[#0d2238] hover:bg-slate-200 dark:hover:bg-[#122e4c] border border-slate-200 dark:border-[#16314d] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(inputQuestion);
          }}
          className="relative flex items-center space-x-2 bg-slate-100 dark:bg-[#091829] border border-slate-200 dark:border-[#142c46] rounded-2xl px-2 sm:px-2.5 py-1.5 sm:py-2 shadow-lg focus-within:border-emerald-500/70 transition-colors"
        >
          {/* Plus Button */}
          <button
            type="button"
            onClick={() => setShowQuickPrompts(!showQuickPrompts)}
            className="w-9 h-9 rounded-full bg-slate-200 dark:bg-[#12283e] hover:bg-slate-300 dark:hover:bg-[#1a3857] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-xs"
            title="Prompt Shortcuts"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputQuestion}
            onFocus={() => setTimeout(() => scrollToBottom('smooth'), 250)}
            onChange={(e) => setInputQuestion(e.target.value)}
            placeholder="Ask about your business..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none px-2 min-h-[40px]"
          />

          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={handleVoiceToggle}
            title={
              !isVoiceSupported
                ? 'Voice input not supported in this browser'
                : isListening
                ? 'Listening... tap to finish'
                : 'Tap to speak question'
            }
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400'
                : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mic className={`w-4 h-4 ${isListening ? 'animate-bounce' : ''}`} />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputQuestion.trim() || isLoading}
            className="w-9 h-9 rounded-full bg-[#059669] hover:bg-[#047857] disabled:opacity-40 disabled:hover:bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-xs transition-colors cursor-pointer"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {isListening && (
          <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 font-medium flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping inline-block shrink-0" />
              <span className="font-semibold text-rose-900 dark:text-rose-100">
                {interimTranscript ? `"${interimTranscript}"` : 'Listening... Speak naturally'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleVoiceToggle}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-300 hover:underline shrink-0 ml-2 cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {voiceError && !isListening && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center space-x-2 animate-in fade-in">
            <span>{voiceError}</span>
          </div>
        )}
      </div>
    </div>
  );
};

