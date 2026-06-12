# Project Understanding Draft — Rentru (Product Discovery & UX Brief)

Date: 2026-06-07
Format: A project discovery brief for UI/UX designers, product teams, developers, and stakeholders.

---

**Executive Summary**

- **The product**: An operations-first platform for managing short- and long-term unit rentals, focused on operational user experience (PMS/Operational ERP).
- **Audience**: Reception staff and branch teams, operations and maintenance workers, operational accountants, branch and general managers.
- **Core value**: Unite booking, payment, and settlement flows into fast, simple operational screens that prevent double bookings and improve cash and per-unit profit tracking.
- **How it differs from traditional ERP**: "Operational-first" — hide accounting complexity from operational users, provide simple mobile-first screens, and make sharing via WhatsApp easy in the MVP.

---

**1. Business Model Understanding**

- **Business model**: Master lease / rental arbitrage. Some units are company-owned; others are rented from owners.
- **Revenue streams**: Daily/monthly/yearly rents + service fees + penalties/compensations (damage fees, fines) + add-on services.
- **Main costs**: Owner payouts (treated as amortized daily cost), cleaning and maintenance, broker commissions, utility bills, staff wages.
- **Operational cash flow**: Branches → central office → accountant → manager → bank. The system tracks separate `CashLocations` for each step.
- **MVP constraints**: No PO / three-way matching / complex AP. Simple expenses (immediate or scheduled) with automated approval thresholds.

---

**2. User Types & Roles (UX implications)**

- **Reception / Office Staff**
  - **Goal**: Close the sale quickly, generate a payment link, print/share the contract.
  - **Needs**: Fast availability search, actions: Hold, Generate Payment Link, Convert → Contract, Check-in.
  - **Financial view**: Shift drawer balance only.

- **Field Operations / Housekeeping**
  - **Goal**: Complete tickets quickly, confirm cleaning, upload proof photos, and report unit issues immediately.
  - **Needs**: Lightweight mobile UI for tasks: a daily list or simplified work queue (an alternative to full Kanban), attach photos, a quick “Report Issue” button to create maintenance tickets with photos and unit location.
  - **Financial view**: No general financial reports.

- **Operational Accountant**
  - **Goal**: Daily settlements, approve scheduled expenses, post entries to the GL.
  - **Needs**: Daily tables, AR aging, cash transfer workflows.
  - **Financial view**: Full operational financial visibility (in some organizations they may not see owner accounts).

- **Branch Manager**
  - **Goal**: See branch performance, approve quickly, review low-margin units.
  - **Needs**: Branch dashboard, alerts list, bulk approval.

- **Operations Manager**
  - **Goal**: Monitor overall and branch/unit performance, identify low-margin units, approve large expenses, and handle operational exceptions.
  - **Needs**: Central dashboard showing low-margin units, expense-to-revenue deviation alerts, interface for reviewing and approving large expenses (bulk approve/reject), access to cash reconciliation exception pages.
  - **Financial view**: Analytical view (P&L per unit, large expenses, scheduled owner obligations) with drill-down to journal lines and event timelines (accounting details shown only to authorized users).

- **Super Admin**
  - **Goal**: Configure permissions, approval thresholds, and period locks.
  - **Needs**: RBAC tools, audit logs, period lock controls.

---

**3. Core System Domains (UX touchpoints)**

- **Property & Unit Management** — A unit page should include building-floor-unit structure management and a detailed unit view with photos, status, calendar, historical returns, custody/deposit, and maintenance.
- **Bookings & Contracts** — A simplified flow: temporary booking → payment link → digital contract → invoices.
- **Payments & Cash Management** — Real-time view of `CashLocations` and shift handover actions.
- **Expenses & Approvals** — Mobile quick-entry screen with approval threshold checks and bulk approval.
- **Owners & Settlements** — A dedicated owner settlement screen with period filters and export options.
- **Operations & Housekeeping** — A simplified Kanban board for staff with photos and time slots.
- **Finance & Reporting** — Accounting pages hidden from operational users, visible to accountants and managers.
- **Calendar & Availability Management** — Central calendar for bookings and occupancies showing unit state per day with drag & drop, check-in/check-out, cleaning, maintenance, and visual conflict indicators.
- **Analytics & Management Dashboard** — Management dashboard showing KPIs like occupancy, revenue, ADR, expenses, collections, branch/unit performance, and operational alerts with time filters and interactive reports.
- **Staff & Workforce Management** — Worker and staff management with daily rosters, task assignments, attendance, tracking cleaning/maintenance tasks, and mobile photo/status updates.

