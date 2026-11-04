/**
 * JSON Database to MySQL 8+ Migration Generator
 * SSDigitalBD.shop Production Migration Utility
 *
 * Reads .data/db.json (matching the immutable SHA-256 backup),
 * generates structured SQL INSERT statements conforming to database/schema.sql,
 * and writes database/seed_data.sql for direct MySQL 8+ provisioning.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.resolve(process.cwd(), '.data/db.json');
const OUTPUT_SQL_PATH = path.resolve(process.cwd(), 'database/seed_data.sql');

function escapeSqlString(str: any): string {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'boolean') return str ? 'TRUE' : 'FALSE';
  if (typeof str === 'number') return isNaN(str) ? 'NULL' : String(str);
  if (str instanceof Date) return `'${str.toISOString().slice(0, 19).replace('T', ' ')}'`;
  
  const cleaned = String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `'${cleaned}'`;
}

function formatDate(val: any): string {
  if (!val) return 'CURRENT_TIMESTAMP';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'CURRENT_TIMESTAMP';
    return `'${d.toISOString().slice(0, 19).replace('T', ' ')}'`;
  } catch {
    return 'CURRENT_TIMESTAMP';
  }
}

export function generateMigrationSql(): { sql: string; recordCounts: Record<string, number>; sha256: string } {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Source database file not found at ${DB_PATH}`);
  }

  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const db = JSON.parse(raw);

  const lines: string[] = [];
  lines.push('-- ============================================================================');
  lines.push('-- SSDIGITALBD.SHOP COMPLETE DATA MIGRATION SEED SCRIPT (JSON -> MySQL 8+)');
  lines.push(`-- Source Checksum: ${sha256}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- ============================================================================');
  lines.push('USE digimarket_db;');
  lines.push('SET NAMES utf8mb4;');
  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('');

  const recordCounts: Record<string, number> = {};

  // 1. Users
  const users = db.users || [];
  recordCounts['users'] = users.length;
  if (users.length > 0) {
    lines.push('-- Table: users');
    lines.push('INSERT INTO users (id, email, password_hash, full_name, phone, role, status, created_at, updated_at) VALUES');
    const rows = users.map((u: any) => {
      return `  (${escapeSqlString(u.id)}, ${escapeSqlString(u.email)}, ${escapeSqlString(u.passwordHash || u.password)}, ${escapeSqlString(u.fullName || u.name)}, ${escapeSqlString(u.phone || 'N/A')}, ${escapeSqlString(u.role || 'customer')}, ${escapeSqlString(u.status || 'active')}, ${formatDate(u.createdAt)}, ${formatDate(u.updatedAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 2. Categories
  const categories = db.categories || [];
  recordCounts['categories'] = categories.length;
  if (categories.length > 0) {
    lines.push('-- Table: categories');
    lines.push('INSERT INTO categories (id, name, slug, description, display_order, created_at) VALUES');
    const rows = categories.map((c: any) => {
      return `  (${escapeSqlString(c.id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.slug)}, ${escapeSqlString(c.description || '')}, ${Number(c.displayOrder || 0)}, ${formatDate(c.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 3. Products
  const products = db.products || [];
  recordCounts['products'] = products.length;
  if (products.length > 0) {
    lines.push('-- Table: products');
    lines.push('INSERT INTO products (id, category_id, name, slug, short_description, description, image_url, delivery_method, is_active, available_on_main_store, available_to_resellers, created_at, updated_at) VALUES');
    const rows = products.map((p: any) => {
      return `  (${escapeSqlString(p.id)}, ${escapeSqlString(p.categoryId)}, ${escapeSqlString(p.name)}, ${escapeSqlString(p.slug)}, ${escapeSqlString(p.shortDescription || '')}, ${escapeSqlString(p.description || p.fullDescription || '')}, ${escapeSqlString(p.imageUrl || p.thumbnailUrl || '')}, ${escapeSqlString(p.deliveryMethod || 'manual_credentials')}, ${p.isActive !== false ? 'TRUE' : 'FALSE'}, ${p.availableOnMainStore !== false ? 'TRUE' : 'FALSE'}, ${p.availableToResellers !== false ? 'TRUE' : 'FALSE'}, ${formatDate(p.createdAt)}, ${formatDate(p.updatedAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 4. Product Packages
  const packages = db.productPackages || db.packages || [];
  recordCounts['product_packages'] = packages.length;
  if (packages.length > 0) {
    lines.push('-- Table: product_packages');
    lines.push('INSERT INTO product_packages (id, product_id, name, duration_label, duration_days, retail_price_bdt, reseller_wholesale_cost_bdt, stock_count, is_active, created_at) VALUES');
    const rows = packages.map((pkg: any) => {
      return `  (${escapeSqlString(pkg.id)}, ${escapeSqlString(pkg.productId)}, ${escapeSqlString(pkg.name || pkg.durationLabel)}, ${escapeSqlString(pkg.durationLabel)}, ${Number(pkg.durationDays || 30)}, ${Number(pkg.retailPriceBdt || 0).toFixed(2)}, ${Number(pkg.resellerWholesaleCostBdt || pkg.wholesaleCostBdt || 0).toFixed(2)}, ${Number(pkg.stockCount ?? -1)}, ${pkg.isActive !== false ? 'TRUE' : 'FALSE'}, ${formatDate(pkg.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 5. Reseller Applications
  const apps = db.resellerApplications || [];
  recordCounts['reseller_applications'] = apps.length;
  if (apps.length > 0) {
    lines.push('-- Table: reseller_applications');
    lines.push('INSERT INTO reseller_applications (id, user_id, business_name, requested_subdomain, national_id_number, contact_phone, address, status, created_at) VALUES');
    const rows = apps.map((a: any) => {
      return `  (${escapeSqlString(a.id)}, ${escapeSqlString(a.userId)}, ${escapeSqlString(a.businessName)}, ${escapeSqlString(a.requestedSubdomain)}, ${escapeSqlString(a.nationalIdNumber || 'N/A')}, ${escapeSqlString(a.contactPhone)}, ${escapeSqlString(a.address)}, ${escapeSqlString(a.status || 'pending')}, ${formatDate(a.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 6. Stores
  const stores = db.stores || [];
  recordCounts['stores'] = stores.length;
  if (stores.length > 0) {
    lines.push('-- Table: stores');
    lines.push('INSERT INTO stores (id, reseller_id, store_name, subdomain, status, logo_url, banner_url, support_phone, support_email, support_whatsapp, created_at) VALUES');
    const rows = stores.map((s: any) => {
      return `  (${escapeSqlString(s.id)}, ${escapeSqlString(s.resellerId)}, ${escapeSqlString(s.storeName)}, ${escapeSqlString(s.subdomain)}, ${escapeSqlString(s.status || 'active')}, ${escapeSqlString(s.logoUrl || null)}, ${escapeSqlString(s.bannerUrl || null)}, ${escapeSqlString(s.supportPhone || null)}, ${escapeSqlString(s.supportEmail || null)}, ${escapeSqlString(s.supportWhatsapp || null)}, ${formatDate(s.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 7. Reseller Wallets
  const wallets = db.resellerWallets || [];
  recordCounts['reseller_wallets'] = wallets.length;
  if (wallets.length > 0) {
    lines.push('-- Table: reseller_wallets');
    lines.push('INSERT INTO reseller_wallets (reseller_id, available_balance_bdt, locked_balance_bdt, total_deposited_bdt, total_spent_bdt, total_bonus_bdt, updated_at) VALUES');
    const rows = wallets.map((w: any) => {
      return `  (${escapeSqlString(w.resellerId)}, ${Number(w.availableBalanceBdt || 0).toFixed(2)}, ${Number(w.lockedBalanceBdt || 0).toFixed(2)}, ${Number(w.totalDepositedBdt || 0).toFixed(2)}, ${Number(w.totalSpentBdt || 0).toFixed(2)}, ${Number(w.totalBonusBdt || 0).toFixed(2)}, ${formatDate(w.updatedAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 8. Wallet Ledger
  const walletLedgers = db.walletLedger || [];
  recordCounts['wallet_ledger'] = walletLedgers.length;
  if (walletLedgers.length > 0) {
    lines.push('-- Table: wallet_ledger');
    lines.push('INSERT INTO wallet_ledger (id, reseller_id, reference_id, idempotency_key, entry_type, amount_bdt, balance_before_bdt, balance_after_bdt, reason, created_by, created_at) VALUES');
    const rows = walletLedgers.map((l: any) => {
      return `  (${escapeSqlString(l.id)}, ${escapeSqlString(l.resellerId)}, ${escapeSqlString(l.referenceId || l.id)}, ${escapeSqlString(l.idempotencyKey || `IDEMP-${l.id}`)}, ${escapeSqlString(l.entryType || 'adjustment_credit')}, ${Number(l.amountBdt || 0).toFixed(2)}, ${Number(l.balanceBeforeBdt || 0).toFixed(2)}, ${Number(l.balanceAfterBdt || 0).toFixed(2)}, ${escapeSqlString(l.reason || l.description || '')}, ${escapeSqlString(l.createdBy || 'SYSTEM')}, ${formatDate(l.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 9. Deposit Requests
  const deposits = db.depositRequests || [];
  recordCounts['deposit_requests'] = deposits.length;
  if (deposits.length > 0) {
    lines.push('-- Table: deposit_requests');
    lines.push('INSERT INTO deposit_requests (id, reseller_id, method, claimed_amount_bdt, transaction_reference, sender_account_number, status, created_at) VALUES');
    const rows = deposits.map((d: any) => {
      return `  (${escapeSqlString(d.id)}, ${escapeSqlString(d.resellerId)}, ${escapeSqlString(d.method || 'bkash_merchant')}, ${Number(d.claimedAmountBdt || 0).toFixed(2)}, ${escapeSqlString(d.transactionReference || d.id)}, ${escapeSqlString(d.senderAccountNumber || 'N/A')}, ${escapeSqlString(d.status || 'pending')}, ${formatDate(d.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 10. Orders
  const orders = db.orders || [];
  recordCounts['orders'] = orders.length;
  if (orders.length > 0) {
    lines.push('-- Table: orders');
    lines.push('INSERT INTO orders (id, order_number, order_source, store_id, reseller_id, customer_name, customer_email, customer_phone, product_id, package_id, snapshot_product_name, snapshot_package_name, snapshot_duration_days, snapshot_retail_price_bdt, snapshot_wholesale_cost_bdt, snapshot_delivery_method, order_status, wallet_debited, customer_input_notes, created_at, updated_at) VALUES');
    const rows = orders.map((o: any) => {
      return `  (${escapeSqlString(o.id)}, ${escapeSqlString(o.orderNumber)}, ${escapeSqlString(o.orderSource || 'main_store')}, ${escapeSqlString(o.storeId || null)}, ${escapeSqlString(o.resellerId || null)}, ${escapeSqlString(o.customerName)}, ${escapeSqlString(o.customerEmail)}, ${escapeSqlString(o.customerPhone)}, ${escapeSqlString(o.productId)}, ${escapeSqlString(o.packageId)}, ${escapeSqlString(o.snapshotProductName || o.productName || 'Digital Product')}, ${escapeSqlString(o.snapshotPackageName || o.packageName || 'Package')}, ${Number(o.snapshotDurationDays || 30)}, ${Number(o.snapshotRetailPriceBdt || o.retailPriceBdt || 0).toFixed(2)}, ${Number(o.snapshotWholesaleCostBdt || o.wholesaleCostBdt || 0).toFixed(2)}, ${escapeSqlString(o.snapshotDeliveryMethod || 'manual_credentials')}, ${escapeSqlString(o.orderStatus || 'payment_submitted')}, ${o.walletDebited ? 'TRUE' : 'FALSE'}, ${escapeSqlString(o.customerInputNotes || '')}, ${formatDate(o.createdAt)}, ${formatDate(o.updatedAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 11. Payment Submissions
  const payments = db.paymentSubmissions || [];
  recordCounts['payment_submissions'] = payments.length;
  if (payments.length > 0) {
    lines.push('-- Table: payment_submissions');
    lines.push('INSERT INTO payment_submissions (id, order_id, channel, claimed_amount_bdt, transaction_id, sender_phone_or_account, recipient_account_snapshot, verification_status, created_at) VALUES');
    const rows = payments.map((pm: any) => {
      return `  (${escapeSqlString(pm.id)}, ${escapeSqlString(pm.orderId)}, ${escapeSqlString(pm.channel || 'bkash')}, ${Number(pm.claimedAmountBdt || 0).toFixed(2)}, ${escapeSqlString(pm.transactionId)}, ${escapeSqlString(pm.senderPhoneOrAccount || 'N/A')}, ${escapeSqlString(pm.recipientAccountSnapshot || '01711000001')}, ${escapeSqlString(pm.verificationStatus || 'submitted')}, ${formatDate(pm.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 12. Deliveries
  const deliveries = db.deliveries || [];
  recordCounts['deliveries'] = deliveries.length;
  if (deliveries.length > 0) {
    lines.push('-- Table: deliveries');
    lines.push('INSERT INTO deliveries (id, order_id, fulfillment_method, fulfillment_payload, instructions_for_customer, state, created_at) VALUES');
    const rows = deliveries.map((d: any) => {
      return `  (${escapeSqlString(d.id)}, ${escapeSqlString(d.orderId)}, ${escapeSqlString(d.fulfillmentMethod || 'manual_credentials')}, ${escapeSqlString(d.fulfillmentPayload || '')}, ${escapeSqlString(d.instructionsForCustomer || '')}, ${escapeSqlString(d.state || 'not_started')}, ${formatDate(d.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  // 13. YouTube Listings
  const ytListings = db.youtubeListings || [];
  recordCounts['youtube_listings'] = ytListings.length;
  if (ytListings.length > 0) {
    lines.push('-- Table: youtube_listings');
    lines.push('INSERT INTO youtube_listings (id, seller_id, channel_name, channel_handle, channel_url, niche, subscribers_count, total_views, monthly_revenue_bdt, monetization_status, primary_audience_country, price_bdt, description, status, featured, created_at) VALUES');
    const rows = ytListings.map((y: any) => {
      return `  (${escapeSqlString(y.id)}, ${escapeSqlString(y.sellerId)}, ${escapeSqlString(y.channelName)}, ${escapeSqlString(y.channelHandle)}, ${escapeSqlString(y.channelUrl)}, ${escapeSqlString(y.niche)}, ${Number(y.subscribersCount || 0)}, ${Number(y.totalViews || 0)}, ${Number(y.monthlyRevenueBdt || 0).toFixed(2)}, ${escapeSqlString(y.monetizationStatus || 'not_monetized')}, ${escapeSqlString(y.primaryAudienceCountry || 'Bangladesh')}, ${Number(y.priceBdt || 0).toFixed(2)}, ${escapeSqlString(y.description || '')}, ${escapeSqlString(y.status || 'approved_active')}, ${y.featured ? 'TRUE' : 'FALSE'}, ${formatDate(y.createdAt)})`;
    });
    lines.push(rows.join(',\n') + ';');
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('-- End of Migration Seed Script');

  const fullSql = lines.join('\n');
  fs.writeFileSync(OUTPUT_SQL_PATH, fullSql, 'utf-8');

  return {
    sql: fullSql,
    recordCounts,
    sha256,
  };
}

if (process.argv[1] && process.argv[1].endsWith('migrate_json_to_mysql.ts')) {
  try {
    const res = generateMigrationSql();
    console.log(`[MySQL Migration] Successfully generated ${OUTPUT_SQL_PATH}`);
    console.log(`[Source SHA-256]: ${res.sha256}`);
    console.log('[Migrated Records Summary]:');
    for (const [k, v] of Object.entries(res.recordCounts)) {
      console.log(`  - ${k}: ${v} records`);
    }
  } catch (err: any) {
    console.error('[MySQL Migration Error]:', err.message);
    process.exit(1);
  }
}
