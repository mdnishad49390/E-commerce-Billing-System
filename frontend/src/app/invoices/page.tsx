"use client";

import React, { useEffect, useState } from "react";
import { api, Invoice, PaymentMethod } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Dropdown, MetricCard, SearchBar, StatusBadge } from "@/components/common";
import {
  Printer,
  Edit,
  Trash2,
  CreditCard,
  X,
  Download,
  Loader2,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function InvoicesListPage() {
  const { isAccountant, isAdmin } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hasDueFilter, setHasDueFilter] = useState(false);
  const [billingMonthFilter, setBillingMonthFilter] = useState("");

  // Payment Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<number | undefined>();
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [transactionId, setTransactionId] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [summary, setSummary] = useState<{
    total_billed: number;
    total_collected: number;
    total_due: number;
  } | null>(null);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params: any = { page_size: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (hasDueFilter) params.has_due = true;
      if (billingMonthFilter) params.billing_month = billingMonthFilter;

      const [res, summaryRes] = await Promise.all([
        api.getInvoices(params),
        api.getDashboardSummary().catch(() => null),
      ]);
      setInvoices(res.results || []);
      if (summaryRes) {
        setSummary(summaryRes);
      }
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter, hasDueFilter, billingMonthFilter]);

  useEffect(() => {
    api.getPaymentMethods().then((res) => {
      setPaymentMethods(res.results || []);
    });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInvoices();
  };

  const handleOpenPayment = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.due_amount);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTransactionId("");
    setPaymentNote("");
    setPaymentError("");
    if (paymentMethods.length > 0) {
      setSelectedMethod(paymentMethods[0].id);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      setPaymentLoading(true);
      setPaymentError("");
      const res = await api.recordPayment(selectedInvoice.id, {
        amount: paymentAmount,
        payment_method: selectedMethod,
        payment_date: paymentDate,
        transaction_id: transactionId,
        note: paymentNote,
      });
      setSelectedInvoice(null);
      await loadInvoices();
      if (res.payment && confirm("Payment recorded successfully! Would you like to download the official Money Receipt PDF now?")) {
        api.downloadPaymentReceiptPdf(res.payment.id, res.payment.receipt_number);
      }
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDelete = async (id: number, invNum: string) => {
    if (!confirm(`Are you sure you want to delete invoice ${invNum}?`)) return;
    try {
      await api.deleteInvoice(id);
      await loadInvoices();
    } catch (err: any) {
      alert(err.message || "Failed to delete invoice");
    }
  };

  const handleDownloadPdf = async (id: number, invNum: string) => {
    try {
      setDownloadingId(id);
      await api.downloadInvoicePdf(id, invNum);
    } catch (err: any) {
      alert("Failed to download PDF: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h2>
          <p className="text-slate-500 text-sm">Manage and track software billing statements</p>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Bills"
          value={invoices.length}
          subtitle="All generated invoices"
          icon={FileText}
          color="blue"
        />

        <MetricCard
          title="Total Billed"
          value={(!search && !statusFilter && !hasDueFilter && !billingMonthFilter && summary
            ? summary.total_billed
            : invoices.reduce((acc, inv) => acc + parseFloat(inv.payable_amount || "0"), 0)
          ).toLocaleString()}
          unit="Tk"
          subtitle="Cumulative payable volume"
          icon={DollarSign}
          color="cyan"
        />

        <MetricCard
          title="Collected"
          value={(!search && !statusFilter && !hasDueFilter && !billingMonthFilter && summary
            ? summary.total_collected
            : invoices.reduce((acc, inv) => acc + parseFloat(inv.paid_amount || "0"), 0)
          ).toLocaleString()}
          unit="Tk"
          subtitle="Verified payments received"
          icon={CheckCircle2}
          color="emerald"
        />

        <MetricCard
          title="Net Due"
          value={(!search && !statusFilter && !hasDueFilter && !billingMonthFilter && summary
            ? summary.total_due
            : invoices.reduce((acc, inv) => acc + parseFloat(inv.due_amount || "0"), 0)
          ).toLocaleString()}
          unit="Tk"
          subtitle="Outstanding receivables"
          icon={AlertCircle}
          color="amber"
        />
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-gradient-to-r from-white via-slate-50/40 to-white border border-slate-200/90 rounded-2xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        {/* Search */}
        <SearchBar
          value={search}
          onChange={setSearch}
          onSubmit={handleSearchSubmit}
          onClear={loadInvoices}
          placeholder="Search by client or invoice #..."
          className="max-w-md"
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Dropdown
            value={statusFilter}
            onChange={(val) => setStatusFilter(String(val))}
            options={[
              { value: "", label: "All Statuses" },
              { value: "ISSUED", label: "Issued / Unpaid", badge: "Issued", badgeColor: "bg-blue-50 text-blue-700 border border-blue-200" },
              { value: "PARTIALLY_PAID", label: "Partially Paid", badge: "Partial", badgeColor: "bg-amber-50 text-amber-700 border border-amber-200" },
              { value: "PAID", label: "Fully Paid", badge: "Paid", badgeColor: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
              { value: "DRAFT", label: "Draft", badge: "Draft", badgeColor: "bg-slate-100 text-slate-700 border border-slate-200" },
            ]}
            size="sm"
            className="w-48"
          />

          <input
            type="text"
            value={billingMonthFilter}
            onChange={(e) => setBillingMonthFilter(e.target.value)}
            placeholder="Month (e.g. April-2026)"
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-36 shadow-xs"
          />

          <button
            type="button"
            onClick={() => setHasDueFilter(!hasDueFilter)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
              hasDueFilter
                ? "bg-amber-100 text-amber-800 border-amber-300 shadow-amber-200/50"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            ⚠️ Only Due Bills
          </button>
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            No invoices found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Invoice #</th>
                  <th className="py-4 px-6">Client & Title</th>
                  <th className="py-4 px-6">Billing Month</th>
                  <th className="py-4 px-6 text-right">Payable</th>
                  <th className="py-4 px-6 text-right">Paid</th>
                  <th className="py-4 px-6 text-right">Due</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono text-xs font-bold text-cyan-700">
                      {inv.invoice_number}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{inv.client_name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{inv.title}</div>
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {inv.billing_month || inv.issue_date}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-slate-900">
                      {parseFloat(inv.payable_amount).toLocaleString()} {inv.currency_symbol}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-emerald-600">
                      {parseFloat(inv.paid_amount).toLocaleString()} {inv.currency_symbol}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-amber-600">
                      {parseFloat(inv.due_amount).toLocaleString()} {inv.currency_symbol}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <StatusBadge status={inv.status} type="invoice" />
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                      {/* View & Print Details */}
                      <a
                        href={`/invoices/${inv.id}`}
                        title="View Details"
                        className="inline-flex items-center p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                      >
                        <Printer size={15} />
                      </a>

                      {/* Download PDF */}
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                        disabled={downloadingId === inv.id}
                        title="Download PDF"
                        className="inline-flex items-center p-2 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {downloadingId === inv.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      </button>

                      {/* Record Payment */}
                      {isAccountant && parseFloat(inv.due_amount) > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(inv)}
                          title="Record Payment"
                          className="inline-flex items-center p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <CreditCard size={15} />
                        </button>
                      )}

                      {/* Edit */}
                      {isAccountant && (
                        <a
                          href={`/invoices/${inv.id}/edit`}
                          title="Edit Bill"
                          className="inline-flex items-center p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                        >
                          <Edit size={15} />
                        </a>
                      )}

                      {/* Delete (Admin Only) */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(inv.id, inv.invoice_number)}
                          title="Delete Bill"
                          className="inline-flex items-center p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-slate-900 mb-1">Record Payment</h3>
            <p className="text-xs text-slate-500 mb-6 font-mono">
              Invoice #{selectedInvoice.invoice_number} ({selectedInvoice.client_name})
            </p>

            {paymentError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Amount ({selectedInvoice.currency_symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Remaining Due: {selectedInvoice.due_amount} {selectedInvoice.currency_symbol}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Payment Method
                </label>
                <Dropdown
                  value={selectedMethod !== undefined ? selectedMethod : ""}
                  onChange={(val) => setSelectedMethod(Number(val))}
                  options={paymentMethods.map((pm) => ({
                    value: pm.id,
                    label: pm.name,
                  }))}
                  placeholder="Select payment method..."
                  size="md"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Transaction / Cheque ID (Optional)
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN-9988123"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Note
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Paid via Islami Bank Transfer"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading || !paymentAmount}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {paymentLoading ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
