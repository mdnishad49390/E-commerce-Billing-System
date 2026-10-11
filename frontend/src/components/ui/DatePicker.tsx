"use client";

import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  CalendarDays,
} from "lucide-react";

export interface DatePickerProps {
  /** Date in ISO string format (YYYY-MM-DD) or empty string */
  value?: string;
  /** Callback fired when date changes; returns ISO string (YYYY-MM-DD) or empty string */
  onChange: (date: string) => void;
  /** Placeholder when no date is selected */
  placeholder?: string;
  /** Label rendered above the picker */
  label?: string;
  /** Error message displayed below picker */
  error?: string;
  /** Helper text displayed below picker */
  helperText?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required field validation (renders hidden required input) */
  required?: boolean;
  /** Minimum selectable date (YYYY-MM-DD) */
  minDate?: string;
  /** Maximum selectable date (YYYY-MM-DD) */
  maxDate?: string;
  /** Sizing variant */
  size?: "sm" | "md" | "lg";
  /** Format to display in input trigger ("friendly" = "Apr 10, 2026", "iso" = "2026-04-10") */
  displayFormat?: "friendly" | "iso";
  /** Whether to show clear button when a date is selected */
  clearable?: boolean;
  /** Popover placement preference */
  placement?: "bottom" | "top" | "auto";
  /** Popover horizontal alignment */
  align?: "left" | "right" | "auto";
  /** Custom wrapper CSS class */
  className?: string;
  /** Custom trigger button CSS class */
  triggerClassName?: string;
  /** Custom popover calendar dropdown CSS class */
  popoverClassName?: string;
  /** HTML input name for form serialization */
  name?: string;
  /** HTML element ID */
  id?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Helper: Format YYYY-MM-DD deterministically without timezone issues
function toISODateString(year: number, monthIndex: number, day: number): string {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Helper: Parse YYYY-MM-DD deterministically
function parseISODateString(str?: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

export default function DatePicker({
  value = "",
  onChange,
  placeholder = "Select date...",
  label,
  error,
  helperText,
  disabled = false,
  required = false,
  minDate,
  maxDate,
  size = "md",
  displayFormat = "friendly",
  clearable = true,
  placement = "auto",
  align = "auto",
  className = "",
  triggerClassName = "",
  popoverClassName = "",
  name,
  id,
}: DatePickerProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [isUpward, setIsUpward] = useState(false);
  const [alignRight, setAlignRight] = useState(false);

  // Active view: days, months, or years
  const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");

  // Determine current today's date in local time
  const today = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      iso: toISODateString(now.getFullYear(), now.getMonth(), now.getDate()),
    };
  }, []);

  // Parsed initial selected date
  const parsedValue = useMemo(() => parseISODateString(value), [value]);

