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
