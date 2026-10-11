"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  CalendarDay,
  CalendarItem,
  CalendarResponse,
  CalendarStatus,
  Client,
  ClientHistoryResponse,
  PaymentMethod,
} from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  CreditCard,
  Eye,
  FileText,
  History,
  Loader2,
  PieChart,
  X,
} from "lucide-react";
import { DatePicker } from "@/components/common";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Every status has a text label AND an icon, so colour is never the only signal.
const STATUS_META: Record<CalendarStatus, { label: string; icon: React.ElementType; chip: string }> = {
  PAID: { label: "Paid", icon: CheckCircle2, chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DUE: { label: "Due", icon: Clock, chip: "bg-amber-50 text-amber-700 border-amber-200" },
  OVERDUE: { label: "Overdue", icon: AlertCircle, chip: "bg-rose-50 text-rose-700 border-rose-200" },
  PARTIALLY_PAID: { label: "Partially Paid", icon: PieChart, chip: "bg-blue-50 text-blue-700 border-blue-200" },
  UPCOMING: { label: "Upcoming", icon: Clock, chip: "bg-slate-50 text-slate-600 border-slate-200" },
  NO_PAYMENT: { label: "No Payment", icon: Circle, chip: "bg-white text-slate-500 border-slate-300 border-dashed" },
};
const STATUS_ORDER: CalendarStatus[] = ["OVERDUE", "DUE", "PARTIALLY_PAID", "PAID", "UPCOMING", "NO_PAYMENT"];

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const pad = (n: number) => String(n).padStart(2, "0");
const money = (v: string | number) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

function StatusBadge({ status, className = "" }: { status: CalendarStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.chip} ${className}`}>
      <Icon size={11} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

interface Props {
  paymentMethods: PaymentMethod[];
  isAccountant: boolean;
  onPaymentSaved?: () => void;
}

export default function PaymentCalendarTab({ paymentMethods, isAccountant, onPaymentSaved }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");

  const [clients, setClients] = useState<Client[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [result, setResult] = useState<{ key: string; data: CalendarResponse | null; error: string }>({
    key: "",
    data: null,
    error: "",
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [history, setHistory] = useState<ClientHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Record payment form
  const [payItem, setPayItem] = useState<CalendarItem | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payMethod, setPayMethod] = useState<number | undefined>();
  const [payTxn, setPayTxn] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    api.getClients().then((r) => setClients(r.results || [])).catch(() => {});
  }, []);

  // Loading is derived: the stored result is stale until it matches the current query.
  const queryKey = `${year}-${month}|${clientFilter}|${statusFilter}|${methodFilter}|${reloadTick}`;
  const loading = result.key !== queryKey;
  const data = result.data;
  const error = loading ? "" : result.error;
  const load = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    api
      .getPaymentCalendar({ month, year, client: clientFilter, status: statusFilter, method: methodFilter })
      .then((d) => !cancelled && setResult({ key: queryKey, data: d, error: "" }))
      .catch((err: unknown) =>
        !cancelled && setResult({ key: queryKey, data: null, error: errMsg(err, "Failed to load payment calendar") })
      );
    return () => {
      cancelled = true;
    };
  }, [queryKey, month, year, clientFilter, statusFilter, methodFilter]);

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    (data?.days || []).forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  const selectedDay = selectedDate ? dayMap.get(selectedDate) : undefined;

  const shiftMonth = (delta: number) => {
    const total = year * 12 + (month - 1) + delta;
    setYear(Math.floor(total / 12));
    setMonth((total % 12) + 1);
  };
  const goToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
  };

  // Calendar cells: leading blanks (Sunday-first), then each day of the month.
  const cells = useMemo(() => {
    const lead = new Date(year, month - 1, 1).getDay();
    const total = new Date(year, month, 0).getDate();
    const out: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);
  const isoOf = (day: number) => `${year}-${pad(month)}-${pad(day)}`;

  const openHistory = async (clientId: number) => {
    try {
      setHistoryLoading(true);
      setHistory(null);
      setHistory(await api.getClientPaymentHistory(clientId));
    } catch (err: unknown) {
      alert("Failed to load payment history: " + errMsg(err, "Unknown error"));
    } finally {
      setHistoryLoading(false);
    }
  };

  const openPayment = (item: CalendarItem) => {
    setPayItem(item);
    setPayAmount(item.remaining_amount);
    setPayDate(data?.today || new Date().toISOString().split("T")[0]);
    setPayMethod(paymentMethods[0]?.id);
    setPayTxn("");
    setPayRef("");
    setPayNotes("");
    setPayError("");
  };

  const viewPayment = async (item: CalendarItem) => {
    if (!item.payment_id) return;
    try {
      const blob = await api.getPaymentReceiptPdfBlob(item.payment_id);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err: unknown) {
      alert("Failed to open receipt: " + errMsg(err, "Unknown error"));
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payItem?.invoice_id) return;
    try {
      setSaving(true);
      setPayError("");
      const note = [payRef && `Ref: ${payRef}`, payNotes].filter(Boolean).join(" | ");
      const res = await api.recordPayment(payItem.invoice_id, {
        amount: payAmount,
        payment_method: payMethod,
        payment_date: payDate,
        transaction_id: payTxn,
        note,
      });
      setPayItem(null);
      load();
      onPaymentSaved?.();
      if (res.payment && confirm("Payment recorded! Download the Money Receipt PDF now?")) {
        api.downloadPaymentReceiptPdf(res.payment.id, res.payment.receipt_number);
      }
    } catch (err: unknown) {
      setPayError(errMsg(err, "Failed to record payment"));
    } finally {
      setSaving(false);
    }
  };

  const summary = data?.summary;
  const cards = summary
    ? [
        { label: "Total Expected", value: `৳${money(summary.total_expected)}`, tone: "text-slate-900", border: "border-slate-200" },
        { label: "Total Collected", value: `৳${money(summary.total_collected)}`, tone: "text-emerald-700", border: "border-emerald-100" },
        { label: "Total Due", value: `৳${money(summary.total_due)}`, tone: "text-amber-600", border: "border-amber-100" },
        { label: "Paid Clients", value: summary.paid_clients, tone: "text-emerald-700", border: "border-emerald-100" },
        { label: "Due Clients", value: summary.due_clients, tone: "text-amber-600", border: "border-amber-100" },
        { label: "Overdue", value: summary.overdue_clients, tone: "text-rose-600", border: "border-rose-100" },
      ]
    : [];

  const selectCls =
    "bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer font-medium";
  const inputCls =
    "w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = "block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5";

  const renderDayChips = (day: CalendarDay, max = 2) => {
    const present = STATUS_ORDER.filter((s) => day.status_counts[s]);
    return (
      <div className="flex flex-wrap gap-1">
        {present.slice(0, max).map((s) => (
          <StatusBadge key={s} status={s} className="!px-1.5" />
        ))}
        {present.length > max && <span className="text-[10px] font-bold text-slate-500">+{present.length - max}</span>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`p-4 rounded-2xl bg-white border ${c.border} shadow-2xs`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{c.label}</div>
            <div className={`mt-2 text-xl font-black font-mono tracking-tight ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Navigation + filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer">
              <ChevronLeft size={14} /> Previous
            </button>
            <button onClick={goToday} className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer">
              Today
            </button>
            <button onClick={() => shiftMonth(1)} aria-label="Next month" className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer">
              Next <ChevronRight size={14} />
            </button>
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            {MONTHS[month - 1]} {year}
          </h3>
          <div className="flex items-center gap-2">
            <select aria-label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              aria-label="Year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (y >= 2000 && y <= 2100) setYear(y);
              }}
              className={`${selectCls} w-24`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Client" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={selectCls}>
            <option value="">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select aria-label="Payment status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">All Statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <select aria-label="Payment method" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={selectCls}>
            <option value="">All Payment Methods</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
          {(clientFilter || statusFilter || methodFilter) && (
            <button
              onClick={() => { setClientFilter(""); setStatusFilter(""); setMethodFilter(""); }}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          )}
          <div className="ml-auto hidden lg:flex flex-wrap gap-1.5" aria-label="Status legend">
            {STATUS_ORDER.map((s) => <StatusBadge key={s} status={s} />)}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
      )}

      {loading && !data && !error ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <Loader2 size={32} className="animate-spin text-cyan-600 mx-auto mb-3" />
          Loading payment calendar...
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : ""}>
          {/* Desktop / tablet month grid */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`b${idx}`} className="min-h-28 bg-slate-50/50 border-b border-r border-slate-100" />;
                const iso = isoOf(day);
                const info = dayMap.get(iso);
                const isToday = iso === data?.today;
                const body = (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? "bg-cyan-600 text-white rounded-full w-6 h-6 inline-flex items-center justify-center" : "text-slate-700"}`}>
                        {day}
                      </span>
                      {info && <span className="text-[10px] font-bold text-slate-500">{info.count} {info.count === 1 ? "bill" : "bills"}</span>}
                    </div>
                    {info && (
                      <div className="mt-1.5 space-y-1">
                        <div className="text-[10px] font-mono leading-tight text-slate-600">
                          <div>Exp: ৳{money(info.expected)}</div>
                          <div className="text-emerald-700">Paid: ৳{money(info.collected)}</div>
                          <div className="text-amber-700">Due: ৳{money(info.due)}</div>
                        </div>
                        {renderDayChips(info)}
                      </div>
                    )}
                  </>
                );
                return info ? (
                  <button
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    aria-label={`${longDate(iso)}: ${info.count} bills`}
                    className="min-h-28 p-2 text-left border-b border-r border-slate-100 hover:bg-cyan-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 cursor-pointer"
                  >
                    {body}
                  </button>
                ) : (
                  <div key={iso} className="min-h-28 p-2 border-b border-r border-slate-100">{body}</div>
                );
              })}
            </div>
          </div>

          {/* Mobile agenda list */}
          <div className="md:hidden space-y-2">
            {(data?.days || []).map((d) => (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{longDate(d.date)}</span>
                  <span className="text-[11px] font-bold text-slate-500">{d.count} {d.count === 1 ? "bill" : "bills"}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div><div className="text-slate-400">Expected</div>৳{money(d.expected)}</div>
                  <div className="text-emerald-700"><div className="text-slate-400">Paid</div>৳{money(d.collected)}</div>
                  <div className="text-amber-700"><div className="text-slate-400">Due</div>৳{money(d.due)}</div>
                </div>
                <div className="mt-2">{renderDayChips(d, 4)}</div>
              </button>
            ))}
          </div>

          {(data?.days || []).length === 0 && (
            <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 mt-3">
              <FileText size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No bills for {MONTHS[month - 1]} {year}</p>
              <p className="text-xs text-slate-500 mt-1">Try another month or reset the filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Day detail modal */}
      {selectedDate && selectedDay && (
        <div role="dialog" aria-modal="true" aria-label={`Payments due ${longDate(selectedDate)}`} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">{longDate(selectedDate)}</h3>
                <p className="text-xs text-slate-500">
                  {selectedDay.count} {selectedDay.count === 1 ? "bill" : "bills"} · Expected ৳{money(selectedDay.expected)} · Collected ৳{money(selectedDay.collected)} · Due ৳{money(selectedDay.due)}
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {selectedDay.items.map((it) => (
                <div key={it.key} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">{it.client_name}</div>
                      <div className="text-[11px] text-slate-500">{it.title}</div>
                    </div>
                    <StatusBadge status={it.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><dt className="text-slate-400">Invoice</dt><dd className="font-mono font-bold text-cyan-700">{it.invoice_number || "Not generated yet"}</dd></div>
                    <div><dt className="text-slate-400">Due Date</dt><dd className="font-semibold text-slate-800">{longDate(it.due_date)}</dd></div>
                    <div><dt className="text-slate-400">Expected</dt><dd className="font-mono font-bold">৳{money(it.expected_amount)}</dd></div>
                    <div><dt className="text-slate-400">Paid</dt><dd className="font-mono font-bold text-emerald-700">৳{money(it.paid_amount)}</dd></div>
                    <div><dt className="text-slate-400">Remaining</dt><dd className="font-mono font-bold text-amber-700">৳{money(it.remaining_amount)}</dd></div>
                    <div><dt className="text-slate-400">Payment Date</dt><dd className="font-semibold text-slate-800">{it.payment_date ? longDate(it.payment_date) : "—"}</dd></div>
                    <div><dt className="text-slate-400">Payment Method</dt><dd className="font-semibold text-slate-800">{it.payment_method || "—"}</dd></div>
                    <div><dt className="text-slate-400">Transaction ID</dt><dd className="font-mono text-slate-800">{it.transaction_id || "—"}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {it.invoice_id && (
                      <a href={`/invoices/${it.invoice_id}`} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1">
                        <FileText size={13} className="text-cyan-600" /> View Invoice
                      </a>
                    )}
                    {it.payment_id && (
                      <button onClick={() => viewPayment(it)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer">
                        <Eye size={13} className="text-cyan-600" /> View Payment
                      </button>
                    )}
                    {isAccountant && it.invoice_id && Number(it.remaining_amount) > 0 && (
                      <button onClick={() => openPayment(it)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                        <CreditCard size={13} /> Record Payment
                      </button>
                    )}
                    <button onClick={() => openHistory(it.client_id)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer">
                      <History size={13} className="text-cyan-600" /> Payment History
                    </button>
                  </div>
                  {!it.has_invoice && (
                    <p className="text-[11px] text-slate-500">
                      No invoice exists for this month yet. Generate recurring bills first; the payment can be recorded once the invoice exists.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Client monthly history modal */}
      {(historyLoading || history) && (
        <div role="dialog" aria-modal="true" aria-label="Client payment history" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900">Monthly Payment History{history ? ` — ${history.client_name}` : ""}</h3>
              <button onClick={() => { setHistory(null); setHistoryLoading(false); }} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto p-5">
              {historyLoading ? (
                <div className="py-10 text-center"><Loader2 className="animate-spin text-cyan-600 mx-auto" /></div>
              ) : history && history.history.length === 0 ? (
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
                    {history?.history.map((h) => (
                      <tr key={`${h.year}-${h.month}`}>
                        <td className="py-2.5 pr-3 font-semibold text-slate-800">{h.label}</td>
                        <td className="py-2.5 pr-3 text-right font-mono">৳{money(h.expected)}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-emerald-700">৳{money(h.paid)}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-amber-700">৳{money(h.due)}</td>
                        <td className="py-2.5"><StatusBadge status={h.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {payItem && (
        <div role="dialog" aria-modal="true" aria-label="Record payment" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Record Payment</h3>
                <p className="text-xs text-slate-500">{payItem.client_name} • #{payItem.invoice_number}</p>
              </div>
              <button onClick={() => setPayItem(null)} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitPayment} className="p-6 space-y-4">
              {payError && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{payError}</div>}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><div className={labelCls}>Client</div><div className="font-semibold text-slate-800">{payItem.client_name}</div></div>
                <div><div className={labelCls}>Invoice</div><div className="font-mono font-bold text-cyan-700">{payItem.invoice_number}</div></div>
              </div>
              <div>
                <label htmlFor="cal-amount" className={labelCls}>Amount (৳) *</label>
                <input id="cal-amount" type="number" step="0.01" min="0.01" max={payItem.remaining_amount} required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={`${inputCls} font-mono font-bold`} />
                <div className="flex justify-between mt-1 text-[11px] text-slate-500">
                  <span>Remaining due: ৳{money(payItem.remaining_amount)}</span>
                  <button type="button" onClick={() => setPayAmount(payItem.remaining_amount)} className="text-cyan-700 font-bold hover:underline cursor-pointer">Pay full due</button>
                </div>
              </div>
              <div>
                <label htmlFor="cal-date" className={labelCls}>Payment Date *</label>
                <DatePicker
                  id="cal-date"
                  value={payDate}
                  onChange={setPayDate}
                  required
                  size="md"
                  placeholder="Select payment date"
                />
              </div>
              <div>
                <label htmlFor="cal-method" className={labelCls}>Payment Method *</label>
                <select id="cal-method" required value={payMethod} onChange={(e) => setPayMethod(Number(e.target.value))} className={`${inputCls} cursor-pointer`}>
                  {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cal-txn" className={labelCls}>Transaction ID</label>
                <input id="cal-txn" type="text" value={payTxn} onChange={(e) => setPayTxn(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label htmlFor="cal-ref" className={labelCls}>Reference</label>
                <input id="cal-ref" type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="cal-notes" className={labelCls}>Notes</label>
                <input id="cal-notes" type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className={inputCls} />
              </div>
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setPayItem(null)} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving || !payAmount} className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 cursor-pointer disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
