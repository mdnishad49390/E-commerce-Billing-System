"use client";

import React from "react";
import { Eye, FileText } from "lucide-react";
import type { CalendarItem } from "@/lib/api";
import { PaymentStatusBadge, shortDate, taka } from "./paymentStatus";

interface Props {
  rows: CalendarItem[];
  loading?: boolean;
  onView: (item: CalendarItem) => void;
}

/**
 * One row per billing obligation (invoice) with exactly one status badge.
 * Table on tablet/desktop (no horizontal scrolling), stacked cards on phones.
 */
export default function PaymentsTable({ rows, loading = false, onView }: Props) {
  if (rows.length === 0) {
    return (
      <div className="p-14 text-center bg-white rounded-2xl border border-slate-200">
        <FileText size={36} className="mx-auto text-slate-300 mb-2" />
        <p className="text-base font-semibold text-slate-700">No payment records found</p>
        <p className="text-xs text-slate-500 mt-1">No invoices are due in this period, or the filters exclude everything.</p>
      </div>
    );
  }

  return (
    <div className={loading ? "opacity-60 transition-opacity" : ""}>
      {/* Tablet / desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
            <tr>
              <th scope="col" className="py-3.5 pl-5 pr-3 w-12">SL</th>
              <th scope="col" className="py-3.5 px-3">Company Name</th>
              <th scope="col" className="py-3.5 px-3">Payment Purpose / Service</th>
              <th scope="col" className="py-3.5 px-3 whitespace-nowrap">Billing Month</th>
              <th scope="col" className="py-3.5 px-3 whitespace-nowrap">Issue Date</th>
              <th scope="col" className="py-3.5 px-3 text-right">Amount</th>
              <th scope="col" className="py-3.5 px-3">Payment Status</th>
              <th scope="col" className="py-3.5 pl-3 pr-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.key} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 pl-5 pr-3 text-slate-500 tabular-nums">{i + 1}</td>
                <td className="py-3.5 px-3 font-semibold text-slate-900">{r.client_name}</td>
                <td className="py-3.5 px-3 text-slate-700">{r.purpose}</td>
                <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">{r.billing_month}</td>
                <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">{r.issue_date ? shortDate(r.issue_date) : "—"}</td>
                <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{taka(r.expected_amount)}</td>
                <td className="py-3.5 px-3"><PaymentStatusBadge status={r.status} /></td>
                <td className="py-3.5 pl-3 pr-5 text-right">
                  <button
                    onClick={() => onView(r)}
                    aria-label={`View ${r.client_name} ${r.purpose} ${r.billing_month}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                  >
                    <Eye size={13} className="text-cyan-600" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="md:hidden space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-400">#{i + 1}</div>
                <div className="font-bold text-slate-900">{r.client_name}</div>
                <div className="text-sm text-slate-600">{r.purpose}</div>
              </div>
              <PaymentStatusBadge status={r.status} />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{r.billing_month} · Issued {r.issue_date ? shortDate(r.issue_date) : "—"}</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{taka(r.expected_amount)}</span>
            </div>
            <button
              onClick={() => onView(r)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
            >
              <Eye size={13} className="text-cyan-600" /> View
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
