/**
 * Main Store Customer Portal
 * Real database-driven catalog, package selection, and Main Store checkout workflow.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { ShoppingBag, CheckCircle, ShieldCheck, Zap, ArrowRight, X } from 'lucide-react';

interface MainStoreProps {
  onTrackOrder: (orderNumber: string) => void;
}

export const MainStore: React.FC<MainStoreProps> = ({ onTrackOrder }) => {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Selected Product for Checkout Modal
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [transactionId, setTransactionId] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.getCatalog('main');
      setCategories(res.categories);
      setProducts(res.products);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCheckout = (product: any) => {
    setSelectedProduct(product);
    setSelectedPackage(product.packages?.[0] || null);
    setErrorMsg(null);
    setOrderSuccess(null);
    setTransactionId('');
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedPackage) return;
    if (!customerName || !customerEmail || !customerPhone) {
      setErrorMsg('Please fill in your name, email, and phone number.');
      return;
    }
    if (!transactionId.trim()) {
      setErrorMsg('Please provide the transaction ID after making payment.');
      return;
    }

    try {
      setSubmittingOrder(true);
      setErrorMsg(null);

      // Step 1: Create Order
      const newOrder = await api.createOrder({
        orderSource: 'main_store',
        productId: selectedProduct.id,
        packageId: selectedPackage.id,
        customerName,
        customerEmail,
        customerPhone,
        customerInputNotes: customerNotes,
      });

      // Step 2: Submit Payment
      await api.submitPayment(newOrder.id, {
        channel: selectedChannel,
        claimedAmountBdt: selectedPackage.retailPriceBdt,
        transactionId: transactionId.trim(),
        senderPhoneOrAccount: customerPhone,
      });

      setOrderSuccess(newOrder);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const filteredProducts =
    activeCategory === 'all'
      ? products
      : products.filter((p) => p.categoryId === activeCategory);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-slate-900 text-white overflow-hidden border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-4">
              <span>Verified Licenses</span>
              <span>·</span>
              <span>Fast Digital Delivery</span>
              <span>·</span>
              <span>B2B Reseller Network</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Genuine Digital Software & Cloud Subscriptions
            </h1>
            <p className="text-slate-300 text-base md:text-lg mb-8 max-w-xl leading-relaxed">
              Purchase authorized subscriptions for Canva Pro, ChatGPT Plus, CapCut Pro, IDM, and more with instant verification and guaranteed uptime.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#catalog"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                Browse Catalog <ArrowRight className="w-4 h-4" />
              </a>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Genuine
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" /> Instant Processing
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-800/50 aspect-16/9">
              <img
                src="/src/assets/images/hero_digital_products_1791884577566.jpg"
                alt="Digital Marketplace Software Suite"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog */}
      <section id="catalog" className="max-w-7xl mx-auto px-6 py-12">
        {/* Category Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Digital Product Catalog</h2>
            <p className="text-sm text-slate-500 mt-1">Select an authorized subscription to view options and pricing.</p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-lg">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Products
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            No products available in this category.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProducts.map((prod) => {
              const lowestPrice = prod.packages?.length
                ? Math.min(...prod.packages.map((pkg: any) => pkg.retailPriceBdt))
                : 0;

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden"
                >
                  <div className="relative aspect-4/3 bg-slate-100 overflow-hidden border-b border-slate-100">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                        <span>{prod.deliveryMethod.replace('_', ' ')}</span>
                        <span>·</span>
                        <span>{prod.packages?.length || 0} plans</span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 leading-snug">{prod.name}</h3>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                        {prod.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block">Starting from</span>
                        <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                          ৳{lowestPrice.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => openCheckout(prod)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Select Plan
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Checkout PDP Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500">Official Main Store Purchase & Delivery</p>
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
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Payment Details Submitted!</h4>
                <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
                  Your order reference is{' '}
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {orderSuccess.orderNumber}
                  </span>
                  . Verification is under review by our operations team.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      const num = orderSuccess.orderNumber;
                      setSelectedProduct(null);
                      onTrackOrder(num);
                    }}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Track Order Now
                  </button>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePlaceOrder} className="p-6 space-y-6">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    {errorMsg}
                  </div>
                )}

                {/* Step 1: Duration Plan Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    1. Choose Duration & Package
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                        <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-1">
                          ৳{pkg.retailPriceBdt.toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Customer Contact Info */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    2. Customer Information (For Delivery)
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Tanvir Ahmed"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Account Notes / Email for Invite</label>
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="e.g. Canva invite email"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3: Payment Instructions & Transaction Submission */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    3. Main Store Payment Instructions
                  </label>

                  <div className="flex gap-2 mb-3">
                    {(['bkash', 'nagad', 'rocket'] as const).map((ch) => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => setSelectedChannel(ch)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md uppercase transition-all ${
                          selectedChannel === ch
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 mb-3 space-y-1">
                    <p>
                      <strong>Account:</strong>{' '}
                      {selectedChannel === 'bkash'
                        ? '01711-000001 (bKash Merchant Payment)'
                        : selectedChannel === 'nagad'
                        ? '01711-000001 (Nagad Merchant Payment)'
                        : '01711-000001-9 (Rocket Merchant Payment)'}
                    </p>
                    <p>
                      <strong>Payable Amount:</strong>{' '}
                      <span className="font-mono font-bold text-slate-900">
                        ৳{selectedPackage?.retailPriceBdt.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Send payment using your mobile app and enter the Transaction ID below.
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
                      placeholder="e.g. 9J83KLOP2"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                {/* Footer Submit */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Total: <span className="text-base font-bold text-slate-900 font-mono">৳{selectedPackage?.retailPriceBdt.toFixed(2)}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
                  >
                    {submittingOrder ? 'Submitting...' : 'Confirm & Submit Order'}
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
