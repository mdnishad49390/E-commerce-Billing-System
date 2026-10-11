import React from "react";
import type { CalendarStatus } from "@/lib/api";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// One simple text badge per row; the text label (not just colour) carries the meaning.
export const STATUS_META: Record<CalendarStatus, { label: string; badge: string }> = {
  PAID: { label: "PAID", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DUE: { label: "DUE", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  OVERDUE: { label: "OVERDUE", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  PARTIALLY_PAID: { label: "PARTIALLY PAID", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  UPCOMING: { label: "UPCOMING", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  // Only used for unbilled subscription placeholders, which this table does not list.
  NO_PAYMENT: { label: "NO PAYMENT", badge: "bg-slate-50 text-slate-500 border-slate-200" },
};

// Statuses offered in the filter (the five a billing obligation can have).
export const STATUS_ORDER: CalendarStatus[] = ["PAID", "DUE", "OVERDUE", "PARTIALLY_PAID", "UPCOMING"];

export const money = (v: string | number) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const taka = (v: string | number) => `৳${money(v)}`;

export const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** "10 Oct 2026" - compact date for table cells. */
export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
};

export const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export function PaymentStatusBadge({ status, className = "" }: { status: CalendarStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wide whitespace-nowrap ${meta.badge} ${className}`}>
      {meta.label}
    </span>
  );
}
