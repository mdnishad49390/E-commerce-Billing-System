"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, CalendarItem, ClientHistoryResponse, ObligationsResponse, Payment, PaymentMethod } from "@/lib/api";
import { CreditCard, Loader2 } from "lucide-react";
import { SearchBar } from "@/components/common";
import DateRangeFilter from "./DateRangeFilter";
import MonthSelector from "./MonthSelector";
import GlobalPaymentSummary from "./GlobalPaymentSummary";
import PaymentsTable from "./PaymentsTable";
import PaymentDetailsModal from "./PaymentDetailsModal";
import RecordPaymentModal from "./RecordPaymentModal";
import ClientHistoryModal from "./ClientHistoryModal";
import { STATUS_META, STATUS_ORDER, errMsg } from "./paymentStatus";

interface Props {
  paymentMethods: PaymentMethod[];
  isAccountant: boolean;
}

const selectCls =
  "bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium";

/**
 * Payments table: one row per invoice (billing obligation) with a single status.
 * Every figure and status comes from GET /api/payments/obligations/ (the backend
 * is the source of truth); this component filters, renders and records payments.
 */
export default function PaymentTracker({ paymentMethods, isAccountant }: Props) {
  const now = new Date();
  // The single billing-period filter shared by the table, the summary cards and the API call.
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Debounce the search so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Loading is derived: the stored result is stale until it matches the current query.
  const [reloadTick, setReloadTick] = useState(0);
  const [result, setResult] = useState<{ key: string; data: ObligationsResponse | null; error: string }>({
    key: "",
    data: null,
    error: "",
  });
  const queryKey = `${year}-${month}|${startDate}|${endDate}|${search}|${statusFilter}|${reloadTick}`;
  const loading = result.key !== queryKey;
  const data = result.data;
  const error = loading ? "" : result.error;
  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    api
      .getPaymentObligations({
        month,
        year,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: search || undefined,
        status: statusFilter || undefined,
      })
      .then((d) => !cancelled && setResult({ key: queryKey, data: d, error: "" }))
      .catch((err: unknown) =>
        !cancelled && setResult({ key: queryKey, data: null, error: errMsg(err, "Failed to load payments") })
      );
    return () => {
      cancelled = true;
    };
  }, [queryKey, month, year, startDate, endDate, search, statusFilter]);

  // The row being viewed is looked up in live data, so it refreshes after a payment is saved.
  const [viewKey, setViewKey] = useState<string | null>(null);
  const viewItem = useMemo(() => data?.rows.find((r) => r.key === viewKey), [data, viewKey]);

  const [payItem, setPayItem] = useState<CalendarItem | null>(null);
  const [payChoices, setPayChoices] = useState<CalendarItem[] | undefined>();
  const [history, setHistory] = useState<ClientHistoryResponse | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const unpaid = useMemo(() => (data?.rows ?? []).filter((r) => r.invoice_id && Number(r.remaining_amount) > 0), [data]);

  const openHistory = async (clientId: number) => {
    try {
      setHistoryOpen(true);
      setHistoryLoading(true);
      setHistory(null);
      setHistory(await api.getClientPaymentHistory(clientId));
    } catch (err: unknown) {
      alert("Failed to load payment history: " + errMsg(err, "Unknown error"));
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const viewReceipt = async (paymentId: number) => {
    try {
      const blob = await api.getPaymentReceiptPdfBlob(paymentId);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err: unknown) {
      alert("Failed to open receipt: " + errMsg(err, "Unknown error"));
    }
  };

  const downloadReceipt = async (paymentId: number, receiptNumber?: string) => {
    try {
      await api.downloadPaymentReceiptPdf(paymentId, receiptNumber);
    } catch (err: unknown) {
      alert("Failed to download receipt: " + errMsg(err, "Unknown error"));
    }
  };

  const handleSaved = (payment: Payment | undefined) => {
    setPayItem(null);
    setPayChoices(undefined);
    reload();
    if (payment && confirm("Payment recorded! Download the Money Receipt PDF now?")) {
      downloadReceipt(payment.id, payment.receipt_number);
    }
  };

  const hasFilters = Boolean(startDate || endDate || searchInput || statusFilter);
  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
  };

  return (
    <div className="space-y-5">
      <MonthSelector
        month={month}
        year={year}
        onChange={(m, y) => {
          setMonth(m);
          setYear(y);
          setStartDate(""); // an issue-date range belongs to one billing period
          setEndDate("");
        }}
      />

      <GlobalPaymentSummary summary={data?.summary ?? null} />

      {/* Filter toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search company, invoice number or service..."
            className="flex-1 min-w-[240px]"
          />
          <select aria-label="Payment status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">All Statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Issue date:</span>
            <DateRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
            {hasFilters && (
              <button onClick={clearFilters} className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                Clear Filters
              </button>
            )}
          </div>
          {isAccountant && (
            <button
              onClick={() => {
                if (unpaid.length === 0) return;
                setPayChoices(unpaid);
                setPayItem(unpaid[0]);
              }}
              disabled={unpaid.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard size={15} />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>
      )}

      {!data && !error ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 size={32} className="animate-spin text-cyan-600 mx-auto mb-3" />
          Loading payments...
        </div>
      ) : data ? (
        <PaymentsTable rows={data.rows} loading={loading} onView={(item) => setViewKey(item.key)} />
      ) : null}

      {viewItem && (
        <PaymentDetailsModal
          item={viewItem}
          isAccountant={isAccountant}
          onClose={() => setViewKey(null)}
          onRecordPayment={(item) => {
            setPayChoices(undefined);
            setPayItem(item);
          }}
          onViewHistory={openHistory}
          onViewReceipt={viewReceipt}
          onDownloadReceipt={downloadReceipt}
        />
      )}

      {historyOpen && <ClientHistoryModal history={history} loading={historyLoading} onClose={() => setHistoryOpen(false)} />}

      {payItem && data && (
        <RecordPaymentModal
          item={payItem}
          choices={payChoices}
          paymentMethods={paymentMethods}
          today={data.today}
          onClose={() => {
            setPayItem(null);
            setPayChoices(undefined);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
