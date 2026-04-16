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

## PostJob Step 3/4 Revision
- [ ] Restore $30 flat post card in Step 3 (unhide it, remove boost slider from Step 3)
- [ ] Add optional Step 4: Boost slider (available to both one-time and subscribers)
- [ ] Step 4 shows "Skip for now" option so boost is truly optional

## SendGrid Transactional Email Integration
- [x] Add SENDGRID_API_KEY secret
- [x] Create server/email.ts helper with sendTransactionalEmail function
- [x] Define SENDGRID_TEMPLATES constants (Client - Request Posted: d-e2dcf8797ac545d68a03f610a7323fce)
- [x] Wire job-posted email in Stripe webhook after checkout.session.completed
- [x] Variables: FirstName, Service, ArtistType, Date, Location, TransportDetails, TransportReimbursed, Description, joblink, subject

## Dashboard Artists Page (Real Data)
- [x] Add tRPC artists.browse endpoint querying users WHERE userRole = 'Artist'
- [x] Support search (name/location), filter by artistType, pagination (48/page, prev/next)
- [x] Wire BrowseArtistsTab to real tRPC data (replaces applicants-based mock data)
- [x] Wire DiscoverTab to real tRPC data for "Artists on Artswrk" grid
- [x] Show avatar, name, masterArtistTypes, location, artswrkPro badge, profile link
- [x] Write 7 vitest tests for artists.browse (69 total passing)

## Admin Dashboard (/admin)
- [x] Add admin role check in all admin procedures (ownerOpenId or role=admin)
- [x] Add admin.overview tRPC endpoint (total users, artists, clients, revenue, bookings, future revenue, commission)
- [x] Add admin.artists tRPC endpoint (all artists, search, filter by artistType/state/plan, paginated)
- [x] Add admin.clients tRPC endpoint (all clients, search, filter by hiringCategory/state/plan/businessType, paginated)
- [x] Add admin.jobs tRPC endpoint (all jobs, filter by service/status/state, search by client/company/artist, paginated)
- [x] Add admin.bookings tRPC endpoint (all bookings, filter by upcoming/past/paymentStatus/bookingStatus, search, paginated)
- [x] Add admin.payments tRPC endpoint (recent payments, paginated)
- [x] Build /admin shell with dark sidebar (Dashboard, Artists, Clients, Jobs, Bookings, Payments, Settings)
- [x] Admin Overview page: stat cards (Revenue, Commission, Bookings, Future Revenue, Artists breakdown, Clients breakdown) + Recent Payments table
- [x] Admin Artists page: searchable/filterable table with artistType, state, plan filters + list view
- [x] Admin Clients page: searchable/filterable table with hiringCategory, state, plan, business type filters
- [x] Admin Jobs page: searchable/filterable table with service, status, state filters + per-row details
- [x] Admin Bookings page: upcoming/past toggle, payment/booking status filters, full financial breakdown per row
- [x] Admin Payments page: paginated payments list (customer, status, amount, date, Stripe ID)
- [x] Settings section: password management tool preserved from old /admin
- [x] Write 13 vitest tests for admin procedures (82 total passing)

## Lambarri Data Seed (bubble ID: 1660327940281x921038367851854000)
- [x] Confirmed no separate clientCompanies table in Bubble; company info is on user record
- [x] Upserted Lambarri user: Alexa S. / Lambarri Dance Arts (DB id: 780128)
- [x] Seeded 92 jobs from Bubble
- [x] Seeded 468 bookings (271 paid, $74,667 total revenue)
- [x] No interested-artist or payment records found in Bubble for this client
- [x] Upserted 38 unique artist users from bookings
- [x] Back-filled artistUserId FK on 468 bookings
- [x] Total DB: 236 users, 257 jobs, 692 bookings

