/**
 * In-Process ACID-Compliant Transactional Store with Persistence
 * Implements strict constraints, row-locking semantics, atomic commits & rollbacks.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';
import {
  User,
  ResellerApplication,
  KycDocument,
  Store,
  Category,
  Product,
  ProductPackage,
  ResellerWallet,
  WalletLedgerEntry,
  DepositRequest,
  ResellerBonus,
  Order,
  PaymentSubmission,
  Delivery,
  NotificationOutbox,
  AuditLog,
  SessionRecord,
  SupportTicket,
} from '../types/index.ts';

interface DatabaseSchema {
  users: User[];
  resellerApplications: ResellerApplication[];
  kycDocuments: KycDocument[];
  stores: Store[];
  categories: Category[];
  products: Product[];
  productPackages: ProductPackage[];
  resellerWallets: ResellerWallet[];
  walletLedger: WalletLedgerEntry[];
  depositRequests: DepositRequest[];
  resellerBonuses: ResellerBonus[];
  orders: Order[];
  paymentSubmissions: PaymentSubmission[];
  deliveries: Delivery[];
  notificationOutbox: NotificationOutbox[];
  auditLogs: AuditLog[];
  sessions: SessionRecord[];
  tickets: SupportTicket[];
}

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.NODE_ENV === 'test'
  ? path.join(os.tmpdir(), 'digimarket_isolated_test_data')
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'db.json.bak');
const DB_TMP_FILE = path.join(DATA_DIR, 'db.json.tmp');
export const EVIDENCE_DIR = path.join(DATA_DIR, 'evidence');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads', 'products');

// Ensure data, evidence, and uploads directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Pre-change safe snapshot backup
const PRE_CHANGE_BACKUP = path.join(DATA_DIR, 'db.json.pre_product_mgmt_backup');
if (fs.existsSync(DB_FILE) && !fs.existsSync(PRE_CHANGE_BACKUP)) {
  try {
    fs.copyFileSync(DB_FILE, PRE_CHANGE_BACKUP);
  } catch (e) {
    // Non-fatal
  }
}

class TransactionalDatabase {
  private state: DatabaseSchema;
  private transactionSnapshot: DatabaseSchema | null = null;
  private transactionDepth: number = 0;
  private lockedWallets: Set<string> = new Set();
  private writeMutex: Promise<void> = Promise.resolve();

  constructor() {
    this.state = this.loadOrSeed();
    this.reconcileWalletLedgerInvariants();
  }

  private loadOrSeed(): DatabaseSchema {
    // 1. Try primary db.json
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return this.ensureBackwardCompatibility(parsed);
      } catch (err) {
        console.error('Failed to parse primary DB file, attempting backup recovery:', err);
      }
    }

    // 2. Try crash recovery from db.json.bak
    if (fs.existsSync(DB_BACKUP_FILE)) {
      try {
        const backupRaw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
        const backupParsed = JSON.parse(backupRaw);
        console.log('Successfully recovered database from db.json.bak');
        return this.ensureBackwardCompatibility(backupParsed);
      } catch (backupErr) {
        console.error('Failed to parse backup DB file:', backupErr);
      }
    }

    // 3. Fallback to pristine seed (development only)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[CRITICAL CONFIG ERROR] Production database file is missing or unreadable at ${DB_FILE}. Halting to prevent empty database overwrite.`);
    }
    const seeded = this.generateSeedData();
    this.saveToDiskSync(seeded);
    return seeded;
  }

  private ensureBackwardCompatibility(data: any): DatabaseSchema {
    if (!Array.isArray(data.sessions)) data.sessions = [];
    if (!Array.isArray(data.tickets)) data.tickets = [];
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.resellerApplications)) data.resellerApplications = [];
    if (!Array.isArray(data.kycDocuments)) data.kycDocuments = [];
    if (!Array.isArray(data.stores)) data.stores = [];
    if (!Array.isArray(data.categories)) data.categories = [];
    if (!Array.isArray(data.products)) data.products = [];
    if (!Array.isArray(data.productPackages)) data.productPackages = [];
    if (!Array.isArray(data.resellerWallets)) data.resellerWallets = [];
    if (!Array.isArray(data.walletLedger)) data.walletLedger = [];
    if (!Array.isArray(data.depositRequests)) data.depositRequests = [];
    if (!Array.isArray(data.resellerBonuses)) data.resellerBonuses = [];
    if (!Array.isArray(data.orders)) data.orders = [];
    if (!Array.isArray(data.paymentSubmissions)) data.paymentSubmissions = [];
    if (!Array.isArray(data.deliveries)) data.deliveries = [];
    if (!Array.isArray(data.notificationOutbox)) data.notificationOutbox = [];
    if (!Array.isArray(data.auditLogs)) data.auditLogs = [];
    return data as DatabaseSchema;
  }

  /**
   * Atomic file persistence with fsync and backup snapshot
   */
  private saveToDiskSync(data: DatabaseSchema) {
    try {
      const serialized = JSON.stringify(data, null, 2);

      // Write to temp file first
      const fd = fs.openSync(DB_TMP_FILE, 'w');
      fs.writeFileSync(fd, serialized, 'utf-8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);

      // Create backup of current DB before replacing
      if (fs.existsSync(DB_FILE)) {
        try {
          fs.copyFileSync(DB_FILE, DB_BACKUP_FILE);
        } catch (copyErr) {
          // Non-fatal if backup copy fails
        }
      }

      // Atomic rename
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (err) {
      console.error('Failed to atomically persist database to disk:', err);
    }
  }

  public persist() {
    this.saveToDiskSync(this.state);
  }

  /**
   * Wallet-Ledger Invariant Verification
   * Audit-only check: Detects and logs ledger discrepancies without silent balance mutation.
   */
  private reconcileWalletLedgerInvariants() {
    try {
      for (const wallet of this.state.resellerWallets) {
        const entries = this.state.walletLedger.filter((l) => l.resellerId === wallet.resellerId);
        let calculated = 0;
        for (const entry of entries) {
          if (
            entry.entryType === 'deposit_credit' ||
            entry.entryType === 'bonus_credit' ||
            entry.entryType === 'order_reversal_credit' ||
            entry.entryType === 'adjustment_credit'
          ) {
            calculated += entry.amountBdt;
          } else if (
            entry.entryType === 'order_wholesale_debit' ||
            entry.entryType === 'bonus_reversal_debit' ||
            entry.entryType === 'adjustment_debit'
          ) {
            calculated -= entry.amountBdt;
          }
        }
        calculated = Math.round(calculated * 100) / 100;

        if (Math.abs(wallet.availableBalanceBdt - calculated) > 0.01) {
          console.warn(
            `[FINANCIAL INVARIANT AUDIT] Discrepancy detected for reseller ${wallet.resellerId}: Stored Wallet = ${wallet.availableBalanceBdt}, Ledger Sum = ${calculated}. Automatic overwrite DISABLED per policy.`
          );

          // Record non-destructive audit event
          if (Array.isArray(this.state.auditLogs)) {
            this.state.auditLogs.push({
              id: `aud_recon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              actorRole: 'system_finance',
              action: 'WALLET_LEDGER_DISCREPANCY_FLAGGED',
              targetEntity: 'reseller_wallets',
              targetId: wallet.resellerId,
              details: {
                resellerId: wallet.resellerId,
                storedBalanceBdt: wallet.availableBalanceBdt,
                ledgerCalculatedBdt: calculated,
                differenceBdt: Math.round((calculated - wallet.availableBalanceBdt) * 100) / 100,
                policy: 'NO_AUTOMATIC_OVERWRITE',
              },
              createdAt: new Date().toISOString(),
            });
          }
          // Do NOT mutate wallet.availableBalanceBdt. Balances remain strictly preserved until approved reconciliation.
        }
      }
    } catch (err) {
      console.error('Error during wallet-ledger reconciliation audit:', err);
    }
  }

  // -------------------------------------------------------------
  // ACID Transaction Scope (Re-entrant with Depth Counter)
  // -------------------------------------------------------------
  public beginTransaction(): void {
    if (this.transactionDepth === 0) {
      // Snapshot pristine state before top-level transaction starts
      this.transactionSnapshot = JSON.parse(JSON.stringify(this.state));
    }
    this.transactionDepth++;
  }

  public commit(): void {
    if (this.transactionDepth <= 0) {
      throw new Error('No transaction in progress to commit.');
    }
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      this.transactionSnapshot = null;
      this.lockedWallets.clear();
      this.persist();
    }
  }

  public rollback(): void {
    if (this.transactionSnapshot !== null) {
      this.state = JSON.parse(JSON.stringify(this.transactionSnapshot));
      this.transactionSnapshot = null;
    }
    this.transactionDepth = 0;
    this.lockedWallets.clear();
  }

  public runInTransaction<T>(fn: () => T): T {
    this.beginTransaction();
    try {
      const result = fn();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  // -------------------------------------------------------------
  // Concurrency & Row Locking Simulation
  // -------------------------------------------------------------
  public lockWalletForUpdate(resellerId: string): ResellerWallet {
    if (this.lockedWallets.has(resellerId)) {
      throw new Error(`Wallet row lock contention on reseller: ${resellerId}`);
    }
    this.lockedWallets.add(resellerId);
    const wallet = this.state.resellerWallets.find((w) => w.resellerId === resellerId);
    if (!wallet) {
      throw new Error(`Wallet not found for reseller: ${resellerId}`);
    }
    return wallet;
  }

  // -------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------
  public get users() { return this.state.users; }
  public get resellerApplications() { return this.state.resellerApplications; }
  public get kycDocuments() { return this.state.kycDocuments; }
  public get stores() { return this.state.stores; }
  public get categories() { return this.state.categories; }
  public get products() { return this.state.products; }
  public get productPackages() { return this.state.productPackages; }
  public get resellerWallets() { return this.state.resellerWallets; }
  public get walletLedger() { return this.state.walletLedger; }
  public get depositRequests() { return this.state.depositRequests; }
  public get resellerBonuses() { return this.state.resellerBonuses; }
  public get orders() { return this.state.orders; }
  public get paymentSubmissions() { return this.state.paymentSubmissions; }
  public get deliveries() { return this.state.deliveries; }
  public get notificationOutbox() { return this.state.notificationOutbox; }
  public get auditLogs() { return this.state.auditLogs; }
  public get sessions() { return this.state.sessions; }
  public get tickets() { return this.state.tickets; }
  public get evidenceDir() { return EVIDENCE_DIR; }

  // -------------------------------------------------------------
  // Seed Initialization
  // -------------------------------------------------------------
  private generateSeedData(): DatabaseSchema {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123456', salt);
    const resellerHash = bcrypt.hashSync('reseller123456', salt);
    const customerHash = bcrypt.hashSync('customer123456', salt);

    const now = new Date().toISOString();

    const users: User[] = [
      {
        id: 'usr_admin_01',
        email: 'admin@digimarket.com',
        passwordHash: adminHash,
        fullName: 'Marketplace Super Admin',
        phone: '+8801711000001',
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr_reseller_01',
        email: 'rahim@reseller.com',
        passwordHash: resellerHash,
        fullName: 'Abdur Rahim',
        phone: '+8801811223344',
        role: 'reseller',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr_customer_01',
        email: 'customer@gmail.com',
        passwordHash: customerHash,
        fullName: 'Tanvir Hossain',
        phone: '+8801911998877',
        role: 'customer',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const resellerApplications: ResellerApplication[] = [
      {
        id: 'app_rahim_01',
        userId: 'usr_reseller_01',
        businessName: 'Rahim Tech Digital Store',
        requestedSubdomain: 'rahim',
        tradeLicenseNumber: 'TRAD/DNCC/2026/09843',
        nationalIdNumber: '1995837264819',
        contactPhone: '+8801811223344',
        emergencyContact: '+8801711998877',
        address: 'House 42, Road 11, Banani, Dhaka-1213',
        status: 'approved',
        reviewedBy: 'usr_admin_01',
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const kycDocuments: KycDocument[] = [
      {
        id: 'kyc_doc_01',
        applicationId: 'app_rahim_01',
        documentType: 'nid_front',
        fileName: 'rahim_nid_front.jpg',
        fileDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
        verificationStatus: 'verified',
        createdAt: now,
      },
      {
        id: 'kyc_doc_02',
        applicationId: 'app_rahim_01',
        documentType: 'trade_license',
        fileName: 'trade_license_dhaka.pdf',
        fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ...',
        verificationStatus: 'verified',
        createdAt: now,
      },
    ];

    const stores: Store[] = [
      {
        id: 'str_rahim_01',
        resellerId: 'usr_reseller_01',
        storeName: 'Rahim Tech Digital',
        subdomain: 'rahim',
        status: 'active',
        logoUrl: '',
        supportPhone: '+8801811223344',
        supportEmail: 'support@rahimtech.store',
        supportWhatsapp: '+8801811223344',
        paymentInstructionsBkash: 'bKash Personal: 01811223344 (Send Money). Transaction ID বাধ্যতামূলক।',
        paymentInstructionsNagad: 'Nagad Personal: 01811223344 (Send Money). রেফারেন্সে অর্ডার নম্বর দিন।',
        paymentInstructionsRocket: 'Rocket Personal: 01811223344-9.',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const categories: Category[] = [
      {
        id: 'cat_design',
        name: 'Graphics & Design Tools',
        slug: 'graphics-design',
        description: 'Authorized professional creative design subscriptions and creative suites.',
        displayOrder: 1,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'cat_ai',
        name: 'AI & Intelligence Tools',
        slug: 'ai-tools',
        description: 'Cutting-edge AI conversational, coding and research subscriptions.',
        displayOrder: 2,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'cat_video',
        name: 'Video & Audio Production',
        slug: 'video-audio',
        description: 'Video editing suites, stock motion assets, and export accelerators.',
        displayOrder: 3,
        isActive: true,
        createdAt: now,
      },
      {
        id: 'cat_utilities',
        name: 'Productivity & Utilities',
        slug: 'productivity-utilities',
        description: 'Download managers, office suites, and operating system utilities.',
        displayOrder: 4,
        isActive: true,
        createdAt: now,
      },
    ];

    const products: Product[] = [
      {
        id: 'prod_canva_pro',
        categoryId: 'cat_design',
        name: 'Canva Pro EDU / Team Invite',
        slug: 'canva-pro',
        tagline: 'Premium vector graphics, 100M+ assets & background remover',
        description: 'Unlock 100M+ premium stock photos, graphics, videos, audio, and brand kits with zero watermark. Instant invite to licensed team workspace.',
        imageUrl: '/src/assets/images/product_canva_pro_1791884577674.jpg',
        deliveryMethod: 'invite_link',
        deliveryInstructions: 'Your invite link will be provided. Click to join with your personal email account.',
        termsAndConditions: 'Authorized educational/team seat. Valid for selected subscription duration with replacement guarantee.',
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_chatgpt_plus',
        categoryId: 'cat_ai',
        name: 'ChatGPT Plus (GPT-4o & Canvas)',
        slug: 'chatgpt-plus',
        tagline: 'Fast access to GPT-4o, DALL·E 3, Advanced Voice & Custom GPTs',
        description: 'Enjoy high-speed access to OpenAI GPT-4o, Canvas coding editor, image generation, web search, and priority compute without rate bottleneck.',
        imageUrl: '/src/assets/images/product_chatgpt_plus_1791884578363.jpg',
        deliveryMethod: 'manual_credentials',
        deliveryInstructions: 'Authorized account credentials (Email & Secure Passcode) will be provided in your delivery vault.',
        termsAndConditions: 'Do not modify account recovery details. 1 device simultaneous usage per profile.',
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_capcut_pro',
        categoryId: 'cat_video',
        name: 'CapCut Pro Desktop & Mobile',
        slug: 'capcut-pro',
        tagline: 'AI Auto-Captions, 4K 60FPS Video Export & Pro Color Curves',
        description: 'Professional video editing subscription with cloud space, optical flow slow-mo, vocal isolation, and commercial transitions for TikTok and YouTube creators.',
        imageUrl: '/src/assets/images/product_capcut_pro_1791884578570.jpg',
        deliveryMethod: 'manual_credentials',
        deliveryInstructions: 'Login credentials provided. Sign in on CapCut desktop or mobile app to activate Pro status.',
        termsAndConditions: 'Valid on 1 PC + 1 Mobile phone.',
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'prod_idm_lifetime',
        categoryId: 'cat_utilities',
        name: 'Internet Download Manager (IDM)',
        slug: 'idm-lifetime',
        tagline: '5x Download Speed Acceleration with Browser Integration',
        description: 'Official digital license key for Internet Download Manager. Seamlessly catches video streams and splits files for maximum bandwidth throughput.',
        imageUrl: '/src/assets/images/hero_digital_products_1791884577566.jpg',
        deliveryMethod: 'instant_license_key',
        deliveryInstructions: 'Download the official installer from internetdownloadmanager.com and enter your unique Serial Key in Registration.',
        termsAndConditions: '1 PC lifetime activation key with 3-year minor updates.',
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const productPackages: ProductPackage[] = [
      // Canva
      {
        id: 'pkg_canva_1m',
        productId: 'prod_canva_pro',
        name: '1 Month Access',
        durationLabel: '1 Month',
        durationDays: 30,
        retailPriceBdt: 120.0,
        resellerWholesaleCostBdt: 70.0,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pkg_canva_6m',
        productId: 'prod_canva_pro',
        name: '6 Months Access',
        durationLabel: '6 Months',
        durationDays: 180,
        retailPriceBdt: 350.0,
        resellerWholesaleCostBdt: 220.0,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pkg_canva_1y',
        productId: 'prod_canva_pro',
        name: '1 Year Full Subscription',
        durationLabel: '1 Year',
        durationDays: 365,
        retailPriceBdt: 590.0,
        resellerWholesaleCostBdt: 390.0,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },

      // ChatGPT Plus
      {
        id: 'pkg_chatgpt_shared_1m',
        productId: 'prod_chatgpt_plus',
        name: '1 Month Shared Premium Seat',
        durationLabel: '1 Month (Shared 2-User)',
        durationDays: 30,
        retailPriceBdt: 750.0,
        resellerWholesaleCostBdt: 550.0,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pkg_chatgpt_private_1m',
        productId: 'prod_chatgpt_plus',
        name: '1 Month Private Dedicated Account',
        durationLabel: '1 Month (Private)',
        durationDays: 30,
        retailPriceBdt: 2600.0,
        resellerWholesaleCostBdt: 2350.0,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },

      // CapCut Pro
      {
        id: 'pkg_capcut_1m',
        productId: 'prod_capcut_pro',
        name: '1 Month Pro Pass',
        durationLabel: '1 Month',
        durationDays: 30,
        retailPriceBdt: 299.0,
        resellerWholesaleCostBdt: 180.0,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pkg_capcut_1y',
        productId: 'prod_capcut_pro',
        name: '1 Year Pro License',
        durationLabel: '1 Year',
        durationDays: 365,
        retailPriceBdt: 1450.0,
        resellerWholesaleCostBdt: 1100.0,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },

      // IDM
      {
        id: 'pkg_idm_lifetime',
        productId: 'prod_idm_lifetime',
        name: '1 PC Lifetime Key',
        durationLabel: 'Lifetime 1 PC',
        durationDays: 3650,
        retailPriceBdt: 1850.0,
        resellerWholesaleCostBdt: 1450.0,
        stockCount: 50,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const resellerWallets: ResellerWallet[] = [
      {
        resellerId: 'usr_reseller_01',
        availableBalanceBdt: 5000.0,
        lockedBalanceBdt: 0.0,
        totalDepositedBdt: 5000.0,
        totalSpentBdt: 0.0,
        totalBonusBdt: 0.0,
        updatedAt: now,
      },
    ];

    const walletLedger: WalletLedgerEntry[] = [
      {
        id: 'ldg_initial_01',
        resellerId: 'usr_reseller_01',
        referenceId: 'DEP-SEED-INIT-01',
        idempotencyKey: 'IDEMP-INIT-DEP-01',
        entryType: 'deposit_credit',
        amountBdt: 5000.0,
        balanceBeforeBdt: 0.0,
        balanceAfterBdt: 5000.0,
        reason: 'Initial verified bKash merchant top-up approved by admin',
        createdBy: 'usr_admin_01',
        createdAt: now,
      },
    ];

    const depositRequests: DepositRequest[] = [
      {
        id: 'dep_01',
        resellerId: 'usr_reseller_01',
        method: 'bkash_merchant',
        claimedAmountBdt: 5000.0,
        transactionReference: 'BKASH88392019',
        senderAccountNumber: '01811223344',
        status: 'verified_approved',
        adminNotes: 'Transaction verified against bKash merchant statement.',
        reviewedBy: 'usr_admin_01',
        reviewedAt: now,
        ledgerEntryId: 'ldg_initial_01',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const auditLogs: AuditLog[] = [
      {
        id: 'aud_init_01',
        actorUserId: 'usr_admin_01',
        actorRole: 'admin',
        action: 'SYSTEM_BOOTSTRAP',
        targetEntity: 'SYSTEM',
        targetId: 'digimarket',
        details: { message: 'Database initialized with seed data & ACID storage engine' },
        createdAt: now,
      },
    ];

    return {
      users,
      resellerApplications,
      kycDocuments,
      stores,
      categories,
      products,
      productPackages,
      resellerWallets,
      walletLedger,
      depositRequests,
      resellerBonuses: [],
      orders: [],
      paymentSubmissions: [],
      deliveries: [],
      notificationOutbox: [],
      auditLogs,
      sessions: [],
      tickets: [],
    };
  }
}

export const db = new TransactionalDatabase();
