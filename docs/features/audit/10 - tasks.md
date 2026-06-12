# المهام وقائمة الأعمال (Tasks)

## المرحلة 0: تحصين قاعدة البيانات (Preparation)

- `[x]` تعديل `schema.prisma`: إضافة حقل `branchId` إلى `AuditLog`.
- `[x]` تعديل `schema.prisma`: إضافة ఫهارس `@@index([targetType, targetId])` و `@@index([branchId, createdAt])`.
- `[x]` تعديل `audit.service.js`: استخراج `store.branchId` من الـ `AsyncLocalStorage` وإضافته تلقائياً عند حفظ الحدث.
- `[x]` إنشاء Migration لتطبيق التعديلات على قاعدة البيانات.

## المرحلة 1: استرجاع البيانات الموثوق و API واجهة الإدارة

- `[x]` إنشاء `audit.controller.js` و `audit.route.js`.
- `[x]` تسجيل المسار `GET /v1/audit` في نقطة التجميع المركزية `src/modules/router.js` مع حمايته بصلاحية `auth('read:audit:branch')`.
- `[x]` فرض قيود العزل المناطقي (Branch Enforcement) داخل `audit.controller.js` لمنع التسريب من مديري الفروع.
- `[x]` تحديث `audit.repository.js` لإضافة دالة `findManyWithCursor`.
- `[x]` بناء آلية استرجاع تتجاوز `Silent Guardian` عند عرض `Actor History`.
- `[x]` كتابة وتنفيذ اختبارات قاعدة البيانات `AUDIT-DB-001`.
- `[x]` كتابة وتنفيذ اختبارات الأمان `audit.security.test.js` لضمان صحة العزل المناطقي واجتيازها.

## المرحلة 2: دمج وتغطية أحداث IAM

- `[x]` حقن استدعاءات `logEvent` في وحدات `iam` لتوثيق الإجراءات المحددة في `5 - catalog.md`.
- `[x]` كتابة حماية صريحة (Wrapper) لكل الاستدعاءات الغير متزامنة (Fire-and-Forget) باستخدام `try/catch`.
- `[x]` تأكيد اجتياز اختبار `AUDIT-IT-002`.

## المرحلة 3: خدمة الإرسال الخارجي المدمجة (In-Process Event Forwarding)

- `[x]` تحديث `schema.prisma` لإنشاء جدول `AuditExportCursor`.
- `[x]` إنشاء `audit.worker.js`.
- `[x]` إعداد جدولة `node-cron` تعمل بانتظام.
- `[x]` دمج استخدام القفل `pg_try_advisory_lock(880015)` حول وظيفة التصدير.
- `[x]` تطوير آلية لفلترة السجلات بـ Cursor وتصديرها بصيغة `NDJSON` و `GZIP` إلى مساحة `Cloudflare R2`.
- `[x]` إتمام اختبارات `AUDIT-WRK-001` لضمان التزامن السليم، عدم تكرار التصدير الكاذب، والـ At-Least-Once Delivery.

## المرحلة 3: التحقق المعماري (Architecture Verification)

- `[x]` **AUDIT-WRK-VERIFY-001**: Verify cursor ordering matches tuple filtering. Status: Completed.
- `[x]` **AUDIT-WRK-VERIFY-002**: Verify At-Least-Once delivery semantics. Status: Completed.
- `[x]` **AUDIT-WRK-VERIFY-003**: Verify advisory lock exclusivity. Status: Completed.
