# خطة تنفيذ إدارة الهوية والوصول (IAM Implementation Plan)

## تنبيهات ما قبل التنفيذ (Pre-Implementation Flags)

> [!NOTE]
> **تم حل التناقضات السابقة (ADR-002 Locked):**
> تم التأكيد وتحديث الوثائق الخاصة بـ `2 - flow.md` و `4 - domain.md` لتعكس **Strict Single Device Policy** بشكل قاطع.
> العلاقة الآن `User (1) ----- (1) Session` والقيد الوحيد هو `@@unique([userId])`.
> لا يوجد أي تناقضات عالقة قبل التنفيذ.

> [!NOTE]
> **ملاحظة حول Permission field naming:**
> وثيقة الدومين `4 - domain.md` تستخدم `subject` كاسم للمورد في جدول Permission.
> الاسكيما الحالية (legacy) تستخدم `resource`.
> **القرار المعتمد:** نعتمد `subject` كما في وثيقة الدومين لأنها المرجع الجديد.

> [!NOTE]
> **ملاحظة حول `6 - notes.md` (قسم بصمة الجهاز):**
> القسم الأخير (السطر 141-143) يذكر `FingerprintJS` كخيار.
> **ADR-003** يحسم صراحة أن `FingerprintJS` ممنوع ويجب استخدام `crypto.randomUUID()` فقط.
> **القرار المعتمد:** ADR-003 هو المرجع. هذا التناقض وثائقي فقط ولا يؤثر على التنفيذ.

---

## المراحل (Phases)

### المرحلة 0: تنظيف البنية القديمة (Legacy Cleanup)

**الهدف:** إزالة كل الكود والمخطط المرتبط بدومين الملاحظات القديم.

| المهمة                                 | التفاصيل                                           |
| -------------------------------------- | -------------------------------------------------- |
| حذف `src/modules/notes/`               | إزالة المجلد بالكامل                               |
| حذف `src/shared/Password.js`           | لم يعد هناك كلمات مرور                             |
| حذف `src/shared/Tokens.js`             | سيُستبدل بـ `token.service.js` داخل الـ IAM module |
| تحديث `src/modules/router.js`          | إزالة مسارات الـ Notes                             |
| تنظيف `src/infrastructure/passport.js` | إزالة استراتيجية JWT القديمة (ستُعاد كتابتها)      |

**معيار الخروج:** `npm run lint` يمر بنجاح. لا يوجد أي مرجع لـ `notes` أو `Password` في الكود.

---

### المرحلة 1: مخطط قاعدة البيانات (ERP Schema)

**الهدف:** استبدال النماذج القديمة بنماذج الـ ERP الجديدة مع الاحتفاظ بإعدادات Prisma (`datasource`, `generator`).

**الاعتماديات:** المرحلة 0 مكتملة.

| المهمة                                   | التفاصيل                                                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| استبدال نماذج `schema.prisma`            | `Branch`, `User` (بدون password, مع googleId), `Session` (@@unique([userId])), `Invitation`, `Role`, `Permission`, `RolePermission`, `UserRole`, `AuditLog` |
| حذف `LegacyRole enum`                    | ————                                                                                                                                                        |
| حذف نموذج `Note`                         | ————                                                                                                                                                        |
| حذف نموذج `Token`                        | ————                                                                                                                                                        |
| حذف مجلد `prisma/migrations/`            | لمسح سجل الهجرات القديمة والبدء بسجل نظيف تماماً (Greenfield)                                                                                               |
| تنفيذ `npx prisma db push --force-reset` | بناء قاعدة البيانات من الصفر (Greenfield)                                                                                                                   |
| تنفيذ `npx prisma generate`              | توليد Prisma Client الجديد                                                                                                                                  |

**معيار الخروج:** `npx prisma validate` يمر بنجاح. `npx prisma generate` ينتج Client بدون أخطاء.

---

### المرحلة 2: البنية التحتية الأساسية (Core Infrastructure)

**الهدف:** بناء الطبقات الأساسية التي يعتمد عليها كل شيء.

**الاعتماديات:** المرحلة 1 مكتملة.

