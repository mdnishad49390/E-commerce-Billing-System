import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "outline"
  | "ghost";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary:
      "bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 hover:shadow-cyan-600/30",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200",
    success:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/20",
    outline:
      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs",
    ghost:
      "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
  }[variant];

  const sizeStyles = {
    xs: "px-2.5 py-1 text-xs rounded-lg gap-1.5",
    sm: "px-3.5 py-1.5 text-xs rounded-xl gap-2",
    md: "px-4 py-2.5 text-sm rounded-xl gap-2",
    lg: "px-5 py-3 text-base rounded-2xl gap-2.5",
  }[size];

  const iconSize = size === "xs" ? 13 : size === "sm" ? 15 : size === "md" ? 17 : 19;

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin shrink-0" />
      ) : Icon ? (
        <Icon size={iconSize} className="shrink-0" />
      ) : null}
      {children}
    </button>
  );
}
