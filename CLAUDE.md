IMPORTANT: After every development session, automatically update this CLAUDE.md file to reflect any new features built, new tables created, new files added, or any architectural changes made. Keep this file always up to date.

@AGENTS.md

# Supabase Migrations — Required Grants

Every migration file that creates a new table MUST include these three GRANT statements immediately after the table's RLS policies:

```sql
grant select, insert, update, delete on public.TABLE_NAME to authenticated;
grant select, insert, update, delete on public.TABLE_NAME to service_role;
grant select on public.TABLE_NAME to anon;
```

This is required for Supabase Data API compliance (policy effective October 30, 2026).
All existing tables are covered by `supabase/grant_all_tables.sql` (run once).
Every new table created after that must include its own grants in the same migration file.

---

# Snipforce — Comprehensive Project Documentation

## 1. PROJECT OVERVIEW

- **App name**: Snipforce
- **Purpose**: White-label salon and spa management SaaS platform
- **Target market**: Salons and spas globally, starting Pakistan
- **Model**: Each salon owner gets an isolated workspace; sub-users (staff, receptionists, managers) operate under the owner's data

## 2. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.2.4, React 19, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui (Base UI primitives) |
| Backend | Next.js API routes + server actions |
| Database | Supabase (PostgreSQL) with RLS |
| Auth | Supabase Auth |
| Hosting | Vercel |
| Charts | Recharts |
| CSV parsing | Papaparse |
| PDF generation | jsPDF |
| Toasts | Sonner |
| Theming | next-themes (dark mode) |
| Date utilities | date-fns |

## 3. PROJECT DETAILS

- **GitHub**: https://github.com/usmannasir451-debug/salon-saas
- **Live URL**: https://salon-saas-woad.vercel.app
- **Domain**: snip-force.com
- **Supabase project URL**: https://jhhvfapizghegvvkcyhg.supabase.co
- **Admin email**: usmannasir451@gmail.com

## 4. ENVIRONMENT VARIABLES