---

**4. Major Operational Workflows (UI/UX step-by-step)**

- **Booking → Contract → Payment (Reserve-to-Cash)** — Availability is shown in the calendar/search → open the Quick Book modal to capture guest data and price options → show a visible Hold with a 15-minute countdown while waiting for payment → show the payment link with `Copy` and `Share via WhatsApp` actions → the booking appears as "Awaiting Payment" on the calendar with a countdown and follow-up actions (Resend Link / Mark Paid) → when payment is confirmed show a "Confirmed" notification and provide a preview/sendable contract and invoice (printable/emailable) → short Check‑in screen to collect any remaining balance and record receipt (reference/photos) → after Check‑in the unit state updates to "Occupied" and an operational revenue summary is shown to authorized users without exposing accounting journal details.

- **Deposit Handling** — Security deposits are stored as a held amount until Check‑in, then moved to the appropriate final status. The UI must show the deposit state clearly during all booking stages.

- **Expense Registration** — Staff enter expenses via a fast mobile form (photo, amount, unit). The system automatically checks approval thresholds; large expenses go to manager approval. Clear statuses: Pending / Approved / Rejected.

- **Owner Settlement** — Owner settlement screens show periodic payouts and operating costs linked to contracts and units, with filters by period and contract and export options.

- **Maintenance Requests & Work Orders** — Staff create maintenance tickets with description and photos, which convert to work orders and get assigned to a technician or worker, with lifecycle tracking: Reported → In Progress → Fixed → Closed, and with post-execution photos/proof attachments.

- **Daily Reconciliation** — Branches submit daily cash reports. These are centrally reviewed and matched, with any differences shown on an exceptions dashboard for operational review.

---

**5. Financial Logic (operational view for UX)**

**Operational Financial Architecture (overview for UX)**

This product uses an operational-first financial model. Accounting remains in the backend; the UI organizes money as workspaces that match how staff think and act day-to-day.

Primary operational financial workspaces (UI level):

1. **Accounts / Financial Activity**

- Purpose: real-time view of money movement and daily treasury-like operations.
- Contains: incoming/outgoing transactions, current balances per `CashLocation`, activity feed, drawer handoff, shift settlement, end-of-day close actions, quick reconciliation tools.
- UX focus: visibility, monitoring, reconciliation — not journal editing.

2. **Expenses**

- Purpose: unified outgoing-money workspace for all operational spending.
- Contains: petty cash, operational expenses, scheduled payments, salaries, maintenance costs, service payments, recurring/instalment-based costs.
- UX focus: smart filters, search-first, category views, quick submit (photo + amount + unit) and approval flows.

3. **Vendors (Obligations)**

- Purpose: scheduled obligations workspace (not a classic AP module).
- Contains: vendors, large scheduled maintenance payments, instalment commitments, recurring external obligations, due-date tracking and partial payments.
- UX focus: schedule & due-date management, installment views, obligation lifecycle.

4. **Collections**

- Purpose: all incoming-money operations (customer-facing collections).
- Contains: customer payments, rental income, scheduled collections, installments, deposits/security deposits, overdue collections, partial collections.
- UX focus: overdue tracking, collection workflows, payment scheduling, quick receipts and deposit handling.

5. **Owners**

- Purpose: management of master lease contracts and fixed recurring owner payments related to rented units/buildings.
- Contains: owners, master lease contracts, owned/rented units, scheduled owner installments, due dates, payment statuses, payout history, and recurring payment reminders.
- UX focus: recurring payment tracking, contract period management, installment scheduling, due-date visibility, and clear breakdowns of paid, pending, and overdue amounts. Owners are handled as long-term lease obligations rather than revenue-sharing partners.

UX implication: expose these five workspaces as top-level operational pages when the mental model changes (treasury vs. collections vs. obligations vs. owner settlements). Use filters and contextual actions within each workspace — avoid exposing AP/AR/GL vocabulary.

---

**6. Product Philosophy (UX guidance)**

Fast. Clear. Reliable

- **Workflows over modules** — The product is designed around real daily workflows (Booking → Payment → Check‑in → Check‑out) rather than separated accounting modules. Operational users think "what do I need to do now?" not in accounting or technical terms.

- **Operational simplicity** — Minimize steps, screens, and fields. Interfaces must be fast, clear, and learnable with little training, aimed at quick operational use.

- **System-guided operations** — The system should assist the user with automation and smart suggestions: prevent double bookings, suggest prices and units, autofill previous data, and post financial operations in the background without manual complexity.

