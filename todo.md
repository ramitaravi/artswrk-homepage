# Artswrk Project TODO

## Homepage
- [x] Homepage with hirers/artists toggle
- [x] Poppins font
- [x] Hirer gradient: #FFBC5D → #F25722
- [x] Artist gradient: #ec008c → #ff7171
- [x] Job post flow (paste description → preview → signup wall)
- [x] Artist photo strip (infinite scroll)
- [x] For Hirers section
- [x] For Artists section
- [x] Jobs for Artists section
- [x] For Businesses section with logo ticker
- [x] How It Works (hirers + artists)
- [x] FAQ accordion (hirers + artists)
- [x] CTA banner
- [x] Footer

## Jobs Page
- [x] /jobs page with sidebar filters
- [x] Job cards with Apply button
- [x] Map panel placeholder
- [x] Navigation link from homepage

## Authentication
- [x] Login page at /login
- [x] Demo account flow (Phyllis F / Ferrari Dance Center NYC)
- [x] AuthContext for managing login state

## Client Dashboard
- [x] Dashboard shell with sidebar navigation
- [x] Overview page (stats, quick post, jobs, applicants)
- [x] My Jobs page (job cards, applicant management)
- [x] Bookings page (confirm/decline, payment links)
- [x] Payments & Wallet page (balance, send payment, transactions)
- [x] Artists page (browse + save)
- [x] Messages page (full chat UI)
- [x] Company Page (Premium)
- [x] Sub Lists (Premium)
- [x] Community (Premium)
- [x] Benefits (Premium)

## Database
- [x] Upgrade project to full-stack (web-db-user)
- [x] Design users table schema (28 columns mirroring Bubble User type)
- [x] Run db:push migration
- [x] Seed Nick's Bubble user record (nick+ferrari@artswrk.com → Phyllis F / Ferrari Dance Center NYC)
- [x] Add getUserByEmail, getUserByBubbleId, getAllUsers query helpers
- [x] Add artswrkUsers tRPC router (getByEmail, getByBubbleId, list)

## Upcoming
- [x] Wire demo login to real database (login as nick+ferrari@artswrk.com)
- [x] Display real DB user data in dashboard header/profile
- [ ] Artist-side dashboard (profile, job applications, earnings)
- [ ] Settings page (profile editing, notifications, billing)
- [ ] Real Google Maps integration on /jobs
- [ ] Job detail drawer/modal
- [ ] Post a Job page (/post-job)
- [ ] Wire signup CTAs to real auth flow
- [ ] Port more Bubble data types (jobs, bookings, payments, etc.)
- [ ] Bulk user migration from Bubble Data API
- [x] Add passwordHash field to users schema
- [x] Build /admin page for setting temporary passwords
- [x] Update login to authenticate against stored password hash
- [x] Fix AuthProvider error in dashboard pages (replace old AuthContext with tRPC useAuth)
- [x] Inspect Bubble Request table structure via Data API
- [x] Design jobs table schema mapping Bubble fields (30 columns)
- [x] Seed Nick's jobs from Bubble into the database (160 jobs)
- [x] Wire dashboard My Jobs page to real DB data
- [x] Wire /jobs page to real DB data
- [x] Add jobs tRPC router (myJobs, myStats, publicList)
- [x] Write vitest tests for jobs logic (14 tests passing)

## Interested Artists (Applicants)
- [x] Inspect Bubble "interested artists" table structure via Data API
- [x] Design interested_artists table schema (21 columns) and run db:push migration
- [x] Seed all 472 interested artist records from Bubble (429 Interested, 32 Confirmed, 11 Declined)
- [x] Add applicants tRPC router (myApplicants, myStats, byJob)
- [x] Wire dashboard Artists page to real applicant data (filterable table with expand rows)
- [x] Wire dashboard Overview applicant stats to real data
- [x] Write vitest tests for interested artists logic (21 tests passing, 35 total)

## Bookings (Full Loop: Job → Applicant → Booking)
- [x] Inspect Bubble Booking table structure via Data API (389 records found)
- [x] Design bookings table schema (25 columns) and run db:push migration
- [x] Seed 224 bookings from Bubble (186 Completed/Paid, 37 Confirmed/Unpaid, 1 Pay Now)
- [x] Add bookings tRPC router (myBookings, myStats, byJob, byId, byApplicant)
- [x] Wire dashboard Bookings page to real data (filterable by status, expandable rows with financials)
- [x] Add Bookings stat card to Overview dashboard
- [x] Add View Bookings button to job expanded rows in DashJobs
- [x] Write vitest tests for bookings logic (21 tests, 56 total passing)

## Artist User Records
- [x] Collect 193 unique artist Bubble IDs from interested_artists + bookings tables
- [x] Fetch all 194 artist User records from Bubble API (batched)
- [x] Upsert 194 artist records into users table (userRole=artist)
- [x] Back-fill artistUserId FK on interested_artists (468/472) and bookings (224/224)
- [x] Update Artists dashboard page to show real names, photos, @slug
- [x] Update Bookings page to show real artist names and photos
- [x] Update Overview sidebar to show real artist names and photos in recent applicants feed
- [x] 56 vitest tests passing (no new tests needed — artist data flows through existing JOIN queries)

## Messages
- [x] Inspect Bubble Messages + Conversation table structure via Data API
- [x] Design conversations + messages schemas (2 tables) and run db:push migration
- [x] Seed 164 conversations and 486 messages from Bubble
- [x] Add messages tRPC router (myConversations, byConversation, myStats)
- [x] Wire dashboard Messages page to real data (conversation list + full thread view with avatars)
- [x] Add Messages stat card to Overview dashboard
- [x] 56 vitest tests passing

