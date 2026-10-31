/**
 * Additive Seller Marketplace Engine
 * Full-cycle Seller Onboarding, KYC Review, Digital Product Security,
 * 4-Tier Commission Resolution Hierarchy (Product -> Seller -> Category -> Global Default),
 * Non-destructive Ledger Accounting, and Authenticated Expiring Downloads.
 */

import crypto from 'crypto';
import { db } from '../db/store.ts';
import {
  SellerProfile,
  SellerApplication,
  SellerProduct,
  SellerEarning,
  SellerWithdrawal,
  SellerDownloadToken,
  KycDocument,
  Order,
} from '../types/index.ts';

/**
 * 1. COMMISSION RESOLUTION HIERARCHY
 * Resolves fee percentage strictly following priority:
 * 1) Product-specific override
 * 2) Seller-specific override
 * 3) Category-specific rate
 * 4) Global default rate (10%)
 */
export function resolveCommissionRate(
  productId?: string,
  sellerId?: string,
  categoryId?: string
): number {
  // 1. Check Product override
  if (productId) {
    const product = db.sellerProducts.find((p) => p.id === productId);
    if (product && typeof product.customCommissionPercentage === 'number' && product.customCommissionPercentage >= 0) {
      return product.customCommissionPercentage;
    }
  }

  // 2. Check Seller override
  if (sellerId) {
    const seller = db.sellerProfiles.find((s) => s.id === sellerId);
    if (seller && typeof seller.customCommissionPercentage === 'number' && seller.customCommissionPercentage >= 0) {
      return seller.customCommissionPercentage;
    }
  }

  // 3. Check Category rate
  if (categoryId) {
    const policy = db.sellerCommissionPolicy;
    if (policy?.categoryRates && typeof policy.categoryRates[categoryId] === 'number') {
      return policy.categoryRates[categoryId];
    }
    const anyCatPolicy = (db as any).commissionPolicies?.find?.(
      (p: any) => p.level === 'category' && p.targetId === categoryId
    );
    if (anyCatPolicy && typeof anyCatPolicy.commissionPercentage === 'number') {
      return anyCatPolicy.commissionPercentage;
    }
  }

  // 4. Fallback to Global Default (10%)
  const globalDefault = db.sellerCommissionPolicy?.globalDefaultPercent ?? 10;
  return globalDefault;
}

export function resolveCommissionDetails(
  productId?: string,
  sellerId?: string,
  categoryId?: string
): { ratePercent: number; source: 'product' | 'seller' | 'category' | 'global_default' } {
  if (productId) {
    const product = db.sellerProducts.find((p) => p.id === productId);
    if (product && typeof product.customCommissionPercentage === 'number' && product.customCommissionPercentage >= 0) {
      return { ratePercent: product.customCommissionPercentage, source: 'product' };
    }
  }

  if (sellerId) {
    const seller = db.sellerProfiles.find((s) => s.id === sellerId);
    if (seller && typeof seller.customCommissionPercentage === 'number' && seller.customCommissionPercentage >= 0) {
      return { ratePercent: seller.customCommissionPercentage, source: 'seller' };
    }
  }

  if (categoryId) {
    const policy = db.sellerCommissionPolicy;
    if (policy?.categoryRates && typeof policy.categoryRates[categoryId] === 'number') {
      return { ratePercent: policy.categoryRates[categoryId], source: 'category' };
    }
    const anyCatPolicy = (db as any).commissionPolicies?.find?.(
      (p: any) => p.level === 'category' && p.targetId === categoryId
    );
    if (anyCatPolicy && typeof anyCatPolicy.commissionPercentage === 'number') {
      return { ratePercent: anyCatPolicy.commissionPercentage, source: 'category' };
    }
  }

  const globalDefault = db.sellerCommissionPolicy?.globalDefaultPercent ?? 10;
  return { ratePercent: globalDefault, source: 'global_default' };
}

/**
 * 2. SELLER APPLICATION & KYC
 */
