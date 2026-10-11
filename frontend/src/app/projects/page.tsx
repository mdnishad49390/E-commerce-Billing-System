"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  api,
  Project,
  ProjectConfig,
  Client,
} from "@/lib/api";
import { t, formatCurrency, formatDate } from "@/lib/translations";
import {
  Briefcase,
  Plus,
  Search,
  AlertTriangle,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  ExternalLink,
  Layers,
} from "lucide-react";
import { MetricCard, Dropdown, DropdownOption } from "@/components/common";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [selectedBillingMethod, setSelectedBillingMethod] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [closedFilter, setClosedFilter] = useState<string>(""); // "" | "open" | "closed"
  const [startDateAfter, setStartDateAfter] = useState<string>("");
  const [startDateBefore, setStartDateBefore] = useState<string>("");

  // Pagination
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number | boolean> = {
        page,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (selectedStatus) {
        params.status = selectedStatus;
      }
      if (selectedPriority) {
        params.priority = selectedPriority;
      }
      if (selectedBillingMethod) {
        params.billing_method = selectedBillingMethod;
      }
      if (selectedClient) {
        params.client = selectedClient;
      }
      if (closedFilter === "open") {
        params.is_closed = false;
      } else if (closedFilter === "closed") {
        params.is_closed = true;
      }
      if (startDateAfter) {
        params.start_date_after = startDateAfter;
      }
      if (startDateBefore) {
        params.start_date_before = startDateBefore;
      }

      const [projRes, confRes, clientRes] = await Promise.all([
        api.getProjects(params),
        api.getProjectConfig(),
        api.getClients(),
      ]);

      setProjects(projRes.results || []);
      setTotalCount(projRes.count || 0);
      setConfig(confRes);
      setClients(clientRes.results || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load projects";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    searchQuery,
    selectedStatus,
    selectedPriority,
    selectedBillingMethod,
    selectedClient,
    closedFilter,
    startDateAfter,
    startDateBefore,
  ]);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("");
    setSelectedPriority("");
    setSelectedBillingMethod("");
    setSelectedClient("");
    setClosedFilter("");
    setStartDateAfter("");
    setStartDateBefore("");
    setPage(1);
  };

  // Metrics summary
  const summaryMetrics = useMemo(() => {
    const total = totalCount;
    const overBudgetCount = projects.filter((p) => p.is_over_budget).length;
    const closedCount = projects.filter((p) => p.status_is_closed).length;
    const openCount = projects.length - closedCount;
    return { total, overBudgetCount, openCount, closedCount };
  }, [projects, totalCount]);

  // Memoized options for filter dropdowns
  const statusOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: "", label: t("filter_all_statuses") },
      ...(config?.statuses?.map((s) => ({
        value: String(s.id),
        label: s.name,
        badge: s.is_closed ? "Closed" : undefined,
        badgeColor: "bg-rose-50 text-rose-700 border border-rose-200/80",
      })) || []),
    ],
    [config?.statuses]
  );

  const priorityOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: "", label: t("filter_all_priorities") },
      ...(config?.priorities?.map((p) => ({
        value: String(p.id),
        label: p.name,
      })) || []),
    ],
    [config?.priorities]
  );

  const clientOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: "", label: t("filter_all_clients") },
      ...clients.map((c) => ({
        value: String(c.id),
        label: c.name,
        secondary: c.phone || c.email || undefined,
      })),
    ],
    [clients]
  );

  const lifecycleOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: "", label: "All Projects" },
      {
        value: "open",
        label: t("filter_open_projects"),
        badge: "Open",
        badgeColor: "bg-cyan-50 text-cyan-800 border border-cyan-200/80",
      },
      {
        value: "closed",
        label: t("filter_closed_projects"),
        badge: "Closed",
        badgeColor: "bg-rose-50 text-rose-700 border border-rose-200/80",
      },
    ],
    []
  );

  const hasActiveFilters = Boolean(
    searchQuery ||
    selectedStatus ||
    selectedPriority ||
    selectedClient ||
    closedFilter ||
    selectedBillingMethod ||
    startDateAfter ||
    startDateBefore
  );

  const currencySymbol = config?.currency_symbol || "";
  const canCreate = config?.permissions?.can_create ?? false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-white via-cyan-50/25 to-blue-50/40 p-6 md:p-8 rounded-3xl border border-cyan-200/60 shadow-[0_4px_24px_-6px_rgba(6,182,212,0.08)]">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t("projects_title")}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">{t("projects_subtitle")}</p>
        </div>

        {canCreate && (
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-600/20 hover:shadow-cyan-600/30 cursor-pointer w-fit shrink-0"
          >
            <Plus size={17} />
            <span>{t("nav_new_project")}</span>
          </Link>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t("total_projects_count")}
          value={summaryMetrics.total}
          subtitle="All registered projects"
          icon={FolderOpen}
          color="blue"
        />

        <MetricCard
          title={t("filter_open_projects")}
          value={summaryMetrics.openCount}
          subtitle="Active / In-progress"
          icon={Layers}
          color="cyan"
        />

        <MetricCard
          title={t("filter_closed_projects")}
          value={summaryMetrics.closedCount}
          subtitle="Completed & settled"
          icon={Briefcase}
          color="emerald"
        />

        <MetricCard
          title="Over Budget"
          value={summaryMetrics.overBudgetCount}
          subtitle="Exceeded budget threshold"
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="relative z-20 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_placeholder")}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <Dropdown
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(String(val));
                setPage(1);
              }}
              options={statusOptions}
              placeholder={t("filter_all_statuses")}
              size="sm"
              className="w-full sm:w-44"
            />

            {/* Priority Filter */}
            <Dropdown
              value={selectedPriority}
              onChange={(val) => {
                setSelectedPriority(String(val));
                setPage(1);
              }}
              options={priorityOptions}
              placeholder={t("filter_all_priorities")}
              size="sm"
              className="w-full sm:w-40"
            />

            {/* Client Filter */}
            <Dropdown
              value={selectedClient}
              onChange={(val) => {
                setSelectedClient(String(val));
                setPage(1);
              }}
              options={clientOptions}
              placeholder={t("filter_all_clients")}
              size="sm"
              searchable={clients.length > 5}
              searchPlaceholder="Search client..."
              className="w-full sm:w-48"
            />

            {/* Closed / Open lifecycle filter ("All Projects") */}
            <Dropdown
              value={closedFilter}
              onChange={(val) => {
                setClosedFilter(String(val));
                setPage(1);
              }}
              options={lifecycleOptions}
              placeholder="All Projects"
              size="sm"
              className="w-full sm:w-40"
            />

            {/* Clear filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
                title={t("clear_filters")}
              >
                <X size={14} />
                <span>{t("clear_filters")}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            {t("loading")}
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600">
            <AlertTriangle size={32} className="mx-auto mb-2 text-rose-500" />
            <p className="font-medium text-sm">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Briefcase size={24} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{t("no_projects_found")}</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">{t("no_projects_desc")}</p>
            {canCreate && (
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium px-4 py-2 rounded-xl transition-all"
              >
                <Plus size={16} />
                {t("create_first_project")}
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t("col_code")}</th>
                  <th className="py-3 px-4">{t("col_name")}</th>
                  <th className="py-3 px-4">{t("col_client")}</th>
                  <th className="py-3 px-4">{t("col_timespan")}</th>
                  <th className="py-3 px-4">{t("col_status")}</th>
                  <th className="py-3 px-4">{t("col_priority")}</th>
                  <th className="py-3 px-4">{t("col_budget")}</th>
                  <th className="py-3 px-4">{t("col_documents")}</th>
                  <th className="py-3 px-4">{t("col_billing_method")}</th>
                  <th className="py-3 px-4">{t("col_comment")}</th>
                  <th className="py-3 px-4 text-right">{t("col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => {
                  const statusColor = p.status_color || "#64748B";
                  const priorityColor = p.priority_color || "#3B82F6";
                  const billingColor = p.billing_method_color || "#6366F1";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-900 whitespace-nowrap">
                        {p.code}
                      </td>

                      {/* Name with link */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[200px] truncate">
                        <Link
                          href={`/projects/${p.id}`}
                          className="hover:text-cyan-600 transition-colors flex items-center gap-1.5 group-hover:underline"
                        >
                          <span className="truncate">{p.name}</span>
                          <ExternalLink size={13} className="text-slate-400 shrink-0" />
                        </Link>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        {p.client_name || "-"}
                      </td>

                      {/* Timespan */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {p.start_date ? (
                          <span>
                            {formatDate(p.start_date)}
                            {p.end_date ? ` → ${formatDate(p.end_date)}` : ` (${t("ongoing")})`}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">{t("not_set")}</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs"
                          style={{
                            backgroundColor: `${statusColor}15`,
                            color: statusColor,
                            border: `1px solid ${statusColor}40`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: statusColor }}
                          ></span>
                          <span>{p.status_name}</span>
                        </span>
                      </td>

                      {/* Priority Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                          style={{
                            backgroundColor: `${priorityColor}15`,
                            color: priorityColor,
                          }}
                        >
                          <span>{p.priority_name}</span>
                        </span>
                      </td>

                      {/* Budget & Over-budget badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 text-xs">
                            {formatCurrency(p.total_budget, currencySymbol)}
                          </span>
                          {p.is_over_budget && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 w-fit mt-0.5">
                              <AlertTriangle size={10} />
                              Over Budget
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Docs count */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <FileText size={12} className="text-slate-400" />
                          {p.documents_count}
                        </span>
                      </td>

                      {/* Billing Method */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${billingColor}10`,
                            color: billingColor,
                          }}
                        >
                          {p.billing_method_name}
                        </span>
                      </td>

                      {/* Comment truncated with tooltip */}
                      <td
                        className="py-3.5 px-4 text-xs text-slate-500 max-w-[150px] truncate"
                        title={p.comment || ""}
                      >
                        {p.comment ? p.comment : <span className="text-slate-300">-</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-cyan-600 hover:text-cyan-700 font-medium text-xs inline-flex items-center gap-1 hover:underline"
                        >
                          {t("view_details")}
                          <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > pageSize && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(page - 1) * pageSize + 1} to{" "}
              {Math.min(page * pageSize, totalCount)} of {totalCount} projects
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-medium">Page {page}</span>
              <button
                type="button"
                disabled={page * pageSize >= totalCount}
                onClick={() => setPage((prev) => prev + 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
