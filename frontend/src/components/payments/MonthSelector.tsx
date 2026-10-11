"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  month: number; // 1-12
  year: number;
  onChange: (month: number, year: number) => void;
}

/** Jan..Dec buttons (selected = green) plus a year stepper. Controls the shared billing-period filter. */
export default function MonthSelector({ month, year, onChange }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <span className="text-sm font-bold text-slate-800">Select Billing Month:</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChange(month, year - 1)}
            aria-label="Previous year"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <input
            aria-label="Billing year"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              if (y >= 2000 && y <= 2100) onChange(month, y);
            }}
            className="w-20 text-center bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-2 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => onChange(month, year + 1)}
            aria-label="Next year"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      {/* One row of 12; scrolls sideways on narrow screens. */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-12 lg:overflow-visible lg:pb-0" role="group" aria-label="Billing month">
        {MONTHS_SHORT.map((name, i) => {
          const selected = month === i + 1;
          return (
            <button
              key={name}
              onClick={() => onChange(i + 1, year)}
              aria-pressed={selected}
              className={`shrink-0 min-w-[64px] lg:min-w-0 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                selected
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
