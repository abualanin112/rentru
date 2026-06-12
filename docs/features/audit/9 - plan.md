# خطة التنفيذ (Implementation Plan)

تم تقسيم تنفيذ ميزات المراقبة المتبقية إلى مراحل محددة تراعي القيود المعمارية المعتمدة وتضمن استقرار النظام.

## المرحلة 0: تحصين قاعدة البيانات والـ ALS (التحضير)

- **الهدف:** تطبيق التحصينات المعمارية قبل أي كود.
- **النطاق:** تحديث `schema.prisma` بإضافة `branchId` وفهارس `targetType/Id` وتحديث `audit.service.js` لاستخراج `branchId` من الـ `ALS`.

## المرحلة 1: واجهة الإدارة واسترجاع البيانات التاريخية

- **الهدف:** توفير واجهة برمجية لمديري النظام (Super Admins/Branch Admins) لاستعراض السجلات بطريقة موثوقة دون التعثر بآليات الحذف المنطقي.
- **النطاق:**
  - مسار `GET /v1/audit`.
  - دعم الـ Cursor Pagination لتحسين الأداء بدون Caching.
  - تجهيز آلية استرجاع تتجاوز (Silent Guardian) عند عرض (Actor History) لجلب بيانات المستخدمين المحذوفين منطقياً.
- **معايير الخروج:** اجتياز اختبار `AUDIT-DB-001` وظهور الموظفين المحذوفين بنجاح، واجتياز اختبارات الأمان الجديدة (`AUDIT-SEC-002` إلى `AUDIT-SEC-005`) لضمان عدم حدوث تسريب في العزل المناطقي للبيانات (Cross-Branch Data Leakage).

## المرحلة 2: التغطية الأمنية الشاملة لوحدة IAM

- **الهدف:** توثيق كل الإجراءات الحساسة بناءً على الـ (Event Catalog).
- **النطاق:** إضافة التقاط أحداث (Login, Logout, Roles, Permissions). سيتم دمج الدالة بطريقة (Fire-and-Forget) الآمنة.
- **معايير الخروج:** توليد السجلات تلقائياً في قاعدة البيانات.

## المرحلة 3: وظيفة إعادة الإرسال الخارجي (Event Forwarding Worker)

- **الهدف:** نقل السجلات للأنظمة الأمنية الباردة و أنظمة الـ SIEM لحفظها الممتد.
- **النطاق:** بناء خدمة مُجدولة بالاعتماد حصراً على `node-cron` وأقفال `pg_try_advisory_lock(880015)`. سيتم تصدير الدفعات بصيغة `NDJSON` مضغوطة عبر `GZIP` إلى مساحة `Cloudflare R2`.
- **حفظ الحالة**: سيتم استخدام `AuditExportCursor` للحفاظ على 100% Immutable AuditLog (ممنوع تحديث أو مسح السجلات الأساسية).
- **معايير الخروج:**
  - Immutable AuditLog
  - Cursor-based export state
  - Cloudflare R2 integration
  - NDJSON + GZIP export
  - Advisory lock protection
  - At-Least-Once delivery verified
  - Documentation reconciled
