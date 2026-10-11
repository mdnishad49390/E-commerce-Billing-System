"use client";

import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { api, Invoice, PaymentMethod } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Dropdown, MetricCard, SearchBar, StatusBadge, DatePicker } from "@/components/common";
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
  PlusCircle,
  FileSpreadsheet,
  ChevronDown,
  Check,
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

  // Summary Download state
  const [downloadSummaryLoading, setDownloadSummaryLoading] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
    total_billed: string;
    total_collected: string;
    total_due: string;
    total_overdue?: string;
  } | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("Tk");

  // Close export dropdown when clicked outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params: any = { page_size: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (hasDueFilter) params.has_due = true;
      if (billingMonthFilter) params.billing_month = billingMonthFilter;

      const [res, summaryRes, setRes] = await Promise.all([
        api.getInvoices(params),
        api.getDashboardSummary().catch(() => null),
        api.getSettings().catch(() => null),
      ]);
      setInvoices(res.results || []);
      if (summaryRes) {
        setSummary(summaryRes);
      }
      const settingsObj = (setRes as any)?.results?.[0] || setRes;
      if (settingsObj?.currency_symbol) {
        setCurrencySymbol(settingsObj.currency_symbol);
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

  // Excel Summary Download Handler
  const handleDownloadSummary = async (categoryOverride?: string) => {
    try {
      setDownloadSummaryLoading(true);
      setIsExportMenuOpen(false);

      // Build filter parameters based on categoryOverride or active filters
      const targetParams: Record<string, any> = { page_size: 100 };
      let categoryLabel = "Filtered";

      if (categoryOverride === "ALL") {
        categoryLabel = "All_Invoices";
      } else if (categoryOverride === "ISSUED") {
        targetParams.status = "ISSUED";
        categoryLabel = "Issued_Unpaid";
      } else if (categoryOverride === "PARTIALLY_PAID") {
        targetParams.status = "PARTIALLY_PAID";
        categoryLabel = "Partially_Paid";
      } else if (categoryOverride === "PAID") {
        targetParams.status = "PAID";
        categoryLabel = "Fully_Paid";
      } else if (categoryOverride === "DRAFT") {
        targetParams.status = "DRAFT";
        categoryLabel = "Draft";
      } else if (categoryOverride === "DUE_ONLY") {
        targetParams.has_due = true;
        categoryLabel = "Due_Bills";
      } else {
        // Use active screen filters
        if (search) targetParams.search = search;
        if (statusFilter) targetParams.status = statusFilter;
        if (hasDueFilter) targetParams.has_due = true;
        if (billingMonthFilter) targetParams.billing_month = billingMonthFilter;

        categoryLabel = statusFilter
          ? statusFilter
          : hasDueFilter
          ? "Due_Bills"
          : billingMonthFilter
          ? `Month_${billingMonthFilter}`
          : "All_Invoices";
      }

      // Fetch all invoices for this category (with pagination up to 1000 items)
      let exportInvoices: Invoice[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const res = await api.getInvoices({ ...targetParams, page });
          const items = res.results || [];
          exportInvoices = exportInvoices.concat(items);
          if (!res.next || items.length === 0 || exportInvoices.length >= 1000) {
            hasMore = false;
          } else {
            page++;
          }
        } catch (fetchErr) {
          console.error("Pagination fetch error:", fetchErr);
          hasMore = false;
        }
      }

      // Fallback to current view if empty
      if (exportInvoices.length === 0 && !categoryOverride && invoices.length > 0) {
        exportInvoices = invoices;
      }

      if (exportInvoices.length === 0) {
        alert("No invoices found for the selected category to download.");
        return;
      }

      // Prepare table columns matching screenshot
      const headerRow = [
        "INVOICE #",
        "CLIENT",
        "TITLE / SERVICE",
        "CLIENT & TITLE",
        "BILLING MONTH",
        `PAYABLE (${currencySymbol})`,
        `PAID (${currencySymbol})`,
        `DUE (${currencySymbol})`,
        "STATUS",
        "ISSUE DATE",
        "DUE DATE",
      ];

      let sumPayable = 0;
      let sumPaid = 0;
      let sumDue = 0;

      const dataRows = exportInvoices.map((inv) => {
        const payable = parseFloat(inv.payable_amount || "0") || 0;
        const paid = parseFloat(inv.paid_amount || "0") || 0;
        const due = parseFloat(inv.due_amount || "0") || 0;

        sumPayable += payable;
        sumPaid += paid;
        sumDue += due;

        return [
          inv.invoice_number || `INV-${inv.id}`,
          inv.client_name || "",
          inv.title || "",
          `${inv.client_name || ""}${inv.title ? ` - ${inv.title}` : ""}`,
          inv.billing_month || inv.issue_date || "",
          payable,
          paid,
          due,
          inv.status || "",
          inv.issue_date || "",
          inv.due_date || "",
        ];
      });

      // Total Summary Row
      const summaryRow = [
        "TOTAL",
        "",
        "",
        `Total Records: ${exportInvoices.length}`,
        "",
        sumPayable,
        sumPaid,
        sumDue,
        "",
        "",
        "",
      ];

      // Format Sheet Data
      const aoa = [
        [`INVOICES SUMMARY REPORT - ${categoryLabel.replace(/_/g, " ").toUpperCase()}`],
        [`Generated On: ${new Date().toLocaleString()} | Currency: ${currencySymbol} | Total Count: ${exportInvoices.length}`],
        [],
        headerRow,
        ...dataRows,
        summaryRow,
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);

      // Auto-fit column widths
      worksheet["!cols"] = [
        { wch: 18 }, // Invoice #
        { wch: 25 }, // Client
        { wch: 32 }, // Title / Service
        { wch: 38 }, // Client & Title
        { wch: 16 }, // Billing Month
        { wch: 16 }, // Payable
        { wch: 16 }, // Paid
        { wch: 16 }, // Due
        { wch: 15 }, // Status
        { wch: 14 }, // Issue Date
        { wch: 14 }, // Due Date
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices Summary");

      const todayStr = new Date().toISOString().split("T")[0];
      const fileName = `Invoices_Summary_${categoryLabel}_${todayStr}.xlsx`;

      XLSX.writeFile(workbook, fileName);
    } catch (err: any) {
      console.error("Failed to export summary Excel:", err);
      alert("Failed to download summary: " + (err.message || "Unknown error"));
    } finally {
      setDownloadSummaryLoading(false);
    }
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
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-white via-cyan-50/25 to-blue-50/40 p-6 md:p-8 rounded-3xl border border-cyan-200/60 shadow-[0_4px_24px_-6px_rgba(6,182,212,0.08)]">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Manage and track software billing statements and client payments</p>
        </div>
        {/* Header Actions: Download Summary & Create New Bill */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Download Summary Button with Category Selection */}
          <div className="relative inline-block text-left" ref={exportMenuRef}>
            <div className="inline-flex rounded-xl shadow-xs border border-emerald-600/30 overflow-hidden">
              {/* Primary button: Downloads summary for the current active category/filter */}
              <button
                type="button"
                onClick={() => handleDownloadSummary()}
                disabled={downloadSummaryLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs tracking-wide transition-all cursor-pointer disabled:opacity-60 active:scale-[0.99]"
                title={`Download summary for: ${statusFilter || (hasDueFilter ? "Due Bills" : "All Invoices")}`}
              >
                {downloadSummaryLoading ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <FileSpreadsheet size={16} className="text-emerald-100" />
                )}
                <span>Download Summary</span>
                {statusFilter && (
                  <span className="hidden sm:inline-block bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    {statusFilter}
                  </span>
                )}
                {hasDueFilter && !statusFilter && (
                  <span className="hidden sm:inline-block bg-amber-400 text-amber-950 text-[10px] px-1.5 py-0.5 rounded font-bold">
                    DUE
                  </span>
                )}
              </button>

              {/* Dropdown arrow toggle */}
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={downloadSummaryLoading}
                className="inline-flex items-center px-2.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white border-l border-emerald-500/40 transition-colors disabled:opacity-60 cursor-pointer"
                title="Choose invoice category to download"
              >
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${isExportMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* Category Dropdown Menu */}
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Download Summary (.xlsx)
                  </div>
                  <div className="text-xs text-slate-500">
                    Select invoice category to export:
                  </div>
                </div>

                <div className="py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleDownloadSummary()}
                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/70 flex items-center justify-between text-slate-800 transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                      Current Filtered Invoices
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                      {statusFilter || (hasDueFilter ? "Due" : "Active")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadSummary("ALL")}
                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/70 flex items-center justify-between text-slate-800 transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      All Invoices (All Categories)
                    </span>
                    <span className="text-[10px] text-slate-400">All</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadSummary("ISSUED")}
                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/70 flex items-center justify-between text-slate-800 transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      Issued / Unpaid Invoices
                    </span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold border border-blue-200">
                      ISSUED
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadSummary("PAID")}
                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/70 flex items-center justify-between text-slate-800 transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Fully Paid Invoices
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">
                      PAID
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadSummary("PARTIALLY_PAID")}
                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/70 flex items-center justify-between text-slate-800 transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Partially Paid Invoices
                    </span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                      PARTIAL
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadSummary("DUE_ONLY")}
                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/70 flex items-center justify-between text-slate-800 transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Only Due Bills
                    </span>
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded font-semibold border border-rose-200">
                      DUE
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadSummary("DRAFT")}
                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50/70 flex items-center justify-between text-slate-800 transition-colors cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      Draft Invoices
                    </span>
                    <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-semibold border border-slate-200">
                      DRAFT
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {isAccountant && (
            <a
              href="/invoices/new"
              className="px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-600/20 hover:shadow-cyan-600/30 w-fit shrink-0"
            >
              <PlusCircle size={17} />
              Create New Bill
            </a>
          )}
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
            ? parseFloat(summary.total_billed || "0")
            : invoices.reduce((acc, inv) => acc + parseFloat(inv.payable_amount || "0"), 0)
          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          unit={currencySymbol}
          subtitle="Cumulative payable volume"
          icon={DollarSign}
          color="cyan"
        />

        <MetricCard
          title="Collected"
          value={(!search && !statusFilter && !hasDueFilter && !billingMonthFilter && summary
            ? parseFloat(summary.total_collected || "0")
            : invoices.reduce((acc, inv) => acc + parseFloat(inv.paid_amount || "0"), 0)
          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          unit={currencySymbol}
          subtitle="Verified payments received"
          icon={CheckCircle2}
          color="emerald"
        />

        <MetricCard
          title="Net Due"
          value={(!search && !statusFilter && !hasDueFilter && !billingMonthFilter && summary
            ? parseFloat(summary.total_due || "0")
            : invoices.reduce((acc, inv) => acc + parseFloat(inv.due_amount || "0"), 0)
          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          unit={currencySymbol}
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

          <button
            type="button"
            onClick={() => handleDownloadSummary()}
            disabled={downloadSummaryLoading}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-60"
            title="Download Excel summary of current filtered view"
          >
            {downloadSummaryLoading ? (
              <Loader2 size={14} className="animate-spin text-emerald-700" />
            ) : (
              <FileSpreadsheet size={14} className="text-emerald-700" />
            )}
            <span>Download Summary</span>
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
          <div className="overflow-auto max-h-[calc(100vh-270px)]">
            <table className="w-full min-w-[900px] xl:min-w-full text-left text-sm text-slate-700 table-fixed border-collapse">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead className="bg-slate-50/95 backdrop-blur-md text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
                <tr>
                  <th className="py-3.5 pl-5 pr-3 text-left whitespace-nowrap">Invoice #</th>
                  <th className="py-3.5 px-3 text-left">Client & Title</th>
                  <th className="py-3.5 px-3 text-left whitespace-nowrap">Billing Month</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">Payable</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">Paid</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">Due</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">Status</th>
                  <th className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-cyan-50/20 transition-colors">
                    {/* Invoice Number */}
                    <td className="py-3.5 pl-5 pr-3 whitespace-nowrap align-middle">
                      <a
                        href={`/invoices/${inv.id}`}
                        title={`View invoice ${inv.invoice_number}`}
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-cyan-800 bg-cyan-50/90 hover:bg-cyan-100/90 px-2.5 py-1 rounded-lg border border-cyan-200/80 transition-colors group"
                      >
                        <span className="group-hover:underline">{inv.invoice_number}</span>
                      </a>
                    </td>

                    {/* Client & Title */}
                    <td className="py-3.5 px-3 align-middle overflow-hidden">
                      <div className="font-bold text-slate-900 truncate" title={inv.client_name}>
                        {inv.client_name}
                      </div>
                      {inv.title ? (
                        <div className="text-xs text-slate-500 truncate mt-0.5" title={inv.title}>
                          {inv.title}
                        </div>
                      ) : null}
                    </td>

                    {/* Billing Month & Issue Date */}
                    <td className="py-3.5 px-3 whitespace-nowrap align-middle text-xs text-slate-600">
                      <span className="inline-block font-semibold bg-slate-100/90 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/70 text-xs">
                        {inv.billing_month || inv.issue_date}
                      </span>
                      {inv.billing_month && inv.issue_date ? (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Issued: {inv.issue_date}
                        </div>
                      ) : null}
                    </td>

                    {/* Payable */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap align-middle font-mono font-bold text-slate-900">
                      {parseFloat(inv.payable_amount || "0").toLocaleString()} {inv.currency_symbol || "Tk"}
                    </td>

                    {/* Paid */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap align-middle font-mono font-bold text-emerald-600">
                      {parseFloat(inv.paid_amount || "0").toLocaleString()} {inv.currency_symbol || "Tk"}
                    </td>

                    {/* Due */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap align-middle font-mono font-bold text-amber-600">
                      {parseFloat(inv.due_amount || "0").toLocaleString()} {inv.currency_symbol || "Tk"}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap align-middle">
                      <StatusBadge status={inv.status} type="invoice" />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap align-middle">
                      <div className="inline-flex items-center justify-end gap-1">
                        {/* View & Print Details */}
                        <a
                          href={`/invoices/${inv.id}`}
                          title="View Details"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                        >
                          <Printer size={13.5} />
                        </a>

                        {/* Download PDF */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                          disabled={downloadingId === inv.id}
                          title="Download PDF"
                          className="p-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {downloadingId === inv.id ? <Loader2 size={13.5} className="animate-spin" /> : <Download size={13.5} />}
                        </button>

                        {/* Record Payment */}
                        {isAccountant && parseFloat(inv.due_amount) > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(inv)}
                            title="Record Payment"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <CreditCard size={13.5} />
                          </button>
                        )}

                        {/* Edit */}
                        {isAccountant && (
                          <a
                            href={`/invoices/${inv.id}/edit`}
                            title="Edit Bill"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                          >
                            <Edit size={13.5} />
                          </a>
                        )}

                        {/* Delete (Admin Only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(inv.id, inv.invoice_number)}
                            title="Delete Bill"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13.5} />
                          </button>
                        )}
                      </div>
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
                <DatePicker
                  value={paymentDate}
                  onChange={setPaymentDate}
                  required
                  size="md"
                  placeholder="Select payment date"
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