All required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY         # Admin key — used only in server-side code (team invites, user creation)
NEXT_PUBLIC_SITE_URL              # Full app base URL (used in email invite links)
NEXT_PUBLIC_ADMIN_EMAIL           # Email address that can access /admin page
```

## 5. ALL FEATURES BUILT

### Appointments & Scheduling
- Calendar-based appointment booking (by date, staff, service)
- Appointment status management (pending, confirmed, completed, cancelled)
- Payment status tracking per appointment
- Discount application with role-based limits (flat / percentage)
- Customer feedback collection on completed appointments
- Notes per appointment
- Invoice/receipt generation (PDF via jsPDF)

### Walk-In POS
- Instant walk-in checkout (no prior booking needed)
- Multi-service selection per transaction
- Multiple payment methods
- Discount support with discount reasons
- Loyalty points redemption at checkout
- Deal redemption at checkout
- Floating quick-access button across the dashboard

### Services
- Service catalog (name, duration, price)
- Bulk CSV import and export
- Used in appointments, walk-ins, and deals

### Deals
- Service bundles/packages (name, description, price, validity in days)
- Mapping of multiple services to a deal
- Bulk CSV import and export
- Deal redemption in appointments and walk-ins

### Staff Management
- Staff directory (name, phone, gender, designation, joining date)
- Emergency contact fields
- Salary configuration (fixed or commission-based)
- Leave allowance tracking
- Active/inactive status
- Link staff record to a login account (salon_members)
- Bulk CSV import and export
- Staff performance page (revenue generated, commissions)

### Branches
- Multi-location support
- Branch-level filtering across appointments, walk-ins, attendance, expenses

### Clients
- Auto-built from appointments and walk-ins (by phone number)
- Individual client detail page with full visit history
- Loyalty points balance per client

### Loyalty System
- Points earned on each appointment/walk-in (configurable earn %)
- Points redeemable at checkout
- Points expiry (configurable in days)
- Transaction log (earned / redeemed)

### Attendance Tracking
- Daily attendance per staff member
- Statuses: present, half_day, absent, leave, holiday
- Branch-level attendance
- Monthly attendance summary

### Payroll
- Fixed salary + commission calculation
- Pro-rata support (partial month)
- Attendance-based deductions
- Mark as paid (method + date)
- Monthly payroll entries per staff

### Expenses
- Expense logging (category, description, amount, date, paid by)
- Configurable expense categories and budgets (stored in profiles)
- Approval workflow (pending / approved / rejected)
- Recurring expense flag
- Receipt URL attachment
- Branch-level expenses

### Inventory
- Product/stock items (name, category, quantity, unit, cost price, supplier)
- Reorder level alerts
- Stock adjustment log (reason, adjusted by)
- Custom inventory categories (per owner)

### Reports & Analytics
- **Dashboard**: Real-time KPIs — appointments today, revenue, active clients, staff count, walk-ins
- **P&L Report**: Revenue vs expense breakdown (filterable by month/branch)
- **Staff Performance**: Per-staff revenue generated and commission earned
- **Export**: CSV/PDF export of appointments, clients, staff data

### Team & Role Management
- Owner invites team members by email
- Roles: owner, regional_manager, manager, receptionist, cashier, staff
- Custom per-member permissions override stored in DB
- Team members log in with their own credentials
- Owner can set/reset team member passwords
- Audit log (settings changes, member activity)

### Settings (owner-only)
- Salon branding: logo upload, primary color
- Salon details: address, phone, email, timezone, currency
- Discount limits per role (max_discount_owner / manager / cashier)
- Tax percentage
- Loyalty settings (enabled, earn %, expiry days)
- Subscription status management
- Expense categories and budgets
- Audit log viewer

### Admin Panel (`/admin`)
- Accessible only to the admin email defined in env
- Salon/user management from a super-admin perspective

### Auth & Onboarding
- Email/password login (no social auth)
- No self-signup — admin creates accounts only
- Password reset flow
- Onboarding flow for first-time setup
- Subscription suspended page with contact prompt

## 6. DATABASE TABLES

| Table | Purpose |
|-------|---------|
| `profiles` | One row per salon owner. Stores all salon settings, branding, limits, subscription status. |
| `services` | Services offered by the salon (name, duration, price). |
| `staff` | Staff directory with contact info, salary config, and active status. |
| `appointments` | Scheduled bookings — links client, service, staff, branch, deal. |
| `branches` | Physical locations of the salon. |
| `salon_members` | Team members with roles and custom permissions (sub-users of the owner). |
| `walk_ins` | Walk-in POS transactions — similar to appointments but immediate checkout. |
| `deals` | Service bundles with price and validity. |
| `deal_services` | Join table: which services belong to a deal. |
| `walk_in_services` | Join table: which services were in a walk-in transaction. |
| `expenses` | Business expense records with category, amount, approval status. |
| `inventory_items` | Product stock items (name, category, quantity, cost price). |
| `stock_adjustments` | Log of all stock changes with reason and adjuster. |
| `staff_salaries` | Salary configuration per staff member. |
| `payroll_entries` | Monthly payroll records (fixed + commission + attendance deductions). |
| `attendance_records` | Daily attendance per staff member (present/absent/leave/etc.). |
| `loyalty_transactions` | Points earned and redeemed per client phone number. |
| `custom_inventory_categories` | Owner-defined inventory categories. |
| `leads` | Demo/sales lead submissions from the landing page. |

### Key DB function
- `get_effective_owner_id()` — used in all RLS policies so both owner and their team members see the same data.

## 7. KEY ARCHITECTURE DECISIONS

- **No self-signup**: Only the admin (super-admin) can create owner accounts; only owners can invite team members.
- **White-label**: Each salon owner has isolated data. Branding (logo, color, name) is stored in `profiles` and applied globally per session.
- **Sub-user model**: Team members (`salon_members`) are linked to an owner via `owner_id`. All their queries resolve through `get_effective_owner_id()` so they see the owner's data.
- **Historical pricing**: `total_amount` is stored at the moment of booking/walk-in — prices never retroactively change completed transactions.
- **Currency**: Handled by the `useCurrency` hook; currency symbol and code are stored in `profiles.salon_currency` and formatted globally.
- **RLS on all tables**: Every table uses Supabase Row Level Security. Policies use `get_effective_owner_id()` to allow both the owner and their team members access.
- **Grants on all tables**: Every table has explicit `GRANT` statements for `authenticated`, `service_role`, and `anon` roles (see the top of this file).
- **Role-based permissions**: Roles define which nav items are visible; custom per-member permissions in `salon_members.permissions` can override defaults.
- **Server vs client Supabase**: `lib/supabase/client.ts` for browser, `lib/supabase/server.ts` for server components/actions, `lib/supabase/admin.ts` for privileged operations using SERVICE_ROLE_KEY.

## 8. FOLDER STRUCTURE

```
salon-saas/
├── app/                            # Next.js App Router root
│   ├── (auth)/                     # Auth pages (login, signup, reset-password)
│   ├── (dashboard)/                # Protected dashboard — all main features
│   │   ├── appointments/           # Booking management
│   │   ├── attendance/             # Staff attendance
│   │   ├── branches/               # Multi-location management
│   │   ├── calendar/               # Calendar view
│   │   ├── clients/                # Client list + [name] detail page
│   │   ├── dashboard/              # Analytics dashboard
│   │   ├── expenses/               # Expense tracking
│   │   ├── export/                 # Data export
│   │   ├── inventory/              # Stock management
│   │   ├── onboarding/             # First-time setup flow
│   │   ├── payroll/                # Payroll calculation
│   │   ├── reports/pnl/            # P&L financial reports
│   │   ├── reviews/                # Customer feedback
│   │   ├── services/               # Service & deal management
│   │   ├── settings/               # Salon settings + audit log
│   │   ├── staff/                  # Staff directory + performance
│   │   ├── team/                   # Team member management + server actions
│   │   └── walkin/                 # Walk-in POS
│   ├── admin/                      # Super-admin panel (email-gated)
│   ├── api/
│   │   ├── invite/                 # POST — send team member email invite
│   │   └── leads/                  # POST — save landing page lead
│   ├── auth/
│   │   ├── callback/               # Supabase OAuth callback
│   │   └── signout/                # Sign out route
│   ├── suspended/                  # Subscription suspended page
│   ├── layout.tsx                  # Root layout (providers, fonts)
│   ├── page.tsx                    # Public landing page
│   └── globals.css                 # Global Tailwind styles
│
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── Sidebar.tsx                 # Navigation sidebar (role-aware)
│   ├── RoleContext.tsx             # Context: current user role, ownerId, permissions
│   ├── PermissionGuard.tsx         # Client-side route permission enforcement
│   ├── FeedbackModal.tsx           # Collect appointment feedback
│   ├── InvoiceModal.tsx            # PDF receipt/invoice generation
│   ├── FloatingWalkIn.tsx          # Floating walk-in shortcut button
│   ├── NotificationBell.tsx        # Notification indicator
│   ├── StaffBulkModal.tsx          # Bulk staff CSV import/export
│   ├── ServicesBulkModal.tsx       # Bulk services CSV import/export
│   └── DealsBulkModal.tsx          # Bulk deals CSV import/export
│
├── hooks/
│   └── useCurrency.ts              # Format amounts with salon currency symbol
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server-side Supabase client
│   │   └── admin.ts                # Admin client (SERVICE_ROLE_KEY)
│   ├── types.ts                    # All TypeScript interfaces
│   ├── roles.ts                    # Role definitions, nav permissions, RBAC
│   └── utils.ts                    # cn() Tailwind merge utility
│
├── supabase/
│   ├── migrations/                 # Versioned SQL migration files
│   ├── schema.sql                  # Full consolidated schema
│   ├── grant_all_tables.sql        # One-time grant script for existing tables
│   └── migration_v*.sql            # Legacy migration files
│
├── middleware.ts                   # Auth guard + subscription check + admin gate
├── next.config.ts                  # Next.js config
├── tsconfig.json                   # TypeScript strict config, @/* alias
├── components.json                 # shadcn/ui configuration
└── package.json                    # Dependencies and scripts
```

## 9. HOW TO RUN LOCALLY

```bash
npm install

