/**
 * Reseller Dashboard & Portal
 * Complete wallet ledger, customer payment verification, atomic wholesale debit,
 * deposit top-ups, bonus history, and store settings.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import {
  Wallet,
  ShoppingBag,
  FileText,
  Gift,
  Settings,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  X,
  CreditCard,
  Package,
  Power,
  Check,
  AlertTriangle,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface ResellerPortalProps {
  onOpenStorefront: (subdomain: string) => void;
}

export const ResellerPortal: React.FC<ResellerPortalProps> = ({ onOpenStorefront }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'payment_methods' | 'wallet' | 'deposits' | 'bonuses' | 'settings'>('orders');
  const [wallet, setWallet] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState<any | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [storeProductsData, setStoreProductsData] = useState<{ configs: any[]; adminProducts: any[]; sellerProducts: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // Store Maintenance State
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [maintenanceFeedback, setMaintenanceFeedback] = useState<string | null>(null);

  // Add Payment Method Modal
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState<'bkash' | 'nagad' | 'rocket' | 'bank_transfer'>('bkash');
  const [newProviderName, setNewProviderName] = useState('bKash Personal');
  const [newAccountIdentifier, setNewAccountIdentifier] = useState('');
  const [newAccountType, setNewAccountType] = useState<'personal' | 'merchant'>('personal');
  const [newRoutingOrBranch, setNewRoutingOrBranch] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [addPaymentSubmitting, setAddPaymentSubmitting] = useState(false);
  const [addPaymentError, setAddPaymentError] = useState<string | null>(null);

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositMethod, setDepositMethod] = useState<'bkash_merchant' | 'nagad_merchant' | 'bank_transfer'>('bkash_merchant');
  const [depositAmount, setDepositAmount] = useState('1000');
  const [depositTxn, setDepositTxn] = useState('');
  const [depositSender, setDepositSender] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Payment Verification Dialog for Reseller Order
  const [verifyingOrder, setVerifyingOrder] = useState<any | null>(null);
  const [verificationDecision, setVerificationDecision] = useState<'approve_verified' | 'reject_invalid'>('approve_verified');
  const [rejectionReason, setRejectionReason] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Store settings form
  const [storeName, setStoreName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [bkashInstructions, setBkashInstructions] = useState('');
  const [nagadInstructions, setNagadInstructions] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      api.setToken('usr_reseller_01');
      const [w, ords, ldg, deps, bns, me, pMethods, sProds] = await Promise.all([
        api.getResellerWallet(),
        api.getResellerOrders(),
        api.getResellerLedger(),
        api.getResellerDeposits(),
        api.getResellerBonuses(),
        api.getStore('rahim'), // Default demo reseller store
        api.getResellerPaymentMethods().catch(() => []),
        api.getResellerStoreProducts().catch(() => null),
      ]);
      setWallet(w);
      setOrders(ords);
      setLedger(ldg);
      setDeposits(deps);
      setBonuses(bns);
      setPaymentMethods(pMethods);
      setStoreProductsData(sProds);
      if (me?.store) {
        setStoreSettings(me.store);
        setStoreName(me.store.storeName);
        setSupportPhone(me.store.supportPhone);
        setSupportWhatsapp(me.store.supportWhatsapp);
        setBkashInstructions(me.store.paymentInstructionsBkash || '');
        setNagadInstructions(me.store.paymentInstructionsNagad || '');
        setIsMaintenance(Boolean(me.store.isMaintenance || me.store.status === 'maintenance'));
        setMaintenanceMessage(me.store.maintenanceMessage || '');
      }
    } catch (err) {
      console.error('Failed to load reseller data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositTxn.trim() || !depositSender.trim() || Number(depositAmount) <= 0) {
      setDepositError('Please fill in all deposit details.');
      return;
    }

    try {
      setDepositSubmitting(true);
      setDepositError(null);
      await api.submitDepositRequest({
        method: depositMethod,
        claimedAmountBdt: Number(depositAmount),
        transactionReference: depositTxn.trim(),
        senderAccountNumber: depositSender.trim(),
      });
      setShowDepositModal(false);
      setDepositTxn('');
      setDepositSender('');
      loadAllData();
    } catch (err: any) {
      setDepositError(err.message || 'Deposit submission failed.');
    } finally {
      setDepositSubmitting(false);
    }
  };

  const handleVerifyOrderPayment = async () => {
    if (!verifyingOrder) return;
    const submission = verifyingOrder.submissions?.[0];
    if (!submission) {
      setVerificationFeedback('No payment submission found on this order.');
      return;
    }

    try {
      setVerificationLoading(true);
      setVerificationFeedback(null);

      const res = await api.verifyResellerPayment(verifyingOrder.id, {
        submissionId: submission.id,
        decision: verificationDecision,
        verificationNotes: verificationDecision === 'reject_invalid' ? rejectionReason : undefined,
      });

      if (!res.walletDebitSuccess && res.holdReason) {
        setVerificationFeedback(res.holdReason);
      } else {
        setVerifyingOrder(null);
      }
      loadAllData();
    } catch (err: any) {
      setVerificationFeedback(err.message || 'Verification failed.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRetryHeldDebit = async (orderId: string) => {
    try {
      await api.retryWalletDebit(orderId);
      loadAllData();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateStoreSettings({
        storeName,
        supportPhone,
        supportWhatsapp,
        paymentInstructionsBkash: bkashInstructions,
        paymentInstructionsNagad: nagadInstructions,
      });
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
      loadAllData();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  const handleToggleMaintenance = async () => {
    try {
      setMaintenanceSubmitting(true);
      setMaintenanceFeedback(null);
      const nextState = !isMaintenance;
      const res = await api.setStoreMaintenance({
        isMaintenance: nextState,
        maintenanceMessage: maintenanceMessage.trim(),
      });
      setIsMaintenance(res.isMaintenance);
      setMaintenanceFeedback(
        nextState
          ? 'Store maintenance mode is now ACTIVE. Storefront shows maintenance banner.'
          : 'Store maintenance mode is now TURNED OFF. Orders are active.'
      );
      setTimeout(() => setMaintenanceFeedback(null), 4000);
      loadAllData();
    } catch (err: any) {
      setMaintenanceFeedback(`Error: ${err.message}`);
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountIdentifier.trim()) {
      setAddPaymentError('Account number or mobile number is required.');
      return;
    }
    try {
      setAddPaymentSubmitting(true);
      setAddPaymentError(null);
      await api.addResellerPaymentMethod({
        methodType: newMethodType,
        providerName: newProviderName.trim() || newMethodType.toUpperCase(),
        accountIdentifier: newAccountIdentifier.trim(),
        accountType: newAccountType,
        routingOrBranch: newRoutingOrBranch.trim() || undefined,
        instructions: newInstructions.trim() || undefined,
      });
      setShowAddPaymentModal(false);
      setNewAccountIdentifier('');
      setNewRoutingOrBranch('');
      setNewInstructions('');
      loadAllData();
    } catch (err: any) {
      setAddPaymentError(err.message || 'Failed to submit payment method.');
    } finally {
      setAddPaymentSubmitting(false);
    }
  };

  const handleToggleStoreProduct = async (prod: any, isCurrentlyEnabled: boolean) => {
    try {
      await api.upsertResellerStoreProduct({
        productId: prod.id,
        productSource: prod.productSource,
        isEnabled: !isCurrentlyEnabled,
      });
      loadAllData();
    } catch (err: any) {
      alert(`Failed to update product: ${err.message}`);
    }
  };

  const handleSaveProductCustomization = async (prod: any, customTitle?: string, sellingPriceBdt?: number) => {
    try {
      await api.upsertResellerStoreProduct({
        productId: prod.id,
        productSource: prod.productSource,
        customTitle: customTitle || undefined,
        sellingPriceBdt: sellingPriceBdt || undefined,
        isEnabled: true,
      });
      loadAllData();
    } catch (err: any) {
      alert(`Failed to customize product: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner / Breadcrumb */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
              <span>Portals</span>
              <span>/</span>
              <span>Reseller Dashboard</span>
              <span>/</span>
              <span className="text-indigo-600 font-semibold">{storeSettings?.storeName || 'My Store'}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reseller Operations Console</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenStorefront('rahim')}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5 border border-indigo-200"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Public Storefront
            </button>
            <button
              onClick={() => setShowDepositModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Request Wallet Top-Up
            </button>
          </div>
        </div>

        {/* Financial KPI Cards Strip */}
        <div className="max-w-7xl mx-auto px-6 pb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">Available Balance</span>
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              ৳{(wallet?.availableBalanceBdt || 0).toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Authoritative ledger balance</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">Total Deposited</span>
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              ৳{(wallet?.totalDepositedBdt || 0).toFixed(2)}
            </span>
            <span className="text-[11px] text-emerald-600 block mt-0.5">Verified top-ups</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">Total Wholesale Spent</span>
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              ৳{(wallet?.totalSpentBdt || 0).toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Fulfilled order debits</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium block">Total Bonuses Awarded</span>
            <span className="text-2xl font-bold text-indigo-600 font-mono tabular-nums">
              ৳{(wallet?.totalBonusBdt || 0).toFixed(2)}
            </span>
            <span className="text-[11px] text-indigo-500 block mt-0.5">Promotions & rewards</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 border-t border-slate-200 overflow-x-auto">
          {[
            { id: 'orders', label: 'Customer Orders', icon: ShoppingBag, count: orders.length },
            { id: 'products', label: 'Store Products', icon: Package },
            { id: 'payment_methods', label: 'Payment Methods', icon: CreditCard, count: paymentMethods.length },
            { id: 'wallet', label: 'Wallet Ledger', icon: Wallet, count: ledger.length },
            { id: 'deposits', label: 'Deposit Requests', icon: PlusCircle, count: deposits.length },
            { id: 'bonuses', label: 'Bonus History', icon: Gift, count: bonuses.length },
            { id: 'settings', label: 'Store Settings & Maintenance', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 1. CUSTOMER ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Store Orders Requiring Verification</h2>
                <p className="text-xs text-slate-500">
                  Verify customer payment details to trigger wholesale debit and send to Admin approval.
                </p>
              </div>
              <button
                onClick={loadAllData}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
                No customer orders received on this store yet.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Product / Plan</th>
                        <th className="py-3 px-4 text-right">Retail (Claimed)</th>
                        <th className="py-3 px-4 text-right">Wholesale Cost</th>
                        <th className="py-3 px-4">Payment Submission</th>
                        <th className="py-3 px-4">Order Status</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((o) => {
                        const sub = o.submissions?.[0];
                        return (
                          <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-900">{o.orderNumber}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-900">{o.customerName}</div>
                              <div className="text-slate-400 text-[11px]">{o.customerPhone}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-slate-900 font-medium">{o.snapshotProductName}</div>
                              <div className="text-slate-400 text-[11px]">{o.snapshotPackageName}</div>
                              {o.productOwnerType === 'SELLER' ? (
                                <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                  SELLER ASSET
                                </span>
                              ) : (
                                <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold">
                                  ADMIN PRODUCT
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                              ৳{o.snapshotRetailPriceBdt.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono">
                              {o.productOwnerType === 'SELLER' ? (
                                <div>
                                  <span className="text-emerald-600 font-bold">৳0.00</span>
                                  <span className="block text-[9px] text-emerald-600">Zero Wallet Debit</span>
                                </div>
                              ) : (
                                <span className="text-slate-600">৳{o.snapshotWholesaleCostBdt.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {sub ? (
                                <div className="space-y-0.5">
                                  <span className="font-mono font-bold text-slate-900 uppercase">
                                    {sub.channel}: {sub.transactionId}
                                  </span>
                                  <span className="block text-[11px] text-slate-500">
                                    Sender: {sub.senderPhoneOrAccount}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">Awaiting Submission</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  o.orderStatus === 'payment_submitted'
                                    ? 'bg-amber-100 text-amber-800'
                                    : o.orderStatus === 'wallet_pending'
                                    ? 'bg-rose-100 text-rose-800'
                                    : o.orderStatus === 'pending_admin_approval'
                                    ? 'bg-blue-100 text-blue-800'
                                    : o.orderStatus === 'pending_seller_action'
                                    ? 'bg-purple-100 text-purple-800'
                                    : o.orderStatus === 'seller_accepted' || o.orderStatus === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : o.orderStatus === 'seller_rejected' || o.orderStatus === 'admin_rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {o.orderStatus.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {o.orderStatus === 'payment_submitted' && sub && (
                                <button
                                  onClick={() => {
                                    setVerifyingOrder(o);
                                    setVerificationDecision('approve_verified');
                                    setRejectionReason('');
                                    setVerificationFeedback(null);
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-xs shadow-2xs"
                                >
                                  Verify Payment
                                </button>
                              )}
                              {o.orderStatus === 'wallet_pending' && (
                                <button
                                  onClick={() => handleRetryHeldDebit(o.id)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-xs flex items-center gap-1 mx-auto"
                                >
                                  <RefreshCw className="w-3 h-3" /> Retry Debit
                                </button>
                              )}
                              {o.orderStatus !== 'payment_submitted' && o.orderStatus !== 'wallet_pending' && (
                                <span className="text-slate-400 text-xs">Verified</span>
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
          </div>
        )}

        {/* 2. STORE PRODUCTS & PRICING TAB */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Storefront Product Selector & Markup</h2>
                <p className="text-xs text-slate-500">
                  Select which Admin products and Creator assets appear on your storefront. Customize retail prices to lock in your profit margins.
                </p>
              </div>
              <button
                onClick={loadAllData}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/50 self-start"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Admin Products Section */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                    Admin Catalog
                  </span>
                  <span className="text-xs font-bold text-slate-800">SSDigitalBD Official Licenses</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {storeProductsData?.adminProducts?.length || 0} items available
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4 text-right">Wholesale Cost (Wholesale Wallet)</th>
                      <th className="py-2.5 px-4 text-right">Default Retail</th>
                      <th className="py-2.5 px-4 text-right">Your Store Selling Price</th>
                      <th className="py-2.5 px-4 text-right">Your Margin</th>
                      <th className="py-2.5 px-4 text-center">Storefront Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {storeProductsData?.adminProducts?.map((prod) => {
                      const isEnabled = prod.config ? prod.config.isEnabled : true;
                      const sellingPrice = prod.config?.sellingPriceBdt || prod.defaultRetailPriceBdt;
                      const margin = sellingPrice - prod.wholesaleCostBdt;

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{prod.name}</div>
                            <div className="text-[11px] text-slate-400">{prod.tagline}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 font-semibold">
                            ৳{prod.wholesaleCostBdt.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            ৳{prod.defaultRetailPriceBdt.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <input
                              type="number"
                              min={prod.wholesaleCostBdt}
                              defaultValue={sellingPrice}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (val >= prod.wholesaleCostBdt) {
                                  handleSaveProductCustomization(prod, undefined, val);
                                }
                              }}
                              className="w-24 px-2 py-1 text-right border border-slate-300 rounded font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            +৳{margin.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStoreProduct(prod, isEnabled)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                                isEnabled
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {isEnabled ? 'Active' : 'Hidden'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Seller Products Section */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                    Creator Marketplace
                  </span>
                  <span className="text-xs font-bold text-slate-800">Verified Seller Partner Assets</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {storeProductsData?.sellerProducts?.length || 0} items available
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Asset & Creator</th>
                      <th className="py-2.5 px-4 text-right">Wholesale Cost (Wholesale Wallet)</th>
                      <th className="py-2.5 px-4 text-right">Base Creator Price</th>
                      <th className="py-2.5 px-4 text-right">Your Store Selling Price</th>
                      <th className="py-2.5 px-4 text-right">Your Margin</th>
                      <th className="py-2.5 px-4 text-center">Storefront Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {storeProductsData?.sellerProducts?.map((prod) => {
                      const isEnabled = prod.config ? prod.config.isEnabled : true;
                      const sellingPrice = prod.config?.sellingPriceBdt || prod.sellerPriceBdt;
                      const margin = Math.max(0, sellingPrice - prod.sellerPriceBdt);

                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{prod.name}</div>
                            <div className="text-[11px] text-emerald-700 font-medium">By {prod.sellerStoreName}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">
                            ৳0.00
                            <span className="block text-[9px] text-slate-400 font-normal">Zero Wallet Debit</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            ৳{prod.sellerPriceBdt.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <input
                              type="number"
                              min={prod.sellerPriceBdt}
                              defaultValue={sellingPrice}
                              onBlur={(e) => {
                                const val = Number(e.target.value);
                                if (val >= prod.sellerPriceBdt) {
                                  handleSaveProductCustomization(prod, undefined, val);
                                }
                              }}
                              className="w-24 px-2 py-1 text-right border border-slate-300 rounded font-mono font-bold text-slate-900 text-xs focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            +৳{margin.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStoreProduct(prod, isEnabled)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                                isEnabled
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {isEnabled ? 'Active' : 'Hidden'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. PAYMENT METHODS TAB */}
        {activeTab === 'payment_methods' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Customer Direct Payment Accounts</h2>
                <p className="text-xs text-slate-500">
                  Customer payments from your store are transferred directly to these accounts. Accounts require Admin verification before public display.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddPaymentModal(true);
                  setAddPaymentError(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs self-start"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Submit New Payment Account
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Method & Provider</th>
                    <th className="py-3 px-4">Account Identifier</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Approval Status</th>
                    <th className="py-3 px-4">Admin Review Notes</th>
                    <th className="py-3 px-4 text-right">Submitted Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentMethods.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No custom payment accounts submitted yet. Click "Submit New Payment Account" above.
                      </td>
                    </tr>
                  ) : (
                    paymentMethods.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{m.providerName || m.methodType.toUpperCase()}</span>
                          </div>
                          {m.instructions && (
                            <div className="text-[11px] text-slate-400 font-normal mt-0.5">{m.instructions}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          {m.accountIdentifier}
                          {m.routingOrBranch && (
                            <span className="block text-[10px] text-slate-400 font-normal">Branch: {m.routingOrBranch}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 capitalize text-slate-600">
                          {m.accountType}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              m.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : m.status === 'suspended'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {m.status === 'approved' && <ShieldCheck className="w-3 h-3" />}
                            {m.status === 'pending' && <Clock className="w-3 h-3" />}
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {m.adminNotes || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-400">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. WALLET LEDGER TAB */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Immutable Financial Ledger</h2>
              <p className="text-xs text-slate-500">
                Audited transactional history. Every entry commits atomically with wallet balance adjustments.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Reference & Idempotency</th>
                    <th className="py-3 px-4">Entry Type</th>
                    <th className="py-3 px-4 text-right">Amount (BDT)</th>
                    <th className="py-3 px-4 text-right">Balance Before</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((entry) => {
                    const isCredit = entry.entryType.includes('credit');
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          <div>{entry.referenceId}</div>
                          <div className="text-[10px] text-slate-400">{entry.idempotencyKey}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {entry.entryType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCredit ? '+' : '-'}৳{entry.amountBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          ৳{entry.balanceBeforeBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          ৳{entry.balanceAfterBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{entry.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. DEPOSIT REQUESTS TAB */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Wallet Deposit & Top-Up History</h2>
                <p className="text-xs text-slate-500">
                  Submit proof of payment. Once verified by Main Admin, funds are credited atomically.
                </p>
              </div>
              <button
                onClick={() => setShowDepositModal(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" /> New Deposit Request
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Requested At</th>
                    <th className="py-3 px-4">Channel / Method</th>
                    <th className="py-3 px-4">Transaction Ref</th>
                    <th className="py-3 px-4">Sender Account</th>
                    <th className="py-3 px-4 text-right">Amount (BDT)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Admin Review Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deposits.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 uppercase">
                        {d.method.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                        {d.transactionReference}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{d.senderAccountNumber}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ৳{d.claimedAmountBdt.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4 text-slate-500">{d.adminNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. BONUS HISTORY TAB */}
        {activeTab === 'bonuses' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Reseller Bonus & Incentives History</h2>
              <p className="text-xs text-slate-500">
                Performance rewards, promotional campaigns, and welcome credits credited by Main Admin.
              </p>
            </div>

            {bonuses.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
                No promotional bonuses awarded yet.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Awarded Date</th>
                      <th className="py-3 px-4">Reference Code</th>
                      <th className="py-3 px-4">Bonus Type</th>
                      <th className="py-3 px-4 text-right">Amount (BDT)</th>
                      <th className="py-3 px-4">Campaign & Reason</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bonuses.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">{b.referenceCode}</td>
                        <td className="py-3 px-4 font-medium uppercase text-slate-800">
                          {b.bonusType.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">
                          +৳{b.amountBdt.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {b.campaignName && <span className="font-semibold text-slate-900 block">{b.campaignName}</span>}
                          {b.reason}
                        </td>
                        <td className="py-3 px-4">
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 5. STORE SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Store Branding & Payment Instructions</h2>
            <p className="text-xs text-slate-500 mb-6">
              Configure what customers see on your subdomain store. Your payment accounts will be shown on customer orders.
            </p>

            {settingsSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Store configuration saved successfully.
              </div>
            )}

            <form onSubmit={handleSaveStoreSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Display Name</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Support Phone</label>
                  <input
                    type="text"
                    required
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Support WhatsApp</label>
                  <input
                    type="text"
                    value={supportWhatsapp}
                    onChange={(e) => setSupportWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  bKash Payment Instructions (Personal/Merchant)
                </label>
                <textarea
                  rows={2}
                  value={bkashInstructions}
                  onChange={(e) => setBkashInstructions(e.target.value)}
                  placeholder="e.g. bKash Personal: 018XXXXXXXX (Send Money). Put order number in reference."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nagad Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={nagadInstructions}
                  onChange={(e) => setNagadInstructions(e.target.value)}
                  placeholder="e.g. Nagad Personal: 018XXXXXXXX."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
              >
                Save Settings
              </button>
            </form>

            {/* Store Maintenance Mode Card */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${isMaintenance ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Power className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Store Maintenance Mode</h3>
                    <p className="text-xs text-slate-500">Temporarily pause customer checkout while keeping other stores active</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMaintenance}
                  disabled={maintenanceSubmitting}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start ${
                    isMaintenance
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {isMaintenance ? 'Maintenance Active (Turn OFF)' : 'Activate Maintenance'}
                </button>
              </div>

              {maintenanceFeedback && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                  {maintenanceFeedback}
                </div>
              )}

              <div className="space-y-2 mt-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700">Custom Maintenance Notice Shown on Storefront</label>
                <textarea
                  rows={2}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="e.g. We are performing scheduled stock upgrades. Orders will resume in 2 hours."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="button"
                  disabled={maintenanceSubmitting}
                  onClick={async () => {
                    await api.setStoreMaintenance({ isMaintenance, maintenanceMessage });
                    setMaintenanceFeedback('Maintenance notice saved.');
                    setTimeout(() => setMaintenanceFeedback(null), 3000);
                  }}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-semibold"
                >
                  Save Notice Text
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Verification Dialog Modal */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Verify Customer Payment ({verifyingOrder.orderNumber})
              </h3>
              <button
                onClick={() => setVerifyingOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {verificationFeedback && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>{verificationFeedback}</div>
              </div>
            )}

            <div className="space-y-3 text-xs mb-5">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div>
                  <strong>Customer:</strong> {verifyingOrder.customerName} ({verifyingOrder.customerPhone})
                </div>
                <div>
                  <strong>Item:</strong> {verifyingOrder.snapshotProductName} - {verifyingOrder.snapshotPackageName}
                </div>
                <div>
                  <strong>Required Retail:</strong>{' '}
                  <span className="font-mono font-bold text-slate-900">৳{verifyingOrder.snapshotRetailPriceBdt.toFixed(2)}</span>
                </div>
                <div>
                  <strong>Wholesale Debit:</strong>{' '}
                  <span className="font-mono font-bold text-indigo-600">৳{verifyingOrder.snapshotWholesaleCostBdt.toFixed(2)}</span>
                </div>
              </div>

              {verifyingOrder.submissions?.[0] && (
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 space-y-1">
                  <div className="text-indigo-900 font-semibold uppercase">Submitted Payment Proof:</div>
                  <div>
                    <strong>Channel:</strong> {verifyingOrder.submissions[0].channel}
                  </div>
                  <div>
                    <strong>Transaction ID:</strong>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {verifyingOrder.submissions[0].transactionId}
                    </span>
                  </div>
                  <div>
                    <strong>Claimed Amount:</strong> ৳{verifyingOrder.submissions[0].claimedAmountBdt.toFixed(2)}
                  </div>
                  <div>
                    <strong>Sender Account:</strong> {verifyingOrder.submissions[0].senderPhoneOrAccount}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <label className="block text-slate-700 font-semibold mb-2">Verification Decision</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={verificationDecision === 'approve_verified'}
                      onChange={() => setVerificationDecision('approve_verified')}
                    />
                    <span className="text-emerald-700 font-medium">Verify Valid & Debit Wholesale</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={verificationDecision === 'reject_invalid'}
                      onChange={() => setVerificationDecision('reject_invalid')}
                    />
                    <span className="text-rose-700 font-medium">Reject (Invalid Reference)</span>
                  </label>
                </div>
              </div>

              {verificationDecision === 'reject_invalid' && (
                <div>
                  <label className="block text-slate-600 mb-1">Rejection Reason</label>
                  <input
                    type="text"
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Transaction reference not found in statement"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setVerifyingOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={verificationLoading}
                onClick={handleVerifyOrderPayment}
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg"
              >
                {verificationLoading ? 'Processing...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900">Request Wallet Top-Up</h3>
              <button onClick={() => setShowDepositModal(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {depositError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                {depositError}
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deposit Method</label>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="bkash_merchant">bKash Merchant (01711000001)</option>
                  <option value="nagad_merchant">Nagad Merchant (01711000001)</option>
                  <option value="bank_transfer">City Bank Corporate Account</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount to Deposit (BDT)</label>
                <input
                  type="number"
                  required
                  min={100}
                  step={50}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transaction Reference (TxnID)</label>
                <input
                  type="text"
                  required
                  value={depositTxn}
                  onChange={(e) => setDepositTxn(e.target.value.toUpperCase())}
                  placeholder="e.g. 9B890KLP"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sender Mobile / Account Number</label>
                <input
                  type="text"
                  required
                  value={depositSender}
                  onChange={(e) => setDepositSender(e.target.value)}
                  placeholder="018XXXXXXXX"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={depositSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                >
                  {depositSubmitting ? 'Submitting...' : 'Submit Deposit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Add Customer Payment Account</h3>
              </div>
              <button
                onClick={() => setShowAddPaymentModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPaymentMethod} className="space-y-4 text-xs">
              {addPaymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {addPaymentError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['bkash', 'nagad', 'rocket', 'bank_transfer'] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => {
                        setNewMethodType(m);
                        setNewProviderName(
                          m === 'bkash'
                            ? 'bKash Personal'
                            : m === 'nagad'
                            ? 'Nagad Personal'
                            : m === 'rocket'
                            ? 'Rocket Personal'
                            : 'City Bank'
                        );
                      }}
                      className={`p-2 rounded-lg font-bold uppercase text-center border transition-all ${
                        newMethodType === m
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Account Display Name / Provider
                </label>
                <input
                  type="text"
                  required
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="e.g. bKash Personal or Eastern Bank PLC"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Account Number / Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newAccountIdentifier}
                  onChange={(e) => setNewAccountIdentifier(e.target.value)}
                  placeholder="01XXXXXXXXX or Bank Account #"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="personal">Personal Account</option>
                    <option value="merchant">Merchant / Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch / Routing</label>
                  <input
                    type="text"
                    value={newRoutingOrBranch}
                    onChange={(e) => setNewRoutingOrBranch(e.target.value)}
                    placeholder="Optional for banks"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Instructions</label>
                <textarea
                  rows={2}
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="e.g. Send Money to this number and use order number as reference."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                <strong>Compliance Note:</strong> New payment methods enter a <strong>pending</strong> state and require Main Admin approval before customers can see them on your store.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addPaymentSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold"
                >
                  {addPaymentSubmitting ? 'Submitting...' : 'Submit for Admin Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
