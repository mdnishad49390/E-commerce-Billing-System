"use client";

import React from "react";
import { Search, X } from "lucide-react";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  size?: "sm" | "md";
  autoFocus?: boolean;
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = "Search...",
  className = "",
  inputClassName = "",
  size = "md",
  autoFocus = false,
}: SearchBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  const handleClear = () => {
    onChange("");
    if (onClear) {
      onClear();
    }
  };

  const sizeStyles = {
    sm: "pl-9 pr-8 py-2 text-xs rounded-xl",
    md: "pl-10 pr-9 py-2.5 text-sm rounded-xl",
  }[size];

  const iconSize = size === "sm" ? 15 : 17;

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex-1 min-w-[240px] ${className}`}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all shadow-2xs font-medium ${sizeStyles} ${inputClassName}`}
      />

      <Search
        size={iconSize}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-0.5"
          title="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </form>
  );
}
