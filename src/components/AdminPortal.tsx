/**
 * Main Admin Dashboard & Operations Console
 * Implements Order Final Approvals, Fulfillment, Reseller Bonus Management (Section 8),
 * KYC Reviews, Deposit Verifications, Notifications Outbox, and Catalog Management.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import {
  BarChart3,
  CheckCircle,
  XCircle,
  Gift,
  FileCheck,
  CreditCard,
  Bell,
  Package,
  Shield,
  Send,
  RotateCcw,
  RefreshCw,
  X,
  AlertTriangle,
  Mail,
  MessageSquare,
  Smartphone,
  Search,
  Filter,
  AlertCircle,
  Info,
  Check,
  Lock,
  Paperclip,
  Eye,
  User,
  HelpCircle,
  Plus,
  Trash2,
  Edit,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'orders' | 'bonuses' | 'applications' | 'deposits' | 'notifications' | 'catalog' | 'ledger' | 'tickets'
  >('orders');

  const [metrics, setMetrics] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [adminTickets, setAdminTickets] = useState<any[]>([]);
  const [adminTicketFilter, setAdminTicketFilter] = useState<'all' | 'open' | 'in_review' | 'waiting_customer' | 'resolved' | 'closed'>('all');
  const [adminTicketCategory, setAdminTicketCategory] = useState<string>('all');
  const [adminTicketSearch, setAdminTicketSearch] = useState('');
  const [selectedAdminTicket, setSelectedAdminTicket] = useState<any | null>(null);
  const [adminStaffReply, setAdminStaffReply] = useState('');
  const [adminNextStatus, setAdminNextStatus] = useState<string>('waiting_customer');
  const [adminInternalNote, setAdminInternalNote] = useState('');
  const [adminTicketActionLoading, setAdminTicketActionLoading] = useState(false);
  const [previewTicketAttachmentUrl, setPreviewTicketAttachmentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bonus Form State (Section 8)
  const [selectedResellerIds, setSelectedResellerIds] = useState<string[]>([]);
  const [bonusType, setBonusType] = useState<
    'manual_bonus' | 'campaign_bonus' | 'welcome_bonus' | 'performance_bonus' | 'adjustment_credit'
  >('campaign_bonus');
  const [bonusAmount, setBonusAmount] = useState('500');
  const [campaignName, setCampaignName] = useState('Eid Super Reseller Rewards');
  const [bonusReason, setBonusReason] = useState('High performance monthly sales campaign target achieved.');
  const [bonusPreview, setBonusPreview] = useState<any | null>(null);
  const [bonusSubmitting, setBonusSubmitting] = useState(false);
  const [bonusSuccessMsg, setBonusSuccessMsg] = useState<string | null>(null);

  // Order Action Modals
  const [actionOrder, setActionOrder] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'fulfill'>('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [fulfillmentKey, setFulfillmentKey] = useState('');
  const [fulfillmentInstructions, setFulfillmentInstructions] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // KYC Reject Modal
  const [kycRejectApp, setKycRejectApp] = useState<any | null>(null);
  const [kycRejectReason, setKycRejectReason] = useState('');

  // Bonus Reversal Modal
  const [reversalBonus, setReversalBonus] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Notification Outbox & Real Testing State
  const [configStatus, setConfigStatus] = useState<any | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testChannel, setTestChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [testRecipient, setTestRecipient] = useState('admin@ssdigitalbd.shop');
  const [testTitle, setTestTitle] = useState('Production Notification Test');
  const [testBody, setTestBody] = useState('This is a real automated notification from the SSDigitalBD.shop platform.');
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<any | null>(null);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifFilterChannel, setNotifFilterChannel] = useState<'all' | 'email' | 'whatsapp' | 'sms'>('all');
  const [notifFilterStatus, setNotifFilterStatus] = useState<'all' | 'delivered' | 'sent' | 'queued' | 'failed' | 'not_configured'>('all');

  // Product Management State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('cat_productivity');
  const [productTagline, setProductTagline] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productDeliveryMethod, setProductDeliveryMethod] = useState<'manual_credentials' | 'instant_license_key' | 'invite_link' | 'direct_activation'>('manual_credentials');
  const [productDeliveryInstructions, setProductDeliveryInstructions] = useState('');
  const [productTerms, setProductTerms] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('/src/assets/images/hero_digital_products_1791884577566.jpg');
  const [productIsActive, setProductIsActive] = useState(true);
  const [productMainStore, setProductMainStore] = useState(true);
  const [productResellers, setProductResellers] = useState(true);
  const [productPackages, setProductPackages] = useState<Array<{
    id?: string;
    name: string;
    durationLabel: string;
    durationDays: number;
    retailPriceBdt: number;
    resellerWholesaleCostBdt: number;
    stockCount: number;
    isActive: boolean;
  }>>([
    { name: '1 Month Access', durationLabel: '30 Days', durationDays: 30, retailPriceBdt: 499, resellerWholesaleCostBdt: 350, stockCount: -1, isActive: true },
  ]);
  const [imageUploading, setImageUploading] = useState(false);
  const [productSaveLoading, setProductSaveLoading] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<any | null>(null);
  const [deleteProductLoading, setDeleteProductLoading] = useState(false);

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductName('');
    setProductCategory('cat_productivity');
    setProductTagline('');
    setProductDescription('');
    setProductDeliveryMethod('manual_credentials');
    setProductDeliveryInstructions('');
    setProductTerms('');
    setProductImageUrl('/src/assets/images/hero_digital_products_1791884577566.jpg');
    setProductIsActive(true);
    setProductMainStore(true);
    setProductResellers(true);
    setProductPackages([
      { name: '1 Month Access', durationLabel: '30 Days', durationDays: 30, retailPriceBdt: 499, resellerWholesaleCostBdt: 350, stockCount: -1, isActive: true },
    ]);
    setProductFormError(null);
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (p: any) => {
    setEditingProduct(p);
    setProductName(p.name);
    setProductCategory(p.categoryId || 'cat_productivity');
    setProductTagline(p.tagline || '');
    setProductDescription(p.description || '');
    setProductDeliveryMethod(p.deliveryMethod || 'manual_credentials');
    setProductDeliveryInstructions(p.deliveryInstructions || '');
    setProductTerms(p.termsAndConditions || '');
    setProductImageUrl(p.imageUrl || '/src/assets/images/hero_digital_products_1791884577566.jpg');
    setProductIsActive(p.isActive !== false);
    setProductMainStore(p.availableOnMainStore !== false);
    setProductResellers(p.availableToResellers !== false);
    setProductPackages(
      p.packages && p.packages.length > 0
        ? p.packages.map((pkg: any) => ({
            id: pkg.id,
            name: pkg.name,
            durationLabel: pkg.durationLabel || pkg.name,
            durationDays: pkg.durationDays || 30,
            retailPriceBdt: pkg.retailPriceBdt,
            resellerWholesaleCostBdt: pkg.resellerWholesaleCostBdt,
            stockCount: pkg.stockCount !== undefined ? pkg.stockCount : -1,
            isActive: pkg.isActive !== false,
          }))
        : [{ name: '1 Month Access', durationLabel: '30 Days', durationDays: 30, retailPriceBdt: 499, resellerWholesaleCostBdt: 350, stockCount: -1, isActive: true }]
    );
    setProductFormError(null);
    setShowProductModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setProductFormError('Image exceeds the 3MB maximum size limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setImageUploading(true);
        setProductFormError(null);
        const base64Data = reader.result as string;
        const res = await api.uploadProductImage(base64Data, file.name);
        setProductImageUrl(res.imageUrl);
      } catch (err: any) {
        setProductFormError(err.message || 'Image upload failed. Allowed formats: JPEG, PNG, WebP.');
      } finally {
        setImageUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !productDescription.trim()) {
      setProductFormError('Product Name and Description are required.');
      return;
    }
    if (productPackages.length === 0) {
      setProductFormError('Please add at least one duration package with pricing.');
      return;
    }

    try {
      setProductSaveLoading(true);
      setProductFormError(null);

      // 1. Save product
      const savedProd = await api.saveProduct({
        id: editingProduct ? editingProduct.id : undefined,
        categoryId: productCategory,
        name: productName.trim(),
        tagline: productTagline.trim(),
        description: productDescription.trim(),
        deliveryMethod: productDeliveryMethod,
        deliveryInstructions: productDeliveryInstructions.trim(),
        termsAndConditions: productTerms.trim(),
        imageUrl: productImageUrl,
        isActive: productIsActive,
        availableOnMainStore: productMainStore,
        availableToResellers: productResellers,
      });

      // 2. Save packages
      const prodId = savedProd?.id || (editingProduct ? editingProduct.id : undefined);
      for (const pkg of productPackages) {
        await api.savePackage({
          id: pkg.id,
          productId: prodId,
          name: pkg.name.trim(),
          durationLabel: pkg.durationLabel.trim() || pkg.name.trim(),
          durationDays: Number(pkg.durationDays) || 30,
          retailPriceBdt: Number(pkg.retailPriceBdt) || 0,
          resellerWholesaleCostBdt: Number(pkg.resellerWholesaleCostBdt) || 0,
          stockCount: Number(pkg.stockCount),
          isActive: pkg.isActive,
        });
      }

      await loadAllAdminData();
      setShowProductModal(false);
    } catch (err: any) {
      setProductFormError(err.message || 'Failed to save product and packages.');
    } finally {
      setProductSaveLoading(false);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    try {
      setDeleteProductLoading(true);
      await api.deleteProduct(deleteProductTarget.id);
      await loadAllAdminData();
      setDeleteProductTarget(null);
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setDeleteProductLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const loadAllAdminData = async () => {
    try {
      setLoading(true);
      api.setToken('usr_admin_01');
      const [m, ords, resList, bns, apps, deps, notifs, prods, ldg, tcks, cfg] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminOrders(),
        api.getAdminResellersList(),
        api.getAdminBonuses(),
        api.getAdminResellerApps(),
        api.getAdminDeposits(),
        api.getAdminNotifications(),
        api.getAdminProducts(),
        api.getAdminLedger(),
        api.getAdminTickets().catch(() => []),
        api.getNotificationConfigStatus().catch(() => null),
      ]);
      setMetrics(m);
      setOrders(ords);
      setResellers(resList);
      setBonuses(bns);
      setApplications(apps);
      setDeposits(deps);
      setNotifications(notifs);
      setProducts(prods);
      setLedger(ldg);
      setAdminTickets(tcks);
      if (cfg) setConfigStatus(cfg);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Order Actions (Approve, Reject with Reversal, Fulfill)
  // -------------------------------------------------------------
  const handleApproveOrder = async () => {
    if (!actionOrder) return;
    try {
      setActionLoading(true);
      await api.adminApproveOrder(actionOrder.id);
      setActionOrder(null);
      loadAllAdminData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!actionOrder || !rejectReason.trim()) return;
    try {
      setActionLoading(true);
      await api.adminRejectOrder(actionOrder.id, rejectReason.trim());
      setActionOrder(null);
      setRejectReason('');
      loadAllAdminData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFulfillOrder = async () => {
    if (!actionOrder || !fulfillmentKey.trim() || !fulfillmentInstructions.trim()) return;
    try {
      setActionLoading(true);
      await api.adminFulfillOrder(actionOrder.id, {
        fulfillmentPayload: fulfillmentKey.trim(),
        instructionsForCustomer: fulfillmentInstructions.trim(),
      });
      setActionOrder(null);
      setFulfillmentKey('');
      setFulfillmentInstructions('');
      loadAllAdminData();
    } catch (err: any) {
      alert(`Fulfillment failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Reseller Bonus Grant & Reversal (Section 8)
  // -------------------------------------------------------------
  const handlePreviewBonus = async () => {
    if (selectedResellerIds.length === 0 || Number(bonusAmount) <= 0) {
      alert('Please select at least one reseller and enter a valid BDT amount.');
      return;
    }
    try {
      const preview = await api.previewBonus({
        resellerIds: selectedResellerIds,
        amountBdt: Number(bonusAmount),
        bonusType,
        reason: bonusReason,
      });
      setBonusPreview(preview);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    }
  };

  const handleConfirmBonusGrant = async () => {
    try {
      setBonusSubmitting(true);
      const res = await api.grantBonus({
        resellerIds: selectedResellerIds,
        amountBdt: Number(bonusAmount),
        bonusType,
        campaignName,
        reason: bonusReason,
      });

      setBonusSuccessMsg(
        `Successfully awarded bonus to ${res.results.filter((r: any) => r.status === 'credited').length} reseller(s)! Ledger entries committed atomically.`
      );
      setBonusPreview(null);
      setTimeout(() => setBonusSuccessMsg(null), 5000);
      loadAllAdminData();
    } catch (err: any) {
      alert(`Failed to grant bonus: ${err.message}`);
    } finally {
      setBonusSubmitting(false);
    }
  };

  const handleReverseBonus = async () => {
    if (!reversalBonus || !reversalReason.trim()) return;
    try {
      await api.reverseBonus(reversalBonus.id, reversalReason.trim());
      setReversalBonus(null);
      setReversalReason('');
      loadAllAdminData();
    } catch (err: any) {
      alert(`Reversal failed: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // KYC Applications
  // -------------------------------------------------------------
  const handleApproveKYC = async (appId: string) => {
    try {
      await api.reviewResellerApp(appId, 'approve');
      loadAllAdminData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleRejectKYC = async () => {
    if (!kycRejectApp || !kycRejectReason.trim()) return;
    try {
      await api.reviewResellerApp(kycRejectApp.id, 'reject', kycRejectReason.trim());
      setKycRejectApp(null);
      setKycRejectReason('');
      loadAllAdminData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // Deposits
  // -------------------------------------------------------------
  const handleApproveDeposit = async (depId: string) => {
    try {
      await api.approveDeposit(depId);
      loadAllAdminData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleRejectDeposit = async (depId: string) => {
    const reason = prompt('Enter deposit rejection reason:');
    if (!reason) return;
    try {
      await api.rejectDeposit(depId, reason);
      loadAllAdminData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // Support Tickets & Internal Notes
  // -------------------------------------------------------------
  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      setAdminTicketActionLoading(true);
      const updated = await api.updateAdminTicketStatus(ticketId, status);
      setSelectedAdminTicket(updated);
      setAdminTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      alert(`Failed to update ticket status: ${err.message}`);
    } finally {
      setAdminTicketActionLoading(false);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminTicket || !adminInternalNote.trim()) return;
    try {
      setAdminTicketActionLoading(true);
      const updated = await api.addAdminTicketNote(selectedAdminTicket.id, adminInternalNote.trim());
      setSelectedAdminTicket(updated);
      setAdminTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setAdminInternalNote('');
    } catch (err: any) {
      alert(`Failed to add internal note: ${err.message}`);
    } finally {
      setAdminTicketActionLoading(false);
    }
  };

  const handleReplyStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminTicket || !adminStaffReply.trim()) return;
    try {
      setAdminTicketActionLoading(true);
      const updated = await api.replyAdminTicket(selectedAdminTicket.id, {
        message: adminStaffReply.trim(),
        nextStatus: adminNextStatus,
      });
      setSelectedAdminTicket(updated);
      setAdminTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setAdminStaffReply('');
    } catch (err: any) {
      alert(`Failed to dispatch staff reply: ${err.message}`);
    } finally {
      setAdminTicketActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <section className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-indigo-400 font-semibold tracking-wider uppercase mb-1">
              Super Admin Console · Full-Stack Operations
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Main Admin Marketplace Center</h1>
          </div>

          <button
            onClick={loadAllAdminData}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start md:self-auto border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Metrics
          </button>
        </div>

        {/* Real Metrics Strip */}
        <div className="max-w-7xl mx-auto px-6 pb-6 grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 block">Total Orders</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums">
              {metrics?.totalOrders || 0}
            </span>
            <span className="text-[10px] text-amber-400 block mt-0.5">
              {metrics?.pendingApprovalOrders || 0} Pending Approval
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 block">Retail Revenue (BDT)</span>
            <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
              ৳{(metrics?.totalRevenue || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Approved & Delivered</span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 block">Wholesale Volume</span>
            <span className="text-xl font-bold text-indigo-400 font-mono tabular-nums">
              ৳{(metrics?.totalWholesaleSpend || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Reseller Wallet Debits</span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 block">Bonuses Distributed</span>
            <span className="text-xl font-bold text-amber-400 font-mono tabular-nums">
              ৳{(metrics?.totalBonusesPaid || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Audited Promotions</span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-400 block">Active Resellers</span>
            <span className="text-xl font-bold text-white font-mono tabular-nums">
              {metrics?.activeResellersCount || 0}
            </span>
            <span className="text-[10px] text-indigo-300 block mt-0.5">
              {metrics?.pendingApplications || 0} KYC pending
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 border-t border-slate-800 overflow-x-auto">
          {[
            { id: 'orders', label: 'Order Approvals & Fulfillment', icon: BarChart3, count: metrics?.pendingApprovalOrders },
            { id: 'bonuses', label: 'Reseller Bonus Management', icon: Gift },
            { id: 'applications', label: 'KYC Applications', icon: FileCheck, count: metrics?.pendingApplications },
            { id: 'deposits', label: 'Deposit Verifications', icon: CreditCard, count: metrics?.pendingDeposits },
            { id: 'tickets', label: 'Support Tickets & Evidence', icon: MessageSquare, count: adminTickets.filter((t) => t.status === 'open' || t.status === 'in_review').length },
            { id: 'notifications', label: 'Notification Outbox', icon: Bell },
            { id: 'catalog', label: 'Product Catalog', icon: Package },
            { id: 'ledger', label: 'Global Audit Ledger', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-indigo-400 text-indigo-300 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500 text-white font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ========================================================= */}
        {/* 1. ORDER APPROVALS & FULFILLMENT TAB */}
        {/* ========================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Order Verification & Fulfillment Queue</h2>
              <p className="text-xs text-slate-500">
                Inspect customer payment proof, verified wallet debits, and authorized fulfillment credentials.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Order # & Source</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Product / Duration</th>
                    <th className="py-3 px-4 text-right">Retail Price</th>
                    <th className="py-3 px-4 text-right">Wholesale Debit</th>
                    <th className="py-3 px-4">Payment & Ledger ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => {
                    const sub = o.submissions?.[0];
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{o.orderNumber}</div>
                          <div className="text-[10px] text-slate-400 uppercase">
                            {o.orderSource.replace('_', ' ')} {o.resellerName ? `· Reseller: ${o.resellerName}` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{o.customerName}</div>
                          <div className="text-slate-500 text-[11px]">{o.customerEmail}</div>
                          <div className="text-slate-400 text-[10px]">{o.customerPhone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{o.snapshotProductName}</div>
                          <div className="text-slate-500 text-[11px]">{o.snapshotPackageName}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          ৳{o.snapshotRetailPriceBdt.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-700 font-semibold">
                          {o.orderSource === 'reseller_store' ? `৳${o.snapshotWholesaleCostBdt.toFixed(2)}` : 'Direct'}
                        </td>
                        <td className="py-3.5 px-4">
                          {sub && (
                            <div className="font-mono text-[11px]">
                              <span className="font-bold text-slate-900 uppercase">{sub.channel}:</span> {sub.transactionId}
                            </div>
                          )}
                          {o.walletDebitLedgerId && (
                            <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded inline-block mt-0.5">
                              Ledger: {o.walletDebitLedgerId}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              o.orderStatus === 'pending_admin_approval'
                                ? 'bg-amber-100 text-amber-800'
                                : o.orderStatus === 'admin_approved' || o.orderStatus === 'queued_for_delivery'
                                ? 'bg-blue-100 text-blue-800'
                                : o.orderStatus === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.orderStatus === 'admin_rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {o.orderStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {o.orderStatus === 'pending_admin_approval' && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setActionOrder(o);
                                  setActionType('approve');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setActionOrder(o);
                                  setActionType('reject');
                                  setRejectReason('');
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium text-[11px]"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {(o.orderStatus === 'admin_approved' || o.orderStatus === 'queued_for_delivery') && (
                            <button
                              onClick={() => {
                                setActionOrder(o);
                                setActionType('fulfill');
                                setFulfillmentKey('');
                                setFulfillmentInstructions(
                                  `Authorized credentials for ${o.snapshotProductName}. Access link or code delivered.`
                                );
                              }}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-[11px] shadow-2xs"
                            >
                              Fulfill Delivery
                            </button>
                          )}

                          {o.orderStatus === 'completed' && (
                            <span className="text-emerald-600 font-semibold text-[11px] flex items-center justify-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Delivered
                            </span>
                          )}

                          {o.orderStatus === 'admin_rejected' && (
                            <div className="text-rose-600 text-[10px]">
                              Rejected {o.walletReversalLedgerId && '(Refunded)'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. RESELLER BONUS MANAGEMENT TAB (MASTER PROMPT SECTION 8) */}
        {/* ========================================================= */}
        {activeTab === 'bonuses' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Reseller Bonus & Incentive Allocation</h2>
              <p className="text-xs text-slate-500">
                Grant manual bonuses, promotional campaign rewards, or performance adjustments. Atomically creates immutable ledger entries.
              </p>
            </div>

            {bonusSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="font-medium">{bonusSuccessMsg}</span>
              </div>
            )}

            {/* Bonus Creation Form Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Step 1: Configure Bonus Grant</h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Target Resellers <span className="text-rose-500">*</span>
                  </label>
                  <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto p-2 divide-y divide-slate-100">
                    <label className="flex items-center gap-2 p-1.5 text-xs font-bold text-indigo-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedResellerIds.length === resellers.length && resellers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedResellerIds(resellers.map((r) => r.id));
                          else setSelectedResellerIds([]);
                        }}
                      />
                      Select All Active Resellers ({resellers.length})
                    </label>
                    {resellers.map((reseller) => (
                      <label key={reseller.id} className="flex items-center justify-between p-1.5 text-xs cursor-pointer hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedResellerIds.includes(reseller.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedResellerIds([...selectedResellerIds, reseller.id]);
                              else setSelectedResellerIds(selectedResellerIds.filter((id) => id !== reseller.id));
                            }}
                          />
                          <div>
                            <span className="font-semibold text-slate-900">{reseller.fullName}</span>
                            <span className="text-slate-400 text-[11px] block">{reseller.email}</span>
                          </div>
                        </div>
                        <span className="font-mono text-slate-600 font-medium">৳{reseller.walletBalance.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Selected: {selectedResellerIds.length} recipient(s)
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bonus Category / Type</label>
                    <select
                      value={bonusType}
                      onChange={(e) => setBonusType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="campaign_bonus">Campaign Bonus (Promotional Campaign)</option>
                      <option value="performance_bonus">Performance Bonus (Sales Volume Reward)</option>
                      <option value="welcome_bonus">Welcome Bonus (New Partner Onboarding)</option>
                      <option value="manual_bonus">Manual Bonus (Special Discretionary)</option>
                      <option value="adjustment_credit">Documented Adjustment Credit</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Amount per Recipient (BDT)</label>
                      <input
                        type="number"
                        min={10}
                        step={10}
                        required
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Campaign Tag (Optional)</label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Audited Justification & Reason</label>
                    <textarea
                      rows={2}
                      required
                      value={bonusReason}
                      onChange={(e) => setBonusReason(e.target.value)}
                      placeholder="Required justification recorded permanently in audit logs..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={handlePreviewBonus}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2"
                >
                  <Gift className="w-3.5 h-3.5" /> Preview Recipients & Rules
                </button>
              </div>
            </div>

            {/* Bonus Preview Dialog / Confirmation Box */}
            {bonusPreview && (
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-6 shadow-xs animate-in fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-indigo-950">
                    Step 2: Review Financial Commitment Before Final Confirmation
                  </h4>
                  <button onClick={() => setBonusPreview(null)} className="text-slate-400 hover:text-slate-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mb-4 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-indigo-100">
                    <span className="text-slate-500 block">Total Recipients</span>
                    <span className="text-lg font-bold text-slate-900">{bonusPreview.recipients.length} Partners</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-indigo-100">
                    <span className="text-slate-500 block">Amount Per Recipient</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">
                      ৳{bonusPreview.perRecipientAmountBdt.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-indigo-100">
                    <span className="text-slate-500 block">Total Commitment (BDT)</span>
                    <span className="text-lg font-bold text-indigo-700 font-mono">
                      ৳{bonusPreview.totalCommitmentBdt.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBonusPreview(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Modify
                  </button>
                  <button
                    type="button"
                    disabled={bonusSubmitting}
                    onClick={handleConfirmBonusGrant}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {bonusSubmitting ? 'Atomically Crediting Wallets...' : 'Confirm & Commit Bonus Batch'}
                  </button>
                </div>
              </div>
            )}

            {/* Historical Bonuses Table */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Historical Bonus Allocations & Audits</h3>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Date / Code</th>
                      <th className="py-3 px-4">Recipient Reseller</th>
                      <th className="py-3 px-4">Bonus Type</th>
                      <th className="py-3 px-4 text-right">Amount (BDT)</th>
                      <th className="py-3 px-4">Campaign & Justification</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bonuses.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-semibold text-slate-900">{b.referenceCode}</div>
                          <div className="text-[10px] text-slate-400">{new Date(b.createdAt).toLocaleString()}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{b.resellerName}</div>
                          <div className="text-[11px] text-slate-400">{b.resellerEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium uppercase text-slate-700">
                          {b.bonusType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700">
                          +৳{b.amountBdt.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                          {b.campaignName && <div className="font-bold text-slate-900">{b.campaignName}</div>}
                          <div>{b.reason}</div>
                          {b.reversalReason && (
                            <div className="text-[11px] text-rose-600 mt-1">
                              Reversal reason: {b.reversalReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              b.status === 'approved_and_credited'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'reversed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {b.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {b.status === 'approved_and_credited' && (
                            <button
                              onClick={() => {
                                setReversalBonus(b);
                                setReversalReason('');
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded"
                            >
                              Reverse Bonus
                            </button>
                          )}
                          {b.status === 'reversed' && (
                            <span className="text-[11px] text-slate-400">Reversed in Ledger</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. KYC APPLICATIONS TAB */}
        {/* ========================================================= */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Reseller Applications & KYC Verification</h2>
              <p className="text-xs text-slate-500">
                Verify National ID, business trade license, and allocate unique subdomains (e.g. rahim.digimarket.com).
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Applied Date</th>
                    <th className="py-3 px-4">Applicant & Business</th>
                    <th className="py-3 px-4">Requested Subdomain</th>
                    <th className="py-3 px-4">National ID / Trade License</th>
                    <th className="py-3 px-4">KYC Documents</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{app.businessName}</div>
                        <div className="text-slate-500">{app.applicantName} ({app.applicantEmail})</div>
                        <div className="text-slate-400 text-[10px]">{app.contactPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {app.requestedSubdomain}.digimarket.com
                      </td>
                      <td className="py-3.5 px-4">
                        <div>NID: <span className="font-mono text-slate-800">{app.nationalIdNumber}</span></div>
                        {app.tradeLicenseNumber && (
                          <div className="text-slate-500 text-[11px]">Trade: {app.tradeLicenseNumber}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          {app.kycDocuments?.map((doc: any) => (
                            <span key={doc.id} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 inline-block font-mono">
                              {doc.documentType}: {doc.fileName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            app.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {app.status === 'pending' && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApproveKYC(app.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setKycRejectApp(app);
                                setKycRejectReason('');
                              }}
                              className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded font-medium text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {app.status === 'approved' && (
                          <span className="text-emerald-700 font-semibold text-[11px]">Store Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. DEPOSIT VERIFICATIONS TAB */}
        {/* ========================================================= */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Reseller Deposit Requests & Wallet Credits</h2>
              <p className="text-xs text-slate-500">
                Confirm payment received in merchant account. Approving atomically credits the reseller's wallet.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Reseller Partner</th>
                    <th className="py-3 px-4">Channel / Method</th>
                    <th className="py-3 px-4">Transaction Reference</th>
                    <th className="py-3 px-4">Sender Account</th>
                    <th className="py-3 px-4 text-right">Amount (BDT)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deposits.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{d.resellerName}</div>
                        <div className="text-slate-400 text-[10px]">{d.resellerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 uppercase font-medium text-slate-800">
                        {d.method.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {d.transactionReference}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{d.senderAccountNumber}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        ৳{d.claimedAmountBdt.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            d.status === 'verified_approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {d.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {d.status === 'pending' && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApproveDeposit(d.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px]"
                            >
                              Approve Credit
                            </button>
                            <button
                              onClick={() => handleRejectDeposit(d.id)}
                              className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded font-medium text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {d.status === 'verified_approved' && (
                          <span className="text-emerald-700 font-semibold text-[11px]">Credited</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. NOTIFICATION OUTBOX TAB (SECTION 10) */}
        {/* ========================================================= */}
        {activeTab === 'notifications' && (
          <div className="space-y-5">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Durable Notification Outbox & Dispatch Engine</h2>
                <p className="text-xs text-slate-500">
                  Event-driven auto-notifications for Gmail/SMTP, Meta WhatsApp Cloud API & FastSMS with truthful delivery tracking.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTestFeedback(null);
                    setShowTestModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Test Notification
                </button>
                <button
                  type="button"
                  onClick={loadAllAdminData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Provider Configuration Status Cards */}
            <div className="grid md:grid-cols-3 gap-3.5">
              {/* Email / SMTP Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">Email / Gmail SMTP</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {configStatus?.email?.host || 'smtp.gmail.com:587'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      configStatus?.email?.configured
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {configStatus?.email?.configured ? (
                      <>
                        <Check className="w-2.5 h-2.5" /> Configured
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-2.5 h-2.5" /> Unconfigured
                      </>
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 mt-2 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sender:</span>
                    <span className="truncate max-w-[170px] font-medium">{configStatus?.email?.from || 'DigiMarket <noreply>'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account:</span>
                    <span>{configStatus?.email?.userMasked || 'Not set in env'}</span>
                  </div>
                </div>
              </div>

              {/* WhatsApp Cloud API Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">Meta WhatsApp API</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Version {configStatus?.whatsapp?.apiVersion || 'v20.0'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      configStatus?.whatsapp?.configured
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {configStatus?.whatsapp?.configured ? (
                      <>
                        <Check className="w-2.5 h-2.5" /> Live Ready
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-2.5 h-2.5" /> Unconfigured
                      </>
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 mt-2 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phone ID:</span>
                    <span>{configStatus?.whatsapp?.phoneNumberIdMasked || 'Not set in env'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Webhook:</span>
                    <span className="text-emerald-700 font-medium">HMAC SHA256 Protected</span>
                  </div>
                </div>
              </div>

              {/* FastSMS Gateway Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-xs">FastSMS Bangladesh</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Sender ID: {configStatus?.sms?.senderId || 'DigiMarket'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      configStatus?.sms?.configured
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {configStatus?.sms?.configured ? (
                      <>
                        <Check className="w-2.5 h-2.5" /> Configured
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-2.5 h-2.5" /> Unconfigured
                      </>
                    )}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 mt-2 pt-2 border-t border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gateway:</span>
                    <span>HTTP REST API (BD)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Prefix:</span>
                    <span>8801XXXXXXXXX</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search recipient, event type, or subject..."
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                  {(['all', 'email', 'whatsapp', 'sms'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setNotifFilterChannel(ch)}
                      className={`px-2.5 py-1 rounded-md font-medium text-[11px] uppercase transition-colors ${
                        notifFilterChannel === ch
                          ? 'bg-white text-indigo-700 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>

                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                  {(['all', 'delivered', 'sent', 'queued', 'failed', 'not_configured'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNotifFilterStatus(st)}
                      className={`px-2 py-1 rounded-md font-medium text-[10px] uppercase transition-colors ${
                        notifFilterStatus === st
                          ? 'bg-white text-indigo-700 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Outbox Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Event Type</th>
                      <th className="py-3 px-4">Subject & Message</th>
                      <th className="py-3 px-4">Provider Ref</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notifications
                      .filter((n) => {
                        if (notifFilterChannel !== 'all' && n.channel !== notifFilterChannel) return false;
                        if (notifFilterStatus !== 'all' && n.status !== notifFilterStatus) return false;
                        if (notifSearch.trim()) {
                          const q = notifSearch.toLowerCase();
                          return (
                            n.recipientContact.toLowerCase().includes(q) ||
                            n.eventType.toLowerCase().includes(q) ||
                            n.title.toLowerCase().includes(q) ||
                            n.bodyText.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((n) => (
                        <tr key={n.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            <div>{new Date(n.createdAt).toLocaleTimeString()}</div>
                            <div className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-bold uppercase text-[11px] text-slate-800">
                              {n.channel === 'email' && <Mail className="w-3.5 h-3.5 text-blue-600" />}
                              {n.channel === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                              {n.channel === 'sms' && <Smartphone className="w-3.5 h-3.5 text-purple-600" />}
                              {n.channel}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            <div className="font-semibold text-slate-900">{n.recipientContact}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{n.recipientType}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-indigo-700 whitespace-nowrap font-medium">
                            {n.eventType}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate">{n.title}</div>
                            <div className="text-slate-500 text-[11px] line-clamp-1">{n.bodyText}</div>
                            {n.errorMessage && (
                              <div className="mt-1 text-[10px] text-rose-600 font-mono bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 line-clamp-1">
                                {n.errorMessage}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {n.providerMessageId ? (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 max-w-[130px] truncate block" title={n.providerMessageId}>
                                {n.providerMessageId}
                              </span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase inline-flex items-center gap-1 ${
                                n.status === 'delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : n.status === 'sent'
                                  ? 'bg-blue-100 text-blue-800'
                                  : n.status === 'queued' || n.status === 'processing'
                                  ? 'bg-amber-100 text-amber-800'
                                  : n.status === 'not_configured'
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {n.status === 'delivered' && <Check className="w-2.5 h-2.5" />}
                              {n.status.replace(/_/g, ' ')}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Attempts: {n.attempts}/{n.maxAttempts}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {n.status === 'failed' || n.status === 'not_configured' || n.status === 'retry_scheduled' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await api.retryNotification(n.id);
                                    loadAllAdminData();
                                  } catch (err: any) {
                                    alert(`Retry error: ${err.message}`);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition-colors"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Retry
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-mono">Logged</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {notifications.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No notifications recorded in outbox yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. PRODUCT CATALOG TAB */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* 6. PRODUCT CATALOG TAB */}
        {/* ========================================================= */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900">Database-Driven Product & Wholesale Pricing</h2>
                <p className="text-xs text-slate-500">
                  Manage digital software catalog, duration packages, customer pricing, and reseller wholesale costs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                Add New Product
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {products.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div>
                    {/* Header Row: Thumbnail + Title + Status */}
                    <div className="flex items-start gap-3.5 mb-3">
                      <div className="w-14 h-14 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {p.deliveryMethod?.replace('_', ' ') || 'Manual'}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {p.isActive ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 truncate">{p.name}</h3>
                        <p className="text-xs text-slate-500 line-clamp-1">{p.tagline || p.description}</p>
                      </div>
                    </div>

                    {/* Distribution Flags */}
                    <div className="flex items-center gap-2 text-[11px] mb-3">
                      <span className={`px-2 py-0.5 rounded ${p.availableOnMainStore ? 'bg-indigo-50 text-indigo-700 font-medium' : 'bg-slate-100 text-slate-400'}`}>
                        Main Store: {p.availableOnMainStore ? 'Yes' : 'No'}
                      </span>
                      <span className={`px-2 py-0.5 rounded ${p.availableToResellers ? 'bg-indigo-50 text-indigo-700 font-medium' : 'bg-slate-100 text-slate-400'}`}>
                        Resellers: {p.availableToResellers ? 'Yes' : 'No'}
                      </span>
                    </div>

                    {/* Packages Table */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 uppercase mb-2">
                        <span>Duration Packages ({p.packages?.length || 0})</span>
                        <span className="text-slate-400 font-normal lowercase">customer / wholesale</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {p.packages?.map((pkg: any) => (
                          <div key={pkg.id || pkg.name} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <div>
                              <span className="font-semibold text-slate-800 block">{pkg.name}</span>
                              <span className="text-[10px] text-slate-500">{pkg.durationDays} Days</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono text-right">
                              <div>
                                <span className="text-[10px] text-slate-400 block">Retail (Customer)</span>
                                <span className="font-bold text-slate-900">৳{Number(pkg.retailPriceBdt).toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block">Wholesale (Partner)</span>
                                <span className="font-bold text-indigo-600">৳{Number(pkg.resellerWholesaleCostBdt).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditProduct(p)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit Product & Pricing
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.saveProduct({ id: p.id, isActive: !p.isActive });
                          loadAllAdminData();
                        }}
                        className="px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-xs transition-colors"
                      >
                        {p.isActive ? 'Pause' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteProductTarget(p)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Archive Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 7. GLOBAL AUDIT LEDGER TAB */}
        {/* ========================================================= */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Global Financial Ledger & Audit Trail</h2>
              <p className="text-xs text-slate-500">
                Immutable double-entry balance records for all reseller operations and admin adjustments.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Reseller</th>
                    <th className="py-3 px-4">Reference & Idempotency</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Amount (BDT)</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((l) => {
                    const isCredit = l.entryType.includes('credit');
                    return (
                      <tr key={l.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{l.resellerName}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-800">
                          <div>{l.referenceId}</div>
                          <div className="text-[10px] text-slate-400">{l.idempotencyKey}</div>
                        </td>
                        <td className="py-3 px-4 uppercase text-[10px] font-semibold">
                          <span className={isCredit ? 'text-emerald-700' : 'text-rose-700'}>
                            {l.entryType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCredit ? '+' : '-'}৳{l.amountBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          ৳{l.balanceAfterBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-sm">{l.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 8. SUPPORT TICKETS & EVIDENCE VAULT TAB */}
        {/* ========================================================= */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Support Tickets & Evidence Vault</h2>
                <p className="text-xs text-slate-500">
                  Review customer error screenshots, manage SLA status, and maintain encrypted internal staff notes.
                </p>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
                {(['all', 'open', 'in_review', 'waiting_customer', 'resolved', 'closed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setAdminTicketFilter(st)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-colors whitespace-nowrap ${
                      adminTicketFilter === st
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Category Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={adminTicketSearch}
                  onChange={(e) => setAdminTicketSearch(e.target.value)}
                  placeholder="Search by ticket ID, customer name, email, or order number..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <select
                value={adminTicketCategory}
                onChange={(e) => setAdminTicketCategory(e.target.value)}
                className="w-full sm:w-56 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 shadow-2xs"
              >
                <option value="all">All Categories</option>
                <option value="service_not_working">Service Not Working</option>
                <option value="login_problem">Login / Authentication</option>
                <option value="wrong_credentials">Invalid Credentials</option>
                <option value="warranty_replacement">Warranty Replacement</option>
                <option value="order_fulfillment_delay">Fulfillment Delay</option>
                <option value="other">Other Inquiry</option>
              </select>
            </div>

            {/* Main Split Grid: Ticket List + Selected Ticket Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Tickets Queue */}
              <div className="lg:col-span-5 space-y-3">
                {adminTickets
                  .filter((t) => {
                    if (adminTicketFilter !== 'all' && t.status !== adminTicketFilter) return false;
                    if (adminTicketCategory !== 'all' && t.category !== adminTicketCategory) return false;
                    if (adminTicketSearch) {
                      const q = adminTicketSearch.toLowerCase().trim();
                      return (
                        t.id.toLowerCase().includes(q) ||
                        (t.orderNumber && t.orderNumber.toLowerCase().includes(q)) ||
                        t.customerName.toLowerCase().includes(q) ||
                        t.customerEmail.toLowerCase().includes(q) ||
                        t.subject.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((t) => {
                    const isSelected = selectedAdminTicket?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedAdminTicket(t)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs ${
                          isSelected
                            ? 'bg-indigo-50/60 border-indigo-400 ring-1 ring-indigo-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {t.id}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                              t.status === 'open'
                                ? 'bg-blue-100 text-blue-800'
                                : t.status === 'in_review'
                                ? 'bg-purple-100 text-purple-800'
                                : t.status === 'waiting_customer'
                                ? 'bg-amber-100 text-amber-800'
                                : t.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 mb-1 line-clamp-1">{t.subject}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
                          <span>{t.customerName}</span>
                          <span>·</span>
                          <span className="font-mono">{t.customerEmail}</span>
                        </div>

                        {t.orderNumber && (
                          <div className="text-[10px] font-mono text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded inline-block mb-2">
                            Order: {t.orderNumber}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                          <span>{t.messages?.length || 0} messages</span>
                          <span>
                            {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Right Column: Active Ticket Console */}
              <div className="lg:col-span-7">
                {selectedAdminTicket ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                            {selectedAdminTicket.id}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">{selectedAdminTicket.subject}</h3>
                        </div>
                        <p className="text-xs text-slate-500">
                          Customer: <strong className="text-slate-800">{selectedAdminTicket.customerName}</strong> ({selectedAdminTicket.customerEmail}) · Phone: {selectedAdminTicket.customerPhone || 'N/A'}
                        </p>
                      </div>

                      {/* Immediate Status Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">Status:</span>
                        <select
                          value={selectedAdminTicket.status}
                          disabled={adminTicketActionLoading}
                          onChange={(e) => handleUpdateTicketStatus(selectedAdminTicket.id, e.target.value)}
                          className="bg-white border border-slate-300 rounded-lg text-xs font-semibold px-2.5 py-1.5 text-slate-800 shadow-2xs"
                        >
                          <option value="open">Open</option>
                          <option value="in_review">In Review</option>
                          <option value="waiting_customer">Waiting Customer</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    {/* Messages Thread */}
                    <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto border-b border-slate-100">
                      {selectedAdminTicket.messages?.map((msg: any) => {
                        const isStaff = msg.senderRole === 'admin';
                        return (
                          <div key={msg.id} className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1 px-1 text-[11px]">
                              <span className="font-bold text-slate-800">{msg.senderName}</span>
                              {isStaff && (
                                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 font-bold rounded text-[10px]">
                                  Staff
                                </span>
                              )}
                              <span className="text-slate-400">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div
                              className={`max-w-xl rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap leading-relaxed shadow-2xs ${
                                isStaff
                                  ? 'bg-indigo-600 text-white rounded-tr-xs'
                                  : 'bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200'
                              }`}
                            >
                              {msg.message}

                              {/* Evidence Screenshots Preview */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2.5 pt-2.5 border-t border-white/20 flex flex-wrap gap-2">
                                  {msg.attachments.map((att: any) => {
                                    const attUrl = `/api/tickets/${selectedAdminTicket.id}/attachments/${att.id}`;
                                    return (
                                      <button
                                        key={att.id}
                                        type="button"
                                        onClick={() => setPreviewTicketAttachmentUrl(attUrl)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                          isStaff
                                            ? 'bg-indigo-700 hover:bg-indigo-800 text-white'
                                            : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                                        }`}
                                      >
                                        <Paperclip className="w-3 h-3" />
                                        <span className="truncate max-w-[120px]">{att.originalName}</span>
                                        <Eye className="w-3 h-3 ml-0.5 opacity-70" />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Private Staff Internal Notes Box */}
                    <div className="p-5 bg-amber-50/70 border-b border-amber-200">
                      <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-900">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        Private Internal Notes (Staff-Only · Never Visible to Customer)
                      </div>

                      {selectedAdminTicket.internalNotes && selectedAdminTicket.internalNotes.length > 0 ? (
                        <div className="space-y-2 mb-3">
                          {selectedAdminTicket.internalNotes.map((n: any) => (
                            <div key={n.id} className="bg-white p-2.5 rounded-lg border border-amber-200 text-xs">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                <span className="font-semibold text-slate-800">{n.staffName}</span>
                                <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-slate-800">{n.note}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-800 mb-3 italic">
                          No internal notes recorded yet for this ticket.
                        </p>
                      )}

                      <form onSubmit={handleAddInternalNote} className="flex gap-2">
                        <input
                          type="text"
                          value={adminInternalNote}
                          onChange={(e) => setAdminInternalNote(e.target.value)}
                          placeholder="Add private staff observation, credentials checked, or warranty notes..."
                          className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="submit"
                          disabled={!adminInternalNote.trim() || adminTicketActionLoading}
                          className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-2xs whitespace-nowrap"
                        >
                          Save Note
                        </button>
                      </form>
                    </div>

                    {/* Official Staff Reply Form */}
                    <div className="p-5 bg-white">
                      <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-indigo-600" />
                        Reply to Customer
                      </h4>
                      <form onSubmit={handleReplyStaff}>
                        <textarea
                          rows={3}
                          value={adminStaffReply}
                          onChange={(e) => setAdminStaffReply(e.target.value)}
                          placeholder="Provide resolution steps, replacement instructions, or request further clarification..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none mb-3"
                        />

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">Set Status on Reply:</span>
                            <select
                              value={adminNextStatus}
                              onChange={(e) => setAdminNextStatus(e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded-lg text-xs px-2 py-1 text-slate-800"
                            >
                              <option value="waiting_customer">Waiting for Customer</option>
                              <option value="in_review">In Review</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={!adminStaffReply.trim() || adminTicketActionLoading}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {adminTicketActionLoading ? 'Dispatching...' : 'Send Official Response'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Select a ticket from the queue on the left to inspect error screenshots, conversation history, and internal notes.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Action Dialog: Order Approval, Rejection, Fulfillment */}
      {actionOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {actionType === 'approve'
                  ? 'Approve Order for Fulfillment'
                  : actionType === 'reject'
                  ? 'Reject Order (Initiate Reversal/Refund)'
                  : 'Fulfill Digital Delivery'}
              </h3>
              <button onClick={() => setActionOrder(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div>
                  <strong>Order:</strong> {actionOrder.orderNumber} ({actionOrder.orderSource})
                </div>
                <div>
                  <strong>Customer:</strong> {actionOrder.customerName} ({actionOrder.customerEmail})
                </div>
                <div>
                  <strong>Product:</strong> {actionOrder.snapshotProductName} ({actionOrder.snapshotPackageName})
                </div>
                <div>
                  <strong>Retail Price:</strong> ৳{actionOrder.snapshotRetailPriceBdt.toFixed(2)}
                </div>
                {actionOrder.orderSource === 'reseller_store' && (
                  <div>
                    <strong>Wholesale Debit Status:</strong>{' '}
                    <span className="font-mono text-emerald-700 font-bold">
                      {actionOrder.walletDebited ? `Debited (৳${actionOrder.snapshotWholesaleCostBdt.toFixed(2)})` : 'Not Debited'}
                    </span>
                  </div>
                )}
              </div>

              {actionType === 'approve' && (
                <p className="text-slate-600">
                  Approving this order will move it into the fulfillment queue (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">queued_for_delivery</code>) and notify the customer.
                </p>
              )}

              {actionType === 'reject' && (
                <div>
                  <label className="block font-semibold text-rose-800 mb-1">
                    Recorded Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Provide specific reason (e.g. invalid account details or policy violation)..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  {actionOrder.walletDebited && (
                    <div className="mt-2 text-rose-700 text-[11px] bg-rose-50 p-2 rounded">
                      Notice: Wholesale cost (৳{actionOrder.snapshotWholesaleCostBdt.toFixed(2)}) will be credited back to the reseller's wallet via a compensating ledger entry.
                    </div>
                  )}
                </div>
              )}

              {actionType === 'fulfill' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      License Key / Credentials Payload <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={fulfillmentKey}
                      onChange={(e) => setFulfillmentKey(e.target.value)}
                      placeholder="e.g. Serial Key: ABCD-1234-EFGH or Login Email: user@domain.com Pass: Secret123"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Instructions for Customer <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={fulfillmentInstructions}
                      onChange={(e) => setFulfillmentInstructions(e.target.value)}
                      placeholder="Activation steps..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActionOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              {actionType === 'approve' && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleApproveOrder}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                >
                  {actionLoading ? 'Approving...' : 'Confirm Approval'}
                </button>
              )}
              {actionType === 'reject' && (
                <button
                  type="button"
                  disabled={actionLoading || !rejectReason.trim()}
                  onClick={handleRejectOrder}
                  className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg shadow-xs"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject & Refund Wholesale'}
                </button>
              )}
              {actionType === 'fulfill' && (
                <button
                  type="button"
                  disabled={actionLoading || !fulfillmentKey.trim()}
                  onClick={handleFulfillOrder}
                  className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg shadow-xs"
                >
                  {actionLoading ? 'Delivering...' : 'Complete Fulfillment & Notify Customer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KYC Reject Modal */}
      {kycRejectApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Reject Reseller Application</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter reason for rejecting {kycRejectApp.businessName}.
            </p>
            <textarea
              rows={3}
              value={kycRejectReason}
              onChange={(e) => setKycRejectReason(e.target.value)}
              placeholder="e.g. National ID image illegible, or trade license expired..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setKycRejectApp(null)} className="px-4 py-2 text-xs text-slate-600">
                Cancel
              </button>
              <button
                onClick={handleRejectKYC}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Reversal Modal */}
      {reversalBonus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Reverse Reseller Bonus</h3>
            <p className="text-xs text-slate-500 mb-4">
              Reference: <strong className="font-mono text-indigo-700">{reversalBonus.referenceCode}</strong>. Reversal debits ৳{reversalBonus.amountBdt.toFixed(2)} from partner wallet via a compensating ledger entry.
            </p>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reversal Reason & Audit Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="e.g. Promotional target was not sustained, or clerical error..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setReversalBonus(null)} className="px-4 py-2 text-xs text-slate-600">
                Cancel
              </button>
              <button
                disabled={!reversalReason.trim()}
                onClick={handleReverseBonus}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Test Notification Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Send Test Notification</h3>
                  <p className="text-[11px] text-slate-500">Live dispatch test through production outbox & providers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Channel Tabs */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dispatch Channel</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTestChannel('email');
                    if (testRecipient.startsWith('01') || testRecipient.startsWith('88')) {
                      setTestRecipient('admin@digimarket.com');
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-colors ${
                    testChannel === 'email'
                      ? 'border-blue-500 bg-blue-50/60 text-blue-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email (SMTP)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestChannel('whatsapp');
                    if (testRecipient.includes('@')) {
                      setTestRecipient('01700000000');
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-colors ${
                    testChannel === 'whatsapp'
                      ? 'border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp API
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestChannel('sms');
                    if (testRecipient.includes('@')) {
                      setTestRecipient('01700000000');
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-colors ${
                    testChannel === 'sms'
                      ? 'border-purple-500 bg-purple-50/60 text-purple-700 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  FastSMS (BD)
                </button>
              </div>
            </div>

            {/* Recipient Contact */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {testChannel === 'email' ? 'Recipient Email Address' : 'Recipient Phone Number (E.164 / BD format)'}
              </label>
              <input
                type="text"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder={testChannel === 'email' ? 'e.g. user@example.com' : 'e.g. 017XXXXXXXX or +8801XXXXXXXXX'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Subject / Title */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Header Title</label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="e.g. DigiMarket System Notification"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Message Body */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message Content</label>
              <textarea
                rows={3}
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder="Type test message content..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Live Result Feedback Banner */}
            {testFeedback && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs font-mono border ${
                  testFeedback.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  {testFeedback.success ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" /> Dispatch Succeeded (Status: {testFeedback.status})
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-600" /> Result Status: {testFeedback.status}
                    </>
                  )}
                </div>
                {testFeedback.providerMessageId && (
                  <div className="text-[11px] text-slate-700">
                    Provider Message ID: <strong>{testFeedback.providerMessageId}</strong>
                  </div>
                )}
                {testFeedback.errorMessage && (
                  <div className="text-[11px] text-rose-700 mt-1 whitespace-pre-wrap">
                    {testFeedback.errorMessage}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
              <button
                type="button"
                disabled={testSending || !testRecipient.trim() || !testTitle.trim() || !testBody.trim()}
                onClick={async () => {
                  try {
                    setTestSending(true);
                    setTestFeedback(null);
                    const res = await api.sendTestNotification({
                      channel: testChannel,
                      recipientContact: testRecipient.trim(),
                      title: testTitle.trim(),
                      bodyText: testBody.trim(),
                    });
                    setTestFeedback({
                      success: res.item?.status === 'sent' || res.item?.status === 'delivered',
                      status: res.item?.status,
                      providerMessageId: res.item?.providerMessageId,
                      errorMessage: res.item?.errorMessage,
                      item: res.item,
                    });
                    loadAllAdminData();
                  } catch (err: any) {
                    setTestFeedback({
                      success: false,
                      status: 'error',
                      errorMessage: err.message,
                    });
                  } finally {
                    setTestSending(false);
                  }
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                {testSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Dispatch Real Test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Screenshot Lightbox Modal */}
      {previewTicketAttachmentUrl && (
        <div
          onClick={() => setPreviewTicketAttachmentUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setPreviewTicketAttachmentUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewTicketAttachmentUrl}
              alt="Evidence screenshot preview"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}

      {/* Add / Edit Product & Pricing Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingProduct ? 'Edit Digital Product & Pricing' : 'Add New Digital Product'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Define product metadata, tiered duration pricing, retail rates, and wholesale partner costs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {productFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {productFormError}
              </div>
            )}

            <form onSubmit={handleSaveProductSubmit} className="space-y-5 text-xs">
              {/* Row 1: Name & Category & Delivery */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Product Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Canva Pro (Private Invite Link)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="cat_productivity">Productivity & AI Tools</option>
                    <option value="cat_design">Graphic Design & Creative</option>
                    <option value="cat_streaming">Entertainment & Streaming</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Tagline & Delivery Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Short Tagline</label>
                  <input
                    type="text"
                    value={productTagline}
                    onChange={(e) => setProductTagline(e.target.value)}
                    placeholder="e.g. Private Email Invite · Instant Delivery"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Delivery Fulfillment Type</label>
                  <select
                    value={productDeliveryMethod}
                    onChange={(e) => setProductDeliveryMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="manual_credentials">Manual Credentials (Email & Password)</option>
                    <option value="instant_license_key">Instant License Key</option>
                    <option value="invite_link">Team / Workspace Invite Link</option>
                    <option value="direct_activation">Direct Account Activation</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Description */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Key features, warranty details, and specifications..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              {/* Row 4: Image Upload & Preview */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block font-semibold text-slate-700 mb-2">Product Image (Max 3MB · JPEG, PNG, WebP)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                    {productImageUrl ? (
                      <img src={productImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      {imageUploading ? 'Uploading...' : 'Upload / Replace Image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={imageUploading}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Current URL: <span className="font-mono text-slate-600 truncate max-w-xs">{productImageUrl}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 5: Storefront Distribution & Status */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={productMainStore}
                    onChange={(e) => setProductMainStore(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Show on Main Store</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={productResellers}
                    onChange={(e) => setProductResellers(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Available to Resellers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={productIsActive}
                    onChange={(e) => setProductIsActive(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Status: {productIsActive ? 'Active' : 'Paused'}</span>
                </label>
              </div>

              {/* Row 6: Duration Packages & Tiered Pricing Engine */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-900 block">
                    Duration Packages & Wholesale Pricing <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setProductPackages([
                        ...productPackages,
                        {
                          name: 'New Package',
                          durationLabel: '30 Days',
                          durationDays: 30,
                          retailPriceBdt: 500,
                          resellerWholesaleCostBdt: 350,
                          stockCount: -1,
                          isActive: true,
                        },
                      ]);
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Duration
                  </button>
                </div>

                <div className="space-y-2.5">
                  {productPackages.map((pkg, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-4">
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Package Title</label>
                        <input
                          type="text"
                          required
                          value={pkg.name}
                          onChange={(e) => {
                            const updated = [...productPackages];
                            updated[idx].name = e.target.value;
                            setProductPackages(updated);
                          }}
                          placeholder="e.g. 1 Month Private"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Duration (Days)</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={pkg.durationDays}
                          onChange={(e) => {
                            const updated = [...productPackages];
                            updated[idx].durationDays = parseInt(e.target.value, 10) || 1;
                            setProductPackages(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Retail ৳ (Customer)</label>
                        <input
                          type="number"
                          required
                          min={0}
                          step={10}
                          value={pkg.retailPriceBdt}
                          onChange={(e) => {
                            const updated = [...productPackages];
                            updated[idx].retailPriceBdt = parseFloat(e.target.value) || 0;
                            setProductPackages(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono font-bold text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Wholesale ৳ (Partner)</label>
                        <input
                          type="number"
                          required
                          min={0}
                          step={10}
                          value={pkg.resellerWholesaleCostBdt}
                          onChange={(e) => {
                            const updated = [...productPackages];
                            updated[idx].resellerWholesaleCostBdt = parseFloat(e.target.value) || 0;
                            setProductPackages(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono font-bold text-indigo-600"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-end gap-1 pb-1">
                        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 cursor-pointer mr-1">
                          <input
                            type="checkbox"
                            checked={pkg.isActive}
                            onChange={(e) => {
                              const updated = [...productPackages];
                              updated[idx].isActive = e.target.checked;
                              setProductPackages(updated);
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span>Active</span>
                        </label>

                        {productPackages.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setProductPackages(productPackages.filter((_, i) => i !== idx));
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Remove Package"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 7: Delivery Instructions & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Delivery Instructions</label>
                  <textarea
                    rows={2}
                    value={productDeliveryInstructions}
                    onChange={(e) => setProductDeliveryInstructions(e.target.value)}
                    placeholder="e.g. Login at canva.com using the credentials sent to your email..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Terms & Warranty</label>
                  <textarea
                    rows={2}
                    value={productTerms}
                    onChange={(e) => setProductTerms(e.target.value)}
                    placeholder="e.g. Full warranty replacement if credentials fail within duration..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Footer Save & Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productSaveLoading || imageUploading}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  {productSaveLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Product...
                    </>
                  ) : (
                    'Save Product & Pricing'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Delete / Archive Confirmation Modal */}
      {deleteProductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">Archive Product</h3>
            <p className="text-xs text-slate-600 text-center mb-4">
              Are you sure you want to archive <strong>"{deleteProductTarget.name}"</strong>?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 mb-5 space-y-1">
              <p className="font-semibold">Safe Deletion Protocol:</p>
              <p>• The product will be hidden from the Main Storefront and Reseller catalogs.</p>
              <p>• Historical orders, invoices, deliveries, and wallet ledgers remain 100% intact.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteProductTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteProductLoading}
                onClick={handleConfirmDeleteProduct}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
              >
                {deleteProductLoading ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
