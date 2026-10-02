import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  Clock,
  Filter,
  ExternalLink,
  Building2,
  Mail,
} from 'lucide-react';
import { BetaFeedbackItem, BetaFeedbackType } from '../../types';

interface AdminFeedbackTabProps {
  feedbackList: BetaFeedbackItem[];
  onUpdateFeedbackStatus: (id: string, status: 'open' | 'reviewed' | 'resolved') => Promise<void>;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AdminFeedbackTab: React.FC<AdminFeedbackTabProps> = ({
  feedbackList,
  onUpdateFeedbackStatus,
  onShowToast,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return feedbackList.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterStatus !== 'all' && (item.status || 'open') !== filterStatus) return false;
      return true;
    });
  }, [feedbackList, filterType, filterStatus]);

  const handleStatusChange = async (id: string, newStatus: 'open' | 'reviewed' | 'resolved') => {
    setUpdatingId(id);
    try {
      await onUpdateFeedbackStatus(id, newStatus);
      if (onShowToast) onShowToast(`Feedback marked as ${newStatus}`, 'success');
    } catch {
      if (onShowToast) onShowToast('Failed to update status', 'warning');
    } finally {
      setUpdatingId(null);
    }
  };

  const getTypeBadge = (type: BetaFeedbackType | string) => {
    switch (type) {
      case 'bug':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <Bug className="w-3 h-3" />
            Bug Report
          </span>
        );
      case 'missing_feature':
      case 'feature':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-950/80 text-purple-300 border border-purple-800/60">
            <Lightbulb className="w-3 h-3" />
            Feature Request
          </span>
        );
      case 'confusing':
      case 'usability':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800/60">
            <Sparkles className="w-3 h-3" />
            Confusing / UI
          </span>
        );
      case 'wrong_calculation':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-950/80 text-yellow-300 border border-yellow-800/60">
            <HelpCircle className="w-3 h-3" />
            Calculation Issue
          </span>
        );
      case 'ai_problem':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-950/80 text-teal-300 border border-teal-800/60">
            <Sparkles className="w-3 h-3" />
            AI Query Issue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
            <HelpCircle className="w-3 h-3" />
            General
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            Feedback & Problem Reports ({feedbackList.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Issues and suggestions reported directly by beta merchants.</p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Category Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            <option value="bug">Bugs</option>
            <option value="feature">Feature Requests</option>
            <option value="usability">Usability</option>
            <option value="general">General</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="reviewed">Under Review</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Main Feedback List */}
      {feedbackList.length === 0 ? (
        <div className="p-16 rounded-3xl bg-slate-900/90 border border-slate-800 text-center">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-300">No feedback submitted yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            When beta testers submit problem reports or feedback, they will appear here.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900/90 border border-slate-800 text-center">
          <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-300">No feedback match your filter</h3>
          <p className="text-xs text-slate-500 mt-1">Adjust category or status filter to see other submissions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const status = item.status || 'open';
            const isUpdating = updatingId === item.id;

            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    {getTypeBadge(item.type)}
                    <span className="text-xs font-semibold text-white">{item.businessName || 'Business Account'}</span>
                    <span className="text-xs text-slate-500">&bull;</span>
                    <span className="text-xs text-slate-400">{item.userEmail || item.userId}</span>
                  </div>

                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Feedback Message Body */}
                <p className="text-xs text-slate-200 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 leading-relaxed">
                  {item.message}
                </p>

                {/* Context if available (Device, Path) */}
                {item.context && Object.keys(item.context).length > 0 && (
                  <div className="text-[11px] text-slate-500 bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-800/40 flex flex-wrap gap-3">
                    {item.context.tab && (
                      <span>
                        Tab: <strong className="text-slate-400">{item.context.tab}</strong>
                      </span>
                    )}
                    {item.context.userAgent && (
                      <span className="truncate max-w-xs">
                        Device: {String(item.context.userAgent).slice(0, 40)}...
                      </span>
                    )}
                  </div>
                )}

                {/* Status Toggle & Action Footer */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-slate-400 font-semibold mr-1">Status:</span>
                    <button
                      type="button"
                      disabled={isUpdating || status === 'open'}
                      onClick={() => handleStatusChange(item.id, 'open')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        status === 'open'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'text-slate-400 hover:text-white bg-slate-800'
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating || status === 'reviewed'}
                      onClick={() => handleStatusChange(item.id, 'reviewed')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        status === 'reviewed'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'text-slate-400 hover:text-white bg-slate-800'
                      }`}
                    >
                      Reviewing
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating || status === 'resolved'}
                      onClick={() => handleStatusChange(item.id, 'resolved')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        status === 'resolved'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'text-slate-400 hover:text-white bg-slate-800'
                      }`}
                    >
                      Resolved
                    </button>
                  </div>

                  {item.userEmail && (
                    <a
                      href={`mailto:${item.userEmail}?subject=Re:%20Karra%20Feedback%20(${item.type})`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Reply to User</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
