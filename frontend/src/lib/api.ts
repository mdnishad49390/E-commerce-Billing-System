const API_BASE_URL = typeof window !== "undefined" ? "/api/proxy" : (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000/api");

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  role: "ADMIN" | "ACCOUNTANT" | "STAFF";
  phone: string;
  department: string;
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  role: "ADMIN" | "ACCOUNTANT" | "STAFF";
  phone: string;
  department: string;
}

export interface AuditLog {
  id: number;
  user: number | null;
  username: string;
  action: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT" | "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "PASSWORD_CHANGE";
  model_name: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, any>;
  ip_address: string;
  timestamp: string;
}

export interface Company {
  id: number;
  name: string;
  tagline: string;
  address: string;
  website: string;
  email: string;
  phone: string;
  logo: string | null;
  authorization_signature: string | null;
  is_default: boolean;
}

export interface BankAccount {
  id: number;
  company: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_name: string;
  routing_number: string;
  is_default: boolean;
  is_active: boolean;
}

export interface GlobalSettings {
  id: number;
  currency_symbol: string;
  currency_code: string;
  default_company: number | null;
  default_bank_account: number | null;
  default_nb_text: string;
  invoice_footer_note: string;
  auto_billing_enabled?: boolean;
  auto_billing_day?: number;
  auto_billing_time?: string;
  auto_billing_timezone?: string;
}

export interface Subscription {
  id: number;
  client: number;
  client_name?: string;
  service: number;
  service_name?: string;
  custom_name: string;
  custom_tech_specification: string;
  custom_price: string | null;
  effective_price?: string;
  effective_name?: string;
  effective_tech_specification?: string;
  billing_cycle: "MONTHLY" | "QUARTERLY" | "YEARLY";
  start_date: string;
  end_date: string | null;
  auto_status: "DRAFT" | "ISSUED";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringRun {
  id: number;
  run_time: string;
  trigger: "AUTO" | "MANUAL";
  trigger_display?: string;
  target_period: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  created_count: number;
  skipped_count: number;
  failed_count: number;
  details: {
    created?: Array<{ invoice_number: string; client_name: string; service_name: string; period: string; amount: number; status: string } | string>;
    skipped?: Array<{ subscription_id: number; client_id: number; client_name: string; service_name: string; period: string; reason: string }>;
    failed?: Array<{ subscription_id: number; client_id: number; client_name: string; service_name: string; period: string; error: string }>;
  };
  error_message: string;
  created_at: string;
}

export interface RecurringPreviewResponse {
  target_period: string;
  display_month: string;
  would_create: Array<{
    subscription_id: number;
    client_id: number;
    client_name: string;
    service_name: string;
    billing_period: string;
    billing_month: string;
    amount: number;
    status: string;
    billing_cycle: string;
    issue_date: string;
  }>;
  would_skip: Array<{
    subscription_id: number;
    client_id: number;
    client_name: string;
    service_name: string;
    period: string;
    reason: string;
  }>;
  total_would_create: number;
  total_would_skip: number;
}

export interface RecurringDashboardStatus {
  has_warning: boolean;
  warning_type: string;
  warning_message: string;
  auto_billing_enabled: boolean;
  auto_billing_day: number;
  auto_billing_time: string;
  auto_billing_timezone: string;
  last_run: RecurringRun | null;
}

export interface ClientServicePrice {
  id: number;
  client: number;
  service: number;
  service_name?: string;
  custom_name: string;
  custom_tech_specification: string;
  custom_price: string;
  is_active: boolean;
}

export interface Client {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  client_services?: ClientServicePrice[];
  subscriptions?: Subscription[];
}

export interface Service {
  id: number;
  name: string;
  code: string;
  default_tech_specification: string;
  default_price: string;
  billing_cycle: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
  is_active: boolean;
}

export interface InvoiceTemplate {
  id: number;
  name: string;
  title_pattern: string;
  invoice_number_prefix: string;
  nb_text: string;
  authorization_label: string;
  received_by_label: string;
  is_default: boolean;
}

export interface InvoiceItem {
  id?: number;
  sl: number;
  service?: number | null;
  item_name: string;
  technical_specification: string;
  quantity: string | number;
  unit_price: string | number;
  total?: string | number;
}

export interface Payment {
  id: number;
  invoice: number;
  receipt_number?: string;
  invoice_number?: string;
  invoice_title?: string;
  client_name?: string;
  client_id?: number;
  currency_symbol?: string;
  invoice_payable_amount?: string;
  invoice_due_amount?: string;
  invoice_status?: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "CANCELLED";
  amount: string;
  payment_date: string;
  payment_method: number | null;
  payment_method_name?: string;
  transaction_id: string;
  note: string;
  created_at: string;
}

export type CalendarStatus = "PAID" | "PARTIALLY_PAID" | "DUE" | "OVERDUE" | "UPCOMING" | "NO_PAYMENT";

export interface CalendarItem {
  key: string;
  has_invoice: boolean;
  invoice_id: number | null;
  invoice_number: string | null;
  invoice_status: string | null;
  client_id: number;
  client_name: string;
  title: string;
  billing_month: string;
  currency_symbol: string;
  due_date: string;
  expected_amount: string;
  paid_amount: string;
  remaining_amount: string;
  status: CalendarStatus;
  payment_id: number | null;
  payment_date: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  payment_count: number;
}

export interface CalendarDay {
  date: string;
  count: number;
  expected: string;
  collected: string;
  due: string;
  status_counts: Partial<Record<CalendarStatus, number>>;
  items: CalendarItem[];
}

export interface CalendarSummary {
  total_expected: string;
  total_collected: string;
  total_due: string;
  paid_clients: number;
  due_clients: number;
  overdue_clients: number;
  no_payment_clients: number;
  total_bills: number;
}

export interface CalendarResponse {
  year: number;
  month: number;
  today: string;
  summary: CalendarSummary;
  days: CalendarDay[];
}

export interface ClientHistoryResponse {
  client_id: number;
  client_name: string;
  history: {
    year: number;
    month: number;
    label: string;
    expected: string;
    paid: string;
    due: string;
    status: CalendarStatus;
    bills: CalendarItem[];
  }[];
}

export interface PaymentMethod {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  title: string;
  billing_month: string;
  issue_date: string;
  due_date: string | null;
  status: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "CANCELLED";
  client: number;
  company: number;
  bank_account: number | null;
  template: number | null;
  
