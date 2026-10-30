<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Categories
        Schema::create('categories', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('name', 120);
            $table->string('slug', 120)->unique();
            $table->string('icon', 64)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 2. Products
        Schema::create('products', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('category_id', 64);
            $table->string('name', 150);
            $table->string('slug', 150)->unique();
            $table->string('tagline', 255)->nullable();
            $table->text('description')->nullable();
            $table->string('image_url', 255)->nullable();
            $table->enum('delivery_method', ['invite_link', 'license_key', 'credentials', 'activation'])->default('invite_link');
            $table->text('delivery_instructions')->nullable();
            $table->text('terms_and_conditions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('available_on_main_store')->default(true);
            $table->boolean('available_to_resellers')->default(true);
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
        });

        // 3. Product Packages
        Schema::create('product_packages', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('product_id', 64);
            $table->string('name', 150);
            $table->string('duration_label', 64);
            $table->integer('duration_days')->default(30);
            $table->decimal('retail_price_bdt', 12, 2);
            $table->decimal('reseller_wholesale_cost_bdt', 12, 2);
            $table->integer('stock_count')->default(-1); // -1 = unlimited
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });

        // 4. Update Users table for roles & status
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 32)->nullable()->after('email');
            $table->enum('role', ['customer', 'reseller', 'admin'])->default('customer')->after('phone');
            $table->enum('status', ['active', 'pending_kyc', 'suspended', 'disabled'])->default('active')->after('role');
            $table->index(['role', 'status']);
        });

        // 5. Reseller Applications
        Schema::create('reseller_applications', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->unsignedBigInteger('user_id');
            $table->string('business_name', 150);
            $table->string('requested_subdomain', 63)->unique();
            $table->string('trade_license_number', 100)->nullable();
            $table->string('national_id_number', 50);
            $table->string('contact_phone', 32);
            $table->string('emergency_contact', 32)->nullable();
            $table->text('address');
            $table->enum('status', ['pending', 'under_review', 'approved', 'rejected'])->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
        });

        // 6. KYC Documents
        Schema::create('kyc_documents', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('application_id', 64);
            $table->enum('document_type', ['nid_front', 'nid_back', 'trade_license', 'utility_bill', 'bank_statement']);
            $table->string('file_path', 255)->nullable();
            $table->string('original_filename', 255)->nullable();
            $table->integer('file_size_bytes')->default(0);
            $table->string('mime_type', 64)->nullable();
            $table->enum('verification_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->timestamps();

            $table->foreign('application_id')->references('id')->on('reseller_applications')->onDelete('cascade');
        });

        // 7. Reseller Stores (Subdomains & Custom Domains)
        Schema::create('stores', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->unsignedBigInteger('reseller_id')->unique();
            $table->string('store_name', 150);
            $table->string('subdomain', 63)->unique();
            $table->enum('status', ['active', 'suspended', 'disabled', 'maintenance'])->default('active');
            $table->string('logo_url', 255)->nullable();
            $table->string('support_phone', 32)->nullable();
            $table->string('support_email', 191)->nullable();
            $table->string('support_whatsapp', 32)->nullable();
            $table->text('payment_instructions_bkash')->nullable();
            $table->text('payment_instructions_nagad')->nullable();
            $table->text('payment_instructions_rocket')->nullable();
            $table->string('custom_domain', 191)->nullable()->unique();
            $table->timestamps();

            $table->foreign('reseller_id')->references('id')->on('users')->onDelete('cascade');
        });

        // 8. Reseller Wallets
        Schema::create('reseller_wallets', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->unsignedBigInteger('reseller_id')->unique();
            $table->decimal('available_balance_bdt', 12, 2)->default(0.00);
            $table->decimal('locked_balance_bdt', 12, 2)->default(0.00);
            $table->decimal('total_deposited_bdt', 12, 2)->default(0.00);
            $table->decimal('total_spent_bdt', 12, 2)->default(0.00);
            $table->decimal('total_bonus_bdt', 12, 2)->default(0.00);
            $table->timestamps();

            $table->foreign('reseller_id')->references('id')->on('users')->onDelete('cascade');
        });

        // 9. Immutable Wallet Ledger
        Schema::create('wallet_ledger', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->unsignedBigInteger('reseller_id');
            $table->string('reference_id', 100);
            $table->string('idempotency_key', 120)->unique();
            $table->enum('entry_type', [
                'deposit_credit',
                'order_wholesale_debit',
                'order_reversal_credit',
                'bonus_credit',
                'bonus_reversal_debit',
                'adjustment_credit',
                'adjustment_debit'
            ]);
            $table->decimal('amount_bdt', 12, 2);
            $table->decimal('balance_before_bdt', 12, 2);
            $table->decimal('balance_after_bdt', 12, 2);
            $table->text('reason');
            $table->string('order_id', 64)->nullable();
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->timestamps();

            $table->foreign('reseller_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['reseller_id', 'created_at']);
        });

        // 10. Deposit Requests
        Schema::create('deposit_requests', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->unsignedBigInteger('reseller_id');
            $table->string('method', 50); // bkash_merchant, nagad, rocket
            $table->decimal('claimed_amount_bdt', 12, 2);
            $table->string('transaction_reference', 100);
            $table->string('sender_account_number', 50);
            $table->enum('status', ['pending', 'verified_approved', 'rejected'])->default('pending');
            $table->text('admin_notes')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->foreign('reseller_id')->references('id')->on('users')->onDelete('cascade');
        });

        // 11. Reseller Bonuses
        Schema::create('reseller_bonuses', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->unsignedBigInteger('reseller_id');
            $table->decimal('amount_bdt', 12, 2);
            $table->string('reason', 255);
            $table->enum('status', ['granted', 'reversed'])->default('granted');
            $table->string('reference_id', 100);
            $table->string('idempotency_key', 120)->unique();
            $table->unsignedBigInteger('granted_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('reseller_id')->references('id')->on('users')->onDelete('cascade');
        });

        // 12. Orders
        Schema::create('orders', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('order_number', 64)->unique();
            $table->enum('order_source', ['main_store', 'reseller_store']);
            $table->string('store_id', 64)->nullable();
            $table->unsignedBigInteger('reseller_id')->nullable();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('customer_name', 120);
            $table->string('customer_email', 191);
            $table->string('customer_phone', 32);
            $table->string('product_id', 64);
            $table->string('package_id', 64);
            $table->string('snapshot_product_name', 150);
            $table->string('snapshot_package_name', 150);
            $table->integer('snapshot_duration_days')->default(30);
            $table->decimal('snapshot_retail_price_bdt', 12, 2);
            $table->decimal('snapshot_wholesale_cost_bdt', 12, 2);
            $table->string('snapshot_delivery_method', 64);
            $table->string('currency', 8)->default('BDT');
            $table->enum('order_status', [
                'created',
                'payment_pending',
                'payment_submitted',
                'payment_rejected',
                'wallet_pending',
                'pending_admin_approval',
                'admin_approved',
                'admin_rejected',
                'queued_for_delivery',
                'delivery_in_progress',
                'completed',
                'cancelled',
                'refund_pending',
                'refunded'
            ])->default('created');
            $table->boolean('wallet_debited')->default(false);
            $table->string('wallet_debit_ledger_id', 64)->nullable();
            $table->string('wallet_reversal_ledger_id', 64)->nullable();
            $table->text('customer_input_notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['customer_email', 'order_status']);
            $table->index(['reseller_id', 'order_status']);
        });

        // 13. Payment Submissions
        Schema::create('payment_submissions', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('order_id', 64);
            $table->string('channel', 32); // bkash, nagad, rocket, sslcommerz
            $table->decimal('claimed_amount_bdt', 12, 2);
            $table->string('transaction_id', 100);
            $table->string('sender_phone_or_account', 50);
            $table->string('recipient_account_snapshot', 50);
            $table->string('screenshot_proof_url', 255)->nullable();
            $table->enum('verification_status', ['submitted', 'verified_valid', 'rejected_invalid'])->default('submitted');
            $table->unsignedBigInteger('verified_by_user_id')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->text('verification_notes')->nullable();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
            $table->unique(['channel', 'transaction_id', 'recipient_account_snapshot'], 'uq_pay_chan_txn_recip');
        });

        // 14. Deliveries
        Schema::create('deliveries', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('order_id', 64)->unique();
            $table->string('fulfillment_method', 64);
            $table->text('fulfillment_payload')->nullable(); // License key, credentials, or invite link
            $table->text('instructions_for_customer');
            $table->enum('state', ['not_started', 'queued', 'in_progress', 'completed', 'failed'])->default('not_started');
            $table->integer('attempts_count')->default(1);
            $table->unsignedBigInteger('operator_user_id')->nullable();
            $table->string('provider_reference', 150)->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });

        // 15. Notification Outbox
        Schema::create('notification_outbox', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->enum('recipient_type', ['customer', 'reseller', 'admin']);
            $table->string('recipient_contact', 191);
            $table->enum('channel', ['email', 'sms', 'whatsapp']);
            $table->string('event_type', 64);
            $table->string('title', 200);
            $table->text('body_text');
            $table->json('metadata_json')->nullable();
            $table->enum('status', ['queued', 'processing', 'sent', 'delivered', 'failed', 'retry_scheduled'])->default('queued');
            $table->integer('attempts')->default(0);
            $table->integer('max_attempts')->default(3);
            $table->string('provider_message_id', 100)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'channel']);
        });

        // 16. Audit Logs
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->unsignedBigInteger('actor_user_id')->nullable();
            $table->string('actor_role', 32);
            $table->string('action', 64);
            $table->string('target_entity', 64);
            $table->string('target_id', 64);
            $table->json('details_json')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['action', 'target_entity']);
        });

        // 17. Support Tickets
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('ticket_number', 64)->unique();
            $table->unsignedBigInteger('customer_id')->nullable();
            $table->string('customer_name', 120);
            $table->string('customer_email', 191);
            $table->string('order_id', 64)->nullable();
            $table->string('category', 64);
            $table->string('subject', 200);
            $table->text('description');
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->enum('status', ['open', 'in_progress', 'resolved', 'closed'])->default('open');
            $table->unsignedBigInteger('assigned_to_admin_id')->nullable();
            $table->timestamps();
        });

        // 18. Ticket Messages
        Schema::create('ticket_messages', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('ticket_id', 64);
            $table->string('sender_role', 32);
            $table->unsignedBigInteger('sender_id')->nullable();
            $table->string('sender_name', 120);
            $table->text('message_text');
            $table->json('attachments_json')->nullable();
            $table->timestamps();

            $table->foreign('ticket_id')->references('id')->on('support_tickets')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notification_outbox');
        Schema::dropIfExists('deliveries');
        Schema::dropIfExists('payment_submissions');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('reseller_bonuses');
        Schema::dropIfExists('deposit_requests');
        Schema::dropIfExists('wallet_ledger');
        Schema::dropIfExists('reseller_wallets');
        Schema::dropIfExists('stores');
        Schema::dropIfExists('kyc_documents');
        Schema::dropIfExists('reseller_applications');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['phone', 'role', 'status']);
        });
        Schema::dropIfExists('product_packages');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