## Payments
- [x] Inspect Bubble Payment table structure via Data API
- [x] Design payments schema (17 columns) and run db:push migration
- [x] Seed 176 payments from Bubble (linked to bookings + artists)
- [x] Add payments tRPC router (myPayments, myStats)
- [x] Wire dashboard Payments page to real data (stats, searchable history, receipt links, cards used)
- [x] Add Payments stat card to Overview dashboard
- [x] 56 vitest tests passing

## Artist Profile Page
- [x] Capture original Artswrk profile page layout
- [x] Create ArtistProfile page with header, bio, services, history sections
- [x] Add tRPC artists.getById and artists.getHistory endpoints
- [x] Wire click-through from Browse Artists (grid + list), My Artists table, Bookings page, Messages page
- [x] Register route /dashboard/artists/:artistId in App.tsx

## /jobs Page Redesign (Artist View)
- [x] Three-tab layout: Jobs Near Me (map + list), PRO Jobs, Applications
- [x] Jobs Near Me tab: left job list + right Google Maps panel with red pin markers
- [x] Search bar, location input, Artist Type + Service Type filter dropdowns
- [x] PRO Jobs tab: PRO upsell banner + locked blurred preview (no direct-flagged jobs in DB yet)
- [x] Applications tab: status-tagged application cards + login CTA
- [x] Wire real job data from DB (publicList tRPC endpoint)
- [x] Map markers from job locationLat/locationLng fields
- [x] Clicking map pin selects job and shows floating detail card

## Post a Job Flow (/post-job)
- [x] Add Stripe integration (webdev_add_feature)
- [x] Users table already has clientStripeCustomerId, clientSubscriptionId, clientPremium fields
- [x] Reuse jobs table with requestStatus: "Pending Payment" → "Active" after payment
- [x] AI job parsing tRPC endpoint (postJob.parseText) using LLM with structured JSON output
- [x] Job creation tRPC endpoint (postJob.createAndCheckout) that inserts into jobs table
- [x] Stripe checkout session helper ($30 one-time payment with saved card support)
- [x] Stripe subscription session helper (monthly $29/mo PRO plan)
- [x] Stripe webhook handler at /api/stripe/webhook to activate job after payment
- [x] Step 1: Natural language input page with rotating example placeholders
- [x] Step 2: Smart summary form with AI autofill + account data prefill (studio name, location, rate, dates)
- [x] Step 3: Payment step ($30 one-time or Subscribe & Save $29/mo) with Stripe redirect
- [x] Logged-out view: shows warning + redirects to login before payment
- [x] Logged-in view: prefills studio name and location from user account
- [x] postJob.verifyCheckout endpoint to activate job on success page
- [x] Success page at /post-job/success with job activation and confetti
- [x] Wire "Post a Job" CTAs on homepage, dashboard, and navbar to /post-job
- [ ] Write vitest tests for job parsing and creation logic

## Signup & Onboarding Flow (/signup)
- [x] Step 1: Account creation (firstName, lastName, email, password)
- [x] Step 2: Hiring for yourself or a business? (businessOrIndividual field)
- [x] Step 3a: Business type selection (Dance Studio, Dance Competition, Music School, Event Company, Other → hiringCategory field)
- [x] Step 3b: Artist type selection for individuals
- [x] Step 4a: Studio/Music School — studio name + Google Places lookup (name, address, website, phone)
- [x] Step 4b: Competition/Event Company — competition name + website
- [x] Step 4c: Other — business name + website
- [x] Step 5: Pricing plan (Studio/Music School: $30/post or $50/mo | Enterprise: $100/post or $250/mo | Talk to Sales)
- [x] Step 6: Post your first job? → route to /post-job or go to dashboard
- [x] tRPC signup.register endpoint (create user, hash password, set session)
- [x] tRPC signup.updateOnboarding endpoint (save businessOrIndividual, hiringCategory, company details)
- [x] Wire Join/Signup CTAs on homepage navbar, hero, and Login page to /signup
- [ ] Write vitest tests for signup logic

## Homepage Navbar Auth State
- [x] Show logged-in user banner (name + account) when authenticated
- [x] Replace Login/Join buttons with logout button when logged in
- [x] Wire logout button to tRPC auth.logout mutation

## Boost Job Feature
- [x] Add boostActive, boostDailyBudget, boostDurationDays, boostStartDate, boostEndDate, boostStripeSessionId fields to jobs schema
- [x] Run pnpm db:push to migrate schema
- [x] activateBoost and getJobById db helpers
- [x] BOOST product config in stripe-products.ts with calcBoostTotal helper
- [x] createBoostCheckoutSession in stripe.ts
- [x] tRPC boost.createCheckout procedure (creates Stripe checkout for boost)
- [x] tRPC boost.verifyCheckout procedure (activates boost after payment)
- [x] BoostJobModal reusable component: daily budget slider ($5–$100), duration selector (3/7/14/30 days), live performance preview panel
- [x] Performance preview: Expected Views, Expected Applicants, Featured Placements, total cost calculation, tier hints
- [x] Boost upsell card on PostJob success page (only shown if not already boosted)
- [x] Boost button on DashJobs expanded job card (Active/Pending/Open jobs only)
- [x] Stripe webhook handles boost payment via checkout.session.completed with boost metadata