| المهمة                       | التفاصيل                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| تثبيت الاعتماديات            | `npm install cookie-parser passport-google-oauth20 passport-jwt jsonwebtoken`                           |
| إعداد `cookie-parser`        | إضافته إلى `src/app.js` ليتمكن السيرفر من قراءة `refreshToken` من الـ HttpOnly Cookie                   |
| تحديث `error.middleware.js`  | التقاط أخطاء `TokenExpiredError`, `JsonWebTokenError` وأخطاء `Prisma` وإرجاع `401`/`403` بدلاً من `500` |
| `infrastructure/passport.js` | استراتيجية Google OAuth 2.0 (Passport) + استراتيجية JWT                                                 |
| `infrastructure/als.js`      | تحديث AsyncLocalStorage لدعم `branchId` + `userId`                                                      |
| `infrastructure/prisma.js`   | Prisma Client Extension ("الحارس الصامت") لحقن `branchId` + `deletedAt: null`                           |
| `src/shared/ApiError.js`     | التأكد من دعم أكواد الخطأ الجديدة (`401`, `403`)                                                        |
| `infrastructure/config.js`   | إضافة متغيرات Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`)          |

**معيار الخروج:** `node src/index.js` يقلع بنجاح. Prisma Client Extension مُسجّل.

**نقطة مراجعة:** مراجعة كود الحارس الصامت (Prisma Extension) وآلية الـ Bypass للـ Super Admin.

---

### المرحلة 3: وحدة المصادقة (Authentication Module)

**الهدف:** بناء تدفقات الدخول والخروج وتدوير الرموز.

**الاعتماديات:** المرحلة 2 مكتملة.

| المهمة          | الملف                           | التفاصيل                                                                    |
| --------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Token Service   | `iam/token.service.js`          | إنشاء/تحقق Access Token + Refresh Token + SHA-256 Hashing                   |
| Session Service | `iam/session.service.js`        | Upsert (@@unique userId) + Delete + Cleanup                                 |
| Auth Service    | `iam/auth.service.js`           | Google SSO Verify Callback + First Login (googleId merge) + Reuse Detection |
| Auth Controller | `iam/auth.controller.js`        | Login redirect, Callback handler, Refresh, Logout                           |
| Auth Routes     | `iam/auth.route.js`             | `GET /google`, `GET /google/callback`, `POST /refresh`, `POST /logout`      |
| Auth Validators | `iam/auth.validator.js`         | Zod schemas: `deviceId`, `refreshToken` cookie                              |
| Auth Middleware | `middleware/auth.middleware.js` | إعادة كتابة: Passport JWT strategy + isActive/deletedAt check               |

**معيار الخروج:** تدفق Login → Tokens → Refresh → Logout يعمل بالكامل عبر Supertest.

**نقطة مراجعة:** مراجعة منطق Reuse Detection وفترة السماح (2 ثانية).

---

### المرحلة 4: وحدة التفويض (Authorization Module)

**الهدف:** بناء نظام RBAC الديناميكي مع الإبطال الذكي.

**الاعتماديات:** المرحلة 3 مكتملة.

| المهمة                     | الملف                           | التفاصيل                                                                                                                               |
| -------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization Middleware   | `middleware/auth.middleware.js` | فحص الصلاحية `action:subject:scope` + Direct-DB Resolution + Super Admin bypass (`*:*:*`) + Scope Hierarchy (`any` > `branch` > `own`) |
| Role Service               | `iam/role.service.js`           | CRUD + `version++` عند التعديل + منع حذف `isSystem` + Reassign Flow                                                                    |
| Role Controller            | `iam/role.controller.js`        | ————                                                                                                                                   |
| Role Routes                | `iam/role.route.js`             | `GET /`, `POST /`, `PUT /:roleId`, `DELETE /:roleId`, `PUT /:roleId/reassign`                                                          |
| Role Validators            | `iam/role.validator.js`         | Zod schemas                                                                                                                            |
| Privilege Escalation Guard | داخل `role.service.js`          | `actor.role.level >= targetRole.level`                                                                                                 |

**معيار الخروج:** تحديث صلاحيات دور → `version` يزداد → الطلب التالي بالتوكن القديم يُرفض `401`.

**نقطة مراجعة:** مراجعة منطق Privilege Escalation Prevention.

---

### المرحلة 5: إدارة المستخدمين ودورة الحياة (User Lifecycle)

**الهدف:** بناء تدفقات الإيقاف والأرشفة والاستعادة.

**الاعتماديات:** المرحلة 4 مكتملة.

| المهمة          | الملف                    | التفاصيل                                                                                                         |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| User Service    | `iam/user.service.js`    | `getMe`, List (with soft-delete filter), Get, Suspend (Transaction), Archive (Transaction + Pre-checks), Restore |
| User Controller | `iam/user.controller.js` | ————                                                                                                             |
| User Routes     | `iam/user.route.js`      | `GET /me`, `GET /`, `GET /:userId`, `PATCH /:userId/status`, `DELETE /:userId`, `POST /:userId/restore`          |
| User Validators | `iam/user.validator.js`  | Zod schemas                                                                                                      |
| User Serializer | `iam/user.serializer.js` | تحديث لاستبعاد `googleId`, `refreshTokenHash`                                                                    |

**معيار الخروج:** Kill-Switch → Session Purge → الموظف مطرود فوراً. Archive مع Pre-checks يرفض الأرشفة عند وجود مهام مفتوحة.

---

### المرحلة 5.1: Lifecycle Hardening

**الهدف:** إغلاق ثغرات الاستعادة وتفعيل المستخدمين وتأمين العمليات الحرجة.

**الاعتماديات:** المرحلة 5 مكتملة.

| المهمة               | الملف                 | التفاصيل                                                                                                  |
| -------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| Lifecycle Service    | `iam/user.service.js` | إضافة `activateUser` للسماح بتفعيل المستخدم بدون أرشفة + إضافة Privilege Escalation Guards للوظائف الحرجة |
| Pre-Offboarding Docs | `iam/user.service.js` | توثيق تأجيل التحقق من Pre-Offboarding حتى إطلاق باقي وحدات ERP                                            |

---

### المرحلة 6: نظام الدعوات (Invitation System)

**الهدف:** بناء نظام الانضمام المغلق.

**الاعتماديات:** المرحلة 5 مكتملة (لأن قبول الدعوة يُنشئ مستخدماً).

| المهمة                | الملف                          | التفاصيل                                                             |
| --------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Invitation Service    | `iam/invitation.service.js`    | Create (مع branch isolation) + List + Revoke + Accept (Provisioning) |
| Invitation Controller | `iam/invitation.controller.js` | ————                                                                 |
| Invitation Routes     | `iam/invitation.route.js`      | `POST /`, `GET /`, `DELETE /:inviteId`                               |
| Invitation Validators | `iam/invitation.validator.js`  | Zod schemas                                                          |
| Email Integration     | `infrastructure/email/`        | قالب دعوة + Background Job Queue                                     |

**معيار الخروج:** الدعوة → بريد إلكتروني → قبول عبر SSO → مستخدم جديد بصلاحيات محددة مسبقاً.

---

### المرحلة 7: Seed Script والمهام الخلفية (Seed & Workers)

**الهدف:** بناء آلية التهيئة الأولية وعمال التنظيف.

**الاعتماديات:** المرحلة 6 مكتملة.

| المهمة                    | الملف                                          | التفاصيل                                                                                                                 |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Prisma Seed Script        | `prisma/seed.js`                               | ADR-001: قراءة `SUPER_ADMIN_EMAIL` → إنشاء Role (`*:*:*`, `level: 100`, `isSystem: true`) → إنشاء User (بدون `googleId`) |
| Session Cleanup Worker    | `infrastructure/workers/session-cleanup.js`    | Cron Job: `DELETE FROM sessions WHERE expiresAt < NOW()` (يعمل يومياً في فترات الحمل المنخفض)                            |
| Auto-Deactivation Worker  | `infrastructure/workers/auto-deactivation.js`  | Cron Job: `isActive: false` للمستخدمين الذين لم يسجلوا دخول لـ 30 يوماً                                                  |
| Invitation Cleanup Worker | `infrastructure/workers/invitation-cleanup.js` | Cron Job: تحديث حالة الدعوات المنتهية إلى `EXPIRED`                                                                      |
| تفعيل المهام (Mounting)   | `src/index.js`                                 | تسجيل الـ Cron Jobs لتعمل تلقائياً عند إقلاع السيرفر                                                                     |

**معيار الخروج:** `npx prisma db seed` يُنشئ Super Admin بنجاح. Cron Jobs تعمل بدون أخطاء.

---

### المرحلة 8: الاختبارات الشاملة (Comprehensive Testing)

**الهدف:** تنفيذ استراتيجية الاختبار المحددة في `7 - test.md`.

**الاعتماديات:** جميع المراحل السابقة مكتملة.

| المهمة            | التفاصيل                             |
| ----------------- | ------------------------------------ |
| Unit Tests        | جميع حالات الاختبار الوحدوية (U-\*)  |
| Integration Tests | جميع حالات الاختبار التكاملية (I-\*) |
| Security Tests    | جميع حالات الاختبار الأمنية (S-\*)   |
| Worker Tests      | جميع حالات الاختبار الخلفية (W-\*)   |

**معيار الخروج:** `npm run test` يمر بنجاح 100%. `npm run coverage` يُظهر تغطية ≥ 80%.

**نقطة مراجعة نهائية:** مراجعة شاملة للكود والاختبارات قبل الدمج.

---

## ملخص الاعتماديات

```
Phase 0 (Cleanup)
  └── Phase 1 (Schema)
       └── Phase 2 (Infrastructure)
            └── Phase 3 (Authentication)
                 └── Phase 4 (Authorization)
                      └── Phase 5 (User Lifecycle)
                           └── Phase 6 (Invitations)
                                └── Phase 7 (Seed & Workers)
                                     └── Phase 8 (Testing)
```

## قواعد التنفيذ (Execution Rules)

بعد كل مرحلة يجب تنفيذ:

```bash
npm run lint
npm run test
node src/index.js
```

لا يُسمح بالانتقال للمرحلة التالية إلا بعد اجتياز معيار الخروج.
الحد الأقصى: 5-10 ملفات لكل تكرار (Iteration).