export function submitSellerApplication(params: any): SellerApplication & { storeSlug: string; nidNumber: string } {
  const userId = params.userId;
  const storeName = (params.storeName || '').trim();
  const contactPhone = (params.contactPhone || params.phoneNumber || '').trim();
  const address = (params.address || params.businessAddress || '').trim();
  const payoutAccountNumber = (params.payoutAccountNumber || params.payoutAccount || '').trim();
  const nidNumber = (params.nidNumber || '').trim();
  const bio = (params.bio || '').trim();
  const payoutMethod = params.payoutMethod || 'bkash';

  const existingApp = db.sellerApplications.find(
    (a) => a.userId === userId && (a.status === 'pending' || a.status === 'under_review')
  );
  if (existingApp) {
    throw new Error('You already have a seller application pending review.');
  }

  const existingProfile = db.sellerProfiles.find((s) => s.userId === userId && s.status === 'approved');
  if (existingProfile) {
    throw new Error('You are already an approved seller.');
  }

  const now = new Date().toISOString();
  const slug = storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `seller-${userId.slice(-4)}`;

  const application: any = {
    id: `selapp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId,
    storeName,
    storeSlug: slug,
    bio,
    nidNumber,
    tradeLicenseNumber: params.tradeLicenseNumber?.trim(),
    contactPhone,
    phoneNumber: contactPhone,
    emergencyContact: params.emergencyContact?.trim(),
    address,
    businessAddress: address,
    payoutMethod,
    payoutAccountNumber,
    payoutAccount: payoutAccountNumber,
    payoutBankDetails: params.payoutBankDetails,
    documents: params.documents || [],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  db.sellerApplications.unshift(application);

  db.auditLogs.push({
    id: `aud_selapp_${Date.now()}`,
    actorUserId: userId,
    actorRole: 'customer',
    action: 'SELLER_APPLICATION_SUBMITTED',
    targetEntity: 'seller_applications',
    targetId: application.id,
    details: { storeName, payoutMethod },
    createdAt: now,
  });

  db.persist();
  return application;
}

export function reviewSellerApplication(
  param1: any,
  param2?: string,
  param3?: any,
  param4?: string
): any {
  let applicationId: string;
  let adminUserId: string;
  let status: 'approved' | 'rejected' | 'needs_info';
  let adminNotes: string | undefined;

  if (typeof param1 === 'object') {
    applicationId = param1.applicationId;
    status = param1.status;
    adminNotes = param1.adminNotes;
    adminUserId = param1.adminUserId;
  } else {
    applicationId = param1;
    adminUserId = param2 || 'admin';
    status = param3;
    adminNotes = param4;
  }

  const app = db.sellerApplications.find((a) => a.id === applicationId);
  if (!app) {
    throw new Error(`Seller application ${applicationId} not found.`);
  }

  const now = new Date().toISOString();
  app.status = status;
  app.adminNotes = adminNotes;
  app.reviewedBy = adminUserId;
  app.reviewedAt = now;
  app.updatedAt = now;

  let sellerProfile: SellerProfile | undefined;

  if (status === 'approved') {
    const existingProfile = db.sellerProfiles.find((s) => s.userId === app.userId);
    const slug = (app as any).storeSlug || app.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `seller-${app.userId.slice(-4)}`;

    if (existingProfile) {
      existingProfile.status = 'approved';
      (existingProfile as any).isVerified = true;
      existingProfile.storeName = app.storeName;
      existingProfile.slug = slug;
      existingProfile.bio = app.bio;
      existingProfile.contactPhone = app.contactPhone;
      existingProfile.payoutMethod = app.payoutMethod;
      existingProfile.payoutAccountNumber = app.payoutAccountNumber;
      existingProfile.approvedAt = now;
      existingProfile.updatedAt = now;
      sellerProfile = existingProfile;
    } else {
      sellerProfile = {
        id: `sel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: app.userId,
        storeName: app.storeName,
        slug,
        bio: app.bio,
        contactEmail: db.users.find((u) => u.id === app.userId)?.email || 'seller@market.com',
        contactPhone: app.contactPhone,
        status: 'approved',
        payoutMethod: app.payoutMethod,
        payoutAccountNumber: app.payoutAccountNumber,
        payoutBankDetails: app.payoutBankDetails,
        rating: 5.0,
        salesCount: 0,
        totalEarningsBdt: 0,
        availableBalanceBdt: 0,
        pendingHoldBalanceBdt: 0,
        withdrawnBalanceBdt: 0,
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      (sellerProfile as any).isVerified = true;
      (sellerProfile as any).lockedBalanceBdt = 0;
      db.sellerProfiles.push(sellerProfile);
    }
  }

  db.auditLogs.push({
    id: `aud_selrev_${Date.now()}`,
    actorUserId: adminUserId,
    actorRole: 'admin',
    action: `SELLER_APPLICATION_${status.toUpperCase()}`,
    targetEntity: 'seller_applications',
    targetId: app.id,
    details: { status, notes: adminNotes },
    createdAt: now,
  });

  db.persist();

  const result: any = Object.assign({}, app, {
    application: app,
    sellerProfile,
    status: app.status,
  });
  return result;
}

