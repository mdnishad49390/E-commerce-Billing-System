"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  Project,
  ProjectConfig,
  ProjectModule,
} from "@/lib/api";
import { t, formatCurrency, formatDate } from "@/lib/translations";
import {
  Briefcase,
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  Plus,
  Layers,
  Receipt,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Building2,
  X,
  ChevronRight,
} from "lucide-react";

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: "overview" | "modules" | "budget" | "expenses" | "documents"
  const [activeTab, setActiveTab] = useState<"overview" | "modules" | "budget" | "expenses" | "documents">("overview");

  // Status Change Modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatusId, setNewStatusId] = useState<string>("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Delete Project Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add/Edit Module Modal
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<ProjectModule | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [moduleProgress, setModuleProgress] = useState(0);
  const [moduleOrder, setModuleOrder] = useState(0);
  const [moduleSubmitting, setModuleSubmitting] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);

  // Add Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseBillable, setExpenseBillable] = useState(true);
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Expense Filter
  const [expenseSearch, setExpenseSearch] = useState("");

  // Upload Document Modal
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategoryId, setDocCategoryId] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [projRes, confRes] = await Promise.all([
        api.getProject(id),
        api.getProjectConfig(),
      ]);
      setProject(projRes);
      setConfig(confRes);
      setNewStatusId(String(projRes.status));
      if (confRes.document_categories?.length > 0) {
        setDocCategoryId(String(confRes.document_categories[0].id));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load project details";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let isSubscribed = true;
    (async () => {
      if (isSubscribed) {
        await loadData();
      }
    })();
    return () => {
      isSubscribed = false;
    };
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-slate-500">{t("loading")}</p>
      </div>
    );
  }

  if (error || !project || !config) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-rose-900 mb-2">Error Loading Project</h2>
          <p className="text-sm text-rose-700 mb-6">{error || "Project not found"}</p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-rose-300 text-rose-800 rounded-xl font-medium shadow-sm hover:bg-rose-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back_to_projects")}
          </Link>
        </div>
      </div>
    );
  }

  // Permissions & Behavior flags
  const perms = config.permissions;
  const isClosed = project.status_is_closed;
  const canModifyWork = !isClosed || perms.role === "ADMIN";

  // Allowed statuses for the user
  const availableStatuses = config.statuses.filter((s) => {
    if (perms.role === "ADMIN" || perms.role === "ACCOUNTANT") return true;
    // STAFF can only choose statuses where allow_staff_set is true, or current status
    return s.allow_staff_set || s.id === project.status;
  });

  // Calculate timespan text
  const timespanText = project.start_date
    ? `${formatDate(project.start_date)} - ${project.end_date ? formatDate(project.end_date) : t("ongoing")}`
    : t("not_set");

  // Handle Status Update
  const handleStatusChange = async () => {
    if (!newStatusId || parseInt(newStatusId, 10) === project.status) {
      setShowStatusModal(false);
      return;
    }
    try {
      setStatusSubmitting(true);
      setStatusError(null);
      await api.updateProject(project.id, {
        status: parseInt(newStatusId, 10),
      });
      setShowStatusModal(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update project status";
      setStatusError(msg);
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Handle Project Deletion
  const handleDeleteProject = async () => {
    try {
      setDeleteSubmitting(true);
      setDeleteError(null);
      await api.deleteProject(project.id);
      router.push("/projects");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete project";
      setDeleteError(msg);
      setDeleteSubmitting(false);
    }
  };

  // Handle Add/Edit Module
  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleName.trim()) {
      setModuleError("Module name is required");
      return;
    }
    try {
      setModuleSubmitting(true);
      setModuleError(null);
      if (editingModule) {
        await api.updateProjectModule(project.id, editingModule.id, {
          name: moduleName.trim(),
          description: moduleDescription.trim(),
          progress_percent: moduleProgress,
          sort_order: moduleOrder,
        });
      } else {
        await api.createProjectModule(project.id, {
          name: moduleName.trim(),
          description: moduleDescription.trim(),
          progress_percent: moduleProgress,
          sort_order: moduleOrder,
        });
      }
      setShowModuleModal(false);
      setEditingModule(null);
      setModuleName("");
      setModuleDescription("");
      setModuleProgress(0);
      setModuleOrder(0);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save module";
      setModuleError(msg);
    } finally {
      setModuleSubmitting(false);
    }
  };

  // Handle Inline Module Progress Update
  const handleUpdateModuleProgress = async (mod: ProjectModule, newPct: number) => {
    try {
      const pct = Math.max(0, Math.min(100, newPct));
      await api.updateProjectModule(project.id, mod.id, { progress_percent: pct });
      await loadData();
    } catch (err: unknown) {
      console.error("Failed to update module progress:", err);
    }
  };

  // Handle Delete Module
  const handleDeleteModule = async (moduleId: number) => {
    if (!confirm(t("confirm_delete_module"))) return;
    try {
      await api.deleteProjectModule(project.id, moduleId);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete module");
    }
  };

  // Handle Add Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName.trim()) {
      setExpenseError("Expense name is required");
      return;
    }
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpenseError("Amount must be a positive number greater than zero");
      return;
    }

    try {
      setExpenseSubmitting(true);
      setExpenseError(null);

      const formData = new FormData();
      formData.append("expense_name", expenseName.trim());
      formData.append("amount", expenseAmount);
      formData.append("date", expenseDate);
      formData.append("description", expenseDescription.trim());
      formData.append("is_billable", expenseBillable ? "true" : "false");
      if (expenseReceiptFile) {
        formData.append("receipt", expenseReceiptFile);
      }

      await api.createProjectExpense(project.id, formData);
      setShowExpenseModal(false);
      setExpenseName("");
      setExpenseAmount("");
      setExpenseDescription("");
      setExpenseBillable(true);
      setExpenseReceiptFile(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record expense";
      setExpenseError(msg);
    } finally {
      setExpenseSubmitting(false);
    }
  };

  // Handle Delete Expense
  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm(t("confirm_delete_expense"))) return;
    try {
      await api.deleteProjectExpense(project.id, expenseId);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete expense");
    }
  };

  // Handle Upload Document
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      setDocError("Document title is required");
      return;
    }
    if (!docCategoryId) {
      setDocError("Category is required");
      return;
    }
    if (!docFile) {
      setDocError("Please select a file to upload");
      return;
    }

    try {
      setDocSubmitting(true);
      setDocError(null);

      const formData = new FormData();
      formData.append("title", docTitle.trim());
      formData.append("category", docCategoryId);
      formData.append("file", docFile);

      await api.uploadProjectDocument(project.id, formData);
      setShowDocumentModal(false);
      setDocTitle("");
      setDocFile(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload document";
      setDocError(msg);
    } finally {
      setDocSubmitting(false);
    }
  };

  // Handle Delete Document
  const handleDeleteDocument = async (docId: number) => {
    if (!confirm(t("confirm_delete_doc"))) return;
    try {
      await api.deleteProjectDocument(project.id, docId);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  // Filtered expenses
  const filteredExpenses = (project.expenses || []).filter((exp) => {
    if (!expenseSearch.trim()) return true;
    const q = expenseSearch.toLowerCase();
    return (
      exp.expense_name.toLowerCase().includes(q) ||
      (exp.description && exp.description.toLowerCase().includes(q))
    );
  });

  // Calculate budget usage percentage
  const totalBudgetNum = parseFloat(project.total_budget || "0");
  const actualCostNum = parseFloat(project.actual_cost || "0");
  const budgetUsagePercent = totalBudgetNum > 0 ? (actualCostNum / totalBudgetNum) * 100 : 0;
  const progressPercent = project.overall_progress || 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("back_to_projects")}
              </Link>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                {project.code}
              </span>
              {project.status_is_closed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <XCircle className="h-3 w-3" />
                  {t("closed_project_badge")}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {project.name}
              </h1>
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Client link */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {project.client_name || t("col_client")}
              </span>

              {/* Status Badge */}
              <button
                type="button"
                onClick={() => perms.can_change_status && setShowStatusModal(true)}
                disabled={!perms.can_change_status}
                title={perms.can_change_status ? t("change_status_title") : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs transition-opacity hover:opacity-90 disabled:cursor-default"
                style={{
                  backgroundColor: `${project.status_color || "#6B7280"}18`,
                  color: project.status_color || "#374151",
                  border: `1px solid ${project.status_color || "#6B7280"}35`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: project.status_color || "#6B7280" }}
                />
                {project.status_name}
                {perms.can_change_status && <ChevronRight className="h-3 w-3 ml-0.5 opacity-60" />}
              </button>

              {/* Priority Badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${project.priority_color || "#6B7280"}15`,
                  color: project.priority_color || "#374151",
                  border: `1px solid ${project.priority_color || "#6B7280"}30`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: project.priority_color || "#6B7280" }}
                />
                {project.priority_name}
              </span>

              {/* Billing Method Badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${project.billing_method_color || "#6B7280"}15`,
                  color: project.billing_method_color || "#374151",
                  border: `1px solid ${project.billing_method_color || "#6B7280"}30`,
                }}
              >
                <DollarSign className="h-3 w-3" />
                {project.billing_method_name}
              </span>

              {/* Timespan */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {timespanText}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 lg:pt-0">
            {perms.can_change_status && (
              <button
                type="button"
                onClick={() => setShowStatusModal(true)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
              >
                {t("change_status_btn")}
              </button>
            )}

            {perms.can_edit && (
              <Link
                href={`/projects/${project.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Edit className="h-3.5 w-3.5" />
                {t("edit_project")}
              </Link>
            )}

            {perms.can_delete && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                title={t("delete_project")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-4 overflow-x-auto">
          {[
            { id: "overview", label: t("details_tab_overview"), icon: Briefcase },
            { id: "modules", label: `${t("details_tab_modules")} (${project.modules?.length || 0})`, icon: Layers },
            { id: "budget", label: t("details_tab_budget"), icon: DollarSign },
            { id: "expenses", label: `${t("details_tab_expenses")} (${project.expenses?.length || 0})`, icon: Receipt },
            { id: "documents", label: `${t("details_tab_documents")} (${project.documents?.length || 0})`, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isCurrent
                    ? "bg-indigo-50 text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${isCurrent ? "text-indigo-600" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Description Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                {t("field_description")}
              </h2>
              {project.description ? (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {project.description}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">No description provided for this project.</p>
              )}
            </div>

            {/* Modules summary preview */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    {t("modules_title")}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t("overall_progress")}: <strong className="text-indigo-600">{progressPercent}%</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("modules")}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  View all modules &rarr;
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 mb-4 overflow-hidden">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>

              {project.modules && project.modules.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {project.modules.slice(0, 3).map((mod) => (
                    <div key={mod.id} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate max-w-xs">{mod.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${mod.progress_percent}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-600 w-8 text-right">{mod.progress_percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">{t("no_modules_yet")}</p>
              )}
            </div>
          </div>

          {/* Right Column: Info & Comments */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Project Summary
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t("col_code")}</span>
                  <span className="font-mono font-semibold text-slate-900">{project.code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t("col_client")}</span>
                  <span className="font-semibold text-slate-900">{project.client_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t("field_start_date")}</span>
                  <span className="font-medium text-slate-900">{formatDate(project.start_date)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t("field_end_date")}</span>
                  <span className="font-medium text-slate-900">{formatDate(project.end_date, t("ongoing"))}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t("col_created_date")}</span>
                  <span className="font-medium text-slate-900">{formatDate(project.created_at)}</span>
                </div>
                {project.created_by_name && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Created By</span>
                    <span className="font-medium text-slate-900">{project.created_by_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Internal Team Comment */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
                {t("field_comment")}
              </h2>
              {project.comment ? (
                <p className="text-xs text-slate-600 bg-amber-50/60 border border-amber-200/60 rounded-xl p-3 leading-relaxed">
                  {project.comment}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No internal comments recorded.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODULES TAB */}
      {activeTab === "modules" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t("modules_title")}</h2>
                <p className="text-xs text-slate-500 mt-1">{t("modules_subtitle")}</p>
              </div>

              {perms.can_manage_modules && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canModifyWork) {
                      alert("Closed projects cannot receive new modules unless privileged.");
                      return;
                    }
                    setEditingModule(null);
                    setModuleName("");
                    setModuleDescription("");
                    setModuleProgress(0);
                    setModuleOrder((project.modules?.length || 0) + 1);
                    setModuleError(null);
                    setShowModuleModal(true);
                  }}
                  disabled={!canModifyWork}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {t("add_module")}
                </button>
              )}
            </div>

            {/* Overall Progress Bar */}
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-slate-700">{t("overall_progress")}</span>
                <span className="font-bold text-indigo-600">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            </div>

            {/* Modules List */}
            {project.modules && project.modules.length > 0 ? (
              <div className="space-y-3">
                {project.modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                          #{mod.sort_order}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{mod.name}</h3>
                      </div>
                      {mod.description && (
                        <p className="text-xs text-slate-500 pl-8">{mod.description}</p>
                      )}
                    </div>

                    {/* Progress Slider & Value */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 w-48">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={mod.progress_percent}
                          disabled={!perms.can_manage_modules || !canModifyWork}
                          onChange={(e) => handleUpdateModuleProgress(mod, parseInt(e.target.value, 10))}
                          className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-bold text-slate-800 w-10 text-right">
                          {mod.progress_percent}%
                        </span>
                      </div>

                      {/* Action buttons */}
                      {perms.can_manage_modules && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingModule(mod);
                              setModuleName(mod.name);
                              setModuleDescription(mod.description || "");
                              setModuleProgress(mod.progress_percent);
                              setModuleOrder(mod.sort_order);
                              setModuleError(null);
                              setShowModuleModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                            title={t("edit_module")}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(mod.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={t("delete_module")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">{t("no_modules_yet")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BUDGET & COSTS TAB */}
      {activeTab === "budget" && (
        <div className="space-y-6">
          {/* Over Budget Alert with Text AND Icon (Rule 6 compliant) */}
          {project.is_over_budget ? (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 flex items-start gap-4">
              <div className="p-2 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900 mb-1">
                  {t("over_budget_warning")}
                </h3>
                <p className="text-xs text-rose-700">
                  Actual logged expenditures ({formatCurrency(project.actual_cost, config.currency_symbol)}) exceed the assigned budget total of {formatCurrency(project.total_budget, config.currency_symbol)}. Immediate budget review or invoice adjustment is recommended.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-medium text-emerald-800">
                {t("budget_healthy")}
              </p>
            </div>
          )}

          {/* 5 KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Budget */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t("card_total_budget")}
              </span>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(project.total_budget, config.currency_symbol)}
              </p>
              <span className="text-[11px] text-slate-400 block">Allocated limit</span>
            </div>

            {/* Used Budget */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t("card_used_budget")}
              </span>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(project.used_budget, config.currency_symbol)}
              </p>
              <span className="text-[11px] text-slate-400 block">Sum of actual expenses</span>
            </div>

            {/* Remaining Budget */}
            <div className={`bg-white rounded-2xl border p-5 shadow-sm space-y-1 ${
              project.is_over_budget ? "border-rose-200 bg-rose-50/20" : "border-slate-200/80"
            }`}>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t("card_remaining_budget")}
              </span>
              <p className={`text-xl font-bold ${project.is_over_budget ? "text-rose-600" : "text-emerald-600"}`}>
                {formatCurrency(project.remaining_budget, config.currency_symbol)}
              </p>
              <span className="text-[11px] text-slate-400 block">
                {project.is_over_budget ? "Deficit amount" : "Available balance"}
              </span>
            </div>

            {/* Estimated Cost */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t("card_estimated_cost")}
              </span>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(project.estimated_cost, config.currency_symbol)}
              </p>
              <span className="text-[11px] text-slate-400 block">Initial projection</span>
            </div>

            {/* Actual Cost */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {t("card_actual_cost")}
              </span>
              <p className="text-xl font-bold text-indigo-600">
                {formatCurrency(project.actual_cost, config.currency_symbol)}
              </p>
              <span className="text-[11px] text-slate-400 block">Direct logged costs</span>
            </div>
          </div>

          {/* Budget Consumption Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-bold text-slate-800">{t("budget_usage")}</span>
              <span className="font-bold text-slate-700">
                {budgetUsagePercent.toFixed(1)}% of total budget used
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  project.is_over_budget ? "bg-rose-500" : budgetUsagePercent > 80 ? "bg-amber-500" : "bg-indigo-600"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, budgetUsagePercent))}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Note: Used Budget is strictly calculated as the exact Decimal sum of all logged project expense line items.
            </p>
          </div>

          {/* Billable vs Non-Billable Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {t("total_billable")}
              </span>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(project.billable_total, config.currency_symbol)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Expenses billable to client invoices</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                {t("total_non_billable")}
              </span>
              <p className="text-2xl font-bold text-slate-700">
                {formatCurrency(project.non_billable_total, config.currency_symbol)}
              </p>
              <p className="text-xs text-slate-400 mt-1">Internal non-reimbursable project costs</p>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSES TAB */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t("expenses_title")}</h2>
                <p className="text-xs text-slate-500 mt-1">{t("expenses_subtitle")}</p>
              </div>

              {perms.can_manage_expenses && (
                <button
                  type="button"
                  onClick={() => {
                    if (!canModifyWork) {
                      alert("Closed projects cannot receive new expenses unless privileged.");
                      return;
                    }
                    setExpenseName("");
                    setExpenseAmount("");
                    setExpenseDate(new Date().toISOString().split("T")[0]);
                    setExpenseDescription("");
                    setExpenseBillable(true);
                    setExpenseReceiptFile(null);
                    setExpenseError(null);
                    setShowExpenseModal(true);
                  }}
                  disabled={!canModifyWork}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {t("add_expense")}
                </button>
              )}
            </div>

            {/* Expenses Summary Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-500 block">Total Expenses</span>
                <span className="text-base font-bold text-slate-900">
                  {formatCurrency(project.actual_cost, config.currency_symbol)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
                <span className="text-[11px] font-semibold text-emerald-700 block">{t("total_billable")}</span>
                <span className="text-base font-bold text-emerald-800">
                  {formatCurrency(project.billable_total, config.currency_symbol)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-500 block">{t("total_non_billable")}</span>
                <span className="text-base font-bold text-slate-700">
                  {formatCurrency(project.non_billable_total, config.currency_symbol)}
                </span>
              </div>
            </div>

            {/* Search / Filter bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Filter expenses by item or description..."
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-full sm:w-80 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Expenses Table */}
            {filteredExpenses.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">{t("expense_date")}</th>
                      <th className="px-4 py-3">{t("expense_name")}</th>
                      <th className="px-4 py-3">{t("expense_amount")}</th>
                      <th className="px-4 py-3">Billing</th>
                      <th className="px-4 py-3">{t("expense_receipt")}</th>
                      <th className="px-4 py-3">Logged By</th>
                      {perms.can_manage_expenses && <th className="px-4 py-3 text-right">{t("col_actions")}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                          {formatDate(exp.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 block">{exp.expense_name}</span>
                          {exp.description && (
                            <span className="text-[11px] text-slate-500 block">{exp.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(exp.amount, config.currency_symbol)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {exp.is_billable ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {t("expense_billable")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {t("expense_non_billable")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {exp.receipt ? (
                            <a
                              href={`/api/proxy/projects/${project.id}/expenses/${exp.id}/receipt/`}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {exp.receipt_filename || t("download_receipt")}
                            </a>
                          ) : (
                            <span className="text-slate-400">{t("no_receipt")}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {exp.created_by_name || "-"}
                        </td>
                        {perms.can_manage_expenses && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title={t("confirm_delete_expense")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">{t("no_expenses_yet")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t("documents_title")}</h2>
                <p className="text-xs text-slate-500 mt-1">{t("documents_subtitle")}</p>
              </div>

              {perms.can_manage_documents && (
                <button
                  type="button"
                  onClick={() => {
                    setDocTitle("");
                    setDocFile(null);
                    setDocError(null);
                    setShowDocumentModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
                >
                  <Upload className="h-4 w-4" />
                  {t("upload_document")}
                </button>
              )}
            </div>

            {/* Documents List */}
            {project.documents && project.documents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {project.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{doc.title}</h3>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                          style={{
                            backgroundColor: `${doc.category_color || "#6B7280"}15`,
                            color: doc.category_color || "#374151",
                            border: `1px solid ${doc.category_color || "#6B7280"}30`,
                          }}
                        >
                          {doc.category_name}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-mono truncate">
                        {doc.file_name}
                      </p>

                      <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                        <div>Size: {doc.file_size_formatted || "-"}</div>
                        <div>Uploaded by {doc.uploaded_by_name || "Unknown"} on {formatDate(doc.uploaded_at)}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                      <a
                        href={`/api/proxy/projects/${project.id}/documents/${doc.id}/download/`}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("download_doc")}
                      </a>

                      {perms.can_manage_documents && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title={t("confirm_delete_doc")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">{t("no_docs_yet")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHANGE STATUS MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{t("change_status_title")}</h3>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {statusError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {statusError}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 block">
                Select New Status
              </label>
              <div className="space-y-2">
                {availableStatuses.map((st) => (
                  <label
                    key={st.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      newStatusId === String(st.id)
                        ? "border-indigo-600 bg-indigo-50/50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="project_status"
                        value={st.id}
                        checked={newStatusId === String(st.id)}
                        onChange={(e) => setNewStatusId(e.target.value)}
                        className="accent-indigo-600"
                      />
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${st.color || "#6B7280"}15`,
                          color: st.color || "#374151",
                          border: `1px solid ${st.color || "#6B7280"}30`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: st.color || "#6B7280" }}
                        />
                        {st.name}
                      </span>
                    </div>
                    {st.is_closed && (
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                        Closed
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={statusSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
              >
                {statusSubmitting ? t("saving") : t("change_status_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PROJECT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t("delete_project")}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t("confirm_delete_project")}
            </p>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
              >
                {deleteSubmitting ? t("saving") : t("delete_project")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODULE MODAL */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveModule} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingModule ? t("edit_module") : t("add_module")}
              </h3>
              <button
                type="button"
                onClick={() => setShowModuleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {moduleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {moduleError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("module_name")} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("module_name_placeholder")}
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("field_description")}
                </label>
                <textarea
                  rows={2}
                  value={moduleDescription}
                  onChange={(e) => setModuleDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {t("module_progress")} (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={moduleProgress}
                    onChange={(e) => setModuleProgress(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {t("module_sort_order")}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={moduleOrder}
                    onChange={(e) => setModuleOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModuleModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={moduleSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
              >
                {moduleSubmitting ? t("saving") : t("save_changes")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveExpense} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{t("add_expense")}</h3>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {expenseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {expenseError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("expense_name")} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("expense_name_placeholder")}
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {t("expense_amount")} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    {t("expense_date")} *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("field_description")}
                </label>
                <textarea
                  rows={2}
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("expense_receipt")} ({config.file_rules.receipt.allowed_extensions}, max {config.file_rules.receipt.max_size_mb}MB)
                </label>
                <input
                  type="file"
                  onChange={(e) => setExpenseReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expenseBillable}
                    onChange={(e) => setExpenseBillable(e.target.checked)}
                    className="rounded accent-indigo-600 h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {t("expense_billable")}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={expenseSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
              >
                {expenseSubmitting ? t("saving") : t("add_expense")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {showDocumentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveDocument} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{t("upload_document")}</h3>
              <button
                type="button"
                onClick={() => setShowDocumentModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {docError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {docError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("doc_title")} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t("doc_title_placeholder")}
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("doc_category")} *
                </label>
                <select
                  required
                  value={docCategoryId}
                  onChange={(e) => setDocCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {config.document_categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {t("doc_file")} * ({config.file_rules.document.allowed_extensions}, max {config.file_rules.document.max_size_mb}MB)
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDocumentModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={docSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50 transition-colors"
              >
                {docSubmitting ? t("saving") : t("upload_document")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
