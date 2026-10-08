"use client";

import React, { useEffect, useState } from "react";
import { api, Client, Service } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Dropdown } from "@/components/common";
import { Plus, Edit, Trash2, X, Phone, Mail, MapPin, Layers } from "lucide-react";

export default function ClientsPage() {
  const { isAccountant, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Client Pricing Modal
  const [pricingModalClient, setPricingModalClient] = useState<Client | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | "">("");
  const [customPrice, setCustomPrice] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSpec, setCustomSpec] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [cRes, sRes] = await Promise.all([
        api.getClients(),
        api.getServices(),
      ]);
      setClients(cRes.results || []);
      setServices(sRes.results || []);
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingClient(null);
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress("");
    setModalError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Client) => {
    setEditingClient(c);
    setName(c.name);
    setContactPerson(c.contact_person || "");
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setAddress(c.address || "");
    setModalError("");
    setModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      setModalError("");
      const payload = {
        name,
        contact_person: contactPerson,
        phone,
        email,
        address,
      };

      if (editingClient) {
        await api.updateClient(editingClient.id, payload);
      } else {
        await api.createClient(payload);
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || "Failed to save client.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClient = async (id: number, clientName: string) => {
    if (!confirm(`Delete client ${clientName}?`)) return;
    try {
      await api.deleteClient(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete client");
    }
  };

  const handleOpenPricing = (client: Client) => {
    setPricingModalClient(client);
    if (services.length > 0) {
      setSelectedServiceId(services[0].id);
      setCustomPrice(services[0].default_price);
      setCustomName(services[0].name);
      setCustomSpec(services[0].default_tech_specification);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingModalClient || !selectedServiceId) return;
    try {
      await api.saveClientService({
        client: pricingModalClient.id,
        service: Number(selectedServiceId),
        custom_name: customName,
        custom_tech_specification: customSpec,
        custom_price: customPrice,
        is_active: true,
      });
      setPricingModalClient(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to save client subscription pricing.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clients</h2>
          <p className="text-slate-500 text-sm">Manage business clients and service subscriptions</p>
        </div>

        {isAccountant && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
          >
            <Plus size={18} />
            Add New Client
          </button>
        )}
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Loading clients...
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 shadow-sm">
          No clients added yet. Click "Add New Client" to create your first client.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((c) => (
            <div
              key={c.id}
              className="group relative bg-gradient-to-b from-white via-white to-slate-50/70 border border-slate-200/90 hover:border-cyan-400/80 rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_32px_-6px_rgba(6,182,212,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-100/70 text-cyan-800 flex items-center justify-center font-black text-lg border border-cyan-200 shadow-xs group-hover:scale-105 transition-transform">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-xl border border-slate-200/70">
                    {isAccountant && (
                      <button
                        onClick={() => handleOpenEdit(c)}
                        title="Edit Client"
                        className="p-1.5 text-slate-500 hover:text-cyan-700 hover:bg-white rounded-lg transition-all cursor-pointer shadow-none hover:shadow-xs"
                      >
                        <Edit size={15} />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteClient(c.id, c.name)}
                        title="Delete Client"
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-all cursor-pointer shadow-none hover:shadow-xs"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-cyan-900 transition-colors">{c.name}</h3>
                {c.contact_person && (
                  <p className="text-xs text-cyan-700 font-semibold mt-0.5">{c.contact_person}</p>
                )}

                <div className="space-y-2 mt-4 text-xs text-slate-600">
                  {c.phone && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Phone size={12} />
                      </div>
                      <span className="font-medium text-slate-700">{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Mail size={12} />
                      </div>
                      <span className="truncate font-medium text-slate-700">{c.email}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin size={12} />
                      </div>
                      <span className="truncate text-slate-600">{c.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subscriptions Footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100/90 border border-slate-200/80 px-2.5 py-0.5 rounded-full text-[11px]">
                    {c.client_services?.length || 0} active service(s)
                  </span>
                </div>

                {isAccountant && (
                  <button
                    onClick={() => handleOpenPricing(c)}
                    className="text-xs font-bold text-cyan-700 hover:text-cyan-900 bg-cyan-50/80 hover:bg-cyan-100 border border-cyan-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Layers size={13} />
                    Manage Pricing
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Client Modal */}
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
              {editingClient ? "Edit Client" : "Add New Client"}
            </h3>
            <p className="text-xs text-slate-500 mb-6">Enter company and primary contact details</p>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Company / Client Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rose International"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Managing Director"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+8801700000000"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@client.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dhaka, Bangladesh"
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
                  {modalLoading ? "Saving..." : editingClient ? "Update Client" : "Create Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Service Pricing Modal */}
      {pricingModalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setPricingModalClient(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-slate-900 mb-1">Service Subscription Pricing</h3>
            <p className="text-xs text-slate-500 mb-6">
              Configure subscription price for <span className="text-slate-900 font-bold">{pricingModalClient.name}</span>
            </p>

            <form onSubmit={handleSavePricing} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Service
                </label>
                <Dropdown
                  value={selectedServiceId || ""}
                  onChange={(val) => {
                    const sid = Number(val);
                    setSelectedServiceId(sid);
                    const s = services.find((x) => x.id === sid);
                    if (s) {
                      setCustomPrice(s.default_price);
                      setCustomName(s.name);
                      setCustomSpec(s.default_tech_specification);
                    }
                  }}
                  options={services.map((s) => ({
                    value: s.id,
                    label: s.name,
                    secondary: `Default: ${s.default_price} Tk`,
                    badge: `${s.default_price} Tk`,
                  }))}
                  placeholder="Select a service..."
                  size="md"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Custom Monthly Price (Tk) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Custom Service Name for Bill
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Supershop Software"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Technical Specification
                </label>
                <input
                  type="text"
                  value={customSpec}
                  onChange={(e) => setCustomSpec(e.target.value)}
                  placeholder="Hosting & Maintenance Bill"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPricingModalClient(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer shadow-sm"
                >
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
