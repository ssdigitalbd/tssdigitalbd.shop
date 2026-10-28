/**
 * Universal Order Tracking Modal & Customer Delivery Vault
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { Search, CheckCircle, Clock, Key, Copy, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface OrderTrackerModalProps {
  initialOrderNumber?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  initialOrderNumber = '',
  isOpen,
  onClose,
}) => {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [orderData, setOrderData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialOrderNumber) {
      setOrderNumber(initialOrderNumber);
      fetchOrder(initialOrderNumber);
    }
  }, [initialOrderNumber, isOpen]);

  const fetchOrder = async (num: string) => {
    if (!num.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOrder(num.trim().toUpperCase());
      setOrderData(data);
    } catch (err: any) {
      setError(err.message || 'Order not found.');
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(orderNumber);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const order = orderData?.order;
  const delivery = orderData?.delivery;
  const submission = orderData?.submissions?.[0];

  const steps = [
    { key: 'payment_submitted', label: 'Payment Submitted' },
    { key: 'payment_verified', label: 'Payment Verified' },
    { key: 'admin_approved', label: 'Admin Approved' },
    { key: 'completed', label: 'Delivered' },
  ];

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    if (order.orderStatus === 'completed') return 3;
    if (order.orderStatus === 'admin_approved' || order.orderStatus === 'queued_for_delivery') return 2;
    if (order.orderStatus === 'pending_admin_approval' || order.orderStatus === 'payment_verified') return 1;
    return 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900">Order Tracking & Delivery Vault</h3>
            <p className="text-xs text-slate-500">Real-time status tracking for customer orders</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                placeholder="Enter Order Number (e.g. MAIN-261013-ABC12)"
                className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
            >
              {loading ? 'Searching...' : 'Track'}
            </button>
          </form>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              {error}
            </div>
          )}

          {order && (
            <div className="space-y-6">
              {/* Order Overview Header */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 font-mono block">Order Reference</span>
                  <span className="text-base font-bold text-slate-900 font-mono">{order.orderNumber}</span>
                  <div className="text-xs text-slate-600 mt-1">
                    {order.snapshotProductName} · {order.snapshotPackageName}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Total Retail</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    ৳{order.snapshotRetailPriceBdt.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Source: {order.orderSource.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Progress Timeline */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Order Progression Timeline
                </label>
                <div className="grid grid-cols-4 gap-2 relative">
                  {steps.map((step, idx) => {
                    const currentIdx = getCurrentStepIndex();
                    const isDone = idx <= currentIdx && order.orderStatus !== 'payment_rejected' && order.orderStatus !== 'admin_rejected';
                    return (
                      <div key={step.key} className="text-center">
                        <div
                          className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                            isDone ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[11px] font-medium block leading-tight ${isDone ? 'text-slate-900' : 'text-slate-400'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {order.orderStatus === 'wallet_pending' && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    <strong>Reseller Balance Pending:</strong> Your payment was verified by the reseller, but wholesale cost processing is currently held pending store top-up.
                  </div>
                )}

                {order.orderStatus === 'payment_rejected' && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    <strong>Payment Rejected:</strong> {order.rejectionReason || 'Invalid reference ID provided.'}
                  </div>
                )}

                {order.orderStatus === 'admin_rejected' && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    <strong>Order Cancelled by Admin:</strong> {order.rejectionReason}
                  </div>
                )}
              </div>

              {/* Delivery Vault (Shown when Completed) */}
              {order.orderStatus === 'completed' && delivery && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Delivery Vault · Authorized Fulfillment Payload
                  </div>

                  {delivery.fulfillmentPayload && (
                    <div className="mt-3">
                      <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                        License Key / Account Credentials
                      </label>
                      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-emerald-200">
                        <pre className="font-mono text-xs text-slate-900 flex-1 whitespace-pre-wrap break-all">
                          {delivery.fulfillmentPayload}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(delivery.fulfillmentPayload)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      {copied && (
                        <span className="text-[11px] text-emerald-700 font-medium block mt-1">Copied to clipboard!</span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 text-xs text-emerald-950 bg-white/70 p-3 rounded-lg">
                    <strong>Instructions:</strong> {delivery.instructionsForCustomer}
                  </div>
                </div>
              )}

              {/* Payment Submission Details */}
              {submission && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-1">
                  <div className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Recorded Payment Submission
                  </div>
                  <div>
                    <strong>Channel:</strong> {submission.channel.toUpperCase()}
                  </div>
                  <div>
                    <strong>Transaction ID:</strong> <span className="font-mono">{submission.transactionId}</span>
                  </div>
                  <div>
                    <strong>Claimed Amount:</strong> ৳{submission.claimedAmountBdt.toFixed(2)}
                  </div>
                  <div>
                    <strong>Verification Status:</strong>{' '}
                    <span className="capitalize font-medium">{submission.verificationStatus.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
