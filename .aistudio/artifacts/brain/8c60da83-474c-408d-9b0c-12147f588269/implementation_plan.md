# DigiMarket (`ssdigitalbd.shop`) — Master Production Implementation Plan
## Comprehensive Technical Revision with Customer Dashboard, Support Tickets & Evidence Vault (Section 14)

**লক্ষ্য:** বর্তমান Express ও React আর্কিটেকচার, প্রোডাক্ট ক্যাটালগ, প্যাকেজ, প্রাইসিং, অর্ডার, পেমেন্ট সাবমিশন, রিসেলার প্রাইসিং, ওয়ালেট ব্যালেন্স, লেজার হিস্ট্রি, রিফান্ড, নোটিফিকেশন এবং রিসেলার মাল্টি-টেন্যান্ট আইসোলেশন অক্ষত রেখে ধাপে ধাপে নিরাপত্তা, ডাটা পারসিস্টেন্স, প্রডাকশন সার্ভার, কাস্টমার সার্ভিস ড্যাশবোর্ড, সাপোর্ট টিকিট সিস্টেম এবং হোস্টিংগার ডোমেইন (`ssdigitalbd.shop`) কানেকশন বাস্তবায়ন করা।

> [!IMPORTANT]
> **বাধ্যতামূলক নীতি ও নো-চেঞ্জ গ্যারান্টি:**
> ১. এই পরিকল্পনা পর্যালোচনাকালীন কোনো সোর্স কোড বা কনফিগারেশন ফাইল পরিবর্তন করা হয়নি।
> ২. কোনো ডেটাবেস মাইগ্রেশন (যেমন Supabase/PostgreSQL) বা নতুন ডেটাবেস আর্কিটেকচার চাপানো হবে না; বর্তমান `.data/db.json` কাঠামোর ভেতরেই সেশন, টিকিট ও ডেটা পারসিস্টেন্স বজায় থাকবে।
> ৩. ব্যবহারকারীর স্পষ্ট অনুমোদন ছাড়া কোনো ধাপের কোড পরিবর্তন বা সিস্টেম কমান্ড কার্যকর করা হবে না।
> ৪. `.data/db.json`-এর অখণ্ডতা, ব্যাকআপ এবং ওয়ালেট লেজার রিকনসিলিয়েশন নিশ্চিত না করে কোনো লাইভ ট্রাফিকের অনুমতি দেওয়া হবে না।

---

## ১. অডিট: বিদ্যমান ফিচারের বর্তমান অবস্থা (Audit of Existing Capabilities)

