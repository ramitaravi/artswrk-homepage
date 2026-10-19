# Adding an artist as an admin

How an artist gets onto the platform without signing up themselves: what the
form writes, what it refuses, how the invite works, and where each piece lives.

As of 2026-10-19 there are **2,607** accounts flagged `addedByAdmin`, of which
**2,559** have not yet set a password. This path is how most of the roster got
here, so it is worth knowing precisely.

---

## The form

`/admin` → **Artists** → **Create Artist**.

Code: `AdminArtistForm` in [`client/src/pages/Admin.tsx`](../client/src/pages/Admin.tsx).
The same component backs the edit view — `isCreate` is the only difference,
which is why a change to one affects both.

### Required before Create Artist will enable

| Field | Rule |
|---|---|
| First name | Non-empty |
| Last name | Non-empty |
| Email | Valid, and not already on an account |
| **Location** | Must be **picked from the Google dropdown**, not typed |
| **Artist type** | At least one |

The button stays disabled until all five are satisfied, and the server enforces
the same rules, so a direct API call cannot bypass them.

### Everything else the form writes

Pronouns, phone, tagline, bio, profile picture, website, Instagram, TikTok,
YouTube, portfolio, services, styles, affiliations, Basic/PRO plan flags, and
an optional password.

Social links run through `normalizeSocialLink`, so a handle and a full URL both
end up stored the same way.

---

## Location — why the dropdown matters

`users` carries seven location columns, not one:

```
location          "Brooklyn, NY, USA"      the label we display
locationLat       "40.6782"                 ┐
locationLng       "-73.9442"                │ what distance search runs on
locationCity      "Brooklyn"                │
locationState     "New York"                │ what city/state filters match
locationCountry   "United States"           │
locationPlaceId   "ChIJCSF8lBZEwokRhngAB..."┘ stable across renames
```

`LocationAutocompleteInput` hands back all of it as a `PlaceLocation`. The form
keeps the whole object in state and sends it as `place`; `placeColumns()` in
[`server/routers.ts`](../server/routers.ts) writes all seven together.

**Typed text is not enough.** If someone types "Brooklyn" and never picks a
suggestion, the payload has no coordinates — `hasCoordinates()` returns false,
the field turns amber, and the form refuses to save. That artist would
otherwise be invisible to every "who do we have near X" search, which is the
most common thing these records are used for.

Re-picking a location on the edit form rewrites all seven columns together, so
a label can never be left sitting on stale coordinates.

> **History.** Until 2026-10-19 the form sent only the `location` string and
> dropped the other six. Separately, the Enter-key guard in
> `LocationAutocompleteInput` looked for a `.pac-container.pac-open` element.
> Google never adds a `pac-open` class — its container is
> `pac-container pac-logo hdpi`, shown and hidden with `display` — so the guard
> matched nothing and every Enter press fell through to the form, submitting it
> mid-typing. Both are fixed; the guard now checks for a visible container with
> real suggestions in it.

---

## Artist types and services

Services **bubble up under** the artist types chosen above them:

- Pick an artist type → its services are added automatically as a starting point.
- The Services box then only offers services belonging to the selected types.
- Remove an artist type → its services are removed too, so a record cannot keep
  a Dance service after Dance is gone.
- Before any type is picked, Services says "Pick an artist type first".

All three pickers (types, services, styles) and Affiliations are
`TypeaheadMultiSelect` — you type to filter, Enter takes the top match,
Backspace on an empty box removes the last chip. They replaced walls of toggle
chips that were unscannable once the lists grew past a dozen.

### Stored as ids, shown as names

`masterArtistTypes`, `masterServiceType` and `masterStyles` hold JSON arrays of
**Bubble-matching ids**, never names. `resolveMaster*Ids` converts on the way
in and `resolveMaster*Names` on the way out. Writing names into those columns
breaks matching against every Bubble-era record — don't.

---

## Affiliations

Schools, studios and programs an artist belongs to — BOCO, NYU Tisch, Broadway
Dance Center. Two tables: `affiliations` (36 rows) and `user_affiliations`.

**Who can do what**

