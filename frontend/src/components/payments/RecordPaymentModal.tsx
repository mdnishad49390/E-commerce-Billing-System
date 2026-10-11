"use client";

import React, { useState } from "react";
import { CreditCard, Loader2, X } from "lucide-react";
import { api, CalendarItem, Payment, PaymentMethod } from "@/lib/api";
import { DatePicker } from "@/components/common";
import { errMsg, money, shortDate } from "./paymentStatus";

interface Props {
  item: CalendarItem;
  /** Unpaid invoices to choose from (toolbar button). Omit to lock to `item`. */
  choices?: CalendarItem[];
  paymentMethods: PaymentMethod[];
  today: string;
  onClose: () => void;
  onSaved: (payment: Payment | undefined) => void;
}

const inputCls =
  "w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500";
const labelCls = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5";

/**
 * Records a payment against one invoice via the existing record_payment API.
 * The backend validates the amount (> 0, never above the remaining balance)
 * and recalculates the invoice; this form only blocks double-clicks.
 */
export default function RecordPaymentModal({ item, choices, paymentMethods, today, onClose, onSaved }: Props) {
  const [current, setCurrent] = useState(item);
  const [amount, setAmount] = useState(item.remaining_amount);
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<number | undefined>(paymentMethods[0]?.id);
  const [txn, setTxn] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pickInvoice = (key: string) => {
    const next = choices?.find((c) => c.key === key);
    if (next) {
      setCurrent(next);
      setAmount(next.remaining_amount);
      setError("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !current.invoice_id) return;
    try {
      setSaving(true);
      setError("");
      const res = await api.recordPayment(current.invoice_id, {
        amount,
        payment_method: method,
        payment_date: date,
        transaction_id: txn,
        note: notes,
      });
      onSaved(res.payment);
    } catch (err: unknown) {
      setError(errMsg(err, "Failed to record payment"));
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Record payment" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Record Payment</h3>
            <p className="text-xs text-slate-500">{current.client_name} • #{current.invoice_number}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>}
          {choices && choices.length > 1 ? (
            <div>
              <label htmlFor="rp-invoice" className={labelCls}>Invoice *</label>
              <select id="rp-invoice" value={current.key} onChange={(e) => pickInvoice(e.target.value)} className={`${inputCls} cursor-pointer`}>
                {choices.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.client_name} — {c.purpose} ({c.invoice_number}, due {shortDate(c.due_date)}, ৳{money(c.remaining_amount)} left)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><div className={labelCls}>Client</div><div className="font-semibold text-slate-800">{current.client_name}</div></div>
              <div><div className={labelCls}>Invoice</div><div className="font-mono font-bold text-cyan-700">{current.invoice_number}</div></div>
            </div>
          )}
          <div>
            <label htmlFor="rp-amount" className={labelCls}>Payment Amount (৳) *</label>
            <input id="rp-amount" type="number" step="0.01" min="0.01" max={current.remaining_amount} required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} font-mono font-bold`} />
            <div className="flex justify-between mt-1 text-[11px] text-slate-500">
              <span>Remaining balance: ৳{money(current.remaining_amount)}</span>
              <button type="button" onClick={() => setAmount(current.remaining_amount)} className="text-cyan-700 font-bold hover:underline cursor-pointer">Pay full balance</button>
            </div>
          </div>
          <div>
            <label htmlFor="rp-date" className={labelCls}>Payment Date *</label>
            <DatePicker
              id="rp-date"
              value={date}
              onChange={setDate}
              required
              size="md"
              placeholder="Select payment date"
            />
          </div>
          <div>
            <label htmlFor="rp-method" className={labelCls}>Payment Method *</label>
            <select id="rp-method" required value={method ?? ""} onChange={(e) => setMethod(Number(e.target.value))} className={`${inputCls} cursor-pointer`}>
              {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rp-txn" className={labelCls}>Transaction / Reference ID</label>
            <input id="rp-txn" type="text" value={txn} onChange={(e) => setTxn(e.target.value)} className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="rp-notes" className={labelCls}>Notes</label>
            <input id="rp-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </div>
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving || !amount} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 cursor-pointer disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
