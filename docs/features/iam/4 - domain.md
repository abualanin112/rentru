### مجال إدارة الهوية والوصول (IAM Domain - Enterprise Edition)

#### 1. الكيانات الأساسية (Core Entities)

**المستخدم (User)** الهوية التشغيلية للموظف. خالي من أي بيانات اعتماد محلية (Local Credentials) لضمان الأمان، ويعمل كمرجع أبدي للعمليات المالية.

- **الحقول:** `id`, `email`, `googleId`, `firstName`, `lastName`, `isActive`, `deletedAt`, `branchId`، الطوابع الزمنية.
- **الثوابت (Invariants):**

  - لا توجد كلمات مرور. المصادقة تتم عبر مزود الهوية حصراً.
  - **يُحظر الحذف الفعلي.** يتم إنهاء الخدمة عبر `deletedAt` (Soft Delete).
  - يجب أن يكون البريد الإلكتروني فريداً عالمياً.

**الجلسة (Session) - _(بديل الـ Token القديم)_** التمثيل المادي (Stateful) لتواجد الموظف على جهاز معين، مما يمنح الإدارة قدرة الطرد اللحظي.

- **الحقول:** `id`, `userId`, `deviceId`, `refreshTokenHash`, `expiresAt`، الطوابع الزمنية.
- **الثوابت (Invariants):**

  - **سياسة الجهاز الواحد الصارمة:** يُسمح بجلسة واحدة فقط لكل مستخدم عبر قيد `@@unique([userId])`.
  - تُحذف تلقائياً وبشكل متتالي إذا تم إيقاف أو أرشفة المستخدم.
  - لا يُخزن التوكن كنص واضح (يجب تشفيره بـ SHA-256).

**الدعوة (Invitation) - _(الكيان الجديد)_** البوابة الوحيدة والآمنة لدخول أي موظف جديد للنظام.

- **الحقول:** `id`, `email`, `inviteToken`, `roleId`, `branchId`, `status`, `expiresAt`، الطوابع الزمنية.
- **الثوابت (Invariants):** يجب أن تنتهي صلاحية رمز الدعوة تلقائياً. تُربط الدعوة بدور وفرع محددين مسبقاً قبل انضمام الموظف.

#### 2. كيانات التفويض والوصول (RBAC Entities)

**الدور (Role)** حزمة تشغيلية مسماة تحدد مستوى السُلطة والصلاحيات اللحظية للموظف.

- **الحقول:** `id`, `name`, `description`, `level`, `version`, `isSystem`، الطوابع الزمنية.
- **الثوابت (Invariants):**

  - يُمنع حذف الأدوار التأسيسية (`isSystem: true`).
  - الأرقام الأعلى في حقل `level` تشير إلى امتيازات أكبر وتمنع تصعيد الصلاحيات (Privilege Escalation).
  - يمكن زيادة حقل `version` عند أي تعديل لتتبع النسخ (تاريخياً كان يستخدم للإبطال الذكي قبل التحول للاستعلام المباشر).

**الصلاحية (Permission)** حق ذرّي (Atomic Right) لأداء إجراء على مورد ضمن نطاق معين.

- **الحقول:** `id`, `group` (للتنظيم في الواجهة)، `action`, `subject` (المورد), `scope`, `conditions` (لحالات ABAC المعقدة).
- **الثوابت (Invariants):** المزيج بين `action` و `subject` و `scope` يجب أن يكون فريداً عالمياً لمنع التكرار في قاعدة البيانات.

#### 3. كيان التتبع والأمان (Security Entities)

**سجل التدقيق (AuditLog) - _(الدرع الأمني)_** السجل غير القابل للتعديل الذي يوثق كل حركة حساسة داخل النظام.

- **الحقول:** `id`, `actorId`, `action`, `targetId`, `targetType`, `oldValues`, `newValues`, `ipAddress`، الطوابع الزمنية.
- **الثوابت (Invariants):** يُضاف إليه فقط (Append-only). لا يمكن تعديل أو حذف أي سجل بعد إنشائه.

### خريطة العلاقات المعمارية المحدثة (Entity Map)

```
 Branch (1) ------- (M) User
 Branch (1) ------- (M) Invitation

 User (1) --------- (1) Session
 User (1) --------- (M) UserRole (M) --------- (1) Role
 User (1) --------- (M) AuditLog (كـ Actor أو Target)

 Invitation (M) --- (1) Role

 Role (1) --------- (M) RolePermission (M) --- (1) Permission
```

## الاسكيما

