/**
 * Order Management & Fulfillment Service
 * Implements strict separation between Reseller Store & Main Store workflows.
 * Enforces two-step verification, atomic wholesale debit, hold states, and immutable reversals.
 */

import { db } from '../db/store.ts';
import {
  Order,
  PaymentSubmission,
  Delivery,
  OrderSource,
  OrderStatus,
} from '../types/index.ts';
import { debitWallet, creditWallet } from './wallet.ts';
import { enqueueNotification } from './notifications.ts';

function generateOrderNumber(prefix = 'ORD'): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
}

// -------------------------------------------------------------
// 1. Order Creation
// -------------------------------------------------------------
export interface CreateOrderParams {
  orderSource: OrderSource;
  storeId?: string; // required if reseller_store
  customerId?: string;
  productId: string;
  packageId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerInputNotes?: string;
}

export function createOrder(params: CreateOrderParams): Order {
  const product = db.products.find((p) => p.id === params.productId && p.isActive);
  if (!product) {
    throw new Error('Selected product is currently unavailable or disabled.');
  }

  const pkg = db.productPackages.find((p) => p.id === params.packageId && p.isActive);
  if (!pkg) {
    throw new Error('Selected package duration is currently unavailable or disabled.');
  }

  let resellerId: string | undefined;
  if (params.orderSource === 'reseller_store') {
    if (!params.storeId) {
      throw new Error('Store ID is required for reseller orders.');
    }
    const store = db.stores.find((s) => s.id === params.storeId && s.status === 'active');
    if (!store) {
      throw new Error('Reseller store is invalid, inactive, or suspended.');
    }
    if (!product.availableToResellers) {
      throw new Error('This product is not eligible for reseller store distribution.');
    }
    resellerId = store.resellerId;
  } else {
    if (!product.availableOnMainStore) {
      throw new Error('This product is not available for purchase on the Main Store.');
    }
  }

  const orderNumber = generateOrderNumber(params.orderSource === 'reseller_store' ? 'RES' : 'MAIN');

  const order: Order = {
    id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderNumber,
    orderSource: params.orderSource,
    storeId: params.storeId,
    resellerId,
    customerId: params.customerId,
    customerName: params.customerName.trim(),
    customerEmail: params.customerEmail.trim().toLowerCase(),
    customerPhone: params.customerPhone.trim(),

    // Immutable price & terms snapshot
    productId: product.id,
    packageId: pkg.id,
    snapshotProductName: product.name,
    snapshotPackageName: pkg.name,
    snapshotDurationDays: pkg.durationDays,
    snapshotRetailPriceBdt: pkg.retailPriceBdt,
    snapshotWholesaleCostBdt: pkg.resellerWholesaleCostBdt,
    snapshotDeliveryMethod: product.deliveryMethod,
    currency: 'BDT',

    orderStatus: 'payment_submitted',
    walletDebited: false,
    customerInputNotes: params.customerInputNotes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.orders.push(order);
  db.persist();

  // Notification: Customer & Reseller/Admin
  enqueueNotification({
    recipientType: 'customer',
    recipientContact: order.customerEmail,
    channel: 'email',
    eventType: 'ORDER_PLACED',
    title: `Order Placed: ${order.orderNumber}`,
    bodyText: `Your order for "${order.snapshotProductName} (${order.snapshotPackageName})" has been received. Please submit your payment reference to proceed.`,
    metadataJson: { orderId: order.id, orderNumber: order.orderNumber },
  });

  if (params.orderSource === 'reseller_store' && resellerId) {
    const reseller = db.users.find((u) => u.id === resellerId);
    if (reseller) {
      enqueueNotification({
        recipientType: 'reseller',
        recipientContact: reseller.email,
        channel: 'email',
        eventType: 'RESELLER_NEW_ORDER',
        title: `New Customer Order on Your Store: ${order.orderNumber}`,
        bodyText: `Customer ${order.customerName} ordered ${order.snapshotProductName}. Total retail: ৳${order.snapshotRetailPriceBdt.toFixed(2)}. Wholesale: ৳${order.snapshotWholesaleCostBdt.toFixed(2)}.`,
        metadataJson: { orderId: order.id },
      });
    }
  }

  return order;
}

// -------------------------------------------------------------
// 2. Customer Payment Submission (External Payment Claim)
// -------------------------------------------------------------
export interface SubmitPaymentParams {
  orderId: string;
  channel: 'bkash' | 'nagad' | 'rocket' | 'bank_transfer' | 'sslcommerz_gateway';
  claimedAmountBdt: number;
  transactionId: string;
  senderPhoneOrAccount: string;
  screenshotProofUrl?: string;
}

export function submitOrderPayment(params: SubmitPaymentParams): PaymentSubmission {
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new Error('Order not found.');
  }

  const normalizedTxn = params.transactionId.trim().toUpperCase();
  if (normalizedTxn.length < 4) {
    throw new Error('Transaction ID must be valid and non-empty.');
  }

  // Determine recipient account snapshot based on store
  let recipientSnapshot = 'MAIN_STORE_MERCHANT';
  if (order.orderSource === 'reseller_store' && order.storeId) {
    const store = db.stores.find((s) => s.id === order.storeId);
    recipientSnapshot = store?.subdomain || `STORE_${order.storeId}`;
  }

  // Duplicate Check: Same channel, transaction ID, and recipient
  const duplicate = db.paymentSubmissions.find(
    (p) =>
      p.channel === params.channel &&
      p.transactionId.toUpperCase() === normalizedTxn &&
      p.recipientAccountSnapshot === recipientSnapshot
  );
  if (duplicate) {
    throw new Error(
      `Transaction ID "${normalizedTxn}" has already been submitted for this payment channel and recipient.`
    );
  }

  const submission: PaymentSubmission = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderId: order.id,
    channel: params.channel,
    claimedAmountBdt: Math.round(params.claimedAmountBdt * 100) / 100,
    transactionId: normalizedTxn,
    senderPhoneOrAccount: params.senderPhoneOrAccount.trim(),
    recipientAccountSnapshot: recipientSnapshot,
    screenshotProofUrl: params.screenshotProofUrl,
    verificationStatus: 'submitted',
    createdAt: new Date().toISOString(),
  };

  db.paymentSubmissions.push(submission);
  order.orderStatus = 'payment_submitted';
  order.updatedAt = new Date().toISOString();
  db.persist();

  // Notification: Customer & Reseller
  enqueueNotification({
    recipientType: 'customer',
    recipientContact: order.customerEmail,
    channel: 'email',
    eventType: 'PAYMENT_SUBMITTED',
    title: `Payment Details Received: ${order.orderNumber}`,
    bodyText: `We have received your payment reference "${normalizedTxn}". Verification is under review by the store operator.`,
    metadataJson: { orderId: order.id, transactionId: normalizedTxn },
  });

  return submission;
}

