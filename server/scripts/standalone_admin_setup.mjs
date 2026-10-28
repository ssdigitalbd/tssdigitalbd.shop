#!/usr/bin/env node

/**
 * DigiMarket Standalone Secure Admin Setup Script
 * 
 * Run this script on your LOCAL machine in an interactive terminal:
 *   node server/scripts/standalone_admin_setup.mjs [optional/path/to/db.json]
 * 
 * Features:
 * - Hidden/masked interactive password input via process.stdin (TTY).
 * - Automatic safety backup with SHA-256 integrity verification.
 * - Enforces bcrypt cost factor 12.
 * - Protects all business records, relations, and financial invariants:
 *   specifically ensures usr_reseller_01 balance (৳5,850) and ৳5,900 ledger discrepancy are untouched.
 * - Atomic write with fsync and temp-file renaming.
 * - Never prints plaintext password or exposes it to logs or git.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const TARGET_USER_ID = 'usr_admin_01';
const AUTHORIZED_ADMIN_EMAIL = 'ts5753106s@gmail.com';
const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

// Compute SHA-256 hash of a file
function getFileSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Prompt for masked password input in an interactive terminal
function promptMaskedPassword(promptLabel) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return reject(
        new Error(
          'NON_TTY_ENVIRONMENT: process.stdin.isTTY is false. ' +
          'This script MUST be run in an interactive terminal (PowerShell, Command Prompt, macOS Terminal, or Linux Bash).'
        )
      );
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    process.stdout.write(promptLabel);

    let password = '';
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();

    const onData = (buffer) => {
      const char = buffer.toString('utf8');

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n[ABORTED] Operation cancelled by user.\n');
          process.exit(130);
          break;
        case '\u0008': // Backspace
        case '\x7f': // Delete
          if (password.length > 0) {
            password = password.slice(0, -1);
            // Erase character from terminal
            process.stdout.write('\b \b');
          }
          break;
        default:
          // Ignore control sequences like arrow keys
          if (char.charCodeAt(0) >= 32) {
            password += char;
            process.stdout.write('*');
          }
          break;
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  console.log('=====================================================');
  console.log('       DigiMarket Standalone Admin Setup Script       ');
  console.log('=====================================================\n');

  // Step 1: Environment & TTY Validation
  if (!process.stdin.isTTY) {
    console.error('[CRITICAL ERROR] NON_TTY_ENVIRONMENT detected.');
    console.error('This script is specifically designed to run on your local computer');
    console.error('where an interactive terminal (TTY) is directly attached to the keyboard.\n');
    console.error('Usage on your local machine:');
    console.error('  node server/scripts/standalone_admin_setup.mjs [path-to-db.json]\n');
    process.exit(1);
  }

  // Step 2: Determine Target DB Path
  const argPath = process.argv[2];
  const targetDbPath = argPath
    ? path.resolve(process.cwd(), argPath)
    : path.resolve(process.cwd(), '.data/db.json');

  console.log(`[INFO] Target database file: ${targetDbPath}`);

  if (!fs.existsSync(targetDbPath)) {
    console.error(`[ERROR] Database file not found at: ${targetDbPath}`);
    console.error('Please verify the path and make sure the file exists.');
    process.exit(1);
  }

  // Step 3: Parse and Validate Database Integrity
  let rawJson = '';
  let dbData = null;
  try {
    rawJson = fs.readFileSync(targetDbPath, 'utf8');
    dbData = JSON.parse(rawJson);
  } catch (err) {
    console.error(`[ERROR] Failed to parse target JSON database: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(dbData.users)) {
    console.error('[ERROR] Invalid database schema: "users" array is missing.');
    process.exit(1);
  }

  // Step 4: Verify Target Admin Account
  const adminIndex = dbData.users.findIndex((u) => u.id === TARGET_USER_ID);
  if (adminIndex === -1) {
    console.error(`[ERROR] Admin user with ID "${TARGET_USER_ID}" not found in database.`);
    process.exit(1);
  }

  const adminUser = dbData.users[adminIndex];
  if (adminUser.role !== 'admin') {
    console.error(`[ERROR] User "${TARGET_USER_ID}" role is "${adminUser.role}", expected "admin". Aborting.`);
    process.exit(1);
  }

  console.log('\n--- Current Admin User Details ---');
  console.log(`User ID:        ${adminUser.id}`);
  console.log(`Current Email:  ${adminUser.email}`);
  console.log(`Full Name:      ${adminUser.fullName}`);
  console.log(`Role:           ${adminUser.role}`);
  console.log(`Status:         ${adminUser.status}`);
  console.log(`Last Updated:   ${adminUser.updatedAt}`);

  // Step 5: Check Financial Invariants
  const initialSha256 = getFileSha256(targetDbPath);
  console.log(`\nInitial DB SHA-256: ${initialSha256}`);

  const resellerWallet = dbData.resellerWallets?.find((w) => w.resellerId === 'usr_reseller_01');
  if (resellerWallet) {
    console.log(`[INVARIANT] Reseller usr_reseller_01 Wallet Balance: ৳${resellerWallet.availableBalanceBdt}`);
    if (Array.isArray(dbData.walletLedger)) {
      const ledgers = dbData.walletLedger.filter((l) => l.resellerId === 'usr_reseller_01');
      let calculated = 0;
      for (const e of ledgers) {
        if (['deposit_credit', 'bonus_credit', 'order_reversal_credit', 'adjustment_credit'].includes(e.entryType)) {
          calculated += e.amountBdt;
        } else if (['order_wholesale_debit', 'bonus_reversal_debit', 'adjustment_debit'].includes(e.entryType)) {
          calculated -= e.amountBdt;
        }
      }
      calculated = Math.round(calculated * 100) / 100;
      const discrepancy = Math.round((calculated - resellerWallet.availableBalanceBdt) * 100) / 100;
      console.log(`[INVARIANT] Ledger Calculated: ৳${calculated} | Discrepancy: ৳${discrepancy} (Must remain intact)`);
    }
  }

  // Step 6: Create Automatic Timestamped Pre-Update Backup
  const backupPath = `${targetDbPath}.pre_admin_setup_${Date.now()}.bak`;
  console.log(`\nCreating safety backup at:\n  ${backupPath}`);
  fs.copyFileSync(targetDbPath, backupPath);

  const backupSha256 = getFileSha256(backupPath);
  if (backupSha256 !== initialSha256) {
    console.error('[CRITICAL ERROR] Backup verification failed: SHA-256 checksum does not match!');
    fs.unlinkSync(backupPath);
    process.exit(1);
  }
  console.log(`[SUCCESS] Backup verified with matching SHA-256.`);

  // Step 7: Prompt for Password (Masked with Confirmation)
  console.log('\n--- Credentials Update ---');
  console.log(`Target Email: ${AUTHORIZED_ADMIN_EMAIL}`);
  console.log('Please enter your chosen password (input will be masked with *):\n');

  let password = '';
  while (true) {
    password = await promptMaskedPassword('Enter New Password (min 8 characters): ');
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.log(`\n[WARNING] Password must be at least ${MIN_PASSWORD_LENGTH} characters. Please try again.\n`);
      continue;
    }

    const confirmPassword = await promptMaskedPassword('Confirm New Password: ');
    if (password !== confirmPassword) {
      console.log('\n[WARNING] Passwords did not match. Please try again.\n');
      continue;
    }

    break;
  }

  // Step 8: Hash Password with bcrypt cost factor 12
  console.log(`\nHashing password using bcrypt (cost factor ${BCRYPT_ROUNDS})...`);
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  // Clear memory
  password = '';

  // Step 9: Update usr_admin_01 In-Memory
  adminUser.email = AUTHORIZED_ADMIN_EMAIL.trim().toLowerCase();
  adminUser.passwordHash = passwordHash;
  adminUser.updatedAt = new Date().toISOString();

  // Re-verify reseller wallet was not touched
  if (resellerWallet && resellerWallet.availableBalanceBdt !== 5850) {
    console.error('[CRITICAL] Invariant violation detected before write! Aborting.');
    process.exit(1);
  }

  // Step 10: Atomic Write
  const tmpPath = `${targetDbPath}.tmp.${Date.now()}`;
  console.log('Writing updated database atomically...');
  const serialized = JSON.stringify(dbData, null, 2);
  
  const fd = fs.openSync(tmpPath, 'w');
  fs.writeFileSync(fd, serialized, 'utf8');
  fs.fsyncSync(fd);
  fs.closeSync(fd);

  fs.renameSync(tmpPath, targetDbPath);

  // Step 11: Post-Update Verification
  const postSha256 = getFileSha256(targetDbPath);
  const reReadDb = JSON.parse(fs.readFileSync(targetDbPath, 'utf8'));
  const updatedAdmin = reReadDb.users.find((u) => u.id === TARGET_USER_ID);

  console.log('\n=====================================================');
  console.log('        Admin Account Successfully Updated!          ');
  console.log('=====================================================');
  console.log(`User ID:          ${updatedAdmin.id}`);
  console.log(`Email:            ${updatedAdmin.email}`);
  console.log(`Role:             ${updatedAdmin.role}`);
  console.log(`Status:           ${updatedAdmin.status}`);
  console.log(`Updated At:       ${updatedAdmin.updatedAt}`);
  console.log(`Hash Format:      bcrypt ($2b$12$)`);
  console.log(`Backup Location:  ${backupPath}`);
  console.log(`New DB SHA-256:   ${postSha256}`);
  console.log('=====================================================\n');
  console.log('You may now log in at /admin using your authorized email and new password.');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]:', err.message || err);
  process.exit(1);
});
