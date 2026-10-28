/**
 * Wallet, Ledger & Financial Accounting Service
 * Strictly enforces ACID atomicity, row locks, idempotency, and immutable ledgers.
 */

import { db } from '../db/store.ts';
import {
  WalletLedgerEntry,
  LedgerEntryType,
  BonusType,
  ResellerBonus,
  DepositRequest,
} from '../types/index.ts';
import { enqueueNotification } from './notifications.ts';

function roundBdt(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export interface CreditWalletOptions {
  resellerId: string;
  amountBdt: number;
  entryType: LedgerEntryType;
  referenceId: string;
  idempotencyKey: string;
  reason: string;
  orderId?: string;
  bonusId?: string;
  actorUserId: string;
}

export function creditWallet(opts: CreditWalletOptions): WalletLedgerEntry {
  const amount = roundBdt(opts.amountBdt);
  if (amount <= 0) {
    throw new Error('Credit amount must be greater than zero.');
  }

  // Idempotency check: prevent duplicate credits
  const existingLedger = db.walletLedger.find((l) => l.idempotencyKey === opts.idempotencyKey);
  if (existingLedger) {
    return existingLedger;
  }

  return db.runInTransaction(() => {
    const wallet = db.lockWalletForUpdate(opts.resellerId);

    const balanceBefore = roundBdt(wallet.availableBalanceBdt);
    const balanceAfter = roundBdt(balanceBefore + amount);

    wallet.availableBalanceBdt = balanceAfter;
    if (opts.entryType === 'deposit_credit') {
      wallet.totalDepositedBdt = roundBdt(wallet.totalDepositedBdt + amount);
    } else if (opts.entryType === 'bonus_credit') {
      wallet.totalBonusBdt = roundBdt(wallet.totalBonusBdt + amount);
    }
    wallet.updatedAt = new Date().toISOString();

    const ledgerEntry: WalletLedgerEntry = {
      id: `ldg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      resellerId: opts.resellerId,
      referenceId: opts.referenceId,
      idempotencyKey: opts.idempotencyKey,
      entryType: opts.entryType,
      amountBdt: amount,
      balanceBeforeBdt: balanceBefore,
      balanceAfterBdt: balanceAfter,
      reason: opts.reason,
      orderId: opts.orderId,
      bonusId: opts.bonusId,
      createdBy: opts.actorUserId,
      createdAt: new Date().toISOString(),
    };

    db.walletLedger.push(ledgerEntry);

    // Audit log
    db.auditLogs.push({
      id: `aud_${Date.now()}`,
      actorUserId: opts.actorUserId,
      actorRole: 'system_finance',
      action: 'WALLET_CREDIT',
      targetEntity: 'reseller_wallets',
      targetId: opts.resellerId,
      details: {
        entryType: opts.entryType,
        amountBdt: amount,
        balanceBefore,
        balanceAfter,
        referenceId: opts.referenceId,
      },
      createdAt: new Date().toISOString(),
    });

    return ledgerEntry;
  });
}

export interface DebitWalletOptions {
  resellerId: string;
  amountBdt: number;
  entryType: LedgerEntryType;
  referenceId: string;
  idempotencyKey: string;
  reason: string;
  orderId?: string;
  bonusId?: string;
  actorUserId: string;
}

export function debitWallet(opts: DebitWalletOptions): WalletLedgerEntry {
  const amount = roundBdt(opts.amountBdt);
  if (amount <= 0) {
    throw new Error('Debit amount must be greater than zero.');
  }

  // Idempotency check: prevent duplicate debits
  const existingLedger = db.walletLedger.find((l) => l.idempotencyKey === opts.idempotencyKey);
  if (existingLedger) {
    return existingLedger;
  }

  return db.runInTransaction(() => {
    const wallet = db.lockWalletForUpdate(opts.resellerId);

    const balanceBefore = roundBdt(wallet.availableBalanceBdt);
    if (balanceBefore < amount) {
      throw new Error(
        `Insufficient wallet balance. Required: ৳${amount.toFixed(2)}, Available: ৳${balanceBefore.toFixed(2)}`
      );
    }

    const balanceAfter = roundBdt(balanceBefore - amount);
    if (balanceAfter < 0) {
      throw new Error('Violation of wallet non-negative balance invariant.');
    }

    wallet.availableBalanceBdt = balanceAfter;
    if (opts.entryType === 'order_wholesale_debit') {
      wallet.totalSpentBdt = roundBdt(wallet.totalSpentBdt + amount);
    }
    wallet.updatedAt = new Date().toISOString();

    const ledgerEntry: WalletLedgerEntry = {
      id: `ldg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      resellerId: opts.resellerId,
      referenceId: opts.referenceId,
      idempotencyKey: opts.idempotencyKey,
      entryType: opts.entryType,
      amountBdt: amount,
      balanceBeforeBdt: balanceBefore,
      balanceAfterBdt: balanceAfter,
      reason: opts.reason,
      orderId: opts.orderId,
      bonusId: opts.bonusId,
      createdBy: opts.actorUserId,
      createdAt: new Date().toISOString(),
    };

    db.walletLedger.push(ledgerEntry);

    // Audit log
    db.auditLogs.push({
      id: `aud_${Date.now()}`,
      actorUserId: opts.actorUserId,
      actorRole: 'system_finance',
      action: 'WALLET_DEBIT',
      targetEntity: 'reseller_wallets',
      targetId: opts.resellerId,
      details: {
        entryType: opts.entryType,
        amountBdt: amount,
        balanceBefore,
        balanceAfter,
        referenceId: opts.referenceId,
      },
      createdAt: new Date().toISOString(),
    });

    return ledgerEntry;
  });
}

// -------------------------------------------------------------
// Deposit Requests
// -------------------------------------------------------------
export function submitDepositRequest(params: {
  resellerId: string;
  method: 'bkash_merchant' | 'nagad_merchant' | 'rocket_merchant' | 'bank_transfer';
  claimedAmountBdt: number;
  transactionReference: string;
  senderAccountNumber: string;
  depositSlipUrl?: string;
}): DepositRequest {
  const amount = roundBdt(params.claimedAmountBdt);
  if (amount < 100) {
    throw new Error('Minimum deposit amount is ৳100.00');
  }

  const normalizedTxn = params.transactionReference.trim().toUpperCase();
  const existing = db.depositRequests.find(
    (d) => d.transactionReference.toUpperCase() === normalizedTxn
  );
  if (existing) {
    throw new Error(`Deposit with transaction reference "${normalizedTxn}" has already been submitted.`);
  }

  const deposit: DepositRequest = {
    id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    resellerId: params.resellerId,
    method: params.method,
    claimedAmountBdt: amount,
    transactionReference: normalizedTxn,
    senderAccountNumber: params.senderAccountNumber.trim(),
    depositSlipUrl: params.depositSlipUrl,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.depositRequests.push(deposit);
  db.persist();

  // Notify Admins
  enqueueNotification({
    recipientType: 'admin',
    recipientContact: 'admin@digimarket.com',
    channel: 'email',
    eventType: 'NEW_DEPOSIT_REQUEST',
    title: 'New Reseller Deposit Request Submitted',
    bodyText: `Reseller submitted deposit of ৳${amount.toFixed(2)} via ${params.method} (Ref: ${normalizedTxn}). Verification required.`,
    metadataJson: { depositId: deposit.id, resellerId: params.resellerId },
  });

  return deposit;
}

export function approveDeposit(depositId: string, adminUserId: string, adminNotes?: string): DepositRequest {
  return db.runInTransaction(() => {
    const deposit = db.depositRequests.find((d) => d.id === depositId);
    if (!deposit) {
      throw new Error('Deposit request not found.');
    }
    if (deposit.status !== 'pending') {
      throw new Error(`Deposit is already in status: ${deposit.status}. Double approval is prohibited.`);
    }

    const idempotencyKey = `IDEMP-DEP-APPR-${deposit.id}`;
    const ledgerEntry = creditWallet({
      resellerId: deposit.resellerId,
      amountBdt: deposit.claimedAmountBdt,
      entryType: 'deposit_credit',
      referenceId: `DEP-${deposit.transactionReference}`,
      idempotencyKey,
      reason: `Deposit verified & approved: ${deposit.method} (Txn: ${deposit.transactionReference})`,
      actorUserId: adminUserId,
    });

    deposit.status = 'verified_approved';
    deposit.reviewedBy = adminUserId;
    deposit.reviewedAt = new Date().toISOString();
    deposit.adminNotes = adminNotes || 'Payment verified by administrator.';
    deposit.ledgerEntryId = ledgerEntry.id;
    deposit.updatedAt = new Date().toISOString();

    const resellerUser = db.users.find((u) => u.id === deposit.resellerId);
    if (resellerUser) {
      enqueueNotification({
        recipientType: 'reseller',
        recipientContact: resellerUser.email,
        channel: 'email',
        eventType: 'DEPOSIT_APPROVED',
        title: 'Deposit Approved & Wallet Credited',
        bodyText: `Your deposit of ৳${deposit.claimedAmountBdt.toFixed(2)} has been verified and added to your wallet balance.`,
        metadataJson: { depositId: deposit.id, ledgerId: ledgerEntry.id },
      });
    }

    return deposit;
  });
}

export function rejectDeposit(depositId: string, adminUserId: string, reason: string): DepositRequest {
  const deposit = db.depositRequests.find((d) => d.id === depositId);
  if (!deposit) {
    throw new Error('Deposit request not found.');
  }
  if (deposit.status !== 'pending') {
    throw new Error(`Deposit is already in status: ${deposit.status}`);
  }

  deposit.status = 'rejected';
  deposit.reviewedBy = adminUserId;
  deposit.reviewedAt = new Date().toISOString();
  deposit.adminNotes = reason;
  deposit.updatedAt = new Date().toISOString();
  db.persist();

  const resellerUser = db.users.find((u) => u.id === deposit.resellerId);
  if (resellerUser) {
    enqueueNotification({
      recipientType: 'reseller',
      recipientContact: resellerUser.email,
      channel: 'email',
      eventType: 'DEPOSIT_REJECTED',
      title: 'Deposit Request Rejected',
      bodyText: `Your deposit request for ৳${deposit.claimedAmountBdt.toFixed(2)} was rejected. Reason: ${reason}`,
      metadataJson: { depositId: deposit.id },
    });
  }

  return deposit;
}

// -------------------------------------------------------------
// Reseller Bonus Management (Master Prompt Section 8)
// -------------------------------------------------------------
export interface CreateBonusOptions {
  resellerIds: string[];
  bonusType: BonusType;
  amountBdt: number;
  campaignName?: string;
  reason: string;
  adminUserId: string;
  requireSecondApproval?: boolean;
}

export interface BonusBatchResult {
  resellerId: string;
  bonusId?: string;
  ledgerId?: string;
  status: 'credited' | 'pending_dual_approval' | 'failed';
  error?: string;
}

export function grantBonusBatch(opts: CreateBonusOptions): BonusBatchResult[] {
  const amount = roundBdt(opts.amountBdt);
  if (amount <= 0) {
    throw new Error('Bonus amount must be greater than zero.');
  }
  if (!opts.reason || opts.reason.trim().length < 5) {
    throw new Error('A detailed reason is required for bonus allocation.');
  }

  const results: BonusBatchResult[] = [];

  for (const resellerId of opts.resellerIds) {
    const resellerUser = db.users.find((u) => u.id === resellerId && u.role === 'reseller');
    if (!resellerUser) {
      results.push({
        resellerId,
        status: 'failed',
        error: 'Reseller account not found or not active.',
      });
      continue;
    }

    const referenceCode = `BNS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const idempotencyKey = `IDEMP-BNS-${resellerId}-${Date.now()}-${referenceCode}`;

    if (opts.requireSecondApproval) {
      // Create pending second approval record
      const bonus: ResellerBonus = {
        id: `bns_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        resellerId,
        bonusType: opts.bonusType,
        amountBdt: amount,
        campaignName: opts.campaignName,
        reason: opts.reason,
        referenceCode,
        idempotencyKey,
        status: 'pending_second_approval',
        createdBy: opts.adminUserId,
        createdAt: new Date().toISOString(),
      };
      db.resellerBonuses.push(bonus);
      db.persist();
      results.push({
        resellerId,
        bonusId: bonus.id,
        status: 'pending_dual_approval',
      });
      continue;
    }

    // Direct atomic credit + ledger commit
    try {
      db.runInTransaction(() => {
        const bonusId = `bns_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const ledgerEntry = creditWallet({
          resellerId,
          amountBdt: amount,
          entryType: 'bonus_credit',
          referenceId: referenceCode,
          idempotencyKey,
          reason: `Bonus Award: [${opts.bonusType}] ${opts.reason}`,
          bonusId,
          actorUserId: opts.adminUserId,
        });

        const bonus: ResellerBonus = {
          id: bonusId,
          resellerId,
          bonusType: opts.bonusType,
          amountBdt: amount,
          campaignName: opts.campaignName,
          reason: opts.reason,
          referenceCode,
          idempotencyKey,
          status: 'approved_and_credited',
          createdBy: opts.adminUserId,
          ledgerEntryId: ledgerEntry.id,
          createdAt: new Date().toISOString(),
        };

        db.resellerBonuses.push(bonus);

        results.push({
          resellerId,
          bonusId: bonus.id,
          ledgerId: ledgerEntry.id,
          status: 'credited',
        });
      });

      // Notification sent ONLY after transaction commits
      enqueueNotification({
        recipientType: 'reseller',
        recipientContact: resellerUser.email,
        channel: 'email',
        eventType: 'BONUS_CREDITED',
        title: 'New Reseller Bonus Credited!',
        bodyText: `Congratulations! A ${opts.bonusType.replace('_', ' ')} of ৳${amount.toFixed(2)} has been credited to your wallet. Reason: ${opts.reason}`,
        metadataJson: { amountBdt: amount, referenceCode },
      });
    } catch (err: any) {
      results.push({
        resellerId,
        status: 'failed',
        error: err.message,
      });
    }
  }

  return results;
}

export function reverseBonus(bonusId: string, adminUserId: string, reversalReason: string): ResellerBonus {
  if (!reversalReason || reversalReason.trim().length < 5) {
    throw new Error('A detailed reason is required for bonus reversal.');
  }

  return db.runInTransaction(() => {
    const bonus = db.resellerBonuses.find((b) => b.id === bonusId);
    if (!bonus) {
      throw new Error('Bonus record not found.');
    }
    if (bonus.status !== 'approved_and_credited') {
      throw new Error(`Cannot reverse bonus with status: ${bonus.status}`);
    }

    const reversalRef = `REV-${bonus.referenceCode}`;
    const idempotencyKey = `IDEMP-REV-${bonus.id}`;

    // Compensating debit ledger entry (NEVER erase original credit)
    const reversalLedger = debitWallet({
      resellerId: bonus.resellerId,
      amountBdt: bonus.amountBdt,
      entryType: 'bonus_reversal_debit',
      referenceId: reversalRef,
      idempotencyKey,
      reason: `Bonus Reversal for ${bonus.referenceCode}: ${reversalReason}`,
      bonusId: bonus.id,
      actorUserId: adminUserId,
    });

    bonus.status = 'reversed';
    bonus.reversalLedgerEntryId = reversalLedger.id;
    bonus.reversalReason = reversalReason;
    bonus.reversedAt = new Date().toISOString();
    bonus.reversedBy = adminUserId;

    const resellerUser = db.users.find((u) => u.id === bonus.resellerId);
    if (resellerUser) {
      enqueueNotification({
        recipientType: 'reseller',
        recipientContact: resellerUser.email,
        channel: 'email',
        eventType: 'BONUS_REVERSED',
        title: 'Bonus Reversal Notice',
        bodyText: `A previously awarded bonus of ৳${bonus.amountBdt.toFixed(2)} (${bonus.referenceCode}) has been reversed. Reason: ${reversalReason}`,
        metadataJson: { bonusId: bonus.id, ledgerId: reversalLedger.id },
      });
    }

    return bonus;
  });
}
