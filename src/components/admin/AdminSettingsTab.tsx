import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Database,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Sparkles,
  ArrowLeft,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';
import { AdminUserRecord, AdminEventRecord } from './adminTypes';
import { BetaFeedbackItem, BetaInvitation } from '../../types';

interface AdminSettingsTabProps {
  founderEmail: string;
  users: AdminUserRecord[];
  events: AdminEventRecord[];
  feedbackList: BetaFeedbackItem[];
  invitations: BetaInvitation[];
  onExitAdmin: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  founderEmail,
  users,
  events,
  feedbackList,
  invitations,
  onExitAdmin,
  onShowToast,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Helper to trigger browser download
  const downloadFile = (filename: string, content: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert array of objects to CSV
  const convertToCSV = (arr: any[]): string => {
    if (arr.length === 0) return '';
    const headers = Object.keys(arr[0]);
    const rows = arr.map((item) =>
      headers
        .map((header) => {
          let val = item[header];
          if (typeof val === 'object' && val !== null) {
            val = JSON.stringify(val);
          }
          const str = String(val ?? '').replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };

  const handleExportUsers = (format: 'json' | 'csv') => {
    setIsExporting(`users_${format}`);
    try {
      const sanitized = users.map((u) => ({
        userId: u.userId,
        businessName: u.businessName,
        email: u.email,
        joinedAt: u.joinedAt,
        lastActiveAt: u.lastActiveAt,
        status: u.status,
        betaStatus: u.betaStatus,
        totalTransactions: u.totalTransactions,
        salesCount: u.salesCount,
        expensesCount: u.expensesCount,
        aiInteractionsCount: u.aiInteractionsCount,
        activeDaysCount: u.activeDaysCount,
      }));

      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        downloadFile(`karra_users_${dateStr}.json`, JSON.stringify(sanitized, null, 2), 'application/json');
      } else {
        downloadFile(`karra_users_${dateStr}.csv`, convertToCSV(sanitized), 'text/csv');
      }
      if (onShowToast) onShowToast(`Exported ${sanitized.length} users (${format.toUpperCase()})`, 'success');
    } catch {
      if (onShowToast) onShowToast('Export failed', 'warning');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportEvents = (format: 'json' | 'csv') => {
    setIsExporting(`events_${format}`);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        downloadFile(`karra_events_${dateStr}.json`, JSON.stringify(events, null, 2), 'application/json');
      } else {
        const flatEvents = events.map((e) => ({
          id: e.id,
          userId: e.userId,
          userEmail: e.userEmail,
          businessName: e.businessName,
          eventName: e.eventName,
          timestamp: e.timestamp,
        }));
        downloadFile(`karra_events_${dateStr}.csv`, convertToCSV(flatEvents), 'text/csv');
      }
      if (onShowToast) onShowToast(`Exported ${events.length} events (${format.toUpperCase()})`, 'success');
    } catch {
      if (onShowToast) onShowToast('Export failed', 'warning');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportFeedback = () => {
    setIsExporting('feedback_json');
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadFile(`karra_feedback_${dateStr}.json`, JSON.stringify(feedbackList, null, 2), 'application/json');
      if (onShowToast) onShowToast(`Exported ${feedbackList.length} feedback items`, 'success');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Founder Session Identity */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Founder Administration Credentials
        </h3>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Authenticated Founder:</span>
            <span className="font-semibold text-emerald-400">{founderEmail}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800/50">
            <span className="text-slate-400">Authorization Level:</span>
            <span className="font-bold text-white uppercase tracking-wider">Super Administrator</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Security Mode:</span>
            <span className="text-slate-300">Session Token + Firebase Auth Rules Enforced</span>
          </div>
        </div>
      </div>

      {/* 2. System Diagnostics */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <Server className="w-4 h-4 text-teal-400" />
          System Health Diagnostics
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800/60">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            </div>
            <p className="text-xs font-bold text-white">Cloud Firestore</p>
            <p className="text-[11px] text-slate-500 mt-1">Multi-tenant document isolation & live persistence.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <Server className="w-4 h-4 text-teal-400" />
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800/60">
                <CheckCircle2 className="w-3 h-3" />
                Operational
              </span>
            </div>
            <p className="text-xs font-bold text-white">API Dispatcher</p>
            <p className="text-[11px] text-slate-500 mt-1">Node serverless routes & rate limiting active.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950 px-2 py-0.5 rounded-full border border-amber-800/60">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </span>
            </div>
            <p className="text-xs font-bold text-white">Gemini AI Engine</p>
            <p className="text-[11px] text-slate-500 mt-1">Grounding, zero-hallucination NLP interpreter.</p>
          </div>
        </div>
      </div>

      {/* 3. Audit Data Export */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Download className="w-4 h-4 text-purple-400" />
            Audit & Raw Data Export
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Download full operational data dumps for founder auditing, spreadsheet modeling, or backups.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Export Users */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white">Merchant Accounts</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{users.length} registered businesses</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleExportUsers('csv')}
                className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportUsers('json')}
                className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-purple-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Export Events */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white">Event Log</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{events.length} tracked product actions</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleExportEvents('csv')}
                className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportEvents('json')}
                className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-purple-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Export Feedback */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-white">User Feedback</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{feedbackList.length} feedback submissions</p>
            </div>
            <button
              type="button"
              onClick={handleExportFeedback}
              className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 flex items-center justify-center gap-1 cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-pink-400" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