## Switch to Live Bubble Data
- [x] Verified live Bubble API key works (same key, version-live endpoint)
- [x] Ferrari live ID: 1659533883431x527826980339748400 (same as dev)
- [x] Wiped all dev-seeded data (kept 2 admin accounts)
- [x] Updated all 7 seed scripts to use version-live
- [x] Re-seeded Ferrari from live: 237 jobs, 704 interested artists, 203 bookings, 193 payments, 266 artist users
- [x] Total DB: 269 users (266 artists, 2 clients), $32,212 revenue

## Enterprise Dashboard
- [ ] Audit Bubble enterprise dashboard UI (all sections/tabs)
- [ ] Add `enterprise` boolean field to users schema + db:push
- [ ] Seed taylor@dancerevel.com from Bubble live (user data only)
- [ ] Mark Taylor as enterprise=true in DB
- [ ] Add tRPC enterprise procedures (overview stats, jobs, bookings, artists)
- [ ] Build /enterprise dashboard shell with sidebar matching current design
- [ ] Enterprise Overview page: stat cards + recent activity
- [ ] Enterprise Jobs page: premium jobs list
- [ ] Enterprise Artists page: artist roster
- [ ] Enterprise Bookings page: bookings table
- [ ] Route enterprise users to /enterprise instead of /dashboard on login
- [ ] Protect /enterprise route — redirect non-enterprise users

## Enterprise Dashboard (/enterprise)
- [x] Add `enterprise` boolean field to users schema and run db:push migration
- [x] Seed taylor@dancerevel.com from Bubble live as enterprise user (enterprise=true)
- [x] Add enterprise tRPC router (getJobs, getApplications, getCompanies, getInterestedArtists)
- [x] Build /enterprise page with dark sidebar matching current design language
- [x] Enterprise header: company logo, company name, "+ Post Job" CTA
- [x] Jobs tab: job cards with Applications panel on the right (click job to see applicants)
- [x] Companies tab: company cards grid with open role count
- [x] Artists tab: Browse All (real artists.browse data) + Interested sub-tabs
- [x] Route /enterprise registered in App.tsx
- [x] Non-enterprise users redirected to /dashboard
- [x] 82 vitest tests passing (no new tests needed)

## Admin Impersonation ("Run As Client")
- [ ] Promote ramita+studio@artswrk.com to admin role in DB
- [ ] Add admin.impersonate tRPC mutation (admin-only, creates a session token for target user)
- [ ] Add "Run As" button to Admin Clients table rows
- [ ] Add "Run As" button to Admin Artists table rows
- [ ] On impersonate: set session cookie as target user and redirect to /dashboard
- [ ] Show "Impersonating [Name]" banner when running as another user
- [ ] Add "Return to Admin" button in the impersonation banner to restore original admin session
- [ ] Write vitest tests for impersonate procedure

## Premium Jobs (Separate Table)
- [x] Add premium_jobs table to schema (mirrors Bubble: company, logo, category, description, budget, location, serviceType, status, tag, slug, applyDirect, applyEmail, applyLink, workFromAnywhere, featured, clientCompanyId, createdByUserId, bubbleId)
- [x] Add premium_job_interested_artists join table
- [x] Run pnpm db:push to migrate schema
- [x] Seed all 185 live Bubble premium_jobs records
- [x] Seed REVEL (taylor@dancerevel.com) jobs specifically and their interested artists (1 job, 13 interested artists)
- [x] Add getPremiumJobsByUserId, getAllPremiumJobs, getPremiumJobInterestedArtists, getPremiumInterestedArtistsByCreatorId DB helpers
- [x] Wire enterprise.getJobs to premium_jobs table (with fallback to regular jobs)
- [x] Wire enterprise.getApplications to premium_job_interested_artists
- [x] Wire enterprise.getInterestedArtists to premium_job_interested_artists (deduplicated)
- [x] Update Enterprise JobCard component to render premium_jobs fields (serviceType, status, budget, workFromAnywhere, logo, category)
- [x] Write 10 vitest tests for premium_jobs helpers and enterprise procedure logic (92 total passing)

