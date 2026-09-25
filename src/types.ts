export type ExpenseCategory =
  | 'Transportation'
  | 'Rent'
  | 'Utilities'
  | 'Staff/Labour'
  | 'Packaging'
  | 'Marketing'
  | 'Repairs'
  | 'Procurement'
  | 'Taxes/fees'
  | 'Other';

export type BusinessEventType =
  | 'SALE'
  | 'EXPENSE'
  | 'PURCHASE_STOCK'
  | 'DEBT_PAYMENT'
  | 'CUSTOMER_DEBT'
  | 'RETURN_REFUND'
  | 'OWNER_DRAWING'
  | 'OWNER_INJECTION'
  | 'PRICE_CHANGE'
  | 'UNIT_DEF';

export interface CostHistoryEntry {
  date: string;
  cost: number;
  supplier?: string;
  note?: string;
  reason?: string;
}

export interface PriceHistoryEntry {
  date: string;
  price: number;
  note?: string;
}

export interface YieldInfo {
  parentUnit: string; // e.g. "bag"
  childUnit: string;  // e.g. "bowl"
  yieldCount: number; // e.g. 45
  parentCost: number; // e.g. 59000
  estimatedUnitCost: number; // e.g. 1311.11
  isEstimate: boolean;
}

export interface ProductMemory {
  id: string;
  name: string;
  unit: string;
  currentCost: number;
  normalSellingPrice: number;
  previousCost?: number;
  costHistory: CostHistoryEntry[];
  priceHistory: PriceHistoryEntry[];
  yieldInfo?: YieldInfo;
  currentStock?: number;
  category?: string;
  howLearned?: string;
  headline?: string;
  summary?: string;
}

export interface CustomerMemory {
  id: string;
  name: string;
  phone?: string;
  totalPurchased: number;
  totalPaid: number;
  outstandingBalance: number;
  lastActivityDate: string;
  paymentReliability?: string;
  notes?: string;
  headline?: string;
  summary?: string;
  history: Array<{
    eventId: string;
    date: string;
    type: 'PURCHASE' | 'PAYMENT' | 'RETURN';
    amount: number;
    description: string;
  }>;
}

export interface SupplierMemory {
  id: string;
  name: string;
  phone?: string;
  location?: string;
  itemsSupplied: string[];
  currentPrices: Record<string, number>;
  typicalPrices?: Record<string, number>;
  notes?: string;
  history: Array<{
    eventId: string;
    date: string;
    item: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }>;
}

export interface UnitRelationship {
  id: string;
  productName: string;
  parentUnit: string; // e.g. "bag", "carton"
  childUnit: string;  // e.g. "bowl", "bottle"
  ratio: number;      // e.g. 45 bowls per bag
  yieldCount?: number;
  parentCost?: number;
  estimatedCostPerChild?: number;
  isEstimate: boolean;
  source?: string;
  updatedAt?: string;
}

export interface BusinessRule {
  id: string;
  description: string;
  category: 'PRICING' | 'PAYMENT' | 'EXPENSE' | 'GENERAL';
  active: boolean;
  createdAt: string;
  ruleName?: string;
  ruleValue?: number | string;
  headline?: string;
  summary?: string;
}

export interface BusinessPulseItem {
  id: string;
  type: 'POSITIVE' | 'WARNING' | 'OPPORTUNITY' | 'NEUTRAL';
  title: string;
  message: string;
  metric?: string;
  actionable?: boolean;
  actionLabel?: string;
  actionType?: 'WEEKLY_REPORT' | 'AUDIT_EXPENSES' | 'COLLECT_DEBTS' | 'PRODUCT_OPPORTUNITY' | 'GENERAL';
}

export type ReportPeriod = 'weekly' | 'monthly' | 'yearly';

export interface BusinessReportData {
  period: ReportPeriod;
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  totalSales: number;
  totalCostOfGoods: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
  cashReceived: number;
  creditGiven: number;
  cashCollectionRate: number;
  debtRecovered: number;
  totalTransactions: number;
  totalItemsSold: number;
  dailyTrend: Array<{
    date: string;
    label: string;
    sales: number;
    profit: number;
    expenses: number;
    cash: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  topProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
    cost: number;
    profit: number;
    marginPercent: number;
  }>;
  activeDebtors: Array<{
    customerName: string;
    phone?: string;
    outstandingBalance: number;
    totalPurchased: number;
    totalPaid: number;
    lastActivityDate: string;
  }>;
  summaryExecutiveText: string;
}

export interface AuditRecord {
  timestamp: string;
  action: string;
  previousValue?: string;
  newValue?: string;
  note?: string;
  performedBy?: string;
}

export interface BusinessEvent {
  id: string;
  timestamp: string; // ISO
  date: string;      // YYYY-MM-DD
  timeStr: string;   // "10:32 AM"
  type: BusinessEventType;
  rawUserText: string;
  systemResponseText: string;
  
  // AI-generated headline & summary for prominent reflection in UI pages
  headline?: string;
  summary?: string;
  
  // Specific entity linkages
  productName?: string;
  category?: string;
  productCategory?: string;
  customerName?: string;
  supplierName?: string;
  quantity?: number;
  unit?: string;

  // Financial values (all in Naira ₦)
  unitSellingPrice?: number;
  totalRevenue?: number;
  cashReceived?: number;
  receivableAdded?: number; // customer owes this
  
  // Historical cost lock (CRITICAL: preserved at time of transaction)
  unitCostAtTime?: number;
  totalCostAtTime?: number;
  costIsEstimate?: boolean;
  costEstimateBasis?: string;

  // Derived calculations
  grossProfit?: number;
  isLoss?: boolean;

  // Promotion data
  isPromotion?: boolean;
  normalPotentialRevenue?: number;
  discountGiven?: number;

