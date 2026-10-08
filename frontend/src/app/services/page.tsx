"use client";

import React, { useEffect, useState } from "react";
import { api, Service } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Dropdown } from "@/components/common";
import { Plus, Layers, Edit, Trash2, X } from "lucide-react";

export default function ServicesPage() {
  const { isAccountant, isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [techSpec, setTechSpec] = useState("Hosting & Maintenance Bill");
  const [price, setPrice] = useState("1000.00");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME">("MONTHLY");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const loadServices = async () => {
    try {
      setLoading(true);
      const res = await api.getServices();
      setServices(res.results || []);
    } catch (err) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleOpenAdd = () => {
    setEditingService(null);
    setName("");
    setCode("");
    setTechSpec("Hosting & Maintenance Bill");
    setPrice("1000.00");
    setBillingCycle("MONTHLY");
    setModalError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Service) => {
    setEditingService(s);
    setName(s.name);
    setCode(s.code || "");
    setTechSpec(s.default_tech_specification);
    setPrice(s.default_price);
    setBillingCycle(s.billing_cycle);
    setModalError("");
    setModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      setModalError("");
      const payload = {
        name,
        code,
        default_tech_specification: techSpec,
        default_price: price,
        billing_cycle: billingCycle,
        is_active: true,
      };

      if (editingService) {
        await api.updateService(editingService.id, payload);
      } else {
        await api.createService(payload);
      }

      setModalOpen(false);
      await loadServices();
    } catch (err: any) {
      setModalError(err.message || "Failed to save service.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteService = async (id: number, sName: string) => {
    if (!confirm(`Delete service ${sName}?`)) return;
    try {
      await api.deleteService(id);
      await loadServices();
    } catch (err: any) {
      alert(err.message || "Failed to delete service");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Services & Subscriptions</h2>
          <p className="text-slate-500 text-sm">Define software products, hosting packages, and default rates</p>
        </div>

        {isAccountant && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
          >
            <Plus size={18} />
            Add New Service
          </button>
        )}
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Loading services...
        </div>
      ) : services.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 shadow-sm">
          No services defined yet. Click "Add New Service" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <div
              key={s.id}
              className="group relative bg-gradient-to-b from-white via-white to-slate-50/70 border border-slate-200/90 hover:border-cyan-400/80 rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_32px_-6px_rgba(6,182,212,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-100/70 text-cyan-800 flex items-center justify-center border border-cyan-200 shadow-xs group-hover:scale-105 transition-transform">
                    <Layers size={22} className="text-cyan-700" />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-xl border border-slate-200/70">
                    {isAccountant && (
                      <button
                        onClick={() => handleOpenEdit(s)}
                        title="Edit Service"
                        className="p-1.5 text-slate-500 hover:text-cyan-700 hover:bg-white rounded-lg transition-all cursor-pointer shadow-none hover:shadow-xs"
                      >
                        <Edit size={15} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteService(s.id, s.name)}
                        title="Delete Service"
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-all cursor-pointer shadow-none hover:shadow-xs"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-cyan-900 transition-colors">{s.name}</h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-cyan-50 text-cyan-800 border border-cyan-200">
                    {s.billing_cycle}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                  {s.default_tech_specification}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-slate-500">Default Rate:</span>
                <span className="text-xl font-black text-cyan-800">
                  {parseFloat(s.default_price).toLocaleString()} <span className="text-xs text-cyan-700 font-bold">Tk</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Service Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-slate-900 mb-1">
              {editingService ? "Edit Service" : "Add New Service"}
            </h3>
            <p className="text-xs text-slate-500 mb-6">Service pricing and specification defaults</p>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveService} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Supershop Software"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Default Price (Tk) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Billing Cycle
                  </label>
                  <Dropdown
                    value={billingCycle}
                    onChange={(val) => setBillingCycle(val as any)}
                    options={[
                      { value: "MONTHLY", label: "Monthly" },
                      { value: "QUARTERLY", label: "Quarterly" },
                      { value: "YEARLY", label: "Yearly" },
                      { value: "ONE_TIME", label: "One Time" },
                    ]}
                    size="md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Default Technical Specification
                </label>
                <textarea
                  rows={2}
                  value={techSpec}
                  onChange={(e) => setTechSpec(e.target.value)}
                  placeholder="Hosting & Maintenance Bill"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !name}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {modalLoading ? "Saving..." : editingService ? "Update Service" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