## REVEL Interested Artists Seed
- [x] Fetched REVEL's 13 interested artist Bubble IDs from premium_job_interested_artists
- [x] Fetched full user records from Bubble for each artist
- [x] Upserted into users table with full profile data (name, photo, slug, location, artistTypes, etc.)
- [x] Back-filled artistUserId FK on premium_job_interested_artists for REVEL's job

## Admin PRO Jobs Section
- [x] Add admin.premiumJobs tRPC endpoint (all premium_jobs, search, filter by status/company, paginated)
- [x] Add PRO Jobs nav item to admin sidebar
- [x] Build Admin PRO Jobs page (searchable/filterable table with job details, interested artist count)
- [x] Register /admin/pro-jobs route in App.tsx

## Admin PRO Jobs Page
- [x] Add admin.premiumJobs tRPC endpoint (all 185 premium_jobs, search by company/serviceType, filter by status, paginated)
- [x] Add admin.premiumJobArtists tRPC endpoint (interested artists by job ID)
- [x] Add PRO Jobs nav item to admin sidebar (with Sparkles icon)
- [x] Build Admin PRO Jobs page (searchable/filterable table with job details + interested artist count badge, expandable rows showing artists)
- [x] 92 tests passing

## Admin PRO Jobs Modal
- [x] Replace inline row-expand with a full modal popup (job header + artist cards with photo, name, location, rate, bio, View Submission link)

## Interested Artists Full Seed (CSV + Bubble API)
- [x] Seed all 1,346 interested artist records with message, rate, resume link, and artist user ID
- [x] Resolved 297 artist user profiles from Bubble by email lookup (567 total users in DB)
- [x] Update premium_job_interested_artists schema to add message, rate, resumeLink, status, bubbleInterestedArtistId columns
- [x] Update modal artist cards to show: application message (primary), bio (fallback), per-artist rate badge, View Submission → (dark button linking to resume), Profile (secondary link)
- [x] 92 tests passing

## Enterprise Clients Seed & Admin Section
- [x] Seeded 11 enterprise clients from Bubble API (taylor@dancerevel.com, raj@onstageamerica.com, decapartner@gmail.com, juliana@elevationontour.com, alli@journeycompetition.com, tiffany@thunderstruckdance.com, julie@americandanceawards.com, elaine@legacystudios.co, recruiting+corporate@ensembleschools.com, lori@tickettobroadway.com, diana@destinytalentcompetition.com)
- [x] Linked 63 premium_jobs to enterprise clients by company name match
- [x] Added getEnterpriseClients DB helper with job + artist counts per client
- [x] Added admin.enterpriseClients tRPC endpoint (search, paginated)
- [x] Added Enterprise Clients nav item to admin sidebar (Building2 icon)
- [x] Built Enterprise Clients card grid (logo, company name, email, hiring category, job count, artist count)
- [x] Built Enterprise Client modal (header, description, website/instagram links, PRO jobs list)
- [x] 92 tests passing

## Enterprise Client Modal Fix
- [x] Add clientUserId filter to admin.premiumJobs tRPC endpoint
- [x] Update EnterpriseClientModal to query by clientUserId instead of company name search
- [x] Show interested artists per job inside the modal (expandable job rows with artist cards: photo, name, location, rate badge, message, View Submission + Profile links)
- [x] 92 tests passing

## Enterprise Dashboard Rebuild (Company + Job Detail Views)
- [ ] Inspect live enterprise dashboard at artswrk.com/version-live/enterprise
- [ ] Build company page view (logo, name, + Post Job, Jobs tab, job cards with avatar stack + Interested Artists sidebar panel)
- [ ] Build job detail view (breadcrumb nav, job header with logo/title/company/date/status, Archive Job button, Applicants tab with table: Name+address, View Application, Message button; Details tab with job description)
- [ ] Wire views as sub-routes or state within the Enterprise page
- [ ] Match styling closely to live Artswrk enterprise dashboard