- **Hide complexity & progressive disclosure** — Accounting and technical detail stays in the backend; the UI shows only what the user needs. Show more detail only when needed or for authorized users.

- **Mobile-first & field-ready UX** — Designed for efficient mobile use because many operational tasks are field-based. Interfaces should be large, clear, fast, and resilient to intermittent connectivity.

- **WhatsApp-centric operational flows** — WhatsApp is a core part of daily operations; make it easy to share contracts, invoices, and payment links from inside the system without complex integrations in MVP.

- **Visual-first operational design** — Use colors, icons, and status chips to communicate state quickly—users read visual state faster than long text in busy environments.

- **Error prevention by design** — Prevent mistakes with smart constraints, alerts, and checks (prevent double bookings, warn on cash differences, prevent check-in without payment where required).

- **Operational dashboards, not decorative analytics** — Dashboards focus on actionable operational data (occupancy, cash, collections, empty units, overdue items) rather than decorative charts.

- **Performance, reliability & trust** — Speed and stability are critical. Provide autosave, undo, activity logs, and fast responses even in poor network conditions.

---

**8. Risks & Complexity Areas (UX & Product risks)**

- **Double-booking:** The micro-hold UX must clearly show time remaining and end-of-hold or failure states.
- **Accounting leak:** Showing accounting details to operational users may confuse them; hide accounting complexity and show operational summaries instead.
- **Cash mismatch:** Manual cash handovers produce exceptions; design reconciliation flows that surface and help resolve issues quickly.
- **Role-based UX complexity:** Varied permissions across operations, management, and accounting creates challenges for clean, role-appropriate UI.
- **Operational vs Financial UI separation:** Balance hiding accounting complexity without creating data duplication or forcing users to jump between screens.
- **Navigation & information architecture complexity:** Decide where to use tabs, filters, or unified pages, especially where bookings, collections, contracts, and financial state overlap.
- **Business model abstraction complexity:** Balance a chosen operational model for the current company with flexibility for other business models; decide which behaviors are fixed, which are settings, and which need UI-level flexibility without overcomplicating the product.

---

**9. Strategic Recommendations (actionable, ordered)**

### MVP Focus (0–3 Months)

Build the operational foundation:

- Calendar & availability management
- Quick booking flow
- Payment link integration
- Check-in / Check-out workflows
- Properties, buildings, and units management
- Unit detail page with operational status and calendar
- Quick expense registration
- Branch cash reconciliation & CashLocations workflows
- Core RBAC roles: Admin, Manager, Accountant, Receptionist
- Guests / Customers page as a lightweight CRM

### Short Term (3–6 Months)

After stabilizing core operations:

- Collections workspace
- Vendors & obligations management
- Owner settlement automation
- Operational & management analytics dashboards
- Bulk approvals
- Exceptions dashboard
- Additional operational roles: Workers, Maintenance Staff, Housekeeping, Supervisors
- Furniture, appliances, and distributed inventory management per unit

### Medium Term (6–12 Months)

Expand to CRM and smarter operations:

- Sales & marketing CRM
- WhatsApp, Facebook, and TikTok integrations
- Customer conversation & lead tracking
- Partial communication automation
- Rule-based pricing editor
- Basic forecasting & analytics
- SLA management for workers and maintenance operations

### Phase 3 — Distribution & Platform Expansion

Integrations and deployment models:

- Integrations with Airbnb, Booking.com, Agoda, and others
- Booking, pricing, and availability synchronization
- Basic channel management
- SaaS deployment for SMBs and customizable self-hosted deployments for strategic partners
- Controlled partner-level customization without breaking the core system

### Phase 4 — Booking Platform & Multi-Tenant Ecosystem

Long-term platform goals:

- Native booking platform and direct booking engine
- Customer / guest portal
- Multi-tenant architecture and multi-company & multi-branch management
- Advanced permissions & tenant isolation
- Future marketplace / partner ecosystem
- Centralized operational and analytics tooling across tenants

---

**10. Acceptance Criteria — MVP (UX checks)**

- Booking creation prevents double-booking in 99.9% of UX flows; hold timeout visible.
- Payment link state updates within 10s after webhook (or shows pending state).
- Check-in flow completes in < 30s (find booking, print contract, accept payment, change unit state).
- Expense capture (mobile) takes < 45s including photo upload and auto-approval checks.
- Unit P&L loads < 500ms (direct PostgreSQL query) and allows drill-down to transactions.
