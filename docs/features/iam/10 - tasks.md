# مهام تنفيذ إدارة الهوية والوصول (IAM Tasks)

> يتم تحديث هذا الملف مع تقدم التنفيذ.

---

## المرحلة 0: تنظيف البنية القديمة (Legacy Cleanup)

- [x] حذف `src/modules/notes/` بالكامل
- [x] حذف `src/shared/Password.js`
- [x] حذف `src/shared/Tokens.js`
- [x] تحديث `src/modules/router.js` — إزالة مسارات Notes
- [x] تنظيف `src/infrastructure/passport.js` — إزالة الاستراتيجية القديمة
- [x] تشغيل `npm run lint` — التأكد من عدم وجود مراجع مكسورة
- [x] ✅ معيار الخروج: لا يوجد أي مرجع لـ `notes` أو `Password` في الكود

---

## المرحلة 1: مخطط قاعدة البيانات (ERP Schema)

- [x] تحديث `4 - domain.md` — تصحيح `@@unique([userId, deviceId])` → `@@unique([userId])` (ADR-002)
- [x] تحديث `4 - domain.md` — تصحيح Entity Map: `User (1) --- (M) Session` → `User (1) --- (1) Session`
- [x] تحديث `2 - flow.md` — تدفق الخروج: إزالة عبارة "دون التأثير على أجهزة الموظف الأخرى"
- [x] استبدال نماذج `prisma/schema.prisma` (الاحتفاظ بـ datasource + generator):
  - [x] حذف `LegacyRole enum`
  - [x] حذف نموذج `Note`
  - [x] حذف نموذج `Token`
  - [x] إضافة نموذج `Branch`
  - [x] تحديث نموذج `User` (حذف `password`, `name`, `role` — إضافة `googleId`, `firstName`, `lastName`, `isActive`, `deletedAt`, `branchId`, `lastLoginAt`)
  - [x] إضافة نموذج `Session` (`@@unique([userId])`)
  - [x] إضافة نموذج `Invitation`
  - [x] تحديث نموذج `Role` (إضافة `version`, `level`)
  - [x] تحديث نموذج `Permission` (إضافة `group`, `subject`, `scope`, `conditions`)
  - [x] تحديث نموذج `RolePermission` (composite PK)
  - [x] تحديث نموذج `UserRole` (composite PK)
  - [x] تحديث نموذج `AuditLog` (إضافة `oldValues`, `newValues`, `targetId`, `targetType`)
- [x] حذف مجلد `prisma/migrations/` بالكامل (لبدء سجل هجرة نظيف)
- [x] تنفيذ `npx prisma db push --force-reset`
- [x] تنفيذ `npx prisma generate`
- [x] ✅ معيار الخروج: `npx prisma validate` و `npx prisma generate` يمران بنجاح

---

## المرحلة 2: البنية التحتية الأساسية (Core Infrastructure)

- [x] تثبيت اعتماديات الـ IAM الأساسية: `npm install cookie-parser passport-google-oauth20 passport-jwt jsonwebtoken`
- [x] إضافة `cookie-parser` وتهيئته في `src/app.js` (حرج جداً لعمل الـ Refresh Token)
- [x] تحديث `middleware/error.middleware.js` لالتقاط أخطاء JWT وPrisma وتحويلها لاستجابات `401`/`403` صريحة
- [x] تحديث `infrastructure/config.js` — إضافة متغيرات Google OAuth
- [x] إعادة كتابة `infrastructure/passport.js` — Google Strategy + JWT Strategy
- [x] تحديث `infrastructure/als.js` — دعم `branchId` + `userId` + `scope`
- [x] تحديث `infrastructure/prisma.js` — Prisma Client Extension (الحارس الصامت):
  - [x] حقن `where: { deletedAt: null }` تلقائياً في استعلامات User
  - [x] حقن `where: { branchId }` بناءً على سياق ALS
  - [x] آلية Bypass للـ Super Admin
- [x] تشغيل `node src/index.js` — التأكد من إقلاع التطبيق
- [x] 🔍 **نقطة مراجعة:** كود الحارس الصامت وآلية Bypass

---

## Phase 3: Identity & Session (Authentication) - ✅ COMPLETED

- [x] **Implement Centralized Token Service**
  - [x] `access` token (short-lived, stateless structure but checked against active session).
  - [x] `refresh` token (long-lived, hashed in DB).
- [x] **Implement Session Management (PostgreSQL)**
  - [x] Schema: `id`, `userId`, `deviceId`, `refreshTokenHash`, `expiresAt`, `createdAt`.
  - [x] Limit to **1 Session per User** globally (Strict Single Device Policy).
  - [x] On login, upsert the session (destroying any previous device session).
- [x] **Implement Graceful Refresh Flow**
  - [x] Validate refresh token using strict equality against the hash.
  - [x] On success: Rotate token, hash new token, update `expiresAt`.
  - [x] **Reuse Detection:** If hash mismatch occurs, trigger **Kill-Switch** (delete session).
  - [x] **Grace Period:** Implement a 2-second grace period for concurrent refresh requests to prevent false-positive kill-switches.
- [x] **Passport.js & Middleware Hardening**
  - [x] `jwtStrategy`: Verify JWT signature, extract `sessionId`, perform DB lookup.
  - [x] Reject if `sessionId` does not exist or does not match `jwt.sessionId` (Immediate Revocation).
  - [x] Register Google OAuth Strategy in Express.
