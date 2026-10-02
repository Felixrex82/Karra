import React, { useState, useMemo } from 'react';
import {
  Activity,
  Filter,
  Search,
  Receipt,
  Sparkles,
  ShoppingBag,
  UserCheck,
  UserPlus,
  Clock,
  Building2,
  Calendar,
  Eye,
  Layers,
} from 'lucide-react';
import { AdminEventRecord, AdminUserRecord } from './adminTypes';

interface AdminActivityTabProps {
  events: AdminEventRecord[];
  users: AdminUserRecord[];
  onSelectUser: (user: AdminUserRecord) => void;
}

export const AdminActivityTab: React.FC<AdminActivityTabProps> = ({
  events,
  users,
  onSelectUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const formatEventBadge = (eventName: string) => {
    switch (eventName) {
      case 'sale_recorded':
        return { label: 'Sale', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-800/60' };
      case 'expense_recorded':
        return { label: 'Expense', color: 'text-amber-400 bg-amber-950/80 border-amber-800/60' };
      case 'stock_updated':
        return { label: 'Stock', color: 'text-sky-400 bg-sky-950/80 border-sky-800/60' };
      case 'customer_added':
        return { label: 'Customer', color: 'text-cyan-400 bg-cyan-950/80 border-cyan-800/60' };
      case 'debt_recorded':
      case 'debt_updated':
        return { label: 'Debt', color: 'text-rose-400 bg-rose-950/80 border-rose-800/60' };
      case 'ai_query':
      case 'ai_interaction':
      case 'conversational_question':
        return { label: 'AI Query', color: 'text-teal-400 bg-teal-950/80 border-teal-800/60' };
      case 'user_registered':
        return { label: 'Signup', color: 'text-purple-400 bg-purple-950/80 border-purple-800/60' };
      case 'user_login':
        return { label: 'Login', color: 'text-indigo-400 bg-indigo-950/80 border-indigo-800/60' };
      case 'feedback_submitted':
        return { label: 'Feedback', color: 'text-pink-400 bg-pink-950/80 border-pink-800/60' };
      case 'beta_access_requested':
        return { label: 'Waitlist', color: 'text-yellow-400 bg-yellow-950/80 border-yellow-800/60' };
      default:
        return { label: eventName.replace(/_/g, ' '), color: 'text-slate-300 bg-slate-900 border-slate-700' };
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const mBusiness = (ev.businessName || '').toLowerCase().includes(q);
        const mEmail = (ev.userEmail || '').toLowerCase().includes(q);
        const mEvent = ev.eventName.toLowerCase().includes(q);
        if (!mBusiness && !mEmail && !mEvent) return false;
      }

      if (eventTypeFilter !== 'all') {
        if (eventTypeFilter === 'transaction') {
          if (!['sale_recorded', 'expense_recorded', 'stock_updated', 'transaction_created', 'debt_recorded'].includes(ev.eventName)) return false;
        } else if (eventTypeFilter === 'ai') {
          if (!['ai_query', 'ai_interaction', 'ai_interpret', 'conversational_question'].includes(ev.eventName)) return false;
        } else if (eventTypeFilter === 'auth') {
          if (!['user_registered', 'user_login', 'beta_invite_redeemed'].includes(ev.eventName)) return false;
        } else if (ev.eventName !== eventTypeFilter) {
          return false;
        }
      }

      return true;
    });
  }, [events, searchTerm, eventTypeFilter]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search activity by business, email, or event type..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Event Types</option>
            <option value="transaction">Transactions (Sales, Expenses, Stock)</option>
            <option value="ai">AI Interactions</option>
            <option value="auth">Sign-ups & Logins</option>
            <option value="sale_recorded">Sales Only</option>
            <option value="expense_recorded">Expenses Only</option>
            <option value="feedback_submitted">Feedback Submissions</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-400 focus:outline-none"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

      {/* Main Activity Table */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        {events.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-300">No activity yet</h3>
            <p className="text-xs text-slate-500 mt-1">Actions performed by merchants will populate this log.</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center">
            <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-300">No events match your filter</h3>
            <p className="text-xs text-slate-500 mt-1">Try clearing your search term or selecting All Event Types.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-3">Business / User</th>
                  <th className="py-3.5 px-3">Details / Metadata</th>
                  <th className="py-3.5 px-3">Timestamp</th>
                  <th className="py-3.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedEvents.map((ev) => {
                  const badge = formatEventBadge(ev.eventName);
                  const matchingUser = users.find((u) => u.userId === ev.userId);

                  return (
                    <tr
                      key={ev.id}
                      onClick={() => {
                        if (matchingUser) onSelectUser(matchingUser);
                      }}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        matchingUser ? 'cursor-pointer group' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <p className="font-bold text-white text-xs truncate group-hover:text-emerald-300 transition-colors">
                          {ev.businessName || matchingUser?.businessName || 'Business Account'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{ev.userEmail || matchingUser?.email || ev.userId}</p>
                      </td>

                      <td className="py-3.5 px-3 text-slate-300 max-w-sm truncate text-[11px]">
                        {ev.metadata && Object.keys(ev.metadata).length > 0 ? (
                          <span>
                            {ev.metadata.amount ? `Amount: ₦${Number(ev.metadata.amount).toLocaleString()}` : ''}
                            {ev.metadata.feature ? `Feature: ${ev.metadata.feature}` : ''}
                            {ev.metadata.type ? `Type: ${ev.metadata.type}` : ''}
                            {!ev.metadata.amount && !ev.metadata.feature && !ev.metadata.type
                              ? JSON.stringify(ev.metadata)
                              : ''}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(ev.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {matchingUser && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors"
                          >
                            <span>Profile</span>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredEvents.length > 0 && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(currentPage * pageSize, filteredEvents.length)}
              </span>{' '}
              of <span className="font-semibold text-white">{filteredEvents.length}</span> events
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-medium text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