| ফিচার / কম্পোনেন্ট | বর্তমান অবস্থা | টেকনিক্যাল প্রমাণ ও ফাইল রেফারেন্স | ঝুঁকি ও মূল্যায়ন |
| :--- | :--- | :--- | :--- |
| **Customer Dashboard & My Orders Page** | **Missing** | `/src/App.tsx`, `/src/components/Navbar.tsx` | কাস্টমারদের জন্য কোনো ডেডিকেটেড ড্যাশবোর্ড বা অর্ডার হিস্ট্রি পেজ নেই। কাস্টমার সেশনে ঢুকলেও সরাসরি `MainStore` দেখানো হয়। |
| **Order Tracker** | **Existing but incomplete & Security risk** | `/src/components/OrderTrackerModal.tsx`, `/server/api/routes.ts` (লাইন ৪৭৯–৫০৮) | শুধুমাত্র অর্ডার নম্বর দিয়ে সিঙ্গেল অর্ডার সার্চ হয়। মেয়াদ/স্টার্ট ডেট হিসাব নেই, টিকিট অপশন নেই এবং যে কারো কাছে আনরেডাক্টেড লাইসেন্স কি প্রকাশ করে। |
| **Support Ticket System** | **Missing** | `/server/types/index.ts`, `/server/api/routes.ts`, `/server/db/store.ts` | কোনো `SupportTicket` ডেটা মডেল নেই, কোনো API রাউট নেই এবং কোনো টিকিট সাবমিশন বা মেসেজ থ্রেড নেই। |
| **Screenshot / Attachment Upload** | **Missing** | `/src/components/ResellerApplicationModal.tsx` (লাইন ৫৩–৫৫) | বাস্তব কোনো ফাইল আপলোড মেকানিজম নেই; কেওয়াইসিতে হার্ডকোডেড বেইজ৬৪ স্ট্রিং মকআপ ব্যবহৃত হচ্ছে। কোনো MIME চেক বা ফাইল সেভ পাইপলাইন নেই। |
| **Secure File Storage & Access Control** | **Security risk / Missing** | `/server/db/store.ts` | শুধুমাত্র `.data/db.json` বিদ্যমান। অ্যাটাচমেন্টের জন্য কোনো প্রাইভেট, আন-গেসেবল, অথেনটিকেটেড স্টোরেজ নেই। |
| **Admin Ticket Management** | **Missing** | `/src/components/AdminPortal.tsx` (লাইন ৩৫–৩৭) | অ্যাডমিন কনসোলে ৭টি ট্যাব (`orders`, `bonuses`, `applications`, `deposits`, `notifications`, `catalog`, `ledger`) রয়েছে, টিকিট ম্যানেজমেন্টের কোনো ট্যাব নেই। |
| **Notification Integration** | **Existing and verified** | `/server/services/notifications.ts` | SMTP, WhatsApp Cloud API ও FastSMS সার্ভিস সম্পূর্ণ প্রস্তুত। কেবল টিকিট সংক্রান্ত নতুন ইভেন্ট যুক্ত করতে হবে। |

---