// -------------------------------------------------------------
// 3. Reseller Payment Verification & Wholesale Wallet Debit
// -------------------------------------------------------------
export interface VerifyResellerPaymentParams {
  orderId: string;
  submissionId: string;
  resellerUserId: string;
  decision: 'approve_verified' | 'reject_invalid';
  verificationNotes?: string;
}

export function verifyResellerCustomerPayment(params: VerifyResellerPaymentParams): {
  order: Order;
  walletDebitSuccess: boolean;
  holdReason?: string;
} {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === params.orderId);
    if (!order) {
      throw new Error('Order not found.');
    }
    if (order.orderSource !== 'reseller_store') {
      throw new Error('Only reseller orders are verified by resellers.');
    }
    if (order.resellerId !== params.resellerUserId) {
      throw new Error('Unauthorized: You can only verify orders belonging to your own store.');
    }

    const submission = db.paymentSubmissions.find((p) => p.id === params.submissionId);
    if (!submission || submission.orderId !== order.id) {
      throw new Error('Payment submission record not found for this order.');
    }

    if (params.decision === 'reject_invalid') {
      submission.verificationStatus = 'rejected_invalid';
      submission.verifiedByUserId = params.resellerUserId;
      submission.verifiedAt = new Date().toISOString();
      submission.verificationNotes = params.verificationNotes || 'Payment rejected by reseller.';

      order.orderStatus = 'payment_rejected';
      order.rejectionReason = params.verificationNotes || 'Invalid or mismatched payment reference.';
      order.updatedAt = new Date().toISOString();

      enqueueNotification({
        recipientType: 'customer',
        recipientContact: order.customerEmail,
        channel: 'email',
        eventType: 'PAYMENT_REJECTED',
        title: `Payment Verification Unsuccessful: ${order.orderNumber}`,
        bodyText: `Your payment reference was marked invalid. Reason: ${order.rejectionReason}. Please contact store support.`,
        metadataJson: { orderId: order.id },
      });

      return { order, walletDebitSuccess: false, holdReason: order.rejectionReason };
    }

    // Amount match check
    if (submission.claimedAmountBdt < order.snapshotRetailPriceBdt) {
      throw new Error(
        `Claimed amount (৳${submission.claimedAmountBdt.toFixed(2)}) is less than required retail price (৳${order.snapshotRetailPriceBdt.toFixed(2)}).`
      );
    }

    // Payment is verified
    submission.verificationStatus = 'verified_valid';
    submission.verifiedByUserId = params.resellerUserId;
    submission.verifiedAt = new Date().toISOString();
    submission.verificationNotes = params.verificationNotes || 'Payment verified by reseller operator.';

    // Check Reseller Wallet Balance for Wholesale Cost
    const wallet = db.resellerWallets.find((w) => w.resellerId === params.resellerUserId);
    const availableBalance = wallet ? wallet.availableBalanceBdt : 0;
    const requiredWholesaleCost = order.snapshotWholesaleCostBdt;

    if (availableBalance < requiredWholesaleCost) {
      // INSUFFICIENT WALLET: Order held in wallet_pending
      order.orderStatus = 'wallet_pending';
      order.adminNotes = `Customer payment verified, but reseller wallet balance (৳${availableBalance.toFixed(2)}) is insufficient for wholesale cost (৳${requiredWholesaleCost.toFixed(2)}).`;
      order.updatedAt = new Date().toISOString();

      enqueueNotification({
        recipientType: 'reseller',
        recipientContact: (db.users.find((u) => u.id === params.resellerUserId))?.email || '',
        channel: 'email',
        eventType: 'WALLET_INSUFFICIENT_HOLD',
        title: `Order Held: Insufficient Wallet Balance (${order.orderNumber})`,
        bodyText: `Customer payment was verified for ${order.orderNumber}, but your wallet balance is insufficient (Needed: ৳${requiredWholesaleCost.toFixed(2)}, Available: ৳${availableBalance.toFixed(2)}). Please top up your wallet to send the order to Main Admin approval.`,
        metadataJson: { orderId: order.id, needed: requiredWholesaleCost, available: availableBalance },
      });

      return {
        order,
        walletDebitSuccess: false,
        holdReason: 'Insufficient reseller wallet balance. Order held in wallet_pending.',
      };
    }

    // SUFFICIENT WALLET: Atomically debit wholesale cost
    const debitRef = `DEBIT-ORD-${order.orderNumber}`;
    const idempotencyKey = `IDEMP-DEBIT-${order.id}`;

    const ledgerEntry = debitWallet({
      resellerId: params.resellerUserId,
      amountBdt: requiredWholesaleCost,
      entryType: 'order_wholesale_debit',
      referenceId: debitRef,
      idempotencyKey,
      reason: `Wholesale cost for Order #${order.orderNumber} (${order.snapshotProductName})`,
      orderId: order.id,
      actorUserId: params.resellerUserId,
    });

    order.walletDebited = true;
    order.walletDebitLedgerId = ledgerEntry.id;
    order.orderStatus = 'pending_admin_approval';
    order.updatedAt = new Date().toISOString();

    // Notify Main Admin: Order ready for final approval
    enqueueNotification({
      recipientType: 'admin',
      recipientContact: 'admin@digimarket.com',
      channel: 'email',
      eventType: 'ORDER_READY_FOR_ADMIN_APPROVAL',
      title: `Order Ready for Admin Approval: ${order.orderNumber}`,
      bodyText: `Reseller verified payment & wholesale cost ৳${requiredWholesaleCost.toFixed(2)} debited. Final approval required.`,
      metadataJson: { orderId: order.id, ledgerId: ledgerEntry.id },
    });

    return { order, walletDebitSuccess: true };
  });
}

