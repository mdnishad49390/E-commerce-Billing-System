"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Invoice, Payment, PaymentMethod } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Dropdown, StatusBadge } from "@/components/common";
import {
  Printer,
  ArrowLeft,
  Edit,
  Download,
  Eye,
  X,
  Loader2,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Trash2,
  Calendar,
  FileText,
} from "lucide-react";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAccountant } = useAuth();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Invoice PDF Preview & Download States
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Payment Recording Modal States
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<number | undefined>();
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [transactionId, setTransactionId] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Payment Deletion State
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);

  // Money Receipt PDF States
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<number | null>(null);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [loadingReceiptPreview, setLoadingReceiptPreview] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);

  const loadInvoice = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.getInvoice(id);
      setInvoice(res);
    } catch (err) {
      console.error("Error loading invoice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  useEffect(() => {
    api.getPaymentMethods()
      .then((res) => {
        const methods = res.results || [];
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setPaymentMethodId(methods[0].id);
        }
      })
      .catch((err) => console.error("Error loading payment methods:", err));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setDownloadingPdf(true);
      await api.downloadInvoicePdf(invoice.id, invoice.invoice_number);
    } catch (err: any) {
      alert("Failed to download PDF: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleOpenPreview = async () => {
    if (!invoice) return;
    try {
      setLoadingPreview(true);
      setPreviewOpen(true);
      const blob = await api.getInvoicePdfBlob(invoice.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: any) {
      alert("Failed to load PDF preview: " + (err.message || "Unknown error"));
      setPreviewOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewOpen(false);
  };

  // Open Payment Modal
  const handleOpenPaymentModal = () => {
    if (!invoice) return;
    setPaymentAmount(invoice.due_amount);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setTransactionId("");
    setPaymentNote("");
    setPaymentError("");
    if (paymentMethods.length > 0 && !paymentMethodId) {
      setPaymentMethodId(paymentMethods[0].id);
    }
    setPaymentModalOpen(true);
  };

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    try {
      setRecordingPayment(true);
      setPaymentError("");
      const res = await api.recordPayment(invoice.id, {
        amount: paymentAmount,
        payment_method: paymentMethodId,
        payment_date: paymentDate,
        transaction_id: transactionId,
        note: paymentNote,
      });
      setPaymentModalOpen(false);
      setInvoice(res.invoice);
      if (res.payment && confirm("Payment recorded successfully! Would you like to download the official Money Receipt PDF now?")) {
        api.downloadPaymentReceiptPdf(res.payment.id, res.payment.receipt_number);
      }
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  // Delete Payment
  const handleDeletePayment = async (payment: Payment) => {
    if (!confirm(`Are you sure you want to delete payment of ${payment.amount} ${invoice?.currency_symbol}? The invoice status and remaining due will be automatically recalculated.`)) {
      return;
    }
    try {
      setDeletingPaymentId(payment.id);
      await api.deletePayment(payment.id);
      await loadInvoice();
    } catch (err: any) {
      alert("Failed to delete payment: " + (err.message || "Unknown error"));
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Download Money Receipt PDF
  const handleDownloadReceiptPdf = async (payment: Payment) => {
    try {
      setDownloadingReceiptId(payment.id);
      await api.downloadPaymentReceiptPdf(payment.id, payment.receipt_number);
    } catch (err: any) {
      alert("Failed to download Money Receipt: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  // Preview Money Receipt PDF
  const handleOpenReceiptPreview = async (payment: Payment) => {
    try {
      setSelectedReceiptPayment(payment);
      setLoadingReceiptPreview(true);
      setReceiptPreviewOpen(true);
      const blob = await api.getPaymentReceiptPdfBlob(payment.id);
      const url = URL.createObjectURL(blob);
      setReceiptPreviewUrl(url);
    } catch (err: any) {
      alert("Failed to load Money Receipt preview: " + (err.message || "Unknown error"));
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
    setSelectedReceiptPayment(null);
    setReceiptPreviewOpen(false);
  };

  const getMediaUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const host = apiBase.replace(/\/api\/?$/, "");
    return `${host}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const getVerificationUrl = () => {
    if (!invoice) return "https://www.raktch.com/";
    const website = (invoice.company_website || "www.raktch.com").trim();
    const base = website.startsWith("http") ? website : `https://${website}`;
    const cleanBase = base.endsWith("/") ? base : `${base}/`;
    return `${cleanBase}?invoice=${invoice.invoice_number || invoice.id}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: CheckCircle2,
          label: "Paid",
        };
      case "PARTIALLY_PAID":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          icon: Clock,
          label: "Partially Paid",
        };
      case "DRAFT":
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: FileText,
          label: "Draft",
        };
      case "CANCELLED":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertCircle,
          label: "Cancelled",
        };
      default:
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: AlertCircle,
          label: "Unpaid",
        };
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Loading invoice document...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-16 text-center text-slate-500">
        Invoice not found.
      </div>
    );
  }

  const badge = getStatusBadge(invoice.status);
  const StatusIcon = badge.icon;
  const isFullyPaid = invoice.status === "PAID" || parseFloat(invoice.due_amount || "0") <= 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Toolbar (Hidden on Print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-white via-slate-50/50 to-white border border-slate-200/90 print:hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/invoices")}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Invoice #{invoice.invoice_number}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={invoice.status} type="invoice" />
              {parseFloat(invoice.due_amount || "0") > 0 && (
                <span className="text-xs font-semibold text-amber-700">
                  Due: {invoice.due_amount} {invoice.currency_symbol}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Record Payment Button */}
          {isAccountant && !isFullyPaid && (
            <button
              onClick={handleOpenPaymentModal}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <CreditCard size={15} />
              Record Payment
            </button>
          )}

          <a
            href={`/invoices/${invoice.id}/edit`}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Edit size={14} />
            Edit Bill
          </a>

          {/* PDF Preview Button */}
          <button
            onClick={handleOpenPreview}
            disabled={loadingPreview}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
          >
            {loadingPreview ? <Loader2 size={14} className="animate-spin text-cyan-600" /> : <Eye size={14} className="text-cyan-600" />}
            Preview PDF
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-700 hover:bg-cyan-800 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
          >
            {downloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download PDF
          </button>

          {/* Browser Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            <Printer size={15} />
            Print
          </button>
        </div>
      </div>

      {/* Exact A4 Document Layout (Matches user's PDF invoice) */}
      <div className="invoice-paper bg-white text-slate-900 rounded-3xl shadow-[0_15px_40px_-5px_rgba(0,0,0,0.08)] p-8 md:p-12 border border-slate-200/90 print:p-0 print:border-none print:shadow-none print:rounded-none">
        {/* Top Header */}
        <div className="relative border-b-2 border-cyan-500 pb-4 mb-4">
          {/* Top Left Page Badge */}
          <div className="absolute top-0 left-0 bg-lime-500/20 text-lime-800 text-[10px] font-bold px-2 py-0.5 rounded">
            1
          </div>

          {/* Logo & Company Title */}
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <img
                src={getMediaUrl(invoice.logo_url) || "/logo.png"}
                alt="RAKTCH Technology & Software"
                className="h-24 sm:h-28 md:h-32 max-w-full object-contain"
              />
            </div>
            <p className="text-xs sm:text-sm text-slate-700 font-medium leading-normal mt-1">
              {invoice.company_address}
            </p>
            <p className="text-xs sm:text-[13px] text-cyan-700 font-medium mt-1 space-x-2">
              <span className="text-blue-600 underline">{invoice.company_website}</span>
              <span>{invoice.company_email}</span>
              <span className="font-semibold text-slate-700">Phone: {invoice.company_phone}</span>
            </p>
          </div>
        </div>

        {/* Bill Title */}
        <div className="text-center font-bold text-base md:text-lg text-slate-950 my-4 tracking-tight">
          {invoice.title}
        </div>

        {/* Client & Date Section */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-5 text-xs text-slate-700">
          <div>
            <div className="font-bold text-slate-900 text-sm">
              NAME: <span className="font-semibold">{invoice.client_name}</span>
            </div>
            {invoice.client_address && (
              <p className="text-[11px] text-slate-600 whitespace-pre-line mt-0.5 max-w-sm">
                {invoice.client_address}
              </p>
            )}
            {invoice.client_contact_person && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                Attn: {invoice.client_contact_person}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-800">
              Date: <span className="font-normal text-slate-600">{invoice.issue_date}</span>
            </div>
            <div className="font-mono text-[11px] text-slate-500 mt-0.5">
              Invoice #: {invoice.invoice_number}
            </div>
            {invoice.due_date && (
              <div className="text-[11px] text-rose-600 font-medium mt-0.5">
                Due Date: {invoice.due_date}
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs border border-slate-700 border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-900 font-bold border-b border-slate-700">
                <th className="border border-slate-700 p-2 text-center w-10">SL</th>
                <th className="border border-slate-700 p-2 text-left w-52">Name</th>
                <th className="border border-slate-700 p-2 text-left">Technical Specification</th>
                <th className="border border-slate-700 p-2 text-center w-12">Qty</th>
                <th className="border border-slate-700 p-2 text-right w-24">U Price (Tk)</th>
                <th className="border border-slate-700 p-2 text-right w-28">Total (Tk)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="border border-slate-700 p-2 text-center text-slate-600 font-medium">
                      {item.sl || idx + 1}
                    </td>
                    <td className="border border-slate-700 p-2 font-bold text-slate-900">
                      {item.item_name}
                    </td>
                    <td className="border border-slate-700 p-2 text-slate-600 leading-relaxed whitespace-pre-line">
                      {item.technical_specification}
                    </td>
                    <td className="border border-slate-700 p-2 text-center text-slate-800 font-semibold">
                      {item.quantity}
                    </td>
                    <td className="border border-slate-700 p-2 text-right font-mono text-slate-800">
                      {Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="border border-slate-700 p-2 text-right font-mono font-bold text-slate-950">
                      {Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">
                    No items in this invoice
                  </td>
                </tr>
              )}

              {/* Subtotal Row */}
              <tr className="bg-slate-50 font-bold border-t border-slate-700">
                <td colSpan={3} className="border-t border-slate-700 p-2"></td>
                <td className="border border-slate-700 p-2 text-center font-bold text-slate-900">
                  {invoice.items?.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || 1}
                </td>
                <td className="border border-slate-700 p-2 text-right font-bold text-slate-900">
                  Sub Total
                </td>
                <td className="border border-slate-700 p-2 text-right font-mono font-bold text-slate-950">
                  {Number(invoice.sub_total || 0).toFixed(2)}
                </td>
              </tr>

              {/* Discount Row */}
              {Number(invoice.discount || 0) > 0 && (
                <tr>
                  <td colSpan={4} className="border-none p-1"></td>
                  <td className="border border-slate-700 p-2 text-right text-slate-600">Discount</td>
                  <td className="border border-slate-700 p-2 text-right font-mono text-rose-600">
                    -{Number(invoice.discount).toFixed(2)}
                  </td>
                </tr>
              )}

              {/* VAT Row */}
              {Number(invoice.vat_amount || 0) > 0 && (
                <tr>
                  <td colSpan={4} className="border-none p-1"></td>
                  <td className="border border-slate-700 p-2 text-right text-slate-600">
                    VAT ({invoice.vat_rate}%)
                  </td>
                  <td className="border border-slate-700 p-2 text-right font-mono text-slate-800">
                    +{Number(invoice.vat_amount).toFixed(2)}
                  </td>
                </tr>
              )}

              {/* Payable Amount Row */}
              <tr className="bg-slate-100 font-extrabold text-slate-950 border-t-2 border-slate-800">
                <td colSpan={4} className="border-none p-1"></td>
                <td className="border border-slate-700 p-2.5 text-right uppercase tracking-wider text-xs">
                  Payable Amount
                </td>
                <td className="border border-slate-700 p-2.5 text-right font-mono text-sm font-black text-slate-950">
                  {Number(invoice.payable_amount || 0).toFixed(2)}
                </td>
              </tr>

              {/* Advance / Paid Row */}
              {(Number(invoice.advance_amount || 0) > 0 || Number(invoice.paid_amount || 0) > 0) && (
                <tr className="bg-emerald-50/70 text-emerald-900 font-bold">
                  <td colSpan={4} className="border-none p-1"></td>
                  <td className="border border-slate-700 p-2 text-right">
                    Paid / Received
                  </td>
                  <td className="border border-slate-700 p-2 text-right font-mono">
                    {(Number(invoice.advance_amount || 0) + Number(invoice.paid_amount || 0)).toFixed(2)}
                  </td>
                </tr>
              )}

              {/* Due Row */}
              {Number(invoice.due_amount || 0) > 0 && (
                <tr className="bg-amber-50 text-amber-900 font-extrabold">
                  <td colSpan={4} className="border-none p-1"></td>
                  <td className="border border-slate-700 p-2 text-right uppercase text-amber-900">
                    Net Due
                  </td>
                  <td className="border border-slate-700 p-2 text-right font-mono text-sm font-black text-amber-900">
                    {Number(invoice.due_amount).toFixed(2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bank Details (One Side Layout) */}
        {(invoice.bank_name || invoice.account_number) && (
          <div className="mt-4 mb-6 max-w-lg p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/20 border border-slate-200/80 text-xs">
            <div className="font-bold text-slate-900 text-xs mb-2">
              {invoice.nb_text || "[N.B Please send the bill to]"}
            </div>
            <div className="space-y-1 text-slate-700">
              <div>
                <span className="text-slate-500 font-medium">Bank Name:</span>{" "}
                <span className="font-bold text-blue-900">{invoice.bank_name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Account Name:</span>{" "}
                <span className="font-semibold text-slate-800">{invoice.account_name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Acc No:</span>{" "}
                <span className="font-mono font-bold text-slate-900">{invoice.account_number}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Branch:</span>{" "}
                <span className="font-medium text-slate-800">{invoice.branch_name}</span>
                {invoice.routing_number && (
                  <span className="text-slate-500">
                    {" "}| <span className="font-medium">Routing No:</span>{" "}
                    <span className="font-mono font-semibold text-slate-700">{invoice.routing_number}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="flex justify-between items-end pt-12 pb-4 text-xs font-semibold text-slate-800">
          <div className="text-center w-48">
            <div className="h-14"></div>
            <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
              {invoice.received_by_label || "Received by"}
            </div>
          </div>

          <div className="text-center w-48">
            <div className="h-14 flex items-end justify-center mb-1">
              {invoice.signature_url ? (
                <img
                  src={getMediaUrl(invoice.signature_url)}
                  alt="Signature"
                  className="h-12 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="h-12"></div>
              )}
            </div>
            <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
              {invoice.authorization_label || "Authorization"}
            </div>
          </div>
        </div>

        {/* Bottom Footer: QR Code & Website */}
        <div className="border-t border-slate-200 pt-4 mt-8 flex flex-wrap justify-between items-center gap-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <a
              href={getVerificationUrl()}
              target="_blank"
              rel="noopener noreferrer"
              title="Click to open verification URL or scan with phone camera"
              className="block p-1 rounded-lg border border-slate-200 hover:border-cyan-500 bg-white hover:shadow-md transition-all cursor-pointer group"
            >
              {invoice.qr_code_url ? (
                <img
                  src={getMediaUrl(invoice.qr_code_url)}
                  alt="Verification QR Code"
                  className="w-16 h-16 object-contain rounded group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-16 h-16 border border-slate-300 rounded p-1 flex items-center justify-center text-[9px] text-center font-mono">
                  QR CODE
                </div>
              )}
            </a>
            <div>
              <span className="font-semibold text-slate-800 text-xs block">
                Scan to verify bill authenticity
              </span>
              <a
                href={getVerificationUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-cyan-600 hover:text-cyan-700 hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                <span>{invoice.company_website || "www.raktch.com"}</span>
                <span className="text-[10px]">&nearr;</span>
              </a>
            </div>
          </div>

          <div className="text-right">
            <a
              href={getVerificationUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-700 font-semibold hover:underline block text-xs"
            >
              {invoice.company_website || "www.raktch.com"}
            </a>
            <span className="text-[10px] text-slate-400 font-mono">
              Ref: #{invoice.invoice_number}
            </span>
          </div>
        </div>
      </div>

      {/* Payments & Due Settlements Card (Hidden on Print) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Payments & Money Receipts
                </h3>
                <p className="text-xs text-slate-500">
                  Track collections, due balance, and download official Money Receipts
                </p>
              </div>
            </div>
          </div>

          {isAccountant && (
            <button
              onClick={handleOpenPaymentModal}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <CreditCard size={15} />
              Record Payment
            </button>
          )}
        </div>

        {/* Financial Settlement Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Invoiced (Payable)</div>
            <div className="mt-2 text-2xl font-black text-slate-900 font-mono">
              {Number(invoice.payable_amount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{invoice.currency_symbol}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Invoice total after tax/discount</div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="text-xs font-semibold text-emerald-800 uppercase">Total Collected (Paid)</div>
            <div className="mt-2 text-2xl font-black text-emerald-700 font-mono">
              {(Number(invoice.advance_amount || 0) + Number(invoice.paid_amount || 0)).toLocaleString()} <span className="text-xs font-normal text-emerald-800">{invoice.currency_symbol}</span>
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">
              Advance: {invoice.advance_amount || 0} + Paid: {invoice.paid_amount || 0}
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${Number(invoice.due_amount || 0) > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50/50 border-emerald-200"}`}>
            <div className={`text-xs font-semibold uppercase ${Number(invoice.due_amount || 0) > 0 ? "text-amber-800" : "text-emerald-800"}`}>
              Outstanding Due
            </div>
            <div className={`mt-2 text-2xl font-black font-mono ${Number(invoice.due_amount || 0) > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {Number(invoice.due_amount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{invoice.currency_symbol}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {Number(invoice.due_amount || 0) > 0 ? "Requires payment settlement" : "Fully settled & cleared"}
            </div>
          </div>
        </div>

        {/* Payments Table */}
        {invoice.payments && invoice.payments.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Receipt #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Transaction ID</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5 text-center">Money Receipt</th>
                  {isAccountant && <th className="p-3.5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-cyan-700">
                      {p.receipt_number || `MR-${invoice.invoice_number}-${p.id}`}
                    </td>
                    <td className="p-3.5 text-slate-700 font-medium">
                      {p.payment_date}
                    </td>
                    <td className="p-3.5 text-slate-800 font-semibold">
                      {p.payment_method_name || "Cash"}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {p.transaction_id || <span className="text-slate-400 italic">None</span>}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700 text-sm">
                      {Number(p.amount).toFixed(2)} {invoice.currency_symbol}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenReceiptPreview(p)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Preview Money Receipt PDF"
                        >
                          <Eye size={12} className="text-cyan-600" />
                          View Receipt
                        </button>
                        <button
                          onClick={() => handleDownloadReceiptPdf(p)}
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
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleDeletePayment(p)}
                          disabled={deletingPaymentId === p.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Payment (Recalculate Totals)"
                        >
                          {deletingPaymentId === p.id ? (
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
        ) : (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
            <FileCheck size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No Payments Recorded Yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Outstanding due: <span className="font-bold text-amber-700">{invoice.due_amount} {invoice.currency_symbol}</span>
            </p>
            {isAccountant && (
              <button
                onClick={handleOpenPaymentModal}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <CreditCard size={14} />
                Record First Payment
              </button>
            )}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:hidden animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Record Payment</h3>
                  <p className="text-xs text-slate-500">Invoice #{invoice.invoice_number}</p>
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

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Amount ({invoice.currency_symbol}) *
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
                  <span>Remaining Due: {invoice.due_amount} {invoice.currency_symbol}</span>
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(invoice.due_amount)}
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
                  value={paymentMethodId || ""}
                  onChange={(val) => setPaymentMethodId(Number(val))}
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

              {/* Transaction / Reference ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Transaction / Cheque ID
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN-998822 or Cheque #104291"
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
                  placeholder="e.g. Received via Islami Bank Transfer"
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
                  disabled={recordingPayment || !paymentAmount}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {recordingPayment ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice PDF Interactive Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 print:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Invoice PDF Document Preview</h3>
                  <p className="text-xs text-slate-500">Invoice #{invoice.invoice_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-700 hover:bg-cyan-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {downloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  Download PDF
                </button>
                <button
                  onClick={handleClosePreview}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-hidden relative">
              {loadingPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 text-slate-500 gap-3">
                  <Loader2 size={32} className="animate-spin text-cyan-600" />
                  <span className="text-sm font-medium">Generating official invoice PDF...</span>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  title="PDF Preview"
                  className="w-full h-full rounded-xl border border-slate-300 shadow-inner bg-white"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  Failed to load preview.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Money Receipt PDF Interactive Preview Modal */}
      {receiptPreviewOpen && selectedReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 print:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Money Receipt Document Preview</h3>
                  <p className="text-xs text-slate-500">
                    Receipt #{selectedReceiptPayment.receipt_number || selectedReceiptPayment.id} • Invoice #{invoice.invoice_number}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadReceiptPdf(selectedReceiptPayment)}
                  disabled={downloadingReceiptId === selectedReceiptPayment.id}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {downloadingReceiptId === selectedReceiptPayment.id ? (
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
