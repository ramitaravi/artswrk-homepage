# Artswrk — Site Map & Structure

> Living document. Update when adding pages, routes, or major features.
> Stack: React 19 + Vite · Wouter routing · tRPC · Drizzle ORM + MySQL · Tailwind v4 · Poppins font

---

## User Roles

| Role | Description | Key Flag |
|---|---|---|
| **Visitor** | Not logged in | — |
| **Artist (no plan)** | Logged in, no subscription | `artswrkBasic: false`, `artswrkPro: false` |
| **Artist Basic** | Subscribed to Basic | `artswrkBasic: true` |
| **Artist PRO** | Subscribed to PRO | `artswrkPro: true` |
| **Client** | Hirer (studio, competition, etc.) | `userRole: "Client"` |
| **Enterprise Client** | High-volume hirer with PRO job access | `enterprise: true` |
| **Admin** | Internal Artswrk staff | `role: "admin"` |

---

## Routes & Pages

### Public — Marketing / SEO

| Route | Component | Description | Auth |
|---|---|---|---|
| `/` | `Home.tsx` | Homepage with hero, features, social proof | Public |
| `/about` | `About.tsx` | About Artswrk | Public |
| `/enterprise` | `Enterprise.tsx` | Enterprise landing page | Public |

### Public — For Hirers (SEO landing pages)

| Route | Component | Target audience |
|---|---|---|
| `/dance-competitions` | `DanceCompetitions.tsx` | Dance competition companies |
| `/dance-studios` | `DanceStudios.tsx` | Dance studios |
| `/music-schools` | `MusicSchools.tsx` | Music schools |

### Public — For Artists (SEO landing pages)

| Route | Component | Target audience |
|---|---|---|
| `/dance-teachers` | `DanceTeachers.tsx` | Dance teachers looking for work |
| `/dance-judges` | `DanceJudges.tsx` | Dance adjudicators |
| `/music-teachers` | `MusicTeachers.tsx` | Music teachers |
| `/production` | `Production.tsx` | Photographers, videographers, production |

### Jobs — Public Browse + Gated Apply

| Route | Component | Description | Auth |
|---|---|---|---|
| `/jobs` | `Jobs.tsx` | Job board — 3 tabs: Jobs Near Me / PRO Jobs / Applications | Public browse; Basic+ to apply |
| `/jobs/:locationSlug/:jobSlug` | `JobDetail.tsx` | Regular job detail with JSON-LD SEO | Public |
| `/jobs/:locationSlug/:jobSlug/apply` | `ApplyPage.tsx` | Job application form | Basic+ required |
| `/jobs/pro/:companySlug/:jobSlug` | `ProJobDetail.tsx` | PRO/enterprise job detail | Public view; PRO to apply |

> **Route priority in App.tsx:** PRO route registered before generic `:locationSlug` to avoid "pro" matching as a location.

#### Jobs Page — Subscription Gate Logic

| User state | Job list | Apply button | Map card | PRO tab |
|---|---|---|---|---|
| Not logged in | Visible | Paywall → `/join` | Paywall | Upgrade banner |
| Logged in, no plan | Visible + banner | 🔒 Paywall modal | Subscribe to Apply | Upgrade banner |
| Basic subscriber | Visible | Apply → (free) | Apply → | Upgrade banner |
| PRO subscriber | Visible | Apply → (free) | Apply → | No banner |

### Auth

| Route | Component | Description |
|---|---|---|
| `/login` | `Login.tsx` | Email + password login. Respects `?next=` redirect param. |
| `/join` | `ArtistJoin.tsx` | **Artist-focused** 3-step signup: account → artist types → plan |
| `/signup` | `Signup.tsx` | **Hirer-focused** signup: account → business type → details → pricing |
| `/forgot-password` | `ForgotPassword.tsx` | Request password reset email |
| `/reset-password` | `ResetPassword.tsx` | Set new password via token |

> `/join` is for artists discovering Artswrk via the jobs page.
> `/signup` is for businesses/studios wanting to post jobs.

### Post a Job (Hirer flow)