## ২. সিস্টেম আর্কিটেকচার ও ডেটা ফ্লো ডায়াগ্রাম

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             DIGIMARKET SECURE PRODUCTION ARCHITECTURE                          │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│  [Client / Browser: ssdigitalbd.shop & *.ssdigitalbd.shop]                                     │
│                           │ HTTPS (Port 443)                                                   │
│                           ▼                                                                    │
│  [Hosting Reverse Proxy / Hostinger / Cloudflare]                                              │
│         └── Injects X-Forwarded-For, X-Forwarded-Proto, Host                                   │
│                           │ HTTP (Port 3000 / Internal)                                        │
│                           ▼                                                                    │
│  [Production Server: server.js (Node.js 20+ Native ESM, Compiled via esbuild)]                 │
│         ├── trust proxy enabled (Reads client IP & Host header securely)                       │
│         ├── Host Normalizer (Differentiates ssdigitalbd.shop vs. reseller subdomains)          │
│         ├── Static File Middleware (Serves /dist production assets)                            │
│         └── SPA Wildcard Router (index.html fallback for client routes)                        │
│                           │                                                                    │
│         ┌─────────────────┴─────────────────┐                                                  │
│         ▼                                   ▼                                                  │
│  [/api/* Express Router]             [Static SPA Frontend]                                     │
│   ├── Crypto Session Validator        ├── Customer Portal (/my-services, /my-tickets)          │
│   ├── Strict Role Guard (RBAC)        ├── Admin Ticket Console (with internal notes)           │
│   ├── Delivery Credentials Redaction  └── Public Order Tracker (Redacted Payload)              │
│   ├── Evidence Vault Access Guard                                                              │
│   └── Webhook HMAC SHA-256 Validator                                                           │
│                           │                                                                    │
│         ┌─────────────────┴─────────────────┐                                                  │
│         ▼                                   ▼                                                  │
│  [Transactional Store: store.ts]     [Private Evidence Storage: .data/evidence/]               │
│   ├── In-Memory Database Cache        ├── UUID-Named Files (No PII, No guessable URLs)         │
│   ├── Mutex Write Serializer          ├── Server-Side MIME & Magic Bytes Validation            │
│   ├── Atomic Rename with fsync        └── Authenticated Streaming Route Only                   │
│   ├── Crash Recovery & Reconciler                                                              │
│   └── Persistent Store (.data/db.json)                                                         │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ৩. Section 14: Customer Dashboard, Support Tickets & Evidence Vault ডিজাইন

---

### A. Customer Order Details & My Services Page

#### ১. কাজের বিবরণ ও আর্কিটেকচার:
- প্রতিটি অথেন্টিকেটেড কাস্টমারের জন্য ডেডিকেটেড **My Orders / My Services** পেজ যুক্ত করা (`/my-services` অথবা Navbar ট্যাবে "My Account / Orders")।
- প্রতিটি অর্ডারের জন্য অথেনটিকেটেড ব্যাকএন্ড ডাটা থেকে স্বয়ংক্রিয়ভাবে হিসাবকৃত তথ্য প্রদর্শিত হবে:
  - 📦 **Service:** `{{service_name}}` (`order.snapshotProductName`)
  - 🕒 **Status:** `{{order_status}}`
  - 📅 **Purchase Date:** `{{purchase_date}}` (`order.createdAt`-এর লোকাল ফরম্যাটেড ডেট)
  - 🚀 **Service Start Date:** `{{service_start_date}}`
  - ⏳ **Service Duration:** `{{service_duration}}` (`order.snapshotDurationDays` দিন / durationLabel)
  - ⌛ **Expiry Date:** `{{expiry_date}}`
  - 🔢 **Order Number:** `order.orderNumber`
  - 💳 **Payment Status:** `submission.verificationStatus`
  - 🚚 **Delivery Status:** `delivery.state`
  - 🎫 **Support Ticket Status:** সংশ্লিষ্ট অর্ডারে কোনো টিকিট থাকলে তার বর্তমান স্ট্যাটাস ও বাটন।

#### ২. মেয়াদ ও সার্ভিস স্টার্ট ডেট হিসাবের কঠোর নিয়ম (Authoritative Date Logic):
- **ব্রাউজার বা ক্লায়েন্টে কোনো তারিখ উদ্ভাবন বা আন্দাজে হিসাব করা হবে না।**
- যদি অর্ডারের স্ট্যাটাস `completed` না হয় বা ডিজিটাল ডেলিভারি সম্পন্ন না হয়ে থাকে:
  - `service_start_date` = `"Pending Delivery"`
  - `expiry_date` = `"Not Available Until Delivered"`
- যখন অর্ডারটি `completed` হবে এবং ডেলিভারি রেকর্ড থাকবে:
  - `service_start_date` = `delivery.deliveredAt || delivery.createdAt`
  - `expiry_date` = `new Date(service_start_date).getTime() + (snapshotDurationDays * 86400000)`
- **মালিকানা ভেরিফিকেশন (Server-Side Ownership):**
  - `/api/customer/orders` এন্ডপয়েন্টে শুধুমাত্র লগইন করা কাস্টমারের আইডি বা ইমেইলের সাথে মিলে যাওয়া অর্ডারগুলোই রিটার্ন করা হবে (`order.customerId === req.user.id || order.customerEmail === req.user.email`)। অন্য কোনো ইউজারের অর্ডার ডাটা ব্রাউজারে পাঠানো সম্পূর্ণ অসম্ভব।

---

### B. Customer Support Ticket System

#### ১. ডেটা মডেল (`server/types/index.ts` ও `server/db/store.ts`):
বর্তমান `.data/db.json` কাঠামোর ভেতরেই `tickets: SupportTicket[]` যুক্ত হবে (কোনো এক্সটার্নাল মাইগ্রেশন ছাড়া):
```typescript
export type TicketCategory =
  | 'login_problem'
  | 'service_not_working'
  | 'wrong_delivery'
  | 'expiry_duration_issue'
  | 'payment_issue'
  | 'other';

export type TicketStatus =
  | 'open'
  | 'in_review'
  | 'waiting_for_customer'
  | 'resolved'
  | 'closed';

export interface TicketAttachment {
  id: string;              // att_...
  originalName: string;    // ইউজার ফাইলের নাম
  storageKey: string;      // সার্ভারের সুরক্ষিত UUID ফাইলনেম
  mimeType: string;        // 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes: number;
  uploadedAt: string;
}

export interface TicketMessage {
  id: string;              // msg_...
  senderRole: 'customer' | 'admin' | 'support';
  senderUserId: string;
  senderName: string;
  messageText: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface InternalNote {
  id: string;
  authorUserId: string;
  authorName: string;
  noteText: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;              // tck_...
  ticketNumber: string;    // TCK-YYYYMMDD-XXXXX
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  messages: TicketMessage[];
  internalNotes?: InternalNote[]; // কাস্টমার API রেসপন্সে এটি স্বয়ংক্রিয়ভাবে বাদ দেওয়া হবে
  resolutionSummary?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  closedAt?: string;
  reopenedCount: number;
  createdAt: string;
  updatedAt: string;
}
```

#### ২. টিকিট লাইফসাইকেল ও রি-ওপেন পলিসি:
- **Open:** কাস্টমার সমস্যা সাবমিট করার পর ডিফল্ট অবস্থা।
- **In Review:** সাপোর্ট স্টাফ টিকিটটি ওপেন করে কাজ শুরু করলে।
- **Waiting for Customer:** সাপোর্ট টিম অতিরিক্ত তথ্য বা স্পষ্টীকরণ চাইলে।
- **Resolved:** সমস্যা সমাধান করে সাপোর্ট রেজোলিউশন প্রদান করলে। কাস্টমার ৪৮ ঘণ্টার মধ্যে সন্তুষ্ট না হলে রিকানেক্ট/রি-ওপেন করতে পারবে।
- **Closed:** রেজোলিউশনের ৪৮ ঘণ্টা পর বা অ্যাডমিন কর্তৃক চূড়ান্ত বন্ধ। বন্ধ টিকিটে নতুন মেসেজ দেওয়া যাবে না (প্রয়োজনে নতুন টিকিট তৈরি করতে হবে)।

---

### C. Screenshot Upload and Evidence Vault Security

#### ১. বাস্তব আপলোড ও নিরাপত্তা প্রোটোকল:
- এটি কোনো ডেকোরেটিভ বা মকআপ বাটন নয়; সম্পূর্ণ রিয়েল এবং সিকিউর ফাইল আপলোড পাইপলাইন।
- **MIME & Magic Bytes ভ্যালিডেশন:**
  - শুধুমাত্র `image/jpeg` (magic bytes: `FF D8 FF`), `image/png` (`89 50 4E 47`), এবং `image/webp` (`52 49 46 46...57 45 42 50`) অনুমোদিত হবে।
  - এক্সিকিউটেবল (.exe, .sh), স্ক্রিপ্ট (.php, .js, .html), বা অন্য কোনো বিপজ্জনক এক্সটেনশন সার্ভার সাইডে কঠোরভাবে রিজেক্ট হবে।
- **ফাইল সাইজ ও লিমিট:**
  - প্রতি স্ক্রিনশটের সর্বোচ্চ সাইজ: **৫ মেগাবাইট (5 MB)**।
  - প্রতিটি মেসেজে সর্বোচ্চ: **৩টি স্ক্রিনশট**।
  - প্রতি ইউজারের জন্য আপলোড রেট লিমিট: ঘণ্টায় সর্বোচ্চ ১০টি ফাইল।
- **সার্ভার সাইড সিকিউর নেইমিং ও প্রাইভেট স্টোরেজ:**
  - ফাইলগুলো লোকাল ফাইল সিস্টেমের প্রাইভেট ডিরেক্টরিতে সংরক্ষিত হবে: `.data/evidence/`।
  - ফাইলের নাম হবে সম্পূর্ণ র্যান্ডম ক্রিপ্টোগ্রাফিক UUID: `evd_${crypto.randomUUID()}.${ext}`।
  - এই ডিরেক্টরিটি কোনো পাবলিক স্ট্যাটিক সার্ভার (`express.static`) দিয়ে সার্ভ করা হবে না! ফলে কেউ ব্রাউজারে ডিরেক্ট URL লিখে ফাইল দেখতে পারবে না।
- **অনুমতি যাচাইকৃত অ্যাক্সেস গেটওয়ে (Access-Controlled Streaming Endpoint):**
  - এন্ডপয়েন্ট: `GET /api/tickets/:ticketId/attachments/:attachmentId`
  - সার্ভার চেক করবে:
    - রিকোয়েস্টকারী যদি রোল `admin` বা `support` হন -> ফাইল ডাউনলোডের অনুমতি পাবে।
    - রিকোয়েস্টকারী যদি সংশ্লিষ্ট টিকিটের মালিক কাস্টমার হন (`ticket.customerId === req.user.id`) -> অনুমতি পাবে।
    - অন্য কোনো ইউজার আইডি দিয়ে রিকোয়েস্ট করলে -> **403 Forbidden** রিটার্ন করবে।
- **UI সতর্কবার্তা (Bengali Warning Banner):**
  - আপলোড বক্সের ঠিক উপরে স্পষ্ট লাল/অ্যাম্বার সতর্কবার্তা থাকবে:
    > **“স্ক্রিনশটে পাসওয়ার্ড, OTP, পেমেন্ট PIN বা অন্য কোনো গোপন তথ্য থাকলে সেগুলো ঢেকে দিন।”**
  - সিস্টেম কখনই কাস্টমারের কাছে জিমেইল পাসওয়ার্ড, ওটিপি বা পিন চাইবে না।

---

### D. Admin / Support Ticket Management Console

#### ১. অ্যাডমিন পোর্টালে নতুন "Support Tickets" ট্যাব:
- `/src/components/AdminPortal.tsx`-এ ৮ম ট্যাব হিসেবে `tickets` যুক্ত হবে।
- **ফিচারসমূহ:**
  - **ফিল্টারিং ও সার্চ:** স্ট্যাটাস অনুযায়ী (`All`, `Open`, `In Review`, `Waiting`, `Resolved`, `Closed`), ক্যাটাগরি এবং টিকিট নম্বর বা ইমেইল দিয়ে সার্চ।
  - **অর্ডার ও ডেলিভারি ইন্টিগ্রেশন:** টিকিটের পাশে "View Associated Order" বাটন, যা সেই অর্ডারের পণ্য, ডেলিভারি হিস্ট্রি ও ট্রানজ্যাকশন আইডি দেখাবে।
  - **প্রাইভেট এভিডেন্স ভিউয়ার:** কাস্টমারের আপলোড করা স্ক্রিনশট নিরাপদে ভিউ করার জন্য লাইটবক্স প্রিভিউয়ার।
  - **ইন্টারনাল নোটস (Internal Staff Notes):**
    - সাপোর্ট টিম নিজেদের ভেতর আলোচনার জন্য ইন্টারনাল নোট লিখতে পারবে (`InternalNote`)।
    - এই নোটগুলো কাস্টমার API রেসপন্সে **সম্পূর্ণ অনুপস্থিত (Stripped Out)** থাকবে।
  - **রেসপন্স ও স্ট্যাটাস আপডেট:** কাস্টমারকে উত্তর পাঠানো, স্ট্যাটাস পরিবর্তন করা এবং রেজোলিউশন টাইমস্ট্যাম্প রেকর্ড করা।

---

### E. Notifications for Ticket Lifecycle

- বিদ্যমান `/server/services/notifications.ts` সার্ভিসের মাধ্যমে নোটিফিকেশন পাঠানো হবে:
  1. `TICKET_CREATED`: কাস্টমারকে টিকিট কনফার্মেশন ও টিকিট নম্বর ইমেইল করা।
  2. `SUPPORT_REPLIED`: সাপোর্ট টিম উত্তর দিলে কাস্টমারকে অবিলম্বে ইমেইল অ্যালার্ট পাঠানো।
  3. `CUSTOMER_INFO_REQUESTED`: স্ট্যাটাস `waiting_for_customer` হলে কাস্টমারকে তথ্য সরবরাহের অনুরোধ।
  4. `TICKET_RESOLVED`: টিকিট সমাধান হলে রেজোলিউশন সারসংক্ষেপসহ নোটিফিকেশন।
  5. `TICKET_REOPENED`: কাস্টমার টিকিট রি-ওপেন করলে অ্যাডমিন প্যানেলে অ্যালার্ট।
- কোনো ইমেইল বা মেসেজ পাঠানোর পর প্রোভাইডারের কনফার্মেশন ছাড়া তাকে 'Sent' ঘোষণা করা হবে না; ফেইলিউর হলে অটোমেটিক এক্সপোনেনশিয়াল ব্যাকঅফ রিট্রাই চলবে।

---

## ৪. পুঙ্খানুপুঙ্খ ফাইলভিত্তিক পরিবর্তন পরিকল্পনা (File-by-File Changes)

```
┌───────────────────────────────────┬─────────────────────────────────────────────────────────────┐
│ File Path                         │ Proposed Minimal Changes & Additions                        │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /server/types/index.ts            │ Add SupportTicket, TicketMessage, TicketAttachment,         │
│                                   │ InternalNote, TicketCategory, TicketStatus interfaces.      │
│                                   │ Add SessionRecord interface for secure authentication.      │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /server/db/store.ts               │ Add tickets: SupportTicket[] & sessions: SessionRecord[] to │
│                                   │ DatabaseSchema. Add mutex write queue & atomic fsync logic. │
│                                   │ Ensure .data/evidence/ directory exists on boot.            │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /server/api/routes.ts             │ 1. Add crypto session login/logout/validation routes.       │
│                                   │ 2. Redact delivery payload on unauthenticated /api/orders.  │
│                                   │ 3. Add /api/customer/orders (scoped to customer orders).    │
│                                   │ 4. Add /api/tickets (GET list, POST create, POST message).  │
│                                   │ 5. Add /api/tickets/:id/attachments/:attId (file streamer). │
│                                   │ 6. Add /api/admin/tickets (staff console, internal notes).  │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /src/lib/api.ts                   │ Remove usr_admin_01 fallback. Add API helper methods for    │
│                                   │ getCustomerOrders(), getTickets(), createTicket(),          │
│                                   │ addTicketMessage(), uploadEvidence(), getAdminTickets().    │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /src/components/CustomerPortal.tsx│ New Component: Customer Dashboard with "My Services /       │
│                                   │ My Orders" tab and "Support Tickets" tab with screenshot    │
│                                   │ upload modal & warning banner.                              │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /src/components/Navbar.tsx        │ Add "My Services / Dashboard" tab for authenticated         │
│                                   │ customers. Remove hardcoded role switcher for production.   │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /src/components/AdminPortal.tsx   │ Add 8th Tab "Support Tickets" for staff ticket resolution,  │
│                                   │ evidence inspection, and internal notes.                    │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /server.ts (New)                  │ Production Express entry point (trust proxy, static assets, │
│                                   │ SPA wildcard router, dynamic port binding).                 │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────┤
│ /package.json                     │ Add "build" esbuild compilation and "start": "node server.js│
└───────────────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## ৫. রিগ্রেশন টেস্টিং ও সংরক্ষিত সকল ডেটা (Preservation & Invariants)

কোনো পরিবর্তনের পূর্বে `.data/db.json`-এর মূল হ্যাশ যাচাইকৃত বেসলাইন কপি রাখা হবে (`.data/db.json.pre_production_baseline`)। 
নিচের ১০টি ডোমেন এনটিটিতে কোনো ডেটা লস হবে না:
1. **Products & Packages:** বিদ্যমান ডিজিটাল প্রোডাক্ট, স্টক ও ডিউরেশন অক্ষত থাকবে।
2. **Pricing & Margins:** রিটেল মূল্য ও হোলসেল খরচ সামান্যতম পরিবর্তিত হবে না।
3. **Orders & Deliveries:** পূর্বে সম্পন্ন হওয়া ও পেন্ডিং অর্ডার অপরিবর্তিত থাকবে।
4. **Payments:** বিকাশ, নগদ, রকেটের সাবমিশন ও ট্রানজ্যাকশন আইডি সম্পূর্ণ অক্ষত থাকবে।
5. **Wallet Ledger:** প্রতিটি ডেবিট/ক্রেডিট এন্ট্রি এবং রিসেলার ব্যালেন্স সুরক্ষিত থাকবে।
6. **Reseller Isolation:** সাবডোমেইন ও ডোমেইনে নিজস্ব ব্র্যান্ডিং ও প্রাইসিং বজায় থাকবে।
7. **Notifications:** পূর্বের আউটবক্স হিস্ট্রি সংরক্ষিত থাকবে।

---

## ৬. পর্যায়ভিত্তিক বাস্তবায়ন ও অনুমোদন গেট (Approval Gates)

```
[Gate 1: Core Security & Auth Hardening]
       │
       ▼
[Gate 2: Customer Dashboard & Service Expiry Engine]
       │
       ▼
[Gate 3: Support Ticket System & Secure Evidence Vault]
       │
       ▼
[Gate 4: Admin Ticket Console & Notification Outbox Events]
       │
       ▼
[Gate 5: Persistence Mutex, fsync & Production Server (server.js)]
       │
       ▼
[Gate 6: Regression Invariant Tests (25/25 Verification)]
       │
       ▼
[Gate 7: Hostinger ssdigitalbd.shop DNS & SSL Activation]
```

| গেট | ফেইজ | কাজের বিষয় | ব্যবহারকারীর স্পষ্ট সম্মতি প্রয়োজন? |
| :--- | :--- | :--- | :--- |
| **Gate 1** | **Phase 1** | Auth Hardening, Crypto Sessions & Delivery Secret Redaction | **হ্যাঁ (কোড শুরুর পূর্বে)** |
| **Gate 2** | **Phase 2** | Customer My Services Dashboard & Authoritative Expiry Engine | **হ্যাঁ (কম্পোনেন্ট শুরুর পূর্বে)** |
| **Gate 3** | **Phase 3** | Support Ticket System & Secure Evidence Vault (Upload & Access Control) | **হ্যাঁ (টিকেট কোড শুরুর পূর্বে)** |
| **Gate 4** | **Phase 4** | Admin Ticket Console & Notifications Integration | **হ্যাঁ (অ্যাডমিন এডিটের পূর্বে)** |
| **Gate 5** | **Phase 5** | Persistence Mutex, fsync, Production Server (`server.js`) & Start Script | **হ্যাঁ (সার্ভার তৈরির পূর্বে)** |
| **Gate 6** | **Phase 6** | 25/25 Regression Testing & Invariant Validation | **হ্যাঁ (হোস্টিংয়ে যাওয়ার পূর্বে)** |
| **Gate 7** | **Phase 7** | Hostinger `ssdigitalbd.shop` DNS & HTTPS Integration | **হ্যাঁ (লাইভ ট্রাফিকের পূর্বে)** |

---

**বর্তমান অবস্থা:** আপনার নির্দেশনা অনুযায়ী কোনো সোর্স কোড বা ডেটাবেস পরিবর্তন করা হয়নি। Section 14-এর সকল বিস্তারিত শর্ত (কাস্টমার ড্যাশবোর্ড, তারিখ হিসাবের কঠোর নিয়মাবলী, সাপোর্ট টিকিট, প্রাইভেট স্ক্রিনশট স্টোরেজ, ইন্টারনাল নোটস ও নোটিফিকেশন) অন্তর্ভুক্ত করে সম্পূর্ণ মাস্টার প্ল্যান প্রস্তুত করা হয়েছে। আপনার স্পষ্ট সম্মতি পেলে আমরা **Gate 1** দিয়ে পরবর্তী ধাপ শুরু করব।
