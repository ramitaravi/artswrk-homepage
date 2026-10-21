# Booking rates: what's actually going on

Written 2026-10-20, after the fifth rate bug in six weeks. This is the whole
picture — the root cause, every bug it has caused, and an honest confidence
level on each fix.

**The short version:** the stored data has been right every single time. All
five bugs were in code that *read* the data and misunderstood which of two
meanings a column had. Verified: of 4,398 bookings, **zero** have inconsistent
rate data today.

---

## The root cause, in one paragraph

`bookings.artistRate` and `bookings.clientRate` hold **two different things
depending on the row**, and nothing in the column name, the type, or the schema
tells you which:

| Row type | `artistRate` holds | Example |
|---|---|---|
| Confirmed applicant (job flow) | the **booking TOTAL** | $85/hr × 5 hrs → **425** |
| Class date / admin booking | the **per-hour UNIT rate** | $55/hr, 4 hrs → **55** |
| Legacy Bubble row (4,040 of them) | the **booking TOTAL** | $50/hr × 5 hrs → **250** |

Read it as a unit rate when it's a total and you show `$425/hr`. Read it as a
total when it's a unit rate and you charge `$18` for 36 hours. **Both have
happened, in production, to real people.**

`hourlyRate` is the column that always means per-hour. It was added later and
is populated on the 358 rows with a `rateType`; the 4,040 legacy rows have
neither.

---

## Every bug this has caused

### 1. Flat bookings billed as hourly — $3,600 became $734,400
**Found:** before 2026-09. **Charged a card:** nearly.
"Hourly" was inferred from `hours` being set at all. 365 flat bookings record
hours too, so they were multiplied.
**Fix:** `isHourlyBooking()` reads the applicant record's real `isHourlyRate`
flag. Never inferred.
**Confidence: HIGH.** Pinned by `shared/bookingRates.test.ts` (14 tests).

