/**
 * DigiMarket Notification Engine Integration Test Suite
 * Validates Real Email/SMTP Dispatcher, Meta WhatsApp Cloud API Dispatcher,
 * Delivery Status Webhooks, Phone Normalization, and Durable Outbox Lifecycle.
 */

import { db } from '../db/store.ts';
import {
  normalizePhoneNumber,
  enqueueNotification,
  processOutboxItem,
  retryNotification,
  verifyWhatsAppWebhook,
  processWhatsAppWebhookPayload,
  processEmailWebhookPayload,
  notifyMultiChannel,
} from '../services/notifications.ts';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runNotificationTests() {
  console.log('--- STARTING NOTIFICATION ENGINE TEST SUITE ---\n');

  // Test 1: Phone number normalization
  try {
    const bdLocal = normalizePhoneNumber('01711223344');
    assert(bdLocal === '8801711223344', `Expected 8801711223344, got ${bdLocal}`);

    const bdPlus = normalizePhoneNumber('+8801811223344');
    assert(bdPlus === '8801811223344', `Expected 8801811223344, got ${bdPlus}`);

    const formatted = normalizePhoneNumber('+880 (19) 11-22-33-44');
    assert(formatted === '8801911223344', `Expected 8801911223344, got ${formatted}`);

    results.push({ num: 1, name: 'Phone number normalization for WhatsApp & SMS', passed: true });
  } catch (err: any) {
    results.push({ num: 1, name: 'Phone number normalization for WhatsApp & SMS', passed: false, message: err.message });
  }

  // Test 2: Outbox item creation & idempotency
  try {
    const contact = `test_${Date.now()}@example.com`;
    const item1 = enqueueNotification({
      recipientType: 'customer',
      recipientContact: contact,
      channel: 'email',
      eventType: 'TEST_IDEMP_EVENT',
      title: 'Order Confirmation',
      bodyText: 'Your order was received.',
    });

    assert(item1.status === 'queued' || item1.status === 'processing' || item1.status === 'not_configured', 'Valid initial status');

    // Immediate second enqueue with same event and contact should return identical item (idempotency)
    const item2 = enqueueNotification({
      recipientType: 'customer',
      recipientContact: contact,
      channel: 'email',
      eventType: 'TEST_IDEMP_EVENT',
      title: 'Order Confirmation',
      bodyText: 'Your order was received.',
    });

    assert(item1.id === item2.id, 'Idempotent duplicate enqueue must not create a duplicate record');
    results.push({ num: 2, name: 'Outbox creation and duplicate enqueue idempotency', passed: true });
  } catch (err: any) {
    results.push({ num: 2, name: 'Outbox creation and duplicate enqueue idempotency', passed: false, message: err.message });
  }

  // Test 3: Email Dispatcher honest status when credentials unconfigured
  try {
    const item = enqueueNotification({
      recipientType: 'customer',
      recipientContact: 'recipient@test.com',
      channel: 'email',
      eventType: 'EMAIL_TEST_EVENT',
      title: 'Test Email',
      bodyText: 'Email body text.',
    });

    const processed = await processOutboxItem(item.id);
    assert(!!processed, 'Item should be returned');

    if (!process.env.MAIL_USER && !process.env.GMAIL_USER) {
      assert(processed!.status === 'not_configured', `Expected 'not_configured' status, got '${processed!.status}'`);
      assert(Boolean(processed!.errorMessage?.includes('EMAIL_CONFIG_MISSING')), 'Error message must specify missing config');
    }

    results.push({ num: 3, name: 'Email Dispatcher honest status reporting (No fake success)', passed: true });
  } catch (err: any) {
    results.push({ num: 3, name: 'Email Dispatcher honest status reporting (No fake success)', passed: false, message: err.message });
  }

  // Test 4: WhatsApp Dispatcher honest status when credentials unconfigured
  try {
    const item = enqueueNotification({
      recipientType: 'customer',
      recipientContact: '01811223344',
      channel: 'whatsapp',
      eventType: 'WA_TEST_EVENT',
      title: 'WhatsApp Alert',
      bodyText: 'Order #ORD-123 is approved.',
    });

    const processed = await processOutboxItem(item.id);
    assert(!!processed, 'Item should be returned');

    if (!process.env.WHATSAPP_API_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      assert(processed!.status === 'not_configured', `Expected 'not_configured' status, got '${processed!.status}'`);
      assert(Boolean(processed!.errorMessage?.includes('WHATSAPP_CONFIG_MISSING')), 'Error message must specify missing config');
    }

    results.push({ num: 4, name: 'WhatsApp Dispatcher honest status reporting (No fake success)', passed: true });
  } catch (err: any) {
    results.push({ num: 4, name: 'WhatsApp Dispatcher honest status reporting (No fake success)', passed: false, message: err.message });
  }

  // Test 5: WhatsApp Webhook Challenge Verification (GET)
  try {
    const testVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'digimarket_wa_verify_token';
    const challengeResult = verifyWhatsAppWebhook('subscribe', testVerifyToken, 'CHALLENGE_CODE_98765');
    assert(challengeResult === 'CHALLENGE_CODE_98765', 'Valid webhook challenge must be returned');

    let invalidBlocked = false;
    try {
      verifyWhatsAppWebhook('subscribe', 'WRONG_TOKEN', 'CHALLENGE_CODE_98765');
    } catch {
      invalidBlocked = true;
    }
    assert(invalidBlocked, 'Invalid token must be rejected');

    results.push({ num: 5, name: 'Meta WhatsApp Webhook verification handshake (hub.challenge)', passed: true });
  } catch (err: any) {
    results.push({ num: 5, name: 'Meta WhatsApp Webhook verification handshake (hub.challenge)', passed: false, message: err.message });
  }

  // Test 6: WhatsApp Webhook Delivery Status Callback (POST)
  try {
    // Seed an item with a known providerMessageId
    const testWamid = `wamid.TEST_${Date.now()}`;
    const testItem = enqueueNotification({
      recipientType: 'customer',
      recipientContact: '01711998877',
      channel: 'whatsapp',
      eventType: 'ORDER_DELIVERED',
      title: 'Delivery Notice',
      bodyText: 'License key ready.',
    });
    testItem.status = 'sent';
    testItem.providerMessageId = testWamid;
    db.persist();

    // Simulate Meta webhook callback with status 'delivered'
    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_12345',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '12345', phone_number_id: '67890' },
                statuses: [
                  {
                    id: testWamid,
                    status: 'delivered',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    recipient_id: '8801711998877',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const webhookResult = processWhatsAppWebhookPayload(metaPayload);
    assert(webhookResult.processedCount === 1, `Expected 1 processed update, got ${webhookResult.processedCount}`);

    const updatedItem = db.notificationOutbox.find((n) => n.id === testItem.id);
    assert(updatedItem?.status === 'delivered', `Expected status 'delivered', got '${updatedItem?.status}'`);

    results.push({ num: 6, name: 'Meta WhatsApp Webhook delivery status update (sent -> delivered)', passed: true });
  } catch (err: any) {
    results.push({ num: 6, name: 'Meta WhatsApp Webhook delivery status update (sent -> delivered)', passed: false, message: err.message });
  }

  // Test 7: Email Webhook Delivery / Bounce Callback (POST)
  try {
    const testEmailMsgId = `<email_${Date.now()}@smtp.digimarket.com>`;
    const testItem = enqueueNotification({
      recipientType: 'customer',
      recipientContact: 'user@test.com',
      channel: 'email',
      eventType: 'ORDER_DELIVERED',
      title: 'Email Delivery',
      bodyText: 'Email body.',
    });
    testItem.status = 'sent';
    testItem.providerMessageId = testEmailMsgId;
    db.persist();

    // Process delivery webhook
    const emailDeliveryPayload = {
      messageId: testEmailMsgId,
      event: 'delivered',
    };
    const result = processEmailWebhookPayload(emailDeliveryPayload);
    assert(result.processed, 'Payload should be processed');

    const updatedItem = db.notificationOutbox.find((n) => n.id === testItem.id);
    assert(updatedItem?.status === 'delivered', `Expected status 'delivered', got '${updatedItem?.status}'`);

    results.push({ num: 7, name: 'Transactional Email delivery webhook callback update', passed: true });
  } catch (err: any) {
    results.push({ num: 7, name: 'Transactional Email delivery webhook callback update', passed: false, message: err.message });
  }

  // Test 8: Multi-channel dispatch helper
  try {
    const multiItems = notifyMultiChannel({
      recipientType: 'customer',
      email: 'customer@gmail.com',
      phone: '01811223344',
      eventType: 'ORDER_ADMIN_APPROVED',
      title: 'Order Approved',
      bodyText: 'Your order was approved by Main Admin.',
      channels: ['email', 'whatsapp'],
    });

    assert(multiItems.length === 2, `Expected 2 notifications, got ${multiItems.length}`);
    assert(multiItems.some((i) => i.channel === 'email'), 'Email channel item must exist');
    assert(multiItems.some((i) => i.channel === 'whatsapp'), 'WhatsApp channel item must exist');

    results.push({ num: 8, name: 'Multi-channel dispatch (Simultaneous Email and WhatsApp enqueuing)', passed: true });
  } catch (err: any) {
    results.push({ num: 8, name: 'Multi-channel dispatch (Simultaneous Email and WhatsApp enqueuing)', passed: false, message: err.message });
  }

  // Test 9: Notification Retry Logic & Attempt increment
  try {
    const retryItem = enqueueNotification({
      recipientType: 'admin',
      recipientContact: 'admin@digimarket.com',
      channel: 'email',
      eventType: 'RETRY_TEST_EVENT',
      title: 'Admin Alert',
      bodyText: 'Retry test.',
    });
    retryItem.status = 'failed';
    retryItem.attempts = 1;
    db.persist();

    const retried = retryNotification(retryItem.id);
    assert(retried.status === 'queued', `Expected status 'queued' after retry, got '${retried.status}'`);

    results.push({ num: 9, name: 'Notification retry logic and status transition', passed: true });
  } catch (err: any) {
    results.push({ num: 9, name: 'Notification retry logic and status transition', passed: false, message: err.message });
  }

  // Test 10: Security & Masking - No passwords or secrets in outbox logs
  try {
    const allOutbox = db.notificationOutbox;
    const leakedSecrets = allOutbox.some(
      (n) =>
        (n.bodyText && n.bodyText.includes(process.env.WHATSAPP_API_TOKEN || 'SECRET_NEVER_FOUND')) ||
        (n.bodyText && n.bodyText.includes(process.env.MAIL_PASSWORD || 'SECRET_NEVER_FOUND'))
    );
    assert(!leakedSecrets, 'Sensitive API tokens or passwords must never appear in outbox body');

    results.push({ num: 10, name: 'Sensitive credentials protection and zero secret leakage in logs', passed: true });
  } catch (err: any) {
    results.push({ num: 10, name: 'Sensitive credentials protection and zero secret leakage in logs', passed: false, message: err.message });
  }

  // Summary
  console.log('--- NOTIFICATION TEST RESULTS ---');
  let passCount = 0;
  for (const r of results) {
    if (r.passed) {
      passCount++;
      console.log(`[PASS] Test ${r.num}: ${r.name}`);
    } else {
      console.error(`[FAIL] Test ${r.num}: ${r.name} - ${r.message}`);
    }
  }
  console.log(`\nTOTAL: ${passCount}/${results.length} PASSED.`);
}

runNotificationTests().catch(console.error);
