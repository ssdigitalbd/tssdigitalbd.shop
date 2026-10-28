/**
 * Reseller Storefront Customer Experience
 * Displays custom reseller branding, support details, and reseller's own payment numbers.
 * NEVER displays Main Store payment details on reseller storefronts!
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { ShoppingBag, CheckCircle, Phone, MessageSquare, Mail, X } from 'lucide-react';

interface ResellerStorefrontProps {
  subdomain?: string;
  onTrackOrder: (orderNumber: string) => void;
}

export const ResellerStorefront: React.FC<ResellerStorefrontProps> = ({
  subdomain = 'rahim',
  onTrackOrder,
}) => {
  const [store, setStore] = useState<any | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Checkout modal
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [transactionId, setTransactionId] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    loadStore();
  }, [subdomain]);

  const loadStore = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getStore(subdomain);
      setStore(res.store);
      setProducts(res.products);
    } catch (err: any) {
      setError(err.message || 'Store not found.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceResellerOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !selectedProduct || !selectedPackage) return;
    if (!customerName || !customerEmail || !customerPhone) {
      setCheckoutError('Please provide your name, email, and phone number.');
      return;
    }
    if (!transactionId.trim()) {
      setCheckoutError('Please provide the payment transaction ID.');
      return;
    }

    try {
      setSubmittingOrder(true);
      setCheckoutError(null);

      // 1. Create order linked to reseller store
      const newOrder = await api.createOrder({
        orderSource: 'reseller_store',
        storeId: store.id,
        productId: selectedProduct.id,
        packageId: selectedPackage.id,
        customerName,
        customerEmail,
        customerPhone,
        customerInputNotes: customerNotes,
      });

      // 2. Submit payment details
      await api.submitPayment(newOrder.id, {
        channel: selectedChannel,
        claimedAmountBdt: selectedPackage.retailPriceBdt,
        transactionId: transactionId.trim(),
        senderPhoneOrAccount: customerPhone,
      });

      setOrderSuccess(newOrder);
    } catch (err: any) {
      setCheckoutError(err.message || 'Order submission failed.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-12">
        <div className="text-slate-500 font-medium text-sm animate-pulse">Loading reseller store...</div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 max-w-md text-center shadow-xs">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
            !
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Domain Not Configured or Unverified</h3>
          <p className="text-xs text-slate-600 mb-4">
            The domain or subdomain <strong className="font-mono text-slate-900">{subdomain}.digimarket.com</strong> is not verified, suspended, or unmapped. Access is prohibited until DNS and SSL are configured.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Visit Official Main Store
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Reseller Store Header & Branding */}
      <section className="bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-6 py-8 md:py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-xs text-indigo-600 font-semibold tracking-wider uppercase mb-1">
              Authorized Reseller Storefront · {store.subdomain}.ssdigitalbd.shop
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {store.storeName}
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Official digital licenses delivered with local support and warranty.
            </p>
          </div>

          {/* Reseller Support Details */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {store.supportPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> {store.supportPhone}
              </span>
            )}
            {store.supportWhatsapp && (
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> {store.supportWhatsapp}
              </span>
            )}
            {store.supportEmail && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-600" /> {store.supportEmail}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Catalog Grid */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900">Available Software & Subscriptions</h2>
          <p className="text-xs text-slate-500 mt-1">Directly fulfilled by authorized distribution partners.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((prod) => {
            const lowestPrice = prod.packages?.length
              ? Math.min(...prod.packages.map((pkg: any) => pkg.retailPriceBdt))
              : 0;

            return (
              <div
                key={prod.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden"
              >
                <div className="relative aspect-4/3 bg-slate-100 overflow-hidden border-b border-slate-100">
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      {prod.deliveryMethod.replace('_', ' ')} · {prod.packages?.length || 0} plans
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{prod.name}</h3>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">{prod.description}</p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Retail Price</span>
                      <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                        ৳{lowestPrice.toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedProduct(prod);
                        setSelectedPackage(prod.packages?.[0] || null);
                        setOrderSuccess(null);
                        setCheckoutError(null);
                        setTransactionId('');
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Order
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reseller Order Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500">Store: {store.storeName}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderSuccess ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Order Submitted to Reseller</h4>
                <p className="text-xs text-slate-600 mb-6 max-w-md mx-auto">
                  Order Number:{' '}
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {orderSuccess.orderNumber}
                  </span>
                  . The store owner will verify your payment details shortly.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      const num = orderSuccess.orderNumber;
                      setSelectedProduct(null);
                      onTrackOrder(num);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Track Status
                  </button>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePlaceResellerOrder} className="p-6 space-y-6">
                {checkoutError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    {checkoutError}
                  </div>
                )}

                {/* Duration */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    1. Select Duration
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {selectedProduct.packages?.map((pkg: any) => (
                      <button
                        type="button"
                        key={pkg.id}
                        onClick={() => setSelectedPackage(pkg)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedPackage?.id === pkg.id
                            ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-medium text-slate-600">{pkg.durationLabel}</div>
                        <div className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-1">
                          ৳{pkg.retailPriceBdt.toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    2. Customer Information
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Your Name</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Your Email</label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Email for credentials"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Your Phone</label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Invite/Special Notes</label>
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="e.g. email or profile name"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Reseller-Specific Payment Instructions */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2">
                    3. Reseller Payment Instructions ({store.storeName})
                  </label>

                  <div className="flex gap-2 mb-3">
                    {(['bkash', 'nagad', 'rocket'] as const).map((ch) => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => setSelectedChannel(ch)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md uppercase transition-all ${
                          selectedChannel === ch
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-indigo-200 text-indigo-800'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>

                  {/* Reseller Custom Payment Note */}
                  <div className="text-xs text-indigo-950 bg-white p-3 rounded-lg border border-indigo-200 mb-3 space-y-1">
                    <p className="font-medium">
                      {selectedChannel === 'bkash'
                        ? store.paymentInstructionsBkash || `bKash Personal: ${store.supportPhone}`
                        : selectedChannel === 'nagad'
                        ? store.paymentInstructionsNagad || `Nagad Personal: ${store.supportPhone}`
                        : store.paymentInstructionsRocket || `Rocket: ${store.supportPhone}`}
                    </p>
                    <p className="text-slate-600">
                      Payable: <strong className="font-mono text-slate-900">৳{selectedPackage?.retailPriceBdt.toFixed(2)}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Notice: This payment goes directly to reseller {store.storeName}. Enter the Transaction ID below.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Transaction ID (TxnID) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                      placeholder="e.g. 8K029LM89"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <span className="text-sm font-bold text-slate-900 font-mono">
                    Total: ৳{selectedPackage?.retailPriceBdt.toFixed(2)}
                  </span>
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
                  >
                    {submittingOrder ? 'Submitting...' : 'Submit Order & Payment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
