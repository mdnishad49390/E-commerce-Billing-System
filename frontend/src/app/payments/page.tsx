"use client";

import React, { useEffect, useState } from "react";
import { api, Invoice, Payment, PaymentMethod } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Dropdown, MetricCard, SearchBar, StatusBadge } from "@/components/common";
import {
  CreditCard,
  Search,
  Download,
  Eye,
  Trash2,
  Loader2,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Filter,
  FileCheck,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";

export default function PaymentsPage() {
  const { isAccountant, isAdmin } = useAuth();

  // Active Tab: "transactions" | "due_invoices" | "paid_invoices"
  const [activeTab, setActiveTab] = useState<"transactions" | "due_invoices" | "paid_invoices">("transactions");

  // Data states
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dueInvoices, setDueInvoices] = useState<Invoice[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [dateAfterFilter, setDateAfterFilter] = useState("");
  const [dateBeforeFilter, setDateBeforeFilter] = useState("");

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState<number | undefined>();
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [transactionId, setTransactionId] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Deletion State
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Receipt Download / Preview State
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<number | null>(null);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [loadingReceiptPreview, setLoadingReceiptPreview] = useState(false);
  const [previewPayment, setPreviewPayment] = useState<Payment | null>(null);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const params: any = { page_size: 100 };
      if (search) params.search = search;
      if (methodFilter) params.payment_method = methodFilter;
      if (dateAfterFilter) params.payment_date_after = dateAfterFilter;
      if (dateBeforeFilter) params.payment_date_before = dateBeforeFilter;

      const [paymentsRes, dueRes, paidRes] = await Promise.all([
        api.getPayments(params),
        api.getInvoices({ has_due: true, page_size: 100 }),
        api.getInvoices({ status: "PAID", page_size: 100 }),
      ]);

      setPayments(paymentsRes.results || []);
      setDueInvoices(dueRes.results || []);
      setPaidInvoices(paidRes.results || []);
    } catch (err) {
      console.error("Failed to load payment data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [methodFilter, dateAfterFilter, dateBeforeFilter]);

  useEffect(() => {
    api.getPaymentMethods()
      .then((res) => {
        const methods = res.results || [];
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setSelectedMethodId(methods[0].id);
        }
      })
      .catch((err) => console.error("Error loading payment methods:", err));
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenPaymentModal = (invoice?: Invoice) => {
    if (invoice) {
      setSelectedInvoice(invoice);
      setPaymentAmount(invoice.due_amount);
    } else if (dueInvoices.length > 0) {
      setSelectedInvoice(dueInvoices[0]);
      setPaymentAmount(dueInvoices[0].due_amount);
    } else {
      setSelectedInvoice(null);
      setPaymentAmount("");
    }
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTransactionId("");
    setPaymentNote("");
    setPaymentError("");
    if (paymentMethods.length > 0 && !selectedMethodId) {
      setSelectedMethodId(paymentMethods[0].id);
    }
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      setSavingPayment(true);
      setPaymentError("");
      const res = await api.recordPayment(selectedInvoice.id, {
        amount: paymentAmount,
        payment_method: selectedMethodId,
        payment_date: paymentDate,
        transaction_id: transactionId,
        note: paymentNote,
      });

      setPaymentModalOpen(false);
      await loadData();

      if (res.payment && confirm("Payment recorded successfully! Would you like to download the official Money Receipt PDF now?")) {
        api.downloadPaymentReceiptPdf(res.payment.id, res.payment.receipt_number);
      }
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!confirm(`Are you sure you want to delete payment of ${payment.amount} for ${payment.invoice_number || 'invoice'}? Remaining balance and invoice status will be automatically recalculated.`)) {
      return;
    }
    try {
      setDeletingId(payment.id);
      await api.deletePayment(payment.id);
      await loadData();
    } catch (err: any) {
      alert("Failed to delete payment: " + (err.message || "Unknown error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadReceipt = async (payment: Payment) => {
    try {
      setDownloadingReceiptId(payment.id);
      await api.downloadPaymentReceiptPdf(payment.id, payment.receipt_number);
    } catch (err: any) {
      alert("Failed to download receipt PDF: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleOpenReceiptPreview = async (payment: Payment) => {
    try {
      setPreviewPayment(payment);
      setLoadingReceiptPreview(true);
      setReceiptPreviewOpen(true);
      const blob = await api.getPaymentReceiptPdfBlob(payment.id);
      const url = URL.createObjectURL(blob);
      setReceiptPreviewUrl(url);
    } catch (err: any) {
      alert("Failed to load receipt preview: " + (err.message || "Unknown error"));
      setReceiptPreviewOpen(false);
    } finally {
      setLoadingReceiptPreview(false);
    }
  };

  const handleCloseReceiptPreview = () => {
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptPreviewUrl(null);
    }
    setPreviewPayment(null);
    setReceiptPreviewOpen(false);
  };

  // KPI Calculations
  const totalCollected = payments.reduce((acc, p) => acc + parseFloat(p.amount || "0"), 0);
  const totalDue = dueInvoices.reduce((acc, inv) => acc + parseFloat(inv.due_amount || "0"), 0);
  const totalBilled = totalCollected + totalDue;
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Payments & Due Tracking
          </h2>
          <p className="text-slate-500 text-sm">
            Monitor payment collections, record transaction entries, download official Money Receipts, and track outstanding receivables
          </p>
        </div>

        {isAccountant && (
          <button
            onClick={() => handleOpenPaymentModal()}
            disabled={dueInvoices.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
          >
            <CreditCard size={18} />
            Record Payment
          </button>
        )}
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Collected"
          value={totalCollected.toLocaleString()}
          unit="Tk"
          subtitle={`${payments.length} verified transactions recorded`}
          icon={CheckCircle2}
          color="emerald"
        />

        <MetricCard
          title="Total Outstanding Due"
          value={totalDue.toLocaleString()}
          unit="Tk"
          subtitle={`Across ${dueInvoices.length} outstanding invoices`}
          icon={AlertCircle}
          color="amber"
        />

        <MetricCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          subtitle="Settled / Total billing volume"
          icon={TrendingUp}
          color="cyan"
        />

        <MetricCard
          title="Fully Paid Bills"
          value={paidInvoices.length}
          unit="Bills"
          subtitle="Fully settled without dues"
          icon={FileCheck}
          color="blue"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("transactions")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "transactions"
              ? "bg-cyan-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CreditCard size={15} />
          All Transactions
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === "transactions" ? "bg-cyan-700 text-white" : "bg-slate-200 text-slate-700"}`}>
            {payments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("due_invoices")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "due_invoices"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Clock size={15} />
          Due Invoices
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === "due_invoices" ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-700"}`}>
            {dueInvoices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("paid_invoices")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "paid_invoices"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CheckCircle2 size={15} />
          Fully Paid Invoices
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === "paid_invoices" ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"}`}>
            {paidInvoices.length}
          </span>
        </button>
      </div>

      {/* Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <SearchBar
          value={search}
          onChange={setSearch}
          onSubmit={handleSearchSubmit}
          placeholder="Search by client, invoice #, or transaction ID..."
          className="max-w-md"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Dropdown
            value={methodFilter}
            onChange={(val) => setMethodFilter(String(val))}
            options={[
              { value: "", label: "All Payment Methods" },
              ...paymentMethods.map((pm) => ({
                value: String(pm.id),
                label: pm.name,
              })),
            ]}
            size="sm"
            className="w-52"
          />

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>From:</span>
            <input
              type="date"
              value={dateAfterFilter}
              onChange={(e) => setDateAfterFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>To:</span>
            <input
              type="date"
              value={dateBeforeFilter}
              onChange={(e) => setDateBeforeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {(search || methodFilter || dateAfterFilter || dateBeforeFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setMethodFilter("");
                setDateAfterFilter("");
                setDateBeforeFilter("");
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <Loader2 size={32} className="animate-spin text-cyan-600 mx-auto mb-3" />
          Loading payment records and receipts...
        </div>
      ) : activeTab === "transactions" ? (
        /* TAB 1: Transactions Table */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <FileCheck size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-base font-semibold text-slate-700">No Payment Records Found</p>
              <p className="text-xs text-slate-500 mt-1">No payment transactions match your search filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-5">Receipt #</th>
                    <th className="py-4 px-5">Date</th>
                    <th className="py-4 px-5">Client & Invoice #</th>
                    <th className="py-4 px-5">Method</th>
                    <th className="py-4 px-5">Transaction ID</th>
                    <th className="py-4 px-5 text-right">Amount</th>
                    <th className="py-4 px-5 text-center">Money Receipt</th>
                    {isAccountant && <th className="py-4 px-5 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5 font-mono font-bold text-cyan-700">
                        {p.receipt_number || `MR-${p.id}`}
                      </td>
                      <td className="py-4 px-5 font-medium text-slate-700">
                        {p.payment_date}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">{p.client_name || "Client"}</div>
                        <a
                          href={`/invoices/${p.invoice}`}
                          className="font-mono text-[11px] text-cyan-600 hover:underline inline-flex items-center gap-1"
                        >
                          Invoice #{p.invoice_number}
                        </a>
                      </td>
                      <td className="py-4 px-5 font-semibold text-slate-800">
                        {p.payment_method_name || "Cash"}
                      </td>
                      <td className="py-4 px-5 font-mono text-slate-600">
                        {p.transaction_id || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700 text-sm">
                        {Number(p.amount).toFixed(2)} {p.currency_symbol || "Tk"}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenReceiptPreview(p)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            title="Preview Money Receipt PDF"
                          >
                            <Eye size={12} className="text-cyan-600" />
                            View
                          </button>
                          <button
                            onClick={() => handleDownloadReceipt(p)}
                            disabled={downloadingReceiptId === p.id}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 hover:bg-cyan-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-60"
                            title="Download Money Receipt PDF"
                          >
                            {downloadingReceiptId === p.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}
                            Download
                          </button>
                        </div>
                      </td>
                      {isAccountant && (
                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => handleDeletePayment(p)}
                            disabled={deletingId === p.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Payment & Auto-recalculate"
                          >
                            {deletingId === p.id ? (
                              <Loader2 size={14} className="animate-spin text-rose-600" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === "due_invoices" ? (
        /* TAB 2: Due Invoices Table */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {dueInvoices.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-base font-semibold text-slate-700">No Outstanding Dues</p>
              <p className="text-xs text-slate-500 mt-1">All client invoices have been fully settled and cleared.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-5">Invoice #</th>
                    <th className="py-4 px-5">Client Name</th>
                    <th className="py-4 px-5">Billing Month</th>
                    <th className="py-4 px-5 text-right">Total Invoiced</th>
                    <th className="py-4 px-5 text-right">Paid Amount</th>
                    <th className="py-4 px-5 text-right">Outstanding Due</th>
                    <th className="py-4 px-5 text-center">Status</th>
                    <th className="py-4 px-5 text-right">Take Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dueInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5 font-mono font-bold text-cyan-700">
                        <a href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoice_number}
                        </a>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">{inv.client_name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{inv.title}</div>
                      </td>
                      <td className="py-4 px-5 text-slate-600 font-medium">
                        {inv.billing_month || inv.issue_date}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-slate-900">
                        {Number(inv.payable_amount).toFixed(2)} {inv.currency_symbol}
                      </td>
                      <td className="py-4 px-5 text-right font-mono text-emerald-700 font-semibold">
                        {(Number(inv.advance_amount || 0) + Number(inv.paid_amount || 0)).toFixed(2)} {inv.currency_symbol}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-amber-700 text-sm">
                        {Number(inv.due_amount).toFixed(2)} {inv.currency_symbol}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <StatusBadge status={inv.status} type="invoice" />
                      </td>
                      <td className="py-4 px-5 text-right">
                        {isAccountant && (
                          <button
                            onClick={() => handleOpenPaymentModal(inv)}
                            className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                          >
                            <CreditCard size={13} />
                            Receive Payment
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
      ) : (
        /* TAB 3: Fully Paid Invoices Table */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          {paidInvoices.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <FileText size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-base font-semibold text-slate-700">No Paid Invoices Found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-4 px-5">Invoice #</th>
                    <th className="py-4 px-5">Client Name</th>
                    <th className="py-4 px-5">Billing Month</th>
                    <th className="py-4 px-5 text-right">Amount Paid</th>
                    <th className="py-4 px-5 text-center">Status</th>
                    <th className="py-4 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paidInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5 font-mono font-bold text-cyan-700">
                        <a href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoice_number}
                        </a>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">{inv.client_name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{inv.title}</div>
                      </td>
                      <td className="py-4 px-5 text-slate-600 font-medium">
                        {inv.billing_month || inv.issue_date}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700 text-sm">
                        {Number(inv.payable_amount).toFixed(2)} {inv.currency_symbol}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <StatusBadge status="PAID" type="invoice" />
                      </td>
                      <td className="py-4 px-5 text-right">
                        <a
                          href={`/invoices/${inv.id}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye size={13} className="text-cyan-600" />
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Record Payment</h3>
                  <p className="text-xs text-slate-500">{selectedInvoice.client_name} • #{selectedInvoice.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {paymentError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {paymentError}
                </div>
              )}

              {/* Invoice Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Invoice *
                </label>
                <Dropdown
                  value={selectedInvoice.id}
                  onChange={(val) => {
                    const inv = dueInvoices.find((i) => i.id === Number(val));
                    if (inv) {
                      setSelectedInvoice(inv);
                      setPaymentAmount(inv.due_amount);
                    }
                  }}
                  options={dueInvoices.map((inv) => ({
                    value: inv.id,
                    label: `${inv.invoice_number} - ${inv.client_name}`,
                    secondary: `Due Amount: ${inv.due_amount} ${inv.currency_symbol}`,
                    badge: `${inv.due_amount} ${inv.currency_symbol}`,
                    badgeColor: "bg-rose-50 text-rose-700 border border-rose-200",
                  }))}
                  searchable={true}
                  searchPlaceholder="Search invoice # or client..."
                  size="md"
                />
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Amount ({selectedInvoice.currency_symbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                  <span>Remaining Due: {selectedInvoice.due_amount} {selectedInvoice.currency_symbol}</span>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedInvoice.due_amount)}
                    className="text-cyan-700 font-bold hover:underline cursor-pointer"
                  >
                    Pay Full Due
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Method *
                </label>
                <Dropdown
                  value={selectedMethodId || ""}
                  onChange={(val) => setSelectedMethodId(Number(val))}
                  options={paymentMethods.map((pm) => ({
                    value: pm.id,
                    label: pm.name,
                  }))}
                  placeholder="Select payment method..."
                  size="md"
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Transaction ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Transaction / Cheque ID
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN-100234 or Cheque #9812"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Remarks / Note
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Paid via bKash Merchant"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment || !paymentAmount}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingPayment ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Money Receipt PDF Interactive Preview Modal */}
      {receiptPreviewOpen && previewPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 print:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Money Receipt Document</h3>
                  <p className="text-xs text-slate-500">
                    Receipt #{previewPayment.receipt_number || previewPayment.id} • Invoice #{previewPayment.invoice_number}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadReceipt(previewPayment)}
                  disabled={downloadingReceiptId === previewPayment.id}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {downloadingReceiptId === previewPayment.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  Download Receipt PDF
                </button>
                <button
                  onClick={handleCloseReceiptPreview}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-hidden relative">
              {loadingReceiptPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 text-slate-500 gap-3">
                  <Loader2 size={32} className="animate-spin text-emerald-600" />
                  <span className="text-sm font-medium">Generating official Money Receipt PDF...</span>
                </div>
              ) : receiptPreviewUrl ? (
                <iframe
                  src={receiptPreviewUrl}
                  title="Receipt Preview"
                  className="w-full h-full rounded-xl border border-slate-300 shadow-inner bg-white"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  Failed to load Money Receipt preview.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
