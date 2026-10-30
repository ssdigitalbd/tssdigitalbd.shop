/**
 * DigiMarket Customer Portal
 * Production My Services / My Orders Dashboard & Support Ticket Evidence Vault.
 * Section 14 Compliance: Authoritative Date Engine, Problem Reporting & Screenshot Evidence.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import {
  Package,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Paperclip,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  HelpCircle,
  UploadCloud,
  X,
  ChevronRight,
  User,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Copy,
  Check,
  Search,
} from 'lucide-react';

interface CustomerPortalProps {
  currentUser: any;
  onNavigateStore?: () => void;
  onAuthRequired?: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  currentUser,
  onNavigateStore,
  onAuthRequired,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'tickets'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected Order for Credentials Reveal Modal
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  // New Ticket Modal State
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<string>('Billing');
  const [ticketOrderNumber, setTicketOrderNumber] = useState<string>('');
  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketMessage, setTicketMessage] = useState<string>('');
  const [ticketFiles, setTicketFiles] = useState<Array<{ fileName: string; dataUrl: string; size: number }>>([]);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Customer Ticket Filters & Copy State
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState('all');
  const [copiedTicketId, setCopiedTicketId] = useState<string | null>(null);

  const handleCopyTicketId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedTicketId(id);
    setTimeout(() => setCopiedTicketId(null), 2000);
  };

  // Active Ticket Conversation View
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFiles, setReplyFiles] = useState<Array<{ fileName: string; dataUrl: string; size: number }>>([]);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Preview Image Modal
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ords, tcks] = await Promise.all([
        api.getCustomerOrders().catch(() => []),
        api.getTickets().catch(() => []),
      ]);
      setOrders(ords);
      setTickets(tcks);
    } catch (err) {
      console.error('Failed to load customer dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Open problem report modal from an order card
  const handleReportProblemForOrder = (order: any) => {
    setTicketOrderNumber(order.orderNumber);
    setTicketSubject(`Issue with ${order.product_name} (${order.orderNumber})`);
    setTicketCategory('Delivery');
    setTicketMessage('');
    setTicketFiles([]);
    setTicketError(null);
    setShowNewTicketModal(true);
  };

  // Handle file drop / select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isReply = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentFiles = isReply ? replyFiles : ticketFiles;
    if (currentFiles.length + files.length > 3) {
      const msg = 'You can upload a maximum of 3 screenshot files.';
      if (isReply) setReplyError(msg);
      else setTicketError(msg);
      return;
    }

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        const msg = `File "${file.name}" exceeds the 5MB limit.`;
        if (isReply) setReplyError(msg);
        else setTicketError(msg);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newFile = { fileName: file.name, dataUrl, size: file.size };
        if (isReply) {
          setReplyFiles((prev) => [...prev, newFile].slice(0, 3));
          setReplyError(null);
        } else {
          setTicketFiles((prev) => [...prev, newFile].slice(0, 3));
          setTicketError(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Submit Ticket
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      setTicketError('Please provide both a subject and a description of your issue.');
      return;
    }

    try {
      setTicketSubmitting(true);
      setTicketError(null);

      const created = await api.createTicket({
        category: ticketCategory,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        orderNumber: ticketOrderNumber.trim() || undefined,
        attachments: ticketFiles.map((f) => ({ fileName: f.fileName, dataUrl: f.dataUrl })),
      });

      setTickets((prev) => [created, ...prev]);
      setShowNewTicketModal(false);
      setTicketSubject('');
      setTicketMessage('');
      setTicketFiles([]);
      setSelectedTicket(created);
      setActiveTab('tickets');
    } catch (err: any) {
      setTicketError(err.message || 'Failed to submit support ticket.');
    } finally {
      setTicketSubmitting(false);
    }
  };

  // Submit Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    try {
      setReplySubmitting(true);
      setReplyError(null);

      const updated = await api.replyTicket(selectedTicket.id, {
        message: replyMessage.trim(),
        attachments: replyFiles.map((f) => ({ fileName: f.fileName, dataUrl: f.dataUrl })),
      });

      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setReplyMessage('');
      setReplyFiles([]);
    } catch (err: any) {
      setReplyError(err.message || 'Failed to send reply.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('billing')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Billing
        </span>
      );
    }
    if (cat.includes('delivery') || cat.includes('fulfillment') || cat.includes('credentials')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Delivery
        </span>
      );
    }
    if (cat.includes('account') || cat.includes('login') || cat.includes('auth')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Account
        </span>
      );
    }
    if (cat.includes('technical') || cat.includes('service') || cat.includes('warranty')) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Service / Technical
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        {category ? category.replace(/_/g, ' ') : 'General'}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active & Delivered
          </span>
        );
      case 'payment_submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Payment Submitted
          </span>
        );
      case 'delivery_in_progress':
      case 'queued_for_delivery':
      case 'admin_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Provisioning Service
          </span>
        );
      case 'payment_rejected':
      case 'admin_rejected':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" /> Order Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const getTicketStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Open
          </span>
        );
      case 'in_review':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            In Review
          </span>
        );
      case 'waiting_customer':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Waiting for Your Response
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-xs">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Customer Account Required</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
          Please sign in to access your authorized digital services, license credentials, renewal countdowns, and support ticket vault.
        </p>
        <button
          onClick={onAuthRequired}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Top Welcome & Summary Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-xs">
            {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'C'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{currentUser.fullName}</h1>
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Verified Customer
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {currentUser.email} {currentUser.phone ? `· ${currentUser.phone}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setTicketOrderNumber('');
              setTicketSubject('');
              setTicketMessage('');
              setTicketFiles([]);
              setTicketError(null);
              setShowNewTicketModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Open Support Ticket
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        <button
          onClick={() => {
            setActiveTab('orders');
            setSelectedTicket(null);
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          My Orders & Services
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-normal">
            {orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'tickets'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Support Tickets
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-normal">
            {tickets.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ORDERS & SERVICES (SECTION 14 COMPLIANCE) */}
      {activeTab === 'orders' && (
        <div>
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading your authoritative digital services...
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">No Orders Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                You haven't purchased any digital subscriptions yet. Browse our verified software catalog to get started.
              </p>
              {onNavigateStore && (
                <button
                  onClick={onNavigateStore}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Explore Digital Store
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all"
                >
                  {/* Card Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                          {order.orderNumber}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">
                          📦 Service: <span className="text-indigo-600">{order.service_name}</span>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(order.order_status)}
                    </div>
                  </div>

                  {/* Section 14 Authoritative Metadata Engine Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-5 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5 mb-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        📅 Purchase Date
                      </span>
                      <span className="font-semibold text-slate-900 block truncate">
                        {order.purchase_date
                          ? new Date(order.purchase_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5 mb-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        🚀 Service Start Date
                      </span>
                      <span className="font-semibold text-slate-900 block truncate">
                        {order.service_start_date === 'Pending Delivery'
                          ? 'Pending Delivery'
                          : new Date(order.service_start_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5 mb-1 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                        ⏳ Duration
                      </span>
                      <span className="font-semibold text-slate-900 block">
                        {order.service_duration}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5 mb-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                        ⌛ Expiry Date
                      </span>
                      <span
                        className={`font-semibold block truncate ${
                          order.expiry_date === 'Pending Delivery'
                            ? 'text-slate-500'
                            : 'text-indigo-600'
                        }`}
                      >
                        {order.expiry_date === 'Pending Delivery'
                          ? 'Pending Delivery'
                          : new Date(order.expiry_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                      </span>
                    </div>
                  </div>

                  {/* Status Strip & Action Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
                    <div className="flex flex-wrap items-center gap-4 text-slate-600">
                      <span>
                        Payment: <strong>{order.payment_status}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Fulfillment: <strong className="capitalize">{order.delivery_status.replace(/_/g, ' ')}</strong>
                      </span>
                      {order.support_ticket_status !== 'none' && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            Ticket: {order.support_ticket_status.replace('_', ' ')}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleReportProblemForOrder(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg font-medium transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Report a Problem
                      </button>

                      {order.order_status === 'completed' && (
                        <button
                          onClick={() => {
                            setSelectedOrderDetails(order);
                            setShowCredentials(false);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Delivery Instructions & Passcode
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPORT TICKETS & EVIDENCE VAULT */}
      {activeTab === 'tickets' && (
        <div>
          {selectedTicket ? (
            /* CONVERSATION THREAD VIEW */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Thread Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 mb-2.5"
                  >
                    ← Back to Support Tickets
                  </button>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <div className="flex items-center gap-1.5 bg-slate-200/80 text-slate-800 px-2.5 py-0.5 rounded-md font-mono text-xs font-bold border border-slate-300">
                      <span>{selectedTicket.id}</span>
                      <button
                        onClick={(e) => handleCopyTicketId(selectedTicket.id, e)}
                        className="text-slate-500 hover:text-slate-800 p-0.5"
                        title="Copy Ticket ID"
                      >
                        {copiedTicketId === selectedTicket.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    {getCategoryBadge(selectedTicket.category)}
                    {selectedTicket.orderNumber && (
                      <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        Order: {selectedTicket.orderNumber}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedTicket.subject}</h2>
                </div>

                <div className="flex items-center gap-3">
                  {getTicketStatusBadge(selectedTicket.status)}
                </div>
              </div>

              {/* Messages Area */}
              <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
                {selectedTicket.messages.map((msg: any) => {
                  const isCustomer = msg.senderRole === 'customer';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-xs font-bold text-slate-800">
                          {msg.senderName}
                        </span>
                        {!isCustomer && (
                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                            Support Staff
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-2xs whitespace-pre-wrap leading-relaxed ${
                          isCustomer
                            ? 'bg-indigo-600 text-white rounded-tr-xs'
                            : 'bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200'
                        }`}
                      >
                        {msg.message}

                        {/* Attachments inside bubble */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/20 flex flex-wrap gap-2">
                            {msg.attachments.map((att: any) => {
                              const attUrl = `/api/tickets/${selectedTicket.id}/attachments/${att.id}`;
                              return (
                                <button
                                  key={att.id}
                                  onClick={() => setPreviewAttachmentUrl(attUrl)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                    isCustomer
                                      ? 'bg-indigo-700/80 hover:bg-indigo-800 text-white'
                                      : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200'
                                  }`}
                                >
                                  <Paperclip className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[140px]">{att.originalName}</span>
                                  <Eye className="w-3 h-3 ml-1 opacity-70" />
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

              {/* Reply Box */}
              <div className="p-6 border-t border-slate-200 bg-slate-50">
                {selectedTicket.status === 'resolved' || selectedTicket.status === 'closed' ? (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      This ticket was marked as {selectedTicket.status}. Sending a message below will automatically reopen it.
                    </span>
                  </div>
                ) : null}

                <form onSubmit={handleSendReply}>
                  {/* Bengali Privacy Warning Banner */}
                  <div className="mb-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                    <div>
                      <strong className="font-semibold">গোপনীয়তা সতর্কবার্তা:</strong> দয়া করে আপনার ব্যাংক বা বিকাশ/নগদ পিন, পাসওয়ার্ড বা ব্যক্তিগত কোনো গোপনীয় তথ্য স্ক্রিনশটে শেয়ার করবেন না। কেবল সংশ্লিষ্ট এরর বা সমস্যার স্ক্রিনশট প্রদান করুন।
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply to our support staff..."
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all mb-3 resize-none"
                  />

                  {/* Attachment Previews */}
                  {replyFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {replyFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="truncate max-w-[120px]">{file.fileName}</span>
                          <button
                            type="button"
                            onClick={() => setReplyFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600 ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {replyError && (
                    <div className="mb-3 text-xs text-rose-600 font-medium">
                      {replyError}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium cursor-pointer transition-colors shadow-2xs">
                      <UploadCloud className="w-4 h-4 text-slate-500" />
                      Attach Screenshot (Max 3)
                      <input
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={(e) => handleFileSelect(e, true)}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={replySubmitting || !replyMessage.trim()}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {replySubmitting ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* TICKETS LIST VIEW */
            <div>
              {/* Controls Bar: Search, Category Filter, and New Ticket Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="Search by Ticket ID (e.g. TCK-...), subject, or order number..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={ticketCategoryFilter}
                    onChange={(e) => setTicketCategoryFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-700 shadow-2xs w-full sm:w-48"
                  >
                    <option value="all">All Categories</option>
                    <option value="Billing">Billing & Payment</option>
                    <option value="Delivery">Delivery & Credentials</option>
                    <option value="Account">Account & Access</option>
                    <option value="Service / Technical">Service & Technical</option>
                    <option value="Other">Other Inquiry</option>
                  </select>

                  <button
                    onClick={() => {
                      setTicketOrderNumber('');
                      setTicketSubject('');
                      setTicketMessage('');
                      setTicketFiles([]);
                      setTicketError(null);
                      setShowNewTicketModal(true);
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Open Ticket
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading your private support tickets...
                </div>
              ) : tickets.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-1">No Support Tickets Yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                    Need help with billing, credentials delivery, account setup, or warranty replacement? Create a ticket and our support staff will assist promptly.
                  </p>
                  <button
                    onClick={() => {
                      setTicketOrderNumber('');
                      setTicketSubject('');
                      setTicketMessage('');
                      setTicketFiles([]);
                      setTicketError(null);
                      setShowNewTicketModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Open New Ticket
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets
                    .filter((t) => {
                      if (ticketCategoryFilter !== 'all') {
                        const tc = (t.category || '').toLowerCase();
                        const fc = ticketCategoryFilter.toLowerCase();
                        if (fc === 'billing' && !tc.includes('billing')) return false;
                        if (fc === 'delivery' && !tc.includes('delivery') && !tc.includes('credentials') && !tc.includes('fulfillment')) return false;
                        if (fc === 'account' && !tc.includes('account') && !tc.includes('login') && !tc.includes('auth')) return false;
                        if (fc.includes('technical') && !tc.includes('service') && !tc.includes('technical') && !tc.includes('warranty')) return false;
                        if (fc === 'other' && !tc.includes('other')) return false;
                      }
                      if (ticketSearch) {
                        const q = ticketSearch.toLowerCase().trim();
                        return (
                          t.id.toLowerCase().includes(q) ||
                          (t.orderNumber && t.orderNumber.toLowerCase().includes(q)) ||
                          t.subject.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTicket(t)}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between gap-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-mono text-xs font-bold border border-slate-200">
                              <span>{t.id}</span>
                              <button
                                onClick={(e) => handleCopyTicketId(t.id, e)}
                                className="text-slate-400 hover:text-slate-700 p-0.5"
                                title="Copy Ticket ID"
                              >
                                {copiedTicketId === t.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            {getCategoryBadge(t.category)}
                            {t.orderNumber && (
                              <span className="text-xs font-mono font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                Order: {t.orderNumber}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mb-1">{t.subject}</h4>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {t.messages?.[t.messages.length - 1]?.message || 'No messages yet.'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right hidden sm:block">
                            <div className="text-[11px] text-slate-400 mb-1">
                              {new Date(t.updatedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            {getTicketStatusBadge(t.status)}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: DELIVERY CREDENTIALS REVEAL */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Delivery Instructions & Access</h3>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-medium">Service</span>
                <p className="text-sm font-bold text-slate-900">{selectedOrderDetails.service_name}</p>
                <span className="text-xs font-mono text-slate-500">Order: {selectedOrderDetails.orderNumber}</span>
              </div>

              {/* Secure Credentials Field */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600" />
                    Authorized Access Credentials / License Key
                  </span>
                  <button
                    onClick={() => setShowCredentials(!showCredentials)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    {showCredentials ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showCredentials ? 'Hide' : 'Reveal'}
                  </button>
                </div>

                <div className="font-mono text-xs bg-white p-3 rounded-lg border border-slate-200 select-all break-all text-slate-900 font-semibold">
                  {showCredentials ? (
                    selectedOrderDetails.fulfillment_payload || 'Credentials sent directly to your registered email.'
                  ) : (
                    '••••••••••••••••••••••••••••••••••••••••••••'
                  )}
                </div>
              </div>

              {/* Instructions */}
              {selectedOrderDetails.delivery_instructions && (
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-1">
                    Activation & Usage Instructions:
                  </span>
                  <p className="text-xs text-slate-600 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 whitespace-pre-wrap leading-relaxed">
                    {selectedOrderDetails.delivery_instructions}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: OPEN NEW SUPPORT TICKET */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Open Customer Support Ticket</h3>
              </div>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="py-4 space-y-4">
              {/* Bengali Privacy Warning Banner */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5">গোপনীয়তা ও নিরাপত্তা সংক্রান্ত সতর্কবার্তা:</strong>
                  দয়া করে আপনার ব্যাংক বা বিকাশ/নগদ পিন, পাসওয়ার্ড বা ব্যক্তিগত কোনো গোপনীয় তথ্য স্ক্রিনশটে শেয়ার করবেন না। কেবল সংশ্লিষ্ট এরর বা সমস্যার স্ক্রিনশট প্রদান করুন।
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Issue Category *
                </label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  <option value="Billing">Billing (Payment verification, invoice, or refund)</option>
                  <option value="Delivery">Delivery (Missing credentials, invalid license key, activation link)</option>
                  <option value="Account">Account (Password reset, profile settings, login access)</option>
                  <option value="Service / Technical">Service / Technical (Service not working, error prompt, renewal)</option>
                  <option value="Other">Other Inquiry (General question or marketplace assistance)</option>
                </select>
              </div>

              {/* Order Number (Optional or Pre-populated) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Associated Order Number (Optional)
                </label>
                <input
                  type="text"
                  value={ticketOrderNumber}
                  onChange={(e) => setTicketOrderNumber(e.target.value)}
                  placeholder="e.g. MAIN-261024-XXXX or RES-261024-XXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Please describe what happened, what device or browser you are using, and the exact error message..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Screenshot Evidence Vault */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Screenshot Evidence (Max 3 files, PNG/JPEG/WebP, up to 5MB each)
                  </label>
                  <span className="text-[11px] text-slate-400">{ticketFiles.length}/3 attached</span>
                </div>

                <label className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors block text-center">
                  <UploadCloud className="w-6 h-6 text-indigo-500 mb-1 mx-auto" />
                  <span className="text-xs font-medium text-slate-700">Click to upload screenshot</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, WebP or PDF</span>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => handleFileSelect(e, false)}
                    className="hidden"
                  />
                </label>

                {ticketFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ticketFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-indigo-50 text-indigo-900 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="truncate max-w-[140px] font-medium">{file.fileName}</span>
                        <button
                          type="button"
                          onClick={() => setTicketFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {ticketError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {ticketError}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ticketSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {ticketSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMAGE LIGHTBOX PREVIEW */}
      {previewAttachmentUrl && (
        <div
          onClick={() => setPreviewAttachmentUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-transparent">
            <button
              onClick={() => setPreviewAttachmentUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewAttachmentUrl}
              alt="Screenshot evidence preview"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
};
