import React from "react";

export type MetricColor = "cyan" | "blue" | "emerald" | "amber" | "rose" | "purple";

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  color?: MetricColor;
  trend?: {
    label: string;
    isPositive?: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  color = "cyan",
  trend,
  className = "",
  onClick,
}: MetricCardProps) {
  // Theme color maps
  const colorStyles = {
    cyan: {
      bg: "bg-gradient-to-br from-white via-white to-cyan-50/60",
      border: "border-cyan-100/80",
      shadow: "shadow-[0_4px_20px_-4px_rgba(6,182,212,0.12)] hover:shadow-[0_8px_25px_-4px_rgba(6,182,212,0.2)]",
      iconBg: "bg-cyan-100/80 text-cyan-600",
      subtitleText: "text-cyan-600",
    },
    blue: {
      bg: "bg-gradient-to-br from-white via-white to-blue-50/60",
      border: "border-blue-100/80",
      shadow: "shadow-[0_4px_20px_-4px_rgba(59,130,246,0.12)] hover:shadow-[0_8px_25px_-4px_rgba(59,130,246,0.2)]",
      iconBg: "bg-blue-100/80 text-blue-600",
      subtitleText: "text-blue-600",
    },
    emerald: {
      bg: "bg-gradient-to-br from-white via-white to-emerald-50/60",
      border: "border-emerald-100/80",
      shadow: "shadow-[0_4px_20px_-4px_rgba(16,185,129,0.12)] hover:shadow-[0_8px_25px_-4px_rgba(16,185,129,0.2)]",
      iconBg: "bg-emerald-100/80 text-emerald-600",
      subtitleText: "text-emerald-600",
    },
    amber: {
      bg: "bg-gradient-to-br from-white via-white to-amber-50/60",
      border: "border-amber-100/80",
      shadow: "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)] hover:shadow-[0_8px_25px_-4px_rgba(245,158,11,0.2)]",
      iconBg: "bg-amber-100/80 text-amber-600",
      subtitleText: "text-amber-600",
    },
    rose: {
      bg: "bg-gradient-to-br from-white via-white to-rose-50/60",
      border: "border-rose-100/80",
      shadow: "shadow-[0_4px_20px_-4px_rgba(244,63,94,0.12)] hover:shadow-[0_8px_25px_-4px_rgba(244,63,94,0.2)]",
      iconBg: "bg-rose-100/80 text-rose-600",
      subtitleText: "text-rose-600",
    },
    purple: {
      bg: "bg-gradient-to-br from-white via-white to-purple-50/60",
      border: "border-purple-100/80",
      shadow: "shadow-[0_4px_20px_-4px_rgba(168,85,247,0.12)] hover:shadow-[0_8px_25px_-4px_rgba(168,85,247,0.2)]",
      iconBg: "bg-purple-100/80 text-purple-600",
      subtitleText: "text-purple-600",
    },
  }[color];

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
        colorStyles.bg
      } ${colorStyles.border} ${colorStyles.shadow} ${
        onClick ? "cursor-pointer hover:-translate-y-0.5" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {Icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-2xs ${colorStyles.iconBg}`}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
        <span>{value}</span>
        {unit && (
          <span className="text-xs font-semibold text-slate-500 tracking-normal">
            {unit}
          </span>
        )}
      </div>

      {subtitle && (
        <div className={`mt-1.5 text-[11px] font-medium ${colorStyles.subtitleText}`}>
          {subtitle}
        </div>
      )}

      {trend && (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-bold">
          <span
            className={trend.isPositive ? "text-emerald-600" : "text-rose-600"}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.label}
          </span>
        </div>
      )}
    </div>
  );
}
