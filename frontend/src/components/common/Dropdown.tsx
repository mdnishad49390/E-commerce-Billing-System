"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface DropdownOption<T = string | number> {
  value: T;
  label: string;
  secondary?: string;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

export interface DropdownProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "md" | "lg";
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  name?: string;
  id?: string;
  placement?: "bottom" | "top" | "auto";
  maxHeight?: string;
}

export default function Dropdown<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  className = "",
  triggerClassName = "",
  menuClassName = "",
  disabled = false,
  required = false,
  size = "md",
  searchable = false,
  searchPlaceholder = "Search...",
  icon: LeadingIcon,
  name,
  id,
  placement = "auto",
  maxHeight = "max-h-60",
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpward, setIsUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected option
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Determine popover direction (upward or downward)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (placement === "top") {
        setIsUpward(true);
      } else if (placement === "bottom") {
        setIsUpward(false);
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // If not enough room below (<250px) and more room above, flip upward
        if (spaceBelow < 250 && spaceAbove > spaceBelow) {
          setIsUpward(true);
        } else {
          setIsUpward(false);
        }
      }
    }
  }, [isOpen, placement]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  // Filter options based on search query
  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opt.secondary && opt.secondary.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  const handleSelect = (option: DropdownOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Size styling tokens
  const sizeStyles = {
    sm: "px-3 py-2 text-xs rounded-xl",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-4.5 py-3 text-base rounded-2xl",
  }[size];

  const iconSize = size === "sm" ? 14 : size === "md" ? 16 : 18;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left w-full ${isOpen ? "z-50" : "z-auto"} ${className}`}
      id={id}
    >
      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
          value={value !== undefined && value !== null ? String(value) : ""}
          required={required}
          onChange={() => {}}
          name={name}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2.5 bg-white border transition-all duration-150 cursor-pointer select-none text-left shadow-2xs font-medium ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
            : isOpen
            ? "border-cyan-500 ring-2 ring-cyan-500/20 text-slate-900 shadow-xs"
            : "border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50/50"
        } ${sizeStyles} ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {LeadingIcon && (
            <LeadingIcon
              size={iconSize}
              className={`shrink-0 ${isOpen ? "text-cyan-600" : "text-slate-400"}`}
            />
          )}

          <div className="truncate">
            {selectedOption ? (
              <span className="text-slate-900 font-semibold">{selectedOption.label}</span>
            ) : (
              <span className="text-slate-400 font-normal">{placeholder}</span>
            )}
          </div>

          {selectedOption?.badge && (
            <span
              className={`ml-1.5 shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                selectedOption.badgeColor || "bg-cyan-50 text-cyan-700 border border-cyan-200/60"
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={iconSize}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-cyan-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute left-0 ${
            isUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } z-50 w-full min-w-[200px] bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${menuClassName}`}
          role="listbox"
        >
          {/* Search Bar */}
          {searchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Options List with scrolling & max-height */}
          <div className={`${maxHeight} overflow-y-auto p-1.5 space-y-0.5 overscroll-contain`}>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-400 font-medium">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-xl transition-all duration-100 cursor-pointer ${
                      opt.disabled
                        ? "opacity-40 cursor-not-allowed text-slate-400"
                        : isSelected
                        ? "bg-cyan-50 text-cyan-900 font-bold border border-cyan-200/80 shadow-2xs"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 font-medium"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate flex items-center gap-2">
                        <span>{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                              opt.badgeColor || "bg-cyan-100 text-cyan-800"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.secondary && (
                        <div className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                          {opt.secondary}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check size={14} className="shrink-0 text-cyan-600 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
