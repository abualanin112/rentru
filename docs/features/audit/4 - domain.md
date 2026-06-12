# نموذج البيانات (Domain Model)

## AuditLog

نموذج التدقيق يُعد نموذجاً مفصولاً (Decoupled Schema) لضمان بقاء السجلات والأحداث دون تأثر بعمليات الحذف للكيانات الأخرى. يعتمد على مراجع ناعمة (Soft References).

```prisma
model AuditLog {
  id String @id @default(uuid()) @db.Uuid

  // المراجع الناعمة (Soft References)
  actorId  String? @map("actor_id") @db.Uuid
  branchId String? @map("branch_id") @db.Uuid // 🌟 العزل المناطقي (Snapshot At Event Time)

  event String  @db.VarChar(100)
  reqId String? @map("req_id")

  action String @db.VarChar(100)

  targetId   String? @map("target_id") @db.Uuid
  targetType String? @map("target_type") @db.VarChar(50)

  // التغييرات اللحظية المطهرة
  oldValues Json?   @map("old_values") @db.JsonB
  newValues Json?   @map("new_values") @db.JsonB
  metadata  Json?   @db.JsonB
  reason    String? @db.Text

  // حقول محجوزة للاستخدام المستقبلي الجنائي (Forensics). لا تُستخدم حالياً.
  ipAddress String? @map("ip_address") @db.VarChar(45)
  userAgent String? @map("user_agent") @db.Text

  createdAt DateTime @default(now()) @map("created_at")

  // استراتيجية الفهرسة (Index Strategy) لضمان أداء الاستعلام المباشر (Direct DB Access)
  @@index([actorId])
  @@index([action])
  @@index([reqId])
  @@index([event, createdAt])
  @@index([createdAt])
  @@index([targetType, targetId]) // 🌟 البحث الخاص بالكيانات (Entity-centric Search)
  @@index([branchId, createdAt])  // 🌟 العزل والفرز (Isolation & Pagination)

  @@map("audit_logs")
}
```

### 1. `branchId` (Snapshot At Event Time)

حقل `branchId` في هذا النموذج لا يمثل الفرع الحالي للمستخدم (Current User Branch)، بل يمثل لقطة زمنية (Snapshot) للفرع الذي حدث فيه الإجراء وقت وقوعه. المستخدم قد ينتقل بين الفروع مستقبلاً، لكن التدقيق يجب أن يمثل الواقع وقت وقوع الحدث بدقة.

### 4. التصدير إلى التخزين البارد (Event Forwarding & Cold Storage)

- **مبدأ الحفظ الممتد**: يتم سحب السجلات دورياً باستخدام **هيكلية المؤشر (Cursor Pattern)** عبر جدول `AuditExportCursor` مخصص، وذلك لضمان بقاء جدول التدقيق الأساسي غير قابل للتعديل تماماً (100% Immutable).
- **التنسيق والوجهة**: يتم تحويل الدفعات إلى صيغة `NDJSON`، تُضغط عبر `GZIP`، ثم تُرفع إلى **Cloudflare R2** ليتم استهلاكها لاحقاً من أنظمة SIEM.
- **سياسة التوصيل (Delivery Guarantee)**: نضمن توصيل السجلات مرة واحدة على الأقل (At-Least-Once Delivery). يمكن أن يحدث تكرار إذا فشل تحديث المؤشر بعد نجاح الرفع، ولكن يمنع منعاً باتاً فقدان أي سجل.
- **مسح البيانات**: تأجيل أي عملية حذف أو تفريغ للسجلات من قاعدة بيانات PostgreSQL حتى اعتماد سياسة صريحة (Retention ADR).

#### Audit Export Consistency Rules

1. AuditLog remains immutable.
2. AuditExportCursor is the only mutable export state.
3. Cursor ordering must always be:
   createdAt ASC, id ASC
4. Cursor filtering must match ordering exactly.
5. Export retries are automatic.
6. Duplicate exports are acceptable.
7. Data loss is unacceptable.

### 2. استرجاع الفاعلين (Actor History) وتخطي الحارس (Bypass Silent Guardian)

استرجاع بيانات الفاعل (`Actor`) لعرضها في السجل يتطلب آلية تتجاوز فلتر الحذف المنطقي (Silent Guardian). الهدف المعماري الأوسع هو ربط سجلات التدقيق بموظفين تم طردهم أو حذفهم منطقياً. الحل التقني لذلك يترك لمرحلة التنفيذ (سواء كان استعلام Raw SQL، أو مثيل Prisma Client منفصل بدون Extension، أو Repository مخصص).

### 3. استراتيجية الفهرسة لتعويض الـ Caching

نظراً لمنع التخزين المؤقت، يعتمد الأداء بشكل كلي على قاعدة البيانات، تم بناء فهارس مركبة مثل `(targetType, targetId)` لدعم أنظمة الـ ERP في جلب تاريخ كامل لكيان محدد بسرعة، وفهرس `(branchId, createdAt)` لخدمة لوحة تحكم الفرع.