| | Can read | Can change |
|---|---|---|
| Admin | yes | yes — on create, on edit, and in bulk from the list |
| Artist | yes, on their own profile | **no** — there is no artist-facing write path |
| Public | yes, on an artist's public profile | no |

**Adding a new one.** Type a name that isn't in the list and pick
*Add "…"*. It's created on save via `findOrCreateAffiliation`, which matches
case-insensitively on purpose: every text column in this database is
`utf8mb4_bin`, so a plain equality check would treat "BOCO" and "boco" as two
different schools.

**Two affiliation lists, deliberately.**

- `artists.getAffiliations` → the **public filter**. Inner-joins
  `user_affiliations`, so it only returns affiliations that have at least one
  artist. Correct for a filter: an empty one would filter to nothing.
- `admin.allAffiliations` → the **admin picker**. Left-joins, so it returns all
  36 with a count. Without this a new affiliation could never be attached to
  its first artist — it wouldn't appear until someone already had it.

On edit, `setArtistAffiliations` replaces the artist's set wholesale, so
unticking one removes it.

---

## The welcome email and how the artist joins

The toggle at the bottom of the create form controls whether anything is sent.
**Off means no email at all** — the account still exists and can be claimed
later from the artist's profile page.

With it on:

1. A password reset token is generated, valid **7 days**, and the claim link is
   `/reset-password?token=…`.
2. The admin's composed subject/body is sent with a **Create Your Password**
   button appended, **CC'd to support@artswrk.com**.
3. If the composer is left untouched, `sendArtistWelcomeEmail` sends the
   standard template instead — which CCs support on its own.

The CC exists so there is proof the send happened and a copy of the exact claim
link, for when an artist says the email never arrived.

The send is **awaited, not fire-and-forget**. An un-awaited send has nothing
keeping it alive if the server restarts mid-request — a dev bounce, a Manus
redeploy — and it vanishes with no error and no retry. The result comes back as
`emailSent`: `null` if none was requested, `true`/`false` if one was attempted.
`false` surfaces a warning toast telling you to resend from the profile.

### What marks them as admin-added

```
addedByAdmin: true          the flag support and reporting filter on
source: "Admin"             matches the Bubble-era meaning
userSignedUp: true          so they aren't pushed back into onboarding
onboardingStep: 4           profile already populated
passwordIsTemporary: true   unless an admin typed a password
```

So when they land on artswrk.com/app they set a password and are straight in —
no second signup, and no duplicate account.

> **If the claim link expires** (7 days), resend from the artist's profile.
> 2,559 of these accounts are past that window, so anyone from an old batch
> needs a fresh link rather than the original email.

---

## Profile picture

`ImageUploadField` uploads to the same storage everything else uses and keeps
the returned URL — 8MB cap, png/jpg/gif/webp. "Paste a URL instead" is still
there for an image already hosted somewhere.

It calls `admin.uploadImage`, which (unlike `admin.uploadAccountLogo`) takes no
`userId`, because on the create form the artist has no id yet.

---

## Where things live

| Piece | File |
|---|---|
| The form | `client/src/pages/Admin.tsx` → `AdminArtistForm` |
| Type-to-search multi-select | `client/src/components/TypeaheadMultiSelect.tsx` |
| Image upload | `client/src/components/ImageUploadField.tsx` |
| Location input | `client/src/components/LocationAutocompleteInput.tsx` |
| Place parsing, `hasCoordinates` | `shared/location.ts` |
| `createArtist`, `updateArtist`, `placeColumns` | `server/routers.ts` |
| `uploadImage`, `allAffiliations`, `createAffiliation` | `server/routers.ts` (admin router) |
| Affiliation reads/writes | `server/db.ts` |

---

## Known gaps

- **Artists cannot edit their own affiliations.** Admin-only by default; no
  decision has been made to open it up.
- **No bulk import.** One artist at a time.
- **Resumes and credits** are not on this form; the artist adds those
  themselves, or an admin does it from the edit view.
- **No duplicate-name check.** Email uniqueness is enforced, name similarity is
  not, so the same person under two addresses creates two accounts.
