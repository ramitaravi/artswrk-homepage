# Enterprise Dashboard — Bubble UI Notes

## Overall Layout
- Top navbar: ARTSWRK logo (left), Logout button + user avatar (right)
- NO sidebar — it's a single-page tabbed layout in Bubble
- We will ADD a sidebar matching the current dashboard design language

## Header Section
- Large company logo (circular, ~150px) on the left
- Company name as H4 below the logo
- "+ Post Job" button (outlined, top right of the content area)

## Main Navigation Tabs (3 tabs)
1. **Jobs** — default tab
2. **Companies**
3. **Artists**

## Tab: Jobs
- Left panel: Job card(s)
  - Job title (bold, large)
  - Company name
  - 📍 Location
  - Job type badge (e.g. "Full-Time Salaried Role")
  - "+ N" applicant count button (e.g. "+ 13")
  - Status badge: "Active" (green/outlined)
- Right panel: "Applications" section
  - List of applicant cards: avatar + name + job title they applied for
  - Scrollable list

## Tab: Companies
- Grid/list of company cards
  - Company logo
  - Company name
  - "N open role(s)" subtitle
- REVEL Dance Convention had 1 open role shown

## Tab: Artists
- Two sub-tabs: "Browse All" | "Interested"
- Browse All: full artist browse (same as regular dashboard)
- Interested: artists who have expressed interest in the enterprise's jobs

## Key Differences from Regular Client Dashboard
- Enterprise users represent ORGANIZATIONS (dance conventions, companies) not individual studios
- They manage MULTIPLE companies under one account
- Jobs are "premium jobs" (full-time salaried roles, not gig work)
- Applications panel is prominent (right side of Jobs tab)
- No bookings/payments section visible — this is a hiring/recruiting flow, not a booking flow

## Data for Taylor (taylor@dancerevel.com)
- Bubble email: taylor@dancerevel.com
- Company: REVEL Dance Convention (or Dance Revel)
- Enterprise = true
- Seed user data only for now (no jobs/bookings yet)
