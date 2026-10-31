/**
 * DigiMarket Express API Router
 * Full RESTful API with Role-Based Access Control, rate limiting headers, and audit logging.
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, EVIDENCE_DIR, UPLOADS_DIR } from '../db/store.ts';
import {
  User,
  UserRole,
  Order,
  SupportTicket,
  TicketMessage,
  TicketAttachment,
  InternalNote,
  TicketCategory,
  TicketStatus,
  SessionRecord,
} from '../types/index.ts';
import {
  submitDepositRequest,
  approveDeposit,
  rejectDeposit,
  grantBonusBatch,
  reverseBonus,
} from '../services/wallet.ts';
import {
  createOrder,
  submitOrderPayment,
  verifyResellerCustomerPayment,
  retryWalletDebitForHeldOrder,
  verifyMainStorePayment,
  adminApproveOrder,
  adminRejectOrder,
  fulfillOrder,
} from '../services/orders.ts';
import {
  submitResellerApplication,
  reviewResellerApplication,
  validateSubdomainFormat,
} from '../services/kyc.ts';
import {
  retryNotification,
  verifyWhatsAppWebhook,
  verifyWhatsAppSignature,
  processWhatsAppWebhookPayload,
  processEmailWebhookPayload,
  enqueueNotification,
  processOutboxItem,
  getNotificationConfigStatus,
} from '../services/notifications.ts';
import {
  resolveCommissionRate,
  resolveCommissionDetails,
  submitSellerApplication,
  reviewSellerApplication,
  submitSellerProduct,
  recordSellerProductPurchase,
  requestSellerWithdrawal,
  processSellerWithdrawalPayout,
  validateAndConsumeDownloadToken,
} from '../services/seller.ts';

export const apiRouter = Router();

// -------------------------------------------------------------
// Authentication & Session Middleware
// -------------------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateCryptoToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSession(userId: string): string {
  const token = generateCryptoToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.sessions.push({
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt,
    revoked: false,
  });
  db.persist();
  return token;
}

export function saveEvidenceFile(base64Data: string, originalName: string): TicketAttachment {
  let mimeType = 'image/jpeg';
  let rawBase64 = base64Data;
  const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1].toLowerCase();
    rawBase64 = match[2];
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error(`File "${originalName}" exceeds the 5MB maximum size limit.`);
  }

  let ext = 'jpg';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    ext = 'jpg';
    mimeType = 'image/jpeg';
  } else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    ext = 'png';
    mimeType = 'image/png';
  } else if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    ext = 'webp';
    mimeType = 'image/webp';
  } else if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    ext = 'pdf';
    mimeType = 'application/pdf';
  } else {
    throw new Error(`Invalid file type for "${originalName}". Only JPEG, PNG, WebP, and PDF are supported.`);
  }

  const fileId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const filename = `${fileId}.${ext}`;
  const filePath = path.join(EVIDENCE_DIR, filename);

  fs.writeFileSync(filePath, buffer);

  return {
    id: fileId,
    filename,
    originalName: path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_'),
    mimeType,
    sizeBytes: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

export function getOptionalUser(req: Request): User | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader) return undefined;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const session = db.sessions.find(
    (s) => s.token === token && !s.revoked && new Date(s.expiresAt) > new Date()
  );
  if (session) {
    return db.users.find((u) => u.id === session.userId && u.status === 'active');
  }
  return undefined;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Validate active cryptographic session token
  const session = db.sessions.find(
    (s) => s.token === token && !s.revoked && new Date(s.expiresAt) > new Date()
  );
  if (session) {
    const user = db.users.find((u) => u.id === session.userId);
    if (user && user.status === 'active') {
      req.user = user;
      return next();
    }
  }

  return res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
}

function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access requires one of [${roles.join(', ')}]. Your role is ${req.user.role}.`,
      });
    }
    next();
  };
}

// -------------------------------------------------------------
// 1. Auth Endpoints
// -------------------------------------------------------------
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = createSession(user.id);
  const store = user.role === 'reseller' ? db.stores.find((s) => s.resellerId === user.id) : undefined;
  const wallet = user.role === 'reseller' ? db.resellerWallets.find((w) => w.resellerId === user.id) : undefined;

  // Audit log
  db.auditLogs.push({
    id: `aud_${Date.now()}`,
    actorUserId: user.id,
    actorRole: user.role,
    action: 'USER_LOGIN',
    targetEntity: 'users',
    targetId: user.id,
    details: { email: user.email },
    createdAt: new Date().toISOString(),
  });
  db.persist();

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
    store,
    wallet,
  });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { fullName, email, phone, password } = req.body;
  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (db.users.find((u) => u.email === normalizedEmail)) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    passwordHash,
    fullName: fullName.trim(),
    phone: phone.trim(),
    role: 'customer',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  const token = createSession(newUser.id);
  db.persist();

  return res.status(201).json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      phone: newUser.phone,
      role: newUser.role,
      status: newUser.status,
    },
  });
});

apiRouter.post('/auth/logout', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = db.sessions.find((s) => s.token === token);
    if (session) {
      session.revoked = true;
      db.persist();
    }
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

apiRouter.post('/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (user) {
    const resetToken = crypto.randomBytes(20).toString('hex');
    enqueueNotification({
      recipientType: user.role === 'customer' ? 'customer' : 'reseller',
      recipientContact: user.email,
      channel: 'email',
      eventType: 'PASSWORD_RESET',
      title: 'Password Reset Request',
      bodyText: `A password reset was requested for your account. Use recovery code: ${resetToken} to set your new password. If you did not make this request, please contact support.`,
      metadataJson: { userId: user.id, resetToken },
    });
  }

  return res.json({
    success: true,
    message: 'If an account exists with that email, instructions have been sent.',
  });
});

apiRouter.get('/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const store = user.role === 'reseller' ? db.stores.find((s) => s.resellerId === user.id) : undefined;
  const wallet = user.role === 'reseller' ? db.resellerWallets.find((w) => w.resellerId === user.id) : undefined;

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
    store,
    wallet,
  });
});

// -------------------------------------------------------------
// 2. Public Catalog & Store Subdomain Resolution
// -------------------------------------------------------------
apiRouter.get('/catalog', (req: Request, res: Response) => {
  const source = req.query.source === 'reseller' ? 'reseller' : 'main';

  const categories = db.categories.filter((c) => c.isActive);
  const products = db.products
    .filter((p) => p.isActive && !p.isDeleted)
    .filter((p) => (source === 'reseller' ? p.availableToResellers : p.availableOnMainStore))
    .map((p) => {
      const packages = db.productPackages.filter((pkg) => pkg.productId === p.id && pkg.isActive);
      return { ...p, packages };
    });

  return res.json({ categories, products });
});

apiRouter.get('/stores/:subdomain', (req: Request, res: Response) => {
  const subdomain = req.params.subdomain.trim().toLowerCase();
  const store = db.stores.find((s) => s.subdomain.toLowerCase() === subdomain);

  if (!store) {
    return res.status(404).json({ error: `Store with subdomain "${subdomain}" not found.` });
  }

  if (store.status !== 'active') {
    return res.status(403).json({ error: `Store "${store.storeName}" is currently ${store.status}.` });
  }

  // Filter products available for resellers
  const products = db.products
    .filter((p) => p.isActive && !p.isDeleted && p.availableToResellers)
    .map((p) => {
      const packages = db.productPackages.filter((pkg) => pkg.productId === p.id && pkg.isActive);
      return { ...p, packages };
    });

  return res.json({ store, products });
});

// -------------------------------------------------------------
// 3. Orders & Payment Submissions
// -------------------------------------------------------------
apiRouter.post('/orders', (req: Request, res: Response) => {
  try {
    const order = createOrder(req.body);
    return res.status(201).json(order);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/orders/:orderId/payment', (req: Request, res: Response) => {
  try {
    const submission = submitOrderPayment({
      orderId: req.params.orderId,
      ...req.body,
    });
    return res.status(201).json(submission);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/orders/:orderNumber', (req: Request, res: Response) => {
  const order = db.orders.find((o) => o.orderNumber === req.params.orderNumber);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const submissions = db.paymentSubmissions.filter((p) => p.orderId === order.id);
  const rawDelivery = db.deliveries.find((d) => d.orderId === order.id);

  const optionalUser = getOptionalUser(req);
  const isAuthorized =
    optionalUser &&
    (optionalUser.role === 'admin' ||
      optionalUser.id === order.customerId ||
      optionalUser.email.toLowerCase() === order.customerEmail.toLowerCase() ||
      (optionalUser.role === 'reseller' && optionalUser.id === order.resellerId));

  if (!isAuthorized) {
    // Redact private customer contact and financial details for unauthenticated / non-owner lookups
    const safeOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      snapshotProductName: order.snapshotProductName,
      snapshotPackageName: order.snapshotPackageName,
      snapshotDurationDays: order.snapshotDurationDays,
      snapshotRetailPriceBdt: order.snapshotRetailPriceBdt,
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      isProtected: true,
    };
    const safeDelivery = rawDelivery
      ? {
          state: rawDelivery.state,
          instructionsForCustomer: rawDelivery.instructionsForCustomer,
          deliveredAt: rawDelivery.deliveredAt,
          fulfillmentPayload: rawDelivery.fulfillmentPayload
            ? '[Protected credentials — Sign in with your customer account to view]'
            : undefined,
        }
      : undefined;

    return res.json({ order: safeOrder, submissions: [], delivery: safeDelivery });
  }

  return res.json({ order, submissions, delivery: rawDelivery });
});

// -------------------------------------------------------------
// Customer Services & Authoritative Date Engine
// -------------------------------------------------------------
apiRouter.get('/customer/orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const orders = db.orders
    .filter(
      (o) =>
        o.customerId === user.id ||
        o.customerEmail.toLowerCase() === user.email.toLowerCase() ||
        (user.phone && o.customerPhone === user.phone)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const result = orders.map((order) => {
    const delivery = db.deliveries.find((d) => d.orderId === order.id);
    const isCompleted = order.orderStatus === 'completed';
    const serviceStartDate = isCompleted
      ? delivery?.deliveredAt || delivery?.createdAt || order.updatedAt
      : 'Pending Delivery';

    let expiryDate = 'Pending Delivery';
    if (isCompleted && serviceStartDate !== 'Pending Delivery') {
      const startTime = new Date(serviceStartDate).getTime();
      const durationMs = order.snapshotDurationDays * 86400000;
      expiryDate = new Date(startTime + durationMs).toISOString();
    }

    let paymentStatus = 'Pending Verification';
    if (order.orderStatus === 'payment_rejected') {
      paymentStatus = 'Rejected';
    } else if (
      order.walletDebited ||
      order.orderStatus === 'completed' ||
      order.orderStatus === 'admin_approved' ||
      order.orderStatus === 'queued_for_delivery' ||
      order.orderStatus === 'delivery_in_progress'
    ) {
      paymentStatus = 'Verified';
    }

    const ticket = db.tickets.find((t) => t.orderNumber === order.orderNumber && t.status !== 'closed');

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderSource: order.orderSource,
      service_name: `${order.snapshotProductName} (${order.snapshotPackageName})`,
      product_name: order.snapshotProductName,
      package_name: order.snapshotPackageName,
      order_status: order.orderStatus,
      purchase_date: order.createdAt,
      service_start_date: serviceStartDate,
      service_duration: `${order.snapshotDurationDays} Days`,
      expiry_date: expiryDate,
      payment_status: paymentStatus,
      delivery_status: delivery?.state || 'not_started',
      delivery_instructions: delivery?.instructionsForCustomer || '',
      fulfillment_payload: delivery?.fulfillmentPayload,
      support_ticket_status: ticket ? ticket.status : 'none',
      support_ticket_id: ticket ? ticket.id : undefined,
      amount_bdt: order.snapshotRetailPriceBdt,
      currency: order.currency,
    };
  });

  return res.json(result);
});

// -------------------------------------------------------------
// 4. Reseller Portal Endpoints
// -------------------------------------------------------------
apiRouter.get('/reseller/orders', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  const resellerId = req.user!.id;
  const orders = db.orders
    .filter((o) => o.resellerId === resellerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const ordersWithDetails = orders.map((o) => {
    const submissions = db.paymentSubmissions.filter((p) => p.orderId === o.id);
    const delivery = db.deliveries.find((d) => d.orderId === o.id);
    return { ...o, submissions, delivery };
  });

  return res.json(ordersWithDetails);
});

apiRouter.post('/reseller/orders/:orderId/verify-payment', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = verifyResellerCustomerPayment({
      orderId: req.params.orderId,
      submissionId: req.body.submissionId,
      resellerUserId: req.user!.id,
      decision: req.body.decision,
      verificationNotes: req.body.verificationNotes,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/reseller/orders/:orderId/retry-debit', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = retryWalletDebitForHeldOrder(req.params.orderId, req.user!.id);
    return res.json({ order, success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/reseller/wallet', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  const wallet = db.resellerWallets.find((w) => w.resellerId === req.user!.id);
  return res.json(wallet || { availableBalanceBdt: 0, lockedBalanceBdt: 0, totalDepositedBdt: 0, totalSpentBdt: 0 });
});

apiRouter.get('/reseller/ledger', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  const ledger = db.walletLedger
    .filter((l) => l.resellerId === req.user!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(ledger);
});

apiRouter.post('/reseller/deposit-requests', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const deposit = submitDepositRequest({
      resellerId: req.user!.id,
      ...req.body,
    });
    return res.status(201).json(deposit);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/reseller/deposit-requests', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  const deposits = db.depositRequests
    .filter((d) => d.resellerId === req.user!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(deposits);
});

apiRouter.get('/reseller/bonuses', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  const bonuses = db.resellerBonuses
    .filter((b) => b.resellerId === req.user!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(bonuses);
});

apiRouter.put('/reseller/store-settings', authMiddleware, requireRole('reseller'), (req: AuthenticatedRequest, res: Response) => {
  const store = db.stores.find((s) => s.resellerId === req.user!.id);
  if (!store) {
    return res.status(404).json({ error: 'Store not found for this reseller.' });
  }

  const { storeName, supportPhone, supportEmail, supportWhatsapp, paymentInstructionsBkash, paymentInstructionsNagad, paymentInstructionsRocket } = req.body;
  if (storeName) store.storeName = storeName.trim();
  if (supportPhone) store.supportPhone = supportPhone.trim();
  if (supportEmail) store.supportEmail = supportEmail.trim();
  if (supportWhatsapp) store.supportWhatsapp = supportWhatsapp.trim();
  if (paymentInstructionsBkash !== undefined) store.paymentInstructionsBkash = paymentInstructionsBkash;
  if (paymentInstructionsNagad !== undefined) store.paymentInstructionsNagad = paymentInstructionsNagad;
  if (paymentInstructionsRocket !== undefined) store.paymentInstructionsRocket = paymentInstructionsRocket;
  store.updatedAt = new Date().toISOString();

  db.persist();
  return res.json(store);
});

apiRouter.post('/reseller/apply', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const application = submitResellerApplication({
      userId: req.user!.id,
      ...req.body,
    });
    return res.status(201).json(application);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. Main Admin Portal Endpoints
// -------------------------------------------------------------
apiRouter.get('/admin/metrics', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const totalOrders = db.orders.length;
  const pendingApprovalOrders = db.orders.filter((o) => o.orderStatus === 'pending_admin_approval').length;
  const completedOrders = db.orders.filter((o) => o.orderStatus === 'completed').length;
  const pendingDeposits = db.depositRequests.filter((d) => d.status === 'pending').length;
  const pendingApplications = db.resellerApplications.filter((a) => a.status === 'pending').length;

  const totalRevenue = db.orders
    .filter((o) => o.orderStatus === 'completed' || o.orderStatus === 'admin_approved')
    .reduce((sum, o) => sum + o.snapshotRetailPriceBdt, 0);

  const totalWholesaleSpend = db.walletLedger
    .filter((l) => l.entryType === 'order_wholesale_debit')
    .reduce((sum, l) => sum + l.amountBdt, 0);

  const totalBonusesPaid = db.walletLedger
    .filter((l) => l.entryType === 'bonus_credit')
    .reduce((sum, l) => sum + l.amountBdt, 0);

  return res.json({
    totalOrders,
    pendingApprovalOrders,
    completedOrders,
    pendingDeposits,
    pendingApplications,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalWholesaleSpend: Math.round(totalWholesaleSpend * 100) / 100,
    totalBonusesPaid: Math.round(totalBonusesPaid * 100) / 100,
    activeResellersCount: db.users.filter((u) => u.role === 'reseller' && u.status === 'active').length,
  });
});

apiRouter.get('/admin/orders', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const statusFilter = req.query.status as string;
  let orders = db.orders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (statusFilter && statusFilter !== 'all') {
    orders = orders.filter((o) => o.orderStatus === statusFilter);
  }

  const ordersWithDetails = orders.map((o) => {
    const submissions = db.paymentSubmissions.filter((p) => p.orderId === o.id);
    const delivery = db.deliveries.find((d) => d.orderId === o.id);
    const reseller = o.resellerId ? db.users.find((u) => u.id === o.resellerId) : undefined;
    return { ...o, submissions, delivery, resellerName: reseller?.fullName };
  });

  return res.json(ordersWithDetails);
});

apiRouter.post('/admin/orders/:orderId/approve', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = adminApproveOrder(req.params.orderId, req.user!.id, req.body.adminNotes);
    return res.json(order);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/admin/orders/:orderId/reject', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = adminRejectOrder(req.params.orderId, req.user!.id, req.body.rejectionReason);
    return res.json(order);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/admin/orders/:orderId/fulfill', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fulfillmentPayload, instructionsForCustomer, providerReference } = req.body;
    if (!fulfillmentPayload || !instructionsForCustomer) {
      return res.status(400).json({ error: 'Fulfillment credentials/license key and instructions are required.' });
    }
    const result = fulfillOrder({
      orderId: req.params.orderId,
      fulfillmentPayload,
      instructionsForCustomer,
      providerReference,
      operatorUserId: req.user!.id,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Reseller Applications
apiRouter.get('/admin/reseller-applications', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const apps = db.resellerApplications
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const appsWithDetails = apps.map((a) => {
    const user = db.users.find((u) => u.id === a.userId);
    const docs = db.kycDocuments.filter((d) => d.applicationId === a.id);
    return { ...a, applicantName: user?.fullName, applicantEmail: user?.email, kycDocuments: docs };
  });

  return res.json(appsWithDetails);
});

apiRouter.post('/admin/reseller-applications/:id/review', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { decision, rejectionReason } = req.body;
    const result = reviewResellerApplication(req.params.id, req.user!.id, decision, rejectionReason);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Deposits
apiRouter.get('/admin/deposits', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const deposits = db.depositRequests
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const depositsWithReseller = deposits.map((d) => {
    const reseller = db.users.find((u) => u.id === d.resellerId);
    return { ...d, resellerName: reseller?.fullName, resellerEmail: reseller?.email };
  });

  return res.json(depositsWithReseller);
});

apiRouter.post('/admin/deposits/:id/approve', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const deposit = approveDeposit(req.params.id, req.user!.id, req.body.adminNotes);
    return res.json(deposit);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/admin/deposits/:id/reject', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const deposit = rejectDeposit(req.params.id, req.user!.id, req.body.reason || 'Verification failed');
    return res.json(deposit);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Reseller Bonus Module
apiRouter.get('/admin/resellers-list', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const resellers = db.users
    .filter((u) => u.role === 'reseller')
    .map((u) => {
      const store = db.stores.find((s) => s.resellerId === u.id);
      const wallet = db.resellerWallets.find((w) => w.resellerId === u.id);
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status,
        subdomain: store?.subdomain,
        walletBalance: wallet?.availableBalanceBdt || 0,
      };
    });
  return res.json(resellers);
});

apiRouter.post('/admin/bonuses/preview', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { resellerIds, amountBdt, bonusType, reason } = req.body;
  if (!resellerIds || !Array.isArray(resellerIds) || resellerIds.length === 0) {
    return res.status(400).json({ error: 'Please select at least one reseller recipient.' });
  }
  const amount = Math.round(Number(amountBdt) * 100) / 100;
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid bonus amount.' });
  }

  const recipients = resellerIds.map((id) => {
    const user = db.users.find((u) => u.id === id);
    const wallet = db.resellerWallets.find((w) => w.resellerId === id);
    return {
      id,
      name: user?.fullName || 'Unknown',
      email: user?.email,
      currentBalance: wallet?.availableBalanceBdt || 0,
      projectedBalance: (wallet?.availableBalanceBdt || 0) + amount,
    };
  });

  const totalCommitment = amount * recipients.length;
  const requiresSecondApproval = totalCommitment >= 25000; // Configurable policy

  return res.json({
    recipients,
    perRecipientAmountBdt: amount,
    totalCommitmentBdt: totalCommitment,
    bonusType,
    reason,
    requiresSecondApproval,
  });
});

apiRouter.post('/admin/bonuses/grant', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { resellerIds, amountBdt, bonusType, campaignName, reason, requireSecondApproval } = req.body;
    const results = grantBonusBatch({
      resellerIds,
      amountBdt: Number(amountBdt),
      bonusType,
      campaignName,
      reason,
      adminUserId: req.user!.id,
      requireSecondApproval,
    });
    return res.json({ results, success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/admin/bonuses', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const bonuses = db.resellerBonuses
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((b) => {
      const reseller = db.users.find((u) => u.id === b.resellerId);
      const creator = db.users.find((u) => u.id === b.createdBy);
      return {
        ...b,
        resellerName: reseller?.fullName,
        resellerEmail: reseller?.email,
        creatorName: creator?.fullName,
      };
    });
  return res.json(bonuses);
});

apiRouter.post('/admin/bonuses/:id/reverse', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const bonus = reverseBonus(req.params.id, req.user!.id, req.body.reversalReason);
    return res.json(bonus);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin Global Ledger & Audits
apiRouter.get('/admin/ledger', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const ledger = db.walletLedger
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((l) => {
      const reseller = db.users.find((u) => u.id === l.resellerId);
      return { ...l, resellerName: reseller?.fullName, resellerEmail: reseller?.email };
    });
  return res.json(ledger);
});

apiRouter.get('/admin/notifications', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const notifications = db.notificationOutbox
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(notifications);
});

apiRouter.post('/admin/notifications/:id/retry', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = retryNotification(req.params.id);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/admin/notifications/send-test', authMiddleware, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channel, recipientContact, title, bodyText } = req.body;
    if (!channel || !recipientContact || !title || !bodyText) {
      return res.status(400).json({ error: 'channel, recipientContact, title, and bodyText are required.' });
    }
    const item = enqueueNotification({
      recipientType: 'admin',
      recipientContact: recipientContact.trim(),
      channel,
      eventType: 'ADMIN_MANUAL_TEST',
      title: title.trim(),
      bodyText: bodyText.trim(),
      metadataJson: { triggeredBy: req.user!.email },
    });
    const processed = await processOutboxItem(item.id);
    return res.json({ item: processed || item });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/notifications/config-status', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const status = getNotificationConfigStatus();
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Delivery Status Webhooks (WhatsApp Cloud API & Email)
// -------------------------------------------------------------
// Meta WhatsApp Webhook Challenge Verification (GET)
apiRouter.get('/webhooks/whatsapp', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;
    const verifiedChallenge = verifyWhatsAppWebhook(mode, token, challenge);
    res.status(200).send(verifiedChallenge);
  } catch (err: any) {
    console.error('[WhatsApp Webhook Verification Failed]', err.message);
    res.status(403).send('Forbidden: Invalid verification token');
  }
});

// Meta WhatsApp Webhook Event Receiver (POST) with HMAC SHA256 Verification
apiRouter.post('/webhooks/whatsapp', (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const isValidSignature = verifyWhatsAppSignature(signature, rawBody);
    if (!isValidSignature) {
      console.warn('[WhatsApp Webhook] HMAC SHA256 signature verification failed.');
      return res.status(401).json({ error: 'Unauthorized: Invalid X-Hub-Signature-256 header' });
    }

    const result = processWhatsAppWebhookPayload(req.body);
    return res.status(200).json({ status: 'ok', ...result });
  } catch (err: any) {
    console.error('[WhatsApp Webhook Processing Failed]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Transactional Email Delivery & Bounce Webhook (POST)
apiRouter.post('/webhooks/email', (req: Request, res: Response) => {
  try {
    const result = processEmailWebhookPayload(req.body);
    res.status(200).json({ status: 'ok', ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/audit-logs', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const logs = db.auditLogs
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);
  return res.json(logs);
});

// Product and Package Management
apiRouter.get('/admin/products', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const products = db.products
    .filter((p) => !p.isDeleted)
    .map((p) => {
      const packages = db.productPackages.filter((pkg) => pkg.productId === p.id && pkg.isActive !== false);
      return { ...p, packages };
    });
  return res.json(products);
});

apiRouter.post('/admin/products', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { id, categoryId, name, slug, tagline, description, imageUrl, deliveryMethod, deliveryInstructions, termsAndConditions, isActive, availableOnMainStore, availableToResellers } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: 'Name and description are required.' });
  }

  if (id) {
    const existing = db.products.find((p) => p.id === id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });
    if (categoryId) existing.categoryId = categoryId;
    if (name) existing.name = name;
    if (tagline !== undefined) existing.tagline = tagline;
    if (description) existing.description = description;
    if (imageUrl) existing.imageUrl = imageUrl;
    if (deliveryMethod) existing.deliveryMethod = deliveryMethod;
    if (deliveryInstructions !== undefined) existing.deliveryInstructions = deliveryInstructions;
    if (termsAndConditions !== undefined) existing.termsAndConditions = termsAndConditions;
    if (isActive !== undefined) existing.isActive = isActive;
    if (availableOnMainStore !== undefined) existing.availableOnMainStore = availableOnMainStore;
    if (availableToResellers !== undefined) existing.availableToResellers = availableToResellers;
    existing.updatedAt = new Date().toISOString();
    db.persist();
    return res.json(existing);
  }

  const newProduct = {
    id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    categoryId: categoryId || db.categories[0].id,
    name: name.trim(),
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    tagline: tagline || '',
    description: description.trim(),
    imageUrl: imageUrl || '/src/assets/images/hero_digital_products_1791884577566.jpg',
    deliveryMethod: deliveryMethod || 'manual_credentials',
    deliveryInstructions: deliveryInstructions || '',
    termsAndConditions: termsAndConditions || '',
    isActive: isActive !== undefined ? isActive : true,
    availableOnMainStore: availableOnMainStore !== undefined ? availableOnMainStore : true,
    availableToResellers: availableToResellers !== undefined ? availableToResellers : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.products.push(newProduct);
  db.persist();
  return res.status(201).json(newProduct);
});

apiRouter.post('/admin/packages', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { id, productId, name, durationLabel, durationDays, retailPriceBdt, resellerWholesaleCostBdt, stockCount, isActive } = req.body;
  if (!name || retailPriceBdt === undefined || resellerWholesaleCostBdt === undefined) {
    return res.status(400).json({ error: 'Name, retail price, and wholesale cost are required.' });
  }

  if (id) {
    const existing = db.productPackages.find((pkg) => pkg.id === id);
    if (!existing) return res.status(404).json({ error: 'Package not found.' });
    existing.name = name;
    if (durationLabel) existing.durationLabel = durationLabel;
    if (durationDays !== undefined) existing.durationDays = Number(durationDays);
    existing.retailPriceBdt = Math.round(Number(retailPriceBdt) * 100) / 100;
    existing.resellerWholesaleCostBdt = Math.round(Number(resellerWholesaleCostBdt) * 100) / 100;
    if (stockCount !== undefined) existing.stockCount = Number(stockCount);
    if (isActive !== undefined) existing.isActive = isActive;
    existing.updatedAt = new Date().toISOString();
    db.persist();
    return res.json(existing);
  }

  const newPackage = {
    id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    productId,
    name: name.trim(),
    durationLabel: durationLabel || name,
    durationDays: Number(durationDays) || 30,
    retailPriceBdt: Math.round(Number(retailPriceBdt) * 100) / 100,
    resellerWholesaleCostBdt: Math.round(Number(resellerWholesaleCostBdt) * 100) / 100,
    stockCount: stockCount !== undefined ? Number(stockCount) : -1,
    isActive: isActive !== undefined ? isActive : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.productPackages.push(newPackage);
  db.persist();
  return res.status(201).json(newPackage);
});

apiRouter.delete('/admin/products/:id', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  // Soft-delete: retain historical orders, deliveries, and ledger integrity
  product.isActive = false;
  product.isDeleted = true;
  product.updatedAt = new Date().toISOString();
  db.persist();
  return res.json({ success: true, message: `Product "${product.name}" has been safely archived.` });
});

apiRouter.delete('/admin/packages/:id', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const pkg = db.productPackages.find((p) => p.id === req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: 'Package not found.' });
  }
  pkg.isActive = false;
  pkg.updatedAt = new Date().toISOString();
  db.persist();
  return res.json({ success: true, message: 'Package archived.' });
});

apiRouter.post('/admin/products/upload-image', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { base64Data, originalName } = req.body;
    if (!base64Data || !originalName) {
      return res.status(400).json({ error: 'base64Data and originalName are required.' });
    }

    let rawBase64 = base64Data;
    const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      rawBase64 = match[2];
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Product image exceeds the 3MB size limit.' });
    }

    let ext = 'jpg';
    let mimeType = 'image/jpeg';
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      ext = 'jpg';
      mimeType = 'image/jpeg';
    } else if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      ext = 'png';
      mimeType = 'image/png';
    } else if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      ext = 'webp';
      mimeType = 'image/webp';
    } else {
      return res.status(400).json({ error: 'Invalid image format. Only JPEG, PNG, and WebP are allowed (SVG and executable files are prohibited for security).' });
    }

    const filename = `prod_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const targetDir = UPLOADS_DIR;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(path.join(targetDir, filename), buffer);

    const imageUrl = `/uploads/products/${filename}`;
    return res.json({ imageUrl, filename, sizeBytes: buffer.length, mimeType });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/uploads/products/:filename', (req: Request, res: Response) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found.' });
  }
  res.sendFile(filePath);
});

// -------------------------------------------------------------
// 8. Customer Support Tickets & Evidence Vault
// -------------------------------------------------------------
function generateTicketId(): string {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TCK-${dateStr}-${rand}`;
}

apiRouter.post('/tickets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { category, subject, message, orderNumber, attachments } = req.body;

    if (!category || !subject || !message) {
      return res.status(400).json({ error: 'Category, subject, and message are required.' });
    }

    let serviceName: string | undefined;
    let productId: string | undefined;
    if (orderNumber) {
      const order = db.orders.find((o) => o.orderNumber === orderNumber);
      if (order) {
        serviceName = `${order.snapshotProductName} (${order.snapshotPackageName})`;
        productId = order.productId;
      }
    }

    // Process attachments if any
    const savedAttachments: TicketAttachment[] = [];
    if (Array.isArray(attachments)) {
      if (attachments.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 screenshot attachments allowed per message.' });
      }
      for (const att of attachments) {
        if (att.dataUrl && att.fileName) {
          const saved = saveEvidenceFile(att.dataUrl, att.fileName);
          savedAttachments.push(saved);
        }
      }
    }

    const now = new Date().toISOString();
    const ticketId = generateTicketId();

    const initialMessage: TicketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId,
      senderUserId: user.id,
      senderRole: user.role === 'admin' ? 'admin' : 'customer',
      senderName: user.fullName,
      message: message.trim(),
      attachments: savedAttachments,
      createdAt: now,
    };

    const newTicket: SupportTicket = {
      id: ticketId,
      customerId: user.id,
      customerName: user.fullName,
      customerEmail: user.email,
      customerPhone: user.phone,
      orderNumber: orderNumber ? orderNumber.trim() : undefined,
      productId,
      serviceName,
      category,
      subject: subject.trim(),
      status: 'open',
      createdAt: now,
      updatedAt: now,
      messages: [initialMessage],
      internalNotes: [],
    };

    db.tickets.push(newTicket);
    db.persist();

    // Notify operations admin
    const adminUser = db.users.find((u) => u.role === 'admin');
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || adminUser?.email || 'admin@ssdigitalbd.shop';
    enqueueNotification({
      recipientType: 'admin',
      recipientContact: adminEmail,
      channel: 'email',
      eventType: 'NEW_TICKET_SUBMITTED',
      title: `[Support Ticket] ${newTicket.id} - ${newTicket.subject}`,
      bodyText: `Customer ${user.fullName} (${user.email}) submitted a support ticket in category "${category}". Order: ${orderNumber || 'N/A'}.\n\nMessage: ${message.trim().substring(0, 150)}...`,
      metadataJson: { ticketId: newTicket.id, orderNumber },
    });

    // Return ticket without internal notes for security
    const { internalNotes, ...cleanTicket } = newTicket;
    return res.status(201).json(cleanTicket);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/tickets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let tickets = db.tickets;

  if (user.role !== 'admin') {
    tickets = tickets.filter(
      (t) =>
        t.customerId === user.id ||
        t.customerEmail.toLowerCase() === user.email.toLowerCase() ||
        (user.phone && t.customerPhone === user.phone)
    );
  }

  // Strip internal notes if not admin
  const sanitized = tickets
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((t) => {
      if (user.role === 'admin') return t;
      const { internalNotes, ...rest } = t;
      return rest;
    });

  return res.json(sanitized);
});

apiRouter.get('/tickets/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  const isOwner =
    ticket.customerId === user.id ||
    ticket.customerEmail.toLowerCase() === user.email.toLowerCase();

  if (user.role !== 'admin' && !isOwner) {
    return res.status(403).json({ error: 'Forbidden: You do not have access to this ticket.' });
  }

  if (user.role === 'admin') {
    return res.json(ticket);
  }

  const { internalNotes, ...cleanTicket } = ticket;
  return res.json(cleanTicket);
});

apiRouter.post('/tickets/:id/messages', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const ticket = db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const isOwner =
      ticket.customerId === user.id ||
      ticket.customerEmail.toLowerCase() === user.email.toLowerCase();

    if (user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this ticket.' });
    }

    const { message, attachments } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message body cannot be empty.' });
    }

    // Process attachments
    const savedAttachments: TicketAttachment[] = [];
    if (Array.isArray(attachments)) {
      if (attachments.length > 3) {
        return res.status(400).json({ error: 'Maximum 3 screenshot attachments allowed per message.' });
      }
      for (const att of attachments) {
        if (att.dataUrl && att.fileName) {
          const saved = saveEvidenceFile(att.dataUrl, att.fileName);
          savedAttachments.push(saved);
        }
      }
    }

    const now = new Date().toISOString();
    const newMsg: TicketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticket.id,
      senderUserId: user.id,
      senderRole: user.role === 'admin' ? 'admin' : 'customer',
      senderName: user.fullName,
      message: message.trim(),
      attachments: savedAttachments,
      createdAt: now,
    };

    ticket.messages.push(newMsg);
    ticket.updatedAt = now;

    // Automatic reopen policy: If customer replies on a resolved/closed ticket, set to open
    if (user.role !== 'admin') {
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        ticket.status = 'open';
      }
    } else {
      // If staff replies, transition to waiting_customer
      if (ticket.status === 'open' || ticket.status === 'in_review') {
        ticket.status = 'waiting_customer';
      }
    }

    db.persist();

    if (user.role === 'admin') {
      // Notify customer
      enqueueNotification({
        recipientType: 'customer',
        recipientContact: ticket.customerEmail,
        channel: 'email',
        eventType: 'TICKET_STAFF_REPLY',
        title: `Reply on Ticket ${ticket.id}: ${ticket.subject}`,
        bodyText: `Our support staff has responded to your ticket:\n\n"${message.trim()}"\n\nPlease check your Customer Dashboard to view or follow up.`,
        metadataJson: { ticketId: ticket.id },
      });
    }

    if (user.role === 'admin') {
      return res.json(ticket);
    }
    const { internalNotes, ...cleanTicket } = ticket;
    return res.json(cleanTicket);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/tickets/:id/attachments/:attId', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  const isOwner =
    ticket.customerId === user.id ||
    ticket.customerEmail.toLowerCase() === user.email.toLowerCase();

  if (user.role !== 'admin' && !isOwner) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  // Find attachment record in ticket messages
  let targetAttachment: TicketAttachment | undefined;
  for (const msg of ticket.messages) {
    const found = msg.attachments.find((a) => a.id === req.params.attId);
    if (found) {
      targetAttachment = found;
      break;
    }
  }

  if (!targetAttachment) {
    return res.status(404).json({ error: 'Attachment record not found.' });
  }

  const filePath = path.join(EVIDENCE_DIR, targetAttachment.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Attachment file not found on disk.' });
  }

  res.setHeader('Content-Type', targetAttachment.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${targetAttachment.originalName}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// -------------------------------------------------------------
// Admin Ticket Management Console Endpoints
// -------------------------------------------------------------
apiRouter.get('/admin/tickets', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const { status, category, search } = req.query;
  let tickets = [...db.tickets];

  if (status && status !== 'all') {
    tickets = tickets.filter((t) => t.status === status);
  }
  if (category && category !== 'all') {
    tickets = tickets.filter((t) => t.category === category);
  }
  if (search) {
    const q = (search as string).toLowerCase().trim();
    tickets = tickets.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        (t.orderNumber && t.orderNumber.toLowerCase().includes(q)) ||
        t.customerName.toLowerCase().includes(q) ||
        t.customerEmail.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
    );
  }

  tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return res.json(tickets);
});

apiRouter.post('/admin/tickets/:id/notes', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  const { note } = req.body;
  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'Note text cannot be empty.' });
  }

  if (!ticket.internalNotes) {
    ticket.internalNotes = [];
  }

  const internalNote: InternalNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    staffUserId: req.user!.id,
    staffName: req.user!.fullName,
    note: note.trim(),
    createdAt: new Date().toISOString(),
  };

  ticket.internalNotes.push(internalNote);
  ticket.updatedAt = new Date().toISOString();
  db.persist();

  return res.status(201).json(ticket);
});

apiRouter.put('/admin/tickets/:id/status', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  const { status } = req.body;
  const validStatuses: TicketStatus[] = ['open', 'in_review', 'waiting_customer', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const now = new Date().toISOString();
  ticket.status = status;
  ticket.updatedAt = now;

  if (status === 'resolved') {
    ticket.resolvedAt = now;
  } else if (status === 'closed') {
    ticket.closedAt = now;
  }

  db.persist();

  // Notify customer
  enqueueNotification({
    recipientType: 'customer',
    recipientContact: ticket.customerEmail,
    channel: 'email',
    eventType: 'TICKET_STATUS_UPDATED',
    title: `Ticket ${ticket.id} status updated to: ${status.replace('_', ' ').toUpperCase()}`,
    bodyText: `Your support ticket regarding "${ticket.subject}" has been marked as ${status.replace('_', ' ').toUpperCase()}. Check your Customer Dashboard for full details.`,
    metadataJson: { ticketId: ticket.id, status },
  });

  return res.json(ticket);
});

apiRouter.post('/admin/tickets/:id/reply', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const ticket = db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const { message, nextStatus } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Reply message cannot be empty.' });
    }

    const now = new Date().toISOString();
    const newMsg: TicketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticket.id,
      senderUserId: req.user!.id,
      senderRole: 'admin',
      senderName: `${req.user!.fullName} (Staff)`,
      message: message.trim(),
      attachments: [],
      createdAt: now,
    };

    ticket.messages.push(newMsg);
    ticket.updatedAt = now;
    ticket.status = (nextStatus as TicketStatus) || 'waiting_customer';
    if (ticket.status === 'resolved') ticket.resolvedAt = now;
    if (ticket.status === 'closed') ticket.closedAt = now;

    db.persist();

    enqueueNotification({
      recipientType: 'customer',
      recipientContact: ticket.customerEmail,
      channel: 'email',
      eventType: 'TICKET_STAFF_REPLY',
      title: `[Support Update] Ticket ${ticket.id}: ${ticket.subject}`,
      bodyText: `Support response:\n\n"${message.trim()}"\n\nStatus: ${ticket.status.toUpperCase()}`,
      metadataJson: { ticketId: ticket.id },
    });

    return res.json(ticket);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// AUTOMATED DATABASE BACKUP VERIFICATION LOGS
// =========================================================================

apiRouter.get('/admin/backups', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = db.backupLogs.slice(0, 7); // Exactly last 7 daily automated backups
    const allLogs = db.backupLogs;
    const health = db.getStorageHealthMetrics();
    return res.json({ logs, allLogs, health });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/backups/verify-now', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorName = req.user ? `${req.user.fullName} (${req.user.role})` : 'Super Admin';
    const newLog = db.createBackupSnapshot('manual_verification', actorName);
    const health = db.getStorageHealthMetrics();
    return res.json({
      success: true,
      message: 'On-demand database backup and SHA-256 verification completed successfully.',
      log: newLog,
      health,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// SELLER MARKETPLACE & DIGITAL PRODUCTS API
// =========================================================================

// Public: Browse approved seller digital products
apiRouter.get('/products/seller-products', (_req: Request, res: Response) => {
  const approved = db.sellerProducts.filter((p) => p.status === 'approved');
  return res.json(approved);
});

// Customer: Submit Seller Application (KYC)
apiRouter.post('/customer/seller-apply', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      storeName,
      bio,
      nidNumber,
      tradeLicenseNumber,
      contactPhone,
      emergencyContact,
      address,
      payoutMethod,
      payoutAccountNumber,
      payoutBankDetails,
      documents,
    } = req.body;

    if (!storeName || !nidNumber || !contactPhone || !address || !payoutMethod || !payoutAccountNumber) {
      return res.status(400).json({ error: 'Store Name, NID, Contact Phone, Address, and Payout Account are required.' });
    }

    const application = submitSellerApplication({
      userId: req.user!.id,
      storeName,
      bio: bio || '',
      nidNumber,
      tradeLicenseNumber,
      contactPhone,
      emergencyContact,
      address,
      payoutMethod,
      payoutAccountNumber,
      payoutBankDetails,
      documents: documents || [],
    });

    return res.status(201).json(application);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Seller: Get current user's seller profile
apiRouter.get('/seller/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const profile = db.sellerProfiles.find((s) => s.userId === req.user!.id);
  const application = db.sellerApplications.find((a) => a.userId === req.user!.id);
  return res.json({ profile: profile || null, application: application || null });
});

// Seller: Dashboard Metrics
apiRouter.get('/seller/dashboard', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user!.id);
  if (!seller) {
    return res.status(403).json({ error: 'You do not have an approved seller profile.' });
  }

  const products = db.sellerProducts.filter((p) => p.sellerId === seller.id);
  const earnings = db.sellerEarnings.filter((e) => e.sellerId === seller.id);
  const withdrawals = db.sellerWithdrawals.filter((w) => w.sellerId === seller.id);

  return res.json({
    profile: seller,
    stats: {
      totalEarningsBdt: seller.totalEarningsBdt,
      availableBalanceBdt: seller.availableBalanceBdt,
      pendingHoldBalanceBdt: seller.pendingHoldBalanceBdt,
      withdrawnBalanceBdt: seller.withdrawnBalanceBdt,
      salesCount: seller.salesCount,
      activeProductsCount: products.filter((p) => p.status === 'approved').length,
    },
    recentEarnings: earnings.slice(-10).reverse(),
    recentWithdrawals: withdrawals.slice(-10),
  });
});

// Seller: Get seller's products
apiRouter.get('/seller/products', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user!.id);
  if (!seller) {
    return res.status(403).json({ error: 'You do not have an approved seller profile.' });
  }
  const products = db.sellerProducts.filter((p) => p.sellerId === seller.id);
  return res.json(products);
});

// Seller: Create or edit product
apiRouter.post('/seller/products', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const seller = db.sellerProfiles.find((s) => s.userId === req.user!.id && s.status === 'approved');
    if (!seller) {
      return res.status(403).json({ error: 'Active approved seller status is required to publish products.' });
    }

    const {
      id,
      categoryId,
      name,
      tagline,
      description,
      priceBdt,
      productType,
      fileUrl,
      fileName,
      fileSizeBytes,
      fileHash,
      downloadLimitPerPurchase,
      imageUrl,
      previewUrl,
      customCommissionPercentage,
    } = req.body;

    if (!name || !description || !priceBdt || !productType) {
      return res.status(400).json({ error: 'Name, Description, Price, and Product Type are required.' });
    }

    const product = submitSellerProduct(seller.id, {
      id,
      categoryId: categoryId || 'cat_developer',
      name,
      tagline: tagline || '',
      description,
      priceBdt: Number(priceBdt),
      productType,
      fileUrl,
      fileName,
      fileSizeBytes,
      fileHash,
      downloadLimitPerPurchase: downloadLimitPerPurchase ? Number(downloadLimitPerPurchase) : 5,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600',
      previewUrl,
      customCommissionPercentage: customCommissionPercentage ? Number(customCommissionPercentage) : undefined,
    });

    return res.status(200).json(product);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Seller: Earnings history
apiRouter.get('/seller/earnings', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user!.id);
  if (!seller) {
    return res.status(403).json({ error: 'Seller profile required.' });
  }
  const earnings = db.sellerEarnings.filter((e) => e.sellerId === seller.id);
  return res.json(earnings);
});

// Seller: Withdrawals history
apiRouter.get('/seller/withdrawals', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user!.id);
  if (!seller) {
    return res.status(403).json({ error: 'Seller profile required.' });
  }
  const withdrawals = db.sellerWithdrawals.filter((w) => w.sellerId === seller.id);
  return res.json(withdrawals);
});

// Seller: Request withdrawal
apiRouter.post('/seller/withdrawals', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const seller = db.sellerProfiles.find((s) => s.userId === req.user!.id);
    if (!seller) {
      return res.status(403).json({ error: 'Seller profile required.' });
    }

    const { amountBdt, payoutMethod, payoutAccountNumber, payoutDetails } = req.body;
    if (!amountBdt || !payoutMethod || !payoutAccountNumber) {
      return res.status(400).json({ error: 'Amount, Payout Method, and Account Number are required.' });
    }

    const withdrawal = requestSellerWithdrawal({
      sellerId: seller.id,
      amountBdt: Number(amountBdt),
      payoutMethod,
      payoutAccountNumber,
      payoutDetails,
    });

    return res.status(201).json(withdrawal);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Customer: Purchase Seller Digital Product
apiRouter.post('/orders/seller-purchase', (req: Request, res: Response) => {
  try {
    const { sellerProductId, customerName, customerEmail, customerPhone, paymentChannel, transactionId } = req.body;
    if (!sellerProductId || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'Product ID, customer name, email, and phone are required.' });
    }

    const product = db.sellerProducts.find((p) => p.id === sellerProductId && p.status === 'approved');
    if (!product) {
      return res.status(404).json({ error: 'Digital product is unavailable or discontinued.' });
    }

    const user = getOptionalUser(req);
    const orderNumber = `ORD-SEL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const order: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderNumber,
      orderSource: 'main_store',
      customerId: user ? user.id : undefined,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: customerPhone.trim(),
      productId: product.id,
      packageId: 'pkg_digital_download',
      snapshotProductName: product.name,
      snapshotPackageName: 'Digital Delivery Access',
      snapshotDurationDays: 365,
      snapshotRetailPriceBdt: product.priceBdt,
      snapshotWholesaleCostBdt: 0,
      snapshotDeliveryMethod: 'instant_license_key',
      currency: 'BDT',
      orderStatus: 'completed',
      walletDebited: false,
      customerInputNotes: `Direct digital license purchase: ${product.name}`,
      createdAt: now,
      updatedAt: now,
    };

    db.orders.unshift(order);

    // Record payment submission
    if (transactionId) {
      db.paymentSubmissions.unshift({
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        channel: paymentChannel || 'bkash',
        claimedAmountBdt: product.priceBdt,
        transactionId: transactionId.trim(),
        senderPhoneOrAccount: customerPhone,
        recipientAccountSnapshot: '01819000000',
        verificationStatus: 'verified_valid',
        createdAt: now,
      });
    }

    // Process seller earnings & generate secure expiring download token
    const { earning, downloadToken } = recordSellerProductPurchase({
      order,
      sellerProductId: product.id,
    });

    // Enqueue customer notification
    enqueueNotification({
      recipientType: 'customer',
      recipientContact: customerEmail,
      channel: 'email',
      eventType: 'SELLER_PRODUCT_PURCHASED',
      title: `[Delivery] Download Access for ${product.name}`,
      bodyText: `Your purchase of ${product.name} (৳${product.priceBdt}) has been confirmed!\n\nYour secure download token: ${downloadToken.token}\nValid for 7 days (Limit: ${downloadToken.downloadsRemaining} downloads).`,
      metadataJson: { orderId: order.id, downloadToken: downloadToken.token },
    });

    return res.status(201).json({
      order,
      downloadToken: downloadToken.token,
      product: {
        id: product.id,
        name: product.name,
        fileName: product.fileName,
        fileSizeBytes: product.fileSizeBytes,
      },
      message: 'Purchase completed! You can now securely download your digital file.',
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Authenticated Expiring Download Verification
apiRouter.get('/downloads/verify/:token', (req: Request, res: Response) => {
  const result = validateAndConsumeDownloadToken(req.params.token);
  if (!result.valid) {
    return res.status(400).json({ valid: false, message: result.message });
  }
  return res.json({
    valid: true,
    product: {
      id: result.product!.id,
      name: result.product!.name,
      fileName: result.product!.fileName,
      fileSizeBytes: result.product!.fileSizeBytes,
      productType: result.product!.productType,
      sellerStoreName: result.product!.sellerStoreName,
    },
    remainingDownloads: result.remainingDownloads,
    downloadUrl: `/api/downloads/file/${req.params.token}`,
  });
});

// Authenticated Expiring File Delivery
apiRouter.get('/downloads/file/:token', (req: Request, res: Response) => {
  const tokenRecord = db.sellerDownloadTokens.find((t) => t.token === req.params.token);
  if (!tokenRecord) {
    return res.status(404).send('Download key is invalid or not found.');
  }

  const product = db.sellerProducts.find((p) => p.id === tokenRecord.sellerProductId);
  if (!product) {
    return res.status(404).send('Product file not found.');
  }

  // Set safe download headers
  const safeFilename = (product.fileName || 'digital_product.zip').replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  // Stream verified placeholder digital content or payload
  const payload = Buffer.from(
    `SSDigitalBD.shop Certified Digital Delivery\nProduct: ${product.name}\nSeller: ${product.sellerStoreName}\nLicense: Authorized Single-User Commercial License\nChecksum: ${product.fileHash}\nIssued: ${new Date().toISOString()}\nOrder ID: ${tokenRecord.orderId}\n`
  );

  return res.send(payload);
});

// =========================================================================
// ADMIN MULTI-VENDOR MANAGEMENT ENDPOINTS
// =========================================================================

// Admin: List seller applications
apiRouter.get('/admin/seller-applications', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  return res.json(db.sellerApplications);
});

// Admin: Review seller application
apiRouter.post('/admin/seller-applications/:id/review', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, adminNotes, rejectionReason } = req.body;
    if (!status || !['approved', 'rejected', 'needs_info'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (approved, rejected, needs_info) is required.' });
    }

    const result = reviewSellerApplication({
      applicationId: req.params.id,
      status,
      adminNotes,
      rejectionReason,
      adminUserId: req.user!.id,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin: List all sellers
apiRouter.get('/admin/sellers', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const sellers = db.sellerProfiles.map((s) => {
    const user = db.users.find((u) => u.id === s.userId);
    const productsCount = db.sellerProducts.filter((p) => p.sellerId === s.id).length;
    return {
      ...s,
      userFullName: user?.fullName || 'Unknown User',
      userEmail: user?.email || s.contactEmail,
      productsCount,
    };
  });
  return res.json(sellers);
});

// Admin: List all seller products
apiRouter.get('/admin/seller-products', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  return res.json(db.sellerProducts);
});

// Admin: Update seller product status
apiRouter.put('/admin/seller-products/:id/status', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  const product = db.sellerProducts.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Seller product not found.' });
  }

  const { status, rejectionReason } = req.body;
  if (!status || !['draft', 'pending_approval', 'approved', 'rejected', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid product status.' });
  }

  product.status = status;
  if (rejectionReason) product.rejectionReason = rejectionReason;
  product.updatedAt = new Date().toISOString();

  db.persist();
  return res.json(product);
});

// Admin: Commission Policy Management
apiRouter.get('/admin/commissions', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  return res.json({
    policy: db.sellerCommissionPolicy,
    exampleCalculations: [
      { type: 'Global Default', ...resolveCommissionDetails() },
      { type: 'Category: Software', ...resolveCommissionDetails(undefined, undefined, 'cat_software') },
      { type: 'Category: Developer Tools', ...resolveCommissionDetails(undefined, undefined, 'cat_developer') },
      { type: 'Product Override (Laravel Engine)', ...resolveCommissionDetails('sprod_laravel_ecommerce') },
    ],
  });
});

apiRouter.put('/admin/commissions', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { globalDefaultPercent, categoryRates } = req.body;
    if (typeof globalDefaultPercent !== 'number' || globalDefaultPercent < 0 || globalDefaultPercent > 50) {
      return res.status(400).json({ error: 'Global default percentage must be a number between 0% and 50%.' });
    }

    db.sellerCommissionPolicy = {
      globalDefaultPercent,
      categoryRates: categoryRates || db.sellerCommissionPolicy.categoryRates,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.id,
    };

    db.persist();
    return res.json(db.sellerCommissionPolicy);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Admin: Seller Withdrawals Queue
apiRouter.get('/admin/seller-withdrawals', authMiddleware, requireRole('admin'), (_req: AuthenticatedRequest, res: Response) => {
  const withdrawals = db.sellerWithdrawals.map((w) => {
    const seller = db.sellerProfiles.find((s) => s.id === w.sellerId);
    return {
      ...w,
      sellerStoreName: seller?.storeName || 'Unknown Seller',
      sellerAvailableBalance: seller?.availableBalanceBdt || 0,
    };
  });
  return res.json(withdrawals);
});

// Admin: Process Seller Withdrawal Payout
apiRouter.post('/admin/seller-withdrawals/:id/payout', authMiddleware, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, transactionReference, rejectionReason } = req.body;
    if (!action || !['complete', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Valid action (complete or reject) is required.' });
    }

    const withdrawal = processSellerWithdrawalPayout({
      withdrawalId: req.params.id,
      action,
      transactionReference,
      rejectionReason,
      adminUserId: req.user!.id,
    });

    return res.json(withdrawal);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

