/**
 * Core Data Models & TypeScript Types for DigiMarket
 */

export type UserRole = 'customer' | 'reseller' | 'admin';
export type UserStatus = 'active' | 'pending_kyc' | 'suspended' | 'disabled';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export interface ResellerApplication {
  id: string;
  userId: string;
  businessName: string;
  requestedSubdomain: string;
  tradeLicenseNumber?: string;
  nationalIdNumber: string;
  contactPhone: string;
  emergencyContact?: string;
  address: string;
  status: ApplicationStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KycDocument {
  id: string;
  applicationId: string;
  documentType: 'nid_front' | 'nid_back' | 'trade_license' | 'utility_bill';
  fileName: string;
  fileDataUrl: string; // Base64 data or simulated secure vault URL
  verificationStatus: 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

export interface Store {
  id: string;
  resellerId: string;
  storeName: string;
  subdomain: string; // e.g. "rahim" -> rahim.digimarket.com
  status: 'active' | 'suspended' | 'disabled' | 'maintenance';
  logoUrl?: string;
  supportPhone: string;
  supportEmail: string;
  supportWhatsapp: string;
  paymentInstructionsBkash?: string;
  paymentInstructionsNagad?: string;
  paymentInstructionsRocket?: string;
  customDomain?: string;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryMethod = 'manual_credentials' | 'instant_license_key' | 'invite_link' | 'direct_activation';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  imageUrl: string;
  deliveryMethod: DeliveryMethod;
  deliveryInstructions: string;
  termsAndConditions: string;
  isActive: boolean;
  isDeleted?: boolean;
  status?: 'draft' | 'active' | 'paused';
  availableOnMainStore: boolean;
  availableToResellers: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPackage {
  id: string;
  productId: string;
  name: string;
  durationLabel: string;
  durationDays: number;
  retailPriceBdt: number; // Stored in exact BDT (2 decimals)
  resellerWholesaleCostBdt: number; // Stored in exact BDT
  stockCount: number; // -1 for unlimited
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResellerWallet {
  resellerId: string;
  availableBalanceBdt: number;
  lockedBalanceBdt: number;
  totalDepositedBdt: number;
  totalSpentBdt: number;
  totalBonusBdt: number;
  updatedAt: string;
}

export type LedgerEntryType =
  | 'deposit_credit'
  | 'order_wholesale_debit'
  | 'order_reversal_credit'
  | 'bonus_credit'
  | 'bonus_reversal_debit'
  | 'adjustment_credit'
  | 'adjustment_debit';

export interface WalletLedgerEntry {
  id: string;
  resellerId: string;
  referenceId: string;
  idempotencyKey: string;
  entryType: LedgerEntryType;
  amountBdt: number;
  balanceBeforeBdt: number;
  balanceAfterBdt: number;
  reason: string;
  orderId?: string;
  bonusId?: string;
  createdBy: string;
  createdAt: string;
}

export type DepositStatus = 'pending' | 'verified_approved' | 'rejected';
export type PaymentChannel = 'bkash_merchant' | 'nagad_merchant' | 'rocket_merchant' | 'bank_transfer' | 'bkash' | 'nagad' | 'rocket' | 'sslcommerz_gateway';

export interface DepositRequest {
  id: string;
  resellerId: string;
  method: 'bkash_merchant' | 'nagad_merchant' | 'rocket_merchant' | 'bank_transfer';
  claimedAmountBdt: number;
  transactionReference: string;
  senderAccountNumber: string;
  depositSlipUrl?: string;
  status: DepositStatus;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  ledgerEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export type BonusType = 'manual_bonus' | 'campaign_bonus' | 'welcome_bonus' | 'performance_bonus' | 'adjustment_credit';
export type BonusStatus = 'approved_and_credited' | 'pending_second_approval' | 'reversed' | 'rejected';

export interface ResellerBonus {
  id: string;
  resellerId: string;
  bonusType: BonusType;
  amountBdt: number;
  campaignName?: string;
  reason: string;
  referenceCode: string;
  idempotencyKey: string;
  status: BonusStatus;
  createdBy: string;
  secondApproverId?: string;
  ledgerEntryId?: string;
  reversalLedgerEntryId?: string;
  reversalReason?: string;
  reversedAt?: string;
  reversedBy?: string;
  createdAt: string;
}

export type OrderSource = 'main_store' | 'reseller_store';

export type OrderStatus =
  | 'payment_submitted'
  | 'payment_verified'
  | 'payment_rejected'
  | 'wallet_pending'
  | 'pending_admin_approval'
  | 'admin_approved'
  | 'admin_rejected'
  | 'queued_for_delivery'
  | 'delivery_in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refund_in_review'
  | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  orderSource: OrderSource;
  storeId?: string;
  resellerId?: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  // Snapshot
  productId: string;
  packageId: string;
  snapshotProductName: string;
  snapshotPackageName: string;
  snapshotDurationDays: number;
  snapshotRetailPriceBdt: number;
  snapshotWholesaleCostBdt: number;
  snapshotDeliveryMethod: DeliveryMethod;
  currency: string;

  orderStatus: OrderStatus;
  walletDebited: boolean;
  walletDebitLedgerId?: string;
  walletReversalLedgerId?: string;

  customerInputNotes?: string;
  adminNotes?: string;
  rejectionReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface PaymentSubmission {
  id: string;
  orderId: string;
  channel: 'bkash' | 'nagad' | 'rocket' | 'bank_transfer' | 'sslcommerz_gateway';
  claimedAmountBdt: number;
  transactionId: string;
  senderPhoneOrAccount: string;
  recipientAccountSnapshot: string;
  screenshotProofUrl?: string;
  verificationStatus: 'submitted' | 'verified_valid' | 'rejected_invalid' | 'duplicate_flagged';
  verifiedByUserId?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  createdAt: string;
}

export type DeliveryState =
  | 'not_started'
  | 'queued'
  | 'in_progress'
  | 'awaiting_provider'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'manual_review';

export interface Delivery {
  id: string;
  orderId: string;
  fulfillmentMethod: DeliveryMethod;
  fulfillmentPayload?: string; // License key or credentials
  instructionsForCustomer: string;
  state: DeliveryState;
  attemptsCount: number;
  operatorUserId?: string;
  providerReference?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationChannel = 'email' | 'sms' | 'whatsapp';
export type NotificationStatus = 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'retry_scheduled' | 'cancelled' | 'not_configured';

export interface NotificationOutbox {
  id: string;
  recipientType: 'customer' | 'reseller' | 'admin';
  recipientContact: string;
  channel: NotificationChannel;
  eventType: string;
  title: string;
  bodyText: string;
  metadataJson?: Record<string, any>;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  providerMessageId?: string;
  errorMessage?: string;
  scheduledAt: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId?: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
}

export type TicketCategory =
  | 'login_problem'
  | 'service_not_working'
  | 'wrong_credentials'
  | 'warranty_replacement'
  | 'order_fulfillment_delay'
  | 'other';

export type TicketStatus =
  | 'open'
  | 'in_review'
  | 'waiting_customer'
  | 'resolved'
  | 'closed';

export interface TicketAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderUserId: string;
  senderRole: 'customer' | 'admin' | 'staff';
  senderName: string;
  message: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface InternalNote {
  id: string;
  ticketId: string;
  staffUserId: string;
  staffName: string;
  note: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string; // TCK-YYYYMMDD-XXXX
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderNumber?: string;
  productId?: string;
  serviceName?: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  messages: TicketMessage[];
  internalNotes?: InternalNote[];
}

export interface BackupVerificationLog {
  id: string;
  timestamp: string;
  backupFileName: string;
  fileName?: string;
  fileSizeBytes: number;
  fileSizeKb?: number;
  recordCount: number;
  sha256Checksum: string;
  status: 'verified' | 'completed' | 'warning' | 'failed';
  storageHealth: 'healthy' | 'degraded' | 'critical';
  storageHealthStatus?: string;
  storageFreeMb: number;
  storageTotalMb: number;
  storageUsagePercent: number;
  verifiedBy: string;
  triggerType: 'automated_daily' | 'manual_verification';
  notes: string;
}

export type SellerStatus = 'pending_kyc' | 'under_review' | 'approved' | 'rejected' | 'suspended';

export interface SellerProfile {
  id: string;
  userId: string;
  storeName: string;
  slug: string;
  bio: string;
  contactEmail: string;
  contactPhone: string;
  status: SellerStatus;
  isVerified?: boolean;
  payoutMethod: 'bkash' | 'nagad' | 'rocket' | 'bank_transfer';
  payoutAccountNumber: string;
  payoutBankDetails?: {
    bankName: string;
    branchName: string;
    accountName: string;
    routingNumber: string;
  };
  rating: number;
  salesCount: number;
  totalEarningsBdt: number;
  availableBalanceBdt: number;
  lockedBalanceBdt?: number;
  pendingHoldBalanceBdt: number;
  withdrawnBalanceBdt: number;
  customCommissionPercentage?: number; // Seller-level commission override
  rejectionReason?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerApplication {
  id: string;
  userId: string;
  storeName: string;
  bio: string;
  nidNumber: string;
  tradeLicenseNumber?: string;
  contactPhone: string;
  emergencyContact?: string;
  address: string;
  payoutMethod: 'bkash' | 'nagad' | 'rocket' | 'bank_transfer';
  payoutAccountNumber: string;
  payoutBankDetails?: {
    bankName: string;
    branchName: string;
    accountName: string;
    routingNumber: string;
  };
  documents: KycDocument[];
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_info';
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SellerProductStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';

export interface SellerProduct {
  id: string;
  sellerId: string;
  sellerStoreName: string;
  categoryId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  priceBdt: number;
  productType: 'digital_file' | 'source_code' | 'license_key' | 'subscription_access' | 'template';
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  fileHash?: string;
  downloadLimitPerPurchase: number;
  imageUrl: string;
  previewUrl?: string;
  status: SellerProductStatus;
  customCommissionPercentage?: number; // Product-level commission override
  salesCount: number;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerCommissionPolicy {
  globalDefaultPercent: number; // e.g. 10%
  categoryRates: Record<string, number>; // e.g. { "templates": 12, "source_code": 8 }
  updatedAt: string;
  updatedBy: string;
}

export interface SellerEarning {
  id: string;
  sellerId: string;
  orderId: string;
  sellerProductId: string;
  productName: string;
  saleAmountBdt: number;
  commissionRatePercent: number;
  commissionSource: 'product' | 'seller' | 'category' | 'global_default';
  platformFeeBdt: number;
  sellerNetEarningBdt: number;
  status: 'on_hold' | 'available' | 'withdrawn' | 'refunded';
  holdingUntil: string;
  createdAt: string;
  releasedAt?: string;
}

export interface SellerWithdrawal {
  id: string;
  sellerId: string;
  amountBdt: number;
  payoutMethod: 'bkash' | 'nagad' | 'rocket' | 'bank_transfer';
  payoutAccountNumber: string;
  payoutDetails?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  transactionReference?: string;
  rejectionReason?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface SellerDownloadToken {
  id: string;
  token: string;
  sellerProductId: string;
  orderId: string;
  customerId: string;
  downloadsRemaining: number;
  downloadLimit?: number;
  downloadCount?: number;
  lastDownloadedAt?: string;
  expiresAt: string;
  createdAt: string;
}