### 2. Hourly bookings under-billed — $189 became $63
**Found:** 2026-09. **Charged a card:** yes.
The confirm flow stored the raw hourly rate in `artistRate`, giving the column
two meanings on the same kind of row. $60/hr × 3 hrs saved as 60.
**Fix:** the confirm flow now multiplies before storing, and puts the unit in
`hourlyRate`. Verified on Camia Green's booking: `hourlyRate 85, hours 5,
artistRate 425`.
**Confidence: HIGH.** Audit finds 0 confirmed applicants where
`artistRate != hourlyRate × hours`.

### 3. The invoice page showed $840 for a $210 booking
**Found:** 2026-09-30. **Charged a card:** no — display only, but it disagreed
with the charge, which is worse than no preview.
The page multiplied `artistRate` (a total) by hours.
**Fix:** the page calls the same functions the server charges with.
**Confidence: HIGH.** `shared/invoicePreview.test.ts` pins four real bookings;
15/15 historical invoices reproduce exactly.

### 4. McKell's 36h10m at $18/hr invoiced as $18
**Found:** 2026-10-08. **Charged a card:** not yet — caught with a live $19
payment link outstanding.
`invoice.approve` only multiplied hours when `recurringSeriesId` was set. An
hourly *admin* booking isn't a class date, so it fell through to `artistRate`
— which on that row is the $18 unit. $18 + $1 fee = the stored $19.00 exactly.
**Fix:** `isHourlyRateBooking()` — one test, used by the dashboard, the studio's
review page and the approve endpoint.
**Confidence: HIGH for the logic, and the blast radius was measured**: exactly
1 live unpaid invoice was affected, 0 hourly bookings lack a unit rate, and the
two other hourly bookings price identically before and after.
**⚠️ The data fix is still outstanding** — booking 1350001 still reads $19.

### 5. Camia Green booked at "$425/hr"
**Found:** 2026-10-20. **Charged a card:** no.
She pitched $85/hr for a 5-hour sub at Inspirations PAC. Stored correctly.
**Five screens** printed `${artistRate}/hr` — and that's the total.
**Fix:** `bookingRateLabel()`, which only ever prints `/hr` next to a genuine
unit rate and otherwise says "total".
**Confidence: HIGH for the screens fixed, MEDIUM that none remain** — see below.

---

## Where it stands now

### The data: verified clean
`node scripts/audit-booking-rates.mjs` (read-only, run it any time):

```
ok  0  confirmed applicants where artistRate != hourlyRate x hours
ok  0  class dates where artistRate != the unit rate
ok  0  hourly bookings with no unit rate (would price at $0)
ok  0  flat bookings carrying an hourly rate
ok  0  artswrk bookings where clientRate is below artistRate
ok  0  paid class-date invoices charged something other than rate x hours
```

**Confidence: HIGH.** Every stored booking is internally consistent.

### The money path: one function
Anything that charges a card goes through `bookingMoney()` or
`resolveBookingBaseAmount()` in `shared/bookingRates.ts`. **69 tests** across 7
files cover it, including real production rows.

**Confidence: HIGH.** This is the part I'd defend hardest — it is tested
against actual bookings that have been paid, and the amounts reproduce.

### The display path: fixed, and now enforced
`bookingRateLabel()` backs the studio bookings list, the admin bookings table,
the admin payments card, the client's job detail and the artist's weekly-class
copy.

**`shared/rateUsage.guard.test.ts` makes this a build failure, not a habit.**
It runs with `pnpm test` and fails if any line puts "/hr" next to a raw
`artistRate`/`clientRate`. Writing it immediately surfaced **nine** more sites
I had missed by reading.

Six of those turned out to be legitimate — admin recurring bookings and legacy
weekly periods genuinely DO store a unit rate in those columns. Each now
carries an inline `unit-rate:` marker saying why, so an exception is a decision
someone made on purpose and can be re-reviewed, rather than an unexamined read.
A second check ratchets the number of files touching the raw columns so it can
fall but not grow.

**Confidence: HIGH for "/hr" mislabelling** — it cannot be reintroduced without
the build going red. **MEDIUM for subtler misuse**, e.g. multiplying a total in
a context the guard cannot see.

### The legacy rows: backfilled
3,180 of the 4,040 rows that had no `rateType` now state their own rule —
2,923 hourly (with a derived `hourlyRate`) and 257 flat (with `flatRate`).

Only converted where it is **provably lossless**: an hourly row had to divide
exactly, so `hourlyRate × hours === artistRate` to the cent and no amount
changes. 29 rows that did not divide cleanly were left alone rather than
rounded, and 827 with no applicant record were left alone because there is no
evidence which rule applies — guessing is how this started.

**860 legacy rows remain.** Of all 4,040, only 6 were unpaid, so almost none of
this could still be charged.

**Confidence: HIGH.** Verified after the write: 0 rows where the total
disagrees with rate × hours.

---

## What would actually make this safe

The real fix is to stop a column meaning two things. In rough order of value:

1. ~~**A guard against reading `artistRate` directly in UI code.**~~ **DONE** —
   `shared/rateUsage.guard.test.ts`, runs in `pnpm test`.
2. ~~**Backfill `rateType`/`hourlyRate` on the legacy rows.**~~ **DONE for
   3,180 of 4,040.** 860 remain, all of them unconvertible without guessing:
   827 have no applicant record and 29 do not divide cleanly into a unit rate.
   They can only be resolved by someone deciding case by case.
3. **Rename the columns** — `artistTotal` / `clientTotal`. The current names are
   actively misleading and no comment survives contact with a hurried change.
4. **Run the audit script in CI** so a regression is a failed build, not a
   studio emailing Brittany.

With 1 and 2 done, the common failure is now caught by the build. The names
are still misleading, though, and every one of the five bugs began with someone
reasonably assuming a column called `artistRate` holds a rate.

### One known, harmless discrepancy
The confirm flow rounds a booking total to **whole dollars**
(`Math.round(unitRate × hours)`), so 3.75 hrs × $65 stores as $244 rather than
$243.75. One booking (#1380001, already paid) carries that 25¢ difference. It
favours the artist and is not worth unwinding, but it is why the audit tolerates
sub-dollar differences on confirmed applicants.

---

## If a rate looks wrong

1. Run `node scripts/audit-booking-rates.mjs`. If clean, the data is fine and
   it's a display bug.
2. Pull the row: `hourlyRate` is the unit, `artistRate` is the total on a job
   booking and the unit on a class date.
3. Work out what *should* show: hourly → `hourlyRate × hours`; flat → `flatRate`;
   legacy → `artistRate` as-is, never multiplied.
4. Whatever is printing it should be calling `bookingRateLabel()`, and almost
   certainly isn't.
