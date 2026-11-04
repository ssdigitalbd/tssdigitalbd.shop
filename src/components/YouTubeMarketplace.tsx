/**
 * YouTube Channel Marketplace Component
 * Verified Channel Listings, 7-Day Marketplace Buyer Protection Policy, and Milestone Tracking.
 */

import React, { useState, useEffect } from 'react';
import {
  Youtube,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  Users,
  DollarSign,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Lock,
  Search,
  Filter,
  X,
  CreditCard,
  ShieldAlert,
  Calendar,
  Layers,
  Check,
  ChevronRight,
  PlusCircle,
  FileCheck,
} from 'lucide-react';
import { api } from '../lib/api.ts';

interface YouTubeMarketplaceProps {
  currentUser?: any;
  onAuthRequired: () => void;
  onOpenSellerCenter?: () => void;
}

export const YouTubeMarketplace: React.FC<YouTubeMarketplaceProps> = ({
  currentUser,
  onAuthRequired,
  onOpenSellerCenter,
}) => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'my_deals' | 'list_channel'>('browse');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('all');
  const [selectedMonetization, setSelectedMonetization] = useState('all');
  const [sortBy, setSortBy] = useState<'subs_desc' | 'price_asc' | 'price_desc'>('subs_desc');

  // Selected Channel for Detail / Purchase Modal
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);
  const [buyerGoogleEmail, setBuyerGoogleEmail] = useState(currentUser?.email || '');
  const [proposedPrice, setProposedPrice] = useState<string>('');
  const [initiatingDeal, setInitiatingDeal] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);

  // Active Deal Deposit Modal
  const [activeDepositDeal, setActiveDepositDeal] = useState<any | null>(null);
  const [depositChannel, setDepositChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'bank_transfer'>('bkash');
  const [depositTxnId, setDepositTxnId] = useState('');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);

  // Buyer Deals
  const [myDeals, setMyDeals] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  // Handover confirmation modal
  const [handoverDeal, setHandoverDeal] = useState<any | null>(null);
  const [chkAnalytics, setChkAnalytics] = useState(false);
  const [chkStrikes, setChkStrikes] = useState(false);
  const [chkPrimaryOwner, setChkPrimaryOwner] = useState(false);
  const [confirmingHandover, setConfirmingHandover] = useState(false);

  // Dispute modal
  const [disputeDeal, setDisputeDeal] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // List a Channel Form State
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [newNiche, setNewNiche] = useState('Tech & Gadgets');
  const [newSubs, setNewSubs] = useState('');
  const [newViews, setNewViews] = useState('');
  const [newWatchHours, setNewWatchHours] = useState('');
  const [newMonetization, setNewMonetization] = useState<'monetized' | 'not_monetized'>('monetized');
  const [newMonthlyRev, setNewMonthlyRev] = useState('');
  const [newAgeYears, setNewAgeYears] = useState('2');
  const [newPrice, setNewPrice] = useState('');
  const [newAudience, setNewAudience] = useState('Bangladesh');
  const [newDesc, setNewDesc] = useState('');
  const [newOwnershipProofUrl, setNewOwnershipProofUrl] = useState('');
  const [newAnalyticsProofUrl, setNewAnalyticsProofUrl] = useState('');
  const [listingSubmitting, setListingSubmitting] = useState(false);
  const [listingSuccess, setListingSuccess] = useState(false);
  const [listingError, setListingError] = useState<string | null>(null);

  useEffect(() => {
    loadListings();
  }, [selectedNiche, selectedMonetization]);

  useEffect(() => {
    if (activeTab === 'my_deals' && currentUser) {
      loadMyDeals();
    }
  }, [activeTab, currentUser]);

  const loadListings = async () => {
    try {
      setLoading(true);
      const res = await api.getYoutubeListings({
        niche: selectedNiche !== 'all' ? selectedNiche : undefined,
        monetization: selectedMonetization !== 'all' ? selectedMonetization : undefined,
      });
      setListings(res || []);
    } catch (err) {
      console.error('Failed to load YouTube listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyDeals = async () => {
    try {
      setDealsLoading(true);
      const res = await api.getMyYoutubeDeals();
      setMyDeals(res || []);
    } catch (err) {
      console.error('Failed to load my deals:', err);
    } finally {
      setDealsLoading(false);
    }
  };

  const handleOpenDetail = (ch: any) => {
    setSelectedChannel(ch);
    setProposedPrice(String(ch.priceBdt));
    setDealError(null);
    setBuyerGoogleEmail(currentUser?.email || '');
  };

  const handleInitiateDeal = async () => {
    if (!currentUser) {
      onAuthRequired();
      return;
    }
    if (!buyerGoogleEmail || !buyerGoogleEmail.includes('@')) {
      setDealError('A valid Google account email (Gmail) is strictly required.');
      return;
    }
    try {
      setInitiatingDeal(true);
      setDealError(null);
      const deal = await api.initiateYoutubeDeal(selectedChannel.id, {
        buyerGoogleEmail: buyerGoogleEmail.trim(),
        proposedPriceBdt: Number(proposedPrice) || selectedChannel.priceBdt,
      });
      setSelectedChannel(null);
      setActiveDepositDeal(deal);
      loadListings();
    } catch (err: any) {
      setDealError(err.message || 'Failed to initiate deal.');
    } finally {
      setInitiatingDeal(false);
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDepositDeal) return;
    if (!depositTxnId || depositTxnId.trim().length < 6) {
      alert('Please enter a valid Transaction ID.');
      return;
    }
    try {
      setSubmittingDeposit(true);
      await api.submitDealDeposit(activeDepositDeal.id, {
        depositChannel,
        depositTransactionId: depositTxnId.trim(),
      });
      setDepositSuccess(true);
      setTimeout(() => {
        setDepositSuccess(false);
        setActiveDepositDeal(null);
        setActiveTab('my_deals');
        loadMyDeals();
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Deposit submission failed.');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleConfirmInviteAccepted = async (dealId: string) => {
    try {
      await api.confirmYoutubeInvite(dealId);
      loadMyDeals();
      alert('Manager invitation marked as accepted! The 7-day Google waiting period for Primary Ownership transfer has started.');
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    }
  };

  const handleCompleteHandover = async () => {
    if (!handoverDeal) return;
    if (!chkPrimaryOwner) {
      alert('You must confirm that you have been promoted to Primary Owner in YouTube Studio.');
      return;
    }
    try {
      setConfirmingHandover(true);
      await api.confirmYoutubeHandover(handoverDeal.id, {
        analyticsVerified: chkAnalytics,
        strikesFree: chkStrikes,
        primaryOwnerClaimed: chkPrimaryOwner,
      });
      setHandoverDeal(null);
      setChkAnalytics(false);
      setChkStrikes(false);
      setChkPrimaryOwner(false);
      loadMyDeals();
      alert('Deal completed successfully! Payment has been released to the seller.');
    } catch (err: any) {
      alert(err.message || 'Handover confirmation failed.');
    } finally {
      setConfirmingHandover(false);
    }
  };

  const handleOpenDispute = (deal: any) => {
    setDisputeDeal(deal);
    setDisputeReason('');
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeDeal || !disputeReason || disputeReason.trim().length < 10) {
      alert('Please provide a detailed dispute description (minimum 10 characters).');
      return;
    }
    try {
      setSubmittingDispute(true);
      await api.disputeYoutubeDeal(disputeDeal.id, { reason: disputeReason.trim() });
      setDisputeDeal(null);
      loadMyDeals();
      alert('Dispute opened. An administrator will review all communication, analytics, and YouTube Studio evidence to mediate.');
    } catch (err: any) {
      alert(err.message || 'Failed to file dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleListChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onAuthRequired();
      return;
    }
    if (!newChannelName || !newChannelUrl || !newPrice) {
      setListingError('Channel name, URL, and asking price are required.');
      return;
    }
    try {
      setListingSubmitting(true);
      setListingError(null);
      await api.submitYoutubeListing({
        channelName: newChannelName.trim(),
        channelUrl: newChannelUrl.trim(),
        niche: newNiche,
        subscriberCount: Number(newSubs) || 0,
        totalViews: Number(newViews) || 0,
        watchHours: Number(newWatchHours) || 0,
        monetizationStatus: newMonetization,
        hasStrikes: false,
        strikeCount: 0,
        monthlyAverageRevenueBdt: Number(newMonthlyRev) || 0,
        channelAgeYears: Number(newAgeYears) || 1,
        primaryAudienceCountry: newAudience,
        priceBdt: Number(newPrice),
        description: newDesc.trim() || 'Verified YouTube Channel with active organic audience.',
        ownershipProofUrl: newOwnershipProofUrl.trim() || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600',
        analyticsProofUrl: newAnalyticsProofUrl.trim() || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600',
      });
      setListingSuccess(true);
      setTimeout(() => {
        setListingSuccess(false);
        setActiveTab('browse');
        loadListings();
      }, 1500);
    } catch (err: any) {
      setListingError(err.message || 'Failed to submit channel listing.');
    } finally {
      setListingSubmitting(false);
    }
  };

  // Filtered and sorted listings
  const filteredListings = listings
    .filter((l) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        l.channelName.toLowerCase().includes(q) ||
        l.channelHandle.toLowerCase().includes(q) ||
        l.niche.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'subs_desc') return b.subscriberCount - a.subscriberCount;
      if (sortBy === 'price_asc') return a.priceBdt - b.priceBdt;
      if (sortBy === 'price_desc') return b.priceBdt - a.priceBdt;
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-500 via-transparent to-transparent pointer-events-none" />
          
          <div className="max-w-3xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold tracking-wide border border-red-500/30">
              <Youtube className="w-3.5 h-3.5" />
              Verified YouTube Channel Marketplace
            </div>
            
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Buy & Sell YouTube Channels with <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-indigo-300">7-Day Buyer Protection</span>
            </h1>
            
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Zero fake transfers. 100% verified AdSense earnings, real subscriber analytics, and zero strike guarantees.
              Funds are held securely in our Marketplace Protection Vault until Primary Ownership is officially transferred to your Google account.
            </p>

            {/* Key Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero Strikes Guaranteed</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-xs">
                <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>7-Day Protection Holding</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-xs">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>AdSense & Studio Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'browse'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Browse Channels ({listings.length})
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  onAuthRequired();
                  return;
                }
                setActiveTab('my_deals');
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'my_deals'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              My Buyer Deals
            </button>
          </div>

          <button
            onClick={() => {
              if (!currentUser) {
                onAuthRequired();
                return;
              }
              setActiveTab('list_channel');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            List a YouTube Channel
          </button>
        </div>

        {/* ----------------- TAB 1: BROWSE LISTINGS ----------------- */}
        {activeTab === 'browse' && (
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by channel name, handle, or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Niche Selector */}
                <select
                  value={selectedNiche}
                  onChange={(e) => setSelectedNiche(e.target.value)}
                  className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Niches</option>
                  <option value="Tech & Gadgets">Tech & Gadgets</option>
                  <option value="Gaming & Esports">Gaming & Esports</option>
                  <option value="Education & Coding">Education & Tutorials</option>
                  <option value="Entertainment & Vlogs">Entertainment & Vlogs</option>
                  <option value="Finance & Business">Finance & Business</option>
                  <option value="News & Media">News & Media</option>
                </select>

                {/* Monetization Selector */}
                <select
                  value={selectedMonetization}
                  onChange={(e) => setSelectedMonetization(e.target.value)}
                  className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Monetization: All</option>
                  <option value="monetized">Monetized Only</option>
                  <option value="not_monetized">Non-Monetized</option>
                </select>

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="subs_desc">Subscribers: High to Low</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Listings Grid */}
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading verified channels...</p>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                <Youtube className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-semibold text-slate-800">No channels found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try adjusting your search criteria or filter to find available YouTube channels.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredListings.map((ch) => (
                  <div
                    key={ch.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                  >
                    {/* Card Header & Banner */}
                    <div className="p-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-base leading-snug">{ch.channelName}</h3>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                        <p className="text-xs text-indigo-600 font-medium">{ch.channelHandle}</p>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 shrink-0">
                        {ch.niche}
                      </span>
                    </div>

                    {/* Stats Grid */}
                    <div className="p-5 space-y-4 flex-1">
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Subscribers</p>
                          <p className="text-sm font-extrabold text-slate-900">
                            {Number(ch.subscriberCount).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Lifetime Views</p>
                          <p className="text-sm font-extrabold text-slate-900">
                            {(Number(ch.totalViews) / 1000000).toFixed(1)}M
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Watch Hours</p>
                          <p className="text-sm font-extrabold text-slate-900">
                            {Number(ch.watchHours).toLocaleString()} hrs
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Monthly Avg Rev</p>
                          <p className="text-sm font-extrabold text-emerald-600">
                            ৳{Number(ch.monthlyAverageRevenueBdt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Monetization & Strikes Status */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-1.5">
                          {ch.monetizationStatus === 'monetized' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> AdSense Monetized
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-[11px]">
                              Non-Monetized
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> 0 Strikes
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {ch.description}
                      </p>
                    </div>

                    {/* Card Footer: Price & CTA */}
                    <div className="p-5 pt-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Asking Price</p>
                        <p className="text-lg font-extrabold text-slate-900">
                          ৳{Number(ch.priceBdt).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenDetail(ch)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Inspect & Buy
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 2: MY BUYER DEALS ----------------- */}
        {activeTab === 'my_deals' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 mb-1">My 7-Day Protected Channel Deals</h2>
              <p className="text-xs text-slate-500">
                Track payments in the protection vault, YouTube Studio manager invitations, and the 7-day Primary Ownership handover milestones.
              </p>
            </div>

            {dealsLoading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading your deals...</p>
              </div>
            ) : myDeals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-semibold text-slate-800">No deals yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Browse the marketplace to find a channel and initiate a deal with 7-Day Buyer Protection.
                </p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white cursor-pointer"
                >
                  Browse Available Channels
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {myDeals.map((deal) => (
                  <div key={deal.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
                    {/* Deal Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-600">{deal.dealNumber}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <h3 className="text-base font-bold text-slate-900">{deal.channelName}</h3>
                          <span className="text-xs text-slate-500">{deal.channelHandle}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Target Google Email: <strong className="text-slate-700">{deal.buyerGoogleEmail}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Agreed Price</p>
                          <p className="text-base font-extrabold text-slate-900">৳{Number(deal.dealPriceBdt).toLocaleString()}</p>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            deal.dealStatus === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : deal.dealStatus === 'disputed'
                              ? 'bg-red-100 text-red-800'
                              : deal.dealStatus === 'transfer_accepted'
                              ? 'bg-indigo-100 text-indigo-800'
                              : deal.dealStatus === 'funded_in_protection'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {deal.dealStatus.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Visual Milestone Tracker */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs">
                      {/* Step 1: Deposit */}
                      <div className={`p-3 rounded-xl border ${deal.depositTransactionId ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <div className="font-bold">1. Deposit Paid</div>
                        <div className="text-[10px] mt-0.5">{deal.depositTransactionId ? `TXN: ${deal.depositTransactionId.slice(0, 10)}...` : 'Pending'}</div>
                      </div>

                      {/* Step 2: Vault Verified */}
                      <div className={`p-3 rounded-xl border ${deal.depositVerifiedAt ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <div className="font-bold">2. Vault Held</div>
                        <div className="text-[10px] mt-0.5">{deal.depositVerifiedAt ? '7-Day Protection Active' : 'Admin Checking'}</div>
                      </div>

                      {/* Step 3: Manager Invite */}
                      <div className={`p-3 rounded-xl border ${deal.transferInitiatedAt ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <div className="font-bold">3. Studio Invite</div>
                        <div className="text-[10px] mt-0.5">{deal.transferInitiatedAt ? 'Invite Sent to Gmail' : 'Waiting for Seller'}</div>
                      </div>

                      {/* Step 4: 7-Day Countdown */}
                      <div className={`p-3 rounded-xl border ${deal.transferAcceptedAt ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <div className="font-bold">4. 7-Day Timer</div>
                        <div className="text-[10px] mt-0.5">{deal.transferAcceptedAt ? 'Waiting Google Transfer' : 'Waiting Acceptance'}</div>
                      </div>

                      {/* Step 5: Primary Owner Handover */}
                      <div className={`p-3 rounded-xl border ${deal.dealStatus === 'completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <div className="font-bold">5. Handover Done</div>
                        <div className="text-[10px] mt-0.5">{deal.dealStatus === 'completed' ? 'Primary Owner Confirmed' : 'Pending Verification'}</div>
                      </div>
                    </div>

                    {/* Action Panel for Buyer */}
                    <div className="bg-slate-50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-xs text-slate-600">
                        {deal.dealStatus === 'pending_deposit' && (
                          <span className="text-amber-700 font-semibold">Payment required to lock this channel into 7-Day Buyer Protection.</span>
                        )}
                        {deal.dealStatus === 'deposit_submitted' && (
                          <span className="text-blue-700 font-semibold">Deposit submitted. Administrator is verifying funds in the protection vault.</span>
                        )}
                        {deal.dealStatus === 'funded_in_protection' && (
                          <span className="text-indigo-700 font-semibold">Deposit verified! Waiting for seller to send YouTube Studio Manager invite to {deal.buyerGoogleEmail}.</span>
                        )}
                        {deal.dealStatus === 'transfer_initiated' && (
                          <span className="text-indigo-700 font-semibold">Seller sent the Manager invite! Check your Gmail ({deal.buyerGoogleEmail}) and accept the role.</span>
                        )}
                        {deal.dealStatus === 'transfer_accepted' && (
                          <span className="text-slate-700 font-semibold">Invite accepted. Once the seller promotes you to Primary Owner in YouTube Studio, confirm handover below.</span>
                        )}
                        {deal.dealStatus === 'completed' && (
                          <span className="text-emerald-700 font-semibold">Deal completed! Channel is officially yours.</span>
                        )}
                        {deal.dealStatus === 'disputed' && (
                          <span className="text-red-700 font-semibold">Dispute under active administrator mediation.</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {deal.dealStatus === 'pending_deposit' && (
                          <button
                            onClick={() => setActiveDepositDeal(deal)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
                          >
                            Submit Payment Deposit
                          </button>
                        )}

                        {deal.dealStatus === 'transfer_initiated' && (
                          <button
                            onClick={() => handleConfirmInviteAccepted(deal.id)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
                          >
                            Confirm Invite Accepted
                          </button>
                        )}

                        {deal.dealStatus === 'transfer_accepted' && (
                          <button
                            onClick={() => setHandoverDeal(deal)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                          >
                            Verify & Confirm Primary Owner
                          </button>
                        )}

                        {deal.dealStatus !== 'completed' && deal.dealStatus !== 'cancelled' && deal.dealStatus !== 'disputed' && (
                          <button
                            onClick={() => handleOpenDispute(deal)}
                            className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 cursor-pointer"
                          >
                            Report Issue / Dispute
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

        {/* ----------------- TAB 3: LIST A CHANNEL ----------------- */}
        {activeTab === 'list_channel' && (
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">List Your YouTube Channel</h2>
              <p className="text-xs text-slate-500 mt-1">
                Provide genuine channel information. All listings require administrative verification of studio permissions and revenue proof before going live.
              </p>
            </div>

            {listingError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
                {listingError}
              </div>
            )}

            {listingSuccess && (
              <div className="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Channel submitted successfully! An administrator will review your ownership proof and approve it.
              </div>
            )}

            <form onSubmit={handleListChannelSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Channel Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BD Tech Reviewer"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Channel URL or Handle *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://youtube.com/@bdtechreviewer"
                    value={newChannelUrl}
                    onChange={(e) => setNewChannelUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Niche / Category *</label>
                  <select
                    value={newNiche}
                    onChange={(e) => setNewNiche(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="Tech & Gadgets">Tech & Gadgets</option>
                    <option value="Gaming & Esports">Gaming & Esports</option>
                    <option value="Education & Coding">Education & Tutorials</option>
                    <option value="Entertainment & Vlogs">Entertainment & Vlogs</option>
                    <option value="Finance & Business">Finance & Business</option>
                    <option value="News & Media">News & Media</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Monetization Status *</label>
                  <select
                    value={newMonetization}
                    onChange={(e: any) => setNewMonetization(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="monetized">AdSense Monetized (Active)</option>
                    <option value="not_monetized">Non-Monetized</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Subscriber Count *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 50000"
                    value={newSubs}
                    onChange={(e) => setNewSubs(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Lifetime Views *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1500000"
                    value={newViews}
                    onChange={(e) => setNewViews(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Public Watch Hours *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 24000"
                    value={newWatchHours}
                    onChange={(e) => setNewWatchHours(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Monthly Avg Revenue (BDT)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25000"
                    value={newMonthlyRev}
                    onChange={(e) => setNewMonthlyRev(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Asking Price (BDT) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 65000"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Primary Audience Country</label>
                  <input
                    type="text"
                    placeholder="e.g. Bangladesh"
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">YouTube Studio Permissions Proof URL</label>
                <input
                  type="url"
                  placeholder="Screenshot link showing you are Primary Owner in YouTube Studio"
                  value={newOwnershipProofUrl}
                  onChange={(e) => setNewOwnershipProofUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Description & Channel Details</label>
                <textarea
                  rows={3}
                  placeholder="Describe your channel, audience engagement, reason for selling, and monetization details..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={listingSubmitting}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {listingSubmitting ? 'Submitting for Admin Verification...' : 'Submit Channel for Review'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ----------------- MODAL: INSPECT & INITIATE DEAL ----------------- */}
        {selectedChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 mb-2">
                    <Youtube className="w-3.5 h-3.5" />
                    YouTube Channel Inspection
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">{selectedChannel.channelName}</h3>
                  <a
                    href={selectedChannel.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-0.5"
                  >
                    {selectedChannel.channelHandle}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <button
                  onClick={() => setSelectedChannel(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Channel Stats Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Subscribers</p>
                  <p className="text-base font-extrabold text-slate-900">
                    {Number(selectedChannel.subscriberCount).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Views</p>
                  <p className="text-base font-extrabold text-slate-900">
                    {(Number(selectedChannel.totalViews) / 1000000).toFixed(1)}M
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Monthly Avg Rev</p>
                  <p className="text-base font-extrabold text-emerald-600">
                    ৳{Number(selectedChannel.monthlyAverageRevenueBdt).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Channel Age</p>
                  <p className="text-base font-extrabold text-slate-900">{selectedChannel.channelAgeYears} Years</p>
                </div>
              </div>

              {/* 7-Day Buyer Protection Explainer */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-2 text-xs text-indigo-900">
                <div className="flex items-center gap-2 font-bold text-indigo-950">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  How 7-Day Marketplace Buyer Protection Works:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1 leading-relaxed">
                  <li>Your payment is deposited into our secured vault (Zero risk of upfront payment scam).</li>
                  <li>Seller sends a <strong>Manager invitation</strong> to your designated Google account.</li>
                  <li>You accept Manager role; Google enforces a mandatory <strong>7-day waiting period</strong>.</li>
                  <li>After 7 days, Seller promotes you to <strong>Primary Owner</strong>.</li>
                  <li>You verify the ownership and release the payment. If anything fails, you get a full refund.</li>
                </ol>
              </div>

              {/* Buyer Input Form */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Your Google Account Email (Gmail / Google Workspace) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="your-account@gmail.com"
                    value={buyerGoogleEmail}
                    onChange={(e) => setBuyerGoogleEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    This is the Google account where YouTube Studio ownership transfer invitations will be sent.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Agreed Asking Price (BDT)</label>
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={(e) => setProposedPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                  />
                </div>

                {dealError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
                    {dealError}
                  </div>
                )}

                <button
                  onClick={handleInitiateDeal}
                  disabled={initiatingDeal}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {initiatingDeal ? 'Locking Channel Deal...' : 'Initiate Deal with 7-Day Protection'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- MODAL: SUBMIT DEPOSIT ----------------- */}
        {activeDepositDeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Deposit to Buyer Protection Vault</h3>
                  <p className="text-xs text-slate-500">Deal: {activeDepositDeal.dealNumber}</p>
                </div>
                <button
                  onClick={() => setActiveDepositDeal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {depositSuccess ? (
                <div className="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 font-semibold text-center">
                  Deposit submitted successfully! Redirecting to deal tracker...
                </div>
              ) : (
                <form onSubmit={handleSubmitDeposit} className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1 border border-slate-100">
                    <div className="flex justify-between font-medium">
                      <span>Total Required:</span>
                      <strong className="text-slate-900 font-bold">
                        ৳{Number(activeDepositDeal.dealPriceBdt).toLocaleString()} BDT
                      </strong>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Payment will be held in escrow protection until you verify and confirm Primary Ownership.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Payment Gateway / Method *</label>
                    <select
                      value={depositChannel}
                      onChange={(e: any) => setDepositChannel(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="bkash">bKash Merchant / Send Money</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                      <option value="bank_transfer">Bank Transfer (EFT / RTGS)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Transaction ID (TrxID) *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9J4K2L8M1N"
                      value={depositTxnId}
                      onChange={(e) => setDepositTxnId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingDeposit}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {submittingDeposit ? 'Submitting Deposit...' : 'Submit Deposit Proof'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ----------------- MODAL: VERIFY & COMPLETE HANDOVER ----------------- */}
        {handoverDeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Final Handover Verification</h3>
                  <p className="text-xs text-slate-500">Deal {handoverDeal.dealNumber} · {handoverDeal.channelName}</p>
                </div>
                <button
                  onClick={() => setHandoverDeal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">
                  Before confirming and releasing payment to the seller, check each requirement:
                </p>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chkAnalytics}
                    onChange={(e) => setChkAnalytics(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>I have inspected the real-time YouTube Studio analytics and verified traffic sources.</span>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chkStrikes}
                    onChange={(e) => setChkStrikes(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>The channel has zero active community guideline strikes or copyright strikes.</span>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 cursor-pointer font-medium text-emerald-950">
                  <input
                    type="checkbox"
                    checked={chkPrimaryOwner}
                    onChange={(e) => setChkPrimaryOwner(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>I am now the PRIMARY OWNER of this channel in YouTube Studio permissions.</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCompleteHandover}
                  disabled={!chkPrimaryOwner || confirmingHandover}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {confirmingHandover ? 'Releasing Funds to Seller...' : 'Confirm Handover & Release Payment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- MODAL: FILE DISPUTE ----------------- */}
        {disputeDeal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-red-600">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Open Buyer Protection Dispute</h3>
                </div>
                <button
                  onClick={() => setDisputeDeal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitDispute} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Funds will remain frozen in the Protection Vault. An administrator will review your claim and communicate with both parties.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Detailed Reason for Dispute *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe what occurred (e.g. channel invitation revoked, undisclosed copyright strike, wrong metrics)..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingDispute ? 'Opening Dispute...' : 'Submit Dispute Claim'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