| Route | Component | Description |
|---|---|---|
| `/post-job` | `PostJob.tsx` | AI-assisted job posting → Stripe checkout |
| `/post-job/success` | `PostJob.tsx` | Post-checkout confirmation (same component, different state) |

### `/app/*` — Unified logged-in area (artist + client)

All routes wrapped in `DashboardLayout`. Role-aware: the sidebar nav and page content adapt based on `userRole`.

> **URL design mirrors original Bubble app**: `artswrk.com/app?tab=bookings` → `artswrk.com/app/bookings`
> Legacy `/dashboard/*` and `/artist-dashboard` redirect automatically to `/app/*`.

#### Shared routes (role-aware content)

| Route | Artist renders | Client renders |
|---|---|---|
| `/app` | Artist overview (jobs feed, bookings, affiliations) | `Overview.tsx` (stats, applicants) |
| `/app/jobs` | Job feed + PRO jobs + applications | `DashJobs.tsx` (manage job postings) |
| `/app/bookings` | Booking list (upcoming, complete, payment pending) | `Bookings.tsx` (confirmed bookings) |
| `/app/payments` | Earnings history + pending | `Payments.tsx` (billing + wallet) |
| `/app/messages` | Inbox (artist ↔ hirer) | `Messages.tsx` (client ↔ artist) |
| `/app/community` | Community features | Community features |
| `/app/benefits` | Partner perks | Partner perks |

#### Client-only routes

| Route | Component | Description |
|---|---|---|
| `/app/artists` | `Artists.tsx` | Browse + search artist directory |
| `/app/artists/:artistId` | `ArtistProfile.tsx` | Individual artist detail |
| `/app/company` | `CompanyPage.tsx` | Edit company profile |
| `/app/lists` | `SubLists.tsx` | Saved artist shortlists |

#### Artist-only routes

| Route | Description |
|---|---|
| `/app/profile` | Artist's public profile (view + edit) |
| `/app/pro-jobs` | PRO / enterprise job board |

### Admin

| Route | Component | Description |
|---|---|---|
| `/admin-dashboard` | `Admin.tsx` | Internal admin panel — users, jobs, payments, overview |

> Legacy `/admin` redirects to `/admin-dashboard`.

---

## tRPC API — Routers & Procedures

Base path: `/trpc`

### `auth`
| Procedure | Type | Description |
|---|---|---|
| `me` | query | Returns current session user (full DB row) |
| `passwordLogin` | mutation | Email + password → sets JWT cookie |
| `logout` | mutation | Clears session |
| `forgotPassword` | mutation | Sends reset email |
| `resetPassword` | mutation | Validates token + sets new password |

### `signup`
| Procedure | Type | Description |
|---|---|---|
| `register` | mutation | Creates new user account |
| `updateOnboarding` | mutation | Saves onboarding step data |

### `jobs`
| Procedure | Type | Description |
|---|---|---|
| `publicList` | query | All active jobs (basic) |
| `publicListEnriched` | query | Jobs + client name/avatar joined |
| `getDetail` | query | Single job by ID |
| `myJobs` | protected query | Client's own job postings |
| `myStats` | protected query | Client job stats |
| `myResumes` | protected query | Artist's uploaded resumes |
| `submitApplication` | protected mutation | Artist applies to a job |
| `myApplications` | protected query | Artist's own applications |

### `applicants`
| Procedure | Type | Description |
|---|---|---|
| `myApplicants` | protected query | All applicants across client's jobs |
| `byJob` | protected query | Applicants for a specific job |
| `myStats` | protected query | Applicant stats |

### `bookings`
| Procedure | Type | Description |
|---|---|---|
| `myBookings` | protected query | All bookings for current user |
| `byJob` | protected query | Bookings for a specific job |
| `byId` | protected query | Single booking |
| `byApplicant` | protected query | Bookings for an applicant |
| `myStats` | protected query | Booking stats |

### `payments`
| Procedure | Type | Description |
|---|---|---|
| `myPayments` | protected query | Payment history |
| `myStats` | protected query | Revenue stats |
| `walletStats` | protected query | Wallet/payout balance |
| `pendingPayments` | protected query | Unpaid amounts |

