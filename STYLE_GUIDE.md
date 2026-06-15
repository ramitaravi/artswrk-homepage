# Artswrk Style Guide

## Color System

### Client / Hirer Side (orange)
| Token | Value | Usage |
|-------|-------|-------|
| Primary accent | `#F25722` | Buttons, active states, badges, links |
| Gradient start | `#FFBC5D` | Gradient backgrounds |
| Gradient end | `#F25722` | Gradient backgrounds |
| CSS class | `hirer-grad-bg` | Background gradient on elements |
| CSS class | `hirer-grad-text` | Gradient text effect (ARTSWRK logo, headings) |

### Artist Side (pink/magenta)
| Token | Value | Usage |
|-------|-------|-------|
| Primary accent | `#ec008c` | Buttons, active states, badges, links, focus rings |
| Gradient start | `#ff7171` | Gradient backgrounds (light end) |
| Gradient end | `#ec008c` | Gradient backgrounds (deep end) |
| CSS class | `artist-grad-bg` | Background gradient on elements |
| CSS class | `artist-grad-text` | Gradient text effect (ARTSWRK logo, headings) |
| Hover darker | `#c40075` | Hover state for solid pink buttons |

### Tailwind equivalents (artist side)
- `bg-pink-50` — light tinted backgrounds (active nav, invoice summary)
- `border-pink-100` / `border-pink-200` — subtle pink borders
- `text-pink-*` — pink text variants

### Shared / Neutral
| Token | Value | Usage |
|-------|-------|-------|
| Near-black | `#111` | Primary text, headings, bold amounts |
| White | `#fff` | Card backgrounds, button text on dark |
| Gray scale | Tailwind `gray-*` | Secondary text, borders, dividers |
| Green | `text-green-600` / `bg-green-50` | Paid / success states |
| Amber | Tailwind `amber-*` | Client premium badge |

---

## Typography
- **Font**: Poppins (loaded via Google Fonts in `index.html`)
- **Base weight**: 500 (medium) — set globally on `body`
- **Headings**: h1 900 / h2 800 / h3 700 / h4 600 (see `index.css` `@layer base`)

---

## Gradient Reference

```css
/* Artist */
background: linear-gradient(135deg, #ff7171, #ec008c);

/* Hirer / Client */
background: linear-gradient(135deg, #FFBC5D, #F25722);

/* Wallet card (artist) */
background: linear-gradient(135deg, #e94e77 0%, #c33c6d 60%, #a02058 100%);
```

---

## Component Conventions

### Buttons
- **Primary artist action**: `artist-grad-bg text-white rounded-xl font-bold`
- **Primary client action**: `hirer-grad-bg text-white rounded-full font-bold`
- **Secondary**: `bg-white border border-gray-200 text-gray-700 rounded-xl`
- **Destructive**: `bg-red-500 text-white` or `text-red-500 hover:bg-red-50`

### Cards
- Standard: `bg-white rounded-2xl border border-gray-100`
- Elevated: `bg-white rounded-2xl shadow-sm`
- Gradient artist: `artist-grad-bg rounded-2xl text-white`

### Nav active state
- Artist: `bg-pink-50 text-[#ec008c]`
- Client: `bg-orange-50 text-[#F25722]`

---

## Page Ownership by Color

| Surface | Primary color |
|---------|--------------|
| Artist dashboard (`/app` for artists) | Pink `#ec008c` |
| Client / hirer dashboard (`/app` for clients) | Orange `#F25722` |
| Enterprise dashboard | Orange `#F25722` |
| Marketing site (Navbar, landing) | Both (logo uses hirer gradient) |
| Admin dashboard | Orange `#F25722` |