## Enterprise Dashboard Improvements
- [x] Add getJobDetail and getJobApplicants tRPC procedures to enterprise router
- [x] Add getPremiumJobById db helper
- [x] Build Company View: company logo, name, job cards with status badges, Interested Artists panel
- [x] Build Job Detail View: breadcrumb navigation, Applicants tab (table with View Application + Message), Details tab (description, category, location, apply email)
- [x] Add "View Detail →" button on each job card to navigate to job detail view
- [x] Breadcrumb navigation: Home → Company → Job Title

## Enterprise Dashboard v2 (Sidebar + Tabs)
- [x] Add sidebar layout to Enterprise page (Dashboard, Browse Artists nav items)
- [x] Add Jobs / Companies / Artists tabs to the enterprise master view
- [x] Jobs tab: job cards with applicant avatar stack, pay rate badge, status, View Detail
- [x] Companies tab: company logo cards with open roles count (matching Bubble design)
- [x] Artists/Interested Artists tab: list of interested artists across all jobs
- [x] Applications right panel: show real applicant photos + names + job title
- [x] Wire Companies tab to real enterprise company data from DB
- [x] Wire Artists tab to real interested artists data from DB
- [x] Fix location display ([object Object] bug from Bubble import)
- [x] Fix company header logo to use job logo as fallback

## Enterprise Post Job Modal + Companies Tab Fix
- [x] Check Bubble API for client companies (clientCompanies table or similar)
- [x] Seed client companies per enterprise user into DB (11 companies from premium_jobs)
- [x] Add enterprise.getClientCompanies tRPC procedure (returns companies for logged-in user)
- [x] Build Enterprise Post Job modal (Job Title, Company dropdown, Category, Location, Rate, Work from Anywhere toggle, Description textarea, Apply Email)
- [x] Apply email field autofilled with logged-in user's email
- [x] Wire "+ Post Job" button in enterprise sidebar to open the modal
- [x] Wire Companies tab to real client companies data from DB
- [x] Add enterprise.postJob tRPC procedure to save new jobs to premium_jobs table

## Artist Dashboard (/artist-dashboard)
- [x] Browse live Bubble artist dashboard design at artswrk.com/version-830zu/dashboard-2
- [x] Build Artist Dashboard page with sidebar navigation (Dashboard, Jobs, Bookings, Payments, Messages, Profile, PRO Features)
- [x] Artist Overview: greeting with profile pic, affiliations, tasks, profile boost CTA, PRO jobs list, jobs feed
- [x] Jobs tab: placeholder (data integration coming)
- [x] Bookings tab: placeholder (data integration coming)
- [x] Payments tab: placeholder (data integration coming)
- [x] Messages tab: placeholder (data integration coming)
- [x] Profile tab: shows real user profile data from auth
- [x] PRO Jobs tab: full PRO jobs list with Apply/Applied states
- [x] Route /artist-dashboard registered in App.tsx
- [ ] Wire real data from Bubble API (applications, bookings, payments, messages)
- [ ] Wire "Dashboard" link in top nav to /artist-dashboard for artist users

## Artist Dashboard - Jobs Page
- [ ] Browse live Bubble artist jobs page design
- [ ] Check Ramita Ravi's applications data in DB
- [ ] Build Jobs page with Active / PRO Jobs / Applications sub-tabs
- [ ] Active tab: available jobs feed with Apply/Applied buttons
- [ ] PRO Jobs tab: PRO-flagged jobs with Apply/Applied states
- [ ] Applications tab: jobs the artist has applied to with status badges
- [ ] Wire real data from DB (premium_jobs for PRO, regular jobs for Active, interested_artists for Applications)

## Artist Dashboard - Jobs / Bookings / Payments / Messages Pages
- [ ] Build Jobs page: Jobs For You sub-tab (real data from getJobsFeed), PRO Jobs sub-tab (real data from getProJobsFeed), Applications sub-tab (real data from getProApplications)
- [ ] Build Bookings page: Upcoming / Past sub-tabs with real booking data from getBookings
- [ ] Build Payments page: payment history with amounts, status, receipt links from getPayments
- [ ] Build Messages page: conversation list + message thread UI (matching client-side messenger)
- [ ] Wire Apply button on PRO Jobs to applyToProJob mutation with optimistic update