### `messages`
| Procedure | Type | Description |
|---|---|---|
| `myConversations` | protected query | All conversation threads |
| `byConversation` | protected query | Messages in a thread |
| `myStats` | protected query | Unread counts |

### `artists`
| Procedure | Type | Description |
|---|---|---|
| `getById` | query | Artist profile by ID |
| `getHistory` | protected query | Booking history with an artist |
| `listMyArtists` | protected query | Client's previously booked artists |
| `browse` | protected query | Filtered artist directory |
| `uploadResume` | protected mutation | Upload resume file |

### `postJob`
| Procedure | Type | Description |
|---|---|---|
| `parseText` | protected mutation | AI parses job description text |
| `createAndCheckout` | protected mutation | Creates job + Stripe checkout session |
| `verifyCheckout` | protected mutation | Confirms payment + activates job |

### `boost`
| Procedure | Type | Description |
|---|---|---|
| `createCheckout` | protected mutation | Creates Stripe session for job boost |
| `verifyCheckout` | protected mutation | Activates boost after payment |

### `artistDashboard`
| Procedure | Type | Description |
|---|---|---|
| `getJobsFeed` | protected query | Regular jobs feed for artist |
| `getProJobsFeed` | query | PRO jobs feed (public list) |
| `getProApplications` | protected query | Artist's PRO job applications |
| `getBookings` | protected query | Artist's confirmed bookings |
| `getPayments` | protected query | Artist's earnings |
| `applyToProJob` | protected mutation | Apply to a PRO/enterprise job |

### `enterprise`
| Procedure | Type | Description |
|---|---|---|
| `getJobs` | protected query | Enterprise client's PRO job listings |
| `getApplications` | protected query | All PRO job applicants |
| `getJobDetail` | protected query | Single PRO job |
| `getJobApplicants` | protected query | Applicants for a PRO job |
| `getClientCompanies` | protected query | Client company records |
| `postJob` | protected mutation | Create a PRO/enterprise job |

### `admin`
| Procedure | Type | Description |
|---|---|---|
| `overview` | admin query | Platform-wide stats |
| `artists` | admin query | All artists with filters |
| `clients` | admin query | All clients |
| `jobs` | admin query | All jobs |
| `bookings` | admin query | All bookings |
| `payments` | admin query | All payments |
| `setPassword` | admin mutation | Set any user's password |
| `impersonate` | admin mutation | Log in as another user |
| `stopImpersonating` | admin mutation | Return to admin session |

---

## Database Tables

| Table | Bubble source | Records | Description |
|---|---|---|---|
| `users` | `user` | ~6,700 | All users — artists, clients, admins |
| `jobs` | `request` | 3,623 | Regular marketplace job postings |
| `interested_artists` | `interested artists` | 9,712 | Applications to regular jobs |
| `bookings` | `booking` | ~5,574 | Confirmed engagements |
| `payments` | `payment` | 14,307 | Stripe payment records |
| `conversations` | `conversation` | — | Messaging threads |
| `messages` | `message` | 14,126 | Individual messages |
| `premium_jobs` | `premium_jobs` | 185 | Enterprise / PRO job postings |
| `premium_job_interested_artists` | `InterestedArtists` | 9,712 | Applications to PRO jobs |
| `client_companies` | client company type | — | Companies under enterprise clients |
| `artist_reviews` | `Reviews` | 1,110 | Post-booking reviews |
| `artist_service_categories` | `ArtistService` | — | Artist profile service blocks |
| `artist_experiences` | `ArtistExperience` | ~1,215 | Teaching/performance experience |
| `artist_resumes` | `resume` | — | Resume file uploads |
| `reimbursements` | `reimbursements` | 0 | Expense records (empty) |
| `ads` | `ad` | — | Banner/display ads |
| `affiliations` | `Affiliations` | — | Schools, programs, studios |
| `user_affiliations` | `Affiliations` | — | Artist ↔ affiliation join |
| `rate_conversions` | rate conversion type | — | Artist→client rate lookups |
| `benefits` | benefits type | — | Partner perks & discounts |
| `eoy_email_snapshots` | EOY email type | — | Year-end earnings snapshots |
| `password_reset_tokens` | (Manus auth) | — | Password reset tokens |
| `acquisition_sessions` | (Manus analytics) | — | Lead capture sessions |
| `acquisition_leads` | (Manus analytics) | — | Captured leads |
| `master_artist_types` | Bubble option set | 8 | Artist category lookup |
| `master_service_types` | Bubble option set | 42 | Service type lookup |
| `master_style_types` | Bubble option set | 34 | Dance style lookup |

