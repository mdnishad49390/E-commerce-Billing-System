"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  api,
  RecurringRun,
  RecurringPreviewResponse,
  RecurringDashboardStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Play,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
  FileText,
  X,
  Loader2,
  Sparkles,
  Info,
  Layers,
  Search,
} from "lucide-react";

interface CreatedInvoiceItem {
  invoice_number?: string;
  client_name?: string;
  service_name?: string;
  period?: string;
  amount?: number;
  status?: string;
}

interface SkippedSubscriptionItem {
  subscription_id?: number;
  client_id?: number;
  client_name?: string;
  service_name?: string;
  period?: string;
  reason?: string;
}

interface FailedSubscriptionItem {
  subscription_id?: number;
  client_id?: number;
  client_name?: string;
  service_name?: string;
  period?: string;
  error?: string;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
};

const getCurrentMonthString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatCount = (count: number, singular: string, plural: string): string => {
  return `${count} ${count === 1 ? singular : plural}`;
};

export default function RecurringRunsPage() {
  const { isAdmin } = useAuth();
  const [runs, setRuns] = useState<RecurringRun[]>([]);
  const [statusInfo, setStatusInfo] = useState<RecurringDashboardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [selectedRun, setSelectedRun] = useState<RecurringRun | null>(null);
  const [previewData, setPreviewData] = useState<RecurringPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPeriod, setPreviewPeriod] = useState(getCurrentMonthString());

  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [triggerPeriod, setTriggerPeriod] = useState(getCurrentMonthString());
  const [triggerSubmitting, setTriggerSubmitting] = useState(false);

  // Trigger button references for returning focus
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  // Body scroll lock effect
  const isAnyModalOpen = previewModalOpen || triggerModalOpen || Boolean(selectedRun);
  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAnyModalOpen]);

  // Initial fetch effect with clean cancellation
  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const [runsRes, statRes] = await Promise.all([
          api.getRecurringRuns(),
          api.getRecurringStatus(),
        ]);
        if (!ignore) {
          setRuns(runsRes.results || []);
          setStatusInfo(statRes);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg(getErrorMessage(err, "Failed to load recurring run data."));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const refetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const [runsRes, statRes] = await Promise.all([
        api.getRecurringRuns(),
        api.getRecurringStatus(),
      ]);
      setRuns(runsRes.results || []);
      setStatusInfo(statRes);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, "Failed to load recurring run data."));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreview = () => {
    setPreviewPeriod((prev) => prev || getCurrentMonthString());
    setPreviewModalOpen(true);
    void handleRefreshPreview(previewPeriod || getCurrentMonthString());
  };

  const handleRefreshPreview = async (period: string) => {
    try {
      setPreviewLoading(true);
      setErrorMsg("");
      const res = await api.previewRecurringRun(period || undefined);
      setPreviewData(res);
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, "Failed to preview upcoming run."));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTriggerRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTriggerSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");
      const res = await api.triggerRecurringRun(triggerPeriod || undefined);
      setSuccessMsg(
        `Billing run completed successfully! Created ${formatCount(
          res.created_count,
          "invoice",
          "invoices"
        )}, skipped ${formatCount(
          res.skipped_count,
          "subscription",
          "subscriptions"
        )}, and failed ${formatCount(res.failed_count, "item", "items")}.`
      );
      setTriggerModalOpen(false);
      await refetchData();
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, "Failed to trigger recurring billing run."));
    } finally {
      setTriggerSubmitting(false);
    }
  };

  // Keyboard Escape listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (triggerModalOpen && !triggerSubmitting) {
          setTriggerModalOpen(false);
          triggerButtonRef.current?.focus();
        } else if (previewModalOpen && !previewLoading) {
          setPreviewModalOpen(false);
          previewButtonRef.current?.focus();
        } else if (selectedRun) {
          setSelectedRun(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerModalOpen, triggerSubmitting, previewModalOpen, previewLoading, selectedRun]);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center max-w-lg mx-auto mt-12 shadow-sm space-y-3">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Only users with Administrator privileges can view execution logs and trigger automated recurring billing runs.
        </p>
      </div>
    );
  }

  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === "SUCCESS").length;
  const totalCreated = runs.reduce((acc, r) => acc + (r.created_count || 0), 0);

  // Filter runs based on search term
  const filteredRuns = runs.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const period = (r.target_period || "").toLowerCase();
    const trigger = (r.trigger || "").toLowerCase();
    const status = (r.status || "").toLowerCase();
    return period.includes(term) || trigger.includes(term) || status.includes(term);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* 1. Header Banner & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 bg-gradient-to-br from-white via-slate-50/90 to-cyan-50/40 p-6 md:p-8 rounded-3xl border border-slate-200/90 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.1)] relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 left-1/3 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Recurring Runs Audit
            </h1>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-cyan-100/80 text-cyan-800 border border-cyan-200/90 shadow-2xs">
              Admin Only
            </span>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl leading-relaxed">
            Monitor automated subscription billing cycles, simulate upcoming runs with dry-run previews, and trigger generation on demand.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3.5 relative z-10">
          <button
            ref={previewButtonRef}
            type="button"
            onClick={handleOpenPreview}
            className="px-5 py-3 rounded-2xl font-bold text-sm bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:border-cyan-300 transition-all duration-200 flex items-center gap-2.5 cursor-pointer shadow-xs hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.98]"
          >
            <div className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Eye size={15} />
            </div>
            Preview Next Run
          </button>

          <button
            ref={triggerButtonRef}
            type="button"
            onClick={() => {
              setTriggerPeriod(getCurrentMonthString());
              setTriggerModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white transition-all duration-200 flex items-center gap-2.5 cursor-pointer shadow-md shadow-cyan-600/25 hover:shadow-cyan-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <Play size={13} fill="currentColor" />
            </div>
            Run Billing Now
          </button>
        </div>
      </div>

      {/* Inline Feedback Alerts */}
      {successMsg && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-sm flex items-start sm:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg("")}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100/50 transition-colors cursor-pointer"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-900 text-sm flex items-start sm:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2.5 font-medium">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg("")}
            className="text-rose-700 hover:text-rose-900 p-1 rounded-lg hover:bg-rose-100/50 transition-colors cursor-pointer"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Warning Banner if missed or disabled */}
      {statusInfo?.has_warning && (
        <div className="p-4 md:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
          <ShieldAlert size={22} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-bold text-sm">Automated Billing Warning</h2>
            <p className="text-xs text-amber-800 leading-relaxed">{statusInfo.warning_message}</p>
          </div>
        </div>
      )}

      {/* 2. Enhanced Summary Cards (Glassmorphism & Rich Aesthetics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Runs Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 backdrop-blur-md shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Runs</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold shadow-2xs group-hover:scale-110 transition-transform">
              <Layers size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">{totalRuns}</div>
          <div className="mt-2 text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Recorded billing executions
          </div>
        </div>

        {/* Successful Runs Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-white via-white to-emerald-50/40 p-5 backdrop-blur-md shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/80">Successful Runs</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 flex items-center justify-center font-bold shadow-2xs group-hover:scale-110 transition-transform">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight flex items-baseline gap-2">
            <span>{successfulRuns}</span>
            {totalRuns > 0 && (
              <span className="text-xs font-bold text-emerald-700/80">
                ({Math.round((successfulRuns / totalRuns) * 100)}%)
              </span>
            )}
          </div>
          <div className="mt-2 text-xs font-medium text-emerald-700/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed without errors
          </div>
        </div>

        {/* Generated Invoices Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-white via-white to-cyan-50/40 p-5 backdrop-blur-md shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-800/80">Generated Invoices</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-100/80 text-cyan-700 border border-cyan-200/60 flex items-center justify-center font-bold shadow-2xs group-hover:scale-110 transition-transform">
              <FileText size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-cyan-700 tracking-tight">{totalCreated}</div>
          <div className="mt-2 text-xs font-medium text-cyan-700/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            Auto-created bills to date
          </div>
        </div>

        {/* Automated Scheduler Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-purple-200/70 bg-gradient-to-br from-white via-white to-purple-50/40 p-5 backdrop-blur-md shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800/80">Automated Scheduler</span>
            <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-700 border border-purple-200/60 flex items-center justify-center font-bold shadow-2xs group-hover:scale-110 transition-transform">
              <Clock size={20} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {statusInfo?.auto_billing_enabled && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  statusInfo?.auto_billing_enabled ? "bg-emerald-500" : "bg-slate-400"
                }`}
              ></span>
            </span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {statusInfo?.auto_billing_enabled ? "Active" : "Disabled"}
            </span>
          </div>
          <div className="mt-2 text-xs font-medium text-slate-500 truncate">
            Day {statusInfo?.auto_billing_day || 1} at {statusInfo?.auto_billing_time || "00:00"} ({statusInfo?.auto_billing_timezone || "Asia/Dhaka"})
          </div>
        </div>
      </div>

      {/* 3. Refactored Execution Log Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Execution Log</h2>
            <p className="text-xs text-slate-500 mt-0.5">Chronological audit trail of all manual and scheduled billing runs</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by period or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all w-52 sm:w-60"
              />
            </div>
            <span className="text-xs font-semibold text-slate-400 shrink-0">
              {formatCount(filteredRuns.length, "run", "runs")}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 bg-slate-100 rounded-lg animate-pulse w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="py-16 px-6 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <Calendar size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {searchTerm ? "No runs matching your search" : "No recurring billing runs recorded yet"}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchTerm
                ? "Try clearing the filter or searching for another period."
                : "Runs will automatically populate here when the scheduler executes, or you can trigger a run now."}
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setTriggerPeriod(getCurrentMonthString());
                  setTriggerModalOpen(true);
                }}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Play size={14} />
                Run Billing Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200/70">
                <tr>
                  <th className="py-4 px-6">Run Time</th>
                  <th className="py-4 px-6">Trigger</th>
                  <th className="py-4 px-6">Target Period</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center">Created</th>
                  <th className="py-4 px-6 text-center">Skipped</th>
                  <th className="py-4 px-6 text-center">Failed</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRuns.map((r) => {
                  const runDate = new Date(r.run_time);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/70 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-150"
                    >
                      <td className="py-4.5 px-6 font-semibold text-slate-800 whitespace-nowrap">
                        {runDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        <span className="text-xs text-slate-400 font-normal">
                          {runDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-2xs ${
                            r.trigger === "AUTO"
                              ? "bg-purple-50 text-purple-700 border border-purple-200/80"
                              : "bg-blue-50 text-blue-700 border border-blue-200/80"
                          }`}
                        >
                          {r.trigger === "AUTO" ? (
                            <>
                              <Clock size={12} className="text-purple-500" /> Scheduled
                            </>
                          ) : (
                            <>
                              <Play size={10} fill="currentColor" className="text-blue-500" /> Manual
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-slate-100/80 border border-slate-200/60 rounded-lg">
                          {r.target_period || "-"}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                            r.status === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                              : r.status === "PARTIAL"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                              : "bg-rose-50 text-rose-700 border border-rose-200/80"
                          }`}
                        >
                          {r.status === "SUCCESS" && <CheckCircle2 size={13} className="text-emerald-600" />}
                          {r.status === "PARTIAL" && <AlertTriangle size={13} className="text-amber-600" />}
                          {r.status === "FAILED" && <XCircle size={13} className="text-rose-600" />}
                          {r.status}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            r.created_count > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "text-slate-400"
                          }`}
                        >
                          {r.created_count > 0 && <CheckCircle2 size={11} />}
                          {r.created_count}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            r.skipped_count > 0
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "text-slate-400"
                          }`}
                        >
                          {r.skipped_count > 0 && <AlertTriangle size={11} />}
                          {r.skipped_count}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            r.failed_count > 0
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "text-slate-400"
                          }`}
                        >
                          {r.failed_count > 0 && <XCircle size={11} />}
                          {r.failed_count}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedRun(r)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 shadow-2xs hover:shadow-xs active:scale-[0.98]"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedRun && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="details-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedRun(null);
            }
          }}
        >
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 id="details-modal-title" className="text-xl font-bold text-slate-900">
                  Run Execution Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target Period: <span className="font-bold text-slate-800">{selectedRun.target_period || "Auto"}</span> |{" "}
                  Trigger: <span className="font-bold text-slate-800">{selectedRun.trigger}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {selectedRun.error_message && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                <strong>Error:</strong> {selectedRun.error_message}
              </div>
            )}

            {/* Created Invoices */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Created Invoices ({formatCount(selectedRun.created_count, "invoice", "invoices")})
                </h3>
                {selectedRun.details?.created && selectedRun.details.created.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-emerald-100 rounded-2xl divide-y divide-emerald-50 text-xs bg-emerald-50/20">
                    {selectedRun.details.created.map((inv, idx) => {
                      const item = inv as CreatedInvoiceItem | string;
                      const num = typeof item === "string" ? item : item.invoice_number || `Invoice #${idx + 1}`;
                      const client = typeof item === "string" ? "" : item.client_name || "";
                      const amount = typeof item === "string" ? "" : item.amount !== undefined ? `${item.amount} Tk` : "";
                      return (
                        <div key={idx} className="p-3 flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-slate-800">{num}</span>
                            {client && <span className="text-slate-600 ml-2">{client}</span>}
                          </div>
                          {amount && <span className="font-bold text-emerald-700">{amount}</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">None created during this run.</p>
                )}
              </div>

              {/* Skipped Items */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-500" />
                  Skipped Subscriptions ({formatCount(selectedRun.skipped_count, "subscription", "subscriptions")})
                </h3>
                {selectedRun.details?.skipped && selectedRun.details.skipped.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
                    {selectedRun.details.skipped.map((sk, idx) => {
                      const item = sk as SkippedSubscriptionItem;
                      return (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-700">{item.client_name || `Sub #${item.subscription_id}`}</span>
                          <span className="text-slate-500 text-[11px] bg-slate-100 px-2.5 py-0.5 rounded-full shrink-0">
                            {item.reason || "Already billed"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">None skipped.</p>
                )}
              </div>

              {/* Failed Items */}
              {selectedRun.details?.failed && selectedRun.details.failed.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2 flex items-center gap-1.5">
                    <XCircle size={14} />
                    Failed Subscriptions ({formatCount(selectedRun.failed_count, "item", "items")})
                  </h3>
                  <div className="max-h-48 overflow-y-auto border border-rose-200 rounded-2xl divide-y divide-rose-100 text-xs bg-rose-50/30">
                    {selectedRun.details.failed.map((fl, idx) => {
                      const item = fl as FailedSubscriptionItem;
                      return (
                        <div key={idx} className="p-3 text-rose-900 space-y-1">
                          <div className="font-bold flex items-center justify-between">
                            <span>{item.client_name || "Unknown Client"}</span>
                            <span className="text-[11px] font-mono text-rose-600">Sub #{item.subscription_id}</span>
                          </div>
                          <div className="text-[11px] font-mono bg-white/60 p-2 rounded-lg border border-rose-100 break-words">
                            {item.error || "Execution failed"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRun(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Upcoming Run Modal */}
      {previewModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !previewLoading) {
              setPreviewModalOpen(false);
              previewButtonRef.current?.focus();
            }
          }}
        >
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="preview-modal-title" className="text-xl font-bold text-slate-900">
                    Preview Upcoming Billing Run
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                    Dry Run Simulation
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Simulation of invoices that WOULD be created. No database entries or real bills are created.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewModalOpen(false);
                  previewButtonRef.current?.focus();
                }}
                disabled={previewLoading}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dry-run Banner Notice */}
            <div className="p-3.5 rounded-2xl bg-cyan-50/70 border border-cyan-200/80 text-cyan-950 text-xs flex items-center gap-3">
              <Info size={18} className="text-cyan-600 shrink-0" />
              <span>
                <strong>Preview Mode:</strong> Evaluating subscription rules and active cycles. You can simulate any target month.
              </span>
            </div>

            {/* Month/Period Picker Input */}
            <div className="space-y-1.5">
              <label htmlFor="preview-period-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Target Billing Month
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  id="preview-period-input"
                  type="month"
                  value={previewPeriod}
                  onChange={(e) => setPreviewPeriod(e.target.value)}
                  disabled={previewLoading}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => handleRefreshPreview(previewPeriod)}
                  disabled={previewLoading || !previewPeriod}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-cyan-600" />
                      Simulating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-cyan-600" />
                      Simulate Period
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Format: YYYY-MM (e.g., {getCurrentMonthString()}). Use the selector to inspect future or past months.
              </p>
            </div>

            {/* Simulation Results */}
            {previewLoading ? (
              <div className="py-14 text-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-medium">Evaluating active subscriptions, price schedules, and billing cycles...</p>
              </div>
            ) : previewData ? (
              <div className="space-y-5">
                {/* Summary Chips Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Period</span>
                    <div className="text-sm font-bold text-slate-800">
                      {previewData.target_period} ({previewData.display_month})
                    </div>
                  </div>
                  <div className="space-y-0.5 sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={12} /> Would Create
                    </span>
                    <div className="text-sm font-black text-emerald-700">
                      {formatCount(previewData.total_would_create, "bill", "bills")}
                    </div>
                  </div>
                  <div className="space-y-0.5 sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={12} className="text-amber-500" /> Would Skip
                    </span>
                    <div className="text-sm font-bold text-slate-700">
                      {formatCount(previewData.total_would_skip, "subscription", "subscriptions")}
                    </div>
                  </div>
                </div>

                {/* Invoices That Would Be Created */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    Invoices That WOULD Be Created ({formatCount(previewData.total_would_create, "bill", "bills")})
                  </h3>
                  {previewData.would_create.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto border border-emerald-200 rounded-2xl divide-y divide-emerald-100 text-xs bg-emerald-50/20">
                      {previewData.would_create.map((item, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-emerald-50/40 transition-colors">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900">{item.client_name}</span>
                            <span className="text-slate-500 text-[11px] block">
                              {item.service_name} • {item.billing_period} ({item.billing_cycle})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-700 block text-sm">
                              {item.amount.toLocaleString()} Tk
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Status: {item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-500 text-center italic">
                      No subscriptions are due for invoice creation in this target period.
                    </div>
                  )}
                </div>

                {/* Subscriptions That Would Be Skipped */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Subscriptions Skipped ({formatCount(previewData.total_would_skip, "subscription", "subscriptions")})
                  </h3>
                  {previewData.would_skip.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 text-xs">
                      {previewData.would_skip.map((item, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div>
                            <span className="font-semibold text-slate-800">{item.client_name}</span>
                            <span className="text-slate-400 text-[11px] ml-2 font-mono">({item.service_name})</span>
                          </div>
                          <span className="text-slate-600 text-[11px] bg-slate-100 px-2.5 py-0.5 rounded-full shrink-0">
                            {item.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/30 text-xs text-slate-400 text-center italic">
                      No active subscriptions will be skipped.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Footer Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400">
                Preview only. Ready to execute? Switch to live generation.
              </p>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewModalOpen(false);
                    previewButtonRef.current?.focus();
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
                {previewData && previewData.total_would_create > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTriggerPeriod(previewPeriod);
                      setPreviewModalOpen(false);
                      setTriggerModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    Proceed to Run Billing
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Live Run Modal */}
      {triggerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="trigger-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !triggerSubmitting) {
              setTriggerModalOpen(false);
              triggerButtonRef.current?.focus();
            }
          }}
        >
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h2 id="trigger-modal-title" className="text-xl font-bold text-slate-900">
                  Trigger Billing Run
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-50 text-cyan-800 border border-cyan-200">
                  Live Action
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!triggerSubmitting) {
                    setTriggerModalOpen(false);
                    triggerButtonRef.current?.focus();
                  }
                }}
                disabled={triggerSubmitting}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Confirmation Warning Notice */}
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                Live Invoice Generation Warning
              </div>
              <p className="text-amber-800 leading-relaxed">
                This will immediately generate official billing invoices in the database for all active, due recurring subscriptions and catch up any unbilled cycles.
              </p>
            </div>

            <form onSubmit={handleTriggerRun} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="trigger-period-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Billing Month
                </label>
                <input
                  id="trigger-period-input"
                  type="month"
                  value={triggerPeriod}
                  onChange={(e) => setTriggerPeriod(e.target.value)}
                  disabled={triggerSubmitting}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all disabled:opacity-50"
                />
                <p className="text-[11px] text-slate-400">
                  Target month for billing evaluation (e.g., {getCurrentMonthString()}). Leave as current month for standard cycle.
                </p>
              </div>

              {/* Confirmation Details Callout */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Execution Summary</div>
                <div className="font-semibold text-slate-800">
                  Target Month: <span className="font-mono text-cyan-700">{triggerPeriod || getCurrentMonthString()}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Invoices will be assigned sequentially with their respective templates and client custom pricing.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setTriggerModalOpen(false);
                    triggerButtonRef.current?.focus();
                  }}
                  disabled={triggerSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={triggerSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-600/20 hover:shadow-cyan-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {triggerSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Executing Billing Run...
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      Confirm &amp; Run
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
