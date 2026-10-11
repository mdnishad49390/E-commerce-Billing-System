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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Payments & Due Tracking
          </h2>
          <p className="text-slate-500 text-sm">
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
