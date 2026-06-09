# Rentro — Core Operational Flow

This flow represents the primary operational lifecycle inside Rentro, from preparing properties before the season, through bookings and daily operations, all the way to checkout, inventory review, and end-of-season reporting.

---

# 1. Pre-Operations Phase — Property Acquisition & Preparation

The operational cycle begins with preparing properties and units before they become available for booking.

## Property & Unit Setup

Buildings and units are added into the system with a clear hierarchical structure.

Each property contains:

- Buildings
- Floors
- Units

Every unit includes:

- Photos
- Availability status
- Location
- Specifications
- Operational notes
- Current readiness state

The UI focuses on giving operators a fast visual overview of occupancy and readiness.

---

## Owner Contracts & Scheduled Payments

For rented properties, owner agreements are managed through a simple operational workflow.

The system allows teams to:

- Register lease agreements
- Track payment schedules
- View upcoming installments
- Monitor overdue obligations

The experience is designed around visibility and reminders rather than accounting terminology.

---

## Furniture, Appliances & Assets

Furniture, appliances, and operational inventory are distributed across units.

Teams can:

- Assign assets to units
- Track transfers between units and storage
- Review missing or damaged items
- Monitor seasonal storage activity

The UI emphasizes inventory visibility and operational tracking.

---

## Maintenance & Seasonal Preparation

Before operational periods begin, units may require:

- Repairs
- Cleaning
- Painting
- Equipment replacement

Maintenance requests and preparation tasks are managed through lightweight workflows with:

- Task assignment
- Progress tracking
- Photo attachments
- Status updates

The experience is optimized for mobile operational use.

---

# 2. Operations Phase — Booking, Rental & Daily Operations

This phase represents the day-to-day rental operations of the business.

---

## Unit Distribution & Operational Permissions

Units can be assigned to branches or operational offices based on geography or business structure.

Managers and reception teams operate within their assigned scope, while authorized central managers can access all units when necessary.

The UX prioritizes:

- clarity
- fast access
- role-based visibility
- minimal operational friction

---

## Availability, Pricing & Unit Selection

Operators can quickly search for:

- available units
- dates
- pricing ranges
- occupancy gaps

Pricing remains flexible and seasonal.

The interface helps staff minimize empty gaps between reservations and maximize occupancy efficiency.

The booking experience focuses on:

- speed
- visual availability
- low cognitive load

---

## Instant Rental Flow

For walk-in or immediate bookings:

- The guest reviews the unit
- Staff selects dates and pricing
- The booking is confirmed
- Payment is collected
- The unit status changes to Occupied

The entire flow is designed to complete within seconds with minimal navigation.

---

## Reservation Flow

For advance reservations:

- The guest selects a unit and stay period
- A deposit is collected
- The reservation is temporarily held
- The remaining amount is collected during Check-in

The system clearly communicates:

- hold timers
- payment states
- reservation status
- booking conflicts

The UI heavily focuses on preventing double-booking and operational confusion.

---

## Monthly & Long-Term Rentals

Some units may operate under:

- monthly contracts
- seasonal agreements
- yearly rentals

The system supports:

- scheduled installments
- reminders
- recurring payment visibility
- contract timelines

without exposing accounting complexity to operational users.

---

## Check-in, Check-out & Cleaning Operations

After guest checkout:

- Staff reviews the unit condition
- Inventory status is verified
- The unit becomes:Vacant – Dirty

The system automatically creates cleaning or maintenance tasks.

Once completed, the unit returns to:

- Ready to Rent

Operational boards prioritize:

- task clarity
- status visibility
- fast worker coordination

---

## Operational Expenses

Operational expenses can be attached directly to:

- units
- branches
- operational activities

Examples include:

- cleaning
- utilities
- maintenance
- commissions
- emergency purchases

The UX focuses on:

- quick capture
- mobile-first submission
- approval visibility
- operational impact

---

## Cash Handover & Daily Reconciliation

Branches and offices submit daily cash collections through guided reconciliation flows.

The system provides:

- shift handover visibility
- cash tracking
- discrepancy detection
- exception handling

The experience prioritizes operational trust and accountability.

---

# 3. End-of-Season Phase — Closure, Inventory & Reporting

At the end of operational periods or rental seasons, the system transitions into closure workflows.

---

## Property Closure & Contract Decisions

Some rented units may:

- be returned to owners
- renew contracts
- pause operations temporarily

Owned units may remain inactive until future seasons or holidays.

The system provides clear operational status transitions and contract visibility.

---

## Inventory Audit & Storage

Teams perform a full inventory review for:

- furniture
- appliances
- operational assets
- storage items

The workflow includes:

- condition tracking
- storage transfers
- missing item detection
- seasonal archiving

The UX focuses on structured operational review rather than warehouse complexity.

---

## Final Operational Reports

At the end of the cycle, Rentro generates operational summaries for each unit including:

- Total revenue
- Total expenses
- Net operational performance
- Unit condition
- Asset condition
- Outstanding obligations
- Operational notes

The reporting experience focuses on actionable operational visibility instead of heavy accounting reports.