/**
 * 3. SELLER DIGITAL PRODUCT MANAGEMENT
 */
export function submitSellerProduct(sellerId: string, params: any): any {
  const seller = db.sellerProfiles.find((s) => s.id === sellerId);
  if (!seller || seller.status !== 'approved') {
    throw new Error('Only approved sellers can publish digital products.');
  }

  const priceBdt = Number(params.priceBdt);
  if (priceBdt <= 0) {
    throw new Error('Price must be greater than 0 BDT.');
  }

  const name = (params.name || params.title || '').trim();
  const description = (params.description || '').trim();
  const tagline = (params.tagline || params.shortDescription || '').trim();
  const productType = params.productType || params.fileType || 'digital_file';
  const fileUrl = params.fileUrl || params.digitalAssetUrl || '';
  const fileSizeBytes = params.fileSizeBytes || (params.fileSizeKb ? params.fileSizeKb * 1024 : 1024 * 1024);
  const fileSizeKb = params.fileSizeKb || Math.round(fileSizeBytes / 1024);
  const fileVersion = params.fileVersion || '1.0.0';
  const previewImageUrl = params.imageUrl || params.previewImageUrl || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600';

  const now = new Date().toISOString();
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `prod-${Date.now().toString().slice(-4)}`;

  if (params.id) {
    const existing = db.sellerProducts.find((p) => p.id === params.id && p.sellerId === sellerId);
    if (!existing) {
      throw new Error(`Seller product ${params.id} not found.`);
    }

    existing.categoryId = params.categoryId;
    existing.name = name;
    existing.slug = slug;
    existing.tagline = tagline;
    existing.description = description;
    existing.priceBdt = Math.round(priceBdt * 100) / 100;
    existing.productType = productType;
    if (fileUrl) existing.fileUrl = fileUrl;
    if (params.fileName) existing.fileName = params.fileName;
    if (fileSizeBytes) existing.fileSizeBytes = fileSizeBytes;
    if (params.fileHash) existing.fileHash = params.fileHash;
    existing.downloadLimitPerPurchase = params.downloadLimitPerPurchase || 5;
    existing.imageUrl = previewImageUrl;
    existing.previewUrl = params.previewUrl;
    existing.customCommissionPercentage = params.customCommissionPercentage;
    existing.updatedAt = now;

    db.persist();
    return existing;
  }

  const newProduct: any = {
    id: `sprod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sellerId: seller.id,
    sellerStoreName: seller.storeName,
    categoryId: params.categoryId || 'cat_software',
    name,
    title: name,
    slug,
    tagline,
    shortDescription: tagline,
    description,
    priceBdt: Math.round(priceBdt * 100) / 100,
    productType,
    fileType: params.fileType || 'ZIP',
    fileUrl,
    digitalAssetUrl: fileUrl,
    fileName: params.fileName || 'source_package.zip',
    fileSizeBytes,
    fileSizeKb,
    fileVersion,
    fileHash: params.fileHash || crypto.createHash('sha256').update(name).digest('hex'),
    downloadLimitPerPurchase: params.downloadLimitPerPurchase || 5,
    imageUrl: previewImageUrl,
    previewImageUrl,
    previewUrl: params.previewUrl,
    status: 'pending_review',
    customCommissionPercentage: params.customCommissionPercentage,
    salesCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.sellerProducts.unshift(newProduct);
  db.persist();
  return newProduct;
}

/**
 * 4. SELLER ORDER & EARNINGS ACCRUAL
 */
export function recordSellerProductPurchase(params: any): any {
  const sellerProductId = params.sellerProductId;
  const sellerProduct = db.sellerProducts.find((p) => p.id === sellerProductId);
  if (!sellerProduct) {
    throw new Error(`Seller digital product ${sellerProductId} not found.`);
  }

  const seller = db.sellerProfiles.find((s) => s.id === sellerProduct.sellerId);
  if (!seller) {
    throw new Error(`Seller profile ${sellerProduct.sellerId} not found.`);
  }

  let order: Order = params.order;
  const now = new Date();

  if (!order) {
    const orderNumber = `ORD-SEL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderNumber,
      orderSource: 'main_store',
      customerId: params.customerId || 'cust_guest',
      customerName: params.customerName || 'Customer',
      customerEmail: params.customerEmail || 'customer@ssdigitalbd.shop',
      customerPhone: params.customerPhone || '01700000000',
      productId: sellerProduct.id,
      packageId: 'pkg_digital_download',
      snapshotProductName: sellerProduct.name,
      snapshotPackageName: 'Digital Delivery Access',
      snapshotDurationDays: 365,
      snapshotRetailPriceBdt: sellerProduct.priceBdt,
      snapshotWholesaleCostBdt: 0,
      snapshotDeliveryMethod: 'instant_license_key',
      currency: 'BDT',
      orderStatus: 'completed',
      walletDebited: false,
      customerInputNotes: `Direct digital license purchase: ${sellerProduct.name}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    db.orders.unshift(order);
  }

  const ratePercent = resolveCommissionRate(
    sellerProduct.id,
    seller.id,
    sellerProduct.categoryId
  );

  const saleAmount = order.snapshotRetailPriceBdt || sellerProduct.priceBdt;
  const platformFee = Math.round((saleAmount * ratePercent) / 100 * 100) / 100;
  const sellerNet = Math.round((saleAmount - platformFee) * 100) / 100;
  const holdExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const earning: any = {
    id: `searn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sellerId: seller.id,
    orderId: order.id,
    sellerProductId: sellerProduct.id,
    productName: sellerProduct.name,
    saleAmountBdt: saleAmount,
    commissionRatePercent: ratePercent,
    commissionSource: 'calculated',
    platformFeeBdt: platformFee,
    sellerNetEarningBdt: sellerNet,
    netEarningBdt: sellerNet,
    status: 'available',
    holdingUntil: holdExpiry,
    createdAt: now.toISOString(),
    releasedAt: now.toISOString(),
  };

  db.sellerEarnings.push(earning);

  seller.totalEarningsBdt = Math.round((seller.totalEarningsBdt + sellerNet) * 100) / 100;
  seller.availableBalanceBdt = Math.round((seller.availableBalanceBdt + sellerNet) * 100) / 100;
  seller.salesCount = (seller.salesCount || 0) + 1;
  seller.updatedAt = now.toISOString();

  sellerProduct.salesCount = (sellerProduct.salesCount || 0) + 1;
  sellerProduct.updatedAt = now.toISOString();

  const tokenString = crypto.randomBytes(24).toString('hex');
  const downloadToken: any = {
    id: `dtok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    token: tokenString,
    sellerProductId: sellerProduct.id,
    orderId: order.id,
    customerId: order.customerId || 'guest',
    downloadsRemaining: 5,
    downloadLimit: 5,
    downloadCount: 0,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  };

  db.sellerDownloadTokens.push(downloadToken);
  db.persist();

  return {
    order,
    earning,
    downloadToken: tokenString,
    tokenRecord: downloadToken,
  };
}

/**
 * 5. SELLER WITHDRAWALS
 */
export function requestSellerWithdrawal(
  param1: any,
  param2?: number,
  param3?: any,
  param4?: string,
  param5?: string
): SellerWithdrawal {
  let sellerId: string;
  let amountBdt: number;
  let payoutMethod: any;
  let payoutAccountNumber: string;
  let payoutDetails: string | undefined;

  if (typeof param1 === 'object') {
    sellerId = param1.sellerId;
    amountBdt = param1.amountBdt;
    payoutMethod = param1.payoutMethod;
    payoutAccountNumber = param1.payoutAccountNumber;
    payoutDetails = param1.payoutDetails;
  } else {
    sellerId = param1;
    amountBdt = param2!;
    payoutMethod = param3;
    payoutAccountNumber = param4!;
    payoutDetails = param5;
  }

  const seller: any = db.sellerProfiles.find((s) => s.id === sellerId);
  if (!seller) {
    throw new Error('Seller profile not found.');
  }

  const requestedAmount = Math.round(amountBdt * 100) / 100;
  if (requestedAmount < 500) {
    throw new Error('Minimum withdrawal amount is 500 BDT.');
  }

  if (seller.availableBalanceBdt < requestedAmount) {
    throw new Error(
      `Insufficient available balance. You requested ৳${requestedAmount}, but only ৳${seller.availableBalanceBdt} is available.`
    );
  }

  const now = new Date().toISOString();

  seller.availableBalanceBdt = Math.round((seller.availableBalanceBdt - requestedAmount) * 100) / 100;
  seller.lockedBalanceBdt = Math.round(((seller.lockedBalanceBdt || 0) + requestedAmount) * 100) / 100;
  seller.updatedAt = now;

  const withdrawal: any = {
    id: `swd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sellerId: seller.id,
    amountBdt: requestedAmount,
    payoutMethod,
    payoutAccountNumber,
    payoutDetails,
    status: 'pending',
    requestedAt: now,
  };

  db.sellerWithdrawals.unshift(withdrawal);

  db.auditLogs.push({
    id: `aud_swd_${Date.now()}`,
    actorUserId: seller.userId,
    actorRole: 'seller',
    action: 'SELLER_WITHDRAWAL_REQUESTED',
    targetEntity: 'seller_withdrawals',
    targetId: withdrawal.id,
    details: { amountBdt: requestedAmount, method: payoutMethod },
    createdAt: now,
  });

  db.persist();
  return withdrawal;
}