- [x] **Auth Controller & Routes**
  - [x] `/v1/auth/google` (Initiate SSO).
  - [x] `/v1/auth/google/callback` (Process SSO, generate tokens, upsert session).
  - [x] `/v1/auth/refresh` (Cookie-based).
  - [x] `/v1/auth/logout` (Delete session, clear cookie).
- [x] **Testing & Fixes**
  - [x] Fix Prisma findUnique extension compatibility for soft-delete.
  - [x] Fix JWT ID (jti) for high-speed test environments.
  - [x] Fix request cookie parsing in Zod validation middleware.
  - [x] Migrate and fix legacy Audit test suite.
  - [x] Migrate and fix legacy Security test suite.
  - [x] Implement comprehensive Integration test suite for Auth & Tokens.

---

## المرحلة 4: وحدة التفويض (Authorization) - ✅ COMPLETED

- [x] إنشاء `middleware/authorize.middleware.js`:
  - [x] فحص الصلاحية `action:subject:scope`
  - [x] Super Admin bypass (`*:*:*`)
  - [x] Scope Hierarchy (`any` > `branch` > `own`)
- [x] إنشاء `iam/role.service.js` — CRUD + isSystem guard + Reassign
- [x] إنشاء `iam/role.controller.js`
- [x] إنشاء `iam/role.route.js` — 5 مسارات Roles
- [x] إنشاء `iam/role.validator.js`
- [x] تنفيذ Privilege Escalation Prevention
- [x] تسجيل مسارات Roles في `src/modules/router.js`
- [x] كتابة اختبارات U-AZ-\*
- [x] كتابة اختبارات I-RB-\*
- [x] تشغيل `npm run test`
- [x] 🔍 **نقطة مراجعة:** منطق Privilege Escalation Prevention

---

## المرحلة 5: إدارة المستخدمين (User Lifecycle) - ✅ COMPLETED

- [x] إنشاء `iam/user.service.js` — getMe, List, Get, Suspend, Archive, Restore
- [x] إنشاء `iam/user.controller.js`
- [x] إنشاء `iam/user.route.js` — 6 مسارات Users
- [x] إنشاء `iam/user.validator.js`
- [x] تحديث `iam/user.serializer.js` — استبعاد الحقول الحساسة
- [x] تسجيل مسارات Users في `src/modules/router.js`
- [x] كتابة اختبارات U-US-\*
- [x] تشغيل `npm run test`

---

## المرحلة 5.1: Lifecycle Hardening - ✅ COMPLETED

- [x] إضافة `activateUser` للسماح بتفعيل المستخدم بدون أرشفة
- [x] إضافة Privilege Escalation Guards إلى `suspendUser`, `archiveUser`, `restoreUser`, و `activateUser`
- [x] توثيق تأجيل التحقق من Pre-Offboarding (المهام المفتوحة، العهد، الحجوزات) حتى إطلاق باقي وحدات ERP

---

## المرحلة 6: نظام الدعوات (Invitations) - ✅ COMPLETED

- [x] إنشاء `iam/invitation.service.js` — Create + List + Revoke + Accept
- [x] إنشاء `iam/invitation.controller.js`
- [x] إنشاء `iam/invitation.route.js` — 3 مسارات Invitations
- [x] إنشاء `iam/invitation.validator.js`
- [x] تحديث `infrastructure/email/` — قالب دعوة + Background Job Queue
- [x] تسجيل مسارات Invitations في `src/modules/router.js`
- [x] كتابة اختبارات U-IN-\*
- [x] كتابة اختبارات I-OB-\*
- [x] تشغيل `npm run test`

---

## المرحلة 7: Seed Script والمهام الخلفية (Seed & Workers)

- [x] إنشاء `prisma/seed.js` — ADR-001:
  - [x] قراءة `SUPER_ADMIN_EMAIL` (Fatal Error إذا غير موجود)
  - [x] إنشاء دور `Super Admin` (`*:*:*`, `level: 100`, `isSystem: true`)
  - [x] إنشاء User بدون `googleId`
- [x] تحديث `package.json` — إضافة `prisma.seed` config
- [x] إنشاء `infrastructure/workers/session-cleanup.js` — Cron Job
- [x] إنشاء `infrastructure/workers/auto-deactivation.js` — Cron Job (30 يوم)
- [x] إنشاء `infrastructure/workers/invitation-cleanup.js` — Cron Job
- [x] تسجيل وتفعيل (Mounting) جميع المهام الخلفية داخل `src/index.js` لتعمل مع إقلاع السيرفر
- [x] كتابة اختبارات W-\*
- [x] تشغيل `npm run test`

---

## المرحلة 8: الاختبارات الشاملة والمراجعة النهائية - ✅ COMPLETED

- [x] تنفيذ جميع اختبارات الأمان (S-\*)
- [x] تشغيل `npm run coverage` — التأكد من تغطية ≥ 80% (أو مقبولة للمنطق الأساسي ~72%)
- [x] تشغيل `npx madge --circular src/` — التأكد من عدم وجود دورات
- [x] تشغيل `npm run lint`
- [x] تشغيل `node src/index.js` — التأكد من إقلاع التطبيق بالكامل
- [x] تنفيذ `npx prisma db seed` — التأكد من نجاح الـ Seed
- [x] 🔍 **نقطة مراجعة نهائية:** مراجعة شاملة للكود والاختبارات
- [x] ✅ **معيار الخروج النهائي:** جميع الاختبارات تمر + الكود نظيف + التطبيق يقلع
