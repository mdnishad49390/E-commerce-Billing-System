"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  Client,
  Company,
  BankAccount,
  Service,
  InvoiceTemplate,
  Invoice,
  InvoiceItem,
} from "@/lib/api";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Dropdown } from "@/components/common";

interface InvoiceFormProps {
  initialData?: Invoice;
  isEdit?: boolean;
}

export default function InvoiceForm({ initialData, isEdit }: InvoiceFormProps) {
  const router = useRouter();
  const { isAccountant, isStaff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Base options
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);

  // Form State
  const [clientId, setClientId] = useState<number | "">("");
  const [companyId, setCompanyId] = useState<number | "">("");
  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [templateId, setTemplateId] = useState<number | "">("");

  const [title, setTitle] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "CANCELLED">(
    !isAccountant ? "DRAFT" : "ISSUED"
  );

  const [nbText, setNbText] = useState("[N.B Please send the bill to]");
  const [authLabel, setAuthLabel] = useState("Authorization");
  const [recvLabel, setRecvLabel] = useState("Received by");
  const [notes, setNotes] = useState("");

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      sl: 1,
      service: null,
      item_name: "",
      technical_specification: "",
      quantity: 1,
      unit_price: "" as any,
      total: 0,
    },
  ]);

  // Adjustments
  const [discount, setDiscount] = useState("0.00");
  const [vatRate, setVatRate] = useState("0.00");
  const [advanceAmount, setAdvanceAmount] = useState("0.00");

  useEffect(() => {
    async function loadOptions() {
      try {
        const [cRes, compRes, bRes, sRes, tRes] = await Promise.all([
          api.getClients(),
          api.getCompanies(),
          api.getBankAccounts(),
          api.getServices(),
          api.getTemplates(),
        ]);

        setClients(cRes.results || []);
        setCompanies(compRes.results || []);
        setBankAccounts(bRes.results || []);
        setServices(sRes.results || []);
        setTemplates(tRes.results || []);

        if (!initialData) {
          const defaultComp = compRes.results?.find((c) => c.is_default) || compRes.results?.[0];
          if (defaultComp) setCompanyId(defaultComp.id);

          const defaultBank = bRes.results?.find((b) => b.is_default) || bRes.results?.[0];
          if (defaultBank) setBankAccountId(defaultBank.id);

          const defaultTemp = tRes.results?.find((t) => t.is_default) || tRes.results?.[0];
          if (defaultTemp) {
            setTemplateId(defaultTemp.id);
            setNbText(defaultTemp.nb_text);
            setAuthLabel(defaultTemp.authorization_label);
            setRecvLabel(defaultTemp.received_by_label);
          }

          // Keep Title and Billing Month blank for new bills
          setTitle("");
          setBillingMonth("");
        } else {
          setClientId(initialData.client);
          setCompanyId(initialData.company);
          setBankAccountId(initialData.bank_account || "");
          setTemplateId(initialData.template || "");
          setTitle(initialData.title);
          setBillingMonth(initialData.billing_month || "");
          setIssueDate(initialData.issue_date);
          setDueDate(initialData.due_date || "");
          setStatus(initialData.status);
          setDiscount(initialData.discount);
          setVatRate(initialData.vat_rate);
          setAdvanceAmount(initialData.advance_amount);
          setNbText(initialData.nb_text);
          setAuthLabel(initialData.authorization_label);
          setRecvLabel(initialData.received_by_label);
          setNotes(initialData.notes || "");
          if (initialData.items && initialData.items.length > 0) {
            setItems(initialData.items);
          }
        }
      } catch (err) {
        console.error("Failed to load options:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOptions();
  }, [initialData]);

  const handleClientChange = (cId: number) => {
    setClientId(cId);
  };

  const handleItemServiceChange = (index: number, sId: number | "") => {
    const newItems = [...items];
    const targetService = services.find((s) => s.id === Number(sId));
    if (targetService) {
      const selectedClient = clients.find((c) => c.id === clientId);
      const customPricing = selectedClient?.client_services?.find((cs) => cs.service === targetService.id);

      const price = customPricing ? parseFloat(customPricing.custom_price) : parseFloat(targetService.default_price);
      const spec = customPricing?.custom_tech_specification || targetService.default_tech_specification;
      const sName = customPricing?.custom_name || targetService.name;

      newItems[index] = {
        ...newItems[index],
        service: targetService.id,
        item_name: billingMonth ? `${sName} (${billingMonth})` : sName,
        technical_specification: spec || "",
        unit_price: price,
        total: (Number(newItems[index].quantity) || 1) * price,
      };

      if (!title) {
        setTitle(billingMonth ? `${sName} Monthly Bill (${billingMonth})` : `${sName} Bill`);
      }
    } else {
      newItems[index].service = null;
    }
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    if (field === "quantity" || field === "unit_price") {
      const q = parseFloat(newItems[index].quantity as any) || 0;
      const u = parseFloat(newItems[index].unit_price as any) || 0;
      newItems[index].total = q * u;
    }
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        sl: items.length + 1,
        service: null,
        item_name: "",
        technical_specification: "",
        quantity: 1,
        unit_price: "" as any,
        total: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const filtered = items.filter((_, i) => i !== index).map((item, idx) => ({ ...item, sl: idx + 1 }));
    setItems(filtered);
  };

  // Live Math Calculations
  const calculatedSubtotal = items.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  const discountVal = parseFloat(discount || "0") || 0;
  const taxBase = Math.max(calculatedSubtotal - discountVal, 0);
  const vatRateVal = parseFloat(vatRate || "0") || 0;
  const calculatedVat = (taxBase * (vatRateVal / 100));
  const calculatedPayable = taxBase + calculatedVat;
  const advanceVal = parseFloat(advanceAmount || "0") || 0;
  const calculatedDue = Math.max(calculatedPayable - advanceVal, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError("Please select a client.");
      return;
    }
    if (!companyId) {
      setError("Please select a company.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const selectedClient = clients.find((c) => c.id === clientId);
      const finalTitle = title.trim() || `${selectedClient?.name || "Client"} Monthly Bill (${billingMonth || "Current"})`;

      const preparedItems = items.map((it, idx) => ({
        sl: it.sl || idx + 1,
        service: it.service || null,
        item_name: it.item_name?.trim() || `Service Item #${idx + 1}`,
        technical_specification: it.technical_specification?.trim() || "",
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0,
      }));

      if (preparedItems.length === 0) {
        setError("Please add at least one line item.");
        setSubmitting(false);
        return;
      }

      const payload = {
        client: Number(clientId),
        company: Number(companyId),
        bank_account: bankAccountId ? Number(bankAccountId) : null,
        template: templateId ? Number(templateId) : null,
        title: finalTitle,
        billing_month: billingMonth || "",
        issue_date: issueDate || new Date().toISOString().split("T")[0],
        due_date: dueDate ? dueDate : null,
        status,
        discount: discountVal.toFixed(2),
        vat_rate: vatRateVal.toFixed(2),
        advance_amount: advanceVal.toFixed(2),
        nb_text: nbText || "",
        authorization_label: authLabel || "Authorization",
        received_by_label: recvLabel || "Received by",
        notes: notes || "",
        items: preparedItems,
      };

      if (isEdit && initialData) {
        await api.updateInvoice(initialData.id, payload);
        router.push(`/invoices/${initialData.id}`);
      } else {
        const created = await api.createInvoice(payload);
        router.push(`/invoices/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Loading invoice form...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/invoices"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
          >
            <ArrowLeft size={18} />
          </a>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isEdit ? "Edit Invoice" : "Create New Bill"}
            </h2>
            <p className="text-xs text-slate-500">Fill in client information, service line items and pricing</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save size={17} />
          )}
          <span>{isEdit ? "Update Invoice" : "Generate Invoice"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Basic Settings Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-20 overflow-visible">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <span className="w-7 h-7 rounded-xl bg-cyan-100 text-cyan-700 font-black text-xs flex items-center justify-center shadow-xs">
            1
          </span>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Bill & Client Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Client */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Client / Customer *
            </label>
            <Dropdown
              required
              value={clientId}
              onChange={(val) => {
                if (val) {
                  handleClientChange(Number(val));
                } else {
                  setClientId("");
                }
              }}
              options={clients.map((c) => ({
                value: c.id,
                label: c.name,
                secondary: c.phone || c.email || undefined,
              }))}
              placeholder="Select a client..."
              searchable={true}
              searchPlaceholder="Search client name..."
              size="md"
            />
          </div>

          {/* Billing Month */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Billing Month
            </label>
            <input
              type="text"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              placeholder="e.g. April-2026"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
            />
          </div>

          {/* Issue Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Issue Date
            </label>
            <input
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Invoice Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Invoice Title / Header
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Supershop Software Monthly Bill (April-2026)"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
          />
        </div>

        {/* Company & Bank Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Issuing Company
            </label>
            <Dropdown
              required
              value={companyId}
              onChange={(val) => setCompanyId(val ? Number(val) : "")}
              options={companies.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              placeholder="Select a company..."
              size="md"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Bank Account for Payment
            </label>
            <Dropdown
              value={bankAccountId}
              onChange={(val) => setBankAccountId(val ? Number(val) : "")}
              options={[
                { value: "", label: "(No Bank Account)" },
                ...bankAccounts.map((b) => ({
                  value: b.id,
                  label: `${b.bank_name} - ${b.account_number}`,
                  secondary: `A/C Name: ${b.account_name}`,
                })),
              ]}
              placeholder="(No Bank Account)"
              size="md"
            />
          </div>
        </div>
      </div>

      {/* Items Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10 overflow-visible">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shadow-xs">
              2
            </span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Service Line Items
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus size={15} />
            Add Row
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="p-4 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/20 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-end shadow-xs hover:border-cyan-300 hover:shadow-[0_4px_15px_-2px_rgba(6,182,212,0.12)] transition-all relative"
            >
              {/* SL */}
              <div className="md:col-span-1">
                <span className="block text-[11px] font-bold text-slate-400 uppercase mb-1">SL</span>
                <span className="font-mono text-sm text-cyan-700 font-bold block py-2">{index + 1}</span>
              </div>

              {/* Service Select */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Preset Service
                </label>
                <Dropdown
                  value={item.service || ""}
                  onChange={(val) => handleItemServiceChange(index, val ? Number(val) : "")}
                  options={[
                    { value: "", label: "(Custom Item)" },
                    ...services.map((s) => ({
                      value: s.id,
                      label: s.name,
                      secondary: `${s.default_price} Tk`,
                      badge: `${s.default_price} Tk`,
                    })),
                  ]}
                  placeholder="(Custom Item)"
                  size="sm"
                />
              </div>

              {/* Item Name */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={item.item_name}
                  onChange={(e) => handleItemChange(index, "item_name", e.target.value)}
                  placeholder="e.g. 1. Supershop Software"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Technical Spec */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Technical Spec
                </label>
                <input
                  type="text"
                  value={item.technical_specification}
                  onChange={(e) => handleItemChange(index, "technical_specification", e.target.value)}
                  placeholder="Hosting & Maintenance"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Unit Price */}
              <div className="md:col-span-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Price (Tk)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={item.unit_price}
                  placeholder="0.00"
                  onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs text-right focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                />
              </div>

              {/* Total */}
              <div className="md:col-span-1 text-right">
                <span className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Total</span>
                <span className="font-bold text-sm text-slate-900 block py-2">
                  {Number(item.total).toLocaleString()}
                </span>
              </div>

              {/* Remove */}
              <div className="md:col-span-1 text-center">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financials & Live Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Extra Notes & Text Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 space-y-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shadow-xs">
              3
            </span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Labels & Bank Instructions
            </h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Payment Instruction Header
            </label>
            <input
              type="text"
              value={nbText}
              onChange={(e) => setNbText(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Left Sign Label
              </label>
              <input
                type="text"
                value={authLabel}
                onChange={(e) => setAuthLabel(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Right Sign Label
              </label>
              <input
                type="text"
                value={recvLabel}
                onChange={(e) => setRecvLabel(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Live Calculation Panel Card */}
        <div className="bg-gradient-to-br from-white via-cyan-50/20 to-emerald-50/20 border border-cyan-200/80 rounded-3xl p-6 md:p-8 space-y-4 shadow-[0_10px_30px_-5px_rgba(6,182,212,0.12)] relative overflow-hidden">
          <div className="flex items-center gap-2.5 pb-2 border-b border-cyan-100">
            <span className="w-7 h-7 rounded-xl bg-cyan-100 text-cyan-800 font-black text-xs flex items-center justify-center shadow-xs">
              4
            </span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Live Calculation Summary
            </h3>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span className="font-semibold">Sub Total:</span>
              <span className="font-bold text-slate-900">{calculatedSubtotal.toLocaleString()} Tk</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-600">Discount (Tk):</span>
              <input
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-28 px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-right text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-semibold shadow-2xs"
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-600">VAT (%):</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  placeholder="0.00"
                  className="w-20 px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-right text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-semibold shadow-2xs"
                />
                <span className="text-xs text-slate-500">({calculatedVat.toFixed(2)} Tk)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-cyan-50/80 border border-cyan-100/90 flex justify-between items-center text-base font-bold text-cyan-900">
              <span>Payable Amount:</span>
              <span>{calculatedPayable.toLocaleString()} Tk</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-600">Advance Paid (Tk):</span>
              <input
                type="number"
                step="0.01"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                className="w-28 px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-900 text-right text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-semibold shadow-2xs"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/90 flex justify-between items-center text-lg font-black text-amber-700 shadow-2xs">
              <span>Net Due:</span>
              <span>{calculatedDue.toLocaleString()} Tk</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