export function processSellerWithdrawalPayout(
  param1: any,
  param2?: string,
  param3?: string
): any {
  let withdrawalId: string;
  let adminUserId: string;
  let transactionReference: string | undefined;

  if (typeof param1 === 'object') {
    withdrawalId = param1.withdrawalId;
    adminUserId = param1.adminUserId;
    transactionReference = param1.transactionReference;
  } else {
    withdrawalId = param1;
    adminUserId = param2 || 'admin';
    transactionReference = param3;
  }

  const withdrawal: any = db.sellerWithdrawals.find((w) => w.id === withdrawalId);
  if (!withdrawal) {
    throw new Error(`Withdrawal request ${withdrawalId} not found.`);
  }

  const seller: any = db.sellerProfiles.find((s) => s.id === withdrawal.sellerId);
  const now = new Date().toISOString();

  withdrawal.status = 'completed';
  withdrawal.processedBy = adminUserId;
  withdrawal.processedAt = now;
  withdrawal.transactionReference = transactionReference;

  if (seller) {
    seller.lockedBalanceBdt = Math.max(0, Math.round(((seller.lockedBalanceBdt || 0) - withdrawal.amountBdt) * 100) / 100);
    seller.withdrawnBalanceBdt = Math.round(((seller.withdrawnBalanceBdt || 0) + withdrawal.amountBdt) * 100) / 100;
    seller.updatedAt = now;
  }

  db.persist();
  return withdrawal;
}

/**
 * 6. AUTHENTICATED EXPIRING DOWNLOAD DELIVERY
 */
export function validateAndConsumeDownloadToken(token: string): any {
  const tokenRecord: any = db.sellerDownloadTokens.find((t) => t.token === token);
  if (!tokenRecord) {
    return { isValid: false, valid: false, message: 'Invalid or unrecognized download token.' };
  }

  const now = new Date();
  const expiry = new Date(tokenRecord.expiresAt);
  if (now > expiry) {
    return { isValid: false, valid: false, message: 'This download link has expired (7-day validity limit exceeded).' };
  }

  if (tokenRecord.downloadsRemaining <= 0) {
    return { isValid: false, valid: false, message: 'Maximum download limit reached for this purchase.' };
  }

  tokenRecord.downloadsRemaining -= 1;
  tokenRecord.downloadCount = (tokenRecord.downloadCount || 0) + 1;
  tokenRecord.lastDownloadedAt = now.toISOString();

  const product = db.sellerProducts.find((p) => p.id === tokenRecord.sellerProductId);
  db.persist();

  return {
    isValid: true,
    valid: true,
    product,
    remainingDownloads: tokenRecord.downloadsRemaining,
    tokenRecord,
  };
}
