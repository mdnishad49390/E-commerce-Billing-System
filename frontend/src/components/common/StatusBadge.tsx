import React from "react";

export type BadgeType = "invoice" | "role" | "general";
export type BadgeSize = "xs" | "sm" | "md";

export interface StatusBadgeProps {
  status: string;
  label?: string;
  type?: BadgeType;
  size?: BadgeSize;
  className?: string;
  showDot?: boolean;
}

export default function StatusBadge({
  status,
  label,
  type = "general",
  size = "sm",
  className = "",
  showDot = true,
}: StatusBadgeProps) {
  const normalized = (status || "").toUpperCase();

  // Color styles configuration
  let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
  let dotColor = "bg-slate-400";
  let displayLabel = label || status;

  if (type === "role") {
    switch (normalized) {
      case "ADMIN":
        badgeStyle = "bg-rose-100 text-rose-800 border-rose-300";
        dotColor = "bg-rose-500";
        displayLabel = label || "Admin";
        break;
      case "ACCOUNTANT":
        badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-300";
        dotColor = "bg-emerald-500";
        displayLabel = label || "Accountant";
        break;
      default:
        badgeStyle = "bg-indigo-100 text-indigo-800 border-indigo-300";
        dotColor = "bg-indigo-500";
        displayLabel = label || "Staff";
        break;
    }
  } else if (type === "invoice") {
    switch (normalized) {
      case "PAID":
        badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
        dotColor = "bg-emerald-500";
        displayLabel = label || "Paid";
        break;
      case "PARTIALLY_PAID":
        badgeStyle = "bg-amber-50 text-amber-700 border-amber-200/80";
        dotColor = "bg-amber-500";
        displayLabel = label || "Partially Paid";
        break;
      case "ISSUED":
        badgeStyle = "bg-blue-50 text-blue-700 border-blue-200/80";
        dotColor = "bg-blue-500";
        displayLabel = label || "Issued";
        break;
      case "DRAFT":
        badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
        dotColor = "bg-slate-400";
        displayLabel = label || "Draft";
        break;
      case "CANCELLED":
        badgeStyle = "bg-rose-50 text-rose-700 border-rose-200/80";
        dotColor = "bg-rose-500";
        displayLabel = label || "Cancelled";
        break;
      default:
        badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
        dotColor = "bg-slate-400";
        break;
    }
  } else {
    // General
    switch (normalized) {
      case "ACTIVE":
      case "SUCCESS":
      case "COMPLETED":
        badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
        dotColor = "bg-emerald-500";
        break;
      case "INACTIVE":
      case "FAILED":
      case "ERROR":
        badgeStyle = "bg-rose-50 text-rose-700 border-rose-200/80";
        dotColor = "bg-rose-500";
        break;
      case "PENDING":
      case "RUNNING":
        badgeStyle = "bg-amber-50 text-amber-700 border-amber-200/80";
        dotColor = "bg-amber-500 animate-pulse";
        break;
      default:
        badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
        dotColor = "bg-slate-400";
        break;
    }
  }

  // Size sizing
  const sizeStyles = {
    xs: "text-[10px] px-2 py-0.5",
    sm: "text-xs px-2.5 py-1",
    md: "text-sm px-3 py-1.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider border shadow-2xs ${sizeStyles} ${badgeStyle} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