---

## Key Components

### Layout
| Component | Description |
|---|---|
| `DashboardLayout.tsx` | Client dashboard shell — sidebar nav, auth gate, top bar |
| `DashboardLayoutSkeleton.tsx` | Loading skeleton for dashboard |
| `ErrorBoundary.tsx` | React error boundary wrapper |

### Features
| Component | Description |
|---|---|
| `Map.tsx` | Google Maps wrapper (Advanced Markers API) — used on jobs page |
| `AIChatBox.tsx` | AI chat interface |
| `BoostJobModal.tsx` | Job boost (paid promotion) modal |
| `ManusDialog.tsx` | Manus runtime dialog |

### UI Primitives (`components/ui/`)
Full shadcn/Radix UI library — 59 components including Button, Dialog, Select, Table, Sheet, Sidebar, etc.

---

## Subscription Tiers

| Tier | Flag | Can do |
|---|---|---|
| **No plan** | `artswrkBasic: false` | Browse jobs only — no apply |
| **Basic** | `artswrkBasic: true` | Apply to regular marketplace jobs |
| **PRO** | `artswrkPro: true` | Apply to all jobs including PRO/enterprise |

### Subscription Entry Points
- `/jobs` paywall modal → `/join?next=/subscribe/basic` or `/join?next=/subscribe/pro`
- `/join` step 3 → plan picker → `/subscribe/:plan`
- PRO tab upgrade banner → `/subscribe/pro`

> **TODO:** `/subscribe/basic` and `/subscribe/pro` pages need to be built (Stripe checkout for artist subscriptions).

---

## Navigation Structure

### Public Navbar (Home, About, Enterprise, landing pages)
- **For Hirers** dropdown: Dance Competitions, Dance Studios, Music Schools
- **For Artists** dropdown: Dance Teachers, Dance Judges, Music Teachers, Production
- Login / Post a Job CTAs

### Jobs Page Navbar (standalone)
- Logo → `/`
- Jobs (active)
- Login → `/login?next=/jobs`
- Join → `/join?next=/jobs`

### App Sidebar (`/app/*`) — role-aware

**Client nav:**
- Dashboard → `/app`
- My Jobs → `/app/jobs`
- Bookings → `/app/bookings`
- Payments → `/app/payments`
- Artists → `/app/artists`
- Messages → `/app/messages`
- _Premium:_ Company Page, Sub Lists, Community, Benefits

**Artist nav:**
- Dashboard → `/app`
- Jobs → `/app/jobs`
- Bookings → `/app/bookings`
- Payments → `/app/payments`
- Messages → `/app/messages`
- Profile → `/app/profile`
- _Premium:_ PRO Jobs, Benefits, Community

---

## Data Flow — Key Journeys

### Artist applies to a job
1. Browse `/jobs` (public)
2. Click Apply → check `artswrkBasic || artswrkPro`
3. If no plan → `SubscriptionPaywallModal` → `/join` or `/subscribe`
4. If subscribed → `/jobs/:locationSlug/:jobSlug` (JobDetail)
5. Click Apply on detail → `/jobs/:locationSlug/:jobSlug/apply` (ApplyPage)
6. Application saved to `interested_artists`

### Hirer posts a job
1. `/signup` → account + business type + details + pricing
2. `/post-job` → AI parses job description → Stripe checkout
3. After payment → job live in `jobs` table → visible on `/jobs`

### Auth redirect chain
- Any `?next=` param on `/login` or `/join` is preserved and used post-auth
- Default redirect: login → `/app`, join → `/jobs`
