"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, AuditLog } from "@/lib/api";
import { Dropdown, SearchBar } from "@/components/common";
import {
  History,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  X,
  User,
  Activity,
} from "lucide-react";

export default function AuditLogsPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadLogs();
    }
  }, [isAdmin, actionFilter, modelFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page_size: 100 };
      if (actionFilter) params.action = actionFilter;
      if (modelFilter) params.model_name = modelFilter;
      const data = await api.getAuditLogs(params);
      setLogs(data.results || []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto mt-12">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield size={24} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-500">
          Audit Logs can only be inspected by authorized System Administrators.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    const q = searchTerm.toLowerCase();
    return (
      (log.username || "").toLowerCase().includes(q) ||
      (log.object_repr || "").toLowerCase().includes(q) ||
      (log.model_name || "").toLowerCase().includes(q) ||
      (log.ip_address || "").toLowerCase().includes(q)
    );
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "LOGIN_SUCCESS":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Login Success</span>;
      case "LOGIN_FAILED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">Login Failed</span>;
      case "LOGOUT":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-300">Logout</span>;
      case "CREATE":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">Created</span>;
      case "UPDATE":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">Updated</span>;
      case "DELETE":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-300">Deleted</span>;
      case "STATUS_CHANGE":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">Status Change</span>;
      case "PASSWORD_CHANGE":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200">Password Change</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-cyan-100 text-cyan-700 rounded-xl">
            <History size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Audit Logs</h1>
            <p className="text-xs text-slate-500">Security trail, login activities, invoice & payment modifications</p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by user, object, IP..."
          size="sm"
        />

        <div>
          <Dropdown
            value={actionFilter}
            onChange={(val) => setActionFilter(String(val))}
            options={[
              { value: "", label: "All Action Types" },
              { value: "LOGIN_SUCCESS", label: "Login Success", badge: "Auth", badgeColor: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
              { value: "LOGIN_FAILED", label: "Login Failed", badge: "Auth", badgeColor: "bg-rose-50 text-rose-700 border border-rose-200" },
              { value: "LOGOUT", label: "Logout" },
              { value: "CREATE", label: "Create", badge: "Data", badgeColor: "bg-cyan-50 text-cyan-700 border border-cyan-200" },
              { value: "UPDATE", label: "Update", badge: "Data", badgeColor: "bg-blue-50 text-blue-700 border border-blue-200" },
              { value: "DELETE", label: "Delete", badge: "Data", badgeColor: "bg-rose-50 text-rose-700 border border-rose-200" },
              { value: "STATUS_CHANGE", label: "Status Change" },
              { value: "PASSWORD_CHANGE", label: "Password Change" },
            ]}
            size="sm"
          />
        </div>

        <div>
          <Dropdown
            value={modelFilter}
            onChange={(val) => setModelFilter(String(val))}
            options={[
              { value: "", label: "All Target Models" },
              { value: "Invoice", label: "Invoices" },
              { value: "Payment", label: "Payments" },
              { value: "User", label: "Users" },
              { value: "Client", label: "Clients" },
              { value: "Company", label: "Company" },
              { value: "Settings", label: "Settings" },
            ]}
            size="sm"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Model</th>
                <th className="py-3 px-4">Object / Details</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-cyan-600" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No audit records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <User size={13} className="text-cyan-600" />
                        <span>{log.username || "System/Anon"}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-700">
                      {log.model_name || "Auth"}
                    </td>

                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.object_repr}>
                      {log.object_repr || `ID: ${log.object_id || "N/A"}`}
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {log.ip_address || "127.0.0.1"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {log.changes && Object.keys(log.changes).length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Eye size={12} className="inline mr-1" />
                          View Diff
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Changes / Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-cyan-600" />
                <h3 className="font-bold text-base text-slate-900">Audit Change Details</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-4 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Action:</span>
                <span className="font-semibold text-slate-800">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Target Object:</span>
                <span className="font-semibold text-slate-800">{selectedLog.object_repr || selectedLog.model_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Actor / IP:</span>
                <span className="font-semibold text-slate-800">{selectedLog.username} ({selectedLog.ip_address})</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Payload Changes / Snapshot</p>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs overflow-x-auto max-h-60 font-mono">
                {JSON.stringify(selectedLog.changes, null, 2)}
              </pre>
            </div>

            <div className="mt-5 text-right">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