## Facebook Group Acquisition Tool
- [x] Add acquisition_sessions and acquisition_leads tables to DB schema and run db:push
- [x] Build acquisitionRouter with parsePosts (AI parsing), generateOutreach, updateStatus, getSessions, getLeads, getSessionLeads procedures
- [x] AI parsing: extract poster name, studio name, location (inferred from group name), disciplines, contact info, lead type (job/artist)
- [x] Outreach generation: AI-written personalized DM with magic link placeholder
- [x] Build Acquisition section in Admin dashboard (Parse input, Jobs queue, Artists queue, Outreach modal, status tracking)
- [x] Promote admin accounts to role=admin in DB

## Acquisition - All Leads Table
- [x] Add acquisition.getAllLeads tRPC endpoint (all leads across all sessions, with session info joined)
- [x] Build All Leads table on Acquisition page: Type, Name, Studio, Location, Disciplines, Contact, Group, Date, Status
- [x] Expandable row to show full original post text
- [x] Filter by lead type (job/artist) and status (new/outreach_sent/joined)
- [x] Inline status update (change status directly from the table)
- [x] Inline "Generate Outreach" button per row
- [x] Parse Posts tab auto-switches to All Leads tab after parsing

## Artist Profile Feature
- [x] Update DB schema: add profile fields to users table (pronouns, bio, workTypes, mediaUrls, resumeUrl, resumeName, isPro, bookingCount, joinedDate, disciplines, services, reviews)
- [x] Add tRPC procedures: getArtistProfile, updateArtistProfile
- [x] Build ArtistProfile page: public view matching Artswrk design (header, tabs: About/Services/Reviews/Media/Resume)
- [x] Build EditProfile modal/page with all fields
- [x] Wire Profile link in artist dashboard sidebar
- [x] Seed Ramita's real profile data

## Artist Profile Redesign (match live Artswrk exactly)
- [x] Two-column layout: left photo card, right tabs panel
- [x] Left card: full-bleed photo, name+pronouns overlaid, pink PRO badge, stars+bookings, location+joined, work type chips, black Edit Profile button, Share link
- [x] Right panel: 3 tabs only (About / Services / Reviews), pink active underline
- [x] About tab: Media section (3 photos grid) + Resume section + Bio section
- [x] Services tab: each service has category image + title + sub-service chips
- [x] Reviews tab: full review cards with stars, text, reviewer avatar/name/studio/date
- [x] Seed real reviews data for Ramita
- [x] Seed real services with sub-service data

## CSV User Import (Bubble Export)
- [x] Parse 6,689 users from Bubble CSV export (Bio, Instagram, Location, Pronouns, Profile Picture, Priority List, Transportation, email)
- [x] Add priorityList column to users schema and run db:push
- [x] Upsert on email: update existing 309 users, insert 6,379 new artists
- [x] Fix Bubble CDN URLs to https:// prefix
- [x] Clean Instagram handles (strip full URLs, keep handle only)
- [x] Generate synthetic openId (bubble_csv_{email}) for new users without OAuth
- [x] Total users in DB: 6,957 (6,646 artists, 2,157 with bio, 2,896 with photo, 252 priority)

## Edit Profile Redesign (match live Artswrk exactly)
- [ ] Fix PRO badge: set artswrkPro=true for ramitaravi.94@gmail.com in DB
- [ ] Edit Profile - About tab: circular photo upload, First/Last name, Pronouns+Phone, Bio, Location+Map, Links (Website+Instagram)
- [ ] Edit Profile - Services tab: Artist Types toggle chips, Services list with List on Profile + Job Emails toggles per sub-service, email notification banner
- [ ] Edit Profile - Resume tab: drag & drop upload zone (dashed pink, 50MB), My Resumes list with edit/delete
- [ ] Edit Profile - Media tab: upload zone with pink icon, My Photos grid with delete buttons
- [ ] Edit Profile opens as full-page view (not modal), with back arrow + Save / Save & Close buttons
- [ ] Add serviceEmailEnabled column to artist_service_categories table

