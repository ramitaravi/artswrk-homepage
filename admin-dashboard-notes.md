# Bubble Admin Dashboard — Structure Notes

## Sidebar Nav (dark background)
Dashboard | Artists | Clients | Jobs | Bookings | PRO | End of Year | Leads | Payment | Settings

## Dashboard (Overview) Page
- Title: "Dashboard (6631)" — total user count
- Subtitle: "Here are the latest insights, Ramita"
- Stat cards row 1: Revenue $947,532.81 | Commission $51,751.00 | Bookings 3820 | Future Revenue $34,619.75
- Stat cards row 2: Artists 5480, Basic 324, Priority 7, PRO 234 | Clients 1048, Premium 68
- Recent Payments table: Customer | Status | Details | Created at
  - Columns: customer name + stripe ID, paid status, Payment Date + Booking Date + Amount, created date
  - Paginated (Page 1 of 1424)

## Artists Page
- Title: "All Artists (5480)"
- View toggle: List / Grid
- Filters: Artist Type | Service Type | State | Plan | Groups | Sort by | Created Date
- Search: "Search Artists..." | "Search Location..."
- "Select All (5480)" button
- List shows: profile % complete (0% 0%), name, location, artist types

## Clients Page  
- Title: "All Clients (1048)"
- View toggle: List / Grid
- Filters: Hiring Category | State | Plan | Business? | Sort by | Created Date
- Search: "Search Clients.." | "Search Client Companies..." | "Search Location..."
- "Select All (1048)" button
- List shows: name, location, plan type (Individual/Business)

## Jobs Page (tab=requests)
- Title: "All Jobs (3620)"
- Filters: Services dropdown | Status (Active, Completed, Lost-No Revenue, Confirmed, Deleted by Client, Submissions Paused) | State | Filter (No Submissions, Confirm Artist)
- Search: Search Clients... | Search Client Company... | Search Artists...
- Pagination: Back / Next, Page X of 73
- Each row: Client name + company | Service type | Location + Posted date | Date/time + rate | Details text | Status dropdown | Job Title field
## Bookings Page (tab=bookings)
- Title: "💰 Bookings (99)" — note: this is upcoming only
- Filters: Upcoming/Past toggle | Payment Status (Unpaid, Paid, Refunded) | Booking Status (Completed, Confirmed, Cancelled, Pay Now)
- Search: Search Artists... | Search Client Full Name... | Search Client Company Name...
- Pagination: Back / Next
- Table columns: DATE | USERS (client name + company, artist name) | RATE (Client Rate $X, Artist Rate $X) | CLIENT RATE | STATUS | PAYMENT
- Each row also shows: Stripe Fee, Post Fee Revenue, Gross Profit, status dropdowns, Delete button, Create Conversation?, External payment? toggle
## PRO Page (to check)
## Leads Page (to check)
## Payment Page (to check)
## Settings Page (to check)
