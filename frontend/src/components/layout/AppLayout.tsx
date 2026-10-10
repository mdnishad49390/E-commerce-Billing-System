"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge } from "@/components/common";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Users,
  Layers,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  UserCheck,
  History,
  KeyRound,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  Briefcase,
} from "lucide-react";
import { t } from "@/lib/translations";
import { api } from "@/lib/api";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, changePassword, loading, isAdmin, isAccountant } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Invoices dropdown & active state (Hooks must be called before any early return)
  const isInvoiceSectionActive = pathname.startsWith("/invoices");
  const isCreateBillActive = pathname === "/invoices/create" || pathname === "/invoices/new";
  const isAllInvoicesActive = pathname === "/invoices" || (isInvoiceSectionActive && !isCreateBillActive);
  const [invoicesExpanded, setInvoicesExpanded] = useState(isInvoiceSectionActive);

  useEffect(() => {
    if (pathname.startsWith("/invoices")) {
      setInvoicesExpanded(true);
    }
  }, [pathname]);

  // Change Password Modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Dynamic project visibility from permission matrix
  const [canViewProjects, setCanViewProjects] = useState(true);

  useEffect(() => {
    if (user) {
      api.getProjectConfig()
        .then((cfg) => {
          if (cfg && cfg.permissions) {
            setCanViewProjects(!!cfg.permissions.can_view);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // If on login page, render children without sidebar or topbar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading Billing System...</p>
        </div>
      </div>
    );
  }

  // Navigation Items with RBAC visibility rules & nested branches
  type NavSubItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    isActive: boolean;
    visible?: boolean;
  };

  type NavItem =
    | {
        type: "dropdown";
        label: string;
        icon: React.ComponentType<{ size?: number; className?: string }>;
        visible: boolean;
        isOpen: boolean;
        onToggle: () => void;
        isActive: boolean;
        children: NavSubItem[];
      }
    | {
        type?: "link";
        href: string;
        label: string;
        icon: React.ComponentType<{ size?: number; className?: string }>;
        visible: boolean;
      };

  const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, visible: true },
    {
      type: "dropdown",
      label: "Invoices",
      icon: FileText,
      visible: true,
      isOpen: invoicesExpanded,
      onToggle: () => setInvoicesExpanded((prev) => !prev),
      isActive: isInvoiceSectionActive,
      children: [
        {
          href: "/invoices",
          label: "All Invoices",
          icon: FileText,
          isActive: isAllInvoicesActive,
          visible: true,
        },
        {
          href: "/invoices/create",
          label: "Create Bill",
          icon: PlusCircle,
          isActive: isCreateBillActive,
          visible: true,
        },
      ],
    },
    { href: "/payments", label: "Payments & Due", icon: CreditCard, visible: true },
    { href: "/clients", label: "Clients", icon: Users, visible: true },
    { href: "/services", label: "Services", icon: Layers, visible: true },
    { href: "/projects", label: t("nav_projects"), icon: Briefcase, visible: canViewProjects },
    // Admin Only Links
    { href: "/users", label: "Users & Roles", icon: UserCheck, visible: isAdmin },
    { href: "/recurring-runs", label: "Recurring Runs", icon: RefreshCw, visible: isAdmin },
    { href: "/audit-logs", label: "Audit Logs", icon: History, visible: isAdmin },
    { href: "/settings", label: "Settings", icon: Settings, visible: isAdmin },
  ];

  const visibleNavItems = navItems.filter((item) => item.visible);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPasswordSuccess("Password updated successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess("");
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 print:hidden shadow-xs">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Logo" className="h-7 object-contain" />
          <span className="font-bold text-sm text-slate-900">RAKTCH Billing</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={user?.role || "STAFF"} type="role" size="xs" showDot={false} />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 print:hidden shadow-xs shrink-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo & Brand */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-center">
            <img src="/logo.png" alt="RAKTCH Technology & Software" className="h-10 object-contain" />
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1 flex-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation Menu
            </div>
            {visibleNavItems.map((item) => {
              if (item.type === "dropdown") {
                const DropdownIcon = item.icon;
                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      type="button"
                      onClick={item.onToggle}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                        item.isActive
                          ? "bg-cyan-50/70 text-cyan-900 border border-cyan-200/60 font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <DropdownIcon
                          size={18}
                          className={item.isActive ? "text-cyan-600" : "text-slate-400"}
                        />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${
                          item.isOpen ? "rotate-180 text-cyan-600" : "text-slate-400"
                        }`}
                      />
                    </button>

                    {item.isOpen && (
                      <div className="ml-4 pl-3 border-l-2 border-slate-200 space-y-1 py-1">
                        {item.children
                          .filter((child) => child.visible !== false)
                          .map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                                  child.isActive
                                    ? "bg-cyan-50 text-cyan-800 font-bold border border-cyan-200/80 shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                }`}
                              >
                                <ChildIcon
                                  size={15}
                                  className={child.isActive ? "text-cyan-600" : "text-slate-400"}
                                />
                                <span>{child.label}</span>
                              </Link>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              }

              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href!));
              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? "bg-cyan-50 text-cyan-800 border border-cyan-200/80 font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-cyan-600" : "text-slate-400"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Card & Logout Bottom Section */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-10 h-10 rounded-full bg-cyan-100 border border-cyan-200 flex items-center justify-center font-bold text-cyan-800 text-sm shrink-0">
                {user?.username?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : user?.username}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusBadge status={user?.role || "STAFF"} type="role" size="xs" showDot={false} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="Change Password"
              >
                <KeyRound size={13} />
                <span>Password</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white border-b border-slate-200 print:hidden sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Workspace</span>
            <span className="text-xs font-semibold text-slate-600">/ RAKTCH Technology & Software</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
              <Shield size={14} className="text-cyan-600" />
              <span>Signed in as:</span>
              <strong className="text-slate-900">{user?.username}</strong>
              <StatusBadge status={user?.role || "STAFF"} type="role" size="xs" showDot={false} />
            </div>

            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <KeyRound size={13} />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-8 bg-slate-50 text-slate-900 overflow-y-auto print:overflow-visible print:p-0 print:m-0 print:bg-white">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-cyan-600" />
                <h3 className="font-bold text-base text-slate-900">Change Password</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
