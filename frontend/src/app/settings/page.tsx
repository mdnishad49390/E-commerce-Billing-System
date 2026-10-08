"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  api,
  Company,
  BankAccount,
  GlobalSettings,
  InvoiceTemplate,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Building2,
  Landmark,
  Settings as SettingsIcon,
  FileSpreadsheet,
  Save,
  Check,
  RefreshCw,
  Plus,
  ChevronDown,
  CheckCircle2,
  Trash2,
  X,
} from "lucide-react";

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [activeTab, setActiveTab] = useState<"company" | "bank" | "template" | "global" | "automation">("company");

  // State
  const [company, setCompany] = useState<Company | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);

  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [creatingBank, setCreatingBank] = useState(false);
  const [newBankForm, setNewBankForm] = useState({
    bank_name: "",
    account_name: "",
    account_number: "",
    branch_name: "",
    routing_number: "",
    is_default: false,
  });

  const bankDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        bankDropdownRef.current &&
        !bankDropdownRef.current.contains(e.target as Node)
      ) {
        setIsBankDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const [compRes, bankRes, setRes, tempRes] = await Promise.all([
        api.getCompanies(),
        api.getBankAccounts(),
        api.getSettings(),
        api.getTemplates(),
      ]);

      const loadedCompany = compRes.results?.[0] || null;
      setCompany(loadedCompany);

      const loadedBanks = bankRes.results || [];
      setBankAccounts(loadedBanks);
      const activeBank =
        loadedBanks.find((b: BankAccount) => b.is_default) ||
        loadedBanks[0] ||
        null;
      setBankAccount(activeBank ? { ...activeBank } : null);

      setSettings(setRes.results?.[0] || null);
      setTemplate(tempRes.results?.[0] || null);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg("Only administrators can update settings.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      if (activeTab === "company" && company) {
        await api.updateCompany(company.id, company);
      } else if (activeTab === "bank" && bankAccount) {
        const updated = await api.updateBankAccount(bankAccount.id, bankAccount);
        const bankRes = await api.getBankAccounts();
        const updatedList = bankRes.results || [];
        setBankAccounts(updatedList);
        setBankAccount({ ...updated });
      } else if (activeTab === "template" && template) {
        await api.updateTemplate(template.id, template);
      } else if ((activeTab === "global" || activeTab === "automation") && settings) {
        await api.updateSettings(settings.id, settings);
      }

      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  const openAddBankModal = () => {
    setNewBankForm({
      bank_name: "",
      account_name: company?.name || "RAKTCH TECHNOLOGY AND SOFTWARE",
      account_number: "",
      branch_name: "",
      routing_number: "",
      is_default: bankAccounts.length === 0,
    });
    setIsAddBankModalOpen(true);
  };

  const handleCreateBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg("Only administrators can add bank accounts.");
      return;
    }

    try {
      setCreatingBank(true);
      setErrorMsg("");
      const created = await api.createBankAccount({
        ...newBankForm,
        company: company?.id,
      });

      const bankRes = await api.getBankAccounts();
      const updatedList = bankRes.results || [];
      setBankAccounts(updatedList);
      setBankAccount({ ...created });
      setIsAddBankModalOpen(false);
      setSuccessMsg(`Bank account "${created.bank_name}" added and selected!`);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create bank account.");
    } finally {
      setCreatingBank(false);
    }
  };

  const handleDeleteBank = async (bankId: number) => {
    if (!isAdmin) return;
    if (bankAccounts.length <= 1) {
      setErrorMsg("You must keep at least one bank account in system settings.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    if (!confirm("Are you sure you want to remove this bank account?")) return;

    try {
      await api.deleteBankAccount(bankId);
      const bankRes = await api.getBankAccounts();
      const updatedList = bankRes.results || [];
      setBankAccounts(updatedList);
      const nextActive =
        updatedList.find((b: BankAccount) => b.is_default) ||
        updatedList[0] ||
        null;
      setBankAccount(nextActive ? { ...nextActive } : null);
      setSuccessMsg("Bank account removed successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete bank account.");
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Loading configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h2>
        <p className="text-slate-500 text-sm">Configure company profile, bank routing, invoice patterns and defaults</p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <Check size={16} />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap p-1.5 bg-slate-100/90 border border-slate-200/80 rounded-2xl gap-1.5 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab("company")}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "company"
              ? "bg-white text-cyan-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Building2 size={16} className={activeTab === "company" ? "text-cyan-600" : "text-slate-400"} />
          Company Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bank")}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "bank"
              ? "bg-white text-cyan-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Landmark size={16} className={activeTab === "bank" ? "text-cyan-600" : "text-slate-400"} />
          Bank Account
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("template")}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "template"
              ? "bg-white text-cyan-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <FileSpreadsheet size={16} className={activeTab === "template" ? "text-cyan-600" : "text-slate-400"} />
          Invoice Template
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("global")}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "global"
              ? "bg-white text-cyan-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <SettingsIcon size={16} className={activeTab === "global" ? "text-cyan-600" : "text-slate-400"} />
          Global Defaults
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("automation")}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "automation"
              ? "bg-white text-cyan-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200/70"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <RefreshCw size={16} className={activeTab === "automation" ? "text-cyan-600" : "text-slate-400"} />
          Automated Billing
        </button>
      </div>

      {/* Form Content Card */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 space-y-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
        {/* Soft top border highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>

        {/* Company Tab */}
        {activeTab === "company" && company && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              Company Branding & Contact
            </h3>
            
            {/* Active Logo Preview */}
            <div className="p-4 bg-gradient-to-r from-cyan-50/50 via-white to-blue-50/40 border border-cyan-100/90 rounded-2xl flex items-center justify-between shadow-[0_2px_15px_-3px_rgba(6,182,212,0.1)]">
              <div>
                <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Active Brand Logo
                </span>
                <span className="text-xs text-slate-500">
                  Displayed on all invoices, bills, and navigation header.
                </span>
              </div>
              <div className="bg-white p-2.5 border border-slate-200 rounded-xl shadow-xs">
                <img
                  src="/logo.jpg"
                  alt="Company Logo"
                  className="h-12 object-contain"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={company.tagline}
                  onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Official Address
              </label>
              <textarea
                rows={2}
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Website
                </label>
                <input
                  type="text"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email(s)
                </label>
                <input
                  type="text"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Phone
                </label>
                <input
                  type="text"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bank Tab */}
        {activeTab === "bank" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Landmark size={18} className="text-cyan-600" />
                  Bank & Remittance Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure payout and remittance routing details used on invoice PDFs and receipts
                </p>
              </div>
              <button
                type="button"
                onClick={openAddBankModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer self-start sm:self-auto"
              >
                <Plus size={15} />
                Add Bank Account
              </button>
            </div>

            {!bankAccount && bankAccounts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl">
                <Landmark size={36} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-bold text-slate-700">No Bank Accounts Found</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Add a bank account so clients know where to send payments and wire transfers.
                </p>
                <button
                  type="button"
                  onClick={openAddBankModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Plus size={15} />
                  Add Bank Account
                </button>
              </div>
            ) : bankAccount ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bank Name with Dropdown */}
                  <div className="relative" ref={bankDropdownRef}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Bank Name
                      </label>
                      {bankAccounts.length > 1 && (
                        <span className="text-[11px] text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-full font-medium">
                          {bankAccounts.length} accounts available
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={bankAccount.bank_name}
                        onClick={() => setIsBankDropdownOpen((prev) => !prev)}
                        onChange={(e) =>
                          setBankAccount({ ...bankAccount, bank_name: e.target.value })
                        }
                        placeholder="Click to select or enter bank name..."
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs font-semibold cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setIsBankDropdownOpen((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Show all added banks"
                      >
                        <ChevronDown
                          size={18}
                          className={`transition-transform duration-200 ${
                            isBankDropdownOpen ? "rotate-180 text-cyan-600" : ""
                          }`}
                        />
                      </button>
                    </div>

                    {/* Dropdown Menu */}
                    {isBankDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-3.5 py-2 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <span>Choose Bank Account</span>
                          <span>{bankAccounts.length} added</span>
                        </div>

                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                          {bankAccounts.map((b) => {
                            const isSelected = bankAccount.id === b.id;
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  setBankAccount({ ...b });
                                  setIsBankDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-cyan-50/60 transition-colors cursor-pointer ${
                                  isSelected
                                    ? "bg-cyan-50/90 text-cyan-900 font-semibold"
                                    : "text-slate-800"
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 truncate">
                                      {b.bank_name}
                                    </span>
                                    {b.is_default && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2">
                                    <span className="font-mono">A/C: {b.account_number}</span>
                                    {b.branch_name && <span>• {b.branch_name}</span>}
                                  </div>
                                </div>

                                {isSelected && (
                                  <CheckCircle2 size={16} className="text-cyan-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <div className="p-2 bg-slate-50/60 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setIsBankDropdownOpen(false);
                              openAddBankModal();
                            }}
                            className="w-full py-2 px-3 flex items-center justify-center gap-2 text-xs font-bold text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Plus size={14} />
                            Add New Bank Account
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={bankAccount.account_name}
                      onChange={(e) =>
                        setBankAccount({ ...bankAccount, account_name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={bankAccount.account_number}
                      onChange={(e) =>
                        setBankAccount({ ...bankAccount, account_number: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      value={bankAccount.branch_name}
                      onChange={(e) =>
                        setBankAccount({ ...bankAccount, branch_name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Routing Number
                    </label>
                    <input
                      type="text"
                      value={bankAccount.routing_number}
                      onChange={(e) =>
                        setBankAccount({ ...bankAccount, routing_number: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bankAccount.is_default}
                          onChange={(e) =>
                            setBankAccount({ ...bankAccount, is_default: e.target.checked })
                          }
                          className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          Set as Default Bank Account
                        </span>
                      </label>
                      {bankAccounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBank(bankAccount.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1 font-semibold cursor-pointer"
                          title="Delete this bank account"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Template Tab */}
        {activeTab === "template" && template && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 mb-4">Default Invoice Format</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Title Pattern
              </label>
              <input
                type="text"
                value={template.title_pattern}
                onChange={(e) => setTemplate({ ...template, title_pattern: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Placeholders: {"{service_name}"}, {"{month_year}"}, {"{client_name}"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Invoice Number Prefix
                </label>
                <input
                  type="text"
                  value={template.invoice_number_prefix}
                  onChange={(e) => setTemplate({ ...template, invoice_number_prefix: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Bank Instructions Header (N.B Text)
                </label>
                <input
                  type="text"
                  value={template.nb_text}
                  onChange={(e) => setTemplate({ ...template, nb_text: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Left Sign Label
                </label>
                <input
                  type="text"
                  value={template.authorization_label}
                  onChange={(e) => setTemplate({ ...template, authorization_label: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Right Sign Label
                </label>
                <input
                  type="text"
                  value={template.received_by_label}
                  onChange={(e) => setTemplate({ ...template, received_by_label: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Global Tab */}
        {activeTab === "global" && settings && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 mb-4">Currency & Global System Notes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={settings.currency_symbol}
                  onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Currency ISO Code
                </label>
                <input
                  type="text"
                  value={settings.currency_code}
                  onChange={(e) => setSettings({ ...settings, currency_code: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Footer Note (Displayed on bills)
              </label>
              <input
                type="text"
                value={settings.invoice_footer_note}
                onChange={(e) => setSettings({ ...settings, invoice_footer_note: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* Automation Tab */}
        {activeTab === "automation" && settings && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Automated Recurring Billing</h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure when and how monthly subscription invoices are created automatically.
              </p>
            </div>

            {/* Global Switch */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <span className="text-sm font-bold text-slate-800 block">Enable Automatic Billing</span>
                <span className="text-xs text-slate-500">
                  When active, invoices for all active recurring subscriptions will generate automatically on schedule.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.auto_billing_enabled)}
                  onChange={(e) => setSettings({ ...settings, auto_billing_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Billing Day of Month (1 - 31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={settings.auto_billing_day ?? 1}
                  onChange={(e) => setSettings({ ...settings, auto_billing_day: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs font-bold"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Months with fewer days (e.g. Feb 28/29 or Apr 30) automatically adjust to the month's final day.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Trigger Time (HH:MM)
                </label>
                <input
                  type="time"
                  value={settings.auto_billing_time || "00:00"}
                  onChange={(e) => setSettings({ ...settings, auto_billing_time: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Time of day when the scheduler activates.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Timezone
                </label>
                <input
                  type="text"
                  value={settings.auto_billing_timezone || "Asia/Dhaka"}
                  onChange={(e) => setSettings({ ...settings, auto_billing_timezone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Default: Asia/Dhaka
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200/70 text-cyan-900 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <RefreshCw size={14} className="text-cyan-700" />
                Scheduler & Run Audit:
              </span>
              <p>
                To monitor run status, preview next bills, or trigger runs on demand, visit the{" "}
                <a href="/recurring-runs" className="underline font-bold text-cyan-800 hover:text-cyan-900">
                  Recurring Runs Audit Page
                </a>.
              </p>
            </div>
          </div>
        )}

        {/* Save Button */}
        {isAdmin && (
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save size={16} />
              )}
              Save Changes
            </button>
          </div>
        )}
      </form>

      {/* Add Bank Account Modal */}
      {isAddBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Landmark size={20} className="text-cyan-600" />
                  Add Bank Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter bank and routing details for official billing remittances
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBankModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBankSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bank Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBankForm.bank_name}
                  onChange={(e) => setNewBankForm({ ...newBankForm, bank_name: e.target.value })}
                  placeholder="e.g. Islami Bank PLC, City Bank PLC, BRAC Bank"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Account Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBankForm.account_name}
                  onChange={(e) => setNewBankForm({ ...newBankForm, account_name: e.target.value })}
                  placeholder="e.g. RAKTCH TECHNOLOGY AND SOFTWARE"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newBankForm.account_number}
                    onChange={(e) => setNewBankForm({ ...newBankForm, account_number: e.target.value })}
                    placeholder="e.g. 20502180100311104"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={newBankForm.branch_name}
                    onChange={(e) => setNewBankForm({ ...newBankForm, branch_name: e.target.value })}
                    placeholder="e.g. Haji Camp, Uttara"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Routing Number
                </label>
                <input
                  type="text"
                  value={newBankForm.routing_number}
                  onChange={(e) => setNewBankForm({ ...newBankForm, routing_number: e.target.value })}
                  placeholder="e.g. 125261995"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBankForm.is_default}
                    onChange={(e) => setNewBankForm({ ...newBankForm, is_default: e.target.checked })}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Set as default bank account for new invoices
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddBankModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBank}
                  className="px-5 py-2 text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creatingBank ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check size={14} />
                  )}
                  Save Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
