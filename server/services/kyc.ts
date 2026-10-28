/**
 * Reseller Application, KYC Verification & Subdomain Service
 */

import { db } from '../db/store.ts';
import {
  ResellerApplication,
  KycDocument,
  Store,
} from '../types/index.ts';
import { enqueueNotification } from './notifications.ts';

const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'mail',
  'root',
  'sys',
  'system',
  'store',
  'shop',
  'www',
  'null',
  'undefined',
  'digimarket',
  'billing',
  'support',
]);

export function validateSubdomainFormat(subdomain: string): { valid: boolean; error?: string } {
  const normalized = subdomain.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 30) {
    return { valid: false, error: 'Subdomain must be between 3 and 30 characters.' };
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized)) {
    return { valid: false, error: 'Subdomain can only contain lowercase letters, numbers, and single hyphens.' };
  }
  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return { valid: false, error: `Subdomain "${normalized}" is reserved for system use.` };
  }
  return { valid: true };
}

export interface SubmitApplicationParams {
  userId: string;
  businessName: string;
  requestedSubdomain: string;
  tradeLicenseNumber?: string;
  nationalIdNumber: string;
  contactPhone: string;
  emergencyContact?: string;
  address: string;
  kycDocuments: Array<{
    documentType: 'nid_front' | 'nid_back' | 'trade_license' | 'utility_bill';
    fileName: string;
    fileDataUrl: string;
  }>;
}

export function submitResellerApplication(params: SubmitApplicationParams): ResellerApplication {
  const user = db.users.find((u) => u.id === params.userId);
  if (!user) {
    throw new Error('User not found.');
  }

  // Check if user already has an application
  const existingApp = db.resellerApplications.find((a) => a.userId === params.userId);
  if (existingApp && (existingApp.status === 'pending' || existingApp.status === 'approved')) {
    throw new Error(`You already have an application in status: ${existingApp.status}`);
  }

  const subValidation = validateSubdomainFormat(params.requestedSubdomain);
  if (!subValidation.valid) {
    throw new Error(subValidation.error);
  }

  const normalizedSub = params.requestedSubdomain.trim().toLowerCase();

  // Check collision against active stores and approved applications
  const storeCollision = db.stores.find((s) => s.subdomain.toLowerCase() === normalizedSub);
  if (storeCollision) {
    throw new Error(`Subdomain "${normalizedSub}" is already taken by another store.`);
  }

  const appCollision = db.resellerApplications.find(
    (a) => a.requestedSubdomain.toLowerCase() === normalizedSub && a.status !== 'rejected'
  );
  if (appCollision) {
    throw new Error(`Subdomain "${normalizedSub}" is already reserved in a pending application.`);
  }

  const applicationId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const application: ResellerApplication = {
    id: applicationId,
    userId: params.userId,
    businessName: params.businessName.trim(),
    requestedSubdomain: normalizedSub,
    tradeLicenseNumber: params.tradeLicenseNumber?.trim(),
    nationalIdNumber: params.nationalIdNumber.trim(),
    contactPhone: params.contactPhone.trim(),
    emergencyContact: params.emergencyContact?.trim(),
    address: params.address.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.resellerApplications.push(application);

  // Save KYC documents
  for (const doc of params.kycDocuments) {
    const kycDoc: KycDocument = {
      id: `kyc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      applicationId,
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileDataUrl: doc.fileDataUrl,
      verificationStatus: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.kycDocuments.push(kycDoc);
  }

  db.persist();

  // Notify Admins
  enqueueNotification({
    recipientType: 'admin',
    recipientContact: 'admin@digimarket.com',
    channel: 'email',
    eventType: 'NEW_RESELLER_APPLICATION',
    title: `New Reseller Application: ${application.businessName}`,
    bodyText: `Applicant ${user.fullName} applied for subdomain "${normalizedSub}". KYC documents ready for review.`,
    metadataJson: { applicationId, userId: user.id },
  });

  return application;
}

export function reviewResellerApplication(
  applicationId: string,
  adminUserId: string,
  decision: 'approve' | 'reject',
  rejectionReason?: string
): { application: ResellerApplication; store?: Store } {
  return db.runInTransaction(() => {
    const application = db.resellerApplications.find((a) => a.id === applicationId);
    if (!application) {
      throw new Error('Application not found.');
    }
    if (application.status !== 'pending' && application.status !== 'under_review') {
      throw new Error(`Application already decided with status: ${application.status}`);
    }

    const user = db.users.find((u) => u.id === application.userId);
    if (!user) {
      throw new Error('Applicant user record missing.');
    }

    if (decision === 'reject') {
      application.status = 'rejected';
      application.rejectionReason = rejectionReason || 'Application requirements not met.';
      application.reviewedBy = adminUserId;
      application.reviewedAt = new Date().toISOString();
      application.updatedAt = new Date().toISOString();

      enqueueNotification({
        recipientType: 'customer',
        recipientContact: user.email,
        channel: 'email',
        eventType: 'RESELLER_APP_REJECTED',
        title: 'Reseller Application Update',
        bodyText: `Your application for reseller store "${application.requestedSubdomain}" was not approved. Reason: ${application.rejectionReason}`,
        metadataJson: { applicationId },
      });

      return { application };
    }

    // APPROVE
    application.status = 'approved';
    application.reviewedBy = adminUserId;
    application.reviewedAt = new Date().toISOString();
    application.updatedAt = new Date().toISOString();

    // Upgrade user role to reseller
    user.role = 'reseller';
    user.status = 'active';
    user.updatedAt = new Date().toISOString();

    // Provision Store record
    let store = db.stores.find((s) => s.resellerId === user.id);
    if (!store) {
      store = {
        id: `str_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        resellerId: user.id,
        storeName: application.businessName,
        subdomain: application.requestedSubdomain,
        status: 'active',
        supportPhone: application.contactPhone,
        supportEmail: user.email,
        supportWhatsapp: application.contactPhone,
        paymentInstructionsBkash: `bKash Personal: ${application.contactPhone} (Send Money).`,
        paymentInstructionsNagad: `Nagad Personal: ${application.contactPhone}.`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.stores.push(store);
    }

    // Provision Reseller Wallet if not exists
    let wallet = db.resellerWallets.find((w) => w.resellerId === user.id);
    if (!wallet) {
      wallet = {
        resellerId: user.id,
        availableBalanceBdt: 0,
        lockedBalanceBdt: 0,
        totalDepositedBdt: 0,
        totalSpentBdt: 0,
        totalBonusBdt: 0,
        updatedAt: new Date().toISOString(),
      };
      db.resellerWallets.push(wallet);
    }

    // Mark KYC docs as verified
    db.kycDocuments
      .filter((d) => d.applicationId === applicationId)
      .forEach((d) => (d.verificationStatus = 'verified'));

    enqueueNotification({
      recipientType: 'reseller',
      recipientContact: user.email,
      channel: 'email',
      eventType: 'RESELLER_APP_APPROVED',
      title: 'Congratulations! Your Reseller Store is Active',
      bodyText: `Your application has been approved! Your store is now live at: https://${store.subdomain}.digimarket.com (and /store/${store.subdomain}).`,
      metadataJson: { storeId: store.id, subdomain: store.subdomain },
    });

    return { application, store };
  });
}
