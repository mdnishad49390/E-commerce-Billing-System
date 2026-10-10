"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  Client,
  ProjectConfig,
  Project,
} from "@/lib/api";
import { t } from "@/lib/translations";
import {
  ArrowLeft,
  Save,
  AlertCircle,
} from "lucide-react";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [statusId, setStatusId] = useState<string>("");
  const [priorityId, setPriorityId] = useState<string>("");
  const [billingMethodId, setBillingMethodId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalBudget, setTotalBudget] = useState("0.00");
  const [estimatedCost, setEstimatedCost] = useState("0.00");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [projRes, confRes, clientRes] = await Promise.all([
          api.getProject(id),
          api.getProjectConfig(),
          api.getClients(),
        ]);

        setProject(projRes);
        setConfig(confRes);
        setClients(clientRes.results || []);

        setName(projRes.name);
        setClientId(String(projRes.client));
        setStatusId(String(projRes.status));
        setPriorityId(String(projRes.priority));
        setBillingMethodId(String(projRes.billing_method));
        setStartDate(projRes.start_date || "");
        setEndDate(projRes.end_date || "");
        setTotalBudget(projRes.total_budget || "0.00");
        setEstimatedCost(projRes.estimated_cost || "0.00");
        setDescription(projRes.description || "");
        setComment(projRes.comment || "");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load project details";
        setFormError(msg);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError(t("error_name_required"));
      return;
    }
    if (!clientId) {
      setFormError(t("error_client_required"));
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setFormError(t("error_end_date_before_start"));
      return;
    }

    try {
      setSubmitting(true);
      const payload: Partial<Project> = {
        name: name.trim(),
        client: parseInt(clientId, 10),
        status: statusId ? parseInt(statusId, 10) : undefined,
        priority: priorityId ? parseInt(priorityId, 10) : undefined,
        billing_method: billingMethodId ? parseInt(billingMethodId, 10) : undefined,
        start_date: startDate,
        end_date: endDate || null,
        total_budget: totalBudget || "0.00",
        estimated_cost: estimatedCost || "0.00",
        description: description.trim(),
        comment: comment.trim(),
      };

      await api.updateProject(id, payload);
      router.push(`/projects/${id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save project changes.";
      setFormError(msg);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 max-w-3xl mx-auto">
        <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                {project?.code}
              </span>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t("form_edit_title")}
              </h1>
            </div>
            <p className="text-slate-500 text-sm">{t("form_edit_subtitle")}</p>
          </div>
        </div>
      </div>

      {formError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertCircle size={18} className="shrink-0 text-rose-500" />
          <span>{formError}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Project Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_project_name")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("field_project_name_placeholder")}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Client Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_client")} <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            >
              <option value="">{t("field_client_placeholder")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_status")}
            </label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            >
              {config?.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_closed ? `(${t("closed_project_badge")})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_priority")}
            </label>
            <select
              value={priorityId}
              onChange={(e) => setPriorityId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            >
              {config?.priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Billing Method */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_billing_method")}
            </label>
            <select
              value={billingMethodId}
              onChange={(e) => setBillingMethodId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            >
              {config?.billing_methods.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_start_date")}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_end_date")}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Budgets */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_total_budget")} {config?.currency_symbol ? `(${config.currency_symbol})` : ""}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_estimated_cost")} {config?.currency_symbol ? `(${config.currency_symbol})` : ""}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_description")}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("field_description_placeholder")}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            ></textarea>
          </div>

          {/* Internal Comment */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              {t("field_comment")}
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("field_comment_placeholder")}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            ></textarea>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Link
            href={`/projects/${id}`}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t("cancel")}
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            <Save size={16} />
            <span>{submitting ? t("saving") : t("save_changes")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
