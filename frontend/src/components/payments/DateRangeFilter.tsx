"use client";

import React from "react";
import { Calendar } from "lucide-react";

interface Props {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

const inputCls =
  "w-full pl-3 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500";

/** Start / End date inputs with calendar icons. Empty = the whole selected month. */
export default function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative block w-44">
        <span className="sr-only">Start date</span>
        <input type="date" value={startDate} max={endDate || undefined} onChange={(e) => onStartChange(e.target.value)} className={inputCls} />
        <Calendar size={15} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </label>
      <label className="relative block w-44">
        <span className="sr-only">End date</span>
        <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => onEndChange(e.target.value)} className={inputCls} />
        <Calendar size={15} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </label>
    </div>
  );
}