/**
 * Retry wholesale debit for an order currently held in wallet_pending
 */
export function retryWalletDebitForHeldOrder(orderId: string, resellerUserId: string): Order {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error('Order not found.');
    }
    if (order.resellerId !== resellerUserId) {
      throw new Error('Unauthorized.');
    }
    if (order.orderStatus !== 'wallet_pending') {
      throw new Error(`Order is in status "${order.orderStatus}", not "wallet_pending".`);
    }

    const wallet = db.resellerWallets.find((w) => w.resellerId === resellerUserId);
    const available = wallet ? wallet.availableBalanceBdt : 0;
    if (available < order.snapshotWholesaleCostBdt) {
      throw new Error(
        `Wallet balance still insufficient. Needed: ৳${order.snapshotWholesaleCostBdt.toFixed(2)}, Available: ৳${available.toFixed(2)}`
      );
    }

    const debitRef = `DEBIT-ORD-${order.orderNumber}`;
    const idempotencyKey = `IDEMP-DEBIT-${order.id}`;

    const ledgerEntry = debitWallet({
      resellerId: resellerUserId,
      amountBdt: order.snapshotWholesaleCostBdt,
      entryType: 'order_wholesale_debit',
      referenceId: debitRef,
      idempotencyKey,
      reason: `Wholesale cost for Order #${order.orderNumber} (Retry after top-up)`,
      orderId: order.id,
      actorUserId: resellerUserId,
    });

    order.walletDebited = true;
    order.walletDebitLedgerId = ledgerEntry.id;
    order.orderStatus = 'pending_admin_approval';
    order.updatedAt = new Date().toISOString();

    return order;
  });
}