  // Expense specific
  expenseCategory?: ExpenseCategory;
  expenseAmount?: number;

  // Owner specific
  ownerAmount?: number;
  isOwnerDrawing?: boolean;
  isOwnerInjection?: boolean;

  // Refund / Return
  refundAmount?: number;
  returnedQuantity?: number;

  // Audit and state
  isCorrected?: boolean;
  correctionOfId?: string;
  auditTrail?: AuditRecord[];
}

export interface FollowUpQuestion {
  id: string;
  prompt: string;
  missingField: 'COST_PER_UNIT' | 'YIELD_COUNT' | 'PAYMENT_SPLIT' | 'CUSTOMER_NAME' | 'EXPENSE_CATEGORY';
  productName?: string;
  pendingEvent: Partial<BusinessEvent>;
  options?: string[];
  helperText?: string;
}

export interface DailySummary {
  date: string;
  formattedDate: string;
  sales: number;
  cashReceived: number;
  outstandingReceivables: number;
  expenses: number;
  costOfGoods: number;
  estimatedGrossProfit: number;
  netOperatingResult: number; // profit minus expenses
  itemsSoldCount: number;
  eventsCount: number;
  hasEstimates: boolean;
  status: 'PROFIT' | 'LOSS' | 'BREAKEVEN';
  plainSummary: string;
}

export interface CalculationExplanation {
  title: string;
  targetMetric: string;
  totalValue: number;
  formula: string;
  breakdownRows: Array<{
    label: string;
    amount: number;
    isDeduction?: boolean;
    note?: string;
  }>;
  contributingEvents: BusinessEvent[];
  isEstimate: boolean;
  estimateReason?: string;
}

export interface MemoryUpdateItem {
  type:
    | 'CUSTOMER_NOTE'
    | 'CUSTOMER_PHONE'
    | 'CUSTOMER_DEBT'
    | 'CUSTOMER_PAYMENT'
    | 'PRODUCT_COST'
    | 'PRODUCT_PRICE'
    | 'SUPPLIER_INFO'
    | 'BUSINESS_RULE'
    | 'UNIT_CONVERSION'
    | 'EVENT_CORRECTION'
    | 'CALENDAR_UPDATE'
    | 'GENERAL_FACT';
  targetName?: string;
  headline?: string;
  summary: string;
  data?: any;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  eventId?: string;
  isFollowUpQuestion?: boolean;
  followUpData?: FollowUpQuestion;
  calculationExplanation?: CalculationExplanation;
  tags?: string[];
  memorySaved?: MemoryUpdateItem[];
  calendarUpdatedDate?: string;
  actionBadge?: string;
  correctedEvent?: BusinessEvent;
  recordedEvent?: BusinessEvent;
  recordedEvents?: BusinessEvent[];
}

export interface BusinessState {
  businessName: string;
  ownerName: string;
  currency: string;
  events: BusinessEvent[];
  products: ProductMemory[];
  customers: CustomerMemory[];
  suppliers: SupplierMemory[];
  unitRelationships: UnitRelationship[];
  rules: BusinessRule[];
  businessRules?: BusinessRule[];
  chatHistory: ChatMessage[];
  pendingFollowUp: FollowUpQuestion | null;
  pulseInsights?: BusinessPulseItem[];
  profile?: BusinessProfile;
}

export type NavigationTab = 'dashboard' | 'calendar' | 'timeline' | 'transactions' | 'memory' | 'questions' | 'profile' | 'admin';

export type BetaStatus = 'active' | 'suspended' | 'revoked' | 'pending' | 'none';

export interface BetaInvitation {
  id: string;
  code: string;
  status: 'active' | 'redeemed' | 'revoked' | 'expired';
  maxUses: number;
  currentUses: number;
  createdAt: string;
  expiresAt?: string | null;
  createdBy: string;
  notes?: string;
  usedBy?: Array<{
    userId: string;
    userEmail: string;
    businessName: string;
    redeemedAt: string;
  }>;
  redeemedAt?: string | null;
}

export type BetaFeedbackType =
  | 'bug'
  | 'confusing'
  | 'missing_feature'
  | 'wrong_calculation'
  | 'ai_problem'
  | 'ui_problem'
  | 'general';

export interface BetaFeedbackItem {
  id: string;
  userId: string;
  userEmail: string;
  businessName: string;
  type: BetaFeedbackType;
  message: string;
  context?: {
    tab?: string;
    page?: string;
    url?: string;
    timestamp?: string;
    device?: string;
    screen?: string;
    userAgent?: string;
    lastAction?: string;
    errorMessage?: string;
  };
  createdAt: string;
  status: 'open' | 'reviewed' | 'resolved';
}

export interface BetaAccessRequest {
  id: string;
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  notes?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface BetaAnalytics {
  totalInvitations: number;
  activeInvitations: number;
  redeemedInvitations: number;
  revokedInvitations: number;
  totalBetaUsers: number;
  activeBetaUsers: number;
  suspendedBetaUsers: number;
  totalFeedbackSubmissions: number;
  totalAccessRequests: number;
  totalEvents: number;
}

export interface BetaEventRecord {
  id: string;
  userId: string;
  userEmail?: string;
  businessName?: string;
  eventName: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  category: string;
  tagline?: string;
  phone: string;
  email?: string;
  address: string;
  cityState: string;
  currency: string;
  openingHours: string;
  foundedYear: string;
  registrationNumber?: string;
  paymentMethods?: string[];
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  creditLimitPolicy?: number;
  lowStockThreshold?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  businessName: string;
  betaStatus?: BetaStatus;
  betaInvitationCode?: string;
  betaJoinedAt?: string;
  role?: 'admin' | 'merchant';
  createdAt: string;
  updatedAt: string;
}
