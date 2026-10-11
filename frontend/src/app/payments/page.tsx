"use client";

import React, { useEffect, useState } from "react";
import { api, PaymentMethod } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import PaymentTracker from "@/components/payments/PaymentTracker";
import { Calendar } from "lucide-react";

export default function PaymentsPage() {
  const { isAccountant } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    api.getPaymentMethods()
      .then((res) => setPaymentMethods(res.results || []))
      .catch((err) => console.error("Error loading payment methods:", err));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-white via-cyan-50/25 to-blue-50/40 p-6 md:p-8 rounded-3xl border border-cyan-200/60 shadow-[0_4px_24px_-6px_rgba(6,182,212,0.08)]">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Payments & Due Tracking
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Monitor payment collections, record transaction entries, download official Money Receipts, and track outstanding receivables
          </p>
        </div>
      </div>

      {/* Single tab: Transactions (the monthly payment tracking calendar) */}
      <div role="tablist" aria-label="Payments view" className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
        <button
          role="tab"
          aria-selected={true}
          className="px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 bg-white text-cyan-700 shadow-xs"
        >
          <Calendar size={15} />
          Transactions
        </button>
      </div>

      <PaymentTracker paymentMethods={paymentMethods} isAccountant={isAccountant} />
    </div>
  );
}
