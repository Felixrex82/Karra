import React, { useState } from 'react';
import {
  ArrowRight,
  Key,
  MessageSquare,
  TrendingUp,
  Users,
  Receipt,
  CheckCircle2,
  ChevronRight,
  Sun,
  Moon,
  Database,
  FileSpreadsheet,
  Scissors,
  Utensils,
  ShoppingBag,
  Wrench,
  BarChart3,
  Wallet,
  Calendar,
  Activity,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { KarraLogo } from './KarraLogo';

interface LandingPageProps {
  onEnterCode: () => void;
  onSignIn: () => void;
  onSignUp?: () => void;
  onRequestAccess: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

interface WeeklyChartItem {
  day: string;
  dayFull: string;
  revenue: number;
  cost: number;
  profit: number;
  cashCollected: number;
  debtAdded: number;
  highlight: string;
}

interface DemoScenario {
  id: string;
  badge: string;
  category: string;
  title: string;
  location: string;
  inputText: string;
  output: {
    revenue: string;
    cashCollected: string;
    transferCollected: string;
    debtAmount: string;
    debtorName: string;
    debtDueDate: string;
    costBasis: string;
    profitEstimate: string;
    profitMargin: string;
    inventoryChange: string;
  };
  weeklyChart: WeeklyChartItem[];
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'fashion',
    badge: 'Fashion & Tailoring',
    category: 'Bespoke Atelier & Design',
    title: 'Amaka Couture Studio',
    location: 'Ikeja / Lekki, Lagos',
    inputText:
      'Received ₦45,000 order from Barrister Tunde for a 2-piece Agbada with embroidery. He paid ₦25,000 advance transfer, balance ₦20,000 on final fitting next Friday. Spent ₦18,000 cash on fabric and lining.',
    output: {
      revenue: '₦45,000',
      cashCollected: '-₦18,000 (Materials Expense)',
      transferCollected: '₦25,000 (Bank Advance)',
      debtAmount: '₦20,000',
      debtorName: 'Barrister Tunde',
      debtDueDate: 'Due Next Friday (Fitting)',
      costBasis: '₦18,000 (Fabric & accessories)',
      profitEstimate: '+₦27,000',
      profitMargin: '60.0%',
      inventoryChange: '+1 Agbada Outfit (In Production)',
    },
    weeklyChart: [
      { day: 'Mon', dayFull: 'Monday', revenue: 65000, cost: 22000, profit: 43000, cashCollected: 45000, debtAdded: 20000, highlight: 'Senator suit deposit & fabric run' },
      { day: 'Tue', dayFull: 'Tuesday', revenue: 40000, cost: 14000, profit: 26000, cashCollected: 40000, debtAdded: 0, highlight: 'Lace blouse styling & fittings' },
      { day: 'Wed', dayFull: 'Wednesday', revenue: 95000, cost: 35000, profit: 60000, cashCollected: 65000, debtAdded: 30000, highlight: 'Bridal party train 3-piece order' },
      { day: 'Thu', dayFull: 'Thursday', revenue: 52000, cost: 18000, profit: 34000, cashCollected: 32000, debtAdded: 20000, highlight: 'Agbada delivery & embroidery balance' },
      { day: 'Fri', dayFull: 'Friday', revenue: 120000, cost: 42000, profit: 78000, cashCollected: 95000, debtAdded: 25000, highlight: 'Pre-weekend traditional wedding collections' },
      { day: 'Sat', dayFull: 'Saturday', revenue: 85000, cost: 28000, profit: 57000, cashCollected: 85000, debtAdded: 0, highlight: 'Final collection & balance cleared' },
      { day: 'Sun', dayFull: 'Sunday', revenue: 20000, cost: 5000, profit: 15000, cashCollected: 20000, debtAdded: 0, highlight: 'Emergency fitting consultation' },
    ],
  },
  {
    id: 'catering',
    badge: 'Catering & Food',
    category: 'Bakery & Food Business',
    title: 'De-Lekes Kitchen & Events',
    location: 'Surulere, Lagos',
    inputText:
      'Supplied 50 packs of party jollof and grilled chicken to Mrs. Adeleke for bridal shower. Total bill ₦125,000. She sent ₦85,000 transfer, balance ₦40,000 due Saturday. Spent ₦65,000 at market for ingredients.',
    output: {
      revenue: '₦125,000',
      cashCollected: '-₦65,000 (Market Run)',
      transferCollected: '₦85,000 (Moniepoint)',
      debtAmount: '₦40,000',
      debtorName: 'Mrs. Adeleke (Bridal Event)',
      debtDueDate: 'Due this Saturday',
      costBasis: '₦65,000 (Ingredients & spices)',
      profitEstimate: '+₦60,000',
      profitMargin: '48.0%',
      inventoryChange: '50 Meal Packs Completed & Dispatched',
    },
    weeklyChart: [
      { day: 'Mon', dayFull: 'Monday', revenue: 48000, cost: 24000, profit: 24000, cashCollected: 48000, debtAdded: 0, highlight: 'Office lunch bowls delivery' },
      { day: 'Tue', dayFull: 'Tuesday', revenue: 58000, cost: 29000, profit: 29000, cashCollected: 58000, debtAdded: 0, highlight: 'Corporate buffet catering' },
      { day: 'Wed', dayFull: 'Wednesday', revenue: 82000, cost: 42000, profit: 40000, cashCollected: 55000, debtAdded: 27000, highlight: 'Birthday party snack boxes & cake' },
      { day: 'Thu', dayFull: 'Thursday', revenue: 64000, cost: 31000, profit: 33000, cashCollected: 64000, debtAdded: 0, highlight: 'Executive seminar meal trays' },
      { day: 'Fri', dayFull: 'Friday', revenue: 175000, cost: 92000, profit: 83000, cashCollected: 125000, debtAdded: 50000, highlight: 'Bridal shower batch & market prep' },
      { day: 'Sat', dayFull: 'Saturday', revenue: 230000, cost: 118000, profit: 112000, cashCollected: 190000, debtAdded: 40000, highlight: 'Wedding reception 200 party packs' },
      { day: 'Sun', dayFull: 'Sunday', revenue: 75000, cost: 38000, profit: 37000, cashCollected: 75000, debtAdded: 0, highlight: 'Sunday family dinner packages' },
    ],
  },
  {
    id: 'trade',
    badge: 'Provisions & FMCG',
    category: 'Wholesale & Retail Depot',
    title: 'Alaba Rago Depot',
    location: 'Mile 12 / Alaba, Lagos',
    inputText:
      'Sold 10 cartons of Indomie Super Pack to Iya Basira for ₦125,000. She paid ₦80,000 cash from her purse and promises to transfer the ₦45,000 balance on Friday.',
    output: {
      revenue: '₦125,000',
      cashCollected: '₦80,000 (In Cash Drawer)',
      transferCollected: '₦0',
      debtAmount: '₦45,000',
      debtorName: 'Iya Basira',
      debtDueDate: 'Due this Friday',
      costBasis: '₦105,500 (₦10,550/ctn cost)',
      profitEstimate: '+₦19,500',
      profitMargin: '15.6%',
      inventoryChange: '-10 Cartons Indomie Super Pack',
    },
    weeklyChart: [
      { day: 'Mon', dayFull: 'Monday', revenue: 310000, cost: 262000, profit: 48000, cashCollected: 240000, debtAdded: 70000, highlight: 'Early morning wholesale depot rush' },
      { day: 'Tue', dayFull: 'Tuesday', revenue: 275000, cost: 234000, profit: 41000, cashCollected: 215000, debtAdded: 60000, highlight: 'Provisions restock & neighborhood kiosks' },
      { day: 'Wed', dayFull: 'Wednesday', revenue: 390000, cost: 331000, profit: 59000, cashCollected: 310000, debtAdded: 80000, highlight: 'Bulk cartons Indomie & Golden Penny' },
      { day: 'Thu', dayFull: 'Thursday', revenue: 340000, cost: 289000, profit: 51000, cashCollected: 260000, debtAdded: 80000, highlight: 'Retail store restock runs' },
      { day: 'Fri', dayFull: 'Friday', revenue: 470000, cost: 398000, profit: 72000, cashCollected: 380000, debtAdded: 90000, highlight: 'Pre-weekend market shopping frenzy' },
      { day: 'Sat', dayFull: 'Saturday', revenue: 520000, cost: 442000, profit: 78000, cashCollected: 450000, debtAdded: 70000, highlight: 'Peak Saturday commercial volume' },
      { day: 'Sun', dayFull: 'Sunday', revenue: 110000, cost: 93000, profit: 17000, cashCollected: 110000, debtAdded: 0, highlight: 'Short half-day closing & reconciliation' },
    ],
  },
  {
    id: 'services',
    badge: 'Gadgets & Repairs',
    category: 'Retail & Technical Services',
    title: 'Otigba Tech Hub',
    location: 'Computer Village, Ikeja',
    inputText:
      'Replaced iPhone 13 screen for Kenneth (₦65,000) and sold 1 Oraimo 27k Power Bank (₦32,000). Paid ₦97,000 in full via OPay. Screen part cost ₦42,000, power bank cost ₦24,000.',
    output: {
      revenue: '₦97,000',
      cashCollected: '₦0',
      transferCollected: '₦97,000 (OPay POS)',
      debtAmount: '₦0',
      debtorName: 'Kenneth (Settled in full)',
      debtDueDate: 'Fully Settled',
      costBasis: '₦66,000 (Parts & stock cost)',
      profitEstimate: '+₦31,000',
      profitMargin: '32.0%',
      inventoryChange: '-1 Screen Replacement Part, -1 Power Bank',
    },
    weeklyChart: [
      { day: 'Mon', dayFull: 'Monday', revenue: 92000, cost: 54000, profit: 38000, cashCollected: 92000, debtAdded: 0, highlight: 'Screen replacements & fast cables' },
      { day: 'Tue', dayFull: 'Tuesday', revenue: 78000, cost: 44000, profit: 34000, cashCollected: 62000, debtAdded: 16000, highlight: 'Laptop motherboard rework' },
      { day: 'Wed', dayFull: 'Wednesday', revenue: 135000, cost: 82000, profit: 53000, cashCollected: 115000, debtAdded: 20000, highlight: 'Corporate iPad screens & batteries' },
      { day: 'Thu', dayFull: 'Thursday', revenue: 88000, cost: 51000, profit: 37000, cashCollected: 88000, debtAdded: 0, highlight: 'Oraimo audio & powerbank sales' },
      { day: 'Fri', dayFull: 'Friday', revenue: 165000, cost: 96000, profit: 69000, cashCollected: 140000, debtAdded: 25000, highlight: 'Pre-weekend screen fixes' },
      { day: 'Sat', dayFull: 'Saturday', revenue: 198000, cost: 114000, profit: 84000, cashCollected: 180000, debtAdded: 18000, highlight: 'Heavy Computer Village foot traffic' },
      { day: 'Sun', dayFull: 'Sunday', revenue: 35000, cost: 14000, profit: 21000, cashCollected: 35000, debtAdded: 0, highlight: 'Emergency phone unlocks & chargers' },
    ],
  },
  {
    id: 'salon',
    badge: 'Salon & Beauty',
    category: 'Hair & Personal Care',
    title: 'Glow Haven Studio',
    location: 'Garki, Abuja',
    inputText:
      'Did knotless braids and organic hair treatment for Dr. Chidinma for ₦38,000. She paid ₦20,000 cash, will transfer ₦18,000 balance tonight. Hair extensions and hair oils cost ₦9,500.',
    output: {
      revenue: '₦38,000',
      cashCollected: '₦20,000 (Cash in Drawer)',
      transferCollected: '₦0',
      debtAmount: '₦18,000',
      debtorName: 'Dr. Chidinma',
      debtDueDate: 'Due Tonight',
      costBasis: '₦9,500 (Beauty supplies used)',
      profitEstimate: '+₦28,500',
      profitMargin: '75.0%',
      inventoryChange: 'Hair Service Completed & Products Used',
    },
    weeklyChart: [
      { day: 'Mon', dayFull: 'Monday', revenue: 28000, cost: 7000, profit: 21000, cashCollected: 28000, debtAdded: 0, highlight: 'Wig maintenance & treatments' },
      { day: 'Tue', dayFull: 'Tuesday', revenue: 36000, cost: 9000, profit: 27000, cashCollected: 36000, debtAdded: 0, highlight: 'Wash, steam & natural curl care' },
      { day: 'Wed', dayFull: 'Wednesday', revenue: 52000, cost: 13000, profit: 39000, cashCollected: 42000, debtAdded: 10000, highlight: 'Pedicure & organic body glow' },
      { day: 'Thu', dayFull: 'Thursday', revenue: 76000, cost: 19000, profit: 57000, cashCollected: 61000, debtAdded: 15000, highlight: 'Knotless braids appointments' },
      { day: 'Fri', dayFull: 'Friday', revenue: 142000, cost: 36000, profit: 106000, cashCollected: 120000, debtAdded: 22000, highlight: 'Bridal hair styling & makeup prep' },
      { day: 'Sat', dayFull: 'Saturday', revenue: 188000, cost: 46000, profit: 142000, cashCollected: 168000, debtAdded: 20000, highlight: 'Fully booked weekend styling chairs' },
      { day: 'Sun', dayFull: 'Sunday', revenue: 62000, cost: 15000, profit: 47000, cashCollected: 62000, debtAdded: 0, highlight: 'Sunday church crowd hair revamps' },
    ],
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterCode,
  onSignIn,
  onRequestAccess,
  theme = 'light',
  onToggleTheme,
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('fashion');
  const [isTypingSimulated, setIsTypingSimulated] = useState<boolean>(false);
  const [chartMetric, setChartMetric] = useState<'profit' | 'cashflow'>('profit');
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  const activeScenario =
    DEMO_SCENARIOS.find((s) => s.id === activeScenarioId) || DEMO_SCENARIOS[0];

  const handleScenarioChange = (id: string) => {
    setActiveScenarioId(id);
    setHoveredDayIndex(null);
    setIsTypingSimulated(true);
    setTimeout(() => setIsTypingSimulated(false), 250);
  };

  // Compute 7-day totals for the dynamic chart
  const weeklyTotals = activeScenario.weeklyChart.reduce(
    (acc, curr) => ({
      revenue: acc.revenue + curr.revenue,
      cost: acc.cost + curr.cost,
      profit: acc.profit + curr.profit,
      cash: acc.cash + curr.cashCollected,
      debt: acc.debt + curr.debtAdded,
    }),
    { revenue: 0, cost: 0, profit: 0, cash: 0, debt: 0 }
  );

  const profitMarginPercent = weeklyTotals.revenue > 0
    ? ((weeklyTotals.profit / weeklyTotals.revenue) * 100).toFixed(1)
    : '0.0';

  const maxRevenue = Math.max(...activeScenario.weeklyChart.map((d) => d.revenue));

  const activeDay = hoveredDayIndex !== null ? activeScenario.weeklyChart[hoveredDayIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080D17] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-200 dark:selection:bg-emerald-900/60 antialiased">
      {/* =========================================================================
          TOP NAVIGATION BAR (Clean, polished, just logo and name, no slogan)
         ========================================================================= */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/90 dark:bg-[#080D17]/90 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Identity: Karra Logo + Name */}
          <a href="#" className="flex items-center space-x-3 group focus:outline-none cursor-pointer">
            <KarraLogo size="md" variant="green-bg" className="group-hover:scale-105 transition-transform duration-200" />
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
              Karra
            </span>
          </a>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a
              href="#simulator"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Live Demo
            </a>
            <a
              href="#chart"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Live Chart
            </a>
            <a
              href="#philosophy"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Our Philosophy
            </a>
            <a
              href="#businesses"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Who It's For
            </a>
            <a
              href="#features"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Features
            </a>
            <a
              href="#testimonials"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Stories
            </a>
          </nav>

          {/* Navigation Action Buttons */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                title="Toggle light/dark theme"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onSignIn}
              className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white py-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all active:scale-95"
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={onEnterCode}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2.5 px-4 rounded-xl shadow-sm hover:shadow-md shadow-emerald-700/20 cursor-pointer transition-all active:scale-95"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Enter Code</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          HERO SECTION: Built for ALL Nigerian Small Businesses
         ========================================================================= */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Eyebrow Label */}
          <div className="inline-flex items-center space-x-2 text-xs font-bold tracking-wider uppercase text-emerald-700 dark:text-emerald-400 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>BUILT FOR NIGERIAN SMALL BUSINESSES & ENTERPRISES</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.12]">
            Run your business the way you talk.{' '}
            <span className="text-emerald-600 dark:text-emerald-400">
              Know your true profit
            </span>{' '}
            every single day.
          </h1>

          {/* Subtitle celebrating small businesses across all industries */}
          <p className="mt-5 sm:mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
            From fashion designers, caterers, and salons to retail stores, technicians, and trade depots. Record sales, client deposits, expenses, and debts in everyday language. Karra instantly computes your true profit and eliminates bookkeeping headaches.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={onEnterCode}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg shadow-emerald-700/25 transition-all cursor-pointer active:scale-95"
            >
              <Key className="w-4 h-4" />
              <span>Enter Invitation Code</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              type="button"
              onClick={onRequestAccess}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <span>Request Beta Access</span>
            </button>
          </div>

          {/* Sign In Escape Link */}
          <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Already have an active business account?{' '}
            <button
              type="button"
              onClick={onSignIn}
              className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Sign In directly &rarr;
            </button>
          </div>

          {/* =========================================================================
              THE REQUIRED PHILOSOPHY BANNER
             ========================================================================= */}
          <div id="philosophy" className="mt-12 sm:mt-16 max-w-3xl mx-auto">
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/30 dark:border-emerald-500/40 shadow-sm text-left relative overflow-hidden">
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                <span>Our Core Philosophy</span>
              </div>
              <blockquote className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug tracking-tight">
                &ldquo;As a business owner, you should not have to learn the software, rather let the software learn your business and operate it.&rdquo;
              </blockquote>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Whether you sell products, prepare food, design garments, repair devices, or deliver professional services—Karra adapts to your local units, remembers your costs, and keeps your debtor books audit-clean without complicated forms.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          WHO IT'S FOR: Nigerian Small Businesses Across Sectors
         ========================================================================= */}
      <section id="businesses" className="py-12 sm:py-16 bg-white dark:bg-[#0B111E] border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Universal Small Business Support
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Crafted for every kind of Nigerian enterprise.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              No matter what you sell or how you bill your clients, Karra understands your daily transaction flow.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="w-9 h-9 mx-auto rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-300 mb-2.5">
                <Scissors className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Fashion & Designers
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Track custom measurements, fabric expenses, deposits & balance on fittings.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="w-9 h-9 mx-auto rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-300 mb-2.5">
                <Utensils className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Food & Caterers
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Calculate real profits after market runs, party pack deliveries & event bookings.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="w-9 h-9 mx-auto rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-300 mb-2.5">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Shops & Merchandisers
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Manage stock turnover, carton-to-unit conversions & debtor recovery.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="w-9 h-9 mx-auto rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-700 dark:text-purple-300 mb-2.5">
                <Wrench className="w-4 h-4" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Services & Technicians
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Log service fees, parts replaced, diagnostic charges & customer balances.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE LIVE DEMO (The Centerpiece of Karra)
         ========================================================================= */}
      <section id="simulator" className="py-16 sm:py-20 bg-slate-50 dark:bg-[#080D17] border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Natural Language Bookkeeping
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
              Type or speak like you talk to an assistant.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Watch how Karra immediately turns everyday small business statements into structured, audit-ready numbers.
            </p>

            {/* Scenario Switcher Tabs */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {DEMO_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleScenarioChange(s.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeScenarioId === s.id
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/30 scale-105'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{s.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Card Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-[#101726] rounded-2xl p-5 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md">
            {/* Left: Input Simulated Business Note */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  <span>Voice Note or Daily Transaction</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeScenario.category}</span>
                </div>

                <div className={`p-5 rounded-xl bg-slate-50 dark:bg-[#162238] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm sm:text-base font-medium leading-relaxed shadow-xs transition-opacity duration-200 ${isTypingSimulated ? 'opacity-50' : 'opacity-100'}`}>
                  &ldquo;{activeScenario.inputText}&rdquo;
                </div>
              </div>

              {/* Automatic Capabilities List */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Auto-detects cash vs bank transfer vs customer balance due</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Accounts for materials, stock depletion, or job expenses</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Calculates actual gross and net profit margin automatically</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Creates debtor record with 1-click polite WhatsApp reminder</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onEnterCode}
                  className="w-full inline-flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Try this with your business workflow</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>

            {/* Right: Instant Engine Ledger Breakdown */}
            <div className="lg:col-span-7 bg-slate-50 dark:bg-[#162238] rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <KarraLogo size="sm" variant="green-bg" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Karra Ledger Parsing Engine
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {activeScenario.title} &bull; {activeScenario.location}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    Instant Ledger Event
                  </span>
                </div>

                {/* Grid of parsed financial metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mt-4">
                  {/* Revenue */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Total Bill / Revenue
                    </p>
                    <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {activeScenario.output.revenue}
                    </p>
                  </div>

                  {/* Cash or Transfers */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Payment Received
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                      {activeScenario.output.transferCollected !== '₦0'
                        ? activeScenario.output.transferCollected
                        : activeScenario.output.cashCollected}
                    </p>
                  </div>

                  {/* Debtor Balance */}
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                    <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">
                      Customer Balance Due
                    </p>
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300 mt-1">
                      {activeScenario.output.debtorName}
                    </p>
                    <p className="text-xs font-extrabold text-amber-800 dark:text-amber-300">
                      {activeScenario.output.debtAmount}
                    </p>
                  </div>

                  {/* Profit & Margin */}
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                    <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                      True Profit Made
                    </p>
                    <p className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 mt-0.5">
                      {activeScenario.output.profitEstimate}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {activeScenario.output.profitMargin} Net Margin
                    </p>
                  </div>

                  {/* Inventory / Job Status */}
                  <div className="col-span-2 p-3.5 rounded-xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Job, Materials or Stock Recorded
                    </p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                      {activeScenario.output.inventoryChange}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-3 flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  Ready to test with your own business?
                </span>
                <button
                  type="button"
                  onClick={onEnterCode}
                  className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center space-x-1 cursor-pointer"
                >
                  <span>Enter Code Now</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          DYNAMIC FINANCIAL PULSE & GROWTH CHART (New Interactive Section)
         ========================================================================= */}
      <section id="chart" className="py-16 sm:py-20 bg-white dark:bg-[#0B111E] border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span>DYNAMIC BUSINESS PULSE & CASHFLOW CHART</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Live weekly performance for: <span className="text-emerald-600 dark:text-emerald-400">{activeScenario.title}</span>
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Switch business sectors or click any day to see how revenue, material costs, and real profits evolve.
              </p>
            </div>

            {/* Metric Toggle: Profit vs Cashflow */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric('profit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMetric === 'profit'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Revenue & True Profit
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('cashflow')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMetric === 'cashflow'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Cash Collected vs Debts
              </button>
            </div>
          </div>

          {/* Quick Business Switcher inside chart container */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase mr-1">Sector:</span>
            {DEMO_SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleScenarioChange(s.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeScenarioId === s.id
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {s.badge}
              </button>
            ))}
          </div>

          {/* The Visual Chart Workbench Container */}
          <div className="bg-slate-50 dark:bg-[#101726] rounded-2xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Top 4 KPI Metrics computed live */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700/80">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">7-Day Total Revenue</p>
                <p className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  ₦{weeklyTotals.revenue.toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  Across 7 trading days
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700/80">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Supplies & Job Costs</p>
                <p className="text-base sm:text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">
                  ₦{weeklyTotals.cost.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Direct materials & supplies
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Real Net Profit</p>
                <p className="text-base sm:text-xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-0.5">
                  ₦{weeklyTotals.profit.toLocaleString()}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                  {profitMarginPercent}% Take-Home Margin
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80">
                <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">Uncollected Credit</p>
                <p className="text-base sm:text-xl font-extrabold text-amber-800 dark:text-amber-300 mt-0.5">
                  ₦{weeklyTotals.debt.toLocaleString()}
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                  Tracked in Debtor Ledger
                </p>
              </div>
            </div>

            {/* Interactive Bar Chart Canvas */}
            <div className="relative pt-6 pb-2">
              {/* Chart Legend */}
              <div className="flex items-center justify-end space-x-4 text-xs font-semibold mb-4">
                {chartMetric === 'profit' ? (
                  <>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 rounded-xs bg-emerald-500" />
                      <span className="text-slate-700 dark:text-slate-300">True Profit</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 rounded-xs bg-slate-300 dark:bg-slate-700" />
                      <span className="text-slate-500 dark:text-slate-400">Direct Cost Basis</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 rounded-xs bg-emerald-500" />
                      <span className="text-slate-700 dark:text-slate-300">Cash / Bank Received</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 rounded-xs bg-amber-500" />
                      <span className="text-slate-700 dark:text-slate-300">Customer Credit Pending</span>
                    </div>
                  </>
                )}
              </div>

              {/* Responsive Bar Grid */}
              <div className="h-56 sm:h-64 flex items-end justify-between gap-2 sm:gap-4 pt-4 px-2 border-b border-slate-200 dark:border-slate-700/80">
                {activeScenario.weeklyChart.map((item, idx) => {
                  const isHovered = hoveredDayIndex === idx;
                  const totalForDay = chartMetric === 'profit' ? item.revenue : (item.cashCollected + item.debtAdded);
                  const heightPercent = maxRevenue > 0 ? Math.min(100, Math.max(14, Math.round((totalForDay / maxRevenue) * 100))) : 20;

                  const primaryHeightPct = totalForDay > 0
                    ? Math.round(((chartMetric === 'profit' ? item.profit : item.cashCollected) / totalForDay) * 100)
                    : 50;

                  return (
                    <div
                      key={item.day}
                      onMouseEnter={() => setHoveredDayIndex(idx)}
                      onMouseLeave={() => setHoveredDayIndex(null)}
                      onClick={() => setHoveredDayIndex(idx)}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                    >
                      {/* Bar Pillar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[54px] rounded-t-lg transition-all duration-300 flex flex-col justify-end overflow-hidden ${
                          isHovered
                            ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-md scale-102'
                            : 'hover:opacity-90'
                        }`}
                      >
                        {chartMetric === 'profit' ? (
                          <>
                            {/* Cost basis portion */}
                            <div
                              style={{ height: `${100 - primaryHeightPct}%` }}
                              className="w-full bg-slate-300 dark:bg-slate-700/90 transition-colors"
                              title={`Cost: ₦${item.cost.toLocaleString()}`}
                            />
                            {/* Net Profit portion */}
                            <div
                              style={{ height: `${primaryHeightPct}%` }}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 transition-colors"
                              title={`Profit: ₦${item.profit.toLocaleString()}`}
                            />
                          </>
                        ) : (
                          <>
                            {/* Debt portion */}
                            <div
                              style={{ height: `${100 - primaryHeightPct}%` }}
                              className="w-full bg-amber-400 dark:bg-amber-500 transition-colors"
                              title={`Debt: ₦${item.debtAdded.toLocaleString()}`}
                            />
                            {/* Cash portion */}
                            <div
                              style={{ height: `${primaryHeightPct}%` }}
                              className="w-full bg-emerald-500 hover:bg-emerald-600 transition-colors"
                              title={`Cash: ₦${item.cashCollected.toLocaleString()}`}
                            />
                          </>
                        )}
                      </div>

                      {/* Day Label */}
                      <span className={`text-[11px] sm:text-xs font-bold mt-2.5 transition-colors ${
                        isHovered
                          ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Hover Details Card (Dynamic Interactive Inspector) */}
              <div className="mt-5 p-4 rounded-xl bg-white dark:bg-[#162238] border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                {activeDay ? (
                  <>
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {activeDay.dayFull} Breakdown
                        </span>
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full font-bold">
                          {activeDay.highlight}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Day's trading metrics recorded in natural language
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Revenue</span>
                        <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                          ₦{activeDay.revenue.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Cost Basis</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm">
                          ₦{activeDay.cost.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase font-bold">True Profit</span>
                        <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                          +₦{activeDay.profit.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-amber-600 dark:text-amber-400 block text-[10px] uppercase font-bold">Credit Due</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-sm">
                          ₦{activeDay.debtAdded.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 py-0.5">
                    <span className="inline-flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                      <span>Hover over or tap any day bar above to inspect specific daily earnings, expenses, and customer credit.</span>
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                      Auto-computed from daily entries &rarr;
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          KEY CAPABILITIES (Features built specifically for Nigerian small businesses)
         ========================================================================= */}
      <section id="features" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Engineered For Nigerian Small Businesses
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
            Everything your business needs to stay profitable, organized, and credit-ready.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            No complex formulas, no accountant jargon, and no confusing spreadsheets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Natural Language */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Natural Language Bookkeeping
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Type or speak freely. Karra extracts quantities, job terms, material costs, payment modes, and customer credit without rigid forms.
            </p>
          </div>

          {/* Card 2: Autonomous Customer & Debtor Ledger */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Autonomous Customer & Debtor Ledger
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Know every single client who owes you money or has an advance balance. View aging balances and generate polite WhatsApp reminder templates with 1 click.
            </p>
          </div>

          {/* Card 3: True Margins & Job Economics */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              True Unit Economics & Job Margins
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Stop guessing whether busy days mean true profit. Karra deducts supply and material costs to show your real take-home profit immediately.
            </p>
          </div>

          {/* Card 4: Daily Closing Summaries */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-4">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Audit-Ready Daily & Monthly Cards
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Export high-resolution PNG & PDF financial summaries. Perfect for reviewing closing numbers, business partners, loan applications, and bankers.
            </p>
          </div>

          {/* Card 5: Split Cash & Transfers */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Split Cash, Bank & POS Reconciliations
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Nigerian commerce is messy: part transfer via OPay or Moniepoint, part cash in pocket, part balance due later. Karra splits each leg cleanly to the kobo.
            </p>
          </div>

          {/* Card 6: Offline-First */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Offline-First & Cloud Synced
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Market network down or power cut? No problem. Continue logging offline. The second connection restores, your cloud ledger syncs automatically.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          HOW IT WORKS (Simple, clear 3-step workflow)
         ========================================================================= */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-white dark:bg-[#0B111E] border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Simple 3-Step Workflow
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
              How Karra fits seamlessly into your daily business.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold text-base flex items-center justify-center shadow-md shadow-emerald-700/30 mb-5">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Log Transactions Naturally
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Type or speak income, job deposits, supply runs, and business expenses as they happen throughout your day.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold text-base flex items-center justify-center shadow-md shadow-emerald-700/30 mb-5">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Autonomous Ledger Balancing
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Karra parses figures, routes cash vs bank transfers, logs material costs, and updates debtor records in real time.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-extrabold text-base flex items-center justify-center shadow-md shadow-emerald-700/30 mb-5">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Total Daily Clarity
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Review your daily summary card at close of business. Know your cash in hand, bank transfers, and true net margin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          NIGERIAN BUSINESS STORIES (Authentic social proof from real sectors)
         ========================================================================= */}
      <section id="testimonials" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Real Nigerian Business Stories
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
            Trusted by entrepreneurs across Nigeria.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
              &ldquo;Managing client fabric costs, advance deposits, and balances due on final fittings used to be scattered in random notebooks. Now Karra tracks every client's balance and sends polite WhatsApp reminders.&rdquo;
            </p>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Amaka Eze
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Fashion Designer & Atelier Owner, Ikeja
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
              &ldquo;When catering events, tracking ingredient purchases against installment bank transfers was a nightmare. Karra shows me my exact profit before I even deliver the food.&rdquo;
            </p>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Mrs. Folashade Adeleke
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bakery & Event Catering, Surulere
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
              &ldquo;Before Karra, tracking which customer paid part cash and owed the rest was giving me sleepless nights. Now I speak the sale into my phone and our customer credit list is always 100% accurate.&rdquo;
            </p>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Alhaji Musa S.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Wholesale & Provisions Merchant, Alaba Market
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          BOTTOM INVITATION CTA
         ========================================================================= */}
      <section className="py-16 sm:py-20 bg-emerald-800 dark:bg-emerald-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
            <Key className="w-6 h-6 text-emerald-200" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready for software that speaks the language of your business?
          </h2>
          <p className="mt-3.5 text-sm sm:text-base text-emerald-100 max-w-xl mx-auto leading-relaxed">
            Enter your invitation code to access the private beta and activate your business ledger today.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              type="button"
              onClick={onEnterCode}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-7 py-3.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-sm shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Key className="w-4 h-4 text-emerald-700" />
              <span>Enter Invitation Code</span>
              <ArrowRight className="w-4 h-4 text-emerald-700 ml-1" />
            </button>

            <button
              type="button"
              onClick={onSignIn}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-950 text-white font-semibold text-sm border border-emerald-500/40 transition-all cursor-pointer active:scale-95"
            >
              Sign In to Workspace
            </button>
          </div>

          <div className="mt-5 text-xs text-emerald-200/90">
            Don't have an invitation code yet?{' '}
            <button
              type="button"
              onClick={onRequestAccess}
              className="font-bold text-white underline cursor-pointer"
            >
              Request Access Here
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SITE FOOTER
         ========================================================================= */}
      <footer className="w-full py-8 bg-white dark:bg-[#070B14] border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <KarraLogo size="sm" variant="green-bg" />
            <span className="font-extrabold text-slate-900 dark:text-white">Karra</span>
            <span>&bull;</span>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Your Business, Understood</span>
          </div>

          <div className="flex items-center space-x-5">
            <button
              type="button"
              onClick={onEnterCode}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Enter Code
            </button>
            <button
              type="button"
              onClick={onSignIn}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onRequestAccess}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Request Access
            </button>
          </div>

          <div className="text-slate-400 text-[11px]">
            Lagos &bull; Abuja &bull; Port Harcourt &bull; Kano &bull; &copy; {new Date().getFullYear()} Karra
          </div>
        </div>
      </footer>
    </div>
  );
};
