-- ============================================================================
-- DIGIMARKET PRODUCTION MYSQL 8+ DATABASE SCHEMA & DDL
-- Multi-Tenant Digital Marketplace, Reseller Stores, Wholesale Ledger & Fulfillment
-- ============================================================================

CREATE DATABASE IF NOT EXISTS digimarket_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE digimarket_db;

-- ----------------------------------------------------------------------------
-- 1. USERS, ROLES & SESSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    role ENUM('customer', 'reseller', 'admin') NOT NULL DEFAULT 'customer',
    status ENUM('active', 'pending_kyc', 'suspended', 'disabled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role_status (role, status),
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. RESELLER APPLICATIONS & STORES (SUBDOMAINS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reseller_applications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    business_name VARCHAR(150) NOT NULL,
    requested_subdomain VARCHAR(63) NOT NULL UNIQUE,
    trade_license_number VARCHAR(100),
    national_id_number VARCHAR(50) NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    emergency_contact VARCHAR(32),
    address TEXT NOT NULL,
    status ENUM('pending', 'under_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by VARCHAR(36),
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_app_subdomain (requested_subdomain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kyc_documents (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL,
    document_type ENUM('nid_front', 'nid_back', 'trade_license', 'utility_bill', 'bank_statement') NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size_bytes INT NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    verification_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES reseller_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(36) PRIMARY KEY,
    reseller_id VARCHAR(36) NOT NULL UNIQUE,
    store_name VARCHAR(150) NOT NULL,
    subdomain VARCHAR(63) NOT NULL UNIQUE,
    status ENUM('active', 'suspended', 'disabled', 'maintenance') NOT NULL DEFAULT 'active',
    logo_url VARCHAR(255),
    banner_url VARCHAR(255),
    support_phone VARCHAR(32),
    support_email VARCHAR(191),
    support_whatsapp VARCHAR(32),
    payment_instructions_bkash TEXT,
    payment_instructions_nagad TEXT,
    payment_instructions_rocket TEXT,
    custom_domain VARCHAR(191) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_store_subdomain (subdomain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS, PACKAGES & PRICING (DATABASE-DRIVEN)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    category_id VARCHAR(36) NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    tagline VARCHAR(255),
    description TEXT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    delivery_method ENUM('manual_credentials', 'instant_license_key', 'invite_link', 'direct_activation') NOT NULL DEFAULT 'manual_credentials',
    delivery_instructions TEXT,
    terms_and_conditions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    available_on_main_store BOOLEAN DEFAULT TRUE,
    available_to_resellers BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_prod_status (is_active, available_on_main_store, available_to_resellers)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_packages (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    duration_label VARCHAR(60) NOT NULL,
    duration_days INT NOT NULL,
    retail_price_bdt DECIMAL(12,2) NOT NULL,
    reseller_wholesale_cost_bdt DECIMAL(12,2) NOT NULL,
    stock_count INT DEFAULT -1, -- -1 = unlimited
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_package_active (product_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. RESELLER WALLETS, IMMUTABLE LEDGER & DEPOSITS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reseller_wallets (
    reseller_id VARCHAR(36) PRIMARY KEY,
    available_balance_bdt DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    locked_balance_bdt DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_deposited_bdt DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_spent_bdt DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_bonus_bdt DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_wallet_non_negative CHECK (available_balance_bdt >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_ledger (
    id VARCHAR(36) PRIMARY KEY,
    reseller_id VARCHAR(36) NOT NULL,
    reference_id VARCHAR(100) NOT NULL UNIQUE,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    entry_type ENUM('deposit_credit', 'order_wholesale_debit', 'order_reversal_credit', 'bonus_credit', 'bonus_reversal_debit', 'adjustment_credit', 'adjustment_debit') NOT NULL,
    amount_bdt DECIMAL(12,2) NOT NULL,
    balance_before_bdt DECIMAL(12,2) NOT NULL,
    balance_after_bdt DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    order_id VARCHAR(36),
    bonus_id VARCHAR(36),
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_ledger_reseller_time (reseller_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deposit_requests (
    id VARCHAR(36) PRIMARY KEY,
    reseller_id VARCHAR(36) NOT NULL,
    method ENUM('bkash_merchant', 'nagad_merchant', 'rocket_merchant', 'bank_transfer') NOT NULL,
    claimed_amount_bdt DECIMAL(12,2) NOT NULL,
    transaction_reference VARCHAR(100) NOT NULL UNIQUE,
    sender_account_number VARCHAR(50) NOT NULL,
    deposit_slip_url VARCHAR(255),
    status ENUM('pending', 'verified_approved', 'rejected') NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by VARCHAR(36),
    reviewed_at TIMESTAMP NULL,
    ledger_entry_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (ledger_entry_id) REFERENCES wallet_ledger(id) ON DELETE SET NULL,
    INDEX idx_deposit_status (status),
    INDEX idx_deposit_txn (transaction_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. RESELLER BONUSES & REVERSALS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reseller_bonuses (
    id VARCHAR(36) PRIMARY KEY,
    reseller_id VARCHAR(36) NOT NULL,
    bonus_type ENUM('manual_bonus', 'campaign_bonus', 'welcome_bonus', 'performance_bonus', 'adjustment_credit') NOT NULL,
    amount_bdt DECIMAL(12,2) NOT NULL,
    campaign_name VARCHAR(150),
    reason TEXT NOT NULL,
    reference_code VARCHAR(100) NOT NULL UNIQUE,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    status ENUM('approved_and_credited', 'pending_second_approval', 'reversed', 'rejected') NOT NULL DEFAULT 'approved_and_credited',
    created_by VARCHAR(36) NOT NULL,
    second_approver_id VARCHAR(36),
    ledger_entry_id VARCHAR(36),
    reversal_ledger_entry_id VARCHAR(36),
    reversal_reason TEXT,
    reversed_at TIMESTAMP NULL,
    reversed_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (second_approver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (ledger_entry_id) REFERENCES wallet_ledger(id) ON DELETE SET NULL,
    FOREIGN KEY (reversal_ledger_entry_id) REFERENCES wallet_ledger(id) ON DELETE SET NULL,
    INDEX idx_bonus_reseller (reseller_id),
    INDEX idx_bonus_type (bonus_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. ORDERS, PRICE SNAPSHOTS, PAYMENT SUBMISSIONS & AUDIT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    order_number VARCHAR(32) NOT NULL UNIQUE,
    order_source ENUM('main_store', 'reseller_store') NOT NULL,
    store_id VARCHAR(36), -- NULL for main store
    reseller_id VARCHAR(36), -- NULL for main store
    customer_id VARCHAR(36),
    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(191) NOT NULL,
    customer_phone VARCHAR(32) NOT NULL,
    
    -- Immutable Historical Product Snapshot
    product_id VARCHAR(36) NOT NULL,
    package_id VARCHAR(36) NOT NULL,
    snapshot_product_name VARCHAR(150) NOT NULL,
    snapshot_package_name VARCHAR(120) NOT NULL,
    snapshot_duration_days INT NOT NULL,
    snapshot_retail_price_bdt DECIMAL(12,2) NOT NULL,
    snapshot_wholesale_cost_bdt DECIMAL(12,2) NOT NULL,
    snapshot_delivery_method VARCHAR(64) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    
    -- Status progression
    order_status ENUM(
        'payment_submitted',
        'payment_verified',
        'payment_rejected',
        'wallet_pending',
        'pending_admin_approval',
        'admin_approved',
        'admin_rejected',
        'queued_for_delivery',
        'delivery_in_progress',
        'completed',
        'failed',
        'cancelled',
        'refund_in_review',
        'refunded'
    ) NOT NULL DEFAULT 'payment_submitted',
    
    -- Financial tracking
    wallet_debited BOOLEAN DEFAULT FALSE,
    wallet_debit_ledger_id VARCHAR(36),
    wallet_reversal_ledger_id VARCHAR(36),
    
    -- Customer requirements & notes
    customer_input_notes TEXT,
    admin_notes TEXT,
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
    FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (package_id) REFERENCES product_packages(id) ON DELETE RESTRICT,
    FOREIGN KEY (wallet_debit_ledger_id) REFERENCES wallet_ledger(id) ON DELETE SET NULL,
    FOREIGN KEY (wallet_reversal_ledger_id) REFERENCES wallet_ledger(id) ON DELETE SET NULL,
    INDEX idx_order_number (order_number),
    INDEX idx_order_source_status (order_source, order_status),
    INDEX idx_order_reseller (reseller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_submissions (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    channel ENUM('bkash', 'nagad', 'rocket', 'bank_transfer', 'sslcommerz_gateway') NOT NULL,
    claimed_amount_bdt DECIMAL(12,2) NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,
    sender_phone_or_account VARCHAR(50) NOT NULL,
    recipient_account_snapshot VARCHAR(50) NOT NULL,
    screenshot_proof_url VARCHAR(255),
    verification_status ENUM('submitted', 'verified_valid', 'rejected_invalid', 'duplicate_flagged') NOT NULL DEFAULT 'submitted',
    verified_by_user_id VARCHAR(36),
    verified_at TIMESTAMP NULL,
    verification_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    -- Unique within channel and recipient store to avoid false cross-tenant clashes
    UNIQUE KEY uq_channel_txn_recipient (channel, transaction_id, recipient_account_snapshot),
    INDEX idx_payment_order (order_id),
    INDEX idx_payment_txn (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deliveries (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL UNIQUE,
    fulfillment_method ENUM('manual_credentials', 'instant_license_key', 'invite_link', 'direct_activation') NOT NULL,
    fulfillment_payload TEXT, -- Encrypted credentials or key
    instructions_for_customer TEXT NOT NULL,
    state ENUM('not_started', 'queued', 'in_progress', 'awaiting_provider', 'completed', 'failed', 'cancelled', 'manual_review') NOT NULL DEFAULT 'not_started',
    attempts_count INT DEFAULT 0,
    operator_user_id VARCHAR(36),
    provider_reference VARCHAR(150),
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. NOTIFICATIONS (OUTBOX PATTERN, SMS, EMAIL, WHATSAPP)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_outbox (
    id VARCHAR(36) PRIMARY KEY,
    recipient_type ENUM('customer', 'reseller', 'admin') NOT NULL,
    recipient_contact VARCHAR(191) NOT NULL, -- Email or phone
    channel ENUM('email', 'sms', 'whatsapp') NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body_text TEXT NOT NULL,
    metadata_json JSON,
    status ENUM('queued', 'processing', 'sent', 'delivered', 'failed', 'retry_scheduled', 'cancelled', 'not_configured') NOT NULL DEFAULT 'queued',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    provider_message_id VARCHAR(100),
    error_message TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_status (status, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. SYSTEM AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_user_id VARCHAR(36),
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_entity VARCHAR(64) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    details_json JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_action (action, target_entity),
    INDEX idx_audit_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