# Create .env.local in the project root with:
NEXT_PUBLIC_SUPABASE_URL=https://jhhvfapizghegvvkcyhg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase dashboard>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_EMAIL=usmannasir451@gmail.com

npm run dev
# App runs at http://localhost:3000
```

## 10. COMMON COMMANDS

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint check
```

### Git workflow
```bash
git add <files>
git commit -m "description of change"
git push origin main
# Vercel auto-deploys on push to main
```

### Working with Claude Code
- Claude Code CLI is used for development assistance
- CLAUDE.md (this file) and AGENTS.md are loaded automatically as context
- When adding new DB tables, always include the three GRANT statements (see top of this file)

## 11. KNOWN ISSUES & THINGS TO WATCH

- **Supabase free tier**: The Supabase project pauses after ~1 week of inactivity. Wake it up by visiting the Supabase dashboard or making an API call.
- **Grant all tables**: When adding any new database table, you MUST include the three GRANT statements in the same migration file (see top of this file). Existing tables are covered by `supabase/grant_all_tables.sql` — new ones are not.
- **service_role key in server only**: `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser. Only use it in API routes (`app/api/`) or server actions.
- **RLS + team member access**: All queries use `get_effective_owner_id()` — do not hardcode user IDs. Team members must resolve through the owner chain.
- **Historical pricing**: Never update `total_amount` on completed appointments or walk-ins. It is intentionally frozen at transaction time.
- **Currency symbols**: Do not hardcode currency symbols (e.g., `$` or `PKR`). Always use the `useCurrency` hook.
- **Role permission changes**: If adding a new page/feature, update `lib/roles.ts` to include the route in the appropriate role's nav array.
- **next-themes dark mode**: Components must use `dark:` Tailwind classes for dark mode support — do not use inline style toggles.
