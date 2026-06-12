# كتالوج أحداث التدقيق (Audit Event Catalog)

> [!CAUTION]
> للتحكم في نمو قاعدة البيانات ومنع تضخمها السريع، هذا الكتالوج يعتبر الدليل الإلزامي الوحيد للأحداث المسموح بتسجيلها.

> [!IMPORTANT]
> **القاعدة الذهبية:** أي حدث تدقيق جديد (New Audit Event) يجب إضافته صراحةً إلى هذا الكتالوج (Event Catalog) أولاً قبل كتابة أي كود أو البدء بتنفيذه. هذه القاعدة تمنع الفوضى العشوائية للأحداث في المستقبل.

## 1. الأحداث الإلزامية (Mandatory Events)

يجب توثيق جميع هذه الأحداث فور حدوثها لتلبية معايير الامتثال الأمني:

### أمن وإدارة الهويات (IAM & Security)

- `iam.auth.login.success`
- `iam.auth.logout`
- `iam.token.refresh`
- `iam.token.revoked` (مثال: عند رصد إعادة استخدام Token)
- `iam.user.created` / `iam.user.updated`
- `iam.user.suspended` / `iam.user.activated`
- `iam.user.archived` (عند الحذف المنطقي Soft Delete)
- `iam.role.created` / `iam.role.updated` / `iam.role.deleted`
- `iam.permission.assigned` / `iam.permission.removed`
  - _(ملاحظة: `iam.permission.removed` يُستخدم حصرياً عند السحب الفردي للصلاحيات أو إلغاء دور محدد، ولا يُستخدم في عمليات Role Reassignment المجمعة ما لم تُعامل كسحب وإضافة صريحة)._
- `iam.invitation.created` / `iam.invitation.revoked`

## 2. الأحداث الممنوعة (Forbidden Events)

يُمنع منعاً باتاً استدعاء `logEvent` للأحداث التالية، لتجنب إنشاء سجلات "صاخبة" (Noisy Logs) تؤدي لإجهاد قواعد البيانات:

- `system.health.check` أو أي فحص دوري للمراقبة.
- `metrics.polled` أو أي طلب استرجاع إحصائيات.
- أي عمليات قراءة، تصفح، فلترة، أو بحث (مثلاً: لا تسجل حدث `notes.list.viewed` أو `users.search.performed`).
- نبضات العمال المجدولين (Cron Heartbeats).

## 3. الأحداث الاختيارية (Optional Domain Events / Future Events)

يُسمح (ولكن لا يُفرض في مرحلة الـ MVP) تسجيل الأحداث التي تغير حالة الكيانات الجوهرية للعمل أو الأحداث غير المدعومة حالياً:

- `iam.auth.login.failed` (مؤجل حتى يتم دعم تسجيل الدخول بكلمات المرور حيث أن النظام الحالي يعتمد حصرياً على Google SSO).
- `notes.note.created`
- `notes.note.updated`
- `notes.note.deleted`
