"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  api,
  Company,
  BankAccount,
  GlobalSettings,
  InvoiceTemplate,
  ProjectStatus,
  ProjectPriority,
  BillingMethod,
  DocumentCategory,
  ProjectRolePermission,
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
  FolderKanban,
  ArrowUp,
  ArrowDown,
  Edit2,
  AlertTriangle,
  Lock,
  Shield,
  Palette,
  Eye,
} from "lucide-react";

type AnyOption = (ProjectStatus | ProjectPriority | BillingMethod | DocumentCategory) & {
  in_use_count?: number;
  is_closed?: boolean;
  is_initial?: boolean;
  allow_staff_set?: boolean;
  weight?: number;
};

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [activeTab, setActiveTab] = useState<
    "company" | "bank" | "template" | "global" | "automation" | "projects"
  >("company");

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

  // Projects Sub-sections & Options
  const [projectSubTab, setProjectSubTab] = useState<
    "options" | "code_format" | "file_rules" | "permissions"
  >("options");
  const [optionType, setOptionType] = useState<
    "statuses" | "priorities" | "billing-methods" | "document-categories"
  >("statuses");
  const [projStatuses, setProjStatuses] = useState<ProjectStatus[]>([]);
  const [projPriorities, setProjPriorities] = useState<ProjectPriority[]>([]);
  const [projBillingMethods, setProjBillingMethods] = useState<BillingMethod[]>([]);
  const [projDocCategories, setProjDocCategories] = useState<DocumentCategory[]>([]);
  const [projPermissions, setProjPermissions] = useState<ProjectRolePermission[]>([]);

  // Option Modal State
  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<AnyOption | null>(null);
  const [optionForm, setOptionForm] = useState({
    name: "",
    name_bn: "",
    color: "#6366F1",
    is_default: false,
    is_active: true,
    is_closed: false,
    is_initial: false,
    allow_staff_set: true,
    weight: 0,
  });
  const [optionModalError, setOptionModalError] = useState<string | null>(null);
  const [optionModalSaving, setOptionModalSaving] = useState(false);

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

  const loadProjectOptionsData = useCallback(async () => {
    try {
      const [stRes, prRes, bmRes, dcRes, permRes] = await Promise.all([
        api.getProjectOptions<ProjectStatus>("statuses"),
        api.getProjectOptions<ProjectPriority>("priorities"),
        api.getProjectOptions<BillingMethod>("billing-methods"),
        api.getProjectOptions<DocumentCategory>("document-categories"),
        api.getProjectPermissions(),
      ]);
      setProjStatuses(stRes.results || []);
      setProjPriorities(prRes.results || []);
      setProjBillingMethods(bmRes.results || []);
      setProjDocCategories(dcRes.results || []);
      setProjPermissions(permRes.results || []);
    } catch (err: unknown) {
      console.error("Failed to load project options:", err);
    }
  }, []);

  const loadSettingsData = useCallback(async () => {
    try {
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

      if (isAdmin) {
        await loadProjectOptionsData();
      }
    } catch (err: unknown) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, loadProjectOptionsData]);

  useEffect(() => {
    let isSubscribed = true;
    (async () => {
      if (isSubscribed) {
        await loadSettingsData();
      }
    })();
    return () => {
      isSubscribed = false;
    };
  }, [loadSettingsData]);

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
      } else if (
        (activeTab === "global" ||
          activeTab === "automation" ||
          activeTab === "projects") &&
        settings
      ) {
        await api.updateSettings(settings.id, settings);
      }

      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update settings.";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const openAddBankModal = () => {
    setNewBankForm({
      bank_name: "",
      account_name: "",
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create bank account.";
      setErrorMsg(msg);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete bank account.";
      setErrorMsg(msg);
    }
  };

  // Helper: Get active list of options based on optionType
  const getCurrentOptionList = (): AnyOption[] => {
    switch (optionType) {
      case "statuses":
        return projStatuses;
      case "priorities":
        return projPriorities;
      case "billing-methods":
        return projBillingMethods;
      case "document-categories":
        return projDocCategories;
    }
  };

  // Move Option Up / Down (Reorder)
  const handleMoveOption = async (index: number, direction: "up" | "down") => {
    if (!isAdmin) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const currentList = getCurrentOptionList();
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const newList = [...currentList];
    const [moved] = newList.splice(index, 1);
    newList.splice(targetIndex, 0, moved);

    const payload = newList.map((item, idx) => ({
      id: item.id,
      sort_order: idx + 1,
    }));

    try {
      await api.reorderProjectOptions(optionType, payload);
      await loadProjectOptionsData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reorder options.";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 3500);
    }
  };

  // Toggle Active on Option
  const handleToggleActiveOption = async (option: AnyOption) => {
    if (!isAdmin) return;
    try {
      await api.updateProjectOption(optionType, option.id, {
        is_active: !option.is_active,
      });
      await loadProjectOptionsData();
      setSuccessMsg(
        `Option "${option.name}" ${!option.is_active ? "activated" : "deactivated"} successfully.`
      );
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update option status.";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  // Delete Option
  const handleDeleteOption = async (option: AnyOption) => {
    if (!isAdmin) return;
    if ((option.in_use_count || 0) > 0) {
      setErrorMsg(
        `Cannot delete "${option.name}" because it is in use by ${option.in_use_count} record(s). Deactivate it instead.`
      );
      setTimeout(() => setErrorMsg(""), 5000);
      return;
    }
    if (!confirm(`Are you sure you want to delete "${option.name}"?`)) return;

    try {
      await api.deleteProjectOption(optionType, option.id);
      await loadProjectOptionsData();
      setSuccessMsg(`Option "${option.name}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete option.";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4000);
    }
  };

  // Open Option Modal (Add or Edit)
  const openOptionModal = (option?: AnyOption) => {
    if (option) {
      setEditingOption(option);
      setOptionForm({
        name: option.name,
        name_bn: option.name_bn || "",
        color: option.color || "#6366F1",
        is_default: option.is_default || false,
        is_active: option.is_active !== false,
        is_closed: option.is_closed || false,
        is_initial: option.is_initial || false,
        allow_staff_set: option.allow_staff_set !== false,
        weight: option.weight || 0,
      });
    } else {
      setEditingOption(null);
      setOptionForm({
        name: "",
        name_bn: "",
        color: "#6366F1",
        is_default: false,
        is_active: true,
        is_closed: false,
        is_initial: false,
        allow_staff_set: true,
        weight: 0,
      });
    }
    setOptionModalError(null);
    setIsOptionModalOpen(true);
  };

  // Save Option (Add / Edit)
  const handleSaveOptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optionForm.name.trim()) {
      setOptionModalError("Option name is required.");
      return;
    }

    try {
      setOptionModalSaving(true);
      setOptionModalError(null);

      const payload: Record<string, string | number | boolean | undefined> = {
        name: optionForm.name.trim(),
        name_bn: optionForm.name_bn.trim() || undefined,
        color: optionForm.color,
        is_default: optionForm.is_default,
        is_active: optionForm.is_active,
      };

      if (optionType === "statuses") {
        payload.is_closed = optionForm.is_closed;
        payload.is_initial = optionForm.is_initial;
        payload.allow_staff_set = optionForm.allow_staff_set;
      } else if (optionType === "priorities") {
        payload.weight = optionForm.weight;
      }

      if (editingOption) {
        await api.updateProjectOption(optionType, editingOption.id, payload);
      } else {
        await api.createProjectOption(optionType, payload);
      }

      setIsOptionModalOpen(false);
      await loadProjectOptionsData();
      setSuccessMsg(
        editingOption ? "Option updated successfully." : "Option created successfully."
      );
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save option.";
      setOptionModalError(msg);
    } finally {
      setOptionModalSaving(false);
    }
  };

  // Toggle Permission
  const handleTogglePermission = async (
    permId: number,
    field: keyof ProjectRolePermission,
    value: boolean
  ) => {
    try {
      await api.updateProjectPermission(permId, { [field]: value });
      setProjPermissions((prev) =>
        prev.map((p) => (p.id === permId ? { ...p, [field]: value } : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update permission.";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // Color preset swatches for badge picker
  const colorPresets = [
    "#64748B", // Slate
    "#6366F1", // Indigo
    "#0EA5E9", // Sky
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Rose
    "#8B5CF6", // Purple
    "#EC4899", // Pink
  ];

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
        <p className="text-slate-500 text-sm">
          Configure company profile, bank routing, invoice patterns, defaults, and project modules
        </p>
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

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab("projects")}
            className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xl transition-all cursor-pointer ${
              activeTab === "projects"
                ? "bg-white text-cyan-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-200/70"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <FolderKanban size={16} className={activeTab === "projects" ? "text-cyan-600" : "text-slate-400"} />
            Project Options
          </button>
        )}
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
                Office Address
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
                  Official Email
                </label>
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Website URL
                </label>
                <input
                  type="text"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bank Tab */}
        {activeTab === "bank" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900">Official Remittance Bank</h3>
              <button
                type="button"
                onClick={openAddBankModal}
                className="py-1.5 px-3 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                Add Bank Account
              </button>
            </div>

            {bankAccount ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative" ref={bankDropdownRef}>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Select Bank Account
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm flex items-center justify-between text-left hover:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 shadow-2xs transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Landmark size={16} className="text-cyan-600 shrink-0" />
                        <span className="truncate font-semibold">{bankAccount.bank_name}</span>
                        {bankAccount.is_default && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform ${isBankDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isBankDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Saved Accounts ({bankAccounts.length})
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

        {/* PROJECTS TAB (ADMIN ONLY) */}
        {activeTab === "projects" && isAdmin && settings && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                Project Module Configuration & Options
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Fully dynamic lookup options, sequence format, upload rules, and role permission matrix
              </p>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
              {[
                { id: "options", label: "Lookup Options" },
                { id: "code_format", label: "Code Sequence" },
                { id: "file_rules", label: "Upload Rules" },
                { id: "permissions", label: "Role Permissions" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setProjectSubTab(sub.id as typeof projectSubTab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    projectSubTab === sub.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* 1. LOOKUP OPTIONS SECTION */}
            {projectSubTab === "options" && (
              <div className="space-y-4">
                {/* Option Type Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    {[
                      { id: "statuses", label: "Statuses" },
                      { id: "priorities", label: "Priorities" },
                      { id: "billing-methods", label: "Billing Methods" },
                      { id: "document-categories", label: "Document Categories" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOptionType(opt.id as typeof optionType)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          optionType === opt.id
                            ? "bg-white text-indigo-700 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => openOptionModal()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Option
                  </button>
                </div>

                {/* Option List Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-3 w-16 text-center">Order</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Preview Badge</th>
                        <th className="px-4 py-3">Flags / Attributes</th>
                        <th className="px-4 py-3 text-center">Usage</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {getCurrentOptionList().map((item, idx, arr) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Reorder Buttons */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveOption(idx, "up")}
                                className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Move Up"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => handleMoveOption(idx, "down")}
                                className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Move Down"
                              >
                                <ArrowDown size={13} />
                              </button>
                            </div>
                          </td>

                          {/* Name & Bangla Name */}
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 block">{item.name}</span>
                            {item.name_bn && (
                              <span className="text-[11px] text-slate-500 block font-normal">
                                {item.name_bn}
                              </span>
                            )}
                          </td>

                          {/* Live Color Badge */}
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-2xs"
                              style={{
                                backgroundColor: `${item.color || "#6366F1"}15`,
                                color: item.color || "#4F46E5",
                                border: `1px solid ${item.color || "#6366F1"}30`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: item.color || "#6366F1" }}
                              />
                              {item.name}
                            </span>
                          </td>

                          {/* Flags */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.is_default && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                                  Default
                                </span>
                              )}
                              {item.is_closed && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                                  Closed
                                </span>
                              )}
                              {item.is_initial && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                  Initial
                                </span>
                              )}
                              {item.allow_staff_set && (
                                <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[10px] font-bold border border-cyan-200">
                                  Staff Set
                                </span>
                              )}
                              {item.weight !== undefined && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                  Weight: {item.weight}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Usage Count */}
                          <td className="px-4 py-3 text-center">
                            {(item.in_use_count || 0) > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                                title={`Used by ${item.in_use_count} active records`}
                              >
                                <AlertTriangle size={11} />
                                {item.in_use_count}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">0</span>
                            )}
                          </td>

                          {/* Status toggle */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActiveOption(item)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                                item.is_active
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              }`}
                            >
                              {item.is_active ? "Active" : "Inactive"}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openOptionModal(item)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Option"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOption(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Option"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. CODE SEQUENCE FORMAT */}
            {projectSubTab === "code_format" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Code Prefix
                    </label>
                    <input
                      type="text"
                      value={settings.project_code_prefix || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          project_code_prefix: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Number of Digits
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={settings.project_code_digits || 4}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          project_code_digits: parseInt(e.target.value, 10) || 4,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Year Segment
                    </label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-slate-700 font-semibold">
                        Include Current Year
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.project_code_include_year)}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            project_code_include_year: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Code Preview */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/70 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-950 block">
                      Live Next Project Code Preview:
                    </span>
                    <span className="text-[11px] text-indigo-700">
                      Existing codes are immutable snapshots and will not change.
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold bg-white px-4 py-1.5 rounded-xl border border-indigo-200 text-indigo-900 shadow-xs">
                    {settings.project_code_prefix || "CODE"}
                    {settings.project_code_include_year
                      ? `-${new Date().getFullYear()}-`
                      : "-"}
                    {"0".repeat(Math.max(0, (settings.project_code_digits || 4) - 1))}1
                  </span>
                </div>
              </div>
            )}

            {/* 3. FILE UPLOAD RULES */}
            {projectSubTab === "file_rules" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Receipt rules */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Receipt Upload Rules
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Allowed Extensions
                      </label>
                      <input
                        type="text"
                        value={settings.project_receipt_allowed_extensions || "jpg,jpeg,png,pdf"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            project_receipt_allowed_extensions: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Max File Size (MB)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={settings.project_receipt_max_size_mb || 5}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            project_receipt_max_size_mb: parseInt(e.target.value, 10) || 5,
                          })
                        }
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                      />
                    </div>
                  </div>

                  {/* Document rules */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Document Upload Rules
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Allowed Extensions
                      </label>
                      <input
                        type="text"
                        value={settings.project_doc_allowed_extensions || "pdf,docx,xlsx,png,jpg,zip"}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            project_doc_allowed_extensions: e.target.value,
                          })
                        }
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Max File Size (MB)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={settings.project_doc_max_size_mb || 25}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            project_doc_max_size_mb: parseInt(e.target.value, 10) || 25,
                          })
                        }
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200/80 text-cyan-900 text-xs flex items-start gap-2.5">
                  <Shield size={16} className="text-cyan-700 shrink-0 mt-0.5" />
                  <p>
                    Server-Side Security Enforcement: Uploaded files are strictly validated on the backend against these extensions and limits, and served exclusively through authenticated proxy streaming.
                  </p>
                </div>
              </div>
            )}

            {/* 4. ROLE PERMISSIONS MATRIX */}
            {projectSubTab === "permissions" && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                  <Lock size={14} className="text-amber-700 shrink-0" />
                  <span>
                    ADMIN permissions are permanently full and cannot be removed. ACCOUNTANT and STAFF permissions can be customized below.
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-center text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left">Role</th>
                        <th className="px-2 py-3">View</th>
                        <th className="px-2 py-3">Create</th>
                        <th className="px-2 py-3">Edit</th>
                        <th className="px-2 py-3">Delete</th>
                        <th className="px-2 py-3">Expenses</th>
                        <th className="px-2 py-3">Docs</th>
                        <th className="px-2 py-3">Modules</th>
                        <th className="px-2 py-3">Status</th>
                        <th className="px-2 py-3">Config</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projPermissions.map((perm) => {
                        const isLocked = perm.role === "ADMIN";
                        return (
                          <tr key={perm.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3 text-left font-bold text-slate-900">
                              <span className="inline-flex items-center gap-1.5">
                                {isLocked && <Lock size={12} className="text-slate-400" />}
                                {perm.role}
                              </span>
                            </td>

                            {(
                              [
                                "can_view",
                                "can_create",
                                "can_edit",
                                "can_delete",
                                "can_manage_expenses",
                                "can_manage_documents",
                                "can_manage_modules",
                                "can_change_status",
                                "can_manage_config",
                              ] as Array<keyof ProjectRolePermission>
                            ).map((col) => (
                              <td key={col} className="px-2 py-3">
                                <input
                                  type="checkbox"
                                  disabled={isLocked}
                                  checked={Boolean(perm[col])}
                                  onChange={(e) =>
                                    handleTogglePermission(perm.id, col, e.target.checked)
                                  }
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

      {/* Add / Edit Project Option Modal */}
      {isOptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Palette size={18} className="text-indigo-600" />
                {editingOption ? "Edit Option" : "Add Option"}
              </h3>
              <button
                type="button"
                onClick={() => setIsOptionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* In-use Warning */}
            {editingOption && (editingOption.in_use_count || 0) > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Warning: This option is currently assigned to {editingOption.in_use_count} project record(s). Any modifications will immediately update all associated records.
                </span>
              </div>
            )}

            {optionModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {optionModalError}
              </div>
            )}

            <form onSubmit={handleSaveOptionSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Name (English) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={optionForm.name}
                  onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
                  placeholder="e.g. Quality Review"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bengali Label (Optional)
                </label>
                <input
                  type="text"
                  value={optionForm.name_bn}
                  onChange={(e) => setOptionForm({ ...optionForm, name_bn: e.target.value })}
                  placeholder="e.g. মান পর্যালোচনা"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Color Picker + Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Color Badge
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={optionForm.color}
                    onChange={(e) => setOptionForm({ ...optionForm, color: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-slate-200 p-0.5 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={optionForm.color}
                    onChange={(e) => setOptionForm({ ...optionForm, color: e.target.value })}
                    className="w-28 px-3 py-1.5 font-mono text-xs border border-slate-200 rounded-xl uppercase"
                  />
                  <div className="flex items-center gap-1">
                    {colorPresets.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setOptionForm({ ...optionForm, color: c })}
                        style={{ backgroundColor: c }}
                        className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform cursor-pointer"
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Badge Preview Box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Eye size={13} />
                  Live Badge Preview:
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-2xs"
                  style={{
                    backgroundColor: `${optionForm.color}18`,
                    color: optionForm.color,
                    border: `1px solid ${optionForm.color}35`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: optionForm.color }}
                  />
                  {optionForm.name || "Preview Option"}
                </span>
              </div>

              {/* Option-Type Specific Fields */}
              {optionType === "statuses" && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optionForm.is_closed}
                      onChange={(e) =>
                        setOptionForm({ ...optionForm, is_closed: e.target.checked })
                      }
                      className="rounded accent-indigo-600 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Closed Status (Blocks new expenses/modules unless privileged)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optionForm.is_initial}
                      onChange={(e) =>
                        setOptionForm({ ...optionForm, is_initial: e.target.checked })
                      }
                      className="rounded accent-indigo-600 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Initial Status (Assigned to newly created projects)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optionForm.allow_staff_set}
                      onChange={(e) =>
                        setOptionForm({ ...optionForm, allow_staff_set: e.target.checked })
                      }
                      className="rounded accent-indigo-600 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Allow STAFF role users to select this status
                    </span>
                  </label>
                </div>
              )}

              {optionType === "priorities" && (
                <div className="pt-1 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sorting Weight (Higher denotes greater priority)
                  </label>
                  <input
                    type="number"
                    value={optionForm.weight}
                    onChange={(e) =>
                      setOptionForm({
                        ...optionForm,
                        weight: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-bold"
                  />
                </div>
              )}

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={optionForm.is_default}
                    onChange={(e) =>
                      setOptionForm({ ...optionForm, is_default: e.target.checked })
                    }
                    className="rounded accent-indigo-600 h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-slate-700">Default Option</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={optionForm.is_active}
                    onChange={(e) =>
                      setOptionForm({ ...optionForm, is_active: e.target.checked })
                    }
                    className="rounded accent-indigo-600 h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-slate-700">Active</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOptionModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={optionModalSaving}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {optionModalSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check size={14} />
                  )}
                  Save Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
