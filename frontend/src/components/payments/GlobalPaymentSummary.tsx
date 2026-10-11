"use client";

import React from "react";
import { AlertCircle, DollarSign, TrendingUp, Wallet } from "lucide-react";
import { MetricCard } from "@/components/common";
import type { CalendarSummary } from "@/lib/api";
import { money } from "./paymentStatus";

/** Four summary cards for the selected billing period (all computed by the backend). */
export default function GlobalPaymentSummary({ summary }: { summary: CalendarSummary | null }) {
  const rate =
    summary && Number(summary.total_expected) > 0
      ? ((Number(summary.total_collected) / Number(summary.total_expected)) * 100).toFixed(1)
      : "0.0";
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard title="Total Expected" value={money(summary?.total_expected ?? 0)} unit="৳" icon={Wallet} color="cyan" subtitle={`${summary?.total_bills ?? 0} invoices in period`} />
      <MetricCard title="Total Collected" value={money(summary?.total_collected ?? 0)} unit="৳" icon={DollarSign} color="emerald" subtitle={`${rate}% collected`} />
      <MetricCard title="Total Outstanding" value={money(summary?.total_due ?? 0)} unit="৳" icon={TrendingUp} color="amber" subtitle="Still to collect" />
      <MetricCard title="Overdue Invoices" value={summary?.counts?.OVERDUE ?? 0} icon={AlertCircle} color="rose" subtitle="Past due date" />
    </div>
  );
}
