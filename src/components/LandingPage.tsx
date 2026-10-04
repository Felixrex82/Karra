import React from 'react';
import {
  ArrowRight,
  Key,
  MessageSquare,
  TrendingUp,
  Users,
  Receipt,
  Sun,
  Moon,
} from 'lucide-react';
import { KarraLogo } from './KarraLogo';
import { HeroTransformationDemo } from './landing/HeroTransformationDemo';
import { HowKarraWorksAnimated } from './landing/HowKarraWorksAnimated';
import { DashboardPreviewMockup } from './landing/DashboardPreviewMockup';
import { FinancialMathExplainer } from './landing/FinancialMathExplainer';
import { useInView } from './landing/useInView';
import { usePrefersReducedMotion } from './landing/usePrefersReducedMotion';

interface LandingPageProps {
  onEnterCode: () => void;
  onSignIn: () => void;
  onSignUp?: () => void;
  onRequestAccess: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterCode,
  onSignIn,
  onRequestAccess,
  theme = 'light',
  onToggleTheme,
}) => {
  const prefersReduced = usePrefersReducedMotion();
  const { ref: featuresRef, isInView: isFeaturesInView } = useInView({ threshold: 0.15 });
  const { ref: storiesRef, isInView: isStoriesInView } = useInView({ threshold: 0.15 });

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

          {/* Clean Quick Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a
              href="#how-it-works"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              How It Works
            </a>
            <a
              href="#preview"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Workspace Preview
            </a>
            <a
              href="#financials"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Financial Engine
            </a>
            <a
              href="#features"
              className="px-3 py-2 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
            >
              Features
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
          1. HERO SECTION: Built for Nigerian Businesses + Transformation Demo
         ========================================================================= */}
      <section className="relative pt-12 pb-14 sm:pt-16 sm:pb-20 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Eyebrow Label */}
          <div className="inline-flex items-center space-x-2 text-xs font-bold tracking-wider uppercase text-emerald-700 dark:text-emerald-400 mb-3.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>BUILT FOR NIGERIAN BUSINESSES</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.12]">
            Run your business the way you talk.{' '}
            <span className="text-emerald-600 dark:text-emerald-400">
              Know your true profit
            </span>{' '}
            every single day.
          </h1>

          {/* Concise Subtitle */}
          <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Record sales, client deposits, expenses, and customer credit in everyday speech. Karra computes your take-home profit and eliminates bookkeeping guesswork.
          </p>

          {/* Action Buttons */}
          <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={onEnterCode}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg shadow-emerald-700/25 transition-all cursor-pointer active:scale-95"
            >
              <Key className="w-4 h-4" />
              <span>Enter Invitation Code</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              type="button"
              onClick={onRequestAccess}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <span>Request Beta Access</span>
            </button>
          </div>

          {/* Sign In Escape Link */}
          <div className="mt-3.5 text-xs text-slate-500 dark:text-slate-400">
            Already have an active business account?{' '}
            <button
              type="button"
              onClick={onSignIn}
              className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Sign In directly &rarr;
            </button>
          </div>

          {/* HERO ANIMATION: Realistic Natural Language Transformation Demo */}
          <HeroTransformationDemo />

          {/* CORE PHILOSOPHY QUOTE */}
          <div id="philosophy" className="mt-8 max-w-2xl mx-auto text-center px-4">
            <blockquote className="text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300 italic leading-snug">
              &ldquo;As a business owner, you should not have to learn the software — rather let the software learn your business and operate it.&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. HOW KARRA WORKS (Sequential 4-Stage Workflow Animation)
         ========================================================================= */}
      <section id="how-it-works" className="py-14 sm:py-20 bg-white dark:bg-[#0B111E] border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              The 4-Stage Process
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              How Karra understands what happened.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Natural language becomes structured business data in seconds.
            </p>
          </div>

          <HowKarraWorksAnimated />
        </div>
      </section>

      {/* =========================================================================
          3. PRODUCT DASHBOARD PREVIEW (Subtle Viewport-Triggered Entrance)
         ========================================================================= */}
      <div id="preview">
        <DashboardPreviewMockup />
      </div>

      {/* =========================================================================
          5. FINANCIAL REPORTING & ANALYTICS (Subtle Data-Building Math Animation)
         ========================================================================= */}
      <section id="financials" className="py-14 sm:py-20 bg-slate-50 dark:bg-[#080D17] border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Financial Reporting
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              From raw sales to actual profit.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Karra separates top-line revenue from material costs and operational expenses so you know what is truly yours.
            </p>
          </div>

          <FinancialMathExplainer />
        </div>
      </section>

      {/* =========================================================================
          6. FEATURE CARDS (4 Sleek Cards with Small Staggered Scroll-Reveal)
         ========================================================================= */}
      <section id="features" className="py-14 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Purpose-Built For Commerce
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            Everything you need. Nothing you don't.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Built for Nigerian transactions: split payments, debtor reminders, and real margins.
          </p>
        </div>

        <div ref={featuresRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: 0ms */}
          <div
            style={{ transitionDelay: prefersReduced ? '0ms' : '0ms' }}
            className={`p-5 rounded-2xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-500 ${
              isFeaturesInView || prefersReduced ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3.5">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Natural Language Input
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Type or speak what happened. Karra identifies quantities, items, payment channels, and balances due.
            </p>
          </div>

          {/* Card 2: 80ms */}
          <div
            style={{ transitionDelay: prefersReduced ? '0ms' : '80ms' }}
            className={`p-5 rounded-2xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-500 ${
              isFeaturesInView || prefersReduced ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3.5">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Debtor & Credit Ledger
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Never forget who owes you. View balances due and generate polite 1-click WhatsApp payment reminders.
            </p>
          </div>

          {/* Card 3: 160ms */}
          <div
            style={{ transitionDelay: prefersReduced ? '0ms' : '160ms' }}
            className={`p-5 rounded-2xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-500 ${
              isFeaturesInView || prefersReduced ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3.5">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              True Net Margin
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Automatically subtract supply costs and job expenses to see actual take-home profit on every sale.
            </p>
          </div>

          {/* Card 4: 240ms */}
          <div
            style={{ transitionDelay: prefersReduced ? '0ms' : '240ms' }}
            className={`p-5 rounded-2xl bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-500 ${
              isFeaturesInView || prefersReduced ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3.5">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Split Cash & Transfers
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Handles mixed payments seamlessly: part bank transfer, part cash in drawer, part balance due later.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. AUTHENTIC EXPERIENCES (Concise Social Proof)
         ========================================================================= */}
      <section className="py-14 sm:py-18 bg-white dark:bg-[#0B111E] border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Trusted Across Nigeria
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              Built for real commercial workflows.
            </h2>
          </div>

          <div ref={storiesRef} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div
              style={{ transitionDelay: prefersReduced ? '0ms' : '0ms' }}
              className={`p-5 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-500 ${
                isStoriesInView || prefersReduced ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                &ldquo;Managing client fabric costs, deposits, and balances due on final fittings used to be scattered across notebooks. Karra keeps every customer account clear.&rdquo;
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Amaka E.</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Fashion Studio, Ikeja</p>
              </div>
            </div>

            <div
              style={{ transitionDelay: prefersReduced ? '0ms' : '80ms' }}
              className={`p-5 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-500 ${
                isStoriesInView || prefersReduced ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                &ldquo;When catering events, tracking ingredient purchases against installment bank transfers was stressful. Now I see my actual margin before delivery.&rdquo;
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Mrs. Folashade A.</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Catering & Events, Surulere</p>
              </div>
            </div>

            <div
              style={{ transitionDelay: prefersReduced ? '0ms' : '160ms' }}
              className={`p-5 rounded-2xl bg-slate-50 dark:bg-[#101726] border border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-all duration-500 ${
                isStoriesInView || prefersReduced ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                &ldquo;Tracking which customer paid part cash and owed the rest was giving me headaches. Now I speak the sale into my phone and credit records stay accurate.&rdquo;
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Alhaji Musa S.</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Provisions Depot, Alaba</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. FINAL CTA (Subtle Professional Ambient Gradient Shift, Calm)
         ========================================================================= */}
      <section className="py-14 sm:py-18 bg-gradient-to-r from-emerald-800 via-emerald-900 to-emerald-800 dark:from-emerald-900 dark:via-emerald-950 dark:to-emerald-900 animate-subtle-gradient text-white relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3.5">
            <Key className="w-5 h-5 text-emerald-200" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ready for software that speaks the language of your business?
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-emerald-100 max-w-lg mx-auto leading-relaxed">
            Enter your invitation code to access the private beta and activate your business ledger.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
            <button
              type="button"
              onClick={onEnterCode}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-xs shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Key className="w-3.5 h-3.5 text-emerald-700" />
              <span>Enter Invitation Code</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-700 ml-0.5" />
            </button>

            <button
              type="button"
              onClick={onSignIn}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-950 text-white font-semibold text-xs border border-emerald-500/40 transition-all cursor-pointer active:scale-95"
            >
              Sign In to Workspace
            </button>
          </div>

          <div className="mt-4 text-[11px] text-emerald-200/90">
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
      <footer className="w-full py-6 bg-white dark:bg-[#070B14] border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <KarraLogo size="sm" variant="green-bg" />
            <span className="font-extrabold text-slate-900 dark:text-white">Karra</span>
            <span>&bull;</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Your Business, Understood</span>
          </div>

          <div className="flex items-center space-x-4">
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
            &copy; {new Date().getFullYear()} Karra
          </div>
        </div>
      </footer>
    </div>
  );
};