```
// ==========================================
// 1. Core Users, Sessions & Invitations
// ==========================================

model Branch {
  id       String  @id @default(uuid()) @db.Uuid
  name     String  @unique @db.VarChar(100)
  isActive Boolean @default(true) @map("is_active")

  users       User[]
  invitations Invitation[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("branches")
}

model User {
  id    String @id @default(uuid()) @db.Uuid
  email String @unique @db.VarChar(255)

  // 🌟 التحديث 1: إزالة passwordHash واستبداله ببيانات Google SSO
  googleId  String? @unique @map("google_id") @db.VarChar(255)
  avatarUrl String? @map("avatar_url") @db.Text

  firstName String @map("first_name") @db.VarChar(100)
  lastName  String @map("last_name") @db.VarChar(100)

  // 🌟 التحديث 2: حالة التشغيل ومفتاح الإيقاف الفوري
  isActive Boolean @default(true) @map("is_active")

  // 🌟 التحديث 3: الحذف الناعم (Soft Delete) لمنع دمار السجلات المالية
  deletedAt DateTime? @map("deleted_at")

  // التنظيم والصلاحيات
  branchId String?    @map("branch_id") @db.Uuid
  branch   Branch?    @relation(fields: [branchId], references: [id], onDelete: Restrict)
  roles    UserRole[]

  // الجلسات المفتوحة
  sessions Session[]

  lastLoginAt DateTime? @map("last_login_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([email])
  @@index([branchId])
  @@index([deletedAt]) // تسريع فحص الحسابات غير المؤرشفة
  @@map("users")
}

// 🌟 جديد: جدول إدارة الجلسات وبصمات الأجهزة
model Session {
  id     String @id @default(uuid()) @db.Uuid
  userId String @map("user_id") @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  deviceId         String @map("device_id") @db.VarChar(255)
  refreshTokenHash String @map("refresh_token_hash") @db.Text

  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  // سياسة الجهاز الواحد الصارمة: جلسة واحدة فقط لكل مستخدم في النظام بأكمله
  @@unique([userId])
  @@index([expiresAt]) // لتسريع عملية التنظيف (Garbage Collection)
  @@map("sessions")
}

// 🌟 جديد: جدول نظام الدعوات (Onboarding)
model Invitation {
  id          String @id @default(uuid()) @db.Uuid
  email       String @db.VarChar(255)
  inviteToken String @unique @map("invite_token") @db.VarChar(255)

  // الصلاحيات التي سيحصل عليها فور قبوله الدعوة
  roleId String @map("role_id") @db.Uuid
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  branchId String? @map("branch_id") @db.Uuid
  branch   Branch? @relation(fields: [branchId], references: [id], onDelete: Cascade)

  status    String   @default("PENDING") @db.VarChar(20) // PENDING, COMPLETED, REVOKED
  expiresAt DateTime @map("expires_at")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([email])
  @@index([expiresAt])
  @@map("invitations")
}

// ==========================================
// 2. Dynamic IAM (إدارة الهويات والصلاحيات)
// ==========================================

model Role {
  id          String  @id @default(uuid()) @db.Uuid
  name        String  @unique @db.VarChar(50) // "PropertyManager", "Accountant"
  description String? @db.Text
  isSystem    Boolean @default(false) @map("is_system") // لمنع حذف الأدوار الأساسية

  // 🌟 التحديث: رقم الإصدار لتتبع التعديلات (تاريخياً كان يستخدم للإبطال الذكي)
  version Int @default(1)
  level   Int @default(0) // 0 هو الأدنى، 100 هو الأعلى (للمسؤولين)

  users       UserRole[]
  permissions RolePermission[]

  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")
  invitations Invitation[]

  @@index([level])
  @@map("rbac_roles")
}

model Permission {
  id String @id @default(uuid()) @db.Uuid

  // 🌟 التحديث: مجموعة الصلاحية (UI Concern) لسهولة العرض في الفرونت إند
  group String @db.VarChar(50) // مثلاً: "Financials", "Operations", "System"

  action  String @db.VarChar(50) // "view", "create", "update", "delete"
  subject String @db.VarChar(50) // "Property", "Reservation", "Invoice"

  // 🌟 التحديث: النطاق الأساسي للصلاحية
  scope String @db.VarChar(50) // "own", "branch", "any"

  description String? @db.Text

  // حقل قوي جداً للمستقبل (ABAC): للحالات الشاذة التي لا يغطيها الـ Scope
  conditions Json? @db.JsonB

  roles RolePermission[]

  // 🌟 التحديث: الفهرس المركب يشمل النطاق لمنع تكرار (action + subject + scope)
  @@unique([action, subject, scope])
  @@map("permissions")
}

// ==========================================
// 3. Join Tables (جداول الربط)
// ==========================================

model RolePermission {
  roleId       String @map("role_id") @db.Uuid
  permissionId String @map("permission_id") @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  // المفتاح الأساسي المركب
  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserRole {
  userId String @map("user_id") @db.Uuid
  roleId String @map("role_id") @db.Uuid

  assignedAt DateTime @default(now()) @map("assigned_at")
  assignedBy String?  @map("assigned_by")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

// ==========================================
// 4. Audit Log (سجل التتبع الأمني) - 🌟 جديد 🌟
// ==========================================

model AuditLog {
  id String @id @default(uuid()) @db.Uuid

  // من قام بالفعل؟ (الفاعل)
  actorId String? @map("actor_id") @db.Uuid

  event String  @db.VarChar(100)
  reqId String? @map("req_id")

  // ماذا فعل؟
  action String @db.VarChar(100) // "Role_Updated", "User_Suspended", "Login_Failed"

  // على من وقع الفعل؟ (المفعول به - اختياري)
  targetId   String? @map("target_id") @db.Uuid
  targetType String? @map("target_type") @db.VarChar(50) // "User", "Role", "Branch"

  // تتبع التغييرات الدقيقة
  oldValues Json?   @map("old_values") @db.JsonB
  newValues Json?   @map("new_values") @db.JsonB
  metadata  Json?   @db.JsonB
  reason    String? @db.Text

  // بيانات تقنية للـ Security Analysis
  ipAddress String? @map("ip_address") @db.VarChar(45)
  userAgent String? @map("user_agent") @db.Text

  createdAt DateTime @default(now()) @map("created_at")

  // الفهارس الاستراتيجية لتسريع لوحة تقارير الأمان
  @@index([actorId])
  @@index([action])
  @@index([reqId])
  @@index([event, createdAt])
  @@index([createdAt])
  @@map("audit_logs")
}
```