// -------------------------------------------------------------
// 4. Main Store Payment Verification (Direct by Admin/Gateway)
// -------------------------------------------------------------
export function verifyMainStorePayment(orderId: string, submissionId: string, adminUserId: string): Order {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order || order.orderSource !== 'main_store') {
    throw new Error('Order not found or not a Main Store order.');
  }

  const submission = db.paymentSubmissions.find((p) => p.id === submissionId);
  if (!submission) {
    throw new Error('Payment submission not found.');
  }

  submission.verificationStatus = 'verified_valid';
  submission.verifiedByUserId = adminUserId;
  submission.verifiedAt = new Date().toISOString();

  order.orderStatus = 'admin_approved';
  order.updatedAt = new Date().toISOString();
  db.persist();

  return order;
}

// -------------------------------------------------------------
// 5. Main Admin Final Order Approval & Reversal Flow
// -------------------------------------------------------------
export function adminApproveOrder(orderId: string, adminUserId: string, adminNotes?: string): Order {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error('Order not found.');
    }
    if (order.orderStatus !== 'pending_admin_approval' && order.orderStatus !== 'payment_verified') {
      throw new Error(`Order in status "${order.orderStatus}" cannot be approved.`);
    }

    order.orderStatus = 'admin_approved';
    order.adminNotes = adminNotes || 'Approved by Main Admin.';
    order.updatedAt = new Date().toISOString();

    // Provision Delivery record
    const delivery: Delivery = {
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: order.id,
      fulfillmentMethod: order.snapshotDeliveryMethod,
      instructionsForCustomer: 'Your product will be delivered to your account / email shortly.',
      state: 'queued',
      attemptsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.deliveries.push(delivery);

    // Notify Customer & Reseller
    enqueueNotification({
      recipientType: 'customer',
      recipientContact: order.customerEmail,
      channel: 'email',
      eventType: 'ORDER_ADMIN_APPROVED',
      title: `Order Approved & Queued for Delivery: ${order.orderNumber}`,
      bodyText: `Your order #${order.orderNumber} for "${order.snapshotProductName}" has been approved and entered the fulfillment queue.`,
      metadataJson: { orderId: order.id },
    });

    return order;
  });
}

