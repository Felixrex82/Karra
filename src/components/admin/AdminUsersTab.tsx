import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Users,
  Building2,
  Calendar,
  Clock,
  Receipt,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown,
  Eye,
} from 'lucide-react';
import { AdminUserRecord } from './adminTypes';

interface AdminUsersTabProps {
  users: AdminUserRecord[];
  onSelectUser: (user: AdminUserRecord) => void;
  onRefresh: () => void;
}

type SortField = 'joinedAt' | 'lastActiveAt' | 'transactions' | 'aiUses' | 'businessName';
type SortOrder = 'asc' | 'desc';

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  onSelectUser,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [betaFilter, setBetaFilter] = useState<'all' | 'active' | 'suspended' | 'revoked'>('all');
  const [sortField, setSortField] = useState<SortField>('lastActiveAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        // Search term filter
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchBusiness = (u.businessName || '').toLowerCase().includes(q);
          const matchEmail = (u.email || '').toLowerCase().includes(q);
          const matchOwner = (u.ownerName || '').toLowerCase().includes(q);
          const matchUid = (u.userId || '').toLowerCase().includes(q);
          if (!matchBusiness && !matchEmail && !matchOwner && !matchUid) return false;
        }

        // Account Status filter
        if (statusFilter !== 'all') {
          if (u.status !== statusFilter) return false;
        }

        // Beta Status filter
        if (betaFilter !== 'all') {
          if (u.betaStatus !== betaFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortField) {
          case 'businessName':
            valA = (a.businessName || '').toLowerCase();
            valB = (b.businessName || '').toLowerCase();
            return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case 'joinedAt':
            valA = new Date(a.joinedAt || 0).getTime();
            valB = new Date(b.joinedAt || 0).getTime();
            break;
          case 'lastActiveAt':
            valA = new Date(a.lastActiveAt || a.joinedAt || 0).getTime();
            valB = new Date(b.lastActiveAt || b.joinedAt || 0).getTime();
            break;
          case 'transactions':
            valA = a.totalTransactions || 0;
            valB = b.totalTransactions || 0;
            break;
          case 'aiUses':
            valA = a.aiInteractionsCount || 0;
            valB = b.aiInteractionsCount || 0;
            break;
        }

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
  }, [users, searchTerm, statusFilter, betaFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter & Search Controls */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search business, email, owner, or user ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span className="text-[11px] font-medium hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Beta Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span className="text-[11px] font-medium hidden sm:inline">Beta:</span>
            <select
              value={betaFilter}
              onChange={(e) => {
                setBetaFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Beta Access</option>
              <option value="active">Active Beta</option>
              <option value="suspended">Suspended</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>

          {/* Page Size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-400 focus:outline-none"
          >
            <option value={15}>15 per page</option>
            <option value={30}>30 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </div>

      {/* Main Operational Table */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        {users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-300">No users yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              Registered merchant accounts will automatically display in this operational table.
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center">
            <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-300">No users match your filters</h3>
            <p className="text-xs text-slate-500 mt-1">Try broadening your search term or adjusting status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 cursor-pointer" onClick={() => toggleSort('businessName')}>
                    <div className="flex items-center space-x-1">
                      <span>Business / User</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 cursor-pointer" onClick={() => toggleSort('joinedAt')}>
                    <div className="flex items-center space-x-1">
                      <span>Joined</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 cursor-pointer" onClick={() => toggleSort('lastActiveAt')}>
                    <div className="flex items-center space-x-1">
                      <span>Last Active</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 cursor-pointer text-center" onClick={() => toggleSort('transactions')}>
                    <div className="flex items-center justify-center space-x-1">
                      <span>Transactions</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 cursor-pointer text-center" onClick={() => toggleSort('aiUses')}>
                    <div className="flex items-center justify-center space-x-1">
                      <span>AI Uses</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Beta Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedUsers.map((u) => {
                  const isAccountActive = u.status === 'active';
                  const isBetaActive = u.betaStatus === 'active';

                  return (
                    <tr
                      key={u.userId}
                      onClick={() => onSelectUser(u)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Business & User Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0 group-hover:border-emerald-500/50 transition-colors">
                            <Building2 className="w-4 h-4 text-slate-300 group-hover:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-xs truncate group-hover:text-emerald-300 transition-colors">
                              {u.businessName || 'Business Account'}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{u.email || u.userId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-3 text-slate-300 whitespace-nowrap">
                        {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-3 text-slate-300 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {u.lastActiveAt
                              ? new Date(u.lastActiveAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Total Transactions */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            u.totalTransactions > 0
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'text-slate-500'
                          }`}
                        >
                          {u.totalTransactions}
                        </span>
                      </td>

                      {/* AI Interactions */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            u.aiInteractionsCount > 0
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                              : 'text-slate-500'
                          }`}
                        >
                          {u.aiInteractionsCount}
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isAccountActive
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                              : u.status === 'suspended'
                              ? 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      {/* Beta Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isBetaActive
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                              : u.betaStatus === 'revoked'
                              ? 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isBetaActive ? <ShieldCheck className="w-2.5 h-2.5" /> : <ShieldAlert className="w-2.5 h-2.5" />}
                          <span>{u.betaStatus}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors"
                        >
                          <span>Inspect</span>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredUsers.length > 0 && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(currentPage * pageSize, filteredUsers.length)}
              </span>{' '}
              of <span className="font-semibold text-white">{filteredUsers.length}</span> businesses
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