## Edit Profile Full-Page View
- [x] Rebuild EditProfileModal as full-page component with 4 tabs (About, Services, Resume, Media)
- [x] About tab: circular photo upload (Edit/Remove), First+Last Name, Pronouns+Phone, Bio, Location, Links (Website+Instagram)
- [x] Services tab: pink toggle chips for artist types, per-service List on Profile + Job Emails toggles, Disable All email banner
- [x] Resume tab: dashed pink drag-and-drop zone (50MB max), My Resumes list with edit/delete icons
- [x] Media tab: upload zone, My Photos grid with hover-reveal delete buttons
- [x] phoneNumber field added to DB schema, getMyProfile, and updateMyProfile
- [x] Wire Edit Profile as full-page overlay (fixed inset-0 z-50) when editOpen=true
- [x] Register /artist/profile route in App.tsx
- [x] 92 vitest tests passing

## Artists Dashboard Grid Improvements
- [x] Display artist names in "First L." format (e.g. "Ramita R.") in all grid cards
- [x] Filter out artists with no name data from the grid (267 real artists shown vs 6,646 empty records)
- [x] Use artist name as color seed fallback for unique colored initials per artist

## Artist Profile Page Improvements
- [x] Fix About tab to show Media grid (3 photos) + Resume row + Bio matching the screenshot design
- [x] Pull real profile photos from Bubble API for imported users (update profilePicture URLs in DB)
- [x] Fix left card to show work type chips (Dance Adjudicator, Dance Educator) from DB data

## Bubble API Connector (Live Sync)
- [x] Build server/bubbleApi.ts — typed Bubble REST API client with 5-min in-memory cache
- [x] Add tRPC procedures: bubble.getArtist, bubble.getLiveJobs, bubble.getLiveJob, bubble.bustCache
- [x] Build POST /api/webhooks/bubble — receive Bubble workflow events and upsert into DB
- [x] Add webhook secret verification (BUBBLE_WEBHOOK_SECRET env var)
- [x] Wire live Bubble data into ArtistProfilePage (fallback to DB if Bubble unreachable)
- [ ] Wire live Bubble jobs into Jobs dashboard feed (next step)
- [x] Write vitest tests for webhook receiver and Bubble proxy (12 tests passing)
- [x] Document Bubble-side setup steps (delivered to user in result message)

## Shared Auth-Aware Navbar
- [x] Extract Navbar from Home.tsx into shared client/src/components/Navbar.tsx
- [x] Navbar shows logged-in banner + Log Out when authenticated, Login/Join when logged out
- [x] Update Jobs.tsx to use shared Navbar (replaced inline non-auth-aware nav)
- [x] Update JobDetail.tsx to use shared Navbar
- [x] Update ProJobDetail.tsx to use shared Navbar
- [x] Update ApplyPage.tsx to use shared Navbar
- [x] Update About.tsx to use shared Navbar
- [x] Update DanceCompetitions.tsx to use shared Navbar
- [x] Update DanceStudios.tsx to use shared Navbar
- [x] Update MusicSchools.tsx to use shared Navbar
- [x] Update DanceTeachers.tsx to use shared Navbar
- [x] Update DanceJudges.tsx to use shared Navbar
- [x] Update MusicTeachers.tsx to use shared Navbar
- [x] Update Production.tsx to use shared Navbar

## Apply Gate Modal (Logged-Out Flow)
- [ ] Build ApplyGateModal component: blurred job teaser (title, location, date, blurred description/budget), email input, submit arrow
- [ ] tRPC endpoint: checkEmailExists — returns { exists: boolean } for a given email
- [ ] If email exists → redirect to /login?next=/jobs/:locationSlug/:jobSlug/apply
- [ ] If email is new → redirect to /join?next=/jobs/:locationSlug/:jobSlug/apply
- [ ] Wire ApplyGateModal to Jobs page Apply button (logged-out state)
- [ ] Wire ApplyGateModal to Job Detail page Apply Now button (logged-out state)
