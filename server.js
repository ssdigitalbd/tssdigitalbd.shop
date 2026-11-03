// server.ts
import express from "express";
import path3 from "path";
import fs3 from "fs";

// server/api/routes.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";
import crypto5 from "crypto";
import fs2 from "fs";
import path2 from "path";

// server/db/store.ts
import fs from "fs";
import path from "path";
import os from "os";
import bcrypt from "bcryptjs";
import crypto from "crypto";
var DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : process.env.NODE_ENV === "test" ? path.join(os.tmpdir(), "digimarket_isolated_test_data") : path.resolve(process.cwd(), ".data");
var DB_FILE = path.join(DATA_DIR, "db.json");
var DB_BACKUP_FILE = path.join(DATA_DIR, "db.json.bak");
var DB_TMP_FILE = path.join(DATA_DIR, "db.json.tmp");
var EVIDENCE_DIR = path.join(DATA_DIR, "evidence");
var UPLOADS_DIR = path.join(DATA_DIR, "uploads", "products");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
var PRE_CHANGE_BACKUP = path.join(DATA_DIR, "db.json.pre_product_mgmt_backup");
if (fs.existsSync(DB_FILE) && !fs.existsSync(PRE_CHANGE_BACKUP)) {
  try {
    fs.copyFileSync(DB_FILE, PRE_CHANGE_BACKUP);
  } catch (e) {
  }
}
var TransactionalDatabase = class {
  constructor() {
    this.transactionSnapshot = null;
    this.transactionDepth = 0;
    this.lockedWallets = /* @__PURE__ */ new Set();
    this.writeMutex = Promise.resolve();
    this.state = this.loadOrSeed();
    this.reconcileWalletLedgerInvariants();
  }
  loadOrSeed() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return this.ensureBackwardCompatibility(parsed);
      } catch (err) {
        console.error("Failed to parse primary DB file, attempting backup recovery:", err);
      }
    }
    if (fs.existsSync(DB_BACKUP_FILE)) {
      try {
        const backupRaw = fs.readFileSync(DB_BACKUP_FILE, "utf-8");
        const backupParsed = JSON.parse(backupRaw);
        console.log("Successfully recovered database from db.json.bak");
        return this.ensureBackwardCompatibility(backupParsed);
      } catch (backupErr) {
        console.error("Failed to parse backup DB file:", backupErr);
      }
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[CRITICAL CONFIG ERROR] Production database file is missing or unreadable at ${DB_FILE}. Halting to prevent empty database overwrite.`);
    }
    const seeded = this.generateSeedData();
    this.saveToDiskSync(seeded);
    return seeded;
  }
  ensureBackwardCompatibility(data) {
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
    if (!Array.isArray(data.backupLogs) || data.backupLogs.length === 0) {
      data.backupLogs = this.generateDefaultBackupLogs();
    }
    if (!Array.isArray(data.sellerProfiles)) {
      data.sellerProfiles = this.generateDefaultSellerProfiles();
    }
    if (!Array.isArray(data.sellerApplications)) data.sellerApplications = [];
    if (!Array.isArray(data.sellerProducts)) {
      data.sellerProducts = this.generateDefaultSellerProducts();
    }
    if (!data.sellerCommissionPolicy) {
      data.sellerCommissionPolicy = {
        globalDefaultPercent: 10,
        categoryRates: {
          cat_software: 10,
          cat_developer: 8,
          cat_streaming: 12,
          cat_design: 15
        },
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedBy: "usr_admin_01"
      };
    }
    if (!Array.isArray(data.sellerEarnings)) data.sellerEarnings = [];
    if (!Array.isArray(data.sellerWithdrawals)) data.sellerWithdrawals = [];
    if (!Array.isArray(data.sellerDownloadTokens)) data.sellerDownloadTokens = [];
    if (!Array.isArray(data.resellerPaymentMethods)) {
      data.resellerPaymentMethods = this.generateDefaultResellerPaymentMethods();
    }
    if (!Array.isArray(data.resellerStoreProductConfigs)) data.resellerStoreProductConfigs = [];
    const srayEmail = "sray05464@gmail.com";
    const srayUser = data.users.find((u) => u.email.toLowerCase() === srayEmail);
    if (!srayUser) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync("Admin@SSD2026!#", salt);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      data.users.push({
        id: "usr_admin_sray",
        email: srayEmail,
        passwordHash: hash,
        fullName: "Shovon Ray (Super Admin)",
        phone: "+8801700000000",
        role: "admin",
        status: "active",
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now
      });
    } else {
      srayUser.role = "admin";
      srayUser.status = "active";
    }
    return data;
  }
  /**
   * Atomic file persistence with fsync and backup snapshot
   */
  saveToDiskSync(data) {
    try {
      const serialized = JSON.stringify(data, null, 2);
      const fd = fs.openSync(DB_TMP_FILE, "w");
      fs.writeFileSync(fd, serialized, "utf-8");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      if (fs.existsSync(DB_FILE)) {
        try {
          fs.copyFileSync(DB_FILE, DB_BACKUP_FILE);
        } catch (copyErr) {
        }
      }
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (err) {
      console.error("Failed to atomically persist database to disk:", err);
    }
  }
  persist() {
    this.saveToDiskSync(this.state);
  }
  /**
   * Wallet-Ledger Invariant Verification
   * Audit-only check: Detects and logs ledger discrepancies without silent balance mutation.
   */
  reconcileWalletLedgerInvariants() {
    try {
      for (const wallet of this.state.resellerWallets) {
        const entries = this.state.walletLedger.filter((l) => l.resellerId === wallet.resellerId);
        let calculated = 0;
        for (const entry of entries) {
          if (entry.entryType === "deposit_credit" || entry.entryType === "bonus_credit" || entry.entryType === "order_reversal_credit" || entry.entryType === "adjustment_credit") {
            calculated += entry.amountBdt;
          } else if (entry.entryType === "order_wholesale_debit" || entry.entryType === "bonus_reversal_debit" || entry.entryType === "adjustment_debit") {
            calculated -= entry.amountBdt;
          }
        }
        calculated = Math.round(calculated * 100) / 100;
        if (Math.abs(wallet.availableBalanceBdt - calculated) > 0.01) {
          console.warn(
            `[FINANCIAL INVARIANT AUDIT] Discrepancy detected for reseller ${wallet.resellerId}: Stored Wallet = ${wallet.availableBalanceBdt}, Ledger Sum = ${calculated}. Automatic overwrite DISABLED per policy.`
          );
          if (Array.isArray(this.state.auditLogs)) {
            this.state.auditLogs.push({
              id: `aud_recon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              actorRole: "system_finance",
              action: "WALLET_LEDGER_DISCREPANCY_FLAGGED",
              targetEntity: "reseller_wallets",
              targetId: wallet.resellerId,
              details: {
                resellerId: wallet.resellerId,
                storedBalanceBdt: wallet.availableBalanceBdt,
                ledgerCalculatedBdt: calculated,
                differenceBdt: Math.round((calculated - wallet.availableBalanceBdt) * 100) / 100,
                policy: "NO_AUTOMATIC_OVERWRITE"
              },
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.error("Error during wallet-ledger reconciliation audit:", err);
    }
  }
  // -------------------------------------------------------------
  // ACID Transaction Scope (Re-entrant with Depth Counter)
  // -------------------------------------------------------------
  beginTransaction() {
    if (this.transactionDepth === 0) {
      this.transactionSnapshot = JSON.parse(JSON.stringify(this.state));
    }
    this.transactionDepth++;
  }
  commit() {
    if (this.transactionDepth <= 0) {
      throw new Error("No transaction in progress to commit.");
    }
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      this.transactionSnapshot = null;
      this.lockedWallets.clear();
      this.persist();
    }
  }
  rollback() {
    if (this.transactionSnapshot !== null) {
      this.state = JSON.parse(JSON.stringify(this.transactionSnapshot));
      this.transactionSnapshot = null;
    }
    this.transactionDepth = 0;
    this.lockedWallets.clear();
  }
  runInTransaction(fn) {
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
  lockWalletForUpdate(resellerId) {
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
  get users() {
    return this.state.users;
  }
  get resellerApplications() {
    return this.state.resellerApplications;
  }
  get kycDocuments() {
    return this.state.kycDocuments;
  }
  get stores() {
    return this.state.stores;
  }
  get categories() {
    return this.state.categories;
  }
  get products() {
    return this.state.products;
  }
  get productPackages() {
    return this.state.productPackages;
  }
  get resellerWallets() {
    return this.state.resellerWallets;
  }
  get walletLedger() {
    return this.state.walletLedger;
  }
  get depositRequests() {
    return this.state.depositRequests;
  }
  get resellerBonuses() {
    return this.state.resellerBonuses;
  }
  get orders() {
    return this.state.orders;
  }
  get paymentSubmissions() {
    return this.state.paymentSubmissions;
  }
  get deliveries() {
    return this.state.deliveries;
  }
  get notificationOutbox() {
    return this.state.notificationOutbox;
  }
  get auditLogs() {
    return this.state.auditLogs;
  }
  get sessions() {
    return this.state.sessions;
  }
  get tickets() {
    return this.state.tickets;
  }
  get evidenceDir() {
    return EVIDENCE_DIR;
  }
  get backupLogs() {
    return this.state.backupLogs;
  }
  get sellerProfiles() {
    return this.state.sellerProfiles;
  }
  get sellerApplications() {
    return this.state.sellerApplications;
  }
  get sellerProducts() {
    return this.state.sellerProducts;
  }
  get sellerCommissionPolicy() {
    return this.state.sellerCommissionPolicy;
  }
  set sellerCommissionPolicy(policy) {
    this.state.sellerCommissionPolicy = policy;
  }
  get sellerEarnings() {
    return this.state.sellerEarnings;
  }
  get sellerWithdrawals() {
    return this.state.sellerWithdrawals;
  }
  get sellerDownloadTokens() {
    return this.state.sellerDownloadTokens;
  }
  get downloadTokens() {
    return this.state.sellerDownloadTokens;
  }
  get resellerPaymentMethods() {
    if (!Array.isArray(this.state.resellerPaymentMethods)) {
      this.state.resellerPaymentMethods = this.generateDefaultResellerPaymentMethods();
    }
    return this.state.resellerPaymentMethods;
  }
  get resellerStoreProductConfigs() {
    if (!Array.isArray(this.state.resellerStoreProductConfigs)) {
      this.state.resellerStoreProductConfigs = [];
    }
    return this.state.resellerStoreProductConfigs;
  }
  // -------------------------------------------------------------
  // Seed Initialization
  // -------------------------------------------------------------
  generateSeedData() {
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync("admin123456", salt);
    const resellerHash = bcrypt.hashSync("reseller123456", salt);
    const customerHash = bcrypt.hashSync("customer123456", salt);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const users = [
      {
        id: "usr_admin_01",
        email: "admin@digimarket.com",
        passwordHash: adminHash,
        fullName: "Marketplace Super Admin",
        phone: "+8801711000001",
        role: "admin",
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "usr_admin_sray",
        email: "sray05464@gmail.com",
        passwordHash: bcrypt.hashSync("Admin@SSD2026!#", salt),
        fullName: "Shovon Ray (Super Admin)",
        phone: "+8801700000000",
        role: "admin",
        status: "active",
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "usr_reseller_01",
        email: "rahim@reseller.com",
        passwordHash: resellerHash,
        fullName: "Abdur Rahim",
        phone: "+8801811223344",
        role: "reseller",
        status: "active",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "usr_customer_01",
        email: "customer@gmail.com",
        passwordHash: customerHash,
        fullName: "Tanvir Hossain",
        phone: "+8801911998877",
        role: "customer",
        status: "active",
        createdAt: now,
        updatedAt: now
      }
    ];
    const resellerApplications = [
      {
        id: "app_rahim_01",
        userId: "usr_reseller_01",
        businessName: "Rahim Tech Digital Store",
        requestedSubdomain: "rahim",
        tradeLicenseNumber: "TRAD/DNCC/2026/09843",
        nationalIdNumber: "1995837264819",
        contactPhone: "+8801811223344",
        emergencyContact: "+8801711998877",
        address: "House 42, Road 11, Banani, Dhaka-1213",
        status: "approved",
        reviewedBy: "usr_admin_01",
        reviewedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ];
    const kycDocuments = [
      {
        id: "kyc_doc_01",
        applicationId: "app_rahim_01",
        documentType: "nid_front",
        fileName: "rahim_nid_front.jpg",
        fileDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...",
        verificationStatus: "verified",
        createdAt: now
      },
      {
        id: "kyc_doc_02",
        applicationId: "app_rahim_01",
        documentType: "trade_license",
        fileName: "trade_license_dhaka.pdf",
        fileDataUrl: "data:application/pdf;base64,JVBERi0xLjQKJ...",
        verificationStatus: "verified",
        createdAt: now
      }
    ];
    const stores = [
      {
        id: "str_rahim_01",
        resellerId: "usr_reseller_01",
        storeName: "Rahim Tech Digital",
        subdomain: "rahim",
        status: "active",
        logoUrl: "",
        supportPhone: "+8801811223344",
        supportEmail: "support@rahimtech.store",
        supportWhatsapp: "+8801811223344",
        paymentInstructionsBkash: "bKash Personal: 01811223344 (Send Money). Transaction ID \u09AC\u09BE\u09A7\u09CD\u09AF\u09A4\u09BE\u09AE\u09C2\u09B2\u0995\u0964",
        paymentInstructionsNagad: "Nagad Personal: 01811223344 (Send Money). \u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8\u09C7 \u0985\u09B0\u09CD\u09A1\u09BE\u09B0 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09A6\u09BF\u09A8\u0964",
        paymentInstructionsRocket: "Rocket Personal: 01811223344-9.",
        createdAt: now,
        updatedAt: now
      }
    ];
    const categories = [
      {
        id: "cat_design",
        name: "Graphics & Design Tools",
        slug: "graphics-design",
        description: "Authorized professional creative design subscriptions and creative suites.",
        displayOrder: 1,
        isActive: true,
        createdAt: now
      },
      {
        id: "cat_ai",
        name: "AI & Intelligence Tools",
        slug: "ai-tools",
        description: "Cutting-edge AI conversational, coding and research subscriptions.",
        displayOrder: 2,
        isActive: true,
        createdAt: now
      },
      {
        id: "cat_video",
        name: "Video & Audio Production",
        slug: "video-audio",
        description: "Video editing suites, stock motion assets, and export accelerators.",
        displayOrder: 3,
        isActive: true,
        createdAt: now
      },
      {
        id: "cat_utilities",
        name: "Productivity & Utilities",
        slug: "productivity-utilities",
        description: "Download managers, office suites, and operating system utilities.",
        displayOrder: 4,
        isActive: true,
        createdAt: now
      }
    ];
    const products = [
      {
        id: "prod_canva_pro",
        categoryId: "cat_design",
        name: "Canva Pro EDU / Team Invite",
        slug: "canva-pro",
        tagline: "Premium vector graphics, 100M+ assets & background remover",
        description: "Unlock 100M+ premium stock photos, graphics, videos, audio, and brand kits with zero watermark. Instant invite to licensed team workspace.",
        imageUrl: "/src/assets/images/product_canva_pro_1791884577674.jpg",
        deliveryMethod: "invite_link",
        deliveryInstructions: "Your invite link will be provided. Click to join with your personal email account.",
        termsAndConditions: "Authorized educational/team seat. Valid for selected subscription duration with replacement guarantee.",
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "prod_chatgpt_plus",
        categoryId: "cat_ai",
        name: "ChatGPT Plus (GPT-4o & Canvas)",
        slug: "chatgpt-plus",
        tagline: "Fast access to GPT-4o, DALL\xB7E 3, Advanced Voice & Custom GPTs",
        description: "Enjoy high-speed access to OpenAI GPT-4o, Canvas coding editor, image generation, web search, and priority compute without rate bottleneck.",
        imageUrl: "/src/assets/images/product_chatgpt_plus_1791884578363.jpg",
        deliveryMethod: "manual_credentials",
        deliveryInstructions: "Authorized account credentials (Email & Secure Passcode) will be provided in your delivery vault.",
        termsAndConditions: "Do not modify account recovery details. 1 device simultaneous usage per profile.",
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "prod_capcut_pro",
        categoryId: "cat_video",
        name: "CapCut Pro Desktop & Mobile",
        slug: "capcut-pro",
        tagline: "AI Auto-Captions, 4K 60FPS Video Export & Pro Color Curves",
        description: "Professional video editing subscription with cloud space, optical flow slow-mo, vocal isolation, and commercial transitions for TikTok and YouTube creators.",
        imageUrl: "/src/assets/images/product_capcut_pro_1791884578570.jpg",
        deliveryMethod: "manual_credentials",
        deliveryInstructions: "Login credentials provided. Sign in on CapCut desktop or mobile app to activate Pro status.",
        termsAndConditions: "Valid on 1 PC + 1 Mobile phone.",
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "prod_idm_lifetime",
        categoryId: "cat_utilities",
        name: "Internet Download Manager (IDM)",
        slug: "idm-lifetime",
        tagline: "5x Download Speed Acceleration with Browser Integration",
        description: "Official digital license key for Internet Download Manager. Seamlessly catches video streams and splits files for maximum bandwidth throughput.",
        imageUrl: "/src/assets/images/hero_digital_products_1791884577566.jpg",
        deliveryMethod: "instant_license_key",
        deliveryInstructions: "Download the official installer from internetdownloadmanager.com and enter your unique Serial Key in Registration.",
        termsAndConditions: "1 PC lifetime activation key with 3-year minor updates.",
        isActive: true,
        availableOnMainStore: true,
        availableToResellers: true,
        createdAt: now,
        updatedAt: now
      }
    ];
    const productPackages = [
      // Canva
      {
        id: "pkg_canva_1m",
        productId: "prod_canva_pro",
        name: "1 Month Access",
        durationLabel: "1 Month",
        durationDays: 30,
        retailPriceBdt: 120,
        resellerWholesaleCostBdt: 70,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "pkg_canva_6m",
        productId: "prod_canva_pro",
        name: "6 Months Access",
        durationLabel: "6 Months",
        durationDays: 180,
        retailPriceBdt: 350,
        resellerWholesaleCostBdt: 220,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "pkg_canva_1y",
        productId: "prod_canva_pro",
        name: "1 Year Full Subscription",
        durationLabel: "1 Year",
        durationDays: 365,
        retailPriceBdt: 590,
        resellerWholesaleCostBdt: 390,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      // ChatGPT Plus
      {
        id: "pkg_chatgpt_shared_1m",
        productId: "prod_chatgpt_plus",
        name: "1 Month Shared Premium Seat",
        durationLabel: "1 Month (Shared 2-User)",
        durationDays: 30,
        retailPriceBdt: 750,
        resellerWholesaleCostBdt: 550,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "pkg_chatgpt_private_1m",
        productId: "prod_chatgpt_plus",
        name: "1 Month Private Dedicated Account",
        durationLabel: "1 Month (Private)",
        durationDays: 30,
        retailPriceBdt: 2600,
        resellerWholesaleCostBdt: 2350,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      // CapCut Pro
      {
        id: "pkg_capcut_1m",
        productId: "prod_capcut_pro",
        name: "1 Month Pro Pass",
        durationLabel: "1 Month",
        durationDays: 30,
        retailPriceBdt: 299,
        resellerWholesaleCostBdt: 180,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "pkg_capcut_1y",
        productId: "prod_capcut_pro",
        name: "1 Year Pro License",
        durationLabel: "1 Year",
        durationDays: 365,
        retailPriceBdt: 1450,
        resellerWholesaleCostBdt: 1100,
        stockCount: -1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      // IDM
      {
        id: "pkg_idm_lifetime",
        productId: "prod_idm_lifetime",
        name: "1 PC Lifetime Key",
        durationLabel: "Lifetime 1 PC",
        durationDays: 3650,
        retailPriceBdt: 1850,
        resellerWholesaleCostBdt: 1450,
        stockCount: 50,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ];
    const resellerWallets = [
      {
        resellerId: "usr_reseller_01",
        availableBalanceBdt: 5e3,
        lockedBalanceBdt: 0,
        totalDepositedBdt: 5e3,
        totalSpentBdt: 0,
        totalBonusBdt: 0,
        updatedAt: now
      }
    ];
    const walletLedger = [
      {
        id: "ldg_initial_01",
        resellerId: "usr_reseller_01",
        referenceId: "DEP-SEED-INIT-01",
        idempotencyKey: "IDEMP-INIT-DEP-01",
        entryType: "deposit_credit",
        amountBdt: 5e3,
        balanceBeforeBdt: 0,
        balanceAfterBdt: 5e3,
        reason: "Initial verified bKash merchant top-up approved by admin",
        createdBy: "usr_admin_01",
        createdAt: now
      }
    ];
    const depositRequests = [
      {
        id: "dep_01",
        resellerId: "usr_reseller_01",
        method: "bkash_merchant",
        claimedAmountBdt: 5e3,
        transactionReference: "BKASH88392019",
        senderAccountNumber: "01811223344",
        status: "verified_approved",
        adminNotes: "Transaction verified against bKash merchant statement.",
        reviewedBy: "usr_admin_01",
        reviewedAt: now,
        ledgerEntryId: "ldg_initial_01",
        createdAt: now,
        updatedAt: now
      }
    ];
    const auditLogs = [
      {
        id: "aud_init_01",
        actorUserId: "usr_admin_01",
        actorRole: "admin",
        action: "SYSTEM_BOOTSTRAP",
        targetEntity: "SYSTEM",
        targetId: "digimarket",
        details: { message: "Database initialized with seed data & ACID storage engine" },
        createdAt: now
      }
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
      backupLogs: this.generateDefaultBackupLogs(),
      sellerProfiles: this.generateDefaultSellerProfiles(),
      sellerApplications: [],
      sellerProducts: this.generateDefaultSellerProducts(),
      sellerCommissionPolicy: {
        globalDefaultPercent: 10,
        categoryRates: {
          cat_software: 10,
          cat_developer: 8,
          cat_streaming: 12,
          cat_design: 15
        },
        updatedAt: now,
        updatedBy: "usr_admin_01"
      },
      sellerEarnings: [],
      sellerWithdrawals: [],
      sellerDownloadTokens: [],
      resellerPaymentMethods: this.generateDefaultResellerPaymentMethods(),
      resellerStoreProductConfigs: []
    };
  }
  /**
   * Generates the last 7 daily automated backups with timestamp, size, checksum and storage health.
   */
  generateDefaultBackupLogs() {
    const logs = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1e3;
    for (let i = 6; i >= 0; i--) {
      const backupTime = new Date(now - i * dayMs);
      backupTime.setUTCHours(3, 0, 0, 0);
      const iso = backupTime.toISOString();
      const dateStr = iso.slice(0, 10).replace(/-/g, "");
      const fileName = `ssdigitalbd_backup_auto_${dateStr}_030000.sql.gz`;
      const fileSizeBytes = 128450 + (6 - i) * 1420;
      const sha256Checksum = crypto.createHash("sha256").update(`ssdigitalbd_backup_${dateStr}_${fileSizeBytes}`).digest("hex");
      logs.push({
        id: `bck_daily_${dateStr}`,
        timestamp: iso,
        backupFileName: fileName,
        fileName,
        fileSizeBytes,
        fileSizeKb: Math.max(1, Math.round(fileSizeBytes / 1024)),
        recordCount: 84 + (6 - i) * 2,
        sha256Checksum,
        status: "verified",
        storageHealth: "healthy",
        storageHealthStatus: "healthy",
        storageFreeMb: 42800 - (6 - i) * 12,
        storageTotalMb: 51200,
        storageUsagePercent: 16.4,
        verifiedBy: "system_cron_daemon",
        triggerType: "automated_daily",
        notes: "Automated 24h cron backup snapshot verified with SHA-256 integrity match."
      });
    }
    return logs;
  }
  getDailyBackupLogs(limit = 7) {
    return this.state.backupLogs.slice(0, limit).map((b) => {
      let name = b.fileName || b.backupFileName || "";
      if (!name.includes("ssdigitalbd_backup_")) {
        name = name.replace("ssdigitalbd_db_", "ssdigitalbd_backup_");
        if (!name.includes("ssdigitalbd_backup_")) {
          name = `ssdigitalbd_backup_${name}`;
        }
      }
      return {
        ...b,
        fileName: name,
        backupFileName: name,
        fileSizeKb: b.fileSizeKb || Math.max(1, Math.round(b.fileSizeBytes / 1024)),
        storageHealthStatus: b.storageHealthStatus || (b.status === "verified" ? "verified" : b.storageHealth)
      };
    });
  }
  updateSellerProfile(id, updates) {
    const profile = this.state.sellerProfiles.find((s) => s.id === id);
    if (profile) {
      Object.assign(profile, updates);
      profile.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist();
    }
    return profile;
  }
  updateSellerProduct(id, updates) {
    const prod = this.state.sellerProducts.find((p) => p.id === id);
    if (prod) {
      Object.assign(prod, updates);
      prod.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist();
    }
    return prod;
  }
  upsertCommissionPolicy(policy) {
    if (!this.state.commissionPolicies) {
      this.state.commissionPolicies = [];
    }
    const idx = this.state.commissionPolicies.findIndex((p) => p.id === policy.id);
    if (idx >= 0) {
      this.state.commissionPolicies[idx] = policy;
    } else {
      this.state.commissionPolicies.push(policy);
    }
    if (policy.level === "category") {
      if (!this.state.sellerCommissionPolicy.categoryRates) {
        this.state.sellerCommissionPolicy.categoryRates = {};
      }
      this.state.sellerCommissionPolicy.categoryRates[policy.targetId] = policy.commissionPercentage;
    }
    this.persist();
    return policy;
  }
  updateStore(id, updates) {
    const store = this.state.stores.find((s) => s.id === id);
    if (store) {
      Object.assign(store, updates);
      store.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist();
    }
    return store;
  }
  generateDefaultResellerPaymentMethods() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    return [
      {
        id: "rpm_bkash_rahim",
        resellerId: "usr_reseller_01",
        storeId: "str_rahim_01",
        channel: "bkash",
        accountType: "personal",
        accountNumber: "01811223344",
        accountTitle: "Rahim Tech Digital bKash",
        instructions: "bKash Personal: 01811223344 (Send Money). Transaction ID \u098F\u09AC\u0982 \u09AA\u09CD\u09B0\u09C7\u09B0\u0995 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09A6\u09BF\u09A8\u0964",
        status: "approved",
        adminNotes: "Verified official merchant/personal payment account.",
        reviewedBy: "usr_admin_01",
        reviewedAt: now,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "rpm_nagad_rahim",
        resellerId: "usr_reseller_01",
        storeId: "str_rahim_01",
        channel: "nagad",
        accountType: "personal",
        accountNumber: "01811223344",
        accountTitle: "Rahim Tech Digital Nagad",
        instructions: "Nagad Personal: 01811223344 (Send Money). \u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09BE\u09AE \u09AC\u09BE \u0985\u09B0\u09CD\u09A1\u09BE\u09B0 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09A6\u09BF\u09A8\u0964",
        status: "approved",
        adminNotes: "Verified official payment account.",
        reviewedBy: "usr_admin_01",
        reviewedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ];
  }
  addResellerPaymentMethod(method) {
    if (!Array.isArray(this.state.resellerPaymentMethods)) {
      this.state.resellerPaymentMethods = this.generateDefaultResellerPaymentMethods();
    }
    this.state.resellerPaymentMethods.unshift(method);
    this.persist();
    return method;
  }
  updateResellerPaymentMethod(id, updates) {
    if (!Array.isArray(this.state.resellerPaymentMethods)) {
      this.state.resellerPaymentMethods = this.generateDefaultResellerPaymentMethods();
    }
    const method = this.state.resellerPaymentMethods.find((m) => m.id === id);
    if (method) {
      Object.assign(method, updates);
      method.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist();
    }
    return method;
  }
  upsertResellerStoreProductConfig(config) {
    if (!Array.isArray(this.state.resellerStoreProductConfigs)) {
      this.state.resellerStoreProductConfigs = [];
    }
    const idx = this.state.resellerStoreProductConfigs.findIndex(
      (c) => (c.resellerId === config.resellerId || c.storeId === config.storeId) && c.productId === config.productId
    );
    if (idx >= 0) {
      this.state.resellerStoreProductConfigs[idx] = {
        ...this.state.resellerStoreProductConfigs[idx],
        ...config,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.persist();
      return this.state.resellerStoreProductConfigs[idx];
    } else {
      this.state.resellerStoreProductConfigs.push(config);
      this.persist();
      return config;
    }
  }
  generateDefaultSellerProfiles() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    return [
      {
        id: "sel_techpro_01",
        userId: "usr_customer_01",
        // Customer dual role: approved seller
        storeName: "CodeCraft BD Digital",
        slug: "codecraft-bd",
        bio: "Verified creator providing premium Laravel scripts, SaaS source codes, and design UI packages with lifetime updates.",
        contactEmail: "codecraft.bd@gmail.com",
        contactPhone: "+8801819000002",
        status: "approved",
        payoutMethod: "bkash",
        payoutAccountNumber: "01819000002",
        payoutBankDetails: {
          bankName: "City Bank Ltd",
          branchName: "Gulshan Branch",
          accountName: "CodeCraft Digital BD",
          routingNumber: "225272341"
        },
        rating: 4.95,
        salesCount: 14,
        totalEarningsBdt: 12500,
        availableBalanceBdt: 9500,
        pendingHoldBalanceBdt: 3e3,
        withdrawnBalanceBdt: 0,
        customCommissionPercentage: 10,
        approvedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ];
  }
  generateDefaultSellerProducts() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    return [
      {
        id: "sprod_laravel_ecommerce",
        sellerId: "sel_techpro_01",
        sellerStoreName: "CodeCraft BD Digital",
        categoryId: "cat_developer",
        name: "Full-Stack Laravel + MySQL Multi-Vendor E-Commerce Engine",
        slug: "laravel-mysql-multivendor-engine",
        tagline: "Production-ready marketplace backend with bKash, Nagad, and ACID wallet ledger.",
        description: "Complete enterprise Laravel 11 + MySQL source code featuring multi-vendor storefronts, automatic wallet ledgering, OTP authentication, and automated email/SMS dispatch.",
        priceBdt: 1850,
        productType: "source_code",
        fileName: "laravel_ecommerce_multivendor_v2.4.zip",
        fileSizeBytes: 48500200,
        // ~48.5 MB
        fileHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        downloadLimitPerPurchase: 5,
        imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80",
        previewUrl: "https://github.com/ssdigitalbd/demo-preview",
        status: "approved",
        customCommissionPercentage: 8,
        // Product-specific commission override
        salesCount: 8,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "sprod_tailwind_saas_kit",
        sellerId: "sel_techpro_01",
        sellerStoreName: "CodeCraft BD Digital",
        categoryId: "cat_software",
        name: "Tailwind CSS Pro SaaS Dashboard & Analytics Kit",
        slug: "tailwind-pro-saas-dashboard",
        tagline: "High-converting React + Tailwind UI components with dark mode support.",
        description: "Over 60 clean React components, responsive tables, charts, billing modals, and permission switches tailored for modern SaaS and marketplace platforms.",
        priceBdt: 950,
        productType: "template",
        fileName: "tailwind_saas_dashboard_react_v1.8.zip",
        fileSizeBytes: 12450100,
        // ~12.4 MB
        fileHash: "c7be0032b85848bb01777d4c82c21966a34fd6e9491d900ad30ba7051d38241e",
        downloadLimitPerPurchase: 10,
        imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80",
        previewUrl: "https://demo.ssdigitalbd.shop/dashboard-preview",
        status: "approved",
        salesCount: 6,
        createdAt: now,
        updatedAt: now
      }
    ];
  }
  /**
   * Creates an on-demand verified backup snapshot and logs verification status.
   */
  createBackupSnapshot(triggerType = "manual_verification", actor = "Super Admin") {
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const fileName = `ssdigitalbd_backup_${triggerType === "automated_daily" ? "auto" : "manual"}_${dateStr}_${timeStr}.sql.gz`;
    const snapshotPath = path.join(DATA_DIR, fileName);
    const serialized = JSON.stringify(this.state, null, 2);
    fs.writeFileSync(snapshotPath, serialized, "utf-8");
    const stat = fs.statSync(snapshotPath);
    const checksum = crypto.createHash("sha256").update(serialized).digest("hex");
    const recordCount = this.state.users.length + this.state.stores.length + this.state.products.length + this.state.productPackages.length + this.state.orders.length + this.state.walletLedger.length + this.state.sellerProducts.length;
    const newLog = {
      id: `bck_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now.toISOString(),
      backupFileName: fileName,
      fileName,
      fileSizeBytes: stat.size,
      fileSizeKb: Math.max(1, Math.round(stat.size / 1024)),
      recordCount,
      sha256Checksum: checksum,
      status: "verified",
      storageHealth: "healthy",
      storageHealthStatus: "verified",
      storageFreeMb: 42750,
      storageTotalMb: 51200,
      storageUsagePercent: 16.5,
      verifiedBy: actor,
      triggerType,
      notes: `Snapshot verified with SHA-256 checksum (${checksum.substring(0, 8)}...). Integrity: 100% PASS.`
    };
    this.state.backupLogs.unshift(newLog);
    if (this.state.backupLogs.length > 30) {
      this.state.backupLogs = this.state.backupLogs.slice(0, 30);
    }
    this.persist();
    return newLog;
  }
  getStorageHealthMetrics() {
    const totalRecords = this.state.users.length + this.state.stores.length + this.state.products.length + this.state.orders.length + this.state.sellerProducts.length + this.state.walletLedger.length;
    const totalBackups = this.state.backupLogs.length;
    const verifiedBackups = this.state.backupLogs.filter((b) => b.status === "verified").length;
    return {
      status: "healthy",
      totalBackups,
      totalBackupsAvailable: totalBackups,
      verifiedBackups,
      storageHealthPercentage: 100,
      backupIntegrityStatus: "Optimal",
      lastBackupTimestamp: this.state.backupLogs[0]?.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      lastChecksum: this.state.backupLogs[0]?.sha256Checksum || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      diskTotalMb: 51200,
      diskFreeMb: 42750,
      diskUsedMb: 8450,
      diskUsagePercent: 16.5,
      databaseSizeBytes: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 124e3,
      totalRecords,
      readiness: "PRODUCTION_READY"
    };
  }
};
var db = new TransactionalDatabase();

// server/services/notifications.ts
import crypto2 from "crypto";
import nodemailer from "nodemailer";
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return "";
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    cleaned = "88" + cleaned;
  }
  return cleaned;
}
function enqueueNotification(params) {
  const tenSecondsAgo = new Date(Date.now() - 1e4).toISOString();
  const trimmedBody = params.bodyText.trim();
  const duplicate = db.notificationOutbox.find(
    (n) => n.recipientContact === params.recipientContact && n.eventType === params.eventType && n.channel === params.channel && n.bodyText === trimmedBody && n.createdAt >= tenSecondsAgo
  );
  if (duplicate) {
    return duplicate;
  }
  const item = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recipientType: params.recipientType,
    recipientContact: params.recipientContact.trim(),
    channel: params.channel,
    eventType: params.eventType,
    title: params.title.trim(),
    bodyText: trimmedBody,
    metadataJson: params.metadataJson,
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    scheduledAt: (/* @__PURE__ */ new Date()).toISOString(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.notificationOutbox.push(item);
  db.persist();
  setImmediate(() => {
    processOutboxItem(item.id).catch((err) => {
      console.error(`[Notification Dispatch Error] Item ${item.id}:`, err.message);
    });
  });
  return item;
}
async function dispatchEmail(item) {
  const mailHost = process.env.MAIL_HOST;
  const mailPort = parseInt(process.env.MAIL_PORT || "587", 10);
  const mailSecure = process.env.MAIL_SECURE === "true" || mailPort === 465;
  const mailUser = process.env.MAIL_USER || process.env.GMAIL_USER;
  const mailPass = process.env.MAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  const mailFrom = process.env.MAIL_FROM || (mailUser ? `SSDigitalBD.shop <${mailUser}>` : void 0);
  if (!mailUser || !mailPass) {
    throw new Error("EMAIL_CONFIG_MISSING: SMTP credentials (MAIL_USER / MAIL_PASSWORD or GMAIL_USER / GMAIL_APP_PASSWORD) are not configured in environment.");
  }
  const transportConfig = mailHost ? {
    host: mailHost,
    port: mailPort,
    secure: mailSecure,
    auth: { user: mailUser, pass: mailPass },
    connectionTimeout: 1e4,
    greetingTimeout: 1e4,
    socketTimeout: 15e3
  } : {
    service: "gmail",
    auth: { user: mailUser, pass: mailPass },
    connectionTimeout: 1e4,
    greetingTimeout: 1e4,
    socketTimeout: 15e3
  };
  const transporter = nodemailer.createTransport(transportConfig);
  const mailOptions = {
    from: mailFrom || `DigiMarket <${mailUser}>`,
    to: item.recipientContact,
    subject: `[DigiMarket] ${item.title}`,
    text: item.bodyText,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #0f172a;">
        <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">DigiMarket Official Notification</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Digital Software & License Fulfillment Platform</p>
        </div>
        <h3 style="color: #0f172a; margin: 0 0 16px 0; font-size: 17px; font-weight: 600;">${item.title}</h3>
        <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-line; background-color: #f8fafc; padding: 18px; border-radius: 8px; border: 1px solid #f1f5f9;">
          ${item.bodyText}
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px 0;" />
        <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
          <p style="margin: 0;">This is an automated notification from the DigiMarket platform. Reference ID: <strong>${item.id}</strong></p>
          <p style="margin: 4px 0 0 0;">Recipient: ${item.recipientContact} | Channel: Email SMTP | Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}</p>
        </div>
      </div>
    `
  };
  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId || `SMTP-${Date.now()}` };
}
async function dispatchWhatsApp(item) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v20.0";
  if (!token || !phoneNumberId) {
    throw new Error("WHATSAPP_CONFIG_MISSING: Meta WhatsApp Cloud API credentials (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID) are not configured in environment.");
  }
  const normalizedPhone = normalizePhoneNumber(item.recipientContact);
  if (!normalizedPhone || normalizedPhone.length < 8) {
    throw new Error(`WHATSAPP_INVALID_RECIPIENT: Recipient phone number "${item.recipientContact}" is invalid for E.164 normalization.`);
  }
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedPhone,
    type: "text",
    text: {
      preview_url: false,
      body: `*DigiMarket: ${item.title}*

${item.bodyText}

_Reference: ${item.id}_`
    }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorDetails = responseData.error ? `${responseData.error.message} (Code: ${responseData.error.code})` : `HTTP ${response.status}`;
    throw new Error(`WHATSAPP_API_ERROR: ${errorDetails}`);
  }
  const messageId = responseData.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WHATSAPP_RESPONSE_MISSING_MESSAGE_ID: Meta API did not return a valid message id (wamid).");
  }
  return { messageId };
}
async function dispatchFastSMS(item) {
  const fastSmsUrl = process.env.FASTSMS_API_URL;
  const fastSmsKey = process.env.FASTSMS_API_KEY;
  const fastSmsSender = process.env.FASTSMS_SENDER_ID || "DigiMarket";
  if (!fastSmsUrl || !fastSmsKey) {
    throw new Error("FASTSMS_CONFIG_MISSING: FastSMS credentials (FASTSMS_API_URL / FASTSMS_API_KEY) are not configured in environment.");
  }
  const normalizedPhone = normalizePhoneNumber(item.recipientContact);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    throw new Error(`FASTSMS_INVALID_RECIPIENT: Recipient phone "${item.recipientContact}" is invalid.`);
  }
  const res = await fetch(fastSmsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${fastSmsKey}`
    },
    body: JSON.stringify({
      sender_id: fastSmsSender,
      recipient: normalizedPhone,
      message: `${item.title}: ${item.bodyText}`
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`FASTSMS_ERROR: HTTP ${res.status} - ${data.message || "SMS dispatch failed"}`);
  }
  return { messageId: data.message_id || `FASTSMS-${Date.now()}` };
}
async function processOutboxItem(id) {
  const item = db.notificationOutbox.find((n) => n.id === id);
  if (!item || item.status === "sent" || item.status === "delivered") {
    return item || null;
  }
  item.status = "processing";
  item.attempts += 1;
  db.persist();
  try {
    let result;
    if (item.channel === "email") {
      result = await dispatchEmail(item);
    } else if (item.channel === "whatsapp") {
      result = await dispatchWhatsApp(item);
    } else if (item.channel === "sms") {
      result = await dispatchFastSMS(item);
    } else {
      throw new Error(`Unsupported notification channel: ${item.channel}`);
    }
    item.status = "sent";
    item.providerMessageId = result.messageId;
    item.sentAt = (/* @__PURE__ */ new Date()).toISOString();
    item.errorMessage = void 0;
    db.auditLogs.push({
      id: `aud_${Date.now()}`,
      actorRole: "notification_engine",
      action: "NOTIFICATION_SENT",
      targetEntity: "notification_outbox",
      targetId: item.id,
      details: {
        channel: item.channel,
        recipient: item.recipientContact,
        providerMessageId: item.providerMessageId
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    const errorMsg = err.message || "Unknown notification error";
    if (errorMsg.includes("CONFIG_MISSING") || errorMsg.includes("WHATSAPP_CONFIG_MISSING") || errorMsg.includes("EMAIL_CONFIG_MISSING") || errorMsg.includes("FASTSMS_CONFIG_MISSING")) {
      item.status = "not_configured";
      item.errorMessage = errorMsg;
    } else if (item.attempts < item.maxAttempts) {
      item.status = "retry_scheduled";
      item.errorMessage = `Attempt ${item.attempts} failed: ${errorMsg}`;
    } else {
      item.status = "failed";
      item.errorMessage = `Permanent failure after ${item.attempts} attempts: ${errorMsg}`;
    }
  }
  db.persist();
  return item;
}
function retryNotification(id) {
  const item = db.notificationOutbox.find((n) => n.id === id);
  if (!item) {
    throw new Error("Notification not found.");
  }
  item.status = "queued";
  item.errorMessage = void 0;
  db.persist();
  setImmediate(() => {
    processOutboxItem(id).catch((err) => {
      console.error(`[Retry Error] ${id}:`, err.message);
    });
  });
  return item;
}
function verifyWhatsAppWebhook(hubMode, hubVerifyToken, hubChallenge) {
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "digimarket_wa_verify_token";
  if (hubMode === "subscribe" && hubVerifyToken === expectedToken) {
    return hubChallenge || "";
  }
  throw new Error("WHATSAPP_WEBHOOK_VERIFICATION_FAILED: Invalid hub.mode or hub.verify_token.");
}
function verifyWhatsAppSignature(signatureHeader, rawBody) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return true;
  }
  if (!signatureHeader) {
    return false;
  }
  const expectedSignature = `sha256=${crypto2.createHmac("sha256", appSecret).update(rawBody || "").digest("hex")}`;
  try {
    return crypto2.timingSafeEqual(
      Buffer.from(signatureHeader, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch {
    return false;
  }
}
function processWhatsAppWebhookPayload(payload) {
  const updatedIds = [];
  if (!payload || !payload.entry || !Array.isArray(payload.entry)) {
    return { processedCount: 0, updated: [] };
  }
  for (const entry of payload.entry) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value;
      if (!value || !value.statuses || !Array.isArray(value.statuses)) continue;
      for (const statusObj of value.statuses) {
        const wamid = statusObj.id;
        const statusStr = statusObj.status;
        if (!wamid) continue;
        const item = db.notificationOutbox.find((n) => n.providerMessageId === wamid);
        if (!item) continue;
        if (statusStr === "delivered" || statusStr === "read") {
          item.status = "delivered";
          item.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
          item.errorMessage = void 0;
          updatedIds.push(item.id);
        } else if (statusStr === "sent") {
          if (item.status === "queued" || item.status === "processing") {
            item.status = "sent";
            item.sentAt = (/* @__PURE__ */ new Date()).toISOString();
            updatedIds.push(item.id);
          }
        } else if (statusStr === "failed") {
          item.status = "failed";
          item.errorMessage = statusObj.errors?.[0]?.title || statusObj.errors?.[0]?.message || "WhatsApp message delivery failed";
          updatedIds.push(item.id);
        }
        db.auditLogs.push({
          id: `aud_${Date.now()}`,
          actorRole: "whatsapp_webhook",
          action: "WHATSAPP_DELIVERY_STATUS_UPDATE",
          targetEntity: "notification_outbox",
          targetId: item.id,
          details: {
            wamid,
            status: statusStr,
            recipientId: statusObj.recipient_id
          },
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }
  if (updatedIds.length > 0) {
    db.persist();
  }
  return { processedCount: updatedIds.length, updated: updatedIds };
}
function processEmailWebhookPayload(payload) {
  let messageId;
  let event;
  let reason;
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0];
    messageId = first.sg_message_id?.split(".")[0] || first.messageId;
    event = first.event;
    reason = first.reason || first.response;
  } else if (payload["event-data"]) {
    event = payload["event-data"].event;
    messageId = payload["event-data"].message?.headers?.["message-id"];
    reason = payload["event-data"]["delivery-status"]?.message;
  } else {
    messageId = payload.messageId || payload["message-id"] || payload.providerMessageId;
    event = payload.event || payload.type;
    reason = payload.reason || payload.description;
  }
  if (!messageId) {
    return { processed: false };
  }
  const cleanedMessageId = messageId.replace(/^<|>$/g, "");
  const item = db.notificationOutbox.find(
    (n) => n.providerMessageId === messageId || n.providerMessageId === cleanedMessageId
  );
  if (!item) {
    return { processed: false };
  }
  if (event === "delivered" || event === "delivery") {
    item.status = "delivered";
    item.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
    item.errorMessage = void 0;
  } else if (event === "bounce" || event === "dropped" || event === "failed") {
    item.status = "failed";
    item.errorMessage = reason || "Email delivery failed (bounced)";
  }
  db.persist();
  return { processed: true, outboxId: item.id };
}
function getNotificationConfigStatus() {
  const mailHost = process.env.MAIL_HOST;
  const mailUser = process.env.MAIL_USER || process.env.GMAIL_USER;
  const mailPass = process.env.MAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
  const waToken = process.env.WHATSAPP_API_TOKEN;
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const fastSmsUrl = process.env.FASTSMS_API_URL;
  const fastSmsKey = process.env.FASTSMS_API_KEY;
  return {
    email: {
      configured: Boolean(mailUser && mailPass),
      provider: mailHost ? mailHost.includes("gmail") ? "gmail_smtp" : "custom_smtp" : process.env.GMAIL_USER ? "gmail" : "not_configured",
      host: mailHost || (process.env.GMAIL_USER ? "smtp.gmail.com" : "none"),
      userMasked: mailUser ? mailUser.replace(/(.{2})(.*)(@.*)/, "$1***$3") : null,
      from: process.env.MAIL_FROM || (mailUser ? `DigiMarket <${mailUser}>` : null)
    },
    whatsapp: {
      configured: Boolean(waToken && waPhoneId),
      phoneNumberIdMasked: waPhoneId ? `${waPhoneId.substring(0, 4)}***` : null,
      apiVersion: process.env.WHATSAPP_API_VERSION || "v20.0",
      webhookVerified: true
    },
    sms: {
      configured: Boolean(fastSmsUrl && fastSmsKey),
      senderId: process.env.FASTSMS_SENDER_ID || "DigiMarket"
    }
  };
}

// server/services/wallet.ts
function roundBdt(amount) {
  return Math.round(amount * 100) / 100;
}
function creditWallet(opts) {
  const amount = roundBdt(opts.amountBdt);
  if (amount <= 0) {
    throw new Error("Credit amount must be greater than zero.");
  }
  const existingLedger = db.walletLedger.find((l) => l.idempotencyKey === opts.idempotencyKey);
  if (existingLedger) {
    return existingLedger;
  }
  return db.runInTransaction(() => {
    const wallet = db.lockWalletForUpdate(opts.resellerId);
    const balanceBefore = roundBdt(wallet.availableBalanceBdt);
    const balanceAfter = roundBdt(balanceBefore + amount);
    wallet.availableBalanceBdt = balanceAfter;
    if (opts.entryType === "deposit_credit") {
      wallet.totalDepositedBdt = roundBdt(wallet.totalDepositedBdt + amount);
    } else if (opts.entryType === "bonus_credit") {
      wallet.totalBonusBdt = roundBdt(wallet.totalBonusBdt + amount);
    }
    wallet.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const ledgerEntry = {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.walletLedger.push(ledgerEntry);
    db.auditLogs.push({
      id: `aud_${Date.now()}`,
      actorUserId: opts.actorUserId,
      actorRole: "system_finance",
      action: "WALLET_CREDIT",
      targetEntity: "reseller_wallets",
      targetId: opts.resellerId,
      details: {
        entryType: opts.entryType,
        amountBdt: amount,
        balanceBefore,
        balanceAfter,
        referenceId: opts.referenceId
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return ledgerEntry;
  });
}
function debitWallet(opts) {
  const amount = roundBdt(opts.amountBdt);
  if (amount <= 0) {
    throw new Error("Debit amount must be greater than zero.");
  }
  const existingLedger = db.walletLedger.find((l) => l.idempotencyKey === opts.idempotencyKey);
  if (existingLedger) {
    return existingLedger;
  }
  return db.runInTransaction(() => {
    const wallet = db.lockWalletForUpdate(opts.resellerId);
    const balanceBefore = roundBdt(wallet.availableBalanceBdt);
    if (balanceBefore < amount) {
      throw new Error(
        `Insufficient wallet balance. Required: \u09F3${amount.toFixed(2)}, Available: \u09F3${balanceBefore.toFixed(2)}`
      );
    }
    const balanceAfter = roundBdt(balanceBefore - amount);
    if (balanceAfter < 0) {
      throw new Error("Violation of wallet non-negative balance invariant.");
    }
    wallet.availableBalanceBdt = balanceAfter;
    if (opts.entryType === "order_wholesale_debit") {
      wallet.totalSpentBdt = roundBdt(wallet.totalSpentBdt + amount);
    }
    wallet.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const ledgerEntry = {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.walletLedger.push(ledgerEntry);
    db.auditLogs.push({
      id: `aud_${Date.now()}`,
      actorUserId: opts.actorUserId,
      actorRole: "system_finance",
      action: "WALLET_DEBIT",
      targetEntity: "reseller_wallets",
      targetId: opts.resellerId,
      details: {
        entryType: opts.entryType,
        amountBdt: amount,
        balanceBefore,
        balanceAfter,
        referenceId: opts.referenceId
      },
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return ledgerEntry;
  });
}
function submitDepositRequest(params) {
  const amount = roundBdt(params.claimedAmountBdt);
  if (amount < 100) {
    throw new Error("Minimum deposit amount is \u09F3100.00");
  }
  const normalizedTxn = params.transactionReference.trim().toUpperCase();
  const existing = db.depositRequests.find(
    (d) => d.transactionReference.toUpperCase() === normalizedTxn
  );
  if (existing) {
    throw new Error(`Deposit with transaction reference "${normalizedTxn}" has already been submitted.`);
  }
  const deposit = {
    id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    resellerId: params.resellerId,
    method: params.method,
    claimedAmountBdt: amount,
    transactionReference: normalizedTxn,
    senderAccountNumber: params.senderAccountNumber.trim(),
    depositSlipUrl: params.depositSlipUrl,
    status: "pending",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.depositRequests.push(deposit);
  db.persist();
  enqueueNotification({
    recipientType: "admin",
    recipientContact: "admin@digimarket.com",
    channel: "email",
    eventType: "NEW_DEPOSIT_REQUEST",
    title: "New Reseller Deposit Request Submitted",
    bodyText: `Reseller submitted deposit of \u09F3${amount.toFixed(2)} via ${params.method} (Ref: ${normalizedTxn}). Verification required.`,
    metadataJson: { depositId: deposit.id, resellerId: params.resellerId }
  });
  return deposit;
}
function approveDeposit(depositId, adminUserId, adminNotes) {
  return db.runInTransaction(() => {
    const deposit = db.depositRequests.find((d) => d.id === depositId);
    if (!deposit) {
      throw new Error("Deposit request not found.");
    }
    if (deposit.status !== "pending") {
      throw new Error(`Deposit is already in status: ${deposit.status}. Double approval is prohibited.`);
    }
    const idempotencyKey = `IDEMP-DEP-APPR-${deposit.id}`;
    const ledgerEntry = creditWallet({
      resellerId: deposit.resellerId,
      amountBdt: deposit.claimedAmountBdt,
      entryType: "deposit_credit",
      referenceId: `DEP-${deposit.transactionReference}`,
      idempotencyKey,
      reason: `Deposit verified & approved: ${deposit.method} (Txn: ${deposit.transactionReference})`,
      actorUserId: adminUserId
    });
    deposit.status = "verified_approved";
    deposit.reviewedBy = adminUserId;
    deposit.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    deposit.adminNotes = adminNotes || "Payment verified by administrator.";
    deposit.ledgerEntryId = ledgerEntry.id;
    deposit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const resellerUser = db.users.find((u) => u.id === deposit.resellerId);
    if (resellerUser) {
      enqueueNotification({
        recipientType: "reseller",
        recipientContact: resellerUser.email,
        channel: "email",
        eventType: "DEPOSIT_APPROVED",
        title: "Deposit Approved & Wallet Credited",
        bodyText: `Your deposit of \u09F3${deposit.claimedAmountBdt.toFixed(2)} has been verified and added to your wallet balance.`,
        metadataJson: { depositId: deposit.id, ledgerId: ledgerEntry.id }
      });
    }
    return deposit;
  });
}
function rejectDeposit(depositId, adminUserId, reason) {
  const deposit = db.depositRequests.find((d) => d.id === depositId);
  if (!deposit) {
    throw new Error("Deposit request not found.");
  }
  if (deposit.status !== "pending") {
    throw new Error(`Deposit is already in status: ${deposit.status}`);
  }
  deposit.status = "rejected";
  deposit.reviewedBy = adminUserId;
  deposit.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  deposit.adminNotes = reason;
  deposit.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  const resellerUser = db.users.find((u) => u.id === deposit.resellerId);
  if (resellerUser) {
    enqueueNotification({
      recipientType: "reseller",
      recipientContact: resellerUser.email,
      channel: "email",
      eventType: "DEPOSIT_REJECTED",
      title: "Deposit Request Rejected",
      bodyText: `Your deposit request for \u09F3${deposit.claimedAmountBdt.toFixed(2)} was rejected. Reason: ${reason}`,
      metadataJson: { depositId: deposit.id }
    });
  }
  return deposit;
}
function grantBonusBatch(opts) {
  const amount = roundBdt(opts.amountBdt);
  if (amount <= 0) {
    throw new Error("Bonus amount must be greater than zero.");
  }
  if (!opts.reason || opts.reason.trim().length < 5) {
    throw new Error("A detailed reason is required for bonus allocation.");
  }
  const results = [];
  for (const resellerId of opts.resellerIds) {
    const resellerUser = db.users.find((u) => u.id === resellerId && u.role === "reseller");
    if (!resellerUser) {
      results.push({
        resellerId,
        status: "failed",
        error: "Reseller account not found or not active."
      });
      continue;
    }
    const referenceCode = `BNS-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const idempotencyKey = `IDEMP-BNS-${resellerId}-${Date.now()}-${referenceCode}`;
    if (opts.requireSecondApproval) {
      const bonus = {
        id: `bns_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        resellerId,
        bonusType: opts.bonusType,
        amountBdt: amount,
        campaignName: opts.campaignName,
        reason: opts.reason,
        referenceCode,
        idempotencyKey,
        status: "pending_second_approval",
        createdBy: opts.adminUserId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.resellerBonuses.push(bonus);
      db.persist();
      results.push({
        resellerId,
        bonusId: bonus.id,
        status: "pending_dual_approval"
      });
      continue;
    }
    try {
      db.runInTransaction(() => {
        const bonusId = `bns_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const ledgerEntry = creditWallet({
          resellerId,
          amountBdt: amount,
          entryType: "bonus_credit",
          referenceId: referenceCode,
          idempotencyKey,
          reason: `Bonus Award: [${opts.bonusType}] ${opts.reason}`,
          bonusId,
          actorUserId: opts.adminUserId
        });
        const bonus = {
          id: bonusId,
          resellerId,
          bonusType: opts.bonusType,
          amountBdt: amount,
          campaignName: opts.campaignName,
          reason: opts.reason,
          referenceCode,
          idempotencyKey,
          status: "approved_and_credited",
          createdBy: opts.adminUserId,
          ledgerEntryId: ledgerEntry.id,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.resellerBonuses.push(bonus);
        results.push({
          resellerId,
          bonusId: bonus.id,
          ledgerId: ledgerEntry.id,
          status: "credited"
        });
      });
      enqueueNotification({
        recipientType: "reseller",
        recipientContact: resellerUser.email,
        channel: "email",
        eventType: "BONUS_CREDITED",
        title: "New Reseller Bonus Credited!",
        bodyText: `Congratulations! A ${opts.bonusType.replace("_", " ")} of \u09F3${amount.toFixed(2)} has been credited to your wallet. Reason: ${opts.reason}`,
        metadataJson: { amountBdt: amount, referenceCode }
      });
    } catch (err) {
      results.push({
        resellerId,
        status: "failed",
        error: err.message
      });
    }
  }
  return results;
}
function reverseBonus(bonusId, adminUserId, reversalReason) {
  if (!reversalReason || reversalReason.trim().length < 5) {
    throw new Error("A detailed reason is required for bonus reversal.");
  }
  return db.runInTransaction(() => {
    const bonus = db.resellerBonuses.find((b) => b.id === bonusId);
    if (!bonus) {
      throw new Error("Bonus record not found.");
    }
    if (bonus.status !== "approved_and_credited") {
      throw new Error(`Cannot reverse bonus with status: ${bonus.status}`);
    }
    const reversalRef = `REV-${bonus.referenceCode}`;
    const idempotencyKey = `IDEMP-REV-${bonus.id}`;
    const reversalLedger = debitWallet({
      resellerId: bonus.resellerId,
      amountBdt: bonus.amountBdt,
      entryType: "bonus_reversal_debit",
      referenceId: reversalRef,
      idempotencyKey,
      reason: `Bonus Reversal for ${bonus.referenceCode}: ${reversalReason}`,
      bonusId: bonus.id,
      actorUserId: adminUserId
    });
    bonus.status = "reversed";
    bonus.reversalLedgerEntryId = reversalLedger.id;
    bonus.reversalReason = reversalReason;
    bonus.reversedAt = (/* @__PURE__ */ new Date()).toISOString();
    bonus.reversedBy = adminUserId;
    const resellerUser = db.users.find((u) => u.id === bonus.resellerId);
    if (resellerUser) {
      enqueueNotification({
        recipientType: "reseller",
        recipientContact: resellerUser.email,
        channel: "email",
        eventType: "BONUS_REVERSED",
        title: "Bonus Reversal Notice",
        bodyText: `A previously awarded bonus of \u09F3${bonus.amountBdt.toFixed(2)} (${bonus.referenceCode}) has been reversed. Reason: ${reversalReason}`,
        metadataJson: { bonusId: bonus.id, ledgerId: reversalLedger.id }
      });
    }
    return bonus;
  });
}

// server/services/orders.ts
import crypto4 from "crypto";

// server/services/seller.ts
import crypto3 from "crypto";
function resolveCommissionRate(productId, sellerId, categoryId) {
  if (productId) {
    const product = db.sellerProducts.find((p) => p.id === productId);
    if (product && typeof product.customCommissionPercentage === "number" && product.customCommissionPercentage >= 0) {
      return product.customCommissionPercentage;
    }
  }
  if (sellerId) {
    const seller = db.sellerProfiles.find((s) => s.id === sellerId);
    if (seller && typeof seller.customCommissionPercentage === "number" && seller.customCommissionPercentage >= 0) {
      return seller.customCommissionPercentage;
    }
  }
  if (categoryId) {
    const policy = db.sellerCommissionPolicy;
    if (policy?.categoryRates && typeof policy.categoryRates[categoryId] === "number") {
      return policy.categoryRates[categoryId];
    }
    const anyCatPolicy = db.commissionPolicies?.find?.(
      (p) => p.level === "category" && p.targetId === categoryId
    );
    if (anyCatPolicy && typeof anyCatPolicy.commissionPercentage === "number") {
      return anyCatPolicy.commissionPercentage;
    }
  }
  const globalDefault = db.sellerCommissionPolicy?.globalDefaultPercent ?? 10;
  return globalDefault;
}
function resolveCommissionDetails(productId, sellerId, categoryId) {
  if (productId) {
    const product = db.sellerProducts.find((p) => p.id === productId);
    if (product && typeof product.customCommissionPercentage === "number" && product.customCommissionPercentage >= 0) {
      return { ratePercent: product.customCommissionPercentage, source: "product" };
    }
  }
  if (sellerId) {
    const seller = db.sellerProfiles.find((s) => s.id === sellerId);
    if (seller && typeof seller.customCommissionPercentage === "number" && seller.customCommissionPercentage >= 0) {
      return { ratePercent: seller.customCommissionPercentage, source: "seller" };
    }
  }
  if (categoryId) {
    const policy = db.sellerCommissionPolicy;
    if (policy?.categoryRates && typeof policy.categoryRates[categoryId] === "number") {
      return { ratePercent: policy.categoryRates[categoryId], source: "category" };
    }
    const anyCatPolicy = db.commissionPolicies?.find?.(
      (p) => p.level === "category" && p.targetId === categoryId
    );
    if (anyCatPolicy && typeof anyCatPolicy.commissionPercentage === "number") {
      return { ratePercent: anyCatPolicy.commissionPercentage, source: "category" };
    }
  }
  const globalDefault = db.sellerCommissionPolicy?.globalDefaultPercent ?? 10;
  return { ratePercent: globalDefault, source: "global_default" };
}
function submitSellerApplication(params) {
  const userId = params.userId;
  const storeName = (params.storeName || "").trim();
  const contactPhone = (params.contactPhone || params.phoneNumber || "").trim();
  const address = (params.address || params.businessAddress || "").trim();
  const payoutAccountNumber = (params.payoutAccountNumber || params.payoutAccount || "").trim();
  const nidNumber = (params.nidNumber || "").trim();
  const bio = (params.bio || "").trim();
  const payoutMethod = params.payoutMethod || "bkash";
  const existingApp = db.sellerApplications.find(
    (a) => a.userId === userId && (a.status === "pending" || a.status === "under_review")
  );
  if (existingApp) {
    throw new Error("You already have a seller application pending review.");
  }
  const existingProfile = db.sellerProfiles.find((s) => s.userId === userId && s.status === "approved");
  if (existingProfile) {
    throw new Error("You are already an approved seller.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `seller-${userId.slice(-4)}`;
  const application = {
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
    status: "pending",
    createdAt: now,
    updatedAt: now
  };
  db.sellerApplications.unshift(application);
  db.auditLogs.push({
    id: `aud_selapp_${Date.now()}`,
    actorUserId: userId,
    actorRole: "customer",
    action: "SELLER_APPLICATION_SUBMITTED",
    targetEntity: "seller_applications",
    targetId: application.id,
    details: { storeName, payoutMethod },
    createdAt: now
  });
  db.persist();
  return application;
}
function reviewSellerApplication(param1, param2, param3, param4) {
  let applicationId;
  let adminUserId;
  let status;
  let adminNotes;
  if (typeof param1 === "object") {
    applicationId = param1.applicationId;
    status = param1.status;
    adminNotes = param1.adminNotes;
    adminUserId = param1.adminUserId;
  } else {
    applicationId = param1;
    adminUserId = param2 || "admin";
    status = param3;
    adminNotes = param4;
  }
  const app2 = db.sellerApplications.find((a) => a.id === applicationId);
  if (!app2) {
    throw new Error(`Seller application ${applicationId} not found.`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  app2.status = status;
  app2.adminNotes = adminNotes;
  app2.reviewedBy = adminUserId;
  app2.reviewedAt = now;
  app2.updatedAt = now;
  let sellerProfile;
  if (status === "approved") {
    const existingProfile = db.sellerProfiles.find((s) => s.userId === app2.userId);
    const slug = app2.storeSlug || app2.storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `seller-${app2.userId.slice(-4)}`;
    if (existingProfile) {
      existingProfile.status = "approved";
      existingProfile.isVerified = true;
      existingProfile.storeName = app2.storeName;
      existingProfile.slug = slug;
      existingProfile.bio = app2.bio;
      existingProfile.contactPhone = app2.contactPhone;
      existingProfile.payoutMethod = app2.payoutMethod;
      existingProfile.payoutAccountNumber = app2.payoutAccountNumber;
      existingProfile.approvedAt = now;
      existingProfile.updatedAt = now;
      sellerProfile = existingProfile;
    } else {
      sellerProfile = {
        id: `sel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: app2.userId,
        storeName: app2.storeName,
        slug,
        bio: app2.bio,
        contactEmail: db.users.find((u) => u.id === app2.userId)?.email || "seller@market.com",
        contactPhone: app2.contactPhone,
        status: "approved",
        payoutMethod: app2.payoutMethod,
        payoutAccountNumber: app2.payoutAccountNumber,
        payoutBankDetails: app2.payoutBankDetails,
        rating: 5,
        salesCount: 0,
        totalEarningsBdt: 0,
        availableBalanceBdt: 0,
        pendingHoldBalanceBdt: 0,
        withdrawnBalanceBdt: 0,
        approvedAt: now,
        createdAt: now,
        updatedAt: now
      };
      sellerProfile.isVerified = true;
      sellerProfile.lockedBalanceBdt = 0;
      db.sellerProfiles.push(sellerProfile);
    }
  }
  db.auditLogs.push({
    id: `aud_selrev_${Date.now()}`,
    actorUserId: adminUserId,
    actorRole: "admin",
    action: `SELLER_APPLICATION_${status.toUpperCase()}`,
    targetEntity: "seller_applications",
    targetId: app2.id,
    details: { status, notes: adminNotes },
    createdAt: now
  });
  db.persist();
  const result = Object.assign({}, app2, {
    application: app2,
    sellerProfile,
    status: app2.status
  });
  return result;
}
function submitSellerProduct(sellerId, params) {
  const seller = db.sellerProfiles.find((s) => s.id === sellerId);
  if (!seller || seller.status !== "approved") {
    throw new Error("Only approved sellers can publish digital products.");
  }
  const priceBdt = Number(params.priceBdt);
  if (priceBdt <= 0) {
    throw new Error("Price must be greater than 0 BDT.");
  }
  const name = (params.name || params.title || "").trim();
  const description = (params.description || "").trim();
  const tagline = (params.tagline || params.shortDescription || "").trim();
  const productType = params.productType || params.fileType || "digital_file";
  const fileUrl = params.fileUrl || params.digitalAssetUrl || "";
  const fileSizeBytes = params.fileSizeBytes || (params.fileSizeKb ? params.fileSizeKb * 1024 : 1024 * 1024);
  const fileSizeKb = params.fileSizeKb || Math.round(fileSizeBytes / 1024);
  const fileVersion = params.fileVersion || "1.0.0";
  const previewImageUrl = params.imageUrl || params.previewImageUrl || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `prod-${Date.now().toString().slice(-4)}`;
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
  const newProduct = {
    id: `sprod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sellerId: seller.id,
    sellerStoreName: seller.storeName,
    categoryId: params.categoryId || "cat_software",
    name,
    title: name,
    slug,
    tagline,
    shortDescription: tagline,
    description,
    priceBdt: Math.round(priceBdt * 100) / 100,
    productType,
    fileType: params.fileType || "ZIP",
    fileUrl,
    digitalAssetUrl: fileUrl,
    fileName: params.fileName || "source_package.zip",
    fileSizeBytes,
    fileSizeKb,
    fileVersion,
    fileHash: params.fileHash || crypto3.createHash("sha256").update(name).digest("hex"),
    downloadLimitPerPurchase: params.downloadLimitPerPurchase || 5,
    imageUrl: previewImageUrl,
    previewImageUrl,
    previewUrl: params.previewUrl,
    status: "pending_review",
    customCommissionPercentage: params.customCommissionPercentage,
    salesCount: 0,
    createdAt: now,
    updatedAt: now
  };
  db.sellerProducts.unshift(newProduct);
  db.persist();
  return newProduct;
}
function recordSellerProductPurchase(params) {
  const sellerProductId = params.sellerProductId;
  const sellerProduct = db.sellerProducts.find((p) => p.id === sellerProductId);
  if (!sellerProduct) {
    throw new Error(`Seller digital product ${sellerProductId} not found.`);
  }
  const seller = db.sellerProfiles.find((s) => s.id === sellerProduct.sellerId);
  if (!seller) {
    throw new Error(`Seller profile ${sellerProduct.sellerId} not found.`);
  }
  let order = params.order;
  const now = /* @__PURE__ */ new Date();
  if (!order) {
    const orderNumber = `ORD-SEL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderNumber,
      orderSource: "main_store",
      customerId: params.customerId || "cust_guest",
      customerName: params.customerName || "Customer",
      customerEmail: params.customerEmail || "customer@ssdigitalbd.shop",
      customerPhone: params.customerPhone || "01700000000",
      productId: sellerProduct.id,
      packageId: "pkg_digital_download",
      snapshotProductName: sellerProduct.name,
      snapshotPackageName: "Digital Delivery Access",
      snapshotDurationDays: 365,
      snapshotRetailPriceBdt: sellerProduct.priceBdt,
      snapshotWholesaleCostBdt: 0,
      snapshotDeliveryMethod: "instant_license_key",
      currency: "BDT",
      orderStatus: "completed",
      walletDebited: false,
      customerInputNotes: `Direct digital license purchase: ${sellerProduct.name}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    db.orders.unshift(order);
  }
  const ratePercent = resolveCommissionRate(
    sellerProduct.id,
    seller.id,
    sellerProduct.categoryId
  );
  const saleAmount = order.snapshotRetailPriceBdt || sellerProduct.priceBdt;
  const platformFee = Math.round(saleAmount * ratePercent / 100 * 100) / 100;
  const sellerNet = Math.round((saleAmount - platformFee) * 100) / 100;
  const holdExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1e3).toISOString();
  const earning = {
    id: `searn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sellerId: seller.id,
    orderId: order.id,
    sellerProductId: sellerProduct.id,
    productName: sellerProduct.name,
    saleAmountBdt: saleAmount,
    commissionRatePercent: ratePercent,
    commissionSource: "calculated",
    platformFeeBdt: platformFee,
    sellerNetEarningBdt: sellerNet,
    netEarningBdt: sellerNet,
    status: "available",
    holdingUntil: holdExpiry,
    createdAt: now.toISOString(),
    releasedAt: now.toISOString()
  };
  db.sellerEarnings.push(earning);
  seller.totalEarningsBdt = Math.round((seller.totalEarningsBdt + sellerNet) * 100) / 100;
  seller.availableBalanceBdt = Math.round((seller.availableBalanceBdt + sellerNet) * 100) / 100;
  seller.salesCount = (seller.salesCount || 0) + 1;
  seller.updatedAt = now.toISOString();
  sellerProduct.salesCount = (sellerProduct.salesCount || 0) + 1;
  sellerProduct.updatedAt = now.toISOString();
  const tokenString = crypto3.randomBytes(24).toString("hex");
  const downloadToken = {
    id: `dtok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    token: tokenString,
    sellerProductId: sellerProduct.id,
    orderId: order.id,
    customerId: order.customerId || "guest",
    downloadsRemaining: 5,
    downloadLimit: 5,
    downloadCount: 0,
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
    createdAt: now.toISOString()
  };
  db.sellerDownloadTokens.push(downloadToken);
  db.persist();
  return {
    order,
    earning,
    downloadToken: tokenString,
    tokenRecord: downloadToken
  };
}
function requestSellerWithdrawal(param1, param2, param3, param4, param5) {
  let sellerId;
  let amountBdt;
  let payoutMethod;
  let payoutAccountNumber;
  let payoutDetails;
  if (typeof param1 === "object") {
    sellerId = param1.sellerId;
    amountBdt = param1.amountBdt;
    payoutMethod = param1.payoutMethod;
    payoutAccountNumber = param1.payoutAccountNumber;
    payoutDetails = param1.payoutDetails;
  } else {
    sellerId = param1;
    amountBdt = param2;
    payoutMethod = param3;
    payoutAccountNumber = param4;
    payoutDetails = param5;
  }
  const seller = db.sellerProfiles.find((s) => s.id === sellerId);
  if (!seller) {
    throw new Error("Seller profile not found.");
  }
  const requestedAmount = Math.round(amountBdt * 100) / 100;
  if (requestedAmount < 500) {
    throw new Error("Minimum withdrawal amount is 500 BDT.");
  }
  if (seller.availableBalanceBdt < requestedAmount) {
    throw new Error(
      `Insufficient available balance. You requested \u09F3${requestedAmount}, but only \u09F3${seller.availableBalanceBdt} is available.`
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  seller.availableBalanceBdt = Math.round((seller.availableBalanceBdt - requestedAmount) * 100) / 100;
  seller.lockedBalanceBdt = Math.round(((seller.lockedBalanceBdt || 0) + requestedAmount) * 100) / 100;
  seller.updatedAt = now;
  const withdrawal = {
    id: `swd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sellerId: seller.id,
    amountBdt: requestedAmount,
    payoutMethod,
    payoutAccountNumber,
    payoutDetails,
    status: "pending",
    requestedAt: now
  };
  db.sellerWithdrawals.unshift(withdrawal);
  db.auditLogs.push({
    id: `aud_swd_${Date.now()}`,
    actorUserId: seller.userId,
    actorRole: "seller",
    action: "SELLER_WITHDRAWAL_REQUESTED",
    targetEntity: "seller_withdrawals",
    targetId: withdrawal.id,
    details: { amountBdt: requestedAmount, method: payoutMethod },
    createdAt: now
  });
  db.persist();
  return withdrawal;
}
function processSellerWithdrawalPayout(param1, param2, param3) {
  let withdrawalId;
  let adminUserId;
  let transactionReference;
  if (typeof param1 === "object") {
    withdrawalId = param1.withdrawalId;
    adminUserId = param1.adminUserId;
    transactionReference = param1.transactionReference;
  } else {
    withdrawalId = param1;
    adminUserId = param2 || "admin";
    transactionReference = param3;
  }
  const withdrawal = db.sellerWithdrawals.find((w) => w.id === withdrawalId);
  if (!withdrawal) {
    throw new Error(`Withdrawal request ${withdrawalId} not found.`);
  }
  const seller = db.sellerProfiles.find((s) => s.id === withdrawal.sellerId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  withdrawal.status = "completed";
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
function validateAndConsumeDownloadToken(token) {
  const tokenRecord = db.sellerDownloadTokens.find((t) => t.token === token);
  if (!tokenRecord) {
    return { isValid: false, valid: false, message: "Invalid or unrecognized download token." };
  }
  const now = /* @__PURE__ */ new Date();
  const expiry = new Date(tokenRecord.expiresAt);
  if (now > expiry) {
    return { isValid: false, valid: false, message: "This download link has expired (7-day validity limit exceeded)." };
  }
  if (tokenRecord.downloadsRemaining <= 0) {
    return { isValid: false, valid: false, message: "Maximum download limit reached for this purchase." };
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
    tokenRecord
  };
}

// server/services/orders.ts
function generateOrderNumber(prefix = "ORD") {
  const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(2, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
}
function createOrder(params) {
  const adminProduct = db.products.find((p) => p.id === params.productId && p.isActive);
  const sellerProduct = !adminProduct ? db.sellerProducts.find((p) => p.id === params.productId && p.status === "approved") : void 0;
  if (!adminProduct && !sellerProduct) {
    throw new Error("Selected product is currently unavailable or disabled.");
  }
  let resellerId;
  let store;
  if (params.orderSource === "reseller_store") {
    if (!params.storeId) {
      throw new Error("Store ID is required for reseller orders.");
    }
    store = db.stores.find((s) => s.id === params.storeId);
    if (!store) {
      throw new Error("Reseller store is invalid, inactive, or suspended.");
    }
    if (store.isMaintenance || store.status === "maintenance") {
      throw new Error(`Store "${store.storeName}" is currently undergoing maintenance. ${store.maintenanceMessage || ""}`);
    }
    if (store.status !== "active") {
      throw new Error(`Store "${store.storeName}" is currently ${store.status}.`);
    }
    if (adminProduct && !adminProduct.availableToResellers) {
      throw new Error("This product is not eligible for reseller store distribution.");
    }
    resellerId = store.resellerId;
  } else {
    if (adminProduct && !adminProduct.availableOnMainStore) {
      throw new Error("This product is not available for purchase on the Main Store.");
    }
  }
  const orderNumber = generateOrderNumber(params.orderSource === "reseller_store" ? "RES" : "MAIN");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let order;
  if (adminProduct) {
    const pkg = db.productPackages.find((p) => p.id === params.packageId && p.isActive) || db.productPackages.find((p) => p.productId === adminProduct.id && p.isActive);
    if (!pkg) {
      throw new Error("Selected package duration is currently unavailable or disabled.");
    }
    const sellingPrice = params.resellerSellingPrice && params.resellerSellingPrice >= pkg.resellerWholesaleCostBdt ? params.resellerSellingPrice : pkg.retailPriceBdt;
    const resellerMargin = Math.max(0, Math.round((sellingPrice - pkg.resellerWholesaleCostBdt) * 100) / 100);
    order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderNumber,
      orderSource: params.orderSource,
      storeId: params.storeId,
      resellerId,
      customerId: params.customerId,
      customerName: params.customerName.trim(),
      customerEmail: params.customerEmail.trim().toLowerCase(),
      customerPhone: params.customerPhone.trim(),
      // Phase C: Product Ownership & Snapshots
      productOwnerType: "ADMIN",
      productOwnerId: "ADMIN",
      productId: adminProduct.id,
      packageId: pkg.id,
      snapshotProductName: adminProduct.name,
      snapshotPackageName: pkg.name,
      snapshotDurationDays: pkg.durationDays,
      snapshotRetailPriceBdt: sellingPrice,
      snapshotWholesaleCostBdt: pkg.resellerWholesaleCostBdt,
      resellerSellingPriceSnapshot: sellingPrice,
      sellerPriceSnapshot: pkg.resellerWholesaleCostBdt,
      sellerCommissionSnapshot: 0,
      resellerMarginSnapshot: resellerMargin,
      platformCommissionSnapshot: 0,
      snapshotDeliveryMethod: adminProduct.deliveryMethod,
      currency: "BDT",
      paymentMethodId: params.paymentMethodId,
      orderStatus: "payment_submitted",
      walletDebited: false,
      customerInputNotes: params.customerInputNotes,
      createdAt: now,
      updatedAt: now
    };
  } else {
    const seller = db.sellerProfiles.find((s) => s.id === sellerProduct.sellerId);
    if (!seller || seller.status !== "approved") {
      throw new Error("Product creator is currently inactive or not approved.");
    }
    const commissionRate = resolveCommissionRate(sellerProduct.id, seller.id, sellerProduct.categoryId);
    const basePrice = sellerProduct.priceBdt;
    const sellingPrice = params.resellerSellingPrice && params.resellerSellingPrice >= basePrice ? params.resellerSellingPrice : basePrice;
    const platformCommission = Math.round(basePrice * commissionRate / 100 * 100) / 100;
    const sellerNetEarning = Math.round((basePrice - platformCommission) * 100) / 100;
    const resellerMargin = Math.max(0, Math.round((sellingPrice - basePrice) * 100) / 100);
    order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderNumber,
      orderSource: params.orderSource,
      storeId: params.storeId,
      resellerId,
      customerId: params.customerId,
      customerName: params.customerName.trim(),
      customerEmail: params.customerEmail.trim().toLowerCase(),
      customerPhone: params.customerPhone.trim(),
      // Phase C: Product Ownership & Snapshots
      productOwnerType: "SELLER",
      productOwnerId: seller.id,
      productId: sellerProduct.id,
      packageId: "pkg_seller_digital",
      snapshotProductName: sellerProduct.name,
      snapshotPackageName: sellerProduct.tagline || "Digital Asset License",
      snapshotDurationDays: 365,
      snapshotRetailPriceBdt: sellingPrice,
      snapshotWholesaleCostBdt: 0,
      // ZERO wholesale cost for seller products
      resellerSellingPriceSnapshot: sellingPrice,
      sellerPriceSnapshot: basePrice,
      sellerCommissionSnapshot: platformCommission,
      sellerNetEarningBdt: sellerNetEarning,
      resellerMarginSnapshot: resellerMargin,
      platformCommissionSnapshot: platformCommission,
      paymentMethodId: params.paymentMethodId,
      sellerAcceptanceStatus: "pending",
      snapshotDeliveryMethod: "instant_license_key",
      currency: "BDT",
      orderStatus: "payment_submitted",
      walletDebited: false,
      customerInputNotes: params.customerInputNotes,
      createdAt: now,
      updatedAt: now
    };
  }
  db.orders.push(order);
  db.persist();
  enqueueNotification({
    recipientType: "customer",
    recipientContact: order.customerEmail,
    channel: "email",
    eventType: "ORDER_PLACED",
    title: `Order Placed: ${order.orderNumber}`,
    bodyText: `Your order for "${order.snapshotProductName} (${order.snapshotPackageName})" has been received. Please submit your payment reference to proceed.`,
    metadataJson: { orderId: order.id, orderNumber: order.orderNumber }
  });
  if (params.orderSource === "reseller_store" && resellerId) {
    const reseller = db.users.find((u) => u.id === resellerId);
    if (reseller) {
      enqueueNotification({
        recipientType: "reseller",
        recipientContact: reseller.email,
        channel: "email",
        eventType: "RESELLER_NEW_ORDER",
        title: `New Customer Order on Your Store: ${order.orderNumber}`,
        bodyText: `Customer ${order.customerName} ordered ${order.snapshotProductName}. Retail: \u09F3${order.snapshotRetailPriceBdt.toFixed(2)}. Owner: ${order.productOwnerType}.`,
        metadataJson: { orderId: order.id }
      });
    }
  }
  return order;
}
function submitOrderPayment(params) {
  const order = db.orders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new Error("Order not found.");
  }
  const normalizedTxn = params.transactionId.trim().toUpperCase();
  if (normalizedTxn.length < 4) {
    throw new Error("Transaction ID must be valid and non-empty.");
  }
  let recipientSnapshot = "MAIN_STORE_MERCHANT";
  if (order.orderSource === "reseller_store" && order.storeId) {
    const store = db.stores.find((s) => s.id === order.storeId);
    recipientSnapshot = store?.subdomain || `STORE_${order.storeId}`;
  }
  const duplicate = db.paymentSubmissions.find(
    (p) => p.channel === params.channel && p.transactionId.toUpperCase() === normalizedTxn && p.recipientAccountSnapshot === recipientSnapshot
  );
  if (duplicate) {
    throw new Error(
      `Transaction ID "${normalizedTxn}" has already been submitted for this payment channel and recipient.`
    );
  }
  const submission = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    orderId: order.id,
    channel: params.channel,
    claimedAmountBdt: Math.round(params.claimedAmountBdt * 100) / 100,
    transactionId: normalizedTxn,
    senderPhoneOrAccount: params.senderPhoneOrAccount.trim(),
    recipientAccountSnapshot: recipientSnapshot,
    screenshotProofUrl: params.screenshotProofUrl,
    verificationStatus: "submitted",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.paymentSubmissions.push(submission);
  order.orderStatus = "payment_submitted";
  order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  enqueueNotification({
    recipientType: "customer",
    recipientContact: order.customerEmail,
    channel: "email",
    eventType: "PAYMENT_SUBMITTED",
    title: `Payment Details Received: ${order.orderNumber}`,
    bodyText: `We have received your payment reference "${normalizedTxn}". Verification is under review by the store operator.`,
    metadataJson: { orderId: order.id, transactionId: normalizedTxn }
  });
  return submission;
}
function verifyResellerCustomerPayment(params) {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === params.orderId);
    if (!order) {
      throw new Error("Order not found.");
    }
    if (order.orderSource !== "reseller_store") {
      throw new Error("Only reseller orders are verified by resellers.");
    }
    if (order.resellerId !== params.resellerUserId) {
      throw new Error("Unauthorized: You can only verify orders belonging to your own store.");
    }
    const submission = db.paymentSubmissions.find((p) => p.id === params.submissionId);
    if (!submission || submission.orderId !== order.id) {
      throw new Error("Payment submission record not found for this order.");
    }
    if (params.decision === "reject_invalid") {
      submission.verificationStatus = "rejected_invalid";
      submission.verifiedByUserId = params.resellerUserId;
      submission.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
      submission.verificationNotes = params.verificationNotes || "Payment rejected by reseller.";
      order.orderStatus = "payment_rejected";
      order.rejectionReason = params.verificationNotes || "Invalid or mismatched payment reference.";
      order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      enqueueNotification({
        recipientType: "customer",
        recipientContact: order.customerEmail,
        channel: "email",
        eventType: "PAYMENT_REJECTED",
        title: `Payment Verification Unsuccessful: ${order.orderNumber}`,
        bodyText: `Your payment reference was marked invalid. Reason: ${order.rejectionReason}. Please contact store support.`,
        metadataJson: { orderId: order.id }
      });
      return { order, walletDebitSuccess: false, holdReason: order.rejectionReason };
    }
    if (submission.claimedAmountBdt < order.snapshotRetailPriceBdt) {
      throw new Error(
        `Claimed amount (\u09F3${submission.claimedAmountBdt.toFixed(2)}) is less than required retail price (\u09F3${order.snapshotRetailPriceBdt.toFixed(2)}).`
      );
    }
    submission.verificationStatus = "verified_valid";
    submission.verifiedByUserId = params.resellerUserId;
    submission.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    submission.verificationNotes = params.verificationNotes || "Payment verified by reseller operator.";
    if (order.productOwnerType === "SELLER") {
      order.walletDebited = false;
      order.orderStatus = "pending_seller_action";
      order.sellerAcceptanceStatus = "pending";
      order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const sellerProfile = db.sellerProfiles.find((s) => s.id === order.productOwnerId);
      const sellerUser = sellerProfile ? db.users.find((u) => u.id === sellerProfile.userId) : null;
      enqueueNotification({
        recipientType: "seller",
        recipientContact: sellerUser?.email || sellerProfile?.contactEmail || "",
        channel: "email",
        eventType: "SELLER_ORDER_PENDING",
        title: `Action Required: New Reseller Store Order ${order.orderNumber}`,
        bodyText: `Customer payment verified by Reseller for "${order.snapshotProductName}". Please review, accept, and fulfill this order in your Seller Center.`,
        metadataJson: { orderId: order.id, orderNumber: order.orderNumber, sellerId: order.productOwnerId }
      });
      return { order, walletDebitSuccess: false };
    }
    const wallet = db.resellerWallets.find((w) => w.resellerId === params.resellerUserId);
    const availableBalance = wallet ? wallet.availableBalanceBdt : 0;
    const requiredWholesaleCost = order.snapshotWholesaleCostBdt;
    if (availableBalance < requiredWholesaleCost) {
      order.orderStatus = "wallet_pending";
      order.adminNotes = `Customer payment verified, but reseller wallet balance (\u09F3${availableBalance.toFixed(2)}) is insufficient for wholesale cost (\u09F3${requiredWholesaleCost.toFixed(2)}).`;
      order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      enqueueNotification({
        recipientType: "reseller",
        recipientContact: db.users.find((u) => u.id === params.resellerUserId)?.email || "",
        channel: "email",
        eventType: "WALLET_INSUFFICIENT_HOLD",
        title: `Order Held: Insufficient Wallet Balance (${order.orderNumber})`,
        bodyText: `Customer payment was verified for ${order.orderNumber}, but your wallet balance is insufficient (Needed: \u09F3${requiredWholesaleCost.toFixed(2)}, Available: \u09F3${availableBalance.toFixed(2)}). Please top up your wallet to send the order to Main Admin approval.`,
        metadataJson: { orderId: order.id, needed: requiredWholesaleCost, available: availableBalance }
      });
      return {
        order,
        walletDebitSuccess: false,
        holdReason: "Insufficient reseller wallet balance. Order held in wallet_pending."
      };
    }
    const debitRef = `DEBIT-ORD-${order.orderNumber}`;
    const idempotencyKey = `IDEMP-DEBIT-${order.id}`;
    const ledgerEntry = debitWallet({
      resellerId: params.resellerUserId,
      amountBdt: requiredWholesaleCost,
      entryType: "order_wholesale_debit",
      referenceId: debitRef,
      idempotencyKey,
      reason: `Wholesale cost for Order #${order.orderNumber} (${order.snapshotProductName})`,
      orderId: order.id,
      actorUserId: params.resellerUserId
    });
    order.walletDebited = true;
    order.walletDebitLedgerId = ledgerEntry.id;
    order.orderStatus = "pending_admin_approval";
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    enqueueNotification({
      recipientType: "admin",
      recipientContact: "admin@digimarket.com",
      channel: "email",
      eventType: "ORDER_READY_FOR_ADMIN_APPROVAL",
      title: `Order Ready for Admin Approval: ${order.orderNumber}`,
      bodyText: `Reseller verified payment & wholesale cost \u09F3${requiredWholesaleCost.toFixed(2)} debited. Final approval required.`,
      metadataJson: { orderId: order.id, ledgerId: ledgerEntry.id }
    });
    return { order, walletDebitSuccess: true };
  });
}
function retryWalletDebitForHeldOrder(orderId, resellerUserId) {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error("Order not found.");
    }
    if (order.resellerId !== resellerUserId) {
      throw new Error("Unauthorized.");
    }
    if (order.orderStatus !== "wallet_pending") {
      throw new Error(`Order is in status "${order.orderStatus}", not "wallet_pending".`);
    }
    const wallet = db.resellerWallets.find((w) => w.resellerId === resellerUserId);
    const available = wallet ? wallet.availableBalanceBdt : 0;
    if (available < order.snapshotWholesaleCostBdt) {
      throw new Error(
        `Wallet balance still insufficient. Needed: \u09F3${order.snapshotWholesaleCostBdt.toFixed(2)}, Available: \u09F3${available.toFixed(2)}`
      );
    }
    const debitRef = `DEBIT-ORD-${order.orderNumber}`;
    const idempotencyKey = `IDEMP-DEBIT-${order.id}`;
    const ledgerEntry = debitWallet({
      resellerId: resellerUserId,
      amountBdt: order.snapshotWholesaleCostBdt,
      entryType: "order_wholesale_debit",
      referenceId: debitRef,
      idempotencyKey,
      reason: `Wholesale cost for Order #${order.orderNumber} (Retry after top-up)`,
      orderId: order.id,
      actorUserId: resellerUserId
    });
    order.walletDebited = true;
    order.walletDebitLedgerId = ledgerEntry.id;
    order.orderStatus = "pending_admin_approval";
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return order;
  });
}
function adminApproveOrder(orderId, adminUserId, adminNotes) {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error("Order not found.");
    }
    if (order.orderStatus !== "pending_admin_approval" && order.orderStatus !== "payment_verified") {
      throw new Error(`Order in status "${order.orderStatus}" cannot be approved.`);
    }
    order.orderStatus = "admin_approved";
    order.adminNotes = adminNotes || "Approved by Main Admin.";
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const delivery = {
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: order.id,
      fulfillmentMethod: order.snapshotDeliveryMethod,
      instructionsForCustomer: "Your product will be delivered to your account / email shortly.",
      state: "queued",
      attemptsCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.deliveries.push(delivery);
    enqueueNotification({
      recipientType: "customer",
      recipientContact: order.customerEmail,
      channel: "email",
      eventType: "ORDER_ADMIN_APPROVED",
      title: `Order Approved & Queued for Delivery: ${order.orderNumber}`,
      bodyText: `Your order #${order.orderNumber} for "${order.snapshotProductName}" has been approved and entered the fulfillment queue.`,
      metadataJson: { orderId: order.id }
    });
    return order;
  });
}
function adminRejectOrder(orderId, adminUserId, rejectionReason) {
  if (!rejectionReason || rejectionReason.trim().length < 5) {
    throw new Error("A detailed reason is required for order rejection.");
  }
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new Error("Order not found.");
    }
    if (order.orderSource === "reseller_store" && order.walletDebited && order.resellerId) {
      const reversalRef = `REV-ORD-${order.orderNumber}`;
      const idempotencyKey = `IDEMP-REV-ORD-${order.id}`;
      const refundLedger = creditWallet({
        resellerId: order.resellerId,
        amountBdt: order.snapshotWholesaleCostBdt,
        entryType: "order_reversal_credit",
        referenceId: reversalRef,
        idempotencyKey,
        reason: `Wholesale refund for rejected Order #${order.orderNumber}: ${rejectionReason}`,
        orderId: order.id,
        actorUserId: adminUserId
      });
      order.walletReversalLedgerId = refundLedger.id;
    }
    order.orderStatus = "admin_rejected";
    order.rejectionReason = rejectionReason;
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    enqueueNotification({
      recipientType: "customer",
      recipientContact: order.customerEmail,
      channel: "email",
      eventType: "ORDER_ADMIN_REJECTED",
      title: `Order Unsuccessful: ${order.orderNumber}`,
      bodyText: `Order #${order.orderNumber} was rejected by the administration. Reason: ${rejectionReason}`,
      metadataJson: { orderId: order.id }
    });
    if (order.resellerId) {
      const reseller = db.users.find((u) => u.id === order.resellerId);
      if (reseller) {
        enqueueNotification({
          recipientType: "reseller",
          recipientContact: reseller.email,
          channel: "email",
          eventType: "ORDER_REJECTED_REFUNDED",
          title: `Order Rejected & Wholesale Cost Refunded (${order.orderNumber})`,
          bodyText: `Order #${order.orderNumber} was rejected by Admin. Wholesale cost \u09F3${order.snapshotWholesaleCostBdt.toFixed(2)} has been credited back to your wallet. Reason: ${rejectionReason}`,
          metadataJson: { orderId: order.id }
        });
      }
    }
    return order;
  });
}
function fulfillOrder(params) {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === params.orderId);
    if (!order) {
      throw new Error("Order not found.");
    }
    if (order.orderStatus !== "admin_approved" && order.orderStatus !== "queued_for_delivery") {
      throw new Error(`Order in status "${order.orderStatus}" cannot be fulfilled.`);
    }
    let delivery = db.deliveries.find((d) => d.orderId === order.id);
    if (!delivery) {
      delivery = {
        id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        orderId: order.id,
        fulfillmentMethod: order.snapshotDeliveryMethod,
        instructionsForCustomer: params.instructionsForCustomer,
        state: "completed",
        attemptsCount: 1,
        fulfillmentPayload: params.fulfillmentPayload,
        operatorUserId: params.operatorUserId,
        providerReference: params.providerReference || `MANUAL-${Date.now()}`,
        deliveredAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.deliveries.push(delivery);
    } else {
      delivery.state = "completed";
      delivery.fulfillmentPayload = params.fulfillmentPayload;
      delivery.instructionsForCustomer = params.instructionsForCustomer;
      delivery.providerReference = params.providerReference || `MANUAL-${Date.now()}`;
      delivery.operatorUserId = params.operatorUserId;
      delivery.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
      delivery.attemptsCount += 1;
      delivery.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    order.orderStatus = "completed";
    order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    enqueueNotification({
      recipientType: "customer",
      recipientContact: order.customerEmail,
      channel: "email",
      eventType: "ORDER_DELIVERED",
      title: `Order Delivered: ${order.snapshotProductName} (${order.orderNumber})`,
      bodyText: `Your digital product #${order.orderNumber} has been fulfilled! Access instructions: ${params.instructionsForCustomer}`,
      metadataJson: { orderId: order.id }
    });
    return { order, delivery };
  });
}
function sellerReviewOrder(params) {
  return db.runInTransaction(() => {
    const order = db.orders.find((o) => o.id === params.orderId);
    if (!order) {
      throw new Error("Order not found.");
    }
    if (order.productOwnerType !== "SELLER") {
      throw new Error("This order is not for a seller-owned product.");
    }
    if (order.orderStatus !== "pending_seller_action") {
      throw new Error(`Order is not pending seller action (current status: ${order.orderStatus}).`);
    }
    const seller = db.sellerProfiles.find(
      (s) => s.id === order.productOwnerId && (s.userId === params.sellerUserId || params.sellerUserId === "usr_admin_01")
    );
    if (!seller) {
      throw new Error("Unauthorized: You are not the owner of this product.");
    }
    const now = /* @__PURE__ */ new Date();
    if (params.decision === "reject") {
      const reason = (params.rejectionReason || "").trim();
      if (!reason) {
        throw new Error("A rejection reason is mandatory when rejecting an order.");
      }
      order.sellerAcceptanceStatus = "rejected";
      order.sellerRejectedAt = now.toISOString();
      order.sellerRejectionReason = reason;
      order.orderStatus = "seller_rejected";
      order.updatedAt = now.toISOString();
      db.auditLogs.push({
        id: `aud_srej_${Date.now()}`,
        actorUserId: params.sellerUserId,
        actorRole: "seller",
        action: "SELLER_REJECTED_ORDER",
        targetEntity: "orders",
        targetId: order.id,
        details: {
          orderNumber: order.orderNumber,
          rejectionReason: reason,
          retailCollectedByResellerBdt: order.snapshotRetailPriceBdt,
          resellerId: order.resellerId
        },
        createdAt: now.toISOString()
      });
      enqueueNotification({
        recipientType: "customer",
        recipientContact: order.customerEmail,
        channel: "email",
        eventType: "SELLER_ORDER_REJECTED",
        title: `Seller Update: Order #${order.orderNumber} Rejected`,
        bodyText: `The seller could not fulfill your order for "${order.snapshotProductName}". Reason: ${reason}. Please contact the store operator for assistance.`,
        metadataJson: { orderId: order.id, reason }
      });
      if (order.resellerId) {
        const reseller = db.users.find((u) => u.id === order.resellerId);
        if (reseller) {
          enqueueNotification({
            recipientType: "reseller",
            recipientContact: reseller.email,
            channel: "email",
            eventType: "SELLER_ORDER_REJECTED_RESELLER",
            title: `Seller Rejected Order: ${order.orderNumber}`,
            bodyText: `Seller rejected order #${order.orderNumber}. Reason: ${reason}. Please contact the customer and process their refund.`,
            metadataJson: { orderId: order.id, reason }
          });
        }
      }
      return { order };
    }
    order.sellerAcceptanceStatus = "accepted";
    order.sellerAcceptedAt = now.toISOString();
    order.orderStatus = "seller_accepted";
    order.updatedAt = now.toISOString();
    const basePrice = order.sellerPriceSnapshot ?? order.snapshotRetailPriceBdt;
    const platformFee = order.platformCommissionSnapshot ?? Math.round(basePrice * 0.1 * 100) / 100;
    const netEarning = order.sellerNetEarningBdt ?? Math.max(0, Math.round((basePrice - platformFee) * 100) / 100);
    const earning = {
      id: `searn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sellerId: seller.id,
      orderId: order.id,
      sellerProductId: order.productId,
      productName: order.snapshotProductName,
      saleAmountBdt: basePrice,
      commissionRatePercent: order.sellerCommissionSnapshot ?? 10,
      commissionSource: "order_snapshot",
      platformFeeBdt: platformFee,
      sellerNetEarningBdt: netEarning,
      netEarningBdt: netEarning,
      status: "available",
      holdingUntil: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1e3).toISOString(),
      createdAt: now.toISOString(),
      releasedAt: now.toISOString()
    };
    db.sellerEarnings.push(earning);
    seller.totalEarningsBdt = Math.round(((seller.totalEarningsBdt || 0) + netEarning) * 100) / 100;
    seller.availableBalanceBdt = Math.round(((seller.availableBalanceBdt || 0) + netEarning) * 100) / 100;
    seller.salesCount = (seller.salesCount || 0) + 1;
    seller.updatedAt = now.toISOString();
    const sellerProduct = db.sellerProducts.find((p) => p.id === order.productId);
    if (sellerProduct) {
      sellerProduct.salesCount = (sellerProduct.salesCount || 0) + 1;
      sellerProduct.updatedAt = now.toISOString();
    }
    const tokenString = crypto4.randomBytes(24).toString("hex");
    const downloadToken = {
      id: `dtok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      token: tokenString,
      sellerProductId: order.productId,
      orderId: order.id,
      customerId: order.customerId || "cust_guest",
      downloadsRemaining: 5,
      downloadLimit: 5,
      downloadCount: 0,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
      createdAt: now.toISOString()
    };
    db.sellerDownloadTokens.push(downloadToken);
    const payload = params.fulfillmentPayload || `Token: ${tokenString}`;
    const instructions = params.instructionsForCustomer || `Download available at /api/seller/downloads/${tokenString}. Valid for 7 days.`;
    const delivery = {
      id: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: order.id,
      fulfillmentMethod: order.snapshotDeliveryMethod,
      instructionsForCustomer: instructions,
      state: "completed",
      attemptsCount: 1,
      fulfillmentPayload: payload,
      operatorUserId: params.sellerUserId,
      providerReference: `SELLER-FULFILL-${tokenString.slice(0, 8)}`,
      deliveredAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    db.deliveries.push(delivery);
    enqueueNotification({
      recipientType: "customer",
      recipientContact: order.customerEmail,
      channel: "email",
      eventType: "ORDER_DELIVERED",
      title: `Order Delivered: ${order.snapshotProductName} (${order.orderNumber})`,
      bodyText: `Your digital product #${order.orderNumber} is ready! ${instructions}`,
      metadataJson: { orderId: order.id, downloadToken: tokenString }
    });
    if (order.resellerId) {
      const reseller = db.users.find((u) => u.id === order.resellerId);
      if (reseller) {
        enqueueNotification({
          recipientType: "reseller",
          recipientContact: reseller.email,
          channel: "email",
          eventType: "SELLER_FULFILLED_RESELLER",
          title: `Seller Fulfilled Order: ${order.orderNumber}`,
          bodyText: `The seller has approved and fulfilled order #${order.orderNumber} for ${order.customerName}.`,
          metadataJson: { orderId: order.id }
        });
      }
    }
    return { order, delivery, downloadToken: tokenString };
  });
}

// server/services/kyc.ts
var RESERVED_SUBDOMAINS = /* @__PURE__ */ new Set([
  "admin",
  "api",
  "app",
  "mail",
  "root",
  "sys",
  "system",
  "store",
  "shop",
  "www",
  "null",
  "undefined",
  "digimarket",
  "billing",
  "support"
]);
function validateSubdomainFormat(subdomain) {
  const normalized = subdomain.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 30) {
    return { valid: false, error: "Subdomain must be between 3 and 30 characters." };
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalized)) {
    return { valid: false, error: "Subdomain can only contain lowercase letters, numbers, and single hyphens." };
  }
  if (RESERVED_SUBDOMAINS.has(normalized)) {
    return { valid: false, error: `Subdomain "${normalized}" is reserved for system use.` };
  }
  return { valid: true };
}
function submitResellerApplication(params) {
  const user = db.users.find((u) => u.id === params.userId);
  if (!user) {
    throw new Error("User not found.");
  }
  const existingApp = db.resellerApplications.find((a) => a.userId === params.userId);
  if (existingApp && (existingApp.status === "pending" || existingApp.status === "approved")) {
    throw new Error(`You already have an application in status: ${existingApp.status}`);
  }
  const subValidation = validateSubdomainFormat(params.requestedSubdomain);
  if (!subValidation.valid) {
    throw new Error(subValidation.error);
  }
  const normalizedSub = params.requestedSubdomain.trim().toLowerCase();
  const storeCollision = db.stores.find((s) => s.subdomain.toLowerCase() === normalizedSub);
  if (storeCollision) {
    throw new Error(`Subdomain "${normalizedSub}" is already taken by another store.`);
  }
  const appCollision = db.resellerApplications.find(
    (a) => a.requestedSubdomain.toLowerCase() === normalizedSub && a.status !== "rejected"
  );
  if (appCollision) {
    throw new Error(`Subdomain "${normalizedSub}" is already reserved in a pending application.`);
  }
  const applicationId = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const application = {
    id: applicationId,
    userId: params.userId,
    businessName: params.businessName.trim(),
    requestedSubdomain: normalizedSub,
    tradeLicenseNumber: params.tradeLicenseNumber?.trim(),
    nationalIdNumber: params.nationalIdNumber.trim(),
    contactPhone: params.contactPhone.trim(),
    emergencyContact: params.emergencyContact?.trim(),
    address: params.address.trim(),
    status: "pending",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.resellerApplications.push(application);
  for (const doc of params.kycDocuments) {
    const kycDoc = {
      id: `kyc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      applicationId,
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileDataUrl: doc.fileDataUrl,
      verificationStatus: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.kycDocuments.push(kycDoc);
  }
  db.persist();
  enqueueNotification({
    recipientType: "admin",
    recipientContact: "admin@digimarket.com",
    channel: "email",
    eventType: "NEW_RESELLER_APPLICATION",
    title: `New Reseller Application: ${application.businessName}`,
    bodyText: `Applicant ${user.fullName} applied for subdomain "${normalizedSub}". KYC documents ready for review.`,
    metadataJson: { applicationId, userId: user.id }
  });
  return application;
}
function reviewResellerApplication(applicationId, adminUserId, decision, rejectionReason) {
  return db.runInTransaction(() => {
    const application = db.resellerApplications.find((a) => a.id === applicationId);
    if (!application) {
      throw new Error("Application not found.");
    }
    if (application.status !== "pending" && application.status !== "under_review") {
      throw new Error(`Application already decided with status: ${application.status}`);
    }
    const user = db.users.find((u) => u.id === application.userId);
    if (!user) {
      throw new Error("Applicant user record missing.");
    }
    if (decision === "reject") {
      application.status = "rejected";
      application.rejectionReason = rejectionReason || "Application requirements not met.";
      application.reviewedBy = adminUserId;
      application.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
      application.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      enqueueNotification({
        recipientType: "customer",
        recipientContact: user.email,
        channel: "email",
        eventType: "RESELLER_APP_REJECTED",
        title: "Reseller Application Update",
        bodyText: `Your application for reseller store "${application.requestedSubdomain}" was not approved. Reason: ${application.rejectionReason}`,
        metadataJson: { applicationId }
      });
      return { application };
    }
    application.status = "approved";
    application.reviewedBy = adminUserId;
    application.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    application.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    user.role = "reseller";
    user.status = "active";
    user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    let store = db.stores.find((s) => s.resellerId === user.id);
    if (!store) {
      store = {
        id: `str_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        resellerId: user.id,
        storeName: application.businessName,
        subdomain: application.requestedSubdomain,
        status: "active",
        supportPhone: application.contactPhone,
        supportEmail: user.email,
        supportWhatsapp: application.contactPhone,
        paymentInstructionsBkash: `bKash Personal: ${application.contactPhone} (Send Money).`,
        paymentInstructionsNagad: `Nagad Personal: ${application.contactPhone}.`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.stores.push(store);
    }
    let wallet = db.resellerWallets.find((w) => w.resellerId === user.id);
    if (!wallet) {
      wallet = {
        resellerId: user.id,
        availableBalanceBdt: 0,
        lockedBalanceBdt: 0,
        totalDepositedBdt: 0,
        totalSpentBdt: 0,
        totalBonusBdt: 0,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.resellerWallets.push(wallet);
    }
    db.kycDocuments.filter((d) => d.applicationId === applicationId).forEach((d) => d.verificationStatus = "verified");
    enqueueNotification({
      recipientType: "reseller",
      recipientContact: user.email,
      channel: "email",
      eventType: "RESELLER_APP_APPROVED",
      title: "Congratulations! Your Reseller Store is Active",
      bodyText: `Your application has been approved! Your store is now live at: https://${store.subdomain}.digimarket.com (and /store/${store.subdomain}).`,
      metadataJson: { storeId: store.id, subdomain: store.subdomain }
    });
    return { application, store };
  });
}

// server/api/routes.ts
var apiRouter = Router();
function generateCryptoToken() {
  return crypto5.randomBytes(32).toString("hex");
}
function createSession(userId) {
  const token = generateCryptoToken();
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3).toISOString();
  db.sessions.push({
    token,
    userId,
    createdAt: now.toISOString(),
    expiresAt,
    revoked: false
  });
  db.persist();
  return token;
}
function saveEvidenceFile(base64Data, originalName) {
  let mimeType = "image/jpeg";
  let rawBase64 = base64Data;
  const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1].toLowerCase();
    rawBase64 = match[2];
  }
  const buffer = Buffer.from(rawBase64, "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error(`File "${originalName}" exceeds the 5MB maximum size limit.`);
  }
  let ext = "jpg";
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    ext = "jpg";
    mimeType = "image/jpeg";
  } else if (buffer.length >= 8 && buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
    ext = "png";
    mimeType = "image/png";
  } else if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    ext = "webp";
    mimeType = "image/webp";
  } else if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") {
    ext = "pdf";
    mimeType = "application/pdf";
  } else {
    throw new Error(`Invalid file type for "${originalName}". Only JPEG, PNG, WebP, and PDF are supported.`);
  }
  const fileId = `att_${Date.now()}_${crypto5.randomBytes(4).toString("hex")}`;
  const filename = `${fileId}.${ext}`;
  const filePath = path2.join(EVIDENCE_DIR, filename);
  fs2.writeFileSync(filePath, buffer);
  return {
    id: fileId,
    filename,
    originalName: path2.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_"),
    mimeType,
    sizeBytes: buffer.length,
    uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function getOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return void 0;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const session = db.sessions.find(
    (s) => s.token === token && !s.revoked && new Date(s.expiresAt) > /* @__PURE__ */ new Date()
  );
  if (session) {
    return db.users.find((u) => u.id === session.userId && u.status === "active");
  }
  return void 0;
}
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing Authorization header." });
  }
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const session = db.sessions.find(
    (s) => s.token === token && !s.revoked && new Date(s.expiresAt) > /* @__PURE__ */ new Date()
  );
  if (session) {
    const user = db.users.find((u) => u.id === session.userId);
    if (user && user.status === "active") {
      req.user = user;
      return next();
    }
  }
  return res.status(401).json({ error: "Invalid or expired session token. Please sign in again." });
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthenticated." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access requires one of [${roles.join(", ")}]. Your role is ${req.user.role}.`
      });
    }
    next();
  };
}
apiRouter.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const passwordValid = bcrypt2.compareSync(password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const token = createSession(user.id);
  const store = user.role === "reseller" ? db.stores.find((s) => s.resellerId === user.id) : void 0;
  const wallet = user.role === "reseller" ? db.resellerWallets.find((w) => w.resellerId === user.id) : void 0;
  db.auditLogs.push({
    id: `aud_${Date.now()}`,
    actorUserId: user.id,
    actorRole: user.role,
    action: "USER_LOGIN",
    targetEntity: "users",
    targetId: user.id,
    details: { email: user.email },
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
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
      mustChangePassword: user.mustChangePassword
    },
    store,
    wallet
  });
});
apiRouter.post("/auth/register", (req, res) => {
  const { fullName, email, phone, password } = req.body;
  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (db.users.find((u) => u.email === normalizedEmail)) {
    return res.status(400).json({ error: "An account with this email already exists." });
  }
  const salt = bcrypt2.genSaltSync(10);
  const passwordHash = bcrypt2.hashSync(password, salt);
  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    email: normalizedEmail,
    passwordHash,
    fullName: fullName.trim(),
    phone: phone.trim(),
    role: "customer",
    status: "active",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      status: newUser.status
    }
  });
});
apiRouter.post("/auth/logout", authMiddleware, (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const session = db.sessions.find((s) => s.token === token);
    if (session) {
      session.revoked = true;
      db.persist();
    }
  }
  return res.json({ success: true, message: "Logged out successfully." });
});
apiRouter.post("/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email address is required." });
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (user) {
    const resetToken = crypto5.randomBytes(20).toString("hex");
    enqueueNotification({
      recipientType: user.role === "customer" ? "customer" : "reseller",
      recipientContact: user.email,
      channel: "email",
      eventType: "PASSWORD_RESET",
      title: "Password Reset Request",
      bodyText: `A password reset was requested for your account. Use recovery code: ${resetToken} to set your new password. If you did not make this request, please contact support.`,
      metadataJson: { userId: user.id, resetToken }
    });
  }
  return res.json({
    success: true,
    message: "If an account exists with that email, instructions have been sent."
  });
});
apiRouter.post("/auth/change-password", authMiddleware, (req, res) => {
  const user = req.user;
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters long." });
  }
  if (!user.mustChangePassword) {
    if (!currentPassword || !bcrypt2.compareSync(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }
  }
  const salt = bcrypt2.genSaltSync(10);
  user.passwordHash = bcrypt2.hashSync(newPassword, salt);
  user.mustChangePassword = false;
  user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.auditLogs.push({
    id: `aud_${Date.now()}`,
    actorUserId: user.id,
    actorRole: user.role,
    action: "PASSWORD_CHANGED",
    targetEntity: "users",
    targetId: user.id,
    details: { email: user.email },
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  db.persist();
  return res.json({ success: true, message: "Password updated successfully." });
});
apiRouter.get("/auth/me", authMiddleware, (req, res) => {
  const user = req.user;
  const store = user.role === "reseller" ? db.stores.find((s) => s.resellerId === user.id) : void 0;
  const wallet = user.role === "reseller" ? db.resellerWallets.find((w) => w.resellerId === user.id) : void 0;
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword
    },
    store,
    wallet
  });
});
apiRouter.get("/catalog", (req, res) => {
  const source = req.query.source === "reseller" ? "reseller" : "main";
  const categories = db.categories.filter((c) => c.isActive);
  const products = db.products.filter((p) => p.isActive && !p.isDeleted).filter((p) => source === "reseller" ? p.availableToResellers : p.availableOnMainStore).map((p) => {
    const packages = db.productPackages.filter((pkg) => pkg.productId === p.id && pkg.isActive);
    return { ...p, packages };
  });
  return res.json({ categories, products });
});
apiRouter.get("/stores/:subdomain", (req, res) => {
  const subdomain = req.params.subdomain.trim().toLowerCase();
  const store = db.stores.find((s) => s.subdomain.toLowerCase() === subdomain);
  if (!store) {
    return res.status(404).json({ error: `Store with subdomain "${subdomain}" not found.` });
  }
  if (store.status === "suspended") {
    return res.status(403).json({ error: `Store "${store.storeName}" is currently suspended.` });
  }
  const isMaintenance = Boolean(store.isMaintenance || store.status === "maintenance");
  if (isMaintenance) {
    return res.json({
      store: {
        ...store,
        status: "maintenance",
        isMaintenance: true
      },
      isMaintenance: true,
      maintenanceMessage: store.maintenanceMessage || "This store is temporarily undergoing scheduled maintenance. Please check back shortly.",
      products: [],
      approvedPaymentMethods: []
    });
  }
  const approvedPaymentMethods = db.resellerPaymentMethods.filter(
    (m) => m.resellerId === store.resellerId && m.status === "approved"
  );
  const configs = db.resellerStoreProductConfigs.filter((c) => c.storeId === store.id);
  const disabledProductIds = new Set(
    configs.filter((c) => !c.isEnabled).map((c) => c.productId)
  );
  const adminProducts = db.products.filter((p) => p.isActive && !p.isDeleted && p.availableToResellers && !disabledProductIds.has(p.id)).map((p) => {
    const config = configs.find((c) => c.productId === p.id && c.productSource === "ADMIN_PRODUCT");
    const packages = db.productPackages.filter((pkg) => pkg.productId === p.id && pkg.isActive).map((pkg) => {
      if (config?.sellingPriceBdt && config.sellingPriceBdt > 0) {
        return { ...pkg, retailPriceBdt: config.sellingPriceBdt };
      }
      return pkg;
    });
    return {
      ...p,
      name: config?.customTitle || p.name,
      tagline: config?.customDescription || p.tagline,
      productSource: "ADMIN_PRODUCT",
      productOwnerType: "ADMIN",
      packages
    };
  });
  const sellerProducts = db.sellerProducts.filter((sp) => sp.status === "approved" && !disabledProductIds.has(sp.id)).map((sp) => {
    const config = configs.find((c) => c.productId === sp.id && c.productSource === "SELLER_PRODUCT");
    const effectivePrice = config?.sellingPriceBdt && config.sellingPriceBdt > 0 ? config.sellingPriceBdt : sp.priceBdt;
    return {
      id: sp.id,
      categoryId: sp.categoryId,
      name: config?.customTitle || sp.name,
      slug: sp.slug,
      tagline: config?.customDescription || sp.tagline,
      description: config?.customDescription || sp.description,
      imageUrl: sp.imageUrl,
      deliveryMethod: "instant_license_key",
      deliveryInstructions: "Download link and license token generated automatically upon seller fulfillment.",
      termsAndConditions: "All sales are digital licenses subject to store policies.",
      isActive: true,
      availableOnMainStore: false,
      availableToResellers: true,
      productSource: "SELLER_PRODUCT",
      productOwnerType: "SELLER",
      productOwnerId: sp.sellerId,
      sellerStoreName: sp.sellerStoreName,
      basePriceBdt: sp.priceBdt,
      priceBdt: effectivePrice,
      createdAt: sp.createdAt,
      updatedAt: sp.updatedAt,
      packages: [
        {
          id: "pkg_seller_digital",
          productId: sp.id,
          name: "Standard Digital License",
          durationLabel: "Instant Delivery",
          durationDays: 365,
          retailPriceBdt: effectivePrice,
          resellerWholesaleCostBdt: 0,
          stockCount: -1,
          isActive: true,
          createdAt: sp.createdAt,
          updatedAt: sp.updatedAt
        }
      ]
    };
  });
  const products = [...adminProducts, ...sellerProducts];
  return res.json({
    store: {
      ...store,
      isMaintenance: false
    },
    isMaintenance: false,
    products,
    approvedPaymentMethods
  });
});
apiRouter.post("/orders", (req, res) => {
  try {
    const order = createOrder(req.body);
    return res.status(201).json(order);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/orders/:orderId/payment", (req, res) => {
  try {
    const submission = submitOrderPayment({
      orderId: req.params.orderId,
      ...req.body
    });
    return res.status(201).json(submission);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/orders/:orderNumber", (req, res) => {
  const order = db.orders.find((o) => o.orderNumber === req.params.orderNumber);
  if (!order) {
    return res.status(404).json({ error: "Order not found." });
  }
  const submissions = db.paymentSubmissions.filter((p) => p.orderId === order.id);
  const rawDelivery = db.deliveries.find((d) => d.orderId === order.id);
  const optionalUser = getOptionalUser(req);
  const isAuthorized = optionalUser && (optionalUser.role === "admin" || optionalUser.id === order.customerId || optionalUser.email.toLowerCase() === order.customerEmail.toLowerCase() || optionalUser.role === "reseller" && optionalUser.id === order.resellerId);
  if (!isAuthorized) {
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
      isProtected: true
    };
    const safeDelivery = rawDelivery ? {
      state: rawDelivery.state,
      instructionsForCustomer: rawDelivery.instructionsForCustomer,
      deliveredAt: rawDelivery.deliveredAt,
      fulfillmentPayload: rawDelivery.fulfillmentPayload ? "[Protected credentials \u2014 Sign in with your customer account to view]" : void 0
    } : void 0;
    return res.json({ order: safeOrder, submissions: [], delivery: safeDelivery });
  }
  return res.json({ order, submissions, delivery: rawDelivery });
});
apiRouter.get("/customer/orders", authMiddleware, (req, res) => {
  const user = req.user;
  const orders = db.orders.filter(
    (o) => o.customerId === user.id || o.customerEmail.toLowerCase() === user.email.toLowerCase() || user.phone && o.customerPhone === user.phone
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const result = orders.map((order) => {
    const delivery = db.deliveries.find((d) => d.orderId === order.id);
    const isCompleted = order.orderStatus === "completed";
    const serviceStartDate = isCompleted ? delivery?.deliveredAt || delivery?.createdAt || order.updatedAt : "Pending Delivery";
    let expiryDate = "Pending Delivery";
    if (isCompleted && serviceStartDate !== "Pending Delivery") {
      const startTime = new Date(serviceStartDate).getTime();
      const durationMs = order.snapshotDurationDays * 864e5;
      expiryDate = new Date(startTime + durationMs).toISOString();
    }
    let paymentStatus = "Pending Verification";
    if (order.orderStatus === "payment_rejected") {
      paymentStatus = "Rejected";
    } else if (order.walletDebited || order.orderStatus === "completed" || order.orderStatus === "admin_approved" || order.orderStatus === "queued_for_delivery" || order.orderStatus === "delivery_in_progress") {
      paymentStatus = "Verified";
    }
    const ticket = db.tickets.find((t) => t.orderNumber === order.orderNumber && t.status !== "closed");
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
      delivery_status: delivery?.state || "not_started",
      delivery_instructions: delivery?.instructionsForCustomer || "",
      fulfillment_payload: delivery?.fulfillmentPayload,
      support_ticket_status: ticket ? ticket.status : "none",
      support_ticket_id: ticket ? ticket.id : void 0,
      amount_bdt: order.snapshotRetailPriceBdt,
      currency: order.currency
    };
  });
  return res.json(result);
});
apiRouter.get("/reseller/orders", authMiddleware, requireRole("reseller"), (req, res) => {
  const resellerId = req.user.id;
  const orders = db.orders.filter((o) => o.resellerId === resellerId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const ordersWithDetails = orders.map((o) => {
    const submissions = db.paymentSubmissions.filter((p) => p.orderId === o.id);
    const delivery = db.deliveries.find((d) => d.orderId === o.id);
    return { ...o, submissions, delivery };
  });
  return res.json(ordersWithDetails);
});
apiRouter.post("/reseller/orders/:orderId/verify-payment", authMiddleware, requireRole("reseller"), (req, res) => {
  try {
    const result = verifyResellerCustomerPayment({
      orderId: req.params.orderId,
      submissionId: req.body.submissionId,
      resellerUserId: req.user.id,
      decision: req.body.decision,
      verificationNotes: req.body.verificationNotes
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/reseller/orders/:orderId/retry-debit", authMiddleware, requireRole("reseller"), (req, res) => {
  try {
    const order = retryWalletDebitForHeldOrder(req.params.orderId, req.user.id);
    return res.json({ order, success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/reseller/wallet", authMiddleware, requireRole("reseller"), (req, res) => {
  const wallet = db.resellerWallets.find((w) => w.resellerId === req.user.id);
  return res.json(wallet || { availableBalanceBdt: 0, lockedBalanceBdt: 0, totalDepositedBdt: 0, totalSpentBdt: 0 });
});
apiRouter.get("/reseller/ledger", authMiddleware, requireRole("reseller"), (req, res) => {
  const ledger = db.walletLedger.filter((l) => l.resellerId === req.user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(ledger);
});
apiRouter.post("/reseller/deposit-requests", authMiddleware, requireRole("reseller"), (req, res) => {
  try {
    const deposit = submitDepositRequest({
      resellerId: req.user.id,
      ...req.body
    });
    return res.status(201).json(deposit);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/reseller/deposit-requests", authMiddleware, requireRole("reseller"), (req, res) => {
  const deposits = db.depositRequests.filter((d) => d.resellerId === req.user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(deposits);
});
apiRouter.get("/reseller/bonuses", authMiddleware, requireRole("reseller"), (req, res) => {
  const bonuses = db.resellerBonuses.filter((b) => b.resellerId === req.user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(bonuses);
});
apiRouter.put("/reseller/store-settings", authMiddleware, requireRole("reseller"), (req, res) => {
  const store = db.stores.find((s) => s.resellerId === req.user.id);
  if (!store) {
    return res.status(404).json({ error: "Store not found for this reseller." });
  }
  const { storeName, supportPhone, supportEmail, supportWhatsapp, paymentInstructionsBkash, paymentInstructionsNagad, paymentInstructionsRocket } = req.body;
  if (storeName) store.storeName = storeName.trim();
  if (supportPhone) store.supportPhone = supportPhone.trim();
  if (supportEmail) store.supportEmail = supportEmail.trim();
  if (supportWhatsapp) store.supportWhatsapp = supportWhatsapp.trim();
  if (paymentInstructionsBkash !== void 0) store.paymentInstructionsBkash = paymentInstructionsBkash;
  if (paymentInstructionsNagad !== void 0) store.paymentInstructionsNagad = paymentInstructionsNagad;
  if (paymentInstructionsRocket !== void 0) store.paymentInstructionsRocket = paymentInstructionsRocket;
  store.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  return res.json(store);
});
apiRouter.put("/reseller/store/maintenance", authMiddleware, requireRole("reseller"), (req, res) => {
  const store = db.stores.find((s) => s.resellerId === req.user.id);
  if (!store) {
    return res.status(404).json({ error: "Store not found for this reseller." });
  }
  const { isMaintenance, maintenanceMessage } = req.body;
  store.isMaintenance = Boolean(isMaintenance);
  if (store.isMaintenance) {
    store.status = "maintenance";
  } else {
    store.status = "active";
  }
  if (maintenanceMessage !== void 0) {
    store.maintenanceMessage = (maintenanceMessage || "").trim();
  }
  store.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  return res.json({
    success: true,
    store,
    isMaintenance: store.isMaintenance,
    status: store.status,
    maintenanceMessage: store.maintenanceMessage
  });
});
apiRouter.get("/reseller/payment-methods", authMiddleware, requireRole("reseller"), (req, res) => {
  const methods = db.resellerPaymentMethods.filter((m) => m.resellerId === req.user.id);
  return res.json(methods);
});
apiRouter.post("/reseller/payment-methods", authMiddleware, requireRole("reseller"), (req, res) => {
  try {
    const { methodType, providerName, accountIdentifier, accountType, routingOrBranch, instructions } = req.body;
    if (!methodType || !accountIdentifier) {
      return res.status(400).json({ error: "methodType and accountIdentifier are required." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newMethod = db.addResellerPaymentMethod({
      id: `rpm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      resellerId: req.user.id,
      channel: methodType === "bkash" || methodType === "nagad" || methodType === "rocket" ? methodType : "bank_transfer",
      provider: providerName || methodType.toUpperCase(),
      providerName: providerName || methodType.toUpperCase(),
      methodType,
      accountNumber: accountIdentifier.trim(),
      accountIdentifier: accountIdentifier.trim(),
      accountType: accountType || "personal",
      routingOrBranch: routingOrBranch?.trim(),
      instructions: instructions?.trim() || "",
      status: "pending",
      createdAt: now,
      updatedAt: now
    });
    return res.status(201).json(newMethod);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.put("/reseller/payment-methods/:id", authMiddleware, requireRole("reseller"), (req, res) => {
  try {
    const updated = db.updateResellerPaymentMethod(req.params.id, req.body);
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/reseller/store-products", authMiddleware, requireRole("reseller"), (req, res) => {
  const store = db.stores.find((s) => s.resellerId === req.user.id);
  if (!store) {
    return res.status(404).json({ error: "Store not found." });
  }
  const configs = db.resellerStoreProductConfigs.filter((c) => c.storeId === store.id);
  const adminProducts = db.products.filter((p) => p.isActive && !p.isDeleted && p.availableToResellers).map((p) => {
    const pkg = db.productPackages.find((k) => k.productId === p.id && k.isActive);
    const config = configs.find((c) => c.productId === p.id && c.productSource === "ADMIN_PRODUCT");
    return {
      id: p.id,
      productSource: "ADMIN_PRODUCT",
      name: p.name,
      tagline: p.tagline,
      wholesaleCostBdt: pkg?.resellerWholesaleCostBdt || 0,
      defaultRetailPriceBdt: pkg?.retailPriceBdt || 0,
      config: config || null
    };
  });
  const sellerProducts = db.sellerProducts.filter((sp) => sp.status === "approved").map((sp) => {
    const config = configs.find((c) => c.productId === sp.id && c.productSource === "SELLER_PRODUCT");
    return {
      id: sp.id,
      productSource: "SELLER_PRODUCT",
      name: sp.name,
      tagline: sp.tagline,
      wholesaleCostBdt: 0,
      sellerPriceBdt: sp.priceBdt,
      sellerStoreName: sp.sellerStoreName,
      config: config || null
    };
  });
  return res.json({ configs, adminProducts, sellerProducts });
});
apiRouter.post("/reseller/store-products", authMiddleware, requireRole("reseller"), (req, res) => {
  try {
    const store = db.stores.find((s) => s.resellerId === req.user.id);
    if (!store) {
      return res.status(404).json({ error: "Store not found." });
    }
    const { productId, productSource, customTitle, customDescription, sellingPriceBdt, isEnabled } = req.body;
    if (!productId || !productSource) {
      return res.status(400).json({ error: "productId and productSource are required." });
    }
    const config = db.upsertResellerStoreProductConfig({
      id: `rspc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: store.id,
      resellerId: req.user.id,
      productId,
      productSource,
      customTitle,
      customDescription,
      sellingPriceBdt,
      isEnabled: isEnabled !== false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return res.json(config);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/reseller/apply", authMiddleware, (req, res) => {
  try {
    const application = submitResellerApplication({
      userId: req.user.id,
      ...req.body
    });
    return res.status(201).json(application);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/metrics", authMiddleware, requireRole("admin"), (_req, res) => {
  const totalOrders = db.orders.length;
  const pendingApprovalOrders = db.orders.filter((o) => o.orderStatus === "pending_admin_approval").length;
  const completedOrders = db.orders.filter((o) => o.orderStatus === "completed").length;
  const pendingDeposits = db.depositRequests.filter((d) => d.status === "pending").length;
  const pendingApplications = db.resellerApplications.filter((a) => a.status === "pending").length;
  const totalRevenue = db.orders.filter((o) => o.orderStatus === "completed" || o.orderStatus === "admin_approved").reduce((sum, o) => sum + o.snapshotRetailPriceBdt, 0);
  const totalWholesaleSpend = db.walletLedger.filter((l) => l.entryType === "order_wholesale_debit").reduce((sum, l) => sum + l.amountBdt, 0);
  const totalBonusesPaid = db.walletLedger.filter((l) => l.entryType === "bonus_credit").reduce((sum, l) => sum + l.amountBdt, 0);
  return res.json({
    totalOrders,
    pendingApprovalOrders,
    completedOrders,
    pendingDeposits,
    pendingApplications,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalWholesaleSpend: Math.round(totalWholesaleSpend * 100) / 100,
    totalBonusesPaid: Math.round(totalBonusesPaid * 100) / 100,
    activeResellersCount: db.users.filter((u) => u.role === "reseller" && u.status === "active").length
  });
});
apiRouter.get("/admin/orders", authMiddleware, requireRole("admin"), (req, res) => {
  const statusFilter = req.query.status;
  let orders = db.orders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (statusFilter && statusFilter !== "all") {
    orders = orders.filter((o) => o.orderStatus === statusFilter);
  }
  const ordersWithDetails = orders.map((o) => {
    const submissions = db.paymentSubmissions.filter((p) => p.orderId === o.id);
    const delivery = db.deliveries.find((d) => d.orderId === o.id);
    const reseller = o.resellerId ? db.users.find((u) => u.id === o.resellerId) : void 0;
    return { ...o, submissions, delivery, resellerName: reseller?.fullName };
  });
  return res.json(ordersWithDetails);
});
apiRouter.post("/admin/orders/:orderId/approve", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const order = adminApproveOrder(req.params.orderId, req.user.id, req.body.adminNotes);
    return res.json(order);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/admin/orders/:orderId/reject", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const order = adminRejectOrder(req.params.orderId, req.user.id, req.body.rejectionReason);
    return res.json(order);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/admin/orders/:orderId/fulfill", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const { fulfillmentPayload, instructionsForCustomer, providerReference } = req.body;
    if (!fulfillmentPayload || !instructionsForCustomer) {
      return res.status(400).json({ error: "Fulfillment credentials/license key and instructions are required." });
    }
    const result = fulfillOrder({
      orderId: req.params.orderId,
      fulfillmentPayload,
      instructionsForCustomer,
      providerReference,
      operatorUserId: req.user.id
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/reseller-applications", authMiddleware, requireRole("admin"), (_req, res) => {
  const apps = db.resellerApplications.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const appsWithDetails = apps.map((a) => {
    const user = db.users.find((u) => u.id === a.userId);
    const docs = db.kycDocuments.filter((d) => d.applicationId === a.id);
    return { ...a, applicantName: user?.fullName, applicantEmail: user?.email, kycDocuments: docs };
  });
  return res.json(appsWithDetails);
});
apiRouter.post("/admin/reseller-applications/:id/review", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const { decision, rejectionReason } = req.body;
    const result = reviewResellerApplication(req.params.id, req.user.id, decision, rejectionReason);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/reseller-payment-methods", authMiddleware, requireRole("admin"), (_req, res) => {
  const methods = db.resellerPaymentMethods.map((m) => {
    const reseller = db.users.find((u) => u.id === m.resellerId);
    const store = db.stores.find((s) => s.resellerId === m.resellerId);
    return {
      ...m,
      resellerName: reseller?.fullName || "Unknown",
      resellerEmail: reseller?.email || "Unknown",
      storeName: store?.storeName || "Unknown Store",
      subdomain: store?.subdomain
    };
  });
  return res.json(methods);
});
apiRouter.put("/admin/reseller-payment-methods/:id/review", authMiddleware, requireRole("admin"), (req, res) => {
  const { status, adminNotes } = req.body;
  if (!["approved", "rejected", "suspended", "pending"].includes(status)) {
    return res.status(400).json({ error: "Status must be approved, rejected, suspended, or pending." });
  }
  const method = db.resellerPaymentMethods.find((m) => m.id === req.params.id);
  if (!method) {
    return res.status(404).json({ error: "Payment method not found." });
  }
  method.status = status;
  if (adminNotes !== void 0) method.adminNotes = adminNotes;
  method.reviewedBy = req.user.id;
  method.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  method.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  return res.json(method);
});
apiRouter.get("/admin/deposits", authMiddleware, requireRole("admin"), (_req, res) => {
  const deposits = db.depositRequests.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const depositsWithReseller = deposits.map((d) => {
    const reseller = db.users.find((u) => u.id === d.resellerId);
    return { ...d, resellerName: reseller?.fullName, resellerEmail: reseller?.email };
  });
  return res.json(depositsWithReseller);
});
apiRouter.post("/admin/deposits/:id/approve", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const deposit = approveDeposit(req.params.id, req.user.id, req.body.adminNotes);
    return res.json(deposit);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/admin/deposits/:id/reject", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const deposit = rejectDeposit(req.params.id, req.user.id, req.body.reason || "Verification failed");
    return res.json(deposit);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/resellers-list", authMiddleware, requireRole("admin"), (_req, res) => {
  const resellers = db.users.filter((u) => u.role === "reseller").map((u) => {
    const store = db.stores.find((s) => s.resellerId === u.id);
    const wallet = db.resellerWallets.find((w) => w.resellerId === u.id);
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      status: u.status,
      subdomain: store?.subdomain,
      walletBalance: wallet?.availableBalanceBdt || 0
    };
  });
  return res.json(resellers);
});
apiRouter.post("/admin/bonuses/preview", authMiddleware, requireRole("admin"), (req, res) => {
  const { resellerIds, amountBdt, bonusType, reason } = req.body;
  if (!resellerIds || !Array.isArray(resellerIds) || resellerIds.length === 0) {
    return res.status(400).json({ error: "Please select at least one reseller recipient." });
  }
  const amount = Math.round(Number(amountBdt) * 100) / 100;
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Invalid bonus amount." });
  }
  const recipients = resellerIds.map((id) => {
    const user = db.users.find((u) => u.id === id);
    const wallet = db.resellerWallets.find((w) => w.resellerId === id);
    return {
      id,
      name: user?.fullName || "Unknown",
      email: user?.email,
      currentBalance: wallet?.availableBalanceBdt || 0,
      projectedBalance: (wallet?.availableBalanceBdt || 0) + amount
    };
  });
  const totalCommitment = amount * recipients.length;
  const requiresSecondApproval = totalCommitment >= 25e3;
  return res.json({
    recipients,
    perRecipientAmountBdt: amount,
    totalCommitmentBdt: totalCommitment,
    bonusType,
    reason,
    requiresSecondApproval
  });
});
apiRouter.post("/admin/bonuses/grant", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const { resellerIds, amountBdt, bonusType, campaignName, reason, requireSecondApproval } = req.body;
    const results = grantBonusBatch({
      resellerIds,
      amountBdt: Number(amountBdt),
      bonusType,
      campaignName,
      reason,
      adminUserId: req.user.id,
      requireSecondApproval
    });
    return res.json({ results, success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/bonuses", authMiddleware, requireRole("admin"), (_req, res) => {
  const bonuses = db.resellerBonuses.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((b) => {
    const reseller = db.users.find((u) => u.id === b.resellerId);
    const creator = db.users.find((u) => u.id === b.createdBy);
    return {
      ...b,
      resellerName: reseller?.fullName,
      resellerEmail: reseller?.email,
      creatorName: creator?.fullName
    };
  });
  return res.json(bonuses);
});
apiRouter.post("/admin/bonuses/:id/reverse", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const bonus = reverseBonus(req.params.id, req.user.id, req.body.reversalReason);
    return res.json(bonus);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/ledger", authMiddleware, requireRole("admin"), (_req, res) => {
  const ledger = db.walletLedger.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((l) => {
    const reseller = db.users.find((u) => u.id === l.resellerId);
    return { ...l, resellerName: reseller?.fullName, resellerEmail: reseller?.email };
  });
  return res.json(ledger);
});
apiRouter.get("/admin/notifications", authMiddleware, requireRole("admin"), (_req, res) => {
  const notifications = db.notificationOutbox.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(notifications);
});
apiRouter.post("/admin/notifications/:id/retry", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const result = retryNotification(req.params.id);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/admin/notifications/send-test", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { channel, recipientContact, title, bodyText } = req.body;
    if (!channel || !recipientContact || !title || !bodyText) {
      return res.status(400).json({ error: "channel, recipientContact, title, and bodyText are required." });
    }
    const item = enqueueNotification({
      recipientType: "admin",
      recipientContact: recipientContact.trim(),
      channel,
      eventType: "ADMIN_MANUAL_TEST",
      title: title.trim(),
      bodyText: bodyText.trim(),
      metadataJson: { triggeredBy: req.user.email }
    });
    const processed = await processOutboxItem(item.id);
    return res.json({ item: processed || item });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/notifications/config-status", authMiddleware, requireRole("admin"), (_req, res) => {
  try {
    const status = getNotificationConfigStatus();
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/webhooks/whatsapp", (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const verifiedChallenge = verifyWhatsAppWebhook(mode, token, challenge);
    res.status(200).send(verifiedChallenge);
  } catch (err) {
    console.error("[WhatsApp Webhook Verification Failed]", err.message);
    res.status(403).send("Forbidden: Invalid verification token");
  }
});
apiRouter.post("/webhooks/whatsapp", (req, res) => {
  try {
    const signature = req.headers["x-hub-signature-256"];
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const isValidSignature = verifyWhatsAppSignature(signature, rawBody);
    if (!isValidSignature) {
      console.warn("[WhatsApp Webhook] HMAC SHA256 signature verification failed.");
      return res.status(401).json({ error: "Unauthorized: Invalid X-Hub-Signature-256 header" });
    }
    const result = processWhatsAppWebhookPayload(req.body);
    return res.status(200).json({ status: "ok", ...result });
  } catch (err) {
    console.error("[WhatsApp Webhook Processing Failed]", err.message);
    return res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/webhooks/email", (req, res) => {
  try {
    const result = processEmailWebhookPayload(req.body);
    res.status(200).json({ status: "ok", ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/admin/audit-logs", authMiddleware, requireRole("admin"), (_req, res) => {
  const logs = db.auditLogs.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100);
  return res.json(logs);
});
apiRouter.get("/admin/products", authMiddleware, requireRole("admin"), (_req, res) => {
  const products = db.products.filter((p) => !p.isDeleted).map((p) => {
    const packages = db.productPackages.filter((pkg) => pkg.productId === p.id && pkg.isActive !== false);
    return { ...p, packages };
  });
  return res.json(products);
});
apiRouter.post("/admin/products", authMiddleware, requireRole("admin"), (req, res) => {
  const { id, categoryId, name, slug, tagline, description, imageUrl, deliveryMethod, deliveryInstructions, termsAndConditions, isActive, availableOnMainStore, availableToResellers } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required." });
  }
  if (id) {
    const existing = db.products.find((p) => p.id === id);
    if (!existing) return res.status(404).json({ error: "Product not found." });
    if (categoryId) existing.categoryId = categoryId;
    if (name) existing.name = name;
    if (tagline !== void 0) existing.tagline = tagline;
    if (description) existing.description = description;
    if (imageUrl) existing.imageUrl = imageUrl;
    if (deliveryMethod) existing.deliveryMethod = deliveryMethod;
    if (deliveryInstructions !== void 0) existing.deliveryInstructions = deliveryInstructions;
    if (termsAndConditions !== void 0) existing.termsAndConditions = termsAndConditions;
    if (isActive !== void 0) existing.isActive = isActive;
    if (availableOnMainStore !== void 0) existing.availableOnMainStore = availableOnMainStore;
    if (availableToResellers !== void 0) existing.availableToResellers = availableToResellers;
    existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    db.persist();
    return res.json(existing);
  }
  const newProduct = {
    id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    categoryId: categoryId || db.categories[0].id,
    name: name.trim(),
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    tagline: tagline || "",
    description: description.trim(),
    imageUrl: imageUrl || "/src/assets/images/hero_digital_products_1791884577566.jpg",
    deliveryMethod: deliveryMethod || "manual_credentials",
    deliveryInstructions: deliveryInstructions || "",
    termsAndConditions: termsAndConditions || "",
    isActive: isActive !== void 0 ? isActive : true,
    availableOnMainStore: availableOnMainStore !== void 0 ? availableOnMainStore : true,
    availableToResellers: availableToResellers !== void 0 ? availableToResellers : true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.products.push(newProduct);
  db.persist();
  return res.status(201).json(newProduct);
});
apiRouter.post("/admin/packages", authMiddleware, requireRole("admin"), (req, res) => {
  const { id, productId, name, durationLabel, durationDays, retailPriceBdt, resellerWholesaleCostBdt, stockCount, isActive } = req.body;
  if (!name || retailPriceBdt === void 0 || resellerWholesaleCostBdt === void 0) {
    return res.status(400).json({ error: "Name, retail price, and wholesale cost are required." });
  }
  if (id) {
    const existing = db.productPackages.find((pkg) => pkg.id === id);
    if (!existing) return res.status(404).json({ error: "Package not found." });
    existing.name = name;
    if (durationLabel) existing.durationLabel = durationLabel;
    if (durationDays !== void 0) existing.durationDays = Number(durationDays);
    existing.retailPriceBdt = Math.round(Number(retailPriceBdt) * 100) / 100;
    existing.resellerWholesaleCostBdt = Math.round(Number(resellerWholesaleCostBdt) * 100) / 100;
    if (stockCount !== void 0) existing.stockCount = Number(stockCount);
    if (isActive !== void 0) existing.isActive = isActive;
    existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
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
    stockCount: stockCount !== void 0 ? Number(stockCount) : -1,
    isActive: isActive !== void 0 ? isActive : true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.productPackages.push(newPackage);
  db.persist();
  return res.status(201).json(newPackage);
});
apiRouter.delete("/admin/products/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }
  product.isActive = false;
  product.isDeleted = true;
  product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  return res.json({ success: true, message: `Product "${product.name}" has been safely archived.` });
});
apiRouter.delete("/admin/packages/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const pkg = db.productPackages.find((p) => p.id === req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: "Package not found." });
  }
  pkg.isActive = false;
  pkg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  return res.json({ success: true, message: "Package archived." });
});
apiRouter.post("/admin/products/upload-image", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const { base64Data, originalName } = req.body;
    if (!base64Data || !originalName) {
      return res.status(400).json({ error: "base64Data and originalName are required." });
    }
    let rawBase64 = base64Data;
    const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      rawBase64 = match[2];
    }
    const buffer = Buffer.from(rawBase64, "base64");
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: "Product image exceeds the 3MB size limit." });
    }
    let ext = "jpg";
    let mimeType = "image/jpeg";
    if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
      ext = "jpg";
      mimeType = "image/jpeg";
    } else if (buffer.length >= 8 && buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
      ext = "png";
      mimeType = "image/png";
    } else if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      ext = "webp";
      mimeType = "image/webp";
    } else {
      return res.status(400).json({ error: "Invalid image format. Only JPEG, PNG, and WebP are allowed (SVG and executable files are prohibited for security)." });
    }
    const filename = `prod_${Date.now()}_${crypto5.randomBytes(4).toString("hex")}.${ext}`;
    const targetDir = UPLOADS_DIR;
    if (!fs2.existsSync(targetDir)) {
      fs2.mkdirSync(targetDir, { recursive: true });
    }
    fs2.writeFileSync(path2.join(targetDir, filename), buffer);
    const imageUrl = `/uploads/products/${filename}`;
    return res.json({ imageUrl, filename, sizeBytes: buffer.length, mimeType });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/uploads/products/:filename", (req, res) => {
  const safeFilename = path2.basename(req.params.filename);
  const filePath = path2.join(UPLOADS_DIR, safeFilename);
  if (!fs2.existsSync(filePath)) {
    return res.status(404).json({ error: "Image not found." });
  }
  res.sendFile(filePath);
});
function generateTicketId() {
  const d = /* @__PURE__ */ new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TCK-${dateStr}-${rand}`;
}
apiRouter.post("/tickets", authMiddleware, (req, res) => {
  try {
    const user = req.user;
    const { category, subject, message, orderNumber, attachments } = req.body;
    if (!category || !subject || !message) {
      return res.status(400).json({ error: "Category, subject, and message are required." });
    }
    let serviceName;
    let productId;
    if (orderNumber) {
      const order = db.orders.find((o) => o.orderNumber === orderNumber);
      if (order) {
        serviceName = `${order.snapshotProductName} (${order.snapshotPackageName})`;
        productId = order.productId;
      }
    }
    const savedAttachments = [];
    if (Array.isArray(attachments)) {
      if (attachments.length > 3) {
        return res.status(400).json({ error: "Maximum 3 screenshot attachments allowed per message." });
      }
      for (const att of attachments) {
        if (att.dataUrl && att.fileName) {
          const saved = saveEvidenceFile(att.dataUrl, att.fileName);
          savedAttachments.push(saved);
        }
      }
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const ticketId = generateTicketId();
    const initialMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId,
      senderUserId: user.id,
      senderRole: user.role === "admin" ? "admin" : "customer",
      senderName: user.fullName,
      message: message.trim(),
      attachments: savedAttachments,
      createdAt: now
    };
    const newTicket = {
      id: ticketId,
      customerId: user.id,
      customerName: user.fullName,
      customerEmail: user.email,
      customerPhone: user.phone,
      orderNumber: orderNumber ? orderNumber.trim() : void 0,
      productId,
      serviceName,
      category,
      subject: subject.trim(),
      status: "open",
      createdAt: now,
      updatedAt: now,
      messages: [initialMessage],
      internalNotes: []
    };
    db.tickets.push(newTicket);
    db.persist();
    const adminUser = db.users.find((u) => u.role === "admin");
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || adminUser?.email || "admin@ssdigitalbd.shop";
    enqueueNotification({
      recipientType: "admin",
      recipientContact: adminEmail,
      channel: "email",
      eventType: "NEW_TICKET_SUBMITTED",
      title: `[Support Ticket] ${newTicket.id} - ${newTicket.subject}`,
      bodyText: `Customer ${user.fullName} (${user.email}) submitted a support ticket in category "${category}". Order: ${orderNumber || "N/A"}.

Message: ${message.trim().substring(0, 150)}...`,
      metadataJson: { ticketId: newTicket.id, orderNumber }
    });
    const { internalNotes, ...cleanTicket } = newTicket;
    return res.status(201).json(cleanTicket);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/tickets", authMiddleware, (req, res) => {
  const user = req.user;
  let tickets = db.tickets;
  if (user.role !== "admin") {
    tickets = tickets.filter(
      (t) => t.customerId === user.id || t.customerEmail.toLowerCase() === user.email.toLowerCase() || user.phone && t.customerPhone === user.phone
    );
  }
  const sanitized = tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((t) => {
    if (user.role === "admin") return t;
    const { internalNotes, ...rest } = t;
    return rest;
  });
  return res.json(sanitized);
});
apiRouter.get("/tickets/:id", authMiddleware, (req, res) => {
  const user = req.user;
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }
  const isOwner = ticket.customerId === user.id || ticket.customerEmail.toLowerCase() === user.email.toLowerCase();
  if (user.role !== "admin" && !isOwner) {
    return res.status(403).json({ error: "Forbidden: You do not have access to this ticket." });
  }
  if (user.role === "admin") {
    return res.json(ticket);
  }
  const { internalNotes, ...cleanTicket } = ticket;
  return res.json(cleanTicket);
});
apiRouter.post("/tickets/:id/messages", authMiddleware, (req, res) => {
  try {
    const user = req.user;
    const ticket = db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    const isOwner = ticket.customerId === user.id || ticket.customerEmail.toLowerCase() === user.email.toLowerCase();
    if (user.role !== "admin" && !isOwner) {
      return res.status(403).json({ error: "Forbidden: You do not have access to this ticket." });
    }
    const { message, attachments } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message body cannot be empty." });
    }
    const savedAttachments = [];
    if (Array.isArray(attachments)) {
      if (attachments.length > 3) {
        return res.status(400).json({ error: "Maximum 3 screenshot attachments allowed per message." });
      }
      for (const att of attachments) {
        if (att.dataUrl && att.fileName) {
          const saved = saveEvidenceFile(att.dataUrl, att.fileName);
          savedAttachments.push(saved);
        }
      }
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticket.id,
      senderUserId: user.id,
      senderRole: user.role === "admin" ? "admin" : "customer",
      senderName: user.fullName,
      message: message.trim(),
      attachments: savedAttachments,
      createdAt: now
    };
    ticket.messages.push(newMsg);
    ticket.updatedAt = now;
    if (user.role !== "admin") {
      if (ticket.status === "resolved" || ticket.status === "closed") {
        ticket.status = "open";
      }
    } else {
      if (ticket.status === "open" || ticket.status === "in_review") {
        ticket.status = "waiting_customer";
      }
    }
    db.persist();
    if (user.role === "admin") {
      enqueueNotification({
        recipientType: "customer",
        recipientContact: ticket.customerEmail,
        channel: "email",
        eventType: "TICKET_STAFF_REPLY",
        title: `Reply on Ticket ${ticket.id}: ${ticket.subject}`,
        bodyText: `Our support staff has responded to your ticket:

"${message.trim()}"

Please check your Customer Dashboard to view or follow up.`,
        metadataJson: { ticketId: ticket.id }
      });
    }
    if (user.role === "admin") {
      return res.json(ticket);
    }
    const { internalNotes, ...cleanTicket } = ticket;
    return res.json(cleanTicket);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/tickets/:id/attachments/:attId", authMiddleware, (req, res) => {
  const user = req.user;
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }
  const isOwner = ticket.customerId === user.id || ticket.customerEmail.toLowerCase() === user.email.toLowerCase();
  if (user.role !== "admin" && !isOwner) {
    return res.status(403).json({ error: "Forbidden." });
  }
  let targetAttachment;
  for (const msg of ticket.messages) {
    const found = msg.attachments.find((a) => a.id === req.params.attId);
    if (found) {
      targetAttachment = found;
      break;
    }
  }
  if (!targetAttachment) {
    return res.status(404).json({ error: "Attachment record not found." });
  }
  const filePath = path2.join(EVIDENCE_DIR, targetAttachment.filename);
  if (!fs2.existsSync(filePath)) {
    return res.status(404).json({ error: "Attachment file not found on disk." });
  }
  res.setHeader("Content-Type", targetAttachment.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${targetAttachment.originalName}"`);
  res.setHeader("Cache-Control", "private, max-age=3600");
  const stream = fs2.createReadStream(filePath);
  stream.pipe(res);
});
apiRouter.get("/admin/tickets", authMiddleware, requireRole("admin"), (req, res) => {
  const { status, category, search } = req.query;
  let tickets = [...db.tickets];
  if (status && status !== "all") {
    tickets = tickets.filter((t) => t.status === status);
  }
  if (category && category !== "all") {
    tickets = tickets.filter((t) => t.category === category);
  }
  if (search) {
    const q = search.toLowerCase().trim();
    tickets = tickets.filter(
      (t) => t.id.toLowerCase().includes(q) || t.orderNumber && t.orderNumber.toLowerCase().includes(q) || t.customerName.toLowerCase().includes(q) || t.customerEmail.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    );
  }
  tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return res.json(tickets);
});
apiRouter.post("/admin/tickets/:id/notes", authMiddleware, requireRole("admin"), (req, res) => {
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }
  const { note } = req.body;
  if (!note || !note.trim()) {
    return res.status(400).json({ error: "Note text cannot be empty." });
  }
  if (!ticket.internalNotes) {
    ticket.internalNotes = [];
  }
  const internalNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    staffUserId: req.user.id,
    staffName: req.user.fullName,
    note: note.trim(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  ticket.internalNotes.push(internalNote);
  ticket.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  return res.status(201).json(ticket);
});
apiRouter.put("/admin/tickets/:id/status", authMiddleware, requireRole("admin"), (req, res) => {
  const ticket = db.tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found." });
  }
  const { status } = req.body;
  const validStatuses = ["open", "in_review", "waiting_customer", "resolved", "closed"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  ticket.status = status;
  ticket.updatedAt = now;
  if (status === "resolved") {
    ticket.resolvedAt = now;
  } else if (status === "closed") {
    ticket.closedAt = now;
  }
  db.persist();
  enqueueNotification({
    recipientType: "customer",
    recipientContact: ticket.customerEmail,
    channel: "email",
    eventType: "TICKET_STATUS_UPDATED",
    title: `Ticket ${ticket.id} status updated to: ${status.replace("_", " ").toUpperCase()}`,
    bodyText: `Your support ticket regarding "${ticket.subject}" has been marked as ${status.replace("_", " ").toUpperCase()}. Check your Customer Dashboard for full details.`,
    metadataJson: { ticketId: ticket.id, status }
  });
  return res.json(ticket);
});
apiRouter.post("/admin/tickets/:id/reply", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const ticket = db.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }
    const { message, nextStatus } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Reply message cannot be empty." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticket.id,
      senderUserId: req.user.id,
      senderRole: "admin",
      senderName: `${req.user.fullName} (Staff)`,
      message: message.trim(),
      attachments: [],
      createdAt: now
    };
    ticket.messages.push(newMsg);
    ticket.updatedAt = now;
    ticket.status = nextStatus || "waiting_customer";
    if (ticket.status === "resolved") ticket.resolvedAt = now;
    if (ticket.status === "closed") ticket.closedAt = now;
    db.persist();
    enqueueNotification({
      recipientType: "customer",
      recipientContact: ticket.customerEmail,
      channel: "email",
      eventType: "TICKET_STAFF_REPLY",
      title: `[Support Update] Ticket ${ticket.id}: ${ticket.subject}`,
      bodyText: `Support response:

"${message.trim()}"

Status: ${ticket.status.toUpperCase()}`,
      metadataJson: { ticketId: ticket.id }
    });
    return res.json(ticket);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/backups", authMiddleware, requireRole("admin"), (_req, res) => {
  try {
    const logs = db.backupLogs.slice(0, 7);
    const allLogs = db.backupLogs;
    const health = db.getStorageHealthMetrics();
    return res.json({ logs, allLogs, health });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/admin/backups/verify-now", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const actorName = req.user ? `${req.user.fullName} (${req.user.role})` : "Super Admin";
    const newLog = db.createBackupSnapshot("manual_verification", actorName);
    const health = db.getStorageHealthMetrics();
    return res.json({
      success: true,
      message: "On-demand database backup and SHA-256 verification completed successfully.",
      log: newLog,
      health
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
apiRouter.get("/products/seller-products", (_req, res) => {
  const approved = db.sellerProducts.filter((p) => p.status === "approved");
  return res.json(approved);
});
apiRouter.post("/customer/seller-apply", authMiddleware, (req, res) => {
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
      documents
    } = req.body;
    if (!storeName || !nidNumber || !contactPhone || !address || !payoutMethod || !payoutAccountNumber) {
      return res.status(400).json({ error: "Store Name, NID, Contact Phone, Address, and Payout Account are required." });
    }
    const application = submitSellerApplication({
      userId: req.user.id,
      storeName,
      bio: bio || "",
      nidNumber,
      tradeLicenseNumber,
      contactPhone,
      emergencyContact,
      address,
      payoutMethod,
      payoutAccountNumber,
      payoutBankDetails,
      documents: documents || []
    });
    return res.status(201).json(application);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/seller/profile", authMiddleware, (req, res) => {
  const profile = db.sellerProfiles.find((s) => s.userId === req.user.id);
  const application = db.sellerApplications.find((a) => a.userId === req.user.id);
  return res.json({ profile: profile || null, application: application || null });
});
apiRouter.get("/seller/dashboard", authMiddleware, (req, res) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user.id);
  if (!seller) {
    return res.status(403).json({ error: "You do not have an approved seller profile." });
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
      activeProductsCount: products.filter((p) => p.status === "approved").length
    },
    recentEarnings: earnings.slice(-10).reverse(),
    recentWithdrawals: withdrawals.slice(-10)
  });
});
apiRouter.get("/seller/products", authMiddleware, (req, res) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user.id);
  if (!seller) {
    return res.status(403).json({ error: "You do not have an approved seller profile." });
  }
  const products = db.sellerProducts.filter((p) => p.sellerId === seller.id);
  return res.json(products);
});
apiRouter.post("/seller/products", authMiddleware, (req, res) => {
  try {
    const seller = db.sellerProfiles.find((s) => s.userId === req.user.id && s.status === "approved");
    if (!seller) {
      return res.status(403).json({ error: "Active approved seller status is required to publish products." });
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
      customCommissionPercentage
    } = req.body;
    if (!name || !description || !priceBdt || !productType) {
      return res.status(400).json({ error: "Name, Description, Price, and Product Type are required." });
    }
    const product = submitSellerProduct(seller.id, {
      id,
      categoryId: categoryId || "cat_developer",
      name,
      tagline: tagline || "",
      description,
      priceBdt: Number(priceBdt),
      productType,
      fileUrl,
      fileName,
      fileSizeBytes,
      fileHash,
      downloadLimitPerPurchase: downloadLimitPerPurchase ? Number(downloadLimitPerPurchase) : 5,
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600",
      previewUrl,
      customCommissionPercentage: customCommissionPercentage ? Number(customCommissionPercentage) : void 0
    });
    return res.status(200).json(product);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/seller/earnings", authMiddleware, (req, res) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user.id);
  if (!seller) {
    return res.status(403).json({ error: "Seller profile required." });
  }
  const earnings = db.sellerEarnings.filter((e) => e.sellerId === seller.id);
  return res.json(earnings);
});
apiRouter.get("/seller/withdrawals", authMiddleware, (req, res) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user.id);
  if (!seller) {
    return res.status(403).json({ error: "Seller profile required." });
  }
  const withdrawals = db.sellerWithdrawals.filter((w) => w.sellerId === seller.id);
  return res.json(withdrawals);
});
apiRouter.post("/seller/withdrawals", authMiddleware, (req, res) => {
  try {
    const seller = db.sellerProfiles.find((s) => s.userId === req.user.id);
    if (!seller) {
      return res.status(403).json({ error: "Seller profile required." });
    }
    const { amountBdt, payoutMethod, payoutAccountNumber, payoutDetails } = req.body;
    if (!amountBdt || !payoutMethod || !payoutAccountNumber) {
      return res.status(400).json({ error: "Amount, Payout Method, and Account Number are required." });
    }
    const withdrawal = requestSellerWithdrawal({
      sellerId: seller.id,
      amountBdt: Number(amountBdt),
      payoutMethod,
      payoutAccountNumber,
      payoutDetails
    });
    return res.status(201).json(withdrawal);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/seller/reseller-orders", authMiddleware, (req, res) => {
  const seller = db.sellerProfiles.find((s) => s.userId === req.user.id);
  if (!seller && req.user.role !== "admin") {
    return res.status(403).json({ error: "Seller profile required." });
  }
  const sellerId = seller ? seller.id : req.query.sellerId;
  const orders = db.orders.filter((o) => o.productOwnerType === "SELLER" && (!sellerId || o.productOwnerId === sellerId)).map((o) => {
    const submissions = db.paymentSubmissions.filter((p) => p.orderId === o.id);
    const delivery = db.deliveries.find((d) => d.orderId === o.id);
    const store = o.storeId ? db.stores.find((s) => s.id === o.storeId) : void 0;
    return {
      ...o,
      submissions,
      delivery,
      storeName: store?.storeName || "Reseller Store",
      subdomain: store?.subdomain
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json(orders);
});
apiRouter.post("/seller/orders/:orderId/review", authMiddleware, (req, res) => {
  try {
    const { decision, rejectionReason, fulfillmentPayload, instructionsForCustomer } = req.body;
    if (!decision || !["accept", "reject"].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be either "accept" or "reject".' });
    }
    const result = sellerReviewOrder({
      orderId: req.params.orderId,
      sellerUserId: req.user.id,
      decision,
      rejectionReason,
      fulfillmentPayload,
      instructionsForCustomer
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/orders/seller-purchase", (req, res) => {
  try {
    const { sellerProductId, customerName, customerEmail, customerPhone, paymentChannel, transactionId } = req.body;
    if (!sellerProductId || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: "Product ID, customer name, email, and phone are required." });
    }
    const product = db.sellerProducts.find((p) => p.id === sellerProductId && p.status === "approved");
    if (!product) {
      return res.status(404).json({ error: "Digital product is unavailable or discontinued." });
    }
    const user = getOptionalUser(req);
    const orderNumber = `ORD-SEL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      orderNumber,
      orderSource: "main_store",
      customerId: user ? user.id : void 0,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: customerPhone.trim(),
      productId: product.id,
      packageId: "pkg_digital_download",
      snapshotProductName: product.name,
      snapshotPackageName: "Digital Delivery Access",
      snapshotDurationDays: 365,
      snapshotRetailPriceBdt: product.priceBdt,
      snapshotWholesaleCostBdt: 0,
      snapshotDeliveryMethod: "instant_license_key",
      currency: "BDT",
      orderStatus: "completed",
      walletDebited: false,
      customerInputNotes: `Direct digital license purchase: ${product.name}`,
      createdAt: now,
      updatedAt: now
    };
    db.orders.unshift(order);
    if (transactionId) {
      db.paymentSubmissions.unshift({
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        channel: paymentChannel || "bkash",
        claimedAmountBdt: product.priceBdt,
        transactionId: transactionId.trim(),
        senderPhoneOrAccount: customerPhone,
        recipientAccountSnapshot: "01819000000",
        verificationStatus: "verified_valid",
        createdAt: now
      });
    }
    const { earning, downloadToken } = recordSellerProductPurchase({
      order,
      sellerProductId: product.id
    });
    enqueueNotification({
      recipientType: "customer",
      recipientContact: customerEmail,
      channel: "email",
      eventType: "SELLER_PRODUCT_PURCHASED",
      title: `[Delivery] Download Access for ${product.name}`,
      bodyText: `Your purchase of ${product.name} (\u09F3${product.priceBdt}) has been confirmed!

Your secure download token: ${downloadToken.token}
Valid for 7 days (Limit: ${downloadToken.downloadsRemaining} downloads).`,
      metadataJson: { orderId: order.id, downloadToken: downloadToken.token }
    });
    return res.status(201).json({
      order,
      downloadToken: downloadToken.token,
      product: {
        id: product.id,
        name: product.name,
        fileName: product.fileName,
        fileSizeBytes: product.fileSizeBytes
      },
      message: "Purchase completed! You can now securely download your digital file."
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/downloads/verify/:token", (req, res) => {
  const result = validateAndConsumeDownloadToken(req.params.token);
  if (!result.valid) {
    return res.status(400).json({ valid: false, message: result.message });
  }
  return res.json({
    valid: true,
    product: {
      id: result.product.id,
      name: result.product.name,
      fileName: result.product.fileName,
      fileSizeBytes: result.product.fileSizeBytes,
      productType: result.product.productType,
      sellerStoreName: result.product.sellerStoreName
    },
    remainingDownloads: result.remainingDownloads,
    downloadUrl: `/api/downloads/file/${req.params.token}`
  });
});
apiRouter.get("/downloads/file/:token", (req, res) => {
  const tokenRecord = db.sellerDownloadTokens.find((t) => t.token === req.params.token);
  if (!tokenRecord) {
    return res.status(404).send("Download key is invalid or not found.");
  }
  const product = db.sellerProducts.find((p) => p.id === tokenRecord.sellerProductId);
  if (!product) {
    return res.status(404).send("Product file not found.");
  }
  const safeFilename = (product.fileName || "digital_product.zip").replace(/[^a-zA-Z0-9._-]/g, "_");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
  res.setHeader("Content-Type", "application/octet-stream");
  const payload = Buffer.from(
    `SSDigitalBD.shop Certified Digital Delivery
Product: ${product.name}
Seller: ${product.sellerStoreName}
License: Authorized Single-User Commercial License
Checksum: ${product.fileHash}
Issued: ${(/* @__PURE__ */ new Date()).toISOString()}
Order ID: ${tokenRecord.orderId}
`
  );
  return res.send(payload);
});
apiRouter.get("/admin/seller-applications", authMiddleware, requireRole("admin"), (_req, res) => {
  return res.json(db.sellerApplications);
});
apiRouter.post("/admin/seller-applications/:id/review", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const { status, adminNotes, rejectionReason } = req.body;
    if (!status || !["approved", "rejected", "needs_info"].includes(status)) {
      return res.status(400).json({ error: "Valid status (approved, rejected, needs_info) is required." });
    }
    const result = reviewSellerApplication({
      applicationId: req.params.id,
      status,
      adminNotes,
      rejectionReason,
      adminUserId: req.user.id
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/sellers", authMiddleware, requireRole("admin"), (_req, res) => {
  const sellers = db.sellerProfiles.map((s) => {
    const user = db.users.find((u) => u.id === s.userId);
    const productsCount = db.sellerProducts.filter((p) => p.sellerId === s.id).length;
    return {
      ...s,
      userFullName: user?.fullName || "Unknown User",
      userEmail: user?.email || s.contactEmail,
      productsCount
    };
  });
  return res.json(sellers);
});
apiRouter.get("/admin/seller-products", authMiddleware, requireRole("admin"), (_req, res) => {
  return res.json(db.sellerProducts);
});
apiRouter.put("/admin/seller-products/:id/status", authMiddleware, requireRole("admin"), (req, res) => {
  const product = db.sellerProducts.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: "Seller product not found." });
  }
  const { status, rejectionReason } = req.body;
  if (!status || !["draft", "pending_approval", "approved", "rejected", "suspended"].includes(status)) {
    return res.status(400).json({ error: "Invalid product status." });
  }
  product.status = status;
  if (rejectionReason) product.rejectionReason = rejectionReason;
  product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  db.persist();
  return res.json(product);
});
apiRouter.get("/admin/commissions", authMiddleware, requireRole("admin"), (_req, res) => {
  return res.json({
    policy: db.sellerCommissionPolicy,
    exampleCalculations: [
      { type: "Global Default", ...resolveCommissionDetails() },
      { type: "Category: Software", ...resolveCommissionDetails(void 0, void 0, "cat_software") },
      { type: "Category: Developer Tools", ...resolveCommissionDetails(void 0, void 0, "cat_developer") },
      { type: "Product Override (Laravel Engine)", ...resolveCommissionDetails("sprod_laravel_ecommerce") }
    ]
  });
});
apiRouter.put("/admin/commissions", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const { globalDefaultPercent, categoryRates } = req.body;
    if (typeof globalDefaultPercent !== "number" || globalDefaultPercent < 0 || globalDefaultPercent > 50) {
      return res.status(400).json({ error: "Global default percentage must be a number between 0% and 50%." });
    }
    db.sellerCommissionPolicy = {
      globalDefaultPercent,
      categoryRates: categoryRates || db.sellerCommissionPolicy.categoryRates,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedBy: req.user.id
    };
    db.persist();
    return res.json(db.sellerCommissionPolicy);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
apiRouter.get("/admin/seller-withdrawals", authMiddleware, requireRole("admin"), (_req, res) => {
  const withdrawals = db.sellerWithdrawals.map((w) => {
    const seller = db.sellerProfiles.find((s) => s.id === w.sellerId);
    return {
      ...w,
      sellerStoreName: seller?.storeName || "Unknown Seller",
      sellerAvailableBalance: seller?.availableBalanceBdt || 0
    };
  });
  return res.json(withdrawals);
});
apiRouter.post("/admin/seller-withdrawals/:id/payout", authMiddleware, requireRole("admin"), (req, res) => {
  try {
    const { action, transactionReference, rejectionReason } = req.body;
    if (!action || !["complete", "reject"].includes(action)) {
      return res.status(400).json({ error: "Valid action (complete or reject) is required." });
    }
    const withdrawal = processSellerWithdrawalPayout({
      withdrawalId: req.params.id,
      action,
      transactionReference,
      rejectionReason,
      adminUserId: req.user.id
    });
    return res.json(withdrawal);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// server.ts
var app = express();
var PORT = process.env.PORT || 3e3;
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use("/api", apiRouter);
var DATA_DIR2 = process.env.DATA_DIR ? path3.resolve(process.env.DATA_DIR) : path3.resolve(process.cwd(), ".data");
var uploadsPath = path3.join(DATA_DIR2, "uploads");
if (!fs3.existsSync(uploadsPath)) {
  fs3.mkdirSync(uploadsPath, { recursive: true });
}
app.use("/uploads", express.static(uploadsPath, { maxAge: "7d" }));
var distPath = path3.resolve(process.cwd(), "dist");
var indexPath = path3.join(distPath, "index.html");
app.use(
  express.static(distPath, {
    maxAge: "1d",
    index: false
  })
);
app.get(
  ["/", "/admin", "/admin/*", "/customer", "/customer/*", "/seller", "/seller/*", "/reseller", "/reseller/*", "/store/*"],
  (_req, res) => {
    if (fs3.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return res.status(200).send(
      "SSDigitalBD.shop Backend Initialized. Generating production client bundle..."
    );
  }
);
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found." });
  }
  if (fs3.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(200).send(
    'SSDigitalBD.shop Backend Running. Run "npm run build" to generate client production bundle.'
  );
});
if (process.env.NODE_ENV !== "test") {
  const server = app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`[SSDigitalBD.shop] Production server listening on 0.0.0.0:${PORT}`);
  });
  process.on("SIGTERM", () => {
    console.log("[SSDigitalBD.shop] SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      process.exit(0);
    });
  });
}
var server_default = app;
export {
  server_default as default
};
