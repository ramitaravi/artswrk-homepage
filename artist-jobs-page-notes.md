# Artist Dashboard - Jobs Page Design Notes

## Layout
- Full page title: "Jobs For You (58)" with count
- Four sub-tabs: **Jobs Near Me** (active, with count) | **PRO Jobs** (star icon) | **Applications**
- Left side: job list with filters
- Right side: map panel (gray placeholder in Bubble)

## Filters Bar
- Search Jobs... (text input)
- Search Location... (pre-filled with user's address: "182 4th Ave, Brooklyn, NY 11217, USA")
- Artist Type dropdown (Dance Educator, Photographer, Dance Adjudicator, Videographer, Acting Coach, Vocal Coach, Side Jobs, Music Teacher)
- Service Type dropdown (Competition Choreography, Substitute Teacher, Recurring Classes, Private Lessons, Master Classes, Photoshoot, Videoshoot, etc.)
- Reset Filters button

## PRO Jobs mini-section (at top of Jobs Near Me tab)
- Section header: "Jobs PRO ⭐️" with "View PRO Jobs →" link
- Horizontal scroll list of PRO job cards:
  - Job title | Date
  - Company name
  - 📍 Location (Work From Anywhere)
  - ✅ Applied! button (green) OR Apply → button (black)

## Jobs For You list (below PRO section)
- Job card format:
  - Company logo (circle avatar with initials if no photo)
  - Company name (bold)
  - Service type
  - Location · Posted X time ago
  - Date/time range
  - Rate (Open rate OR $XX.XX/hr)
  - Apply button (black) OR ✅ Applied! (green)

## Applications tab
- Shows jobs the artist has applied to
- Same card format but with status indicator

## Jobs Near Me tab
- Same as Jobs For You but filtered by location
- Has map on the right side

## Key data needed
- Regular jobs from `jobs` table (publicList endpoint)
- PRO jobs from `premium_jobs` table
- Artist's applications from `interested_artists` table (to show Applied! state)
- Artist's location for "Jobs Near Me" filtering
