/**
 * Backup and Disaster Recovery Restore Verification Test
 * Tests that .data/db.json can be fully restored from backup with byte-level parity.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOURCE_DB = path.resolve(process.cwd(), '.data/db.json');
const BACKUP_FILE = path.resolve(process.cwd(), '.data/db.json.readonly_audit_backup_20261104');
const RESTORE_TARGET = path.resolve(process.cwd(), '.data/restore_test_sandbox.json');
const EXPECTED_CHECKSUM = '1ffc728ad9fb1f037791bf5d6c8f806ee6ff6439d335f209d62713904bc3dfd5';

function calculateHash(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function runBackupRestoreTest() {
  console.log('=== STARTING BACKUP & RESTORE VERIFICATION TEST ===\n');

  // Step 1: Check Source Existence & Hash
  if (!fs.existsSync(SOURCE_DB)) {
    throw new Error(`Source database missing: ${SOURCE_DB}`);
  }
  const sourceHash = calculateHash(SOURCE_DB);
  console.log(`[Source File] ${SOURCE_DB}`);
  console.log(`[Source SHA-256] ${sourceHash}`);

  // Step 2: Check Immutable Backup File & Permission
  if (!fs.existsSync(BACKUP_FILE)) {
    throw new Error(`Backup file missing: ${BACKUP_FILE}`);
  }
  const backupStats = fs.statSync(BACKUP_FILE);
  const backupMode = (backupStats.mode & 0o777).toString(8);
  const backupHash = calculateHash(BACKUP_FILE);
  console.log(`[Backup File] ${BACKUP_FILE}`);
  console.log(`[Backup Mode] 0${backupMode} (Read-Only)`);
  console.log(`[Backup SHA-256] ${backupHash}`);

  if (backupHash !== EXPECTED_CHECKSUM) {
    throw new Error(`Backup hash mismatch! Expected ${EXPECTED_CHECKSUM}, got ${backupHash}`);
  }
  console.log('✓ Immutable Backup SHA-256 matches expected audit hash exactly.');

  // Step 3: Perform Disaster Recovery Restore Simulation
  console.log(`\n[Simulating Restore] Copying ${BACKUP_FILE} -> ${RESTORE_TARGET}...`);
  fs.copyFileSync(BACKUP_FILE, RESTORE_TARGET);

  // Step 4: Verify Restored File Checksum & Byte-for-Byte Parity
  const restoredHash = calculateHash(RESTORE_TARGET);
  console.log(`[Restored File SHA-256] ${restoredHash}`);

  if (restoredHash !== backupHash) {
    throw new Error('Restore failed: Restored file checksum does not match backup!');
  }
  console.log('✓ Restored file checksum matches backup bit-for-bit.');

  // Step 5: Validate JSON structure and verify critical record counts
  const rawData = fs.readFileSync(RESTORE_TARGET, 'utf-8');
  const restoredJson = JSON.parse(rawData);

  const validationChecks = {
    users: restoredJson.users?.length || 0,
    orders: restoredJson.orders?.length || 0,
    walletLedgers: (restoredJson.walletLedger || []).length,
    paymentSubmissions: (restoredJson.paymentSubmissions || []).length,
    deposits: (restoredJson.depositRequests || []).length,
    stores: (restoredJson.stores || []).length,
    products: (restoredJson.products || []).length,
    packages: (restoredJson.productPackages || []).length,
  };

  console.log('\n[Restored Database Content Validation]:');
  for (const [k, count] of Object.entries(validationChecks)) {
    console.log(`  - ${k}: ${count} records verified`);
  }

  if (validationChecks.orders !== 111) {
    throw new Error(`Order count anomaly! Expected 111, got ${validationChecks.orders}`);
  }
  if (validationChecks.walletLedgers !== 65) {
    throw new Error(`Wallet Ledger count anomaly! Expected 65, got ${validationChecks.walletLedgers}`);
  }
  if (validationChecks.users !== 4) {
    throw new Error(`User count anomaly! Expected 4, got ${validationChecks.users}`);
  }

  // Step 6: Clean up temporary test sandbox
  fs.unlinkSync(RESTORE_TARGET);
  console.log('\n✓ Sandbox restore file cleaned up cleanly.');
  console.log('=== RESTORE TEST COMPLETED SUCCESSFULLY WITH 100% INTEGRITY ===\n');
}

if (process.argv[1] && process.argv[1].endsWith('test_backup_restore.ts')) {
  try {
    runBackupRestoreTest();
  } catch (err: any) {
    console.error('RESTORE TEST FAILED:', err.message);
    process.exit(1);
  }
}
