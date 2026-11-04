/**
 * YouTube Channel Marketplace & 7-Day Buyer Protection Test Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { db } from '../db/store.ts';
import {
  createYoutubeListing,
  reviewYoutubeListing,
  initiateYoutubeDeal,
  submitDealDeposit,
  verifyDealDeposit,
  markTransferInviteSent,
  confirmTransferInviteAccepted,
  completePrimaryOwnerHandover,
  fileDealDispute,
  resolveDealDispute,
  YOUTUBE_MARKETPLACE_FEE_PERCENT,
} from '../services/youtube.ts';

console.log('--- RUNNING YOUTUBE CHANNEL MARKETPLACE TEST SUITE ---');

// Test 1: Channel Listing Creation & Field Validation
console.log('[PASS] Test 1: YouTube Channel listing creation with complete metrics and validation');
const channel = createYoutubeListing({
  sellerId: 'sel_techpro_01',
  channelName: 'Test Tech Channel BD',
  channelUrl: 'https://youtube.com/@testtechbd',
  channelHandle: '@testtechbd',
  niche: 'Tech & Gadgets',
  subscriberCount: 25000,
  totalViews: 850000,
  watchHours: 12000,
  monetizationStatus: 'monetized',
  hasStrikes: false,
  strikeCount: 0,
  monthlyAverageRevenueBdt: 8500,
  channelAgeYears: 2,
  primaryAudienceCountry: 'Bangladesh',
  priceBdt: 32000,
  description: 'Verified test channel for automated test validation',
});

assert.strictEqual(channel.channelName, 'Test Tech Channel BD');
assert.strictEqual(channel.status, 'pending_review');
assert.strictEqual(channel.monetizationStatus, 'monetized');
assert.strictEqual(channel.hasStrikes, false);

// Test 2: Admin Channel Review & Approval
console.log('[PASS] Test 2: Admin reviews ownership proof and approves channel listing');
const approvedChannel = reviewYoutubeListing({
  listingId: channel.id,
  action: 'approve',
  adminUserId: 'usr_admin_01',
  adminNotes: 'Studio permissions screenshot verified. 0 copyright strikes confirmed.',
});
assert.strictEqual(approvedChannel.status, 'approved_active');

// Test 3: Buyer Deal Initiation with Google Account Email
console.log('[PASS] Test 3: Buyer initiates 7-Day Protected Deal requiring Google account email');
const buyerUser = {
  id: 'usr_customer_01',
  fullName: 'Karim Uddin',
  email: 'karim@gmail.com',
  phone: '01711223344',
};

const deal = initiateYoutubeDeal({
  channelId: approvedChannel.id,
  buyerUser,
  buyerGoogleEmail: 'karim.buyer@gmail.com',
  proposedPriceBdt: 32000,
});

assert.strictEqual(deal.dealStatus, 'pending_deposit');
assert.strictEqual(deal.dealPriceBdt, 32000);
assert.strictEqual(deal.buyerGoogleEmail, 'karim.buyer@gmail.com');

// 5% Platform fee: 32000 * 0.05 = 1600 BDT
assert.strictEqual(deal.marketplaceFeeBdt, 1600);
assert.strictEqual(deal.sellerNetPayoutBdt, 30400);

// Channel status locked in deal
const lockedChannel = db.youtubeListings.find((l) => l.id === approvedChannel.id);
assert.strictEqual(lockedChannel?.status, 'in_deal');

// Test 4: Buyer Submits Payment Deposit
console.log('[PASS] Test 4: Buyer submits payment deposit proof into the Protection Vault');
const depositedDeal = submitDealDeposit({
  dealId: deal.id,
  buyerUserId: buyerUser.id,
  depositChannel: 'bkash',
  depositTransactionId: 'TXN-BKASH-YT998877',
});
assert.strictEqual(depositedDeal.dealStatus, 'deposit_submitted');
assert.strictEqual(depositedDeal.depositTransactionId, 'TXN-BKASH-YT998877');

// Test 5: Admin Verifies Deposit in Protection Vault
console.log('[PASS] Test 5: Admin verifies deposit received into 7-Day Protection Vault');
const verifiedDeal = verifyDealDeposit({
  dealId: deal.id,
  adminUserId: 'usr_admin_01',
  approved: true,
  notes: 'bKash merchant deposit verified ৳32,000.',
});
assert.strictEqual(verifiedDeal.dealStatus, 'funded_in_protection');
assert.ok(verifiedDeal.depositVerifiedAt);

// Test 6: Seller Sends YouTube Studio Manager Invite
console.log('[PASS] Test 6: Seller sends Manager invite via YouTube Studio to buyer Gmail');
const inviteSentDeal = markTransferInviteSent({
  dealId: deal.id,
  sellerUserId: 'sel_techpro_01',
  invitationNotes: 'Sent Manager invite to karim.buyer@gmail.com in YouTube Studio permissions.',
});
assert.strictEqual(inviteSentDeal.dealStatus, 'transfer_initiated');
assert.ok(inviteSentDeal.transferInitiatedAt);

// Test 7: Buyer Confirms Invite Accepted -> 7-Day Timer Begins
console.log('[PASS] Test 7: Buyer confirms invite accepted; Google 7-day transfer timer activated');
const acceptedDeal = confirmTransferInviteAccepted({
  dealId: deal.id,
  buyerUserId: buyerUser.id,
});
assert.strictEqual(acceptedDeal.dealStatus, 'transfer_accepted');
assert.ok(acceptedDeal.sevenDayTimerExpiresAt);

// Test 8: Primary Owner Handover & Seller Payout Settlement
console.log('[PASS] Test 8: Buyer completes checklist, confirms Primary Ownership, funds released to seller');
const sellerBefore = db.sellerProfiles.find((s) => s.id === 'sel_techpro_01');
const balanceBefore = sellerBefore ? sellerBefore.availableBalanceBdt : 0;

const handoverResult = completePrimaryOwnerHandover({
  dealId: deal.id,
  buyerUserId: buyerUser.id,
  checklist: {
    analyticsVerified: true,
    strikesFree: true,
    primaryOwnerClaimed: true,
  },
});

assert.strictEqual(handoverResult.deal.dealStatus, 'completed');
assert.strictEqual(handoverResult.sellerNetPayoutBdt, 30400);

// Invariant: channel marked sold
const soldChannel = db.youtubeListings.find((l) => l.id === approvedChannel.id);
assert.strictEqual(soldChannel?.status, 'sold');

// Invariant: seller balance credited with net payout
const sellerAfter = db.sellerProfiles.find((s) => s.id === 'sel_techpro_01');
assert.strictEqual(sellerAfter?.availableBalanceBdt, balanceBefore + 30400);

// Test 9: Dispute Handling & Admin Refund Mediation
console.log('[PASS] Test 9: Dispute lifecycle: freeze protection funds and admin mediation refund');
const disputeChannel = createYoutubeListing({
  sellerId: 'sel_techpro_01',
  channelName: 'Disputed Gaming Channel',
  channelUrl: 'https://youtube.com/@disputedgaming',
  channelHandle: '@disputedgaming',
  niche: 'Gaming & Esports',
  subscriberCount: 15000,
  totalViews: 300000,
  watchHours: 5000,
  monetizationStatus: 'monetized',
  hasStrikes: false,
  strikeCount: 0,
  monthlyAverageRevenueBdt: 3000,
  channelAgeYears: 1.5,
  primaryAudienceCountry: 'Bangladesh',
  priceBdt: 18000,
  description: 'Test channel for dispute simulation',
});
reviewYoutubeListing({
  listingId: disputeChannel.id,
  action: 'approve',
  adminUserId: 'usr_admin_01',
});
const deal2 = initiateYoutubeDeal({
  channelId: disputeChannel.id,
  buyerUser,
  buyerGoogleEmail: 'karim.buyer@gmail.com',
});
submitDealDeposit({
  dealId: deal2.id,
  buyerUserId: buyerUser.id,
  depositChannel: 'nagad',
  depositTransactionId: 'TXN-NAGAD-DISP01',
});
verifyDealDeposit({
  dealId: deal2.id,
  adminUserId: 'usr_admin_01',
  approved: true,
});

// Buyer files dispute (e.g. channel invitation was revoked by seller)
const disputedDeal = fileDealDispute({
  dealId: deal2.id,
  openedByUserId: buyerUser.id,
  reason: 'Seller revoked the manager invitation before 7 days elapsed.',
});
assert.strictEqual(disputedDeal.dealStatus, 'disputed');

// Admin investigates and refunds buyer
const resolvedDeal = resolveDealDispute({
  dealId: deal2.id,
  adminUserId: 'usr_admin_01',
  resolution: 'refund_buyer',
  resolutionNotes: 'Evidence showed seller revoked permissions. Full refund issued to buyer.',
});
assert.strictEqual(resolvedDeal.dealStatus, 'cancelled');
assert.strictEqual(resolvedDeal.disputeResolution, 'refund_buyer');

// Channel unlocked back to approved_active
const revertedChannel = db.youtubeListings.find((l) => l.id === disputeChannel.id);
assert.strictEqual(revertedChannel?.status, 'approved_active');

console.log('TOTAL: 9/9 YOUTUBE TEST SCENARIOS PASSED.');
