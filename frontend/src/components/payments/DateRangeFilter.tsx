"use client";

import React from "react";
import { DatePicker } from "@/components/common";

interface Props {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

/** Start / End date pickers (project DatePicker). Empty = no limit on that side. */
export default function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-44">
        <DatePicker
          value={startDate}
          onChange={onStartChange}
          maxDate={endDate || undefined}
          size="md"
          clearable
          placeholder="Start date"
        />
      </div>
      <div className="w-44">
        <DatePicker
          value={endDate}
          onChange={onEndChange}
          minDate={startDate || undefined}
          size="md"
          clearable
          placeholder="End date"
        />
      </div>
    </div>
  );
}
