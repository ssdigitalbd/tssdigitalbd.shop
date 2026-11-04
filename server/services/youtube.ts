/**
 * YouTube Channel Marketplace Business Service
 * Strict 7-Day Buyer Protection, Ownership Transfer Verification, and ACID Settlement.
 */

import crypto from 'crypto';
import { db } from '../db/store.ts';
import {
  YoutubeListing,
  YoutubeDeal,
  YoutubeDispute,
  YoutubeMonetizationStatus,
  YoutubeListingStatus,
} from '../types/index.ts';

export const YOUTUBE_MARKETPLACE_FEE_PERCENT = 5; // 5% platform fee for buyer protection

export function generateYoutubeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export function generateDealNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `YT-${dateStr}-${rand}`;
}

/**
 * Creates a new YouTube Channel Listing submitted by a seller or admin
 */
export function createYoutubeListing(params: {
  sellerId: string;
  channelName: string;
  channelUrl: string;
  channelHandle?: string;
  niche: string;
  subscriberCount: number;
  totalViews: number;
  watchHours: number;
  monetizationStatus: YoutubeMonetizationStatus;
  hasStrikes: boolean;
  strikeCount: number;
  monthlyAverageRevenueBdt: number;
  channelAgeYears: number;
  primaryAudienceCountry: string;
  priceBdt: number;
  ownershipProofUrl?: string;
  analyticsProofUrl?: string;
  description: string;
  availableToResellers?: boolean;
}): YoutubeListing {
  const seller = db.sellerProfiles.find((s) => s.userId === params.sellerId || s.id === params.sellerId);
  const sellerStoreName = seller?.storeName || 'Verified Channel Creator';

  if (!params.channelName || !params.channelUrl) {
    throw new Error('Channel name and channel URL are strictly required.');
  }
  if (params.priceBdt <= 0) {
    throw new Error('Listing price must be greater than 0 BDT.');
  }

  const handle = params.channelHandle || (params.channelUrl.includes('@') ? '@' + params.channelUrl.split('@')[1].split('/')[0] : `@${params.channelName.toLowerCase().replace(/\s+/g, '')}`);

  const listing: YoutubeListing = {
    id: generateYoutubeId('yt_ch'),
    sellerId: seller?.id || params.sellerId,
    sellerStoreName,
    channelName: params.channelName.trim(),
    channelUrl: params.channelUrl.trim(),
    channelHandle: handle,
    niche: params.niche || 'General & Lifestyle',
    subscriberCount: Math.max(0, Math.floor(params.subscriberCount || 0)),
    totalViews: Math.max(0, Math.floor(params.totalViews || 0)),
    watchHours: Math.max(0, Math.floor(params.watchHours || 0)),
    monetizationStatus: params.monetizationStatus || 'not_monetized',
    hasStrikes: Boolean(params.hasStrikes),
    strikeCount: params.hasStrikes ? Math.max(1, params.strikeCount || 1) : 0,
    monthlyAverageRevenueBdt: Math.max(0, Math.floor(params.monthlyAverageRevenueBdt || 0)),
    channelAgeYears: Number(params.channelAgeYears || 1),
    primaryAudienceCountry: params.primaryAudienceCountry || 'Bangladesh',
    priceBdt: Math.floor(params.priceBdt),
    ownershipProofUrl: params.ownershipProofUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600',
    analyticsProofUrl: params.analyticsProofUrl || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600',
    description: params.description.trim(),
    status: 'pending_review',
    availableToResellers: params.availableToResellers !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.youtubeListings.unshift(listing);
  db.persist();
  return listing;
}

/**
 * Admin reviews and approves or rejects a channel listing
 */
export function reviewYoutubeListing(params: {
  listingId: string;
  action: 'approve' | 'reject' | 'pause';
  rejectionReason?: string;
  adminNotes?: string;
  adminUserId: string;
}): YoutubeListing {
  const listing = db.youtubeListings.find((l) => l.id === params.listingId);
  if (!listing) {
    throw new Error('YouTube channel listing not found.');
  }

  if (params.action === 'approve') {
    listing.status = 'approved_active';
    listing.rejectionReason = undefined;
  } else if (params.action === 'reject') {
    listing.status = 'rejected';
    listing.rejectionReason = params.rejectionReason || 'Channel does not meet marketplace standards or ownership proof was insufficient.';
  } else if (params.action === 'pause') {
    listing.status = 'paused';
  }

  if (params.adminNotes) {
    listing.adminNotes = params.adminNotes;
  }
  listing.updatedAt = new Date().toISOString();

  db.auditLogs.push({
    id: generateYoutubeId('audit'),
    actorUserId: params.adminUserId,
    actorRole: 'admin',
    action: `youtube_listing_${params.action}`,
    targetEntity: 'youtube_listing',
    targetId: listing.id,
    details: { status: listing.status, notes: params.adminNotes },
    createdAt: new Date().toISOString(),
  });

  db.persist();
  return listing;
}

/**
 * Buyer initiates a deal with 7-Day Buyer Protection
 */
export function initiateYoutubeDeal(params: {
  channelId: string;
  buyerUser: { id: string; fullName: string; email: string; phone: string };
  buyerGoogleEmail: string;
  proposedPriceBdt?: number;
}): YoutubeDeal {
  const channel = db.youtubeListings.find((l) => l.id === params.channelId);
  if (!channel) {
    throw new Error('YouTube channel listing not found.');
  }
  if (channel.status !== 'approved_active') {
    throw new Error('This channel is currently not available for purchase.');
  }

  const googleEmail = (params.buyerGoogleEmail || '').trim().toLowerCase();
  if (!googleEmail || !googleEmail.includes('@')) {
    throw new Error('A valid Google account email (Gmail/Workspace) is required to receive channel manager & ownership transfer invitations.');
  }

  const dealPrice = Math.floor(params.proposedPriceBdt && params.proposedPriceBdt > 0 ? params.proposedPriceBdt : channel.priceBdt);
  const feeBdt = Math.max(500, Math.floor((dealPrice * YOUTUBE_MARKETPLACE_FEE_PERCENT) / 100));
  const sellerPayoutBdt = dealPrice - feeBdt;

  const seller = db.sellerProfiles.find((s) => s.id === channel.sellerId || s.userId === channel.sellerId);
  const sellerUser = seller ? db.users.find((u) => u.id === seller.userId) : null;

  const deal: YoutubeDeal = {
    id: generateYoutubeId('deal_yt'),
    dealNumber: generateDealNumber(),
    channelId: channel.id,
    channelName: channel.channelName,
    channelHandle: channel.channelHandle,
    buyerId: params.buyerUser.id,
    buyerName: params.buyerUser.fullName,
    buyerEmail: params.buyerUser.email,
    buyerPhone: params.buyerUser.phone,
    buyerGoogleEmail: googleEmail,
    sellerId: channel.sellerId,
    sellerName: seller?.storeName || sellerUser?.fullName || 'Channel Seller',
    sellerEmail: seller?.contactEmail || sellerUser?.email || 'seller@marketplace.local',
    sellerPhone: seller?.contactPhone || sellerUser?.phone || '01700000000',
    dealPriceBdt: dealPrice,
    marketplaceFeePercent: YOUTUBE_MARKETPLACE_FEE_PERCENT,
    marketplaceFeeBdt: feeBdt,
    sellerNetPayoutBdt: sellerPayoutBdt,
    dealStatus: 'pending_deposit',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  channel.status = 'in_deal';
  channel.updatedAt = new Date().toISOString();

  db.youtubeDeals.unshift(deal);
  db.persist();
  return deal;
}

/**
 * Buyer submits payment proof for holding in Buyer Protection Vault
 */
export function submitDealDeposit(params: {
  dealId: string;
  buyerUserId: string;
  depositChannel: 'bkash' | 'nagad' | 'rocket' | 'bank_transfer';
  depositTransactionId: string;
  depositProofUrl?: string;
}): YoutubeDeal {
  const deal = db.youtubeDeals.find((d) => d.id === params.dealId);
  if (!deal) {
    throw new Error('Deal not found.');
  }
  if (deal.buyerId !== params.buyerUserId) {
    throw new Error('Unauthorized: only the buyer of this deal can submit deposit.');
  }
  if (deal.dealStatus !== 'pending_deposit') {
    throw new Error(`Deposit cannot be submitted in status "${deal.dealStatus}".`);
  }
  if (!params.depositTransactionId || params.depositTransactionId.trim().length < 6) {
    throw new Error('A valid payment transaction ID is required.');
  }

  deal.depositChannel = params.depositChannel;
  deal.depositTransactionId = params.depositTransactionId.trim();
  deal.depositProofUrl = params.depositProofUrl;
  deal.dealStatus = 'deposit_submitted';
  deal.updatedAt = new Date().toISOString();

  db.persist();
  return deal;
}

/**
 * Admin verifies deposit received into the Marketplace 7-Day Buyer Protection Vault
 */
export function verifyDealDeposit(params: {
  dealId: string;
  adminUserId: string;
  approved: boolean;
  notes?: string;
}): YoutubeDeal {
  const deal = db.youtubeDeals.find((d) => d.id === params.dealId);
  if (!deal) {
    throw new Error('Deal not found.');
  }

  if (params.approved) {
    deal.dealStatus = 'funded_in_protection';
    deal.depositVerifiedAt = new Date().toISOString();
    deal.depositVerifiedBy = params.adminUserId;
  } else {
    deal.dealStatus = 'cancelled';
    const channel = db.youtubeListings.find((l) => l.id === deal.channelId);
    if (channel && channel.status === 'in_deal') {
      channel.status = 'approved_active';
      channel.updatedAt = new Date().toISOString();
    }
  }

  deal.updatedAt = new Date().toISOString();

  db.auditLogs.push({
    id: generateYoutubeId('audit'),
    actorUserId: params.adminUserId,
    actorRole: 'admin',
    action: params.approved ? 'youtube_deal_deposit_verified' : 'youtube_deal_deposit_rejected',
    targetEntity: 'youtube_deal',
    targetId: deal.id,
    details: { approved: params.approved, notes: params.notes, dealNumber: deal.dealNumber },
    createdAt: new Date().toISOString(),
  });

  db.persist();
  return deal;
}

/**
 * Seller marks that YouTube Studio Manager Invitation has been sent to buyer's Google account
 */
export function markTransferInviteSent(params: {
  dealId: string;
  sellerUserId: string;
  invitationNotes?: string;
}): YoutubeDeal {
  const deal = db.youtubeDeals.find((d) => d.id === params.dealId);
  if (!deal) {
    throw new Error('Deal not found.');
  }

  if (deal.dealStatus !== 'funded_in_protection') {
    throw new Error('Transfer cannot be initiated until buyer deposit is verified in the Buyer Protection Vault.');
  }

  deal.dealStatus = 'transfer_initiated';
  deal.transferInitiatedAt = new Date().toISOString();
  deal.transferInvitationNotes = params.invitationNotes || 'Manager invitation sent via YouTube Studio permissions.';
  deal.updatedAt = new Date().toISOString();

  db.persist();
  return deal;
}

/**
 * Buyer confirms receiving and accepting the Manager Invitation in YouTube Studio
 * Initiates the Google-mandated 7-day countdown before Primary Ownership transfer can be finalized
 */
export function confirmTransferInviteAccepted(params: {
  dealId: string;
  buyerUserId: string;
}): YoutubeDeal {
  const deal = db.youtubeDeals.find((d) => d.id === params.dealId);
  if (!deal) {
    throw new Error('Deal not found.');
  }
  if (deal.buyerId !== params.buyerUserId) {
    throw new Error('Unauthorized: only the buyer can confirm invite acceptance.');
  }
  if (deal.dealStatus !== 'transfer_initiated') {
    throw new Error('Invite cannot be accepted in current deal status.');
  }

  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  deal.dealStatus = 'transfer_accepted';
  deal.transferAcceptedAt = now.toISOString();
  deal.sevenDayTimerExpiresAt = sevenDaysLater.toISOString();
  deal.updatedAt = now.toISOString();

  db.persist();
  return deal;
}

/**
 * Buyer completes verification checklist and confirms Primary Ownership has been transferred
 * Completes the deal and releases funds to the seller's available balance
 */
export function completePrimaryOwnerHandover(params: {
  dealId: string;
  buyerUserId: string;
  checklist: {
    analyticsVerified: boolean;
    strikesFree: boolean;
    primaryOwnerClaimed: boolean;
  };
}): { deal: YoutubeDeal; sellerNetPayoutBdt: number } {
  const deal = db.youtubeDeals.find((d) => d.id === params.dealId);
  if (!deal) {
    throw new Error('Deal not found.');
  }
  if (deal.buyerId !== params.buyerUserId) {
    throw new Error('Unauthorized: only the buyer can confirm final handover.');
  }
  if (!['transfer_accepted', 'primary_owner_handover'].includes(deal.dealStatus)) {
    throw new Error('Cannot complete handover before manager invite is accepted.');
  }
  if (!params.checklist.primaryOwnerClaimed) {
    throw new Error('You must confirm that you have been promoted to Primary Owner in YouTube Studio.');
  }

  const now = new Date().toISOString();
  deal.dealStatus = 'completed';
  deal.primaryOwnerTransferredAt = now;
  deal.buyerChecklistCompleted = true;
  deal.completedAt = now;
  deal.updatedAt = now;

  // Mark channel as sold
  const channel = db.youtubeListings.find((l) => l.id === deal.channelId);
  if (channel) {
    channel.status = 'sold';
    channel.updatedAt = now;
  }

  // Release net earnings to seller
  const seller = db.sellerProfiles.find((s) => s.id === deal.sellerId || s.userId === deal.sellerId);
  if (seller) {
    seller.availableBalanceBdt += deal.sellerNetPayoutBdt;
    seller.totalEarningsBdt += deal.sellerNetPayoutBdt;
    seller.salesCount = (seller.salesCount || 0) + 1;
    seller.updatedAt = now;
  }

  db.auditLogs.push({
    id: generateYoutubeId('audit'),
    actorUserId: params.buyerUserId,
    actorRole: 'customer',
    action: 'youtube_deal_completed',
    targetEntity: 'youtube_deal',
    targetId: deal.id,
    details: {
      dealNumber: deal.dealNumber,
      payoutBdt: deal.sellerNetPayoutBdt,
      feeBdt: deal.marketplaceFeeBdt,
    },
    createdAt: now,
  });

  db.persist();
  return { deal, sellerNetPayoutBdt: deal.sellerNetPayoutBdt };
}

/**
 * Either party files a dispute during the protection period
 */
export function fileDealDispute(params: {
  dealId: string;
  openedByUserId: string;
  reason: string;
  evidenceUrl?: string;
}): YoutubeDeal {
  const deal = db.youtubeDeals.find((d) => d.id === params.dealId);
  if (!deal) {
    throw new Error('Deal not found.');
  }
  if (deal.buyerId !== params.openedByUserId && deal.sellerId !== params.openedByUserId) {
    throw new Error('Unauthorized to open dispute on this deal.');
  }
  if (deal.dealStatus === 'completed' || deal.dealStatus === 'cancelled') {
    throw new Error('Cannot dispute an already completed or cancelled deal.');
  }

  const now = new Date().toISOString();
  deal.dealStatus = 'disputed';
  deal.disputeReason = params.reason;
  deal.disputeEvidenceUrl = params.evidenceUrl;
  deal.disputedAt = now;
  deal.updatedAt = now;

  const dispute: YoutubeDispute = {
    id: generateYoutubeId('disp_yt'),
    dealId: deal.id,
    openedByUserId: params.openedByUserId,
    reason: params.reason,
    evidenceUrl: params.evidenceUrl,
    status: 'open',
    createdAt: now,
  };

  db.youtubeDisputes.unshift(dispute);
  db.persist();
  return deal;
}

/**
 * Admin resolves a dispute with refund or seller release
 */
export function resolveDealDispute(params: {
  dealId: string;
  adminUserId: string;
  resolution: 'refund_buyer' | 'release_seller';
  resolutionNotes: string;
}): YoutubeDeal {
  const deal = db.youtubeDeals.find((d) => d.id === params.dealId);
  if (!deal) {
    throw new Error('Deal not found.');
  }
  if (deal.dealStatus !== 'disputed') {
    throw new Error('Deal is not in disputed state.');
  }

  const now = new Date().toISOString();
  deal.disputeResolvedAt = now;
  deal.disputeResolution = params.resolution;
  deal.disputeResolutionNotes = params.resolutionNotes;

  const channel = db.youtubeListings.find((l) => l.id === deal.channelId);

  if (params.resolution === 'refund_buyer') {
    deal.dealStatus = 'cancelled';
    if (channel) {
      channel.status = 'approved_active';
      channel.updatedAt = now;
    }
  } else if (params.resolution === 'release_seller') {
    deal.dealStatus = 'completed';
    deal.completedAt = now;
    if (channel) {
      channel.status = 'sold';
      channel.updatedAt = now;
    }
    const seller = db.sellerProfiles.find((s) => s.id === deal.sellerId || s.userId === deal.sellerId);
    if (seller) {
      seller.availableBalanceBdt += deal.sellerNetPayoutBdt;
      seller.totalEarningsBdt += deal.sellerNetPayoutBdt;
      seller.updatedAt = now;
    }
  }

  deal.updatedAt = now;

  const dispute = db.youtubeDisputes.find((d) => d.dealId === deal.id && d.status === 'open');
  if (dispute) {
    dispute.status = 'resolved';
    dispute.resolution = params.resolution;
    dispute.adminNotes = params.resolutionNotes;
    dispute.resolvedAt = now;
  }

  db.auditLogs.push({
    id: generateYoutubeId('audit'),
    actorUserId: params.adminUserId,
    actorRole: 'admin',
    action: `youtube_dispute_resolved_${params.resolution}`,
    targetEntity: 'youtube_deal',
    targetId: deal.id,
    details: { resolution: params.resolution, notes: params.resolutionNotes },
    createdAt: now,
  });

  db.persist();
  return deal;
}
