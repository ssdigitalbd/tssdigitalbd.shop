/**
 * API Client for DigiMarket Frontend
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('ssdigitalbd_token') || localStorage.getItem('digimarket_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('ssdigitalbd_token', token);
      localStorage.setItem('digimarket_token', token);
    } else {
      localStorage.removeItem('ssdigitalbd_token');
      localStorage.removeItem('digimarket_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }

    return data as T;
  }

  // Auth Methods
  async login(body: { email: string; password: string }) {
    const res = await this.request<{
      token: string;
      user: any;
      store?: any;
      wallet?: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async register(body: { fullName: string; email: string; phone: string; password: string }) {
    const res = await this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async logout() {
    try {
      await this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Continue client cleanup even if request fails
    }
    this.setToken(null);
  }

  forgotPassword(email: string) {
    return this.request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  getMe() {
    return this.request<{ user: any; store?: any; wallet?: any }>('/auth/me');
  }

  // Catalog & Stores
  getCatalog(source?: 'main' | 'reseller') {
    return this.request<{ categories: any[]; products: any[] }>(`/catalog?source=${source || 'main'}`);
  }

  getStore(subdomain: string) {
    return this.request<{ store: any; products: any[] }>(`/stores/${subdomain}`);
  }

  // Orders
  createOrder(body: any) {
    return this.request<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  submitPayment(orderId: string, body: any) {
    return this.request<any>(`/orders/${orderId}/payment`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getOrder(orderNumber: string) {
    return this.request<{ order: any; submissions: any[]; delivery?: any }>(`/orders/${orderNumber}`);
  }

  // Reseller
  getResellerOrders() {
    return this.request<any[]>('/reseller/orders');
  }

  verifyResellerPayment(orderId: string, body: any) {
    return this.request<any>(`/reseller/orders/${orderId}/verify-payment`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  retryWalletDebit(orderId: string) {
    return this.request<any>(`/reseller/orders/${orderId}/retry-debit`, {
      method: 'POST',
    });
  }

  getResellerWallet() {
    return this.request<any>('/reseller/wallet');
  }

  getResellerLedger() {
    return this.request<any[]>('/reseller/ledger');
  }

  submitDepositRequest(body: any) {
    return this.request<any>('/reseller/deposit-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getResellerDeposits() {
    return this.request<any[]>('/reseller/deposit-requests');
  }

  getResellerBonuses() {
    return this.request<any[]>('/reseller/bonuses');
  }

  updateStoreSettings(body: any) {
    return this.request<any>('/reseller/store-settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  submitResellerApplication(body: any) {
    return this.request<any>('/reseller/apply', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Admin
  getAdminMetrics() {
    return this.request<any>('/admin/metrics');
  }

  getAdminOrders(status?: string) {
    return this.request<any[]>(`/admin/orders${status ? `?status=${status}` : ''}`);
  }

  adminApproveOrder(orderId: string, adminNotes?: string) {
    return this.request<any>(`/admin/orders/${orderId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminNotes }),
    });
  }

  adminRejectOrder(orderId: string, rejectionReason: string) {
    return this.request<any>(`/admin/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
  }

  adminFulfillOrder(orderId: string, body: any) {
    return this.request<any>(`/admin/orders/${orderId}/fulfill`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getAdminResellerApps() {
    return this.request<any[]>('/admin/reseller-applications');
  }

  reviewResellerApp(appId: string, decision: 'approve' | 'reject', rejectionReason?: string) {
    return this.request<any>(`/admin/reseller-applications/${appId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, rejectionReason }),
    });
  }

  getAdminDeposits() {
    return this.request<any[]>('/admin/deposits');
  }

  approveDeposit(id: string, adminNotes?: string) {
    return this.request<any>(`/admin/deposits/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminNotes }),
    });
  }

  rejectDeposit(id: string, reason: string) {
    return this.request<any>(`/admin/deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  getAdminResellersList() {
    return this.request<any[]>('/admin/resellers-list');
  }

  previewBonus(body: any) {
    return this.request<any>('/admin/bonuses/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  grantBonus(body: any) {
    return this.request<any>('/admin/bonuses/grant', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getAdminBonuses() {
    return this.request<any[]>('/admin/bonuses');
  }

  reverseBonus(bonusId: string, reversalReason: string) {
    return this.request<any>(`/admin/bonuses/${bonusId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reversalReason }),
    });
  }

  getAdminLedger() {
    return this.request<any[]>('/admin/ledger');
  }

  getAdminNotifications() {
    return this.request<any[]>('/admin/notifications');
  }

  getNotificationConfigStatus() {
    return this.request<any>('/admin/notifications/config-status');
  }

  retryNotification(id: string) {
    return this.request<any>(`/admin/notifications/${id}/retry`, {
      method: 'POST',
    });
  }

  sendTestNotification(body: { channel: string; recipientContact: string; title: string; bodyText: string }) {
    return this.request<any>('/admin/notifications/send-test', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getAdminProducts() {
    return this.request<any[]>('/admin/products');
  }

  saveProduct(body: any) {
    return this.request<any>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  savePackage(body: any) {
    return this.request<any>('/admin/packages', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  deleteProduct(id: string) {
    return this.request<any>(`/admin/products/${id}`, {
      method: 'DELETE',
    });
  }

  deletePackage(id: string) {
    return this.request<any>(`/admin/packages/${id}`, {
      method: 'DELETE',
    });
  }

  uploadProductImage(base64Data: string, originalName: string) {
    return this.request<{ imageUrl: string; filename: string }>('/admin/products/upload-image', {
      method: 'POST',
      body: JSON.stringify({ base64Data, originalName }),
    });
  }

  getAdminAuditLogs() {
    return this.request<any[]>('/admin/audit-logs');
  }

  // Customer Orders & Dashboard
  getCustomerOrders() {
    return this.request<any[]>('/customer/orders');
  }

  // Support Tickets & Evidence Vault
  getTickets() {
    return this.request<any[]>('/tickets');
  }

  getTicket(id: string) {
    return this.request<any>(`/tickets/${id}`);
  }

  createTicket(body: {
    category: string;
    subject: string;
    message: string;
    orderNumber?: string;
    attachments?: Array<{ fileName: string; dataUrl: string }>;
  }) {
    return this.request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  replyTicket(id: string, body: {
    message: string;
    attachments?: Array<{ fileName: string; dataUrl: string }>;
  }) {
    return this.request<any>(`/tickets/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Admin Support Ticket Console
  getAdminTickets(filters?: { status?: string; category?: string; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString();
    return this.request<any[]>(`/admin/tickets${qs ? `?${qs}` : ''}`);
  }

  addAdminTicketNote(id: string, note: string) {
    return this.request<any>(`/admin/tickets/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  updateAdminTicketStatus(id: string, status: string) {
    return this.request<any>(`/admin/tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  replyAdminTicket(id: string, body: { message: string; nextStatus?: string }) {
    return this.request<any>(`/admin/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Database Backup Verification Logs (Requirement 1)
  getAdminBackups() {
    return this.request<{ logs: any[]; allLogs: any[]; health: any }>('/admin/backups');
  }

  triggerAdminBackupVerifyNow() {
    return this.request<{ success: boolean; message: string; log: any; health: any }>(
      '/admin/backups/verify-now',
      { method: 'POST' }
    );
  }

  // Seller Marketplace & Multi-Vendor Methods (Requirement 2)
  getPublicSellerProducts() {
    return this.request<any[]>('/products/seller-products');
  }

  applyAsSeller(body: any) {
    return this.request<any>('/customer/seller-apply', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getSellerProfile() {
    return this.request<{ profile: any | null; application: any | null }>('/seller/profile');
  }

  getSellerDashboard() {
    return this.request<{
      profile: any;
      stats: any;
      recentEarnings: any[];
      recentWithdrawals: any[];
    }>('/seller/dashboard');
  }

  getSellerProducts() {
    return this.request<any[]>('/seller/products');
  }

  saveSellerProduct(body: any) {
    return this.request<any>('/seller/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getSellerEarnings() {
    return this.request<any[]>('/seller/earnings');
  }

  getSellerWithdrawals() {
    return this.request<any[]>('/seller/withdrawals');
  }

  requestSellerWithdrawal(body: {
    amountBdt: number;
    payoutMethod: string;
    payoutAccountNumber: string;
    payoutDetails?: string;
  }) {
    return this.request<any>('/seller/withdrawals', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  purchaseSellerProduct(body: {
    sellerProductId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    paymentChannel?: string;
    transactionId?: string;
  }) {
    return this.request<{
      order: any;
      downloadToken: string;
      product: any;
      message: string;
    }>('/orders/seller-purchase', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  verifyDownloadToken(token: string) {
    return this.request<{
      valid: boolean;
      product?: any;
      remainingDownloads?: number;
      downloadUrl?: string;
      message?: string;
    }>(`/downloads/verify/${token}`);
  }

  // Admin Multi-Vendor Management
  getAdminSellerApplications() {
    return this.request<any[]>('/admin/seller-applications');
  }

  reviewAdminSellerApplication(id: string, body: { status: string; adminNotes?: string; rejectionReason?: string }) {
    return this.request<any>(`/admin/seller-applications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getAdminSellers() {
    return this.request<any[]>('/admin/sellers');
  }

  getAdminSellerProducts() {
    return this.request<any[]>('/admin/seller-products');
  }

  updateAdminSellerProductStatus(id: string, body: { status: string; rejectionReason?: string }) {
    return this.request<any>(`/admin/seller-products/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  getAdminCommissions() {
    return this.request<{ policy: any; exampleCalculations: any[] }>('/admin/commissions');
  }

  updateAdminCommissions(body: { globalDefaultPercent: number; categoryRates?: Record<string, number> }) {
    return this.request<any>('/admin/commissions', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  getAdminSellerWithdrawals() {
    return this.request<any[]>('/admin/seller-withdrawals');
  }

  processAdminSellerWithdrawalPayout(id: string, body: { action: 'complete' | 'reject'; transactionReference?: string; rejectionReason?: string }) {
    return this.request<any>(`/admin/seller-withdrawals/${id}/payout`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const api = new ApiClient();