  // Snapshots
  company_name: string;
  company_tagline: string;
  company_address: string;
  company_website: string;
  company_email: string;
  company_phone: string;
  logo_url?: string | null;
  signature_url?: string | null;

  client_name: string;
  client_contact_person: string;
  client_address: string;
  client_phone: string;
  client_email: string;

  bank_name: string;
  account_name: string;
  account_number: string;
  branch_name: string;
  routing_number: string;
  nb_text: string;

  currency_symbol: string;
  sub_total: string;
  discount: string;
  vat_rate: string;
  vat_amount: string;
  payable_amount: string;
  advance_amount: string;
  paid_amount: string;
  due_amount: string;

  authorization_label: string;
  received_by_label: string;
  qr_code_url?: string | null;
  notes: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  created_at: string;
}

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "include",
      ...options,
      headers,
    });

    if (response.status === 401 && typeof window !== "undefined") {
      if (window.location.pathname !== "/login") {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let msg = errorData.error || errorData.detail;
      if (!msg && typeof errorData === "object" && Object.keys(errorData).length > 0) {
        msg = Object.entries(errorData)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : v}`)
          .join(" | ");
      }
      throw new Error(msg || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // Auth (Uses Next.js secure route handlers with httpOnly cookies)
  async login(username: string, password: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "Invalid username or password.");
    }
    return data;
  }

  async logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    }).catch(() => {});
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to load user profile");
    }

    return response.json();
  }

  async changePassword(data: { old_password: string; new_password: string; confirm_password: string }) {
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const resData = await response.json().catch(() => ({}));
    if (!response.ok) {
      let msg = resData.detail;
      if (!msg && typeof resData === "object") {
        msg = Object.values(resData).flat().join(" ");
      }
      throw new Error(msg || "Failed to change password.");
    }
    return resData;
  }

  // Generic helpers
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
    let url = endpoint;
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          query.append(key, String(val));
        }
      });
      const queryString = query.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    }
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string): Promise<any> {
    return this.request<any>(endpoint, { method: "DELETE" });
  }

  // User Management (Admin Only)
  async getUsers(params?: any) {
    return this.get<{ count: number; results: ManagedUser[] }>("/users/", params);
  }

  async createUser(data: any) {
    return this.post<ManagedUser>("/users/", data);
  }

  async updateUser(id: number | string, data: any) {
    return this.patch<ManagedUser>(`/users/${id}/`, data);
  }

  async toggleUserActive(id: number | string) {
    return this.post<{ detail: string; is_active: boolean }>(`/users/${id}/toggle-active/`, {});
  }

  async resetUserPassword(id: number | string, data: { new_password: string; confirm_password: string }) {
    return this.post<{ detail: string }>(`/users/${id}/reset-password/`, data);
  }

  // Audit Logs (Admin Only)
  async getAuditLogs(params?: any) {
    return this.get<{ count: number; results: AuditLog[] }>("/audit-logs/", params);
  }

  // Invoices
  async getInvoices(params?: any) {
    return this.get<{ count: number; results: Invoice[] }>("/invoices/", params);
  }

  async getInvoice(id: number | string) {
    return this.get<Invoice>(`/invoices/${id}/`);
  }

  async createInvoice(data: any) {
    return this.post<Invoice>("/invoices/", data);
  }

  async updateInvoice(id: number | string, data: any) {
    return this.put<Invoice>(`/invoices/${id}/`, data);
  }

  async deleteInvoice(id: number | string) {
    return this.delete(`/invoices/${id}/`);
  }

  async getDashboardSummary(): Promise<{
    total_billed: number;
    total_collected: number;
    total_due: number;
    total_invoices: number;
    active_clients: number;
  }> {
    return this.get("/invoices/summary/");
  }

  async getInvoicePdfBlob(id: number | string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/invoices/${id}/preview_pdf/`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Failed to generate PDF (${res.status})`);
    }
    return res.blob();
  }

  async downloadInvoicePdf(id: number | string, invoiceNumber?: string) {
    const res = await fetch(`${API_BASE_URL}/invoices/${id}/download_pdf/`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Failed to download PDF (${res.status})`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice_${invoiceNumber || id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async recordPayment(invoiceId: number, data: { amount: string | number; payment_method?: number; transaction_id?: string; note?: string; payment_date?: string }) {
    return this.post<{ message: string; payment: Payment; invoice: Invoice }>(`/invoices/${invoiceId}/record_payment/`, data);
  }

  // Payments & Money Receipts
  async getPayments(params?: any) {
    return this.get<{ count: number; results: Payment[] }>("/payments/", params);
  }

  // Monthly payment calendar (computed server-side from invoices & payments)
  async getPaymentCalendar(params: { month: number; year: number; client?: number | string; status?: string; method?: number | string }) {
    return this.get<CalendarResponse>("/payments/calendar/", params);
  }

  async getClientPaymentHistory(clientId: number | string, months = 12) {
    return this.get<ClientHistoryResponse>(`/payments/client/${clientId}/history/`, { months });
  }

  async getPayment(id: number | string) {
    return this.get<Payment>(`/payments/${id}/`);
  }

  async createPayment(data: Partial<Payment>) {
    return this.post<Payment>("/payments/", data);
  }

  async deletePayment(id: number | string) {
    return this.delete(`/payments/${id}/`);
  }

  async getPaymentReceiptPdfBlob(id: number | string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/payments/${id}/preview_receipt/`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Failed to generate receipt PDF (${res.status})`);
    }
    return res.blob();
  }

  async downloadPaymentReceiptPdf(id: number | string, receiptNumber?: string) {
    const res = await fetch(`${API_BASE_URL}/payments/${id}/download_receipt/`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Failed to download receipt PDF (${res.status})`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Money_Receipt_${receiptNumber || id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  async generateMonthlyBills(billing_month: string) {
    return this.post<{ message: string; generated_invoices: string[] }>("/invoices/generate_monthly_bills/", { billing_month });
  }

  // Clients
  async getClients() {
    return this.get<{ count: number; results: Client[] }>("/clients/?page_size=100");
  }

  async createClient(data: Partial<Client>) {
    return this.post<Client>("/clients/", data);
  }

  async updateClient(id: number, data: Partial<Client>) {
    return this.put<Client>(`/clients/${id}/`, data);
  }

  async deleteClient(id: number) {
    return this.delete(`/clients/${id}/`);
  }

  // Services
  async getServices() {
    return this.get<{ count: number; results: Service[] }>("/services/?page_size=100");
  }

  async createService(data: Partial<Service>) {
    return this.post<Service>("/services/", data);
  }

  async updateService(id: number, data: Partial<Service>) {
    return this.put<Service>(`/services/${id}/`, data);
  }

  async deleteService(id: number) {
    return this.delete(`/services/${id}/`);
  }

  // Client Services (Pricing)
  async saveClientService(data: Partial<ClientServicePrice>) {
    if (data.id) {
      return this.put<ClientServicePrice>(`/client-services/${data.id}/`, data);
    }
    return this.post<ClientServicePrice>("/client-services/", data);
  }

  // Companies & Banks
  async getCompanies() {
    return this.get<{ count: number; results: Company[] }>("/companies/");
  }

  async updateCompany(id: number, data: Partial<Company>) {
    return this.patch<Company>(`/companies/${id}/`, data);
  }

  async getBankAccounts() {
    return this.get<{ count: number; results: BankAccount[] }>("/bank-accounts/");
  }

  async createBankAccount(data: Partial<BankAccount>) {
    return this.post<BankAccount>("/bank-accounts/", data);
  }

  async updateBankAccount(id: number, data: Partial<BankAccount>) {
    return this.put<BankAccount>(`/bank-accounts/${id}/`, data);
  }

  async deleteBankAccount(id: number) {
    return this.delete(`/bank-accounts/${id}/`);
  }

  // Settings & Templates
  async getSettings() {
    return this.get<{ count: number; results: GlobalSettings[] }>("/settings/");
  }

  async updateSettings(id: number, data: Partial<GlobalSettings>) {
    return this.patch<GlobalSettings>(`/settings/${id}/`, data);
  }

  async getTemplates() {
    return this.get<{ count: number; results: InvoiceTemplate[] }>("/templates/");
  }

  async updateTemplate(id: number, data: Partial<InvoiceTemplate>) {
    return this.put<InvoiceTemplate>(`/templates/${id}/`, data);
  }

  async getPaymentMethods() {
    return this.get<{ count: number; results: PaymentMethod[] }>("/payment-methods/");
  }

  // Subscriptions
  async getSubscriptions(params?: Record<string, string>) {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.get<{ count: number; results: Subscription[] }>(`/subscriptions/${q}`);
  }

  async createSubscription(data: Partial<Subscription>) {
    return this.post<Subscription>("/subscriptions/", data);
  }

  async updateSubscription(id: number, data: Partial<Subscription>) {
    return this.patch<Subscription>(`/subscriptions/${id}/`, data);
  }

  async deleteSubscription(id: number) {
    return this.delete(`/subscriptions/${id}/`);
  }

  // Recurring Runs
  async getRecurringRuns() {
    return this.get<{ count: number; results: RecurringRun[] }>("/recurring-runs/");
  }

  async triggerRecurringRun(period?: string) {
    return this.post<{
      status: string;
      target_period: string;
      created_count: number;
      skipped_count: number;
      failed_count: number;
      created_invoices: string[];
      skipped_items: any[];
      failed_items: any[];
    }>("/recurring-runs/trigger/", { period });
  }

  async previewRecurringRun(period?: string) {
    const q = period ? `?period=${encodeURIComponent(period)}` : "";
    return this.get<RecurringPreviewResponse>(`/recurring-runs/preview/${q}`);
  }

  async getRecurringStatus() {
    return this.get<RecurringDashboardStatus>("/recurring-runs/status/");
  }
}

export const api = new ApiService();