export function adminRejectOrder(orderId: string, adminUserId: string, rejectionReason: string): Order {
  if (!rejectionReason || rejectionReason.trim().length < 5) {
    throw new Error('A detailed reason is required for order rejection.');
  }

  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error('Order not found.');
    }

    // If reseller order had wallet debited, refund wholesale cost via compensating ledger entry
    if (order.orderSource === 'reseller_store' && order.walletDebited && order.resellerId) {
      const reversalRef = `REV-ORD-${order.orderNumber}`;
      const idempotencyKey = `IDEMP-REV-ORD-${order.id}`;

      const refundLedger = creditWallet({
        resellerId: order.resellerId,
        amountBdt: order.snapshotWholesaleCostBdt,
        entryType: 'order_reversal_credit',
        referenceId: reversalRef,
        idempotencyKey,
        reason: `Wholesale refund for rejected Order #${order.orderNumber}: ${rejectionReason}`,
        orderId: order.id,
        actorUserId: adminUserId,
      });

      order.walletReversalLedgerId = refundLedger.id;
    }

    order.orderStatus = 'admin_rejected';
    order.rejectionReason = rejectionReason;
    order.updatedAt = new Date().toISOString();

    // Notify Customer & Reseller
    enqueueNotification({
      recipientType: 'customer',
      recipientContact: order.customerEmail,
      channel: 'email',
      eventType: 'ORDER_ADMIN_REJECTED',
      title: `Order Unsuccessful: ${order.orderNumber}`,
      bodyText: `Order #${order.orderNumber} was rejected by the administration. Reason: ${rejectionReason}`,
      metadataJson: { orderId: order.id },
    });

    if (order.resellerId) {
      const reseller = db.users.find((u) => u.id === order.resellerId);
      if (reseller) {
        enqueueNotification({
          recipientType: 'reseller',
          recipientContact: reseller.email,
          channel: 'email',
          eventType: 'ORDER_REJECTED_REFUNDED',
          title: `Order Rejected & Wholesale Cost Refunded (${order.orderNumber})`,
          bodyText: `Order #${order.orderNumber} was rejected by Admin. Wholesale cost ৳${order.snapshotWholesaleCostBdt.toFixed(2)} has been credited back to your wallet. Reason: ${rejectionReason}`,
          metadataJson: { orderId: order.id },
        });
      }
    }

    return order;
  });
}

// -------------------------------------------------------------
// 6. Fulfillment & Delivery Execution
// -------------------------------------------------------------
export interface FulfillOrderParams {
  orderId: string;
  fulfillmentPayload: string; // License key, login email:password, or invite link
  instructionsForCustomer: string;
  providerReference?: string;
  operatorUserId: string;
}

export function fulfillOrder(params: FulfillOrderParams): { order: Order; delivery: Delivery } {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === params.orderId);
    if (!order) {
      throw new Error('Order not found.');
    }
    if (order.orderStatus !== 'admin_approved' && order.orderStatus !== 'queued_for_delivery') {
      throw new Error(`Order in status "${order.orderStatus}" cannot be fulfilled.`);
    }

    let delivery = db.deliveries.find((d) => d.orderId === order.id);
    if (!delivery) {
      delivery = {
        id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        orderId: order.id,
        fulfillmentMethod: order.snapshotDeliveryMethod,
        instructionsForCustomer: params.instructionsForCustomer,
        state: 'completed',
        attemptsCount: 1,
        fulfillmentPayload: params.fulfillmentPayload,
        operatorUserId: params.operatorUserId,
        providerReference: params.providerReference || `MANUAL-${Date.now()}`,
        deliveredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.deliveries.push(delivery);
    } else {
      delivery.state = 'completed';
      delivery.fulfillmentPayload = params.fulfillmentPayload;
      delivery.instructionsForCustomer = params.instructionsForCustomer;
      delivery.providerReference = params.providerReference || `MANUAL-${Date.now()}`;
      delivery.operatorUserId = params.operatorUserId;
      delivery.deliveredAt = new Date().toISOString();
      delivery.attemptsCount += 1;
      delivery.updatedAt = new Date().toISOString();
    }

    order.orderStatus = 'completed';
    order.updatedAt = new Date().toISOString();

    // Customer Notification with Delivery Details
    enqueueNotification({
      recipientType: 'customer',
      recipientContact: order.customerEmail,
      channel: 'email',
      eventType: 'ORDER_DELIVERED',
      title: `Order Delivered: ${order.snapshotProductName} (${order.orderNumber})`,
      bodyText: `Your digital product #${order.orderNumber} has been fulfilled! Access instructions: ${params.instructionsForCustomer}`,
      metadataJson: { orderId: order.id },
    });

    return { order, delivery };
  });
}
