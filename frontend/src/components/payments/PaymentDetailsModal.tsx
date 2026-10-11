"use client";

import React from "react";
import { CreditCard, Download, Eye, FileText, History, X } from "lucide-react";
import type { CalendarItem } from "@/lib/api";
import { PaymentStatusBadge, longDate, taka } from "./paymentStatus";

interface Props {
  item: CalendarItem;
  isAccountant: boolean;
  onClose: () => void;
  onRecordPayment: (item: CalendarItem) => void;
  onViewHistory: (clientId: number) => void;
  onViewReceipt: (paymentId: number) => void;
  onDownloadReceipt: (paymentId: number, receiptNumber: string) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-semibold text-slate-800 break-words">{children}</dd>
    </div>
  );
}

/** Full details for one invoice: amounts, status, and every payment made against it. */
export default function PaymentDetailsModal({ item: it, isAccountant, onClose, onRecordPayment, onViewHistory, onViewReceipt, onDownloadReceipt }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label={`${it.client_name} - ${it.purpose}`} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900">{it.client_name}</h3>
            <p className="text-xs text-slate-500">{it.purpose} · {it.billing_month}</p>
          </div>
          <div className="flex items-center gap-3">
            <PaymentStatusBadge status={it.status} />
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {it.status === "OVERDUE" && it.is_partial && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              Overdue with a partial payment: {taka(it.paid_amount)} received, {taka(it.remaining_amount)} still outstanding.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <Field label="Company Name">{it.client_name}</Field>
            <Field label="Payment Purpose / Service">{it.purpose}</Field>
            <Field label="Invoice Number"><span className="font-mono text-cyan-700">{it.invoice_number}</span></Field>
            <Field label="Billing Month">{it.billing_month}</Field>
            <Field label="Invoice Date">{it.issue_date ? longDate(it.issue_date) : "—"}</Field>
            <Field label="Due Date">{longDate(it.due_date)}</Field>
            <Field label="Expected Amount"><span className="font-mono">{taka(it.expected_amount)}</span></Field>
            <Field label="Total Paid"><span className="font-mono text-emerald-700">{taka(it.paid_amount)}</span></Field>
            <Field label="Outstanding Balance"><span className="font-mono text-amber-700">{taka(it.remaining_amount)}</span></Field>
          </dl>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Payment history</div>
            {it.payments.length === 0 ? (
              <p className="text-xs text-slate-400">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {it.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                    <div>
                      <span className="font-mono font-bold text-emerald-700">{taka(p.amount)}</span>
                      <span className="text-slate-500"> · {longDate(p.payment_date)} · {p.payment_method || "—"}</span>
                      {p.transaction_id && <div className="font-mono text-[11px] text-slate-500">Ref: {p.transaction_id}</div>}
                      {p.note && <div className="text-[11px] text-slate-400">{p.note}</div>}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => onViewReceipt(p.id)} className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer">
                        <Eye size={12} className="text-cyan-600" /> {p.receipt_number}
                      </button>
                      <button onClick={() => onDownloadReceipt(p.id, p.receipt_number)} className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer">
                        <Download size={12} className="text-cyan-600" /> Download Receipt
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {it.invoice_id && (
              <a href={`/invoices/${it.invoice_id}`} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1">
                <FileText size={13} className="text-cyan-600" /> View Invoice
              </a>
            )}
            {isAccountant && it.invoice_id && Number(it.remaining_amount) > 0 && (
              <button onClick={() => onRecordPayment(it)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                <CreditCard size={13} /> Record Payment
              </button>
            )}
            <button onClick={() => onViewHistory(it.client_id)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer">
              <History size={13} className="text-cyan-600" /> View Payment History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
