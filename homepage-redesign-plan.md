# Artswrk Homepage Redesign Plan

## Design Inspiration Synthesis

### From itsnova.com
- Floating job cards scattered in hero background (asymmetric, editorial feel)
- Bold centered headline with rotating word (type animation)
- Clean white bg with strong black typography
- Stats bar: "$10M+ generated", "24,000+ jobs posted", "500+ cities"
- Two-tab feature section (For Hirers / For Artists) with icon feature list
- Testimonials section with large quote

### From ovationdancetour.com
- FULL-WIDTH bold uppercase headline in gradient/pink
- Dark sections alternating with light
- Video/photo mosaic backgrounds
- Strong CTA buttons with high contrast
- Dance industry vocabulary: "next generation", "takes center stage"

### From dribbble.com
- Left-aligned hero headline (massive, multi-line)
- Right side: featured visual/card
- Search bar prominently in hero
- Category pill filters below search
- Masonry/grid of content cards

### From radixdance.com (blocked, but known dance studio sites)
- Studio-owner focused language
- Class schedules, instructor profiles
- Bold section headers with accent colors

---

## New Homepage Architecture

### 0. Navbar (existing, keep)

### 1. HERO — "The Job Board Built for Dance"
**Layout**: Full-width dark (#111) background with gradient accents
- Left: Massive headline (3 lines, bold)
  - Line 1: "The Hiring Platform"
  - Line 2: "Built for" + rotating words: ["Dance Studios", "Competitions", "Artists"]  ← gradient animated
  - Line 3: (empty — headline ends)
- Subhead: "Post a job in 60 seconds. Reach 6,000+ vetted performing artists instantly."
- Two CTAs side by side:
  - Primary: "Post Your First Job →" (hirer gradient bg, white text)
  - Secondary: "Browse Artists" (white border, white text)
- Right side: Floating job cards (3 cards, staggered) showing real-looking job posts
  - Card 1: "Sub Teacher Needed · Hip Hop · Chicago, IL · $50/hr"
  - Card 2: "Competition Judge · May 3rd · Oak Park · Open Rate"
  - Card 3: "Ballet Teacher · Recurring · Mon/Wed · Evanston, IL"
- Bottom: Stats bar — "6,000+ Artists · 50+ Cities · Avg 3 Applicants in 24hrs · Free to Post"

### 2. AUDIENCE CLARITY — "Who Is Artswrk For?"
**Layout**: 3-column cards on white bg, each with icon + title + description + CTA
- Card 1: 🏫 Dance Studio Owners
  - "Need a sub teacher last minute? Recurring instructor? We've got 6,000+ vetted artists ready."
  - CTA: "Post a Job →"
- Card 2: 🏆 Competition & Event Owners
  - "Find certified judges, choreographers, and faculty for your next competition or showcase."
  - CTA: "Browse Artists →"
- Card 3: 💃 Performing Artists
  - "Get paid for your craft. Find teaching gigs, judging opportunities, and more."
  - CTA: "Create Your Profile →"

### 3. HOW IT WORKS — "Post a Job in 3 Steps"
**Layout**: Dark (#111) bg, 3 large numbered steps side by side
- Step 1: "Describe Your Need" — paste a description in plain English
- Step 2: "We Match You Instantly" — AI parses it, shows preview
- Step 3: "Hire with Confidence" — artists apply, you message and book
- Below steps: The JobPostFlow interactive demo (existing component, restyled)

### 4. ARTIST STRIP (existing, keep — infinite scroll photos)

### 5. LIVE JOBS TICKER — "Open Jobs Right Now"
**Layout**: White bg, scrolling horizontal ticker of real job titles from DB
- "Hip Hop Sub Teacher · Chicago" | "Ballet Recurring · NYC" | "Competition Judge · Atlanta" ...
- Below: "Join 6,000+ artists already on Artswrk" + Browse Artists CTA

### 6. FEATURES — "Everything You Need to Hire"
**Layout**: Two-tab (For Hirers / For Artists), icon feature list (keep existing structure, redesign visually)
- Tab: For Hirers
  - Post in 60 seconds
  - AI-powered job parsing
  - Reach 6,000+ vetted artists
  - Message applicants directly
  - Track all applications in one place
- Tab: For Artists
  - Get discovered by studios & competitions
  - Apply to jobs near you
  - Build your professional profile
  - Get paid securely through the platform
  - PRO badge for top artists

### 7. TESTIMONIALS — "What People Are Saying"
**Layout**: 3 testimonial cards on gray bg
- Keep existing testimonials, redesign as large quote cards with avatar

### 8. FOR BUSINESSES — Logo ticker (keep, restyled)

### 9. FAQ (keep, restyled)

### 10. FINAL CTA BANNER
**Layout**: Full-width gradient bg (hirer gradient)
- "Ready to find your next artist?"
- Two CTAs: "Post a Job Free" + "Browse Artists"

### 11. Footer (keep existing)

---

## Design Tokens (LOCKED)
- Font: Poppins (400–900)
- Hirer gradient: #FFBC5D → #F25722 (class: hirer-grad-bg / hirer-grad-text)
- Artist gradient: #ec008c → #ff7171 (class: artist-grad-bg / artist-grad-text)
- Dark: #111111
- White: #ffffff
- Gray bg sections: #f8f8f8 / #f3f3f3

## Key Design Principles for This Redesign
1. **Dark hero** — like Ovation, lead with a bold dark hero that commands attention
2. **Floating job cards** — like Nova, show real job posts floating in the hero
3. **Audience-first clarity** — 3 clear audience cards immediately after hero
4. **Interactive demo** — keep the JobPostFlow but make it the centerpiece of "How It Works"
5. **Stats everywhere** — 6,000+ artists, 50+ cities, free to post — repeat these
6. **Dance vocabulary** — "sub teacher", "competition judge", "choreographer", "showcase" — not generic "talent"