  // Calendar navigational state (viewing month/year)
  const [viewYear, setViewYear] = useState<number>(() => parsedValue?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState<number>(() => parsedValue?.month ?? today.month);

  // Synchronize calendar view whenever value changes and picker is opened
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year);
      setViewMonth(parsedValue.month);
    }
  }, [value]);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Viewport-aware flip and alignment calculation
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Vertical flip
      if (placement === "top") {
        setIsUpward(true);
      } else if (placement === "bottom") {
        setIsUpward(false);
      } else {
        // Auto: flip upward if space below is tighter than 340px and space above is bigger
        setIsUpward(spaceBelow < 340 && spaceAbove > spaceBelow);
      }

      // Horizontal alignment
      if (align === "right") {
        setAlignRight(true);
      } else if (align === "left") {
        setAlignRight(false);
      } else {
        // Auto: if not enough space on right (< 310px), align right
        const spaceRight = window.innerWidth - rect.left;
        setAlignRight(spaceRight < 320);
      }
    }
  }, [isOpen, placement, align]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode("days");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setViewMode("days");
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Select a day
  const handleSelectDay = (day: number, monthIndex: number, year: number) => {
    const dateStr = toISODateString(year, monthIndex, day);
    if (isDateDisabled(dateStr)) return;
    onChange(dateStr);
    setIsOpen(false);
    setViewMode("days");
  };

  // Clear date
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  // Jump to and select today
  const handleSelectToday = () => {
    if (!isDateDisabled(today.iso)) {
      onChange(today.iso);
      setViewYear(today.year);
      setViewMonth(today.month);
      setIsOpen(false);
      setViewMode("days");
    }
  };

  // Check if a given ISO date is disabled by min/max constraints
  const isDateDisabled = (isoDate: string) => {
    if (minDate && isoDate < minDate) return true;
    if (maxDate && isoDate > maxDate) return true;
    return false;
  };

  // Format label for display
  const displayValue = useMemo(() => {
    if (!value || !parsedValue) return "";
    if (displayFormat === "iso") return value;
    return `${MONTH_SHORT[parsedValue.month]} ${parsedValue.day}, ${parsedValue.year}`;
  }, [value, parsedValue, displayFormat]);

  // Generate calendar grid days for current month
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      iso: string;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    // Previous month overflow days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = toISODateString(prevYear, prevMonth, d);
      days.push({
        day: d,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        iso,
        isToday: iso === today.iso,
        isSelected: iso === value,
        isDisabled: isDateDisabled(iso),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISODateString(viewYear, viewMonth, d);
      days.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        iso,
        isToday: iso === today.iso,
        isSelected: iso === value,
        isDisabled: isDateDisabled(iso),
      });
    }

    // Next month overflow days (fill grid to complete rows)
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const iso = toISODateString(nextYear, nextMonth, d);
      days.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        iso,
        isToday: iso === today.iso,
        isSelected: iso === value,
        isDisabled: isDateDisabled(iso),
      });
    }

    return days;
  }, [viewYear, viewMonth, value, today.iso, minDate, maxDate]);

  // Year range calculation for Year selector view
  const yearRange = useMemo(() => {
    const base = Math.floor(viewYear / 12) * 12;
    return Array.from({ length: 12 }, (_, i) => base + i);
  }, [viewYear]);

  // Size styling tokens matching design system
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-xl gap-2",
    md: "px-4 py-2.5 text-sm rounded-xl gap-2.5",
    lg: "px-4.5 py-3 text-base rounded-2xl gap-3",
  }[size];

  const iconSize = size === "sm" ? 14 : size === "md" ? 16 : 18;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left w-full ${isOpen ? "z-50" : "z-auto"} ${className}`}
    >
      {/* Optional Top Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Hidden native input for form submissions & validation */}
      <input
        tabIndex={-1}
        type="text"
        name={name}
        value={value || ""}
        required={required}
        onChange={() => {}}
        aria-hidden="true"
        className="sr-only"
      />

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`group w-full flex items-center justify-between bg-white dark:bg-slate-900 border transition-all duration-150 cursor-pointer select-none text-left shadow-2xs font-medium ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
            : error
            ? "border-rose-400 focus:border-rose-500 ring-2 ring-rose-500/10 text-slate-900 dark:text-slate-100"
            : isOpen
            ? "border-cyan-500 ring-2 ring-cyan-500/20 text-slate-900 dark:text-white shadow-xs"
            : "border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
        } ${sizeStyles} ${triggerClassName}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CalendarIcon
            size={iconSize}
            className={`shrink-0 transition-colors ${
              disabled
                ? "text-slate-400"
                : isOpen
                ? "text-cyan-600 dark:text-cyan-400"
                : value
                ? "text-cyan-600 dark:text-cyan-400"
                : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600"
            }`}
          />
          <span className="truncate">
            {displayValue ? (
              <span className="text-slate-900 dark:text-slate-100 font-semibold">{displayValue}</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-normal">{placeholder}</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              title="Clear date"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <X size={13} />
            </span>
          )}
        </div>
      </button>

      {/* Helper text or Error message */}
      {error ? (
        <p className="mt-1.5 text-xs text-rose-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}

      {/* Calendar Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Calendar picker"
          className={`absolute ${alignRight ? "right-0" : "left-0"} ${
            isUpward ? "bottom-full mb-2" : "top-full mt-2"
          } z-50 w-[310px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md select-none ${popoverClassName}`}
        >
          {/* Header Bar */}
          <div className="p-3.5 pb-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {viewMode === "days" && (
                <>
                  <button
                    type="button"
                    onClick={() => setViewMode("months")}
                    className="px-2 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                  >
                    {MONTH_NAMES[viewMonth]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("years")}
                    className="px-2 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                  >
                    {viewYear}
                  </button>
                </>
              )}

              {viewMode === "months" && (
                <button
                  type="button"
                  onClick={() => setViewMode("years")}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {viewYear} (Pick Month)
                </button>
              )}

              {viewMode === "years" && (
                <span className="px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {yearRange[0]} – {yearRange[yearRange.length - 1]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  if (viewMode === "days") handlePrevMonth(e);
                  else if (viewMode === "years") setViewYear((y) => y - 12);
                  else setViewYear((y) => y - 1);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Previous"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  if (viewMode === "days") handleNextMonth(e);
                  else if (viewMode === "years") setViewYear((y) => y + 12);
                  else setViewYear((y) => y + 1);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* VIEW: Days Grid */}
          {viewMode === "days" && (
            <div className="p-3">
              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className="text-[11px] font-bold text-slate-400 dark:text-slate-500 py-1 uppercase tracking-wider"
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Days Matrix */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarDays.map((item, idx) => {
                  const isCurrent = item.isCurrentMonth;
                  const isSelected = item.isSelected;
                  const isToday = item.isToday;
                  const isDisabled = item.isDisabled;

                  return (
                    <button
                      key={`${item.iso}-${idx}`}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectDay(item.day, item.month, item.year)}
                      className={`h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-semibold transition-all duration-100 cursor-pointer relative ${
                        isDisabled
                          ? "opacity-25 cursor-not-allowed text-slate-400"
                          : isSelected
                          ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-bold shadow-sm shadow-cyan-500/40 scale-105"
                          : isToday
                          ? "ring-1.5 ring-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/60 dark:bg-cyan-950/30 font-bold hover:bg-cyan-100/70"
                          : isCurrent
                          ? "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-700 dark:hover:text-cyan-300"
                          : "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-500"
                      }`}
                    >
                      {item.day}
                      {/* Subtle Today Dot Indicator when not selected */}
                      {isToday && !isSelected && (
                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-cyan-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: Month Selector Grid */}
          {viewMode === "months" && (
            <div className="p-3 grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((name, idx) => {
                const isSelected = parsedValue?.month === idx && parsedValue?.year === viewYear;
                const isCurrent = today.month === idx && today.year === viewYear;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setViewMonth(idx);
                      setViewMode("days");
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-cyan-600 text-white font-bold shadow-xs"
                        : isCurrent
                        ? "ring-1 ring-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 font-bold hover:bg-cyan-100"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600"
                    }`}
                  >
                    {MONTH_SHORT[idx]}
                  </button>
                );
              })}
            </div>
          )}

          {/* VIEW: Year Selector Grid */}
          {viewMode === "years" && (
            <div className="p-3 grid grid-cols-3 gap-2">
              {yearRange.map((yr) => {
                const isSelected = parsedValue?.year === yr;
                const isCurrent = today.year === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setViewYear(yr);
                      setViewMode("months");
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "bg-cyan-600 text-white font-bold shadow-xs"
                        : isCurrent
                        ? "ring-1 ring-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 font-bold hover:bg-cyan-100"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600"
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Action Footer Bar */}
          <div className="p-2.5 px-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="flex items-center gap-1.5 font-bold text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <CalendarDays size={13} />
              Today
            </button>

            <div className="flex items-center gap-1.5">
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setViewMode("days");
                }}
                className="text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
