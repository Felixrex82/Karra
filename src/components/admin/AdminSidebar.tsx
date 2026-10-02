import React from 'react';
import {
  LayoutDashboard,
  Users,
  Activity,
  LineChart,
  MessageSquare,
  Ticket,
  Settings,
  ArrowLeft,
  ShieldCheck,
  X,
} from 'lucide-react';
import { KarraLogo } from '../KarraLogo';

export type AdminTab = 'overview' | 'users' | 'activity' | 'analytics' | 'feedback' | 'beta' | 'settings';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  onExitAdmin: () => void;
  openFeedbackCount?: number;
  pendingRequestsCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  founderEmail?: string;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  onExitAdmin,
  openFeedbackCount = 0,
  pendingRequestsCount = 0,
  isOpenMobile = false,
  onCloseMobile,
  founderEmail = 'olamidefelix54@gmail.com',
}) => {
  const navItems = [
    {
      id: 'overview' as AdminTab,
      label: 'Overview',
      icon: LayoutDashboard,
      description: 'High-level business pulse',
    },
    {
      id: 'users' as AdminTab,
      label: 'Users',
      icon: Users,
      description: 'Registered businesses & accounts',
    },
    {
      id: 'activity' as AdminTab,
      label: 'Activity',
      icon: Activity,
      description: 'Daily usage & event log',
    },
    {
      id: 'analytics' as AdminTab,
      label: 'Analytics',
      icon: LineChart,
      description: 'Acquisition, activation & funnel',
    },
    {
      id: 'feedback' as AdminTab,
      label: 'Feedback',
      icon: MessageSquare,
      badge: openFeedbackCount > 0 ? openFeedbackCount : undefined,
      description: 'User problem reports & requests',
    },
    {
      id: 'beta' as AdminTab,
      label: 'Beta',
      icon: Ticket,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
      description: 'Invitations & waitlist approval',
    },
    {
      id: 'settings' as AdminTab,
      label: 'Settings',
      icon: Settings,
      description: 'System health & data export',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#090D16] border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <KarraLogo size="sm" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-tight text-white">Karra</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-950/90 text-emerald-400 border border-emerald-800/70">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Founder Command Center</p>
            </div>
          </div>

          {/* Mobile Close Button */}
          {isOpenMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer group ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Area */}
        <div className="p-3 border-t border-slate-800/80 space-y-2 bg-[#080C14]">
          {/* Founder Identity Badge */}
          <div className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-center space-x-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-slate-200 truncate">Founder Session</p>
              <p className="text-[10px] text-slate-400 truncate">{founderEmail}</p>
            </div>
          </div>

          {/* Quick Exit to Merchant Store */}
          <button
            onClick={onExitAdmin}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Go to Merchant Store</span>
          </button>
        </div>
      </aside>
    </>
  );
};
