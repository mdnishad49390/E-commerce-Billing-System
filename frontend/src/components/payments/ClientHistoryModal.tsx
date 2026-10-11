"use client";

import React from "react";
import { Loader2, X } from "lucide-react";
import type { ClientHistoryResponse } from "@/lib/api";
import { PaymentStatusBadge, taka } from "./paymentStatus";

interface Props {
  history: ClientHistoryResponse | null;
  loading: boolean;
  onClose: () => void;
}

/** A client's last 12 months: expected, paid, due and status per month. */
export default function ClientHistoryModal({ history, loading, onClose }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Client payment history" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-900">Monthly Payment History{history ? ` — ${history.client_name}` : ""}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto p-5">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="animate-spin text-cyan-600 mx-auto" /></div>
          ) : !history || history.history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No billing history in the last 12 months.</p>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="text-slate-600 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-3">Month</th>
                  <th className="py-2 pr-3 text-right">Expected</th>
                  <th className="py-2 pr-3 text-right">Paid</th>
                  <th className="py-2 pr-3 text-right">Due</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.history.map((h) => (
                  <tr key={`${h.year}-${h.month}`}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-800">{h.label}</td>
                    <td className="py-2.5 pr-3 text-right font-mono">{taka(h.expected)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-emerald-700">{taka(h.paid)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-amber-700">{taka(h.due)}</td>
                    <td className="py-2.5"><PaymentStatusBadge status={h.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
